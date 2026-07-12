/**
 * services/hdz/scene-compiler.service.ts — Phase X Scene Compiler
 *
 * 场景编译器：从 Planner 产出 + WorldState 子图 → 编译 SceneGraph。
 * SceneGraph 是 Writer 的唯一输入，替代"全文前情拼接"。
 *
 * 核心变换：
 *   planner_output + world_state_snapshot → SceneGraph[]
 *   SceneGraph = { scene_id, entities[], constraints[], state_view[], allowed_changes, forbidden_changes }
 *
 * 铁律：
 * 1. Writer 永不接收全文历史，只接收 SceneGraph
 * 2. SceneGraph.involved_entities 是 Writer 唯一能感知的世界
 * 3. SceneGraph.forbidden_changes 阻止 Writer 破坏已经固化的事实
 */

import { hdzCharacterRepository } from './repositories/hdz-character.repository.js'
import { sceneDagRepository } from './repositories/scene-dag.repository.js'
import { hdzChapterRepository } from './repositories/hdz-chapter.repository.js'
import { getWorldState, applyStateDelta, type StateDelta } from './world-state.service.js'
import { getEntityById, getAllEntities } from './entity-registry.service.js'

// ─── 类型定义 ───

export interface SceneGraph {
  sceneId: string
  chapterNo: number
  sceneNo: number
  projectId: string

  /** 当前场景涉及的实体 entity_id 列表 */
  involvedEntities: string[]

  /** 这些实体的当前世界状态快照 */
  stateView: Record<string, any>

  /** Writer 可以修改的状态字段 */
  allowedChanges: string[]

  /** Writer 绝对不能触碰的字段/状态 */
  forbiddenChanges: string[]

  /** 来自前文的约束列表 */
  constraints: SceneConstraint[]

  /** 大纲中指定的场景要点 */
  sceneDirective: string
}

export interface SceneConstraint {
  type: 'entity_state' | 'timeline' | 'causality' | 'consistency'
  description: string
  entityId?: string
  expectedValue?: any
}

export interface CompilerInput {
  projectId: string
  chapterNo: number
  chapterTitle: string
  sceneNo: number
  outline: string             // 本章大纲
  prevChapterDelta?: string   // 上一章的 state_delta 摘要（用于连贯性）
}

// ─── Scene Compiler ───

class SceneCompiler {
  /**
   * 从 Planner 产出 + WorldState 编译 SceneGraph
   */
  async compile(input: CompilerInput): Promise<SceneGraph> {
    const { projectId, chapterNo, sceneNo } = input

    // 1. 解析大纲中的实体引用
    const entityNames = this.extractEntityNames(input.outline)
    if (entityNames.length === 0) {
      // 无实体时，从已有角色中猜测出场
      const chars = await hdzCharacterRepository.findMany({ projectId }) as any[]
      for (const ch of chars.slice(0, 3)) {
        entityNames.push(ch.name)
      }
    }

    // 2. 注册/检索实体 ID
    const entityIds: string[] = []
    const { resolveName } = await import('./entity-registry.service.js')
    for (const name of entityNames) {
      try {
        const id = await resolveName(projectId, name, 'character')
        if (!entityIds.includes(id)) entityIds.push(id)
      } catch {
        // 无法解析的跳过
      }
    }

    // 3. 获取这些实体的当前世界状态
    const worldState = await getWorldState(projectId, entityIds)

    // 4. 构建 stateView
    const stateView: Record<string, any> = {}
    for (const [entityId, state] of worldState) {
      const entity = await getEntityById(entityId)
      stateView[entity?.name || entityId] = {
        entityId,
        name: entity?.name || entityId,
        health: state.health,
        location: state.location,
        inventory: state.inventory,
        relationships: state.relationships,
        statusFlags: state.statusFlags,
      }
    }

    // 5. 构建约束
    const constraints: SceneConstraint[] = []
    constraints.push({
      type: 'entity_state',
      description: '已有角色的状态（生命/位置/持有物）在无明确剧情驱动时不可随意变更',
    })
    constraints.push({
      type: 'timeline',
      description: `本章位于第 ${chapterNo} 章，前文已发生的事件不可逆转`,
    })
    constraints.push({
      type: 'causality',
      description: '本章剧情必须遵循故事大纲和已有的因果链条',
    })

    // 6. 检测固化的 forbidden_changes
    const forbiddenChanges = this.detectForbiddenChanges(worldState, entityIds)

    // 7. 持久化 SceneDag 记录
    const sceneId = `ch${chapterNo}_s${sceneNo}`
    await sceneDagRepository.upsert(
      { projectId_sceneId: { projectId, sceneId } },
      {
        projectId,
        chapterNo,
        sceneNo,
        sceneId,
        dagJson: {
          involvedEntities: entityIds,
          constraints: constraints.map(c => ({ type: c.type, desc: c.description })),
          entityCount: entityIds.length,
        },
      },
      {
        update: {
          dagJson: {
            involvedEntities: entityIds,
            constraints: constraints.map(c => ({ type: c.type, desc: c.description })),
            entityCount: entityIds.length,
          },
        },
      },
    )

    console.log(`[SceneCompiler] ch${chapterNo}_s${sceneNo}: ${entityIds.length} entities, ${constraints.length} constraints`)

    return {
      sceneId,
      chapterNo,
      sceneNo,
      projectId,
      involvedEntities: entityIds,
      stateView,
      allowedChanges: ['health', 'location', 'inventory', 'statusFlags', 'relationships'],
      forbiddenChanges,
      constraints,
      sceneDirective: input.outline,
    }
  }

  /**
   * 从大纲文本中提取可能的人物/实体名称
   * 使用简单的启发式方法（后续可升级为 LLM 提取）
   */
  private extractEntityNames(text: string): string[] {
    // 目前返回空，让上游通过 LLM 注入
    return []
  }

  /**
   * 检测固化的事实——Writer 绝对不能改的
   * 例如：已经死亡的角色不能复生、已失去的物品不能无故回来
   */
  private detectForbiddenChanges(
    worldState: Map<string, any>,
    entityIds: string[],
  ): string[] {
    const forbidden: string[] = []
    for (const eid of entityIds) {
      const state = worldState.get(eid)
      if (!state) continue
      // 已死不可复生
      if (state.statusFlags?.isAlive === false) {
        forbidden.push(`entity:${eid}:statusFlags.isAlive → 不得将已死角色复活`)
      }
      // 失物不可无故复得
      // (inventory 只允许添加，移除需要剧情驱动)
    }
    return forbidden
  }

  /**
   * 从 Writer 输出中提取 state_delta（供下游调用）
   * 在旧 Writer 的兼容模式下，尝试解析生成
   */
  extractDeltaFromWriterOutput(writerOutput: any): StateDelta[] {
    if (writerOutput?.state_delta && Array.isArray(writerOutput.state_delta)) {
      return writerOutput.state_delta as StateDelta[]
    }
    return []
  }

  /**
   * 对比旧 Writer 上下文与新 SceneGraph 上下文的差异（Shadow 模式监控）
   */
  async logContextDivergence(
    projectId: string,
    chapterNo: number,
    legacyContextSize: number,
    sceneContextSize: number,
  ): Promise<void> {
    const divergence = legacyContextSize > 0
      ? Math.round(((sceneContextSize - legacyContextSize) / legacyContextSize) * 100)
      : 0
    console.log(
      `[SceneCompiler/Shadow] ch${chapterNo}: legacy=${legacyContextSize}chars → scene=${sceneContextSize}chars (${divergence}%)`,
    )
  }
}


// ═══════════════════════════════════════════
//  Phase X.4 — Entity Contract (SceneGraph v2)
// ═══════════════════════════════════════════

export interface EntityContract {
  /** 主角/关键实体 — 本章必须出现 */
  required: string[]
  /** 辅助实体 — 建议出现但不强制 */
  optional: string[]
  /** 潜伏实体 — 不在本章出现但保持状态引用 */
  latent: string[]
  /** 禁止实体/状态 — Writer 绝对不能写的内容 */
  forbidden: string[]
  /** 实体出现的最低频次约束 */
  minimumMentions?: number
  /** 解释为何选择这些实体 */
  rationale?: string
}

export interface ContractedSceneGraph extends SceneGraph {
  entityContract: EntityContract
  /** 归一化对齐评分（v2） */
  contractAlignmentScore?: number
}

class SceneCompilerV2 {
  /**
   * 编译带 Entity Contract 的 SceneGraph v2
   *
   * 核心变换：
   *   planner_outline + world_state + entity_registry
   *     → EntityContract
   *     → ContractedSceneGraph
   *
   * EntityContract 的生成逻辑：
   * 1. required = 大纲中明确引用的角色 + 当前 plot arc 活跃角色 + 最近的 3 章出现过的角色
   * 2. optional = 1-hop 关系连接的角色（现任/随从/对手）
   * 3. latent = 当前不在场景中但剧情依赖其状态的角色
   * 4. forbidden = 已死/已分离/已遗失的角色或状态
   */
  async compileWithEntityContract(input: CompilerInput): Promise<ContractedSceneGraph> {
    const { projectId, chapterNo, sceneNo, outline, prevChapterDelta } = input

    // 1. 从 WorldState 获取全部角色状态
    const allEntities = await getAllEntities(projectId)
    const allCharNames = allEntities.character.map(e => e.name)

    // 2. 解析大纲 - 尝试提取明确的角色名
    const outlineMentions = allCharNames.filter(n => outline.includes(n))

    // 3. 获取最近的章节可知谁最近活跃
    const recentChapters = await prisma.hdzChapter.findMany({
      where: { projectId, chapterNo: { gte: Math.max(1, chapterNo - 3), lt: chapterNo } },
      orderBy: { chapterNo: 'desc' },
      select: { chapterNo: true, content: true },
      take: 3,
    })

    // 从最近的 3 章中统计活跃角色
    const recentActiveChars = new Map<string, number>()
    for (const rc of recentChapters) {
      if (!rc.content) continue
      for (const name of allCharNames) {
        const escaped = name.replace(/[.*+?^${}()|[\]]/g, '\\$&')
        const regex = new RegExp(escaped, 'g')
        const match = rc.content.match(regex)
        if (match) {
          recentActiveChars.set(name, (recentActiveChars.get(name) || 0) + match.length)
        }
      }
    }

    // 4. 获取所有 forbidden 状态
    const entityIds = allEntities.character.map(e => e.id)
    let worldState: Map<string, any>
    try {
      worldState = await getWorldState(projectId, entityIds)
    } catch {
      worldState = new Map()
    }

    const forbiddenEntityIds: string[] = []
    for (const [eid, state] of worldState) {
      if (state?.statusFlags?.isAlive === false) {
        forbiddenEntityIds.push(eid)
      }
    }
    const forbiddenNames = allEntities.character
      .filter(e => forbiddenEntityIds.includes(e.id))
      .map(e => e.name)

    // 5. 构建 EntityContract
    // required = 大纲提及 + 最近活跃的角色
    const requiredSet = new Set<string>()

    // 大纲提及的直接加入
    for (const name of outlineMentions) {
      if (!forbiddenNames.includes(name)) requiredSet.add(name)
    }

    // 最近 3 章最活跃的 3 个角色（不在 forbidden 中）
    const sortedRecent = [...recentActiveChars.entries()]
      .sort((a, b) => b[1] - a[1])
      .filter(([name]) => !forbiddenNames.includes(name) && !requiredSet.has(name))

    for (const [name] of sortedRecent.slice(0, 3)) {
      requiredSet.add(name)
    }

    // 如果 required 为空，至少放 2 个非 forbidden 角色
    if (requiredSet.size === 0) {
      const safeChars = allCharNames.filter(n => !forbiddenNames.includes(n)).slice(0, 3)
      for (const n of safeChars) requiredSet.add(n)
    }

    const required = [...requiredSet]
    const remaining = allCharNames.filter(n => !requiredSet.has(n) && !forbiddenNames.includes(n))

    // optional = remaining 中最近出现过 + 随机扩展
    const optional = remaining
      .filter(n => recentActiveChars.has(n))
      .slice(0, Math.max(2, Math.floor(required.length * 1.5)))

    // latent = 当前不在场景但剧情相关的
    const latent = remaining.filter(n => !optional.includes(n)).slice(0, Math.max(3, required.length))

    const contract: EntityContract = {
      required,
      optional,
      latent,
      forbidden: forbiddenNames,
      minimumMentions: 1,
      rationale: `基于大纲提及(${outlineMentions.length})+近3章活跃度(${sortedRecent.length})生成`,
    }

    // 6. 继续原 compile 逻辑，但注入 contract
    // 先注册 contract 中的实体
    const contractEntityIds: string[] = []
    const { resolveName } = await import('./entity-registry.service.js')

    for (const name of [...required, ...optional, ...latent].filter(n => !forbiddenNames.includes(n))) {
      try {
        const id = await resolveName(projectId, name, 'character')
        if (!contractEntityIds.includes(id)) contractEntityIds.push(id)
      } catch {
        // skip
      }
    }

    // 获取这些实体的世界状态
    const contractWorldState = await getWorldState(projectId, contractEntityIds)

    const stateView: Record<string, any> = {}
    for (const [entityId, state] of contractWorldState) {
      const entity = await getEntityById(entityId)
      stateView[entity?.name || entityId] = {
        entityId,
        name: entity?.name || entityId,
        health: state.health,
        location: state.location,
        inventory: state.inventory,
        relationships: state.relationships,
        statusFlags: state.statusFlags,
      }
    }

    // 约束包含 EntityContract 规则
    const constraints: SceneConstraint[] = [
      {
        type: 'consistency',
        description: 'required_entities 中的角色必须在本章正文中出现至少一次',
      },
      {
        type: 'consistency',
        description: 'forbidden_entities 中的角色/状态不得出现在本章正文中',
      },
      {
        type: 'entity_state',
        description: '已有角色的状态（生命/位置/持有物）在无明确剧情驱动时不可随意变更',
      },
      {
        type: 'timeline',
        description: `本章位于第 ${chapterNo} 章，前文已发生的事件不可逆转`,
      },
    ]

    const forbids = this.detectForbiddenChanges(contractWorldState, contractEntityIds)

    const sceneId = `ch${chapterNo}_s${sceneNo}`
    const dagJson: any = {
      involvedEntities: contractEntityIds,
      entityContract: { required, optional, latent, forbidden: forbiddenNames },
      constraints: constraints.map(c => ({ type: c.type, desc: c.description })),
      entityCount: contractEntityIds.length,
    }

    await prisma.sceneDag.upsert({
      where: { projectId_sceneId: { projectId, sceneId } },
      create: { projectId, chapterNo, sceneNo, sceneId, dagJson },
      update: { dagJson },
    })

    console.log(`[SceneCompilerV2] ch${chapterNo}_s${sceneNo}: contract={required:${required.length},optional:${optional.length},latent:${latent.length},forbidden:${forbiddenNames.length}}`)

    return {
      sceneId,
      chapterNo,
      sceneNo,
      projectId,
      involvedEntities: contractEntityIds,
      stateView,
      allowedChanges: ['health', 'location', 'inventory', 'statusFlags', 'relationships'],
      forbiddenChanges: forbids,
      constraints,
      sceneDirective: input.outline,
      entityContract: contract,
    }
  }

  /**
   * 计算归一化的 Contract Alignment Score
   * 用于验证 Writer 输出是否遵守 EntityContract
   */
  calculateContractScore(
    text: string,
    contract: EntityContract,
  ): number {
    let requiredHit = 0
    for (const name of contract.required) {
      const escaped = name.replace(/[.*+?^${}()|[\]]/g, '\\$&')
      if (new RegExp(escaped).test(text)) requiredHit++
    }

    let optionalHit = 0
    for (const name of contract.optional) {
      const escaped = name.replace(/[.*+?^${}()|[\]]/g, '\\$&')
      if (new RegExp(escaped).test(text)) optionalHit++
    }

    let forbiddenViolations = 0
    for (const name of contract.forbidden) {
      const escaped = name.replace(/[.*+?^${}()|[\]]/g, '\\$&')
      if (new RegExp(escaped).test(text)) forbiddenViolations++
    }

    const requiredRecall = contract.required.length > 0
      ? requiredHit / contract.required.length
      : 1

    const optionalCover = contract.optional.length > 0
      ? optionalHit / contract.optional.length
      : 1

    // forbidden 违规 = 扣分（每次违规 -0.2）
    const penalty = Math.min(forbiddenViolations * 0.2, 0.8)

    // score = 0.6 × required_recall + 0.3 × optional_coverage - penalty
    const raw = 0.6 * requiredRecall + 0.3 * optionalCover - penalty
    return Math.max(0, Math.min(1, Math.round(raw * 1000) / 1000))
  }


  /**
   * 检测固化的事实——Writer 绝对不能改的
   */
  private detectForbiddenChanges(
    worldState: Map<string, any>,
    entityIds: string[],
  ): string[] {
    const forbidden: string[] = []
    for (const eid of entityIds) {
      const state = worldState.get(eid)
      if (!state) continue
      if (state.statusFlags?.isAlive === false) {
        forbidden.push(`entity:${eid}:statusFlags.isAlive → 不得将已死角色复活`)
      }
    }
    return forbidden
  }

}

export const sceneCompiler = new SceneCompiler()
export const sceneCompilerV2 = new SceneCompilerV2()

// ─── 原 SceneCompiler 保持不变 (export above) ───
