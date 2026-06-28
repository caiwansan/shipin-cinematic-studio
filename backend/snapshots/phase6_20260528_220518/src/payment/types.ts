// ─── 支付系统类型定义（TypeScript源码版） ───

/** 支付渠道 */
export type PayMethod = 'wechat' | 'alipay'

/** 业务类型 */
export type OrderType = 'credit' | 'subscription'

/** 订单状态 */
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'expired'

/** 套餐类型 */
export type PlanType = 'monthly' | 'yearly' | 'enterprise'

/** 创建订单请求 */
export interface CreateOrderRequest {
  type: OrderType
  payMethod: PayMethod
  amount?: number
  credits?: number
  planType?: PlanType
  description?: string
}

/** 微信支付配置（从.env读取） */
export interface WechatPayConfig {
  mchId: string
  apiKey: string       // APIv2 key
  apiV3Key: string     // APIv3 key
  serialNo: string     // 证书序列号
  certPath?: string
  notifyUrl: string
}

/** 支付宝支付配置 */
export interface AlipayConfig {
  appId: string
  privateKey: string
  alipayPublicKey: string
  gateway: string
  notifyUrl: string
  returnUrl?: string
}

/** 支付提供商接口 */
export interface PaymentProvider {
  createOrder(order: any): Promise<{
    prepayId?: string
    qrCode?: string
    payUrl?: string
    outTradeNo?: string
  }>
  verifyNotify(payload: any): boolean
  parseNotify(payload: any): {
    outTradeNo: string
    tradeNo: string
    amount: number
    paidAt: Date
    raw: any
  }
  queryOrder(orderNo: string): Promise<{
    status: string
    tradeNo?: string
    amount?: number
  }>
  refund(orderNo: string, amount?: number): Promise<boolean>
}

/** 套餐定价 */
export const PLAN_PRICES: Record<PlanType, { price: number; days: number; label: string }> = {
  monthly: { price: 29.9, days: 30, label: '月度会员' },
  yearly: { price: 299, days: 365, label: '年度会员' },
  enterprise: { price: 999, days: 365, label: '企业版' },
}

/** 积分套餐 */
export const CREDIT_PLANS: { credits: number; price: number; label: string }[] = [
  { credits: 100, price: 10, label: '100积分' },
  { credits: 500, price: 50, label: '500积分' },
  { credits: 1000, price: 100, label: '1000积分' },
  { credits: 5000, price: 500, label: '5000积分' },
  { credits: 10000, price: 1000, label: '10000积分' },
]
