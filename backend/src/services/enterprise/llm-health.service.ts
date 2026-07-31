/**
 * services/enterprise/llm-health.service.ts — Sprint-RECRUITMENT-REALITY-04 T01
 *
 * Model Health Center — 企业 LLM Key 健康治理
 *
 * 解决的问题（P0）：
 *  14 个 enterpriseLlmConfig 中 12 个在服务器上无法解密（CRYPTO_ENCRYPTION_KEY 曾变更）
 *  → 客户购买 AI 员工后，员工启动即 LLM 失败 → 商业风险最高
 *
 * 本服务提供：
 *  - testLlmConfig(id): 解密 → 真实调用 provider（1 token）→ 记录 状态/延迟/错误
 *  - testAllConfigs(): 全量健康检查（串行，避免并发打爆 provider）
 *
 * 安全：
 *  - API Key 只存在于内存，绝不进入日志/错误/响应
 *  - 错误信息截断，不包含 Authorization 内容
 */

import { prisma } from '../../utils/index.js'
import { decryptKey } from '../crypto.service.js'

export type HealthStatus = 'untested' | 'ok' | 'failed' | 'decrypt_error' | 'disabled'

const PING_TIMEOUT_MS = 15000
const MAX_ERROR_LEN = 300

interface PingResult {
  ok: boolean
  latencyMs: number
  error?: string
}

/**
 * 真实调用 provider 的 1-token 请求，验证 key 可用性
 */
async function pingProvider(config: {
  provider: string
  modelName: string
  baseUrl?: string | null
  apiKey: string
}): Promise<PingResult> {
  const { provider, modelName, apiKey } = config
  const base = (config.baseUrl || '').trim().replace(/\/+$/, '')

  let url: string
  if (base) {
    url = `${base}/chat/completions`
  } else if (provider.toLowerCase().includes('deepseek')) {
    url = 'https://api.deepseek.com/chat/completions'
  } else if (provider.toLowerCase().includes('openai')) {
    url = 'https://api.openai.com/v1/chat/completions'
  } else {
    return { ok: false, latencyMs: 0, error: `未知 provider: ${provider}（需配置 baseUrl）` }
  }

  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    })
    const latencyMs = Date.now() - startedAt

    if (res.ok) {
      return { ok: true, latencyMs }
    }
    // 读取错误体（截断；OpenAI/DeepSeek 错误体不含 key）
    let detail = ''
    try {
      const body: any = await res.json()
      detail = body?.error?.message || body?.message || JSON.stringify(body).slice(0, 120)
    } catch {
      detail = (await res.text()).slice(0, 120)
    }
    const authHint = res.status === 401 ? ' [认证失败: key 无效或已过期]'
      : res.status === 429 ? ' [限流: 配额不足或频率超限]'
      : res.status === 402 ? ' [余额不足]'
      : res.status === 404 ? ' [模型不存在或 URL 错误]' : ''
    return { ok: false, latencyMs, error: `HTTP ${res.status}${authHint} ${detail}`.slice(0, MAX_ERROR_LEN) }
  } catch (err: any) {
    const latencyMs = Date.now() - startedAt
    const msg = err?.name === 'AbortError' ? `超时（>${PING_TIMEOUT_MS / 1000}s）` : (err?.message || String(err))
    return { ok: false, latencyMs, error: msg.slice(0, MAX_ERROR_LEN) }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 测试单个企业 LLM 配置
 * 返回最新健康状态（不含 key）
 */
export async function testLlmConfig(configId: string) {
  const config: any = await prisma.enterpriseLlmConfig.findUnique({ where: { id: configId } })
  if (!config) throw new Error('LLM 配置不存在')

  // 已停用的配置：标记 disabled，不测试
  if (!config.enabled) {
    await prisma.enterpriseLlmConfig.update({
      where: { id: configId },
      data: { healthStatus: 'disabled', lastHealthCheckAt: new Date(), healthLatencyMs: null, healthError: '配置已停用，未测试' },
    })
    return { id: configId, healthStatus: 'disabled' as HealthStatus }
  }

  // 解密 key —— 失败 = 商业致命问题（key 无法使用）
  let apiKey: string
  try {
    apiKey = decryptKey(config.encryptedApiKey)
    if (!apiKey || apiKey.length < 10) {
      throw new Error('key 长度异常（疑似测试占位 key）')
    }
  } catch (e: any) {
    const errMsg = e?.message || String(e)
    await prisma.enterpriseLlmConfig.update({
      where: { id: configId },
      data: {
        healthStatus: 'decrypt_error',
        lastHealthCheckAt: new Date(),
        healthLatencyMs: null,
        healthError: `密钥解密失败: ${errMsg.slice(0, 150)}（CRYPTO_ENCRYPTION_KEY 可能变更，需重新配置 key）`,
      },
    })
    return { id: configId, healthStatus: 'decrypt_error' as HealthStatus, healthError: '密钥解密失败' }
  }

  // 真实调用 provider
  const result = await pingProvider({
    provider: config.provider,
    modelName: config.modelName,
    baseUrl: config.baseUrl,
    apiKey,
  })

  const healthStatus: HealthStatus = result.ok ? 'ok' : 'failed'
  await prisma.enterpriseLlmConfig.update({
    where: { id: configId },
    data: {
      healthStatus,
      lastHealthCheckAt: new Date(),
      healthLatencyMs: result.ok ? result.latencyMs : null,
      healthError: result.ok ? null : result.error,
    },
  })

  return { id: configId, healthStatus, healthLatencyMs: result.ok ? result.latencyMs : null, healthError: result.error }
}

/**
 * 全量健康检查（串行执行，避免并发打爆 provider / 触发限流）
 * 返回汇总 { total, ok, failed, decryptError, disabled }
 */
export async function testAllConfigs() {
  const configs: any[] = await prisma.enterpriseLlmConfig.findMany({ orderBy: { updatedAt: 'desc' } })
  const results = []
  for (const c of configs) {
    results.push(await testLlmConfig(c.id))
  }
  const summary = {
    total: results.length,
    ok: results.filter((r) => r.healthStatus === 'ok').length,
    failed: results.filter((r) => r.healthStatus === 'failed').length,
    decryptError: results.filter((r) => r.healthStatus === 'decrypt_error').length,
    disabled: results.filter((r) => r.healthStatus === 'disabled').length,
    untested: results.filter((r) => r.healthStatus === 'untested').length,
  }
  return { summary, results }
}

/**
 * 只读健康列表（Admin 展示用，绝不返回 key 或密文）
 */
export async function listLlmHealth() {
  const configs: any[] = await prisma.enterpriseLlmConfig.findMany({ orderBy: { updatedAt: 'desc' } })
  return configs.map((c) => ({
    id: c.id,
    tenantId: c.tenantId,
    provider: c.provider,
    modelName: c.modelName,
    baseUrl: c.baseUrl,
    credentialOwner: c.credentialOwner,
    maxTokensPerDay: c.maxTokensPerDay,
    maxRequestsPerMinute: c.maxRequestsPerMinute,
    enabled: c.enabled,
    status: c.status,
    healthStatus: c.healthStatus,
    healthLatencyMs: c.healthLatencyMs,
    healthError: c.healthError,
    lastHealthCheckAt: c.lastHealthCheckAt,
    updatedAt: c.updatedAt,
    // 安全提示：有 key 密文但可能解不开
    keyPresent: !!c.encryptedApiKey,
  }))
}

// ─────────────────────────────────────────────────────────────
// Sprint-06 T03: 模型异常待办（一键修复入口）
//  - listHealthIssues: 只列需要处理的异常配置 + 企业名 + 建议操作
//  - 通知渠道（邮件/站内信/微信）待定；当前 = 健康中心横幅 + 日报 healthIssues + 审计日志
// ─────────────────────────────────────────────────────────────

export async function listHealthIssues() {
  const configs: any[] = await prisma.enterpriseLlmConfig.findMany({
    where: { healthStatus: { in: ['failed', 'decrypt_error', 'disabled'] } },
    orderBy: { updatedAt: 'desc' },
  })
  const issues = await Promise.all(configs.map(async (c) => {
    // 企业名：tenantId → Organization（tenantId 可能是组织名/ID，尽力匹配）
    let orgName: string | null = null
    try {
      const org: any = await prisma.organization.findFirst({ where: { OR: [{ id: c.tenantId }, { name: c.tenantId }] }, select: { name: true } })
      orgName = org?.name || null
    } catch { /* 忽略 */ }
    const suggestion = c.healthStatus === 'decrypt_error'
      ? '密钥解密失败：请在企业工作台重新配置模型密钥'
      : c.healthStatus === 'disabled'
        ? '配置已停用：请在企业工作台启用'
        : '模型连接失败：请检查密钥/余额/网络后重测'
    return {
      id: c.id,
      tenantId: c.tenantId,
      orgName,
      provider: c.provider,
      modelName: c.modelName,
      healthStatus: c.healthStatus,
      healthError: c.healthError,
      lastHealthCheckAt: c.lastHealthCheckAt,
      updatedAt: c.updatedAt,
      keyPresent: !!c.encryptedApiKey,
      suggestion,
    }
  }))
  return {
    total: issues.length,
    issues,
  }
}
