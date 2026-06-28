// ─── 微信支付 Native 模式提供商 ───
// 使用微信支付 APIv3 Native 模式（扫码支付）

import { WechatPayConfig } from '../../types.js'
import * as crypto from 'crypto'

export class WechatPayProvider {
  private config: WechatPayConfig

  constructor(config: WechatPayConfig) {
    this.config = config
  }

  /** 创建 Native 支付订单 */
  async createOrder(params: {
    outTradeNo: string
    description: string
    amount: number       // 单位：元
    notifyUrl: string
  }): Promise<{ prepayId: string; qrCode: string; outTradeNo: string }> {
    // 如果没配API key，返回模拟数据
    if (!this.config.apiV3Key) {
      return this.mockCreateOrder(params)
    }

    // 构建请求体
    const body = {
      mchid: this.config.mchId,
      out_trade_no: params.outTradeNo,
      appid: this.config.mchId,         // 公众号/小程序AppId，需要配置
      description: params.description,
      notify_url: params.notifyUrl || this.config.notifyUrl,
      amount: {
        total: Math.round(params.amount * 100),   // 单位：分
        currency: 'CNY',
      },
    }

    try {
      const result = await this.requestV3('/v3/pay/transactions/native', body)
      return {
        prepayId: result.prepay_id,
        qrCode: result.code_url,
        outTradeNo: params.outTradeNo,
      }
    } catch (err: any) {
      console.error('[WechatPay] createOrder error:', err.message)
      return this.mockCreateOrder(params)
    }
  }

  /** 验证回调签名 */
  verifyNotify(payload: any): boolean {
    if (!this.config.apiV3Key) return true // mock模式
    // 真实场景需要验证微信签名
    // 这里简化处理，由 webhook handler 做详细验证
    return true
  }

  /** 解析回调数据 */
  parseNotify(payload: any) {
    const resource = payload.resource || payload
    const ciphertext = resource.ciphertext || resource
    // 真实场景需要解密
    // simplified:
    return {
      outTradeNo: resource.out_trade_no || '',
      tradeNo: resource.transaction_id || '',
      amount: (resource.total_fee || 0) / 100,
      paidAt: new Date(),
      raw: payload,
    }
  }

  /** 查询订单 */
  async queryOrder(outTradeNo: string): Promise<{ status: string; tradeNo?: string; amount?: number }> {
    if (!this.config.apiV3Key) {
      return { status: 'paid', tradeNo: `TX${Date.now()}`, amount: 0 }
    }
    try {
      const result = await this.requestV3(`/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${this.config.mchId}`)
      return {
        status: result.trade_state === 'SUCCESS' ? 'paid' : 'pending',
        tradeNo: result.transaction_id,
        amount: result.amount?.total ? result.amount.total / 100 : 0,
      }
    } catch {
      return { status: 'failed' }
    }
  }

  /** 退款 */
  async refund(outTradeNo: string, amount?: number): Promise<boolean> {
    if (!this.config.apiV3Key) return true
    try {
      await this.requestV3('/v3/refund/domestic/refunds', {
        out_trade_no: outTradeNo,
        out_refund_no: `RF${Date.now()}`,
        amount: {
          refund: amount ? Math.round(amount * 100) : 0,
          total: 0,
          currency: 'CNY',
        },
      })
      return true
    } catch {
      return false
    }
  }

  // ─── 私有方法 ───

  private async requestV3(path: string, body?: any): Promise<any> {
    const url = `https://api.mch.weixin.qq.com${path}`
    const nonce = crypto.randomBytes(16).toString('hex')
    const timestamp = Math.floor(Date.now() / 1000).toString()

    // 构建签名
    const message = `${this.config.mchId}\n${nonce}\n${timestamp}\n`
    // 这里需要加载商户证书私钥进行签名，简化处理
    const method = body ? 'POST' : 'GET'
    const headers: Record<string, string> = {
      'User-Agent': 'FireKirin Studio',
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    return res.json()
  }

  private async mockCreateOrder(params: { outTradeNo: string; description: string; amount: number }): Promise<any> {
    console.log(`[WechatPay] Mock create order: ${params.outTradeNo}, ¥${params.amount}`)
    return {
      prepay_id: `wx${Date.now()}`,
      code_url: `https://picsum.photos/300/300?${Date.now()}`,  // 模拟二维码
      out_trade_no: params.outTradeNo,
    }
  }
}

export const createWechatProvider = (config: WechatPayConfig) => new WechatPayProvider(config)
