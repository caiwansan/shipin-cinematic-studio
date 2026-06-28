// alipay.service.ts — 支付宝扫码支付（当面付 alipay.trade.precreate）
import { prisma } from '../utils/index.js'

/**
 * 生成支付宝扫码支付二维码（当面付）
 * 调 alipay.trade.precreate API，返回二维码字符串
 */
export async function createAlipayPagePayUrl(params: {
  outTradeNo: string
  subject: string
  totalAmount: number
  returnUrl: string
  notifyUrl: string
}): Promise<{ payUrl: string; qrCode?: string }> {
  const secret = await prisma.paymentSecret.findUnique({ where: { channel: 'alipay' } })
  if (!secret || !secret.enabled) {
    throw new Error('支付宝未配置')
  }

  const config = typeof secret.config === 'string' ? JSON.parse(secret.config) : secret.config
  const appId = config.appId
  const privateKey = config.privateKey

  if (!appId || !privateKey) {
    throw new Error('支付宝密钥不完整')
  }

  const { AlipaySdk } = await import('alipay-sdk')
  const sdk = new AlipaySdk({
    appId,
    privateKey,
    gateway: 'https://openapi.alipay.com/gateway.do',
  })

  try {
    // 当面付 precreate：实际发 HTTP 请求到支付宝，返回 qr_code
    const result = await sdk.exec('alipay.trade.precreate', {
      bizContent: {
        out_trade_no: params.outTradeNo,
        total_amount: params.totalAmount.toFixed(2),
        subject: params.subject,
      },
      notifyUrl: params.notifyUrl,
    })
    const resp = result.alipay_trade_precreate_response
    if (resp?.code === '10000' && resp?.qr_code) {
      return { payUrl: '', qrCode: resp.qr_code }
    }
    // precreate 失败，回退到 page.pay（跳转支付）
    console.warn('[alipay] precreate failed, fallback to page.pay:', resp?.sub_msg || resp?.msg)
    return fallbackToPagePay(sdk, params)
  } catch (err: any) {
    console.warn('[alipay] precreate error, fallback to page.pay:', err.message)
    return fallbackToPagePay(sdk, params)
  }
}

/**
 * 备用方案：支付宝电脑网站支付（跳转收银台）
 */
async function fallbackToPagePay(sdk: any, params: {
  outTradeNo: string
  subject: string
  totalAmount: number
  returnUrl: string
  notifyUrl: string
}): Promise<{ payUrl: string }> {
  const queryString = sdk.sdkExecute('alipay.trade.page.pay', {
    bizContent: {
      out_trade_no: params.outTradeNo,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      total_amount: params.totalAmount.toFixed(2),
      subject: params.subject,
    },
    notifyUrl: params.notifyUrl,
    returnUrl: params.returnUrl,
  })
  const payUrl = `${sdk.config.gateway}?${queryString}`
  return { payUrl }
}
