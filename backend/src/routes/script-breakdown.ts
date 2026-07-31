/**
 * script-breakdown.ts — 剧本拆解任务 CRUD + AI 提交
 *
 * 设计目标：
 * - 前端提交剧本全文 → 创建 script_breakdown_task 记录（含固定 system prompt）
 * - 后端从 DB 读取固定 prompt 调 LLM，结果写回记录
 * - 固定指令固化，杜绝 prompt 变动导致的拆解偏差
 * - 必须使用用户自配的 API Key，禁止平台 API
 * - ⭐ LLM 调用路径统一走 NarrativeGateway（见 narrative-gateway.ts）
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

// ⭐ AI 系统指令从 DB PromptTemplate 读取（禁止硬编码）
async function getAnalyzeV2Prompt(): Promise<string> {
  const dbTemplate = await prisma.promptTemplate.findUnique({
    where: { name: '六维数据拆解分析' },
  })
  if (dbTemplate?.content && typeof dbTemplate.content === 'object' && 'prompt' in (dbTemplate.content as any)) {
    return (dbTemplate.content as any).prompt as string
  }
  throw new Error('[ScriptBreakdown] PromptTemplate.六维数据拆解分析 在数据库中不存在或内容为空')
}

// ─── 类型 ───

interface CreateTaskInput {
  script: string
  title?: string
  targetDuration?: number
  segmentDuration?: number
  userId?: string
}

interface TaskResponse {
  id: string
  script: string
  title: string
  targetDuration: number
  segmentDuration: number
  status: number
  resultScript?: string | null
  fixedSystemPrompt: string
  createdAt: string
  updatedAt: string
}

function toResponse(record: any): TaskResponse {
  return {
    id: record.id,
    script: record.script,
    title: record.title,
    targetDuration: record.targetDuration,
    segmentDuration: record.segmentDuration,
    status: record.status,
    resultScript: record.resultScript,
    fixedSystemPrompt: record.fixedSystemPrompt,
    createdAt: record.createdAt?.toISOString?.() || record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() || record.updatedAt,
  }
}

// ─── 路由 ───

export default async function scriptBreakdownRoutes(app: FastifyInstance) {

  // GET /api/v1/script-breakdown/:id — 查询任务
  // @deprecated — Reality Recovery Phase6: 前端 0 生产引用（现行链 = /api/script/submit）
  app.get('/api/v1/script-breakdown/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const record = await prisma.scriptBreakdown.findUnique({ where: { id } })
    if (!record) {
      reply.status(404).send({ success: false, error: '任务不存在' })
      return
    }
    // ⭐ Phase 6 安全隔离: 归属校验
    if (record.userId !== (request as any).user?.id) {
      return reply.status(403).send({ success: false, error: '无权访问该任务' })
    }
    return { success: true, data: toResponse(record) }
  })

  // GET /api/v1/script-breakdown — 列表
  // @deprecated — Reality Recovery Phase6: 前端 0 生产引用
  app.get('/api/v1/script-breakdown', { preHandler: [app.authenticate] }, async (request, reply) => {
    const query = request.query as any
    const limit = Math.min(parseInt(query.limit || '20'), 100)
    const offset = parseInt(query.offset || '0')
    // ⭐ Phase 6 安全隔离: 只返回当前用户的任务
    const records = await prisma.scriptBreakdown.findMany({
      where: { userId: (request as any).user?.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })
    const total = await prisma.scriptBreakdown.count({ where: { userId: (request as any).user?.id } })
    return { success: true, data: records.map(toResponse), total }
  })

  // POST /api/v1/script-breakdown — 创建新任务
  // @deprecated — Reality Recovery Phase6: 前端 0 生产引用
  app.post('/api/v1/script-breakdown', { preHandler: [app.authenticate] }, async (request, reply) => {
    const input = request.body as CreateTaskInput
    if (!input.script?.trim()) {
      reply.status(400).send({ success: false, error: '剧本全文不能为空' })
      return
    }

    const title = input.title || '未命名项目'
    const targetDuration = input.targetDuration || 60
    const segmentDuration = input.segmentDuration || 10
    // ⭐ Phase 6 安全隔离: userId 只从认证身份取，禁止 body.userId / x-user-id 伪造
    const userId = (request as any).user?.id || ''

    const fixedPrompt = await getAnalyzeV2Prompt()
    const record = await prisma.scriptBreakdown.create({
      data: {
        title,
        script: input.script.trim(),
        targetDuration,
        segmentDuration,
        userId,
        fixedSystemPrompt: fixedPrompt,
        status: 0,
      },
    })

    return { success: true, data: toResponse(record) }
  })

  // POST /api/v1/script-breakdown/:id/submit — 提交 AI 拆解
  // @deprecated — Reality Recovery Phase6: 前端 0 生产引用
  app.post('/api/v1/script-breakdown/:id/submit', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const record = await prisma.scriptBreakdown.findUnique({ where: { id } })
    if (!record) {
      reply.status(404).send({ success: false, error: '任务不存在' })
      return
    }
    // ⭐ Phase 6 安全隔离: 归属校验
    if (record.userId !== (request as any).user?.id) {
      return reply.status(403).send({ success: false, error: '无权操作该任务' })
    }
    if (record.status === 2) {
      reply.status(400).send({ success: false, error: '任务已完成' })
      return
    }

    // 标记处理中
    await prisma.scriptBreakdown.update({ where: { id }, data: { status: 1 } })

    try {
      // ⭐ 通过 NarrativeGateway 统一执行 LLM 调用（自动发现用户配置、自动注入 Key）
      const { narrativeGateway } = await import('../runtime/narrative-gateway.js')

      const FIXED_SYSTEM_PROMPT = await getAnalyzeV2Prompt()
      const systemContent = record.fixedSystemPrompt || FIXED_SYSTEM_PROMPT
      const userContent = `剧本名称：${record.title}

剧本全文：
${record.script.slice(0, 8000)}

视频总时长：${record.targetDuration} 秒`

      const gatewayResponse = await narrativeGateway.execute({
        systemPrompt: systemContent,
        userMessage: userContent,
        userId: record.userId || 'anonymous',
        timeoutTier: 'long',
        maxTokens: 8192,
        temperature: 0.1,
      })

      let resultText = gatewayResponse.content
      console.log('[ScriptBreakdown] LLM 返回长度:', resultText.length, '前200字符:', resultText.slice(0, 200).replace(/\n/g, '\\n'))

      // 提取 JSON：去掉 markdown 代码块包裹
      const jsonMatch = resultText.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
      if (jsonMatch) {
        resultText = jsonMatch[1].trim()
      }

      // 验证是否合法 JSON，不是则尝试修复
      try {
        JSON.parse(resultText)
      } catch {
        const firstBrace = resultText.indexOf('{')
        const lastBrace = resultText.lastIndexOf('}')
        if (firstBrace >= 0 && lastBrace > firstBrace) {
          resultText = resultText.slice(firstBrace, lastBrace + 1)
        }
      }

      // 写回结果
      await prisma.scriptBreakdown.update({
        where: { id },
        data: {
          resultScript: resultText,
          status: 2,
        },
      })

      // ⭐ PipelineMaterializer：将拆解结果分配到九大 PipelineStage
      try {
        const narrative = JSON.parse(resultText)
        if (narrative && typeof narrative === 'object' && narrative.segments) {
          // 优先用 record.projectId；没有则从 title 模糊匹配 project 表
          let projectId = record.projectId
          if (!projectId) {
            const matched = await prisma.project.findFirst({
              where: { name: record.title },
              orderBy: { updatedAt: 'desc' },
              select: { id: true },
            })
            if (matched) projectId = matched.id
          }
          if (projectId) {
            const { pipelineMaterializer } = await import('../services/PipelineMaterializer.js')
            const materializeResult = await pipelineMaterializer.materialize(
              projectId,
              narrative,
            )
            console.log('[ScriptBreakdown] ✅ PipelineMaterializer:',
              'success=', materializeResult.success,
              'stages=', JSON.stringify(materializeResult.stages),
              'errors=', materializeResult.errors.length,
            )
          } else {
            console.warn('[ScriptBreakdown] ⚠️ 未找到对应 project，跳过 PipelineMaterializer')
          }
        }
      } catch (matErr: any) {
        // materialize 失败不阻塞主流程，只记录日志
        console.warn('[ScriptBreakdown] ⚠️ PipelineMaterializer 失败（非致命）:', matErr.message)
      }

      return { success: true, data: toResponse(
        await prisma.scriptBreakdown.findUnique({ where: { id } })
      )}
    } catch (err: any) {
      await prisma.scriptBreakdown.update({
        where: { id },
        data: { status: 3 },
      })
      console.error('[ScriptBreakdown] AI 拆解失败:', err.message)
      reply.status(500).send({ success: false, error: `AI 拆解失败: ${err.message}` })
    }
  })
}
