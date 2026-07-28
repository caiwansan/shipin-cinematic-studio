/**
 * services/hdz/master-plan.service.ts — 增强版 Master Plan 服务
 *
 * 职责：
 * - AI 生成总规划（三幕结构 + 卷规划 + 角色弧线 + 伏笔系统）
 * - 规划存储、更新、修订历史管理
 * - 章节规划查询（从卷规划中提取）
 *
 * BYOK：走 callLLM，不硬编码任何 Key
 */

import { prisma } from '../../utils/index.js'
import { callLLM, parseLLMJson, getUserLLMConfig } from './llm.client.js'
import type { LLMConfig } from './llm.client.js'
import { analyzeAndGenerateBlueprint } from './master-plan-analyzer.service.js'

// ─── 类型定义 ───

export interface MasterPlan {
  title: string
  genre: string
  theme: string
  totalChapter: number
  volumeCount: number
  targetWords: number
  worldSetting: {
    background: string
    rules: string[]
    factions: string[]
  }
  mainConflict: string
  threeActStructure: ActStructure[]
  volumes: VolumePlan[]
  characterArcs: CharacterArc[]
  foreshadowing: ForeshadowItem[]
  endingPlan: string
  forbiddenRules: string[]
  aiSummary: string
}

export interface ActStructure {
  act: number
  name: string
  chapterRange: string
  theme: string
  keyEvents: string[]
}

export interface VolumePlan {
  volume: number
  chapterRange: string
  theme: string
  mainConflict: string
  characterGrowth: string
  keyEvents: string[]
}

export interface CharacterArc {
  characterId: string
  name: string
  arc: string
  stages: ArcStage[]
}

export interface ArcStage {
  stage: string
  chapterRange: string
  description: string
}

export interface ForeshadowItem {
  chapter: number
  event: string
  payoff: string
}

export interface GenerateOptions {
  totalChapter?: number
  volumeCount?: number
  targetWords?: number
  genre?: string
  theme?: string
  styleDesc?: string
  maxTokens?: number
  temperature?: number
}

// ─── System Prompt ───

const MASTER_PLAN_SYSTEM_PROMPT = `你是一位资深的小说总策划专家，擅长构思长篇小说的整体架构。请根据用户提供的信息，生成一份完整的小说总规划（Master Plan）。

要求输出严格的 JSON 格式，不要包含 Markdown 代码块或其他文本。

请按以下结构输出：

{
  "title": "小说书名",
  "genre": "小说类型（如：玄幻、科幻、言情、悬疑等）",
  "theme": "核心主题（一句话概括）",
  "totalChapter": 总章节数（整数）,
  "volumeCount": 卷数（整数）,
  "targetWords": 目标总字数（整数）,
  "worldSetting": {
    "background": "世界观背景描述（200-500字）",
    "rules": ["世界规则1", "世界规则2", "..."],
    "factions": ["势力1", "势力2", "..."]
  },
  "mainConflict": "主线冲突描述（100-200字）",
  "threeActStructure": [
    {
      "act": 1,
      "name": "第一幕名称",
      "chapterRange": "起始章-结束章",
      "theme": "本幕主题",
      "keyEvents": ["关键事件1", "关键事件2"]
    },
    {
      "act": 2,
      "name": "第二幕名称",
      "chapterRange": "起始章-结束章",
      "theme": "本幕主题",
      "keyEvents": ["关键事件1", "关键事件2"]
    },
    {
      "act": 3,
      "name": "第三幕名称",
      "chapterRange": "起始章-结束章",
      "theme": "本幕主题",
      "keyEvents": ["关键事件1", "关键事件2"]
    }
  ],
  "volumes": [
    {
      "volume": 1,
      "chapterRange": "起始章-结束章",
      "theme": "本卷主题",
      "mainConflict": "本卷主要冲突",
      "characterGrowth": "本卷角色成长线",
      "keyEvents": ["卷内关键事件1", "卷内关键事件2"]
    }
  ],
  "characterArcs": [
    {
      "characterId": "角色ID（如无则为空字符串）",
      "name": "角色名",
      "arc": "角色弧线概述",
      "stages": [
        {
          "stage": "阶段名称",
          "chapterRange": "章节范围",
          "description": "阶段描述"
        }
      ]
    }
  ],
  "foreshadowing": [
    {
      "chapter": 章节号（整数）,
      "event": "伏笔事件描述",
      "payoff": "回收描述（含章节号）"
    }
  ],
  "endingPlan": "结局规划（100-200字）",
  "forbiddenRules": ["禁止规则1：如主角不能死", "禁止规则2：如不能违背已设定的世界观规则"],
  "aiSummary": "AI 生成说明（50-100字，描述本次规划的核心思路）"
}

注意事项：
1. 三幕结构：第一幕（铺垫，约20%章节），第二幕（对抗，约60%章节），第三幕（高潮+结局，约20%章节）
2. 卷规划需与三幕结构对齐，每卷有独立的主题和冲突
3. 角色弧线需体现成长变化，每个阶段对应具体章节范围
4. 伏笔系统需前后呼应，埋设章节和回收章节需明确标注
5. 禁止规则用于约束后续章节生成，确保不偏离设定
6. 所有字段必须完整，不能为空
7. 章节范围格式统一为 "起始章-结束章"，如 "1-200"
`

// ─── 服务函数 ───

/**
 * 生成 Master Plan（AI 驱动）
 * @param projectId 项目 ID
 * @param userInput 用户输入（书名、类型、主题等）
 * @param options 可选参数
 */
export async function generateMasterPlan(
  projectId: string,
  userInput: string,
  options?: GenerateOptions,
): Promise<MasterPlan> {
  const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
  if (!project) throw new Error('项目不存在')

  const userId = project.userId
  const llmCfg = await getUserLLMConfig(userId)
  if (!llmCfg) throw new Error('请先配置大模型 API Key（LLM）')

  // 构建用户消息
  const userLines: string[] = []
  userLines.push(`【项目信息】`)
  userLines.push(`书名：${project.title}`)
  if (options?.genre || project.genre) userLines.push(`类型：${options?.genre || project.genre}`)
  if (options?.theme) userLines.push(`主题：${options?.theme}`)
  if (options?.totalChapter) userLines.push(`目标章节数：${options.totalChapter}`)
  if (options?.volumeCount) userLines.push(`卷数：${options.volumeCount}`)
  if (options?.targetWords || project.wordTarget) userLines.push(`目标字数：${options?.targetWords || project.wordTarget || 3000000}`)
  if (options?.styleDesc || project.styleDesc) userLines.push(`风格要求：${options?.styleDesc || project.styleDesc}`)
  userLines.push('')
  userLines.push(`【用户需求】`)
  userLines.push(userInput)

  const userMessage = userLines.join('\n')

  console.log(`[MasterPlan] 开始生成 Master Plan: project=${projectId}, user=${userId.substring(0, 8)}`)

  try {
    const raw = await callLLM(llmCfg, MASTER_PLAN_SYSTEM_PROMPT, userMessage, {
      maxTokens: options?.maxTokens || 32768,
      temperature: options?.temperature ?? 0.8,
    })

    const plan = parseLLMJson(raw) as MasterPlan

    // 基础校验
    if (!plan.title || !plan.threeActStructure?.length) {
      throw new Error('LLM 返回的 Master Plan 结构不完整')
    }

    // 存储到数据库
    await prisma.hdzProject.update({
      where: { id: projectId },
      data: { masterPlan: plan as any },
    })

    // 记录修订历史
    await prisma.hdzPlanRevision.create({
      data: {
        projectId,
        version: 1,
        reason: '初始生成',
        planAfter: plan as any,
        diffSummary: 'AI 生成初始 Master Plan',
      },
    })

    console.log(`[MasterPlan] ✅ Master Plan 生成完成: project=${projectId}`)
    
    // ★ 自动生成 Story Blueprint（异步，不阻塞主流程）
    try {
      await analyzeAndGenerateBlueprint(projectId, userId, plan)
      console.log(`[MasterPlan] ✅ Story Blueprint 已自动生成`)
    } catch (blueprintErr: any) {
      // Blueprint 生成失败不影响主 Plan 的返回
      console.warn(`[MasterPlan] ⚠️ Story Blueprint 生成失败（不影响主 Plan）: ${blueprintErr.message}`)
    }
    
    return plan
  } catch (err: any) {
    console.error(`[MasterPlan] ❌ 生成失败: ${err.message}`)
    throw new Error(`Master Plan 生成失败: ${err.message}`)
  }
}

/**
 * 获取当前 Master Plan
 * @param projectId 项目 ID
 */
export async function getMasterPlan(projectId: string): Promise<MasterPlan | null> {
  try {
    const project = await prisma.hdzProject.findUnique({
      where: { id: projectId },
      select: { masterPlan: true },
    })
    return (project?.masterPlan as MasterPlan) || null
  } catch (err: any) {
    console.error(`[MasterPlan] ❌ 获取失败: ${err.message}`)
    throw new Error(`获取 Master Plan 失败: ${err.message}`)
  }
}

/**
 * 更新 Master Plan 并记录修订历史
 * @param projectId 项目 ID
 * @param plan 新的规划内容
 * @param reason 修订原因
 */
export async function updateMasterPlan(
  projectId: string,
  plan: MasterPlan,
  reason: string,
): Promise<void> {
  try {
    // 获取当前版本号
    const lastRevision = await prisma.hdzPlanRevision.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    })
    const newVersion = (lastRevision?.version || 0) + 1

    // 获取当前 plan 作为 before
    const current = await prisma.hdzProject.findUnique({
      where: { id: projectId },
      select: { masterPlan: true },
    })

    // 事务：更新 plan + 记录修订
    await prisma.$transaction([
      prisma.hdzProject.update({
        where: { id: projectId },
        data: { masterPlan: plan as any },
      }),
      prisma.hdzPlanRevision.create({
        data: {
          projectId,
          version: newVersion,
          reason,
          planBefore: (current?.masterPlan as any) || null,
          planAfter: plan as any,
          diffSummary: reason,
        },
      }),
    ])

    console.log(`[MasterPlan] ✅ 更新完成: project=${projectId}, version=${newVersion}`)
  } catch (err: any) {
    console.error(`[MasterPlan] ❌ 更新失败: ${err.message}`)
    throw new Error(`更新 Master Plan 失败: ${err.message}`)
  }
}

/**
 * 获取修订历史
 * @param projectId 项目 ID
 */
export async function getRevisions(projectId: string): Promise<any[]> {
  try {
    return await prisma.hdzPlanRevision.findMany({
      where: { projectId },
      orderBy: { version: 'desc' },
    })
  } catch (err: any) {
    console.error(`[MasterPlan] ❌ 获取修订历史失败: ${err.message}`)
    throw new Error(`获取修订历史失败: ${err.message}`)
  }
}

/**
 * 根据章节号获取所属卷规划
 * @param masterPlan Master Plan 对象
 * @param chapterNo 章节号
 */
export function getVolumeForChapter(masterPlan: MasterPlan | null, chapterNo: number): VolumePlan | null {
  if (!masterPlan?.volumes?.length) return null

  for (const vol of masterPlan.volumes) {
    const range = parseChapterRange(vol.chapterRange)
    if (range && chapterNo >= range.start && chapterNo <= range.end) {
      return vol
    }
  }
  return null
}

/**
 * 获取章节规划（从卷规划中提取）
 * @param masterPlan Master Plan 对象
 * @param chapterNo 章节号
 */
export function getChapterPlan(masterPlan: MasterPlan | null, chapterNo: number): {
  volume: VolumePlan | null
  act: ActStructure | null
  foreshadowing: ForeshadowItem[]
  characterArcs: CharacterArc[]
} {
  if (!masterPlan) {
    return { volume: null, act: null, foreshadowing: [], characterArcs: [] }
  }

  const volume = getVolumeForChapter(masterPlan, chapterNo)

  // 查找所属幕
  let act: ActStructure | null = null
  for (const a of masterPlan.threeActStructure || []) {
    const range = parseChapterRange(a.chapterRange)
    if (range && chapterNo >= range.start && chapterNo <= range.end) {
      act = a
      break
    }
  }

  // 查找相关伏笔（当前章节埋设或回收的伏笔）
  const foreshadowing = (masterPlan.foreshadowing || []).filter(
    f => f.chapter === chapterNo || f.payoff.includes(`第${chapterNo}章`),
  )

  // 查找角色弧线中当前章节相关的阶段
  const characterArcs = (masterPlan.characterArcs || []).filter(arc =>
    arc.stages.some(stage => {
      const range = parseChapterRange(stage.chapterRange)
      return range && chapterNo >= range.start && chapterNo <= range.end
    }),
  )

  return { volume, act, foreshadowing, characterArcs }
}

// ─── 辅助函数 ───

/**
 * 解析章节范围字符串 "1-200" → { start: 1, end: 200 }
 */
function parseChapterRange(rangeStr: string): { start: number; end: number } | null {
  if (!rangeStr) return null
  const match = rangeStr.match(/^(\d+)\s*[-–—]\s*(\d+)$/)
  if (!match) return null
  return { start: parseInt(match[1], 10), end: parseInt(match[2], 10) }
}
