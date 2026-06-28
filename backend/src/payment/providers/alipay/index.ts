// ─── 支付宝 PC/手机支付提供商 ───

import { AlipayConfig } from '../../types.js'
import * as crypto from 'crypto'

export class AlipayProvider {
  private config: AlipayConfig

  constructor(config: AlipayConfig) {
    this.config = config
  }

  /** 创建支付订单（PC网站支付 + 手机网站支付） */
  async createOrder(params: {
    outTradeNo: string
    description: string
    amount: number
    notifyUrl: string
    returnUrl?: string
  }): Promise<{ outTradeNo: string; payUrl: string; qrCode?: string }> {
    if (!this.config.privateKey) {
      return this.mockCreateOrder(params)
    }

    const bizContent = {
      out_trade_no: params.outTradeNo,
      total_amount: params.amount.toFixed(2),
      subject: params.description,
      product_code: 'FAST_INSTANT_TRADE_PAY',
    }

    const requestBody = this.buildRequest({
      method: 'alipay.trade.page.pay',
      biz_content: JSON.stringify(bizContent),
      notify_url: String(params.notifyUrl || this.config.notifyUrl),
      return_url: String(params.returnUrl || this.config.returnUrl),
    })

    // 返回支付链接（前端跳转）
    const payUrl = String(`${this.config.gateway}?${new URLSearchParams(requestBody).toString()}`)

    return {
      outTradeNo: params.outTradeNo,
      payUrl,
      qrCode: payUrl,
    }
  }

  /** 验证回调签名 */
  verifyNotify(payload: any): boolean {
    if (!this.config.privateKey) return true // mock模式
    // 验证支付宝回调签名
    const { sign, sign_type, ...params } = payload
    const sortedKeys = Object.keys(params).sort()
    const signStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&')
    // 用支付宝公钥验签
    try {
      const verifier = crypto.createVerify('RSA-SHA256')
      verifier.update(signStr, 'utf8')
      // crypto.verify 需要 PEM 格式，给纯 Base64 公钥加上头尾
      let publicKey = this.config.alipayPublicKey || ''
      if (publicKey && !publicKey.includes('-----BEGIN')) {
        publicKey = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`
      }
      return verifier.verify(publicKey, sign, 'base64')
    } catch {
      return false
    }
  }

  /** 解析回调 */
  parseNotify(payload: any) {
    return {
      outTradeNo: payload.out_trade_no || '',
      tradeNo: payload.trade_no || '',
      amount: parseFloat(payload.total_amount || '0'),
      paidAt: new Date(payload.gmt_payment || Date.now()),
      raw: payload,
    }
  }

  /** 查询订单 */
  async queryOrder(outTradeNo: string): Promise<{ status: string; tradeNo?: string; amount?: number }> {
    if (!this.config.privateKey) {
      return { status: 'paid', tradeNo: `AL${Date.now()}`, amount: 0 }
    }
    try {
      const body = this.buildRequest({
        method: 'alipay.trade.query',
        biz_content: JSON.stringify({ out_trade_no: outTradeNo }),
      })
      const res = await fetch(this.config.gateway, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body),
      })
      const data = await res.text()
      const params = new URLSearchParams(data)
      const response = Object.fromEntries(params)
      const tradeStatus = response.trade_status
      return {
        status: tradeStatus === 'TRADE_SUCCESS' ? 'paid' : 'pending',
        tradeNo: response.trade_no,
        amount: parseFloat(response.total_amount || '0'),
      }
    } catch {
      return { status: 'failed' }
    }
  }

  /** 退款 */
  async refund(outTradeNo: string, amount?: number): Promise<boolean> {
    if (!this.config.privateKey) return true
    try {
      const body = this.buildRequest({
        method: 'alipay.trade.refund',
        biz_content: JSON.stringify({
          out_trade_no: outTradeNo,
          refund_amount: amount?.toFixed(2),
        }),
      })
      const res = await fetch(this.config.gateway, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body),
      })
      return res.ok
    } catch {
      return false
    }
  }

  // ─── 私有方法 ───

  private buildRequest(params: Record<string, string>): Record<string, string> {
    const common = {
      app_id: this.config.appId,
      method: params.method,
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().replace(/T/, ' ').replace(/\.\d+Z/, ''),
      version: '1.0',
      biz_content: params.biz_content || '{}',
    }

    if (params.notify_url) (common as any).notify_url = params.notify_url
    if (params.return_url) (common as any).return_url = params.return_url

    // 生成签名
    const signStr = Object.keys(common)
      .sort()
      .map(k => `${k}=${(common as any)[k]}`)
      .join('&')

    const sign = crypto.createSign('RSA-SHA256')
    sign.update(signStr, 'utf8')
    const signature = sign.sign(this.config.privateKey, 'base64')

    return { ...common, sign: signature }
  }

  private async mockCreateOrder(params: any): Promise<any> {
    console.log(`[Alipay] Mock create order: ${params.outTradeNo}, ¥${params.amount}`)
    return {
      outTradeNo: params.outTradeNo,
      payUrl: `https://picsum.photos/300/300?alipay=${Date.now()}`,
      qrCode: `https://picsum.photos/300/300?alipay=${Date.now()}`,
    }
  }
}

export const createAlipayProvider = (config: AlipayConfig) => new AlipayProvider(config)
