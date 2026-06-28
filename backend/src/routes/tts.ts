import type { ApiResponse } from '../contracts/api/base.js';
/**
 * routes/tts.ts — 语音合成路由（SEEL 收敛）
 *
 * SEEL: Single Entry Execution Lock
 * 所有 AI 生成任务必须走 /api/tasks/ai-generate
 *
 * POST /api/tts/generate — 已降级为代理转发到 /api/tasks/ai-generate
 * POST /api/tts/synthesize — 同上
 * GET  /api/tts/voices — 获取可用音色列表（保留，仅信息查询）
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../utils/index.js'

export default async function ttsRoutes(fastify: FastifyInstance): Promise<void> {

  // ============ SEEL 代理：转发到队列入口 ============

  async function proxyToQueue(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const { text, voiceId, speed, projectId } = request.body as any
    const userId = (request.user as any)?.id

    if (!text || !text.trim()) {
      return reply.status(400).send({ error: 'text is required' })
    }

    // 代理到 /api/tasks/ai-generate（由 ai-tasks.ts 处理队列入队 + RuntimePayload 构建）
    // 在所有前端升级前保持过渡兼容
    const taskUrl = `/api/tasks/ai-generate`
    const taskBody = JSON.stringify({
      projectId: projectId || null,
      taskType: 'tts',
      input: {
        text: text.trim().substring(0, 500),
        voiceId: voiceId || 'zh_male_deep',
        speed: Number(speed) || 1.0,
        source: 'voice',
      },
    })

    // 模拟请求转发——构造内部 Fastify 注入请求
    // 从原始请求复制认证信息
    try {
      // 直接转发到 ai-tasks 的 handler（不走 HTTP）
      const injectResp = await (reply.request as any).server.inject({
        method: 'POST',
        url: taskUrl,
        headers: {
          authorization: (request.headers as any).authorization || '',
          'content-type': 'application/json',
        },
        payload: taskBody,
      })
      const parsed = JSON.parse(injectResp.body)
      return reply.status(injectResp.statusCode).send(parsed)
    } catch (e: any) {
      console.warn('[TTS/Proxy] inject 转发失败，回退到对外请求:', e.message)
      // 兜底：无内部 inject 能力时做外部 fetch
      const res = await fetch(new URL(taskUrl, `http://localhost:${(process.env.PORT || 4000)}`).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: (request.headers as any).authorization || '',
        },
        body: taskBody,
      })
      const data = await res.json()
      return reply.status(res.status).send(data)
    }
  }

  // ============ 路由注册 ============

  // POST /api/tts/synthesize — SEEL 代理（VoiceGeneration.vue 旧调用方过渡）
  fastify.post('/api/tts/synthesize', { preHandler: [fastify.authenticate] }, proxyToQueue)

  // POST /api/tts/generate — SEEL 代理（旧调用方过渡）
  fastify.post('/api/tts/generate', { preHandler: [fastify.authenticate] }, proxyToQueue)

  // GET /api/tts/voices — 获取可用音色列表（保留，仅信息查询）
  fastify.get('/api/tts/voices', { preHandler: [fastify.authenticate] }, async (_request) => {
    // 统一返回所有平台音色列表（SEEL 不再区分用户 Key 状态）
    return {
      success: true,
      voices: [
        // 硅基流动 / CosyVoice / fish-speech
        { id: 'zh_male_deep', name: '低沉男声', gender: 'male', provider: 'siliconflow' },
        { id: 'zh_male_warm', name: '磁性男声', gender: 'male', provider: 'siliconflow' },
        { id: 'zh_male_calm', name: '沉稳男声', gender: 'male', provider: 'siliconflow' },
        { id: 'zh_male_cheerful', name: '欢快男声', gender: 'male', provider: 'siliconflow' },
        { id: 'zh_female_calm', name: '沉稳女声', gender: 'female', provider: 'siliconflow' },
        { id: 'zh_female_passion', name: '激情女声', gender: 'female', provider: 'siliconflow' },
        { id: 'zh_female_gentle', name: '温柔女声', gender: 'female', provider: 'siliconflow' },
        { id: 'zh_female_cheerful', name: '欢快女声', gender: 'female', provider: 'siliconflow' },
        // 阿里百炼 qwen3-tts
        { id: 'Cherry', name: '亲切女声', gender: 'female', provider: 'aliyun' },
        { id: 'Henry', name: '沉稳男声', gender: 'male', provider: 'aliyun' },
        // 火山引擎
        { id: 'BV001_streaming', name: '亲切女声', gender: 'female', provider: 'volcengine' },
        { id: 'BV002_streaming', name: '温柔女声', gender: 'female', provider: 'volcengine' },
        { id: 'BV007_streaming', name: '清澈男声', gender: 'male', provider: 'volcengine' },
        { id: 'BV010_streaming', name: '低沉男声', gender: 'male', provider: 'volcengine' },
      ],
    }
  })
}
