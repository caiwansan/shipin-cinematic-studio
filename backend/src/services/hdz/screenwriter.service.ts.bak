/**
 * services/hdz/screenwriter.service.ts — 编剧 Agent
 *
 * 将小说章节按标准拍摄剧本格式改编。
 * 输入：项目ID + 章节号列表
 * 输出：每章对应的剧本内容（场景编号、景别、动作描述、对白、镜头提示）
 *
 * BYOK 铁律：走用户自配的 LLM API Key
 */

import { prisma } from '../../utils/index.js'
import { getUserLLMConfig, callLLM } from './llm.client.js'
import { checkDailyQuota, incrementDailyUsage } from '../usage-quota.service.js'

/** 剧本一场戏的结构 */
export interface ScreenplayScene {
  sceneNo: number
  location: string        // 内/外景 - 地点 - 时间
  characters: string[]    // 出场角色
  camera: string          // 摄影指示：机位+镜头运动方式
  content: string         // 动作描述 + 对白（纯文本格式）
}

/** 单章剧本 */
export interface ChapterScreenplay {
  chapterNo: number
  chapterTitle: string
  scenes: ScreenplayScene[]
  raw: string             // LLM 原始输出
}

/** 编剧 Agent 的 System Prompt — 从 PromptTemplate 表读取 */
const PROMPT_NAME = 'hdz-screenwriter'

const DEFAULT_SYSTEM_PROMPT = `# 角色
你是一名资深影视编剧，擅长将小说改编为拍摄剧本。

# 任务
将以下小说章节改编为标准拍摄剧本格式。

# 剧本格式（每场戏）
【场号】X
【场景】内/外景 - 地点 - 时间
【人物】角色A、角色B
【内容】
动作/场景描述（可读性强，导演可直接用）

角色A：（对白内容）

角色B：（对白内容）

（镜头提示：如"推近特写""拉远全景"等）

# 规则
1. 保留核心情节和关键对白，不丢失重要剧情信息
2. 删除内心独白、旁白等不可拍摄内容，转变为动作/表情描述
3. 添加必要的场景描述和动作指示，让导演能直接拍摄
4. 每章拆分为 3~8 场戏，根据情节密度合理分场
5. 保持角色原有人设和关系
6. 对白保留原文风格，但去除"说""道"等冗余标记
7. 如果有打斗/追逐等动作戏，分镜要清晰、动作指示要具体
8. 输出纯文本格式，每场戏之间空一行

# 运镜要求
{cinematic_style}

# 输出格式
请严格按照以下格式输出，不要添加额外说明：

【场号】1
【场景】内景 - 客栈大堂 - 日
【人物】李逍遥、赵灵儿
【内容】
午后的客栈大堂宾客满座，李逍遥倚在柜台边，漫不经心地把玩着手中的酒壶。

李逍遥：（懒洋洋地）这镇上最近可不太平啊。

赵灵儿：（低声）师兄，师父交代的事……

李逍遥摆了摆手，示意她噤声。他的目光扫过大堂角落一个戴着斗笠的身影。

（镜头切至斗笠人特写）

【场号】2
【场景】外景 - 山间小道 - 黄昏
【人物】李逍遥、赵灵儿、黑衣人
【内容】
……`

/** 通过 PromptRegistry 读取编剧 prompt */
async function getSystemPrompt(): Promise<string> {
  const { getPrompt } = await import('../../runtime/prompt/PromptRegistry.js')
  return getPrompt(PROMPT_NAME)
}

/**
 * 将小说章节转为剧本
 * @param projectId 项目ID
 * @param chapterNos 要转换的章节号列表（单章或多章）
 * @param userId 用户ID
 * @returns 剧本结果列表
 */
export async function convertToScreenplay(
  projectId: string,
  chapterNos: number[],
  userId: string,
  cinematicStyle?: string,  // 用户指定的运镜偏好
): Promise<ChapterScreenplay[]> {
  // 1. 获取项目 + 章节内容
  const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
  if (!project) throw new Error('项目不存在')

  const chapters = await prisma.hdzChapter.findMany({
    where: { projectId, chapterNo: { in: chapterNos } },
    orderBy: { chapterNo: 'asc' },
  })

  if (chapters.length === 0) throw new Error('未找到指定章节')

  // 2. 从 DB 读取 system prompt
  let systemPrompt = await getSystemPrompt()
  // 注入用户运镜偏好（如果用户有填写）
  const styleText = cinematicStyle?.trim()
    ? `以下是用镜头语言要求，必须严格遵守：
${cinematicStyle}

同时，请遵循上面#运镜要求 中提到的通用规范。`
    : '参照常见影视剧本的运镜规范，适当使用推拉摇移跟、正反打等基础镜头。镜头提示用括号标明即可。'
  systemPrompt = systemPrompt.replace('{cinematic_style}', styleText)

  // 3. 获取用户 LLM 配置
  const llmCfg = await getUserLLMConfig(userId)
  if (!llmCfg) throw new Error('请先配置大模型 API Key（LLM）')

  const results: ChapterScreenplay[] = []

  for (const chapter of chapters) {
    // 构建用户消息
    const userMessage = [
      `【项目名称】${project.title || '未命名'}`,
      chapter.title ? `【章节标题】${chapter.title}` : '',
      `【章节号】第 ${chapter.chapterNo} 章`,
      ``,
      `【以下是待改编的小说正文】`,
      chapter.content || '',
    ].join('\n')

    // 4. 配额检查
    const q = await checkDailyQuota(userId)
    if (!q.canProceed) {
      throw new Error(`QUOTA_LIMIT_REACHED: 今日 AI 调用次数已达上限（${q.limit} 次）`)
    }

    // 5. 调用 LLM
    const raw = await callLLM(llmCfg, systemPrompt, userMessage, {
      maxTokens: 16384,
      temperature: 0.5,
    })

    // 5. 解析为结构化场景列表
    const scenes = parseScreenplayScenes(raw, chapter.chapterNo)

    results.push({
      chapterNo: chapter.chapterNo,
      chapterTitle: chapter.title || '',
      scenes,
      raw,
    })
  }

  // 6. 扣减配额
  incrementDailyUsage(userId, 'llm').catch(() => {})

  return results
}

/**
 * 解析 LLM 输出的剧本文本为结构化场景列表
 */
function parseScreenplayScenes(raw: string, chapterNo: number): ScreenplayScene[] {
  const scenes: ScreenplayScene[] = []
  
  // 按【场号】分割
  const blocks = raw.split(/(?=【场号】)/)
  
  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue

    // 场号
    const noMatch = trimmed.match(/【场号】\s*(\d+)/)
    if (!noMatch) continue
    const sceneNo = parseInt(noMatch[1], 10)

    // 场景
    const locMatch = trimmed.match(/【场景】\s*(.+?)(?:\n|$)/)
    const location = locMatch?.[1]?.trim() || ''

    // 人物
    const charMatch = trimmed.match(/【人物】\s*(.+?)(?:\n|$)/)
    const characters = charMatch
      ? charMatch[1].split(/[、，,]/).map(s => s.trim()).filter(Boolean)
      : []

    // 摄影
    const cameraMatch = trimmed.match(/【摄影】\s*(.+?)(?:\n|$)/)
    const camera = cameraMatch?.[1]?.trim() || ''

    // 内容（从【内容】往后到结尾或到下一个【场号】）
    const contentMatch = trimmed.match(/【内容】\s*([\s\S]*?)$/)
    const content = contentMatch?.[1]?.trim() || ''

    scenes.push({ sceneNo, location, characters, camera, content })
  }

  // 如果 LLM 输出了场号但没标【场号】标记，降级处理
  if (scenes.length === 0 && raw.trim()) {
    scenes.push({
      sceneNo: 1,
      location: '',
      characters: [],
      content: raw.trim(),
    })
  }

  return scenes
}

/**
 * 保存剧本到 agent_tasks
 */
export async function saveScreenplayTask(
  projectId: string,
  chapterNo: number,
  userId: string,
  result: ChapterScreenplay,
): Promise<string> {
  const task = await prisma.hdzAgentTask.create({
    data: {
      projectId,
      agentType: 'screenwriter',
      status: 'completed',
      input: { chapterNo, mode: 'screenplay', projectTitle: 'auto' },
      output: {
        chapterNo: result.chapterNo,
        chapterTitle: result.chapterTitle,
        scenes: result.scenes,
        raw: result.raw,
        sceneCount: result.scenes.length,
      },
      startedAt: new Date(),
      completedAt: new Date(),
    },
  })
  return task.id
}

/**
 * 获取项目的所有剧本
 */
export async function getProjectScreenplays(projectId: string): Promise<any[]> {
  const tasks = await prisma.hdzAgentTask.findMany({
    where: { projectId, agentType: 'screenwriter', status: 'completed' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      input: true,
      output: true,
      createdAt: true,
    },
  })
  return tasks
}
