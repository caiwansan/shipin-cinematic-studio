import type { ApiResponse } from '../contracts/api/base.js';
/**
 * System Health API — 系统状态监控
 *
 * - GET /api/v1/system/health — 系统健康状态（LLM 负载、队列、circuit breaker）
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma, getRouteConfig, getRouteConfigGroup } from '../utils/index.js'
import { llmPool } from '../jobs/llm-pool.js'
import { getProviderStateService } from '../runtime/provider-state/index.js'
import { toApiResponse } from '../contracts/runtime/toApiResponse.js';

// 辅助函数：从 RouteConfig 读取 provider 测试配置
async function getProviderTestConfigs(): Promise<any[]> {
  return await getRouteConfig('route:system-health', 'provider_test_configs', [
    {
      name: 'deepseek', displayName: 'DeepSeek', envKey: 'DEEPSEEK_API_KEY',
      endpoint: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat',
    },
    {
      name: 'siliconflow', displayName: '硅基流动', envKey: 'SILICONFLOW_API_KEY',
      endpoint: 'https://api.siliconflow.cn/v1/chat/completions', model: 'Qwen/Qwen2.5-7B-Instruct',
    },
    {
      name: 'bailian', displayName: '阿里百炼 Qwen', envKey: 'ALIYUN_API_KEY',
      envKeyFallback: 'BAILIAN_API_KEY',
      endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-plus',
    },
    {
      name: 'kimi', displayName: 'Kimi 月之暗面', envKey: 'KIMI_API_KEY',
      endpoint: 'https://api.moonshot.cn/v1/chat/completions', model: 'moonshot-v1-8k',
      baseUrlEnv: 'KIMI_BASE_URL', baseUrlDefault: 'https://api.moonshot.cn/v1',
    },
    {
      name: 'openai', displayName: 'OpenAI', envKey: 'OPENAI_API_KEY',
      endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini',
    },
  ])
}

async function getVolcengineTestConfig(): Promise<any> {
  return await getRouteConfig('route:system-health', 'volcengine_test_config', {
    name: 'volcengine', displayName: '火山豆包',
    envKey: 'VOLCENGINE_API_KEY', modelEnv: 'VOLCENGINE_LLM_MODEL',
    defaultModel: 'doubao-seed-2-1-pro-260628',
    baseUrlEnv: 'VOLCENGINE_BASE_URL', baseUrlDefault: 'https://ark.cn-beijing.volces.com/api/v3',
  })
}

async function getHealthThresholds(): Promise<Record<string, number>> {
  return await getRouteConfig('route:system-health', 'system_health_thresholds', {
    cpuLoadDegraded: 0.8, llmLoadDegraded: 0.8, queueSizeBusy: 10,
  })
}

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
      return toApiResponse({success: false, error: '未找到环境变量'}) satisfies ApiResponse<unknown>;
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
    const thresholds = await getHealthThresholds()
    const loadPercent = loadAvg[0] / os.cpus().length
    if (status.circuitOpen) {
      systemStatus = 'degraded'
    } else if (loadPercent > (thresholds.cpuLoadDegraded || 0.8) || status.llmLoad > (thresholds.llmLoadDegraded || 0.8) || status.queueSize > (thresholds.queueSizeBusy || 10)) {
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
        return toApiResponse({name, displayName, model, ok: false, latency: null, error: e.message?.slice(0, 100)}) satisfies ApiResponse<unknown>;
      }
    }

    const results: ProviderTestResult[] = []

    // 从 RouteConfig 读取 provider 测试配置
    const providerConfigs = await getProviderTestConfigs()
    for (const cfg of providerConfigs) {
      const apiKey = process.env[cfg.envKey as string]
      if (!apiKey && cfg.envKeyFallback) {
        cfg.apiKey = process.env[cfg.envKeyFallback as string]
      }
      if (apiKey || cfg.apiKey) {
        results.push(await testProvider(cfg.name, cfg.displayName, cfg.endpoint, cfg.model, apiKey || cfg.apiKey))
      }
    }

    // 火山引擎豆包 LLM（独立，因为 endpoint 需要 env 拼接）
    const volcConfig = await getVolcengineTestConfig()
    if (process.env[volcConfig.envKey as string]) {
      const model = process.env[volcConfig.modelEnv as string] || volcConfig.defaultModel
      const baseUrl = process.env[volcConfig.baseUrlEnv as string] || volcConfig.baseUrlDefault
      const t0 = Date.now()
      try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env[volcConfig.envKey as string]}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
        })
        const json = await res.json()
        const ok = !!(json.choices || json.id)
        results.push({
          name: volcConfig.name, displayName: volcConfig.displayName, model,
          ok, latency: ok ? Math.round(Date.now() - t0) : null,
          error: ok ? undefined : `HTTP ${res.status}: ${JSON.stringify(json).slice(0, 100)}`,
        })
      } catch (e: any) {
        results.push({ name: volcConfig.name, displayName: volcConfig.displayName, model, ok: false, latency: null, error: e.message?.slice(0, 100) })
      }
    }

    return toApiResponse({success: true, data: results}) satisfies ApiResponse<unknown>;
  })

  // GET /api/v1/system/provider-state — Provider 运行时状态（可观测 + 持久化）
  fastify.get('/api/v1/system/provider-state', async (_request: FastifyRequest, reply: FastifyReply) => {
    const svc = getProviderStateService()
    const cached = svc.getAllCached()
    return toApiResponse({success: true,
      data: cached,
      summary: svc.getSummary(cached),}) satisfies ApiResponse<unknown>;
  })

  // GET /api/v1/system/provider-state/:userId — 指定用户的 provider 状态
  fastify.get('/api/v1/system/provider-state/:userId', async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
    const svc = getProviderStateService()
    const states = await svc.getAllForUser(request.params.userId)
    return toApiResponse({success: true,
      data: states,
      summary: svc.getSummary(states),}) satisfies ApiResponse<unknown>;
  })
}
