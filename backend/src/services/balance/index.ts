import { prisma } from '../../utils/index.js'
import { decryptKey } from '../crypto.service.js'
import { queryDeepSeekBalance } from './adapters/deepseek.adapter.js'

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 分钟

interface BalanceResult {
  provider: string
  label: string
  balance: number | null
  currency: string
  unit: string
  alert: boolean
  error?: string
  fetchedAt: string | null
}

/**
 * 获取用户所有已配置 Provider 的余额
 * 1. 从 UserModelConfigV2 找已配置的 Provider
 * 2. 查缓存，过期则调适配器刷新
 * 3. 返回余额 + 告警标记
 */
export async function getUserBalances(userId: string): Promise<{
  balances: BalanceResult[]
  alert: boolean
}> {
  const configs = await prisma.userModelConfigV2.findMany({
    where: { userId },
  })

  const results: BalanceResult[] = []
  let hasAlert = false

  for (const cfg of configs) {
    const provider = cfg.llmProvider
    if (!provider || !cfg.llmApiKey) continue

    // 查缓存
    let record = await prisma.providerBalanceRecord.findUnique({
      where: { userId_provider: { userId, provider } },
    })

    // 缓存有效则返回缓存
    if (record && record.fetchedAt && (Date.now() - record.fetchedAt.getTime()) < CACHE_TTL_MS) {
      const alert = record.balance !== null && record.balance < 3
      if (alert) hasAlert = true
      results.push({
        provider,
        label: getProviderLabel(provider),
        balance: record.balance,
        currency: record.currency || 'CNY',
        unit: record.unit || '元',
        alert,
        error: record.error || undefined,
        fetchedAt: record.fetchedAt.toISOString(),
      })
      continue
    }

    // 缓存过期 → 刷新
    const balanceResult = await fetchBalance(provider, cfg, userId)
    results.push(balanceResult)
    if (balanceResult.alert) hasAlert = true
  }

  return { balances: results, alert: hasAlert }
}

async function fetchBalance(
  provider: string,
  cfg: any,
  userId: string
): Promise<BalanceResult> {
  let balance: number | null = null
  let currency = 'CNY'
  let unit = '元'
  let error: string | undefined

  try {
    // 解密 API Key
    const apiKey = decryptKey(cfg.llmApiKey)

    switch (provider) {
      case 'deepseek': {
        const r = await queryDeepSeekBalance(apiKey)
        balance = r.balance
        currency = r.currency
        unit = r.unit
        error = r.error
        break
      }
      // 其他 Provider 后续添加
      default:
        error = '余额查询暂不支持此 Provider'
    }
  } catch (err: any) {
    error = err.message
  }

  // 写缓存
  await prisma.providerBalanceRecord.upsert({
    where: { userId_provider: { userId, provider } },
    create: { userId, provider, balance, currency, unit, error, fetchedAt: new Date() },
    update: { balance, currency, unit, error, fetchedAt: new Date() },
  })

  const alert = balance !== null && balance < 3
  return {
    provider,
    label: getProviderLabel(provider),
    balance,
    currency,
    unit,
    alert,
    error,
    fetchedAt: new Date().toISOString(),
  }
}

function getProviderLabel(provider: string): string {
  const labels: Record<string, string> = {
    deepseek: 'DeepSeek',
    volcengine: '火山引擎',
    bailian: '阿里百炼',
    zhipu: '智谱',
    minimax: 'MiniMax',
    openai: 'OpenAI',
    claude: 'Claude',
    gemini: 'Gemini',
  }
  return labels[provider] || provider
}
