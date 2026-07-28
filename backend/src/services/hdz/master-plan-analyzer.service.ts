/**
 * services/hdz/master-plan-analyzer.service.ts — Master Plan AI 分析层
 *
 * 职责：用户提交总纲后，调用大模型分析生成 Story Blueprint。
 *
 * 输入：小说总纲文本 + 已有角色 + 世界设定 + 历史版本
 * 输出：保存 Story Blueprint 到 HdzPlanRevision 表的 blueprint 字段
 *
 * BYOK：走 callLLM，不硬编码任何 Key
 */

import { prisma } from '../../utils/index.js'
import { callLLM, parseLLMJson, getUserLLMConfig } from './llm.client.js'
import type { LLMConfig } from './llm.client.js'

// ─── 类型定义 ───

/**
 * Story Blueprint JSON 结构
 */
export interface StoryBlueprint {
  mainTheme: string
  mainConflict: string
  worldRules: string[]
  characterArcs: BlueprintCharacterArc[]
  majorTurningPoints: BlueprintTurningPoint[]
  endingDirection: string
}

export interface BlueprintCharacterArc {
  name: string
  arcSummary: string
  keyStages: string[]
}

export interface BlueprintTurningPoint {
  chapter: number
  event: string
  significance: string
}

export interface AnalyzerInput {
  masterPlan: any
  characters: any[]
  worldSetting: any
  revisions: any[]
}

// ─── System Prompt ───

const BLUEPRINT_SYSTEM_PROMPT = `你是一位资深的小说故事结构分析师。请根据提供的小说总纲、角色设定、世界设定和修订历史，生成一份结构化的 Story Blueprint（故事蓝图）。

要求输出严格的 JSON 格式，不要包含 Markdown 代码块或其他文本。

请按以下结构输出：

{
  "mainTheme": "核心主题（50-100字，提炼故事的深层主题和情感内核）",
  "mainConflict": "主线冲突（100-200字，描述贯穿全书的核心矛盾和对抗关系）",
  "worldRules": [
    "世界规则1（如：修炼体系的核心法则）",
    "世界规则2（如：势力格局的平衡机制）",
    "世界规则3（如：天道/命运的约束）"
  ],
  "characterArcs": [
    {
      "name": "角色名",
      "arcSummary": "角色弧线概述（50-100字，描述该角色的成长轨迹和命运走向）",
      "keyStages": [
        "阶段1：初始状态和起点",
        "阶段2：重大转折和蜕变",
        "阶段3：最终命运和归宿"
      ]
    }
  ],
  "majorTurningPoints": [
    {
      "chapter": 章节号（整数）,
      "event": "转折事件描述（50-100字）",
      "significance": "转折意义（30-50字，说明对故事走向的影响）"
    }
  ],
  "endingDirection": "结局方向（100-200字，描述故事的最终走向和结局类型，如悲剧/开放式/圆满等）"
}

注意事项：
1. mainTheme 要深刻，超越表面情节，触及情感和哲学层面
2. mainConflict 要具体，包含对立双方的核心诉求和不可调和的矛盾
3. worldRules 要体现世界运行的底层逻辑，3-5条为宜
4. characterArcs 需覆盖主要角色（主角、重要配角、反派），每个角色有清晰的成长轨迹
5. majorTurningPoints 需标注具体章节号，5-8个关键转折点，每个都要推动故事质变
6. endingDirection 要与主题呼应，给出明确的结局类型和价值指向
7. 所有字段必须完整，不能为空
8. 分析要基于提供的总纲内容，不要凭空发挥`

// ─── 服务函数 ───

/**
 * 分析 Master Plan 并生成 Story Blueprint
 * @param projectId 项目 ID
 * @param userId 用户 ID
 * @param masterPlan Master Plan 对象
 */
export async function analyzeAndGenerateBlueprint(
  projectId: string,
  userId: string,
  masterPlan: any,
): Promise<StoryBlueprint> {
  const llmCfg = await getUserLLMConfig(userId)
  if (!llmCfg) throw new Error('请先配置大模型 API Key（LLM）')

  // 收集上下文数据
  const input = await collectAnalyzerInput(projectId, masterPlan)

  // 构建用户消息
  const userMessage = buildAnalyzerUserMessage(input)

  console.log(`[MasterPlanAnalyzer] 开始生成 Story Blueprint: project=${projectId}, user=${userId.substring(0, 8)}`)

  try {
    const raw = await callLLM(llmCfg, BLUEPRINT_SYSTEM_PROMPT, userMessage, {
      maxTokens: 16384,
      temperature: 0.7,
    })

    const blueprint = parseLLMJson(raw) as StoryBlueprint

    // 基础校验
    if (!blueprint.mainTheme || !blueprint.mainConflict) {
      throw new Error('LLM 返回的 Story Blueprint 结构不完整')
    }

    // 保存到数据库
    await saveBlueprintToRevision(projectId, blueprint)

    console.log(`[MasterPlanAnalyzer] ✅ Story Blueprint 生成完成: project=${projectId}`)
    return blueprint
  } catch (err: any) {
    console.error(`[MasterPlanAnalyzer] ❌ 生成失败: ${err.message}`)
    throw new Error(`Story Blueprint 生成失败: ${err.message}`)
  }
}

/**
 * 收集分析器输入数据
 */
async function collectAnalyzerInput(
  projectId: string,
  masterPlan: any,
): Promise<AnalyzerInput> {
  // 获取角色数据
  const characters = await prisma.hdzCharacter.findMany({
    where: { projectId },
    select: {
      id: true,
      name: true,
      role: true,
      properties: true,
      arc: true,
      relations: true,
    },
  })

  // 获取世界设定（从 Master Plan 中提取）
  const worldSetting = {
    background: masterPlan.worldSetting?.background || masterPlan.worldDirection || '',
    rules: masterPlan.worldSetting?.rules || masterPlan.forbiddenRules || [],
    factions: masterPlan.worldSetting?.factions || [],
  }

  // 获取历史版本
  const revisions = await prisma.hdzPlanRevision.findMany({
    where: { projectId },
    orderBy: { version: 'desc' },
    take: 5,
    select: {
      version: true,
      reason: true,
      diffSummary: true,
      createdAt: true,
    },
  })

  return {
    masterPlan,
    characters,
    worldSetting,
    revisions,
  }
}

/**
 * 构建分析器用户消息
 */
function buildAnalyzerUserMessage(input: AnalyzerInput): string {
  const parts: string[] = []

  // 1. Master Plan 总纲
  parts.push('【小说总纲（Master Plan）】')
  parts.push(JSON.stringify({
    title: input.masterPlan.title,
    genre: input.masterPlan.genre,
    theme: input.masterPlan.theme,
    totalChapter: input.masterPlan.totalChapter,
    volumeCount: input.masterPlan.volumeCount,
    targetWords: input.masterPlan.targetWords,
    worldSetting: input.masterPlan.worldSetting,
    mainConflict: input.masterPlan.mainConflict,
    threeActStructure: input.masterPlan.threeActStructure,
    volumes: input.masterPlan.volumes,
    characterArcs: input.masterPlan.characterArcs,
    foreshadowing: input.masterPlan.foreshadowing,
    endingPlan: input.masterPlan.endingPlan,
    forbiddenRules: input.masterPlan.forbiddenRules,
    worldDirection: input.masterPlan.worldDirection,
    endingDirection: input.masterPlan.endingDirection,
  }, null, 2))
  parts.push('')

  // 2. 角色设定
  parts.push('【角色设定】')
  if (input.characters.length > 0) {
    for (const char of input.characters) {
      const props = (char.properties as any) || {}
      parts.push(`- ${char.name}（${char.role}）`)
      if (props.appearance) parts.push(`  外貌：${props.appearance}`)
      if (props.personality) parts.push(`  性格：${props.personality}`)
      if (props.background) parts.push(`  背景：${props.background}`)
      if (props.motivation) parts.push(`  动机：${props.motivation}`)
      if (char.arc) parts.push(`  角色弧：${char.arc}`)
    }
  } else {
    parts.push('（暂无角色设定）')
  }
  parts.push('')

  // 3. 世界设定
  parts.push('【世界设定】')
  if (input.worldSetting.background) {
    parts.push(`背景：${input.worldSetting.background}`)
  }
  if (input.worldSetting.rules.length > 0) {
    parts.push(`规则：${input.worldSetting.rules.join('；')}`)
  }
  if (input.worldSetting.factions.length > 0) {
    parts.push(`势力：${input.worldSetting.factions.join('、')}`)
  }
  parts.push('')

  // 4. 历史版本
  if (input.revisions.length > 0) {
    parts.push('【历史版本】')
    for (const rev of input.revisions) {
      parts.push(`- v${rev.version}（${rev.createdAt?.toISOString?.()?.slice(0, 10) || '未知'}）：${rev.reason || rev.diffSummary || '无说明'}`)
    }
  }

  return parts.join('\n')
}

/**
 * 保存 Story Blueprint 到 HdzPlanRevision 表
 */
async function saveBlueprintToRevision(
  projectId: string,
  blueprint: StoryBlueprint,
): Promise<void> {
  // 获取最新版本号
  const lastRevision = await prisma.hdzPlanRevision.findFirst({
    where: { projectId },
    orderBy: { version: 'desc' },
  })
  const newVersion = (lastRevision?.version || 0) + 1

  // 创建新的修订记录，包含 blueprint
  await prisma.hdzPlanRevision.create({
    data: {
      projectId,
      version: newVersion,
      reason: 'AI 生成 Story Blueprint',
      planAfter: {} as any,
      blueprint: blueprint as any,
      diffSummary: `AI 分析生成 Story Blueprint：主题「${blueprint.mainTheme.slice(0, 30)}...」，包含 ${blueprint.characterArcs.length} 条角色弧线，${blueprint.majorTurningPoints.length} 个关键转折点`,
    },
  })

  console.log(`[MasterPlanAnalyzer] ✅ Story Blueprint 已保存到修订记录: project=${projectId}, version=${newVersion}`)
}

/**
 * 获取最新的 Story Blueprint
 * @param projectId 项目 ID
 */
export async function getLatestBlueprint(projectId: string): Promise<StoryBlueprint | null> {
  try {
    const revision = await prisma.hdzPlanRevision.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    })

    return (revision?.blueprint as unknown as StoryBlueprint) || null
  } catch (err: any) {
    console.error(`[MasterPlanAnalyzer] ❌ 获取 Story Blueprint 失败: ${err.message}`)
    return null
  }
}

/**
 * 获取最新的 Plan Revision（包含 blueprint）
 * @param projectId 项目 ID
 */
export async function getLatestRevision(projectId: string): Promise<any | null> {
  try {
    return await prisma.hdzPlanRevision.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    })
  } catch (err: any) {
    console.error(`[MasterPlanAnalyzer] ❌ 获取最新修订记录失败: ${err.message}`)
    return null
  }
}

/**
 * 格式化 Story Blueprint 为 LLM 可注入的文本
 * @param blueprint Story Blueprint 对象
 */
export function formatBlueprintForLLM(blueprint: StoryBlueprint | null): string {
  if (!blueprint) return ''

  const parts: string[] = []

  parts.push('【📘 Story Blueprint（故事蓝图 — AI 分析生成的结构化故事框架）】')
  parts.push('')

  if (blueprint.mainTheme) {
    parts.push(`**核心主题：**${blueprint.mainTheme}`)
    parts.push('')
  }

  if (blueprint.mainConflict) {
    parts.push(`**主线冲突：**${blueprint.mainConflict}`)
    parts.push('')
  }

  if (blueprint.worldRules.length > 0) {
    parts.push('**世界规则：**')
    blueprint.worldRules.forEach((rule, i) => {
      parts.push(`${i + 1}. ${rule}`)
    })
    parts.push('')
  }

  if (blueprint.characterArcs.length > 0) {
    parts.push('**角色弧线规划：**')
    for (const arc of blueprint.characterArcs) {
      parts.push(`- **${arc.name}**：${arc.arcSummary}`)
      if (arc.keyStages.length > 0) {
        arc.keyStages.forEach((stage, i) => {
          parts.push(`  ${i + 1}. ${stage}`)
        })
      }
    }
    parts.push('')
  }

  if (blueprint.majorTurningPoints.length > 0) {
    parts.push('**关键转折点：**')
    for (const tp of blueprint.majorTurningPoints) {
      parts.push(`- 第${tp.chapter}章：${tp.event}（${tp.significance}）`)
    }
    parts.push('')
  }

  if (blueprint.endingDirection) {
    parts.push(`**结局方向：**${blueprint.endingDirection}`)
  }

  return parts.join('\n')
}
