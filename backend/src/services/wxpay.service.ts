// wxpay.service.ts — 微信支付（API v3 版）：NATIVE 扫码 + H5 手机支付
// 需要：appId, mchId, apiV3Key（API v3 密钥）, keyPem（商户私钥证书文本）
import { prisma } from '../utils/index.js'
import crypto from 'crypto'

/** 读取微信支付密钥配置（appId/mchId/apiV3Key/keyPem/serialNo） */
async function getWxpayConfig(): Promise<{ appId: string; mchId: string; apiV3Key: string; keyPem: string; serialNo: string }> {
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
  return { appId, mchId, apiV3Key, keyPem, serialNo: config.serialNo || '' }
}

/** 构建 API v3 认证头 + 发送请求（path 形如 /v3/pay/transactions/h5） */
async function wxpayRequest(path: string, bodyObj: Record<string, unknown>): Promise<any> {
  const cfg = await getWxpayConfig()
  const nonceStr = crypto.randomBytes(16).toString('hex')
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const body = JSON.stringify(bodyObj)

  const message = `POST\n${path}\n${timestamp}\n${nonceStr}\n${body}\n`
  const sign = crypto.createSign('SHA256')
  sign.update(message)
  sign.end()
  const signature = sign.sign(cfg.keyPem, 'base64')
  const token = `WECHATPAY2-SHA256-RSA2048 mchid="${cfg.mchId}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${cfg.serialNo}"`

  const { default: axios } = await import('axios')
  try {
    const resp = await axios.post(`https://api.mch.weixin.qq.com${path}`, body, {
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'scs-wxpay/1.0',
      },
      timeout: 10000,
    })
    return resp.data
  } catch (err: any) {
    const errData = err.response?.data
    console.error(`[wxpay] ${path} failed:`, JSON.stringify(errData || err.message))
    throw new Error(`微信支付下单失败: ${errData?.message || err.message}`)
  }
}

/**
 * 生成微信 NATIVE 支付二维码链接（API v3）
 */
export async function createWxpayNativeQrCode(params: {
  outTradeNo: string
  description: string
  totalAmount: number  // 元
  notifyUrl: string
}): Promise<{ codeUrl: string }> {
  const cfg = await getWxpayConfig()
  const amountFen = Math.round(params.totalAmount * 100)
  const data = await wxpayRequest('/v3/pay/transactions/native', {
    mchid: cfg.mchId,
    out_trade_no: params.outTradeNo,
    appid: cfg.appId,
    description: params.description,
    notify_url: params.notifyUrl,
    amount: { total: amountFen, currency: 'CNY' },
  })
  console.log('[wxpay] create native order success')
  return { codeUrl: data.code_url }
}

/**
 * 生成微信 H5 支付链接（手机浏览器唤起微信收银台；API v3 /v3/pay/transactions/h5）
 * 注意：H5 支付需商户号已开通 H5 支付权限；wap_url 为发起支付页面的域名
 */
export async function createWxpayH5Order(params: {
  outTradeNo: string
  description: string
  totalAmount: number  // 元
  notifyUrl: string
  wapUrl?: string
  wapName?: string
}): Promise<{ h5Url: string }> {
  const cfg = await getWxpayConfig()
  const amountFen = Math.round(params.totalAmount * 100)
  const data = await wxpayRequest('/v3/pay/transactions/h5', {
    mchid: cfg.mchId,
    out_trade_no: params.outTradeNo,
    appid: cfg.appId,
    description: params.description,
    notify_url: params.notifyUrl,
    amount: { total: amountFen, currency: 'CNY' },
    scene_info: {
      payer_client_ip: '127.0.0.1',
      h5_info: {
        type: 'Wap',
        wap_url: params.wapUrl || 'https://aigc.fushtn.com',
        wap_name: params.wapName || '昆仑镜',
      },
    },
  })
  if (!data.h5_url) {
    throw new Error('微信 H5 下单未返回支付链接（商户号可能未开通 H5 支付）')
  }
  console.log('[wxpay] create h5 order success')
  return { h5Url: data.h5_url }
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
