import { prisma } from '../../utils/index.js'
import { credentialResolver } from '../credential/credential-resolver'
import { vaultService } from '../credential/vault-service'
import { queryDeepSeekBalance } from './adapters/deepseek.adapter.js'

const CACHE_TTL_MS = 5 * 60 * 1000

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

export async function getUserBalances(userId: string): Promise<{
  balances: BalanceResult[]
  alert: boolean
}> {
  const resolved = await credentialResolver.resolve({ ownerType: 'user', ownerId: userId, capability: 'text-generation' })
  if (!resolved) return { balances: [], alert: false }

  const results: BalanceResult[] = []
  let hasAlert = false

  try {
    const decrypted = await vaultService.getDecryptedCredential(resolved.credentialId)
    if (decrypted) {
      let record = await prisma.providerBalanceRecord.findUnique({
        where: { userId_provider: { userId, provider: resolved.providerCapability.vendor } },
      })

      if (record && record.fetchedAt && (Date.now() - record.fetchedAt.getTime()) < CACHE_TTL_MS) {
        const alert = record.balance !== null && record.balance < 3
        if (alert) hasAlert = true
        results.push({
          provider: resolved.providerCapability.vendor,
          label: getProviderLabel(resolved.providerCapability.vendor),
          balance: record.balance,
          currency: record.currency || 'CNY',
          unit: record.unit || '元',
          alert,
          error: record.error || undefined,
          fetchedAt: record.fetchedAt.toISOString(),
        })
      } else {
        const balanceResult = await fetchBalance(resolved.providerCapability.vendor, decrypted.apiKey, userId)
        results.push(balanceResult)
        if (balanceResult.alert) hasAlert = true
      }
    }
  } catch (err: any) {
    // ignore
  }

  return { balances: results, alert: hasAlert }
}

async function fetchBalance(provider: string, apiKey: *** userId: string): Promise<BalanceResult> {
  let balance: number | null = null
  let currency = 'CNY'
  let unit = '元'
  let error: string | undefined

  try {
    switch (provider) {
      case 'deepseek': {
        const r = await queryDeepSeekBalance(apiKey)
        balance = r.balance
        currency = r.currency
        unit = r.unit
        error = r.error
        break
      }
      default:
        error = '余额查询暂不支持此 Provider'
    }
  } catch (err: any) {
    error = err.message
  }

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
