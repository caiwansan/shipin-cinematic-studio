/**
 * routes/workflow.ts — Workflow DAG API
 *
 * 端点：
 *   POST /api/v1/workflow/execute-node — 执行一个 DAG 节点
 *     Body: { type, input, context? }
 *     Response: { success, nodeId, type, status, output, error }
 *
 * 前端用法：
 *   // 优化角色提示词
 *   POST /api/v1/workflow/execute-node { type: "llm.optimize", input: { prompt: "..." } }
 *
 *   // 生成角色图片
 *   POST /api/v1/workflow/execute-node { type: "image.generate", input: { prompt: "...", ... } }
 *
 *   // 生成视频
 *   POST /api/v1/workflow/execute-node { type: "video.generate", input: { scenes: [...], ... } }
 *
 *   // 生成语音
 *   POST /api/v1/workflow/execute-node { type: "tts.generate", input: { text: "...", voiceId: "..." } }
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { getWorkflowEngine } from '../workflow/index.js'
import { loadFullConfigV2 } from '../config/v2.js'
import type { WorkflowNodeType } from '../workflow/types.js'

const VALID_TYPES: WorkflowNodeType[] = [
  'llm.optimize',
  'image.generate',
  'video.generate',
  'tts.generate',
  'manual.confirm',
]

export default async function workflowRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/workflow/execute-node
   *
   * 统一执行入口。
   * 前端只需要传 type + input，Engine 自动路由到对应的 Provider。
   */
  fastify.post('/api/v1/workflow/execute-node', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{
    Body: { type: string; input: Record<string, any>; context?: Record<string, any> }
  }>, reply: FastifyReply): Promise<any> => {
    const { type, input, context } = request.body
    const userId = (request.user as any)?.id

    // 1. 验证类型
    if (!type || !VALID_TYPES.includes(type as WorkflowNodeType)) {
      return reply.status(400).send({
        success: false,
        error: `无效的节点类型: "${type}"，有效类型: ${VALID_TYPES.join(', ')}`,
      })
    }

    if (!input || Object.keys(input).length === 0) {
      return reply.status(400).send({
        success: false,
        error: 'input 不能为空',
      })
    }

    // 2. 加载 User Config V2
    const userConfig = await loadFullConfigV2(userId)
    if (!userConfig) {
      return reply.status(400).send({
        success: false,
        error: '请先在大模型设置配置 API Key',
      })
    }

    // 3. 执行
    const engine = getWorkflowEngine()
    const result = await engine.executeNode(
      type as WorkflowNodeType,
      input,
      userConfig as any,
      userId,
      context,
    )

    return reply.status(result.success ? 200 : 400).send(result)
  })

  /**
   * GET /api/v1/workflow/types — 查询支持的节点类型
   */
  fastify.get('/api/v1/workflow/types', async (_request: FastifyRequest, reply: FastifyReply) => {
    const typeDescriptions: Record<string, string> = {
      'llm.optimize': 'LLM optimization',
      'image.generate': 'Image generation',
      'video.generate': 'Video generation',
      'tts.generate': 'TTS synthesis',
      'manual.confirm': 'Manual confirm step',
    }
    return reply.send({
      success: true,
      data: VALID_TYPES.map(t => ({
        type: t,
        description: typeDescriptions[t] || t,
        providerSource: t === 'manual.confirm' ? 'none' : 'from User Model Config',
      }))
    })
  })
}
