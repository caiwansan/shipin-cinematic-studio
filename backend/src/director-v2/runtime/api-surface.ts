/**
import { normalizeScene, normalizeExecutionPlan, normalizeProjection } from '''../../contracts/bridge/director-v2.bridge.js''';
 * api-surface.ts — Phase 6A: API Surface Minimization
 *
 * Director OS 的最小生产 API surface。
 *
 * 契约：
 *   1. 外部世界只能看到这 4 个入口
 *   2. 所有 runtime 模块标记为 internal，禁止 import ×
 *   3. index.ts 只 export 这 4 个入口
 *   4. generate / preview / refine / status 是唯一受控通道
 */

import type { StoryConstitution } from '../schema/story-constitution.js'
import type { SafeIntentHint } from './director-projection.js'

// ============================================================
// Exported Types (最小必要类型集)
// ============================================================

// --- generate ---

export interface GenerateInput {
  /** 剧本文本 */
  script: string
  /** 可选的导演意图提示 — 不构成 constitution 字段，仅影响 intent 初始化 */
  intentHint?: string
  /** 项目 ID */
  projectId: string
  /** 总集数（如果是连续剧） */
  totalEpisodes?: number
}

export interface GenerateOutput {
  /** 项目 ID */
  projectId: string
  /** 会话 ID（用于后续 preview / refine / status） */
  sessionId: string
  /** 三幕场景预览 */
  scenes: SceneSummary[]
  /** 情感弧线 */
  emotionalArc: string
  /** 核心主题 */
  theme: string
  /** 生产就绪状态 */
  productionStatus: ProductionStatus
  /** AI 提取的角色列表 */
  characters?: CharacterSummary[]
}

export interface CharacterSummary {
  characterId: string
  name: string
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor' | 'extra'
  description?: string
  visualSignature?: string
  /** AI 生成的肖像提示词，前端角色卡直接使用 */
  imagePrompt?: string
}

export type ProductionStatus = 'READY' | 'CAUTION' | 'NOT_READY'

export interface SceneSummary {
  act: number
  title: string
  emotion: string
  tension: number
  description?: string
  /** AI 生成的场景提示词（含氛围），前端场景卡使用 */
  sceneImagePrompt?: string
  sceneNegativePrompt?: string
}

// --- preview ---

export interface PreviewInput {
  sessionId: string
  /** 可选焦点：scene | shot | intent */
  focus?: 'scene' | 'shot' | 'intent'
}

export interface PreviewOutput {
  sessionId: string
  scenes: SceneSummary[]
  shots?: ShotSummary[]
  intent?: IntentSummary
  /** 最后一次更新的时间戳 */
  lastUpdated: number
}

export interface ShotSummary {
  sceneIndex: number
  shotType: string
  visualPrimary: string
  tension: number
}

export interface IntentSummary {
  narrativePurpose: string
  emotionalArc: string
  thematicFocus: string
  coherenceLevel: string
}

// --- refine ---

export interface RefineInput {
  sessionId: string
  hint: SafeIntentHint
}

export interface RefineOutput {
  sessionId: string
  accepted: boolean
  updatedScenes?: SceneSummary[]
  message: string
}

// --- status ---

export interface StatusOutput {
  sessionId: string
  /** 生产就绪分数 0-1 */
  readinessScore: number
  /** 生产就绪状态 */
  readinessStatus: ProductionStatus
  /** 阻挡上线的因素 */
  blockers: string[]
  /** 当前发布阶段 */
  rolloutStage: string
  /** 系统演化指标（diagnostics 集成） */
  evolution: {
    driftDetected: boolean
    driftScore: number
    avgConstraintShift: number
    assessment: string
    maxRangeExpansion: { key: string; ratio: number } | null
    maxCenterShift: { key: string; shift: number } | null
    relaxationCount: number
    totalOscillations: number
    /** 漂移语义解释 */
    driftSemantic: {
      class: string
      confidence: number
      label: string
      description: string
      keySignals: string[]
    }
  }
}

// ============================================================
// Error Types
// ============================================================

export enum ApiErrorCode {
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  INVALID_INPUT = 'INVALID_INPUT',
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  GENERATION_FAILED = 'GENERATION_FAILED',
  HINT_REJECTED = 'HINT_REJECTED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class DirectorApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public detail?: string,
  ) {
    super(`[${code}] ${message}`)
    this.name = 'DirectorApiError'
  }
}

// ============================================================
// Internal — 标记为 internal 的依赖
//
// 以下模块不允许 index.ts 导出。
// 任何需要从外部访问这些模块的代码必须走 API Gateway。
// ============================================================

// 🚫 不 export 的 internal 模块清单：
//   - runtime/constitution-compiler.ts
//   - runtime/director-projection.ts
//   - runtime/cinematic-intent.ts
//   - runtime/drift-intervention.ts
//   - runtime/drift-memory.ts
//   - runtime/drift-scorer.ts
//   - runtime/semantic-energy.ts
//   - runtime/cache-governor.ts
//   - runtime/constitution-cache.ts
//   - runtime/constitution-merge.ts
//   - runtime/skeleton-compiler.ts
//   - runtime/production-gatekeeper.ts
//   - runtime/shadow-ui-router.ts
//   - runtime/e2e-reality-harness.ts
//   - norm/ 下所有模块
//   - memory/ 下所有模块
//   - telemetry/ 下所有模块
//   - schema/ 下的类型定义（不导出，由 API surface 自行映射）

// ============================================================
// API Gateway 实现（简化版 — 用于验证契约）
// ============================================================

import { constitutionCompiler } from '../constitution-compiler.js'
import { shadowUIRouter } from './shadow-ui-router.js'
import { productionGatekeeper } from './production-gatekeeper.js'
import { directorProjection } from './director-projection.js'
import { cinematicIntent } from './cinematic-intent.js'
import { semanticEnergy } from './semantic-energy.js'
import { analyzeScript } from '../../director/director-brain.agent.js'
import { generateAtmosphereDesign } from '../../director/scene-atmosphere.agent.js'
import { generatePortraitPrompt } from '../../agents/portrait-prompt.agent.js'
import { generateSceneImagePrompts } from '../../agents/scene-image-prompt.agent.js'
import { narrativeGateway } from '../../runtime/narrative-gateway.js'
import { prisma } from '../../utils/index.js'
import { CoupledFieldPredictor, IntentAnchor, DEFAULT_ANCHOR_CONFIG, diffSnapshots, interpretDrift, DriftTransitionRecorder } from '../diagnostics/director-field.js'

class DirectorApiGateway {
  private sessions: Map<string, { projectId: string; constitution: StoryConstitution }> = new Map()
  /** 存储最近一次 generate 的场景数据，供 preview 使用 */
  private lastGeneratedScenes: Map<string, SceneSummary[]> = new Map()

  // Diagnostics singleton — 不参与控制流，只做 observability
  private predictor: CoupledFieldPredictor
  private anchor: IntentAnchor
  private lastSnapshot: ReturnType<IntentAnchor['snapshot']> | null = null
  // Drift transition recorder — diagnostics layer 的有状态记录器
  private transitionRecorder: DriftTransitionRecorder

  constructor() {
    this.predictor = new CoupledFieldPredictor()
    this.anchor = new IntentAnchor(DEFAULT_ANCHOR_CONFIG)
    this.transitionRecorder = new DriftTransitionRecorder(50)
  }

  /**
   * generate — 剧本生成入口 → Gateway orchestrates internal runtime
   *
   * 入口逻辑：
   *   1. 调 constitutionCompiler.compile()（internal）
   *   2. 创建 shadow session（internal）
   *   3. 构建 GenerateOutput（API surface 类型）
   *   4. 执行 diagnostics snapshot（不阻塞，只记录）
   *   5. 返回（不暴露任何 runtime 内部状态）
   */
  async generate(input: GenerateInput): Promise<GenerateOutput> {
    if (!input.script || !input.projectId) {
      throw new DirectorApiError(ApiErrorCode.INVALID_INPUT, 'script and projectId are required')
    }

    try {
      // Step 1: 编译 constitution（internal — 调用 constitution-compiler）
      const compileResult = await constitutionCompiler.compile({
        script: input.script,
        projectId: input.projectId,
      })

      const constitution = compileResult.final ?? compileResult.constitution
      if (!constitution) {
        throw new DirectorApiError(ApiErrorCode.GENERATION_FAILED, 'constitution compilation returned empty')
      }

      // Step 2: 提取 intent
      const intent = cinematicIntent.buildFromConstitution(input.projectId, constitution)

      // Step 3: 创建 shadow session
      shadowUIRouter.createSession(input.projectId, constitution, intent)

      // Step 4: 统筹 Agent — 剧情总指挥先拆分剧本的六个维度
      // 所有场景/角色数据由统筹产出，分发给后续专业 agent
      let plotBlueprint: any = {}
      let supervisorRoleList: any[] = []
      let supervisorSceneList: any[] = []
      let supervisorSegmentList: any[] = []
      let supervisorPropList: any[] = []
      let supervisorVoiceList: any[] = []
      let supervisorVideoDirs: any[] = []

      try {
        // ⭐ 从 DB PromptTemplate 读取剧情总指挥 prompt（禁止硬编码文本文件）
        const supervisorTemplate = await prisma.promptTemplate.findUnique({
          where: { name: 'plot-supervisor' },
        })
        if (!supervisorTemplate?.content || typeof supervisorTemplate.content !== 'object' || !('prompt' in (supervisorTemplate.content as any))) {
          throw new Error('[DirectorV2] PromptTemplate.plot-supervisor 在数据库中不存在')
        }
        const supervisorPrompt = (supervisorTemplate.content as any).prompt as string
        const supervisorResult = await narrativeGateway.execute({
          systemPrompt: supervisorPrompt,
          userMessage: `【剧本名称】\n${input.projectId}\n\n【剧本全文】\n${input.script.slice(0, 4000)}`,
          userId: 'director-v2-supervisor',
          timeoutTier: 'batch',
          maxTokens: 8192,
        })
        const supervisorRaw = supervisorResult.content.trim()
        console.log(`[director-v2] 统筹原始前300: ${supervisorRaw.slice(0, 300)}`)
        console.log(`[director-v2] 统筹原始后200: ${supervisorRaw.slice(-200)}`)
        console.log(`[director-v2] 统筹原始长度: ${supervisorRaw.length}`)
        // 提取 JSON：先尝试 ```json 包裹，否则直接 parse（兼容无代码块情况）
        let jsonText = supervisorRaw
        const codeBlockMatch = supervisorRaw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
        if (codeBlockMatch) {
          jsonText = codeBlockMatch[1].trim()
          console.log(`[director-v2] 统筹codeBlockMatch长度: ${jsonText.length}`)
        }
        // 尝试找到第一个 { 和最后一个 } 之间的内容（最外层）
        const firstBrace = jsonText.indexOf('{')
        const lastBrace = jsonText.lastIndexOf('}')
        console.log(`[director-v2] 统筹firstBrace=${firstBrace} lastBrace=${lastBrace}`)
        if (firstBrace >= 0 && lastBrace > firstBrace) {
          jsonText = jsonText.slice(firstBrace, lastBrace + 1)
          console.log(`[director-v2] 统筹JSON前100: ${jsonText.slice(0, 100)}`)
        }
        const parsed = JSON.parse(jsonText)
        const bp = parsed.plotBlueprint || parsed

        plotBlueprint = bp.plotBlueprint || bp
        supervisorRoleList = bp['人物角色设计'] || bp.roleList || bp.人物角色设计 || []
        supervisorSceneList = bp['剧中场景图设计'] || bp.sceneList || bp.剧中场景图设计 || []
        supervisorSegmentList = bp['剧情分镜图分析'] || bp.segmentList || bp.剧情分镜图分析 || []
        supervisorPropList = bp['剧情道具分析'] || bp.propList || bp.剧情道具分析 || []
        supervisorVoiceList = bp['剧情音效设计'] || bp['角色音色分析'] || bp.voiceConfig || bp.剧情音效设计 || []
        supervisorVideoDirs = bp['剧情人物动作设计'] || bp.videoDirection || []

        // 额外的完整数据保存，供 preview/refine 使用
        const costumeList = bp['剧中人物服装设计'] || bp.costumeList || []
        const dialogList = bp['剧情人物台词'] || bp.dialogList || []
        const actionList = bp['剧情人物动作设计'] || bp.actionList || []
        const effectList = bp['剧情特效设计'] || bp.effectList || []

        console.log(`[director-v2] 统筹分析: ${supervisorRoleList.length}角色, ${supervisorSceneList.length}场景, ${supervisorSegmentList.length}分镜, ${supervisorPropList.length}道具, ${costumeList.length}服装, ${dialogList.length}台词, ${actionList.length}动作, ${effectList.length}特效`)
        // 调试：打印统筹返回的原始场景数据字段名
        if (supervisorSceneList.length > 0) {
          const firstScene = supervisorSceneList[0]
          console.log(`[director-v2] 统筹场景样例字段: ${Object.keys(firstScene).join(', ')}`)
          console.log(`[director-v2] 统筹场景样例: ${JSON.stringify(firstScene).slice(0, 300)}`)
        }
        if (supervisorRoleList.length > 0) {
          const firstRole = supervisorRoleList[0]
          console.log(`[director-v2] 统筹角色样例字段: ${Object.keys(firstRole).join(', ')}`)
          console.log(`[director-v2] 统筹角色样例: ${JSON.stringify(firstRole).slice(0, 300)}`)
        }
      } catch (err) {
        console.warn(`[director-v2] 统筹失败，回退 constitution 数据: ${err instanceof Error ? err.message : String(err)}`)
      }

      // Step 5: 从统筹数据构建场景列表（统筹优先，AI 自动扩展行数）
      const useSupervisorScenes = supervisorSceneList.length > 0
      const sceneCount = useSupervisorScenes
        ? supervisorSceneList.length
        : Math.max(3, (constitution as any).characterLaws?.length || 3)

      const scenes: SceneSummary[] = Array.from({ length: sceneCount }, (_, i) => {
        const ss = useSupervisorScenes ? supervisorSceneList[i] : null
        return {
          act: Math.min(3, Math.floor(i / Math.max(1, Math.ceil(sceneCount / 3))) + 1),
          title: ss?.sceneName || ss?.场景名称 || (constitution as any).keyScenes?.[i]?.name || `场景 ${i + 1}`,
          emotion: ss?.mood || ss?.情绪基调 || 'neutral',
          tension: 0.5,
          description: ss?.description || ss?.场景外观描述 || ss?.剧情概括 || '',
        }
      })

      // Step 6: 从统筹数据构建角色列表（AI 自动扩展行数）
      let characters: CharacterSummary[] = []
      if (supervisorRoleList.length > 0) {
        characters = supervisorRoleList.map((rl: any, i: number) => {
          const appearance = rl.appearance || rl.外貌特征 || ''
          const personalityArr = rl.personality || rl.性格标签 || []
          const background = rl.background || rl.角色背景 || ''
          const relationshipsArr = rl.relationships || rl.人物关系 || []
          const descParts = [
            appearance ? `外貌: ${appearance}` : '',
            personalityArr.length ? `性格: ${Array.isArray(personalityArr) ? personalityArr.join('、') : personalityArr}` : '',
            background ? `背景: ${Array.isArray(background) ? background.join('、') : background}` : '',
            relationshipsArr.length ? `关系: ${Array.isArray(relationshipsArr) ? relationshipsArr.join('、') : relationshipsArr}` : '',
          ].filter(Boolean)
          return {
            characterId: rl.characterId || `char_${i + 1}`,
            name: rl.name || rl.名称 || rl.角色名 || `角色${i + 1}`,
            role: (rl.role || rl.角色身份 || '') === '主角' ? 'protagonist' : (rl.role || rl.角色身份) === '反派' ? 'antagonist' : 'supporting',
            description: descParts.join(' · ') || `身份: ${rl.role || rl.角色身份 || '未知'}`,
            visualSignature: '',
            imagePrompt: '',
          }
        })
      } else {
        const characterLaws = (constitution as any).characterLaws
        characters = Array.isArray(characterLaws)
          ? characterLaws.map((cl: any) => ({
              characterId: cl.characterId || `char_${Math.random().toString(36).slice(2, 6)}`,
              name: cl.name || '未知角色',
              role: cl.role || 'supporting',
              description: `身份: ${cl.role === 'protagonist' ? '主角' : cl.role === 'antagonist' ? '反派' : cl.role === 'supporting' ? '配角' : '其他'}`,
              visualSignature: cl.visualLock?.visualSignature || '',
              imagePrompt: '',
            }))
          : []
      }

      // Step 7: 为每个角色生成 AI portrait-prompt
      if (characters.length > 0) {
        await Promise.allSettled(characters.map(async (ch, i) => {
          const roleInfo = supervisorRoleList[i] || {}
          try {
            const result = await generatePortraitPrompt({
              characterId: ch.characterId,
              name: ch.name,
              role: ch.role,
              appearance: {
                appearance: roleInfo.appearance || roleInfo.外貌特征 || '',
                gender: roleInfo.gender || roleInfo.性别 || '',
                age: roleInfo.age || roleInfo.年龄 || '',
              },
              identityLock: {},
              personality: roleInfo.personality || roleInfo.性格标签 || [],
              plotContext: input.script.slice(0, 500),
            }, input.script)
            ch.imagePrompt = result.prompt
          } catch {
            // portrait-prompt 失败 — 前端用 defaultForm 兜底
          }
        }))
      }

      // Step 8: 场景 AI prompt — 调 scene-image-prompt agent 为每场戏生成优化后的英文文生图提示词
      try {
        const sceneImageInputs = scenes.map((s, i) => {
          const ss = useSupervisorScenes ? supervisorSceneList[i] : null
          return {
            sceneId: `scene_${i + 1}`,
            sceneName: s.title,
            timeOfDay: (ss as any)?.timeOfDay || 'noon',
            weather: (ss as any)?.weather || 'indoor',
            temperature: 'warm',
            colorPalette: ['#FFFFFF', '#CCCCCC', '#000000'],
            lightingDescription: s.description || '',
            spaceTexture: '',
            keyProps: (ss as any)?.keyProps || [],
            mood: s.emotion || 'neutral',
            atmosphereVisualKeywords: [],
          }
        })

        const scenePrompts = await generateSceneImagePrompts({
          script: input.script,
          atmosphereScenes: sceneImageInputs,
        })

        scenePrompts.forEach((sp, i) => {
          if (sp.scenePrompt && scenes[i]) {
            ;(scenes[i] as any).sceneImagePrompt = sp.scenePrompt
            ;(scenes[i] as any).sceneNegativePrompt = sp.negativePrompt
          }
        })
      } catch {
        // scene-image-prompt agent 失败不影响主流程
      }

      // 缓存本次 scenes 供 preview 恢复 description
      const sessionId = input.projectId
      this.sessions.set(sessionId, { projectId: input.projectId, constitution })
      this.lastGeneratedScenes.set(sessionId, scenes)

      // Diagnostics snapshot hook
      this.recordDiagnostics(sessionId, constitution)

      return {
        projectId: input.projectId,
        sessionId,
        scenes,
        characters,
        emotionalArc: supervisorSegmentList.map((s: any) => `${s.title}:${s.emotion || 'neutral'}`).join(' → ') || 'neutral',
        theme: String(plotBlueprint.theme || constitution.coreTheme || input.script.slice(0, 60)),
        productionStatus: 'NOT_READY',
      }
    } catch (err) {
      if (err instanceof DirectorApiError) throw err
      throw new DirectorApiError(
        ApiErrorCode.GENERATION_FAILED,
        'Generation failed unexpectedly',
        err instanceof Error ? err.message : String(err),
      )
    }
  }

  /**
   * preview — 只读视图
   */
  async preview(input: PreviewInput): Promise<PreviewOutput> {
    const session = this.sessions.get(input.sessionId)
    if (!session) {
      throw new DirectorApiError(ApiErrorCode.SESSION_NOT_FOUND, `Session ${input.sessionId} not found`)
    }

    // 走 shadow router（确保 projection 层正确应用）
    const { response } = shadowUIRouter.handleRequest(session.projectId, 'preview')

    // 从 session 中存储的最后一组 scenes 获取 description（generate 时已存）
    const lastGeneratedScenes = this.lastGeneratedScenes.get(input.sessionId)

    const scenes: SceneSummary[] = response.projection.scenes.map((s, i) => ({
      act: this.actForIndex(i, response.projection.scenes.length),
      title: s.title,
      emotion: s.emotion || 'neutral',
      tension: 0.5,
      description: lastGeneratedScenes?.[i]?.description || s.description || '',
    }))

    const result: PreviewOutput = {
      sessionId: input.sessionId,
      scenes,
      lastUpdated: Date.now(),
    }

    if (input.focus === 'shot' || !input.focus) {
      result.shots = response.projection.shots.map(s => ({
        sceneIndex: s.sceneIndex,
        shotType: s.shotType,
        visualPrimary: s.visualPrimary,
        tension: s.tension,
      }))
    }

    if (input.focus === 'intent' || !input.focus) {
      const intent = cinematicIntent.buildFromConstitution(session.projectId, session.constitution)
      result.intent = {
        narrativePurpose: intent.laws.narrativePurpose,
        emotionalArc: intent.laws.emotionalArc,
        thematicFocus: intent.laws.thematicFocus,
        coherenceLevel: response.status.coherenceLevel,
      }
    }

    return result
  }

  /**
   * refine — 安全写入口（只接受 SafeIntentHint）
   */
  async refine(input: RefineInput): Promise<RefineOutput> {
    const session = this.sessions.get(input.sessionId)
    if (!session) {
      throw new DirectorApiError(ApiErrorCode.SESSION_NOT_FOUND, `Session ${input.sessionId} not found`)
    }

    try {
      const processed = directorProjection.processIntentHint(
        session.constitution,
        input.hint,
      )
      const status = processed.status

      return {
        sessionId: input.sessionId,
        accepted: processed.modified,
        message: processed.modified ? '处理成功' : '未作修改',
        updatedScenes: [
          { act: 1, title: status.projectTitle, emotion: status.emotionalTone, tension: 'medium' },
        ],
      }
    } catch (err) {
      throw new DirectorApiError(
        ApiErrorCode.HINT_REJECTED,
        'Intent hint was rejected',
        err instanceof Error ? err.message : String(err),
      )
    }
  }

  /**
   * status — 系统演化读数接口
   *
   * 返回生产就绪状态 + 约束流形演变监控。
   * diagnostics 层与 runtime 层共享状态但不反向影响决策。
   */
  async status(sessionId: string): Promise<StatusOutput> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new DirectorApiError(ApiErrorCode.SESSION_NOT_FOUND, `Session ${sessionId} not found`)
    }

    const summary = shadowUIRouter.summarize(session.projectId)
    const result = productionGatekeeper.evaluate(summary)

    // 获取当前约束快照并计算 diff
    const currentSnapshot = this.anchor.snapshot()
    let diffResult = null
    if (this.lastSnapshot) {
      diffResult = diffSnapshots(this.lastSnapshot, currentSnapshot)
    } else {
      // 首次 status 调用，记录 baseline
      this.lastSnapshot = currentSnapshot
    }

    const driftScore = Math.min(1, Math.max(0, 
      (currentSnapshot.averageDriftRatio - 1) * 2 +
      currentSnapshot.totalOscillations * 0.05
    ))

    // 漂移语义解释
    const driftInput = {
      averageDriftRatio: currentSnapshot.averageDriftRatio,
      totalOscillations: currentSnapshot.totalOscillations,
      relaxationCounts: currentSnapshot.relaxationCounts,
      maxExpansionRatio: currentSnapshot.relaxationCounts 
        ? Object.values(currentSnapshot.relaxationCounts).reduce((a, b) => a + b, 0) * 0.05 + 1 
        : 1,
      globalDriftWarning: currentSnapshot.globalDriftWarning,
    }
    const interpretation = interpretDrift(driftInput)

    // 记录 drift transition（diagnostics 层写历史）
    this.transitionRecorder.record(interpretation.class)

    const evolution = {
      driftDetected: currentSnapshot.driftDetected,
      driftScore: Math.round(driftScore * 100) / 100,
      avgConstraintShift: Math.round((currentSnapshot.averageDriftRatio - 1) * 100) / 100,
      assessment: diffResult?.assessment ?? 'initial',
      maxRangeExpansion: diffResult?.maxRangeExpansion ?? null,
      maxCenterShift: diffResult?.maxCenterShift ?? null,
      relaxationCount: Object.values(currentSnapshot.relaxationCounts).reduce((a, b) => a + b, 0),
      totalOscillations: currentSnapshot.totalOscillations,
      driftSemantic: {
        class: interpretation.class,
        confidence: interpretation.confidence,
        label: interpretation.label,
        description: interpretation.description,
        keySignals: interpretation.keySignals,
      },
    }

    return {
      sessionId,
      readinessScore: result.score,
      readinessStatus: result.status,
      blockers: result.blockers.map(b => `[${b.severity}] ${b.signal}: ${b.detail}`),
      rolloutStage: result.rolloutStage,
      evolution,
    }
  }

  /**
   * 清理 session
   */
  destroySession(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  /**
   * Diagnostics snapshot hook — 不阻塞主路径，只记录场状态演变。
   *
   * 每次 generate() 后记录当前约束快照用于后续 diff。
   * 不参与控制流，不修改任何 runtime 数据。
   */
  private recordDiagnostics(sessionId: string, constitution: StoryConstitution): void {
    try {
      // 用 constitution 的某些特征更新场状态（非侵入式）
      const cohesionEnergy = 0.5 + (constitution.thematicFocus?.length ?? 0) * 0.05
      const tension = constitution.coreConflict?.length ?? 0.5

      // 轻量级场更新 — 只影响 diagnostics 内部状态
      this.predictor.adapt({
        totalEnergy: Math.min(2.0, cohesionEnergy + tension * 0.3),
        kineticEnergy: tension * 0.4,
        potentialEnergy: cohesionEnergy * 0.6,
        dissipation: 0.1 + Math.random() * 0.15,
        intentEntropy: 0.2 + Math.random() * 0.1,
        escapeBias: 0,
      })

      // 记录当前约束快照（用于后续 diff）
      this.lastSnapshot = this.anchor.snapshot()
    } catch {
      // diagnostics 异常不向上传播 — 不阻塞生成链路
    }
  }

  private actForIndex(index: number, total: number): number {
    if (total <= 3) return index + 1
    const perAct = Math.ceil(total / 3)
    return Math.min(3, Math.floor(index / perAct) + 1)
  }

  /**
   * 构建场景图提示词 — 利用 scene-atmosphere agent 的结构化数据
   */
  private buildSceneImagePrompt(scene: SceneSummary, atmosphere: any): string[] {
    const timeDescMap: Record<string, string> = {
      dawn: 'sunrise, early morning light, soft golden glow',
      morning: 'bright morning light, clear visibility',
      noon: 'harsh noon sunlight, strong shadows, high contrast',
      afternoon: 'soft afternoon light, warm golden hour approaching',
      dusk: 'golden sunset light, long shadows, warm orange tones',
      night: 'nighttime, moonlit, dark blue ambient light',
      late_night: 'deep night, very dark, minimal light, moonlight'
    }
    const weatherDescMap: Record<string, string> = {
      clear: 'clear sky, bright atmosphere',
      cloudy: 'overcast sky, soft diffused light',
      rainy: 'rainy atmosphere, wet surfaces, raindrops, moody sky',
      stormy: 'storm clouds, lightning, dramatic dark sky, intense atmosphere',
      foggy: 'dense fog, misty atmosphere, low visibility, ethereal',
      snowy: 'snowy landscape, white-covered ground, falling snowflakes',
      indoor: 'indoor environment, interior space'
    }

    const parts: string[] = [
      `${atmosphere.sceneName || scene.title} — scene view`,
      timeDescMap[atmosphere.timeOfDay as string] || atmosphere.timeOfDay,
      weatherDescMap[atmosphere.weather as string] || atmosphere.weather,
    ]

    if (atmosphere.lightingDescription) parts.push(atmosphere.lightingDescription)
    if (atmosphere.colorPalette?.length) parts.push(`color palette: ${atmosphere.colorPalette.join(', ')}`)
    if (atmosphere.spaceTexture) parts.push(atmosphere.spaceTexture)
    if (atmosphere.keyProps?.length) parts.push(`props include: ${atmosphere.keyProps.join(', ')}`)
    if (atmosphere.mood) parts.push(`mood: ${atmosphere.mood}`)
    if (atmosphere.atmosphereVisualKeywords?.length) parts.push(atmosphere.atmosphereVisualKeywords.join(', '))

    parts.push(
      '16:9 wide shot, empty scene, no people',
      'cinematic composition, architectural photography, photorealistic',
      'high detail, 8k, sharp focus, professional lighting'
    )

    return parts.filter(Boolean)
  }
}

/** 全局单例 — Director OS 的唯一外部入口 */
export const directorApi = new DirectorApiGateway()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "director-api",
  "mode": "OBSERVE"
};

