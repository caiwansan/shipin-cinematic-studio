// ─── Alipay 支付服务 ───
// 使用 alipay-sdk 生成当面付二维码
// 支付宝秘钥信息从 PaymentSecret 表读取，禁止硬编码

import { prisma } from '../utils/index.js'

const AlipaySdk = require('alipay-sdk')

let sdkInstance: any = null

/** 从数据库读取支付宝配置并初始化 SDK */
async function getAlipaySdk(): Promise<any> {
  if (sdkInstance) return sdkInstance

  const secret = await prisma.paymentSecret.findUnique({ where: { channel: 'alipay' } })
  if (!secret || !secret.enabled) {
    throw new Error('支付宝支付未启用，请在后台配置支付宝密钥')
  }

  const config = (typeof secret.config === 'string' ? JSON.parse(secret.config) : secret.config) || {}
  if (!config.appId || !config.privateKey || !config.publicKey) {
    throw new Error('支付宝密钥配置不完整，缺少 appId/privateKey/publicKey')
  }

  sdkInstance = new AlipaySdk.AlipaySdk({
    appId: config.appId,
    privateKey: config.privateKey,
    alipayPublicKey: config.publicKey,
    gateway: 'https://openapi.alipay.com/gateway.do',
    charset: 'utf-8',
    signType: 'RSA2',
  })

  return sdkInstance
}

/** 清除 SDK 缓存（配置更新后调用） */
export function clearAlipaySdkCache(): void {
  sdkInstance = null
}

/** 生成支付宝电脑网站支付跳转 URL（alipay.trade.page.pay） */
export async function createAlipayPagePayUrl(params: {
  outTradeNo: string
  subject: string
  totalAmount: number
  returnUrl?: string       // 支付成功后跳回
  notifyUrl?: string       // 异步回调地址
}): Promise<{ payUrl: string; tradeNo: string }> {
  const sdk = await getAlipaySdk()

  const bizContent = {
    out_trade_no: params.outTradeNo,
    product_code: 'FAST_INSTANT_TRADE_PAY',
    subject: params.subject,
    total_amount: params.totalAmount.toFixed(2),
    qr_pay_mode: '4',            // 4=跳转模式，不展示二维码
  }

  const result = await sdk.exec('alipay.trade.page.pay', {
    bizContent,
    returnUrl: params.returnUrl || '',
    notifyUrl: params.notifyUrl || '',
  })

  // 电脑网站支付成功返回的是支付页面 URL（在 result 中）
  if (typeof result === 'string') {
    return { payUrl: result, tradeNo: params.outTradeNo }
  }

  const response = result?.alipay_trade_page_pay_response
  if (!response) {
    throw new Error(`支付宝电脑网站支付下单失败: ${JSON.stringify(result)}`)
  }
  if (response.code && response.code !== '10000') {
    throw new Error(`支付宝返回错误: ${response.sub_msg || response.msg || response.code}`)
  }

  return { payUrl: result?.payUrl || result?.body || '', tradeNo: response.out_trade_no || params.outTradeNo }
}

/** 生成支付宝当面付二维码 */
export async function createAlipayQrCode(params: {
  outTradeNo: string
  subject: string
  totalAmount: number
}): Promise<{ qrCode: string; tradeNo: string }> {
  const sdk = await getAlipaySdk()

  const bizContent = {
    out_trade_no: params.outTradeNo,
    product_code: 'FACE_TO_FACE_PAYMENT',
    subject: params.subject,
    total_amount: params.totalAmount.toFixed(2),
    qr_code_timeout_express: '30m',
  }

  const result = await sdk.exec('alipay.trade.precreate', {
    bizContent,
  })

  // 解析结果
  const response = result?.alipay_trade_precreate_response
  if (!response) {
    throw new Error(`支付宝预创建订单失败: ${JSON.stringify(result)}`)
  }
  if (response.code !== '10000') {
    throw new Error(`支付宝返回错误: ${response.sub_msg || response.msg || response.code}`)
  }

  return { qrCode: response.qr_code || '', tradeNo: response.out_trade_no || params.outTradeNo }
}

/** 查询支付宝订单状态 */
export async function queryAlipayOrder(outTradeNo: string): Promise<{
  tradeStatus: string
  tradeNo: string
  buyerPayAmount: string
}> {
  const sdk = await getAlipaySdk()
  const bizContent = { out_trade_no: outTradeNo }

  const result = await sdk.exec('alipay.trade.query', { bizContent })
  const response = result?.alipay_trade_query_response
  if (!response) {
    throw new Error(`支付宝订单查询失败: ${JSON.stringify(result)}`)
  }

  return {
    tradeStatus: response.trade_status || '',
    tradeNo: response.trade_no || '',
    buyerPayAmount: response.buyer_pay_amount || '0',
  }
}
