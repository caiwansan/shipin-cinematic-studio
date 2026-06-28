/**
 * services/capability.service.ts — Capability Service
 *
 * 职责：执行策略层
 *   - provider routing
 *   - retry strategy
 *   - fallback policy
 *   - cost optimization
 *   - model connectivity test
 *
 * 不拥有 execution truth。
 */

import { prisma } from '../utils/index.js'
import { decryptKey } from './crypto.service.js'

/**
 * 默认 endpoint 映射（不包含在 routes 层，集中在此）
 *
 * 这是 Capability Service 的内部策略，不是 Runtime Core 的职责。
 * 调用方（routes）不应感知 provider 的存在。
 */
const DEFAULT_ENDPOINTS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  bailian: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
}

/**
 * 测试模型连通性
 *
 * ⚠️  本方法是 Capability Service 中唯一的探测性 HTTP 调用例外。
 *     它不是 execution path，不修改 runtime state，不持有 execution truth。
 *     设计归属：Capability Service（策略性验证）
 *     收敛计划：Provider Adapter 建立后可迁入 adapter test 方法。
 *
 * @param modelId - 数据库中的模型 ID
 * @returns { ok: boolean, latency: number | null, error: string | undefined }
 */
export async function testModelConnection(modelId: string) {
  const model = await prisma.aiModel.findUnique({ where: { id: modelId } })
  if (!model) {
    return { ok: false, latency: null, error: '模型不存在' }
  }

  // 获取 API Key（环境变量优先，否则从 ApiKey 表读取）
  let apiKey = process.env[model.apiKeyRef] || ''
  if (!apiKey && model.apiKeyRef) {
    const stored = await prisma.apiKey.findUnique({ where: { provider: model.provider } })
    if (stored) {
      try {
        apiKey = decryptKey(stored.keyValue)
      } catch {
        apiKey = ''
      }
    }
  }

  // 确定 endpoint：用户自配优先，否则用默认映射
  const endpoint = model.endpointUrl || DEFAULT_ENDPOINTS[model.provider] || ''
  if (!endpoint) {
    return { ok: false, latency: null, error: `未配置 ${model.provider} 的默认 Endpoint，请手动填写 Endpoint URL` }
  }
  if (!apiKey) {
    return { ok: false, latency: null, error: '缺少 API Key' }
  }

  const t0 = Date.now()
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model.name,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 5,
      }),
    })
    const json = await res.json()
    const ok = !!(json.choices || json.data || json.id)
    return {
      ok,
      latency: ok ? Math.round(Date.now() - t0) : null,
      error: ok ? undefined : `HTTP ${res.status}`,
    }
  } catch (e: any) {
    return { ok: false, latency: null, error: e.message?.slice(0, 100) }
  }
}
