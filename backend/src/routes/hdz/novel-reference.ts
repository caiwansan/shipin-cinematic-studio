/**
 * 混沌珠 — 小说参考 (Novel Reference) 路由
 *
 * 用户提交已发布小说的链接，后台异步抓取并调用文曲星 Agent 分析，
 * 产出 Novel Blueprint（不含原文），作为创作上下文注入文曲星对话。
 *
 * BYOK：所有 LLM 调用走 getUserLLMConfig → callLLM
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import { getUserLLMConfig, callLLM } from '../../services/hdz/llm.client.js'
import { fetchUrlContent } from '../../services/hdz/fetch-url-content.js'

export default async function hdzNovelReferenceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // ── POST /api/hdz/:projectId/novel-reference/analyze ──
  // 提交小说链接，创建参考记录，异步开始分析
  app.post('/api/hdz/:projectId/novel-reference/analyze', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any
    const { sourceUrl } = request.body as any

    if (!sourceUrl?.trim()) {
      return reply.status(400).send({ success: false, error: '请提供小说链接' })
    }

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    // 创建参考记录
    const ref = await prisma.hdzNovelReference.create({
      data: {
        projectId,
        sourceUrl: sourceUrl.trim(),
        status: 'pending',
      },
    })

    // 异步分析（不阻塞响应）
    analyzeNovel(ref.id).catch(err => {
      console.error(`[HDZ/NovelReference] 分析失败 ref=${ref.id}:`, err.message)
    })

    return { success: true, data: { id: ref.id, status: ref.status } }
  })

  // ── GET /api/hdz/:projectId/novel-reference/list ──
  // 获取项目的所有参考作品列表
  app.get('/api/hdz/:projectId/novel-reference/list', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const refs = await prisma.hdzNovelReference.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        sourceUrl: true,
        title: true,
        status: true,
        errorMsg: true,
        chapterCount: true,
        characterCount: true,
        factionCount: true,
        analysisTime: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return { success: true, data: refs }
  })

  // ── GET /api/hdz/:projectId/novel-reference/:referenceId ──
  // 获取单个参考作品详情（含 blueprint）
  app.get('/api/hdz/:projectId/novel-reference/:referenceId', async (request, reply) => {
    const user = request.user as any
    const { projectId, referenceId } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const ref = await prisma.hdzNovelReference.findFirst({
      where: { id: referenceId, projectId },
    })
    if (!ref) {
      return reply.status(404).send({ success: false, error: '参考记录不存在' })
    }

    return { success: true, data: ref }
  })

  // ── DELETE /api/hdz/:projectId/novel-reference/:referenceId ──
  // 删除单个参考作品
  app.delete('/api/hdz/:projectId/novel-reference/:referenceId', async (request, reply) => {
    const user = request.user as any
    const { projectId, referenceId } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const ref = await prisma.hdzNovelReference.findFirst({
      where: { id: referenceId, projectId },
    })
    if (!ref) {
      return reply.status(404).send({ success: false, error: '参考记录不存在' })
    }

    await prisma.hdzNovelReference.delete({ where: { id: referenceId } })
    return { success: true, data: { deleted: referenceId } }
  })
}

// ===== 核心分析逻辑 =====

const ANALYSIS_SYSTEM_PROMPT = `你是一位文学分析与创作顾问。你的任务是阅读一部已发表小说的正文内容，然后分析它的创作结构，输出一份完整的「Novel Blueprint」。

## 你的目标
- 学习这部作品的**结构规律和创作方法**
- 抽象出可复用的创作框架
- 为小说作者提供创作参考

## 严格禁令
- ❌ 绝对不要输出原文章节内容
- ❌ 绝对不要使用原文中的角色名称
- ❌ 绝对不要复制原文中的对白、场景描写、剧情细节
- ❌ 绝对不要输出原文字句或段落
- ✅ 只输出抽象的、概括性的创作结构分析

## Blueprint 输出格式
你必须以 JSON 格式输出，外层不要包裹 markdown 代码块标记：

{
  "worldSetting": {
    "worldType": "世界类型（如：仙侠世界、星际联邦、都市异能）",
    "powerSystem": "核心力量体系抽象描述",
    "levelSystem": "等级体系抽象描述",
    "factionSystem": "势力格局抽象描述"
  },
  "characterSystem": {
    "protagonist": "主角的人物类型、成长弧线模式",
    "mentor": "导师角色的功能定位",
    "antagonist": "反派的定位和冲突模式",
    "supporting": "配角群的构成方式",
    "partner": "搭档/伴侣的角色关系模式"
  },
  "factions": [
    {
      "name": "势力类型名称",
      "type": "宗门/国度/家族/组织等",
      "description": "该势力的抽象定位和叙事功能"
    }
  ],
  "plotRhythm": {
    "opening": "开篇模式分析",
    "growth": "成长阶段的节奏特征",
    "conflict": "冲突设置模式",
    "climax": "高潮的构建方式",
    "ending": "结局处理模式"
  },
  "writingStyle": [
    "文风标签1",
    "文风标签2"
  ],
  "summary": "这篇作品创作模式的整体概括"
}`

async function analyzeNovel(refId: string): Promise<void> {
  let ref = await prisma.hdzNovelReference.findUnique({ where: { id: refId } })
  if (!ref) return

  const startTime = Date.now()

  try {
    // 1. 更新为 analyzing
    await prisma.hdzNovelReference.update({
      where: { id: refId },
      data: { status: 'analyzing' },
    })

    // 2. 获取项目所有者的 LLM 配置
    const project = await prisma.hdzProject.findUnique({ where: { id: ref.projectId } })
    if (!project) throw new Error('项目不存在')

    const userCfg = await getUserLLMConfig(project.userId)
    if (!userCfg) {
      throw new Error('请先在大模型设置中配置 LLM')
    }

    // 3. 抓取 URL 内容
    const fetched = await fetchUrlContent(ref.sourceUrl)
    if (!fetched.success || !fetched.content) {
      throw new Error(`无法抓取页面内容: ${fetched.error || '内容为空'}`)
    }

    // 4. 如果抓到了标题，保存
    const title = fetched.title || ref.sourceUrl.split('/').pop() || '未知作品'
    await prisma.hdzNovelReference.update({
      where: { id: refId },
      data: { title },
    })

    // 5. 调用 LLM 分析
    const content = fetched.content
    // 限制 content 长度（按字符数），模型上下文有限
    const maxContentLen = 60000
    const truncatedContent = content.length > maxContentLen
      ? content.slice(0, maxContentLen) + '\n\n...（以下因长度限制截断）'
      : content

    const userMessage = `请分析以下小说正文的创作结构，输出 Novel Blueprint：\n\n---\n${truncatedContent}\n---`

    const response = await callLLM(
      userCfg,
      ANALYSIS_SYSTEM_PROMPT,
      userMessage,
      { maxTokens: 8192, temperature: 0.4 },
    )

    // 6. 解析 JSON Blueprint
    // 尝试提取 JSON（兼容 AI 可能用 ```json 包裹）
    let jsonStr = response.trim()
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }

    let blueprint: any
    try {
      blueprint = JSON.parse(jsonStr)
    } catch {
      // 如果不是纯 JSON，尝试从字符串中找第一个 { }
      const braceMatch = jsonStr.match(/\{[\s\S]*\}/)
      if (braceMatch) {
        try {
          blueprint = JSON.parse(braceMatch[0])
        } catch {
          // 保存原始响应
          blueprint = { raw: jsonStr }
        }
      } else {
        blueprint = { raw: jsonStr }
      }
    }

    // 7. 统计数据
    const chapterCount = typeof blueprint.plotRhythm === 'object' ? 100 : undefined
    const characterCount = typeof blueprint.characterSystem === 'object'
      ? Object.keys(blueprint.characterSystem).length : undefined
    const factionCount = Array.isArray(blueprint.factions) ? blueprint.factions.length : undefined
    const analysisTime = Math.round((Date.now() - startTime) / 1000)

    // 8. 保存结果
    await prisma.hdzNovelReference.update({
      where: { id: refId },
      data: {
        status: 'completed',
        blueprint: blueprint as any,
        chapterCount,
        characterCount,
        factionCount,
        analysisTime,
      },
    })

    console.log(`[HDZ/NovelReference] 分析完成 ref=${refId}, 耗时${analysisTime}s`)
  } catch (err: any) {
    console.error(`[HDZ/NovelReference] 分析失败 ref=${refId}:`, err.message)
    await prisma.hdzNovelReference.update({
      where: { id: refId },
      data: {
        status: 'failed',
        errorMsg: err.message || '分析过程出错',
        analysisTime: Math.round((Date.now() - startTime) / 1000),
      },
    }).catch(() => {})
  }
}
