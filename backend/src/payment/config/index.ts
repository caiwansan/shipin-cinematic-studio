// ─── 支付配置读取（从数据库 PaymentSecret 读取） ───
// 管理员在后台填写微信/支付宝配置，存到 PaymentSecret 表
// 这里提供读取方法

import { prisma } from '../../utils/index.js'
import { WechatPayConfig, AlipayConfig } from '../types.js'

/** 从数据库读取微信支付配置 */
export async function getWechatConfig(): Promise<WechatPayConfig | null> {
  const record = await prisma.paymentSecret.findUnique({ where: { channel: 'wechat' } })
  if (!record || !record.enabled) return null
  try {
    const conf = JSON.parse(record.config)
    return {
      mchId: conf.mchId || '',
      apiKey: conf.apiKey || '',
      apiV3Key: conf.apiV3Key || '',
      serialNo: conf.serialNo || '',
      certPath: conf.certPath || undefined,
      notifyUrl: conf.notifyUrl || 'https://aigc.fushtn.com/api/payment/wechat/notify',
    }
  } catch {
    return null
  }
}

/** 从数据库读取支付宝支付配置 */
export async function getAlipayConfig(): Promise<AlipayConfig | null> {
  const record = await prisma.paymentSecret.findUnique({ where: { channel: 'alipay' } })
  if (!record || !record.enabled) return null
  try {
    const conf = JSON.parse(record.config)
    return {
      appId: conf.appId || '',
      privateKey: conf.privateKey || '',
      alipayPublicKey: conf.alipayPublicKey || '',
      gateway: conf.gateway || 'https://openapi.alipay.com/gateway.do',
      notifyUrl: conf.notifyUrl || 'https://aigc.fushtn.com/api/payment/alipay/notify',
      returnUrl: conf.returnUrl || 'https://aigc.fushtn.com/user/credits',
    }
  } catch {
    return null
  }
}

/** 查询各支付渠道是否已配置 */
export async function isPaymentConfigured(): Promise<{ wechat: boolean; alipay: boolean }> {
  const records = await prisma.paymentSecret.findMany({
    where: { enabled: true },
    select: { channel: true },
  })
  return {
    wechat: records.some(r => r.channel === 'wechat'),
    alipay: records.some(r => r.channel === 'alipay'),
  }
}
