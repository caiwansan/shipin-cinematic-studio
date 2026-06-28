/**
 * System Health API — 系统状态监控
 *
 * - GET /api/v1/system/health — 系统健康状态（LLM 负载、队列、circuit breaker）
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { llmPool } from '../jobs/llm-pool.js'
import { getProviderStateService } from '../runtime/provider-state/index.js'

export default async function systemHealthRoutes(fastify: FastifyInstance) {
  // GET /api/v1/system/env-keys — 返回所有 API Key 的脱敏状态（admin dashboard 用）
  fastify.get('/api/v1/system/env-keys', async (_request: FastifyRequest, reply: FastifyReply) => {
    const mask = (v: string | undefined) => v ? v.substring(0, 6) + '••••' + v.slice(-4) : ''
    return {
      success: true,
      data: {
        deepseekApiKey: mask(process.env.DEEPSEEK_API_KEY),
        siliconflowApiKey: mask(process.env.SILICONFLOW_API_KEY),
        aliyunApiKey: mask(process.env.ALIYUN_API_KEY || process.env.BAILIAN_API_KEY),
        kimiApiKey: mask(process.env.KIMI_API_KEY),
        openaiApiKey: mask(process.env.OPENAI_API_KEY),
        volcengineApiKey: mask(process.env.VOLCENGINE_API_KEY),
        volcengineLlmModel: process.env.VOLCENGINE_LLM_MODEL || '',
        volcengineImageModel: process.env.VOLCENGINE_IMAGE_MODEL || '',
        volcengineVideoModel: process.env.VOLCENGINE_VIDEO_MODEL || '',
      },
    }
  })

  // GET /api/v1/system/env-key/:name — 返回指定环境变量的脱敏值
  fastify.get('/api/v1/system/env-key/:name', async (request: FastifyRequest, reply: FastifyReply) => {
    const { name } = request.params as any
    const raw = process.env[name as string]
    if (!raw) {
      return { success: false, error: '未找到环境变量' }
    }
    return {
      success: true,
      data: {
        value: raw,
        exists: true,
      },
    }
  })

  fastify.get('/api/v1/system/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    const status = llmPool.getStatus()
    const { default: os } = await import('os')

    const loadAvg = os.loadavg()
    const memFree = os.freemem()
    const memTotal = os.totalmem()

    // 聚合判断
    let systemStatus: 'normal' | 'busy' | 'degraded' = 'normal'
    const loadPercent = loadAvg[0] / os.cpus().length
    if (status.circuitOpen) {
      systemStatus = 'degraded'
    } else if (loadPercent > 0.8 || status.llmLoad > 0.8 || status.queueSize > 10) {
      systemStatus = 'busy'
    }

    return {
      success: true,
      data: {
        timestamp: Date.now(),
        status: systemStatus,
        llm: {
          load: Math.round(status.llmLoad * 100) / 100,
          queueSize: status.queueSize,
          circuitOpen: status.circuitOpen,
        },
        system: {
          loadAvg: loadAvg.map(l => Math.round(l * 100) / 100),
          memoryUsage: Math.round((1 - memFree / memTotal) * 100),
          uptime: Math.round(os.uptime()),
        },
        recommendation: status.circuitOpen
          ? 'fallback_active'
          : systemStatus === 'busy'
            ? 'throttle_requests'
            : 'normal',
      },
    }
  })

  // GET /api/v1/system/providers-test — 后端统一测试所有 LLM Provider
  fastify.get('/api/v1/system/providers-test', async (_request: FastifyRequest, reply: FastifyReply) => {
    type ProviderTestResult = {
      name: string
      displayName: string
      model: string
      ok: boolean
      latency: number | null
      error?: string
    }

    async function testProvider(name: string, displayName: string,
      endpoint: string, model: string, apiKey: string): Promise<ProviderTestResult> {
      const t0 = Date.now()
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 5,
          }),
        })
        const json = await res.json()
        const ok = !!(json.choices || json.data || json.id)
        return {
          name, displayName, model,
          ok,
          latency: ok ? Math.round(Date.now() - t0) : null,
          error: ok ? undefined : `HTTP ${res.status}: ${JSON.stringify(json).slice(0, 100)}`,
        }
      } catch (e: any) {
        return { name, displayName, model, ok: false, latency: null, error: e.message?.slice(0, 100) }
      }
    }

    const results: ProviderTestResult[] = []

    if (process.env.DEEPSEEK_API_KEY) {
      results.push(await testProvider('deepseek', 'DeepSeek', 'https://api.deepseek.com/v1/chat/completions', 'deepseek-chat', process.env.DEEPSEEK_API_KEY))
    }

    if (process.env.SILICONFLOW_API_KEY) {
      results.push(await testProvider('siliconflow', '硅基流动', 'https://api.siliconflow.cn/v1/chat/completions', 'Qwen/Qwen2.5-7B-Instruct', process.env.SILICONFLOW_API_KEY))
    }

    const aliyunKey = process.env.ALIYUN_API_KEY || process.env.BAILIAN_API_KEY
    if (aliyunKey) {
      results.push(await testProvider('bailian', '阿里百炼 Qwen', 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', 'qwen-plus', aliyunKey))
    }

    if (process.env.KIMI_API_KEY) {
      results.push(await testProvider('kimi', 'Kimi 月之暗面', `${process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1'}/chat/completions`, 'moonshot-v1-8k', process.env.KIMI_API_KEY))
    }

    if (process.env.OPENAI_API_KEY) {
      results.push(await testProvider('openai', 'OpenAI', 'https://api.openai.com/v1/chat/completions', 'gpt-4o-mini', process.env.OPENAI_API_KEY))
    }

    // 火山引擎豆包 LLM
    if (process.env.VOLCENGINE_API_KEY) {
      const model = process.env.VOLCENGINE_LLM_MODEL || 'doubao-seed-2-0-mini-260428'
      const t0 = Date.now()
      try {
        const res = await fetch(`${process.env.VOLCENGINE_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.VOLCENGINE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
        })
        const json = await res.json()
        const ok = !!(json.choices || json.id)
        results.push({
          name: 'volcengine', displayName: '火山豆包', model,
          ok, latency: ok ? Math.round(Date.now() - t0) : null,
          error: ok ? undefined : `HTTP ${res.status}: ${JSON.stringify(json).slice(0, 100)}`,
        })
      } catch (e: any) {
        results.push({ name: 'volcengine', displayName: '火山豆包', model, ok: false, latency: null, error: e.message?.slice(0, 100) })
      }
    }

    return { success: true, data: results }
  })

  // GET /api/v1/system/provider-state — Provider 运行时状态（可观测 + 持久化）
  fastify.get('/api/v1/system/provider-state', async (_request: FastifyRequest, reply: FastifyReply) => {
    const svc = getProviderStateService()
    const cached = svc.getAllCached()
    return {
      success: true,
      data: cached,
      summary: svc.getSummary(cached),
    }
  })

  // GET /api/v1/system/provider-state/:userId — 指定用户的 provider 状态
  fastify.get('/api/v1/system/provider-state/:userId', async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
    const svc = getProviderStateService()
    const states = await svc.getAllForUser(request.params.userId)
    return {
      success: true,
      data: states,
      summary: svc.getSummary(states),
    }
  })
}
