/**
 * DeepSeek 余额查询适配器
 */
export async function queryDeepSeekBalance(apiKey: string): Promise<{
  balance: number | null
  currency: string
  unit: string
  error?: string
}> {
  try {
    const res = await fetch('https://api.deepseek.com/user/balance', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) {
      return { balance: null, currency: 'CNY', unit: '元', error: `HTTP ${res.status}` }
    }
    const data = await res.json() as any
    if (!data.is_available) {
      return { balance: null, currency: 'CNY', unit: '元', error: '账户不可用' }
    }
    const cnyInfo = data.balance_infos?.find((b: any) => b.currency === 'CNY')
    if (cnyInfo) {
      return { balance: parseFloat(cnyInfo.total_balance), currency: 'CNY', unit: '元' }
    }
    return { balance: null, currency: 'CNY', unit: '元', error: '无余额信息' }
  } catch (err: any) {
    return { balance: null, currency: 'CNY', unit: '元', error: err.message }
  }
}
