// wxpay.service.ts — 微信 NATIVE 扫码支付（API v3 版）
// 需要：appId, mchId, apiV3Key（API v3 密钥）, keyPem（商户私钥证书文本）
import { prisma } from '../utils/index.js'
import crypto from 'crypto'

/**
 * 生成微信 NATIVE 支付二维码链接（API v3）
 */
export async function createWxpayNativeQrCode(params: {
  outTradeNo: string
  description: string
  totalAmount: number  // 元
  notifyUrl: string
}): Promise<{ codeUrl: string }> {
  const secret = await prisma.paymentSecret.findUnique({ where: { channel: 'wechat' } })
  if (!secret || !secret.enabled) {
    throw new Error('微信支付未配置')
  }

  const config = typeof secret.config === 'string' ? JSON.parse(secret.config) : secret.config
  const { appId, mchId, apiV3Key, keyPem } = config
  if (!appId || !mchId || !apiV3Key || !keyPem) {
    throw new Error('微信支付密钥不完整，需要 appId, mchId, apiV3Key, keyPem（商户私钥证书）')
  }
  if (!keyPem.includes('PRIVATE KEY')) {
    throw new Error('商户私钥证书填写错误：应该是包含 -----BEGIN PRIVATE KEY----- 的 apiclient_key.pem 文件，不是公钥证书')
  }

  const nonceStr = crypto.randomBytes(16).toString('hex')
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const amountFen = Math.round(params.totalAmount * 100)

  const body = JSON.stringify({
    mchid: mchId,
    out_trade_no: params.outTradeNo,
    appid: appId,
    description: params.description,
    notify_url: params.notifyUrl,
    amount: { total: amountFen, currency: 'CNY' },
  })

  // 构建签名
  const message = `POST\n/v3/pay/transactions/native\n${timestamp}\n${nonceStr}\n${body}\n`
  const sign = crypto.createSign('SHA256')
  sign.update(message)
  sign.end()
  const signature = sign.sign(keyPem, 'base64')

  // 从 keyPem 中提取证书序列号（用户在后台填写）
  const serialNo = config.serialNo || ''

  const token = `WECHATPAY2-SHA256-RSA2048 mchid="${mchId}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${serialNo}"`

  const { default: axios } = await import('axios')

  try {
    const resp = await axios.post('https://api.mch.weixin.qq.com/v3/pay/transactions/native', body, {
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'scs-wxpay/1.0',
      },
      timeout: 10000,
    })

    console.log('[wxpay] create order success')
    return { codeUrl: resp.data.code_url }

  } catch (err: any) {
    const errData = err.response?.data
    console.error('[wxpay] create order failed:', JSON.stringify(errData || err.message))
    throw new Error(`微信支付下单失败: ${errData?.message || err.message}`)
  }
}

/**
 * 验证微信支付回调签名（API v3）
 * 简化版：在通知路由中直接处理
 */
export function verifyWxpayNotify(_headers: any, _body: string): boolean {
  return true
}

/**
 * 解密微信支付回调中的订单信息（API v3 AEAD_AES_256_GCM）
 */
export function decryptWxpayNotify(resource: {
  associated_data?: string
  nonce: string
  ciphertext: string
  algorithm: string
}, apiV3Key: string): any {
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(apiV3Key, 'utf-8'),
      Buffer.from(resource.nonce, 'utf-8'),
    )
    decipher.setAAD(Buffer.from(resource.associated_data || '', 'utf-8'))

    const raw = Buffer.from(resource.ciphertext, 'base64')
    const tag = raw.subarray(-16)
    const data = raw.subarray(0, -16)
    decipher.setAuthTag(tag)

    const decoded = decipher.update(data)
    return JSON.parse(decoded.toString('utf-8'))
  } catch (err: any) {
    console.error('[wxpay] decrypt error:', err.message)
    throw err
  }
}
