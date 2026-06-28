// ─── 支付系统类型定义 ───

/** 支付渠道 */
export type PayMethod = 'wechat' | 'alipay'

/** 业务类型 */
export type OrderType = 'credit' | 'subscription'

/** 订单状态 */
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'expired'

/** 套餐类型（会员订阅） */
export type PlanType = 'monthly' | 'yearly' | 'enterprise'

/** 创建订单请求 */
export interface CreateOrderRequest {
  type: OrderType
  payMethod: PayMethod
  amount?: number          // 自定义金额（credit type）
  credits?: number         // 购买的积分数
  planType?: PlanType      // 订阅方案（subscription type）
  description?: string
}

/** 支付订单（数据库记录） */
export interface PaymentOrderRecord {
  id: string
  userId: string
  type: OrderType
  amount: number
  payMethod: PayMethod
  status: OrderStatus
  credits?: number           // 积分充值时的积分数
  planType?: PlanType         // 订阅方案
  periodStart?: Date
  periodEnd?: Date
  orderNo: string
  outTradeNo?: string         // 第三方支付单号
  prepayId?: string           // 微信预支付ID
  qrCode?: string             // 支付二维码URL
  payUrl?: string             // 支付宝支付链接
  rawNotify?: any              // 原始回调数据
  createdAt: Date
  paidAt?: Date
  expiredAt?: Date
}

/** 微信支付配置 */
export interface WechatPayConfig {
  mchId: string
  apiKey: string
  apiV3Key: string
  serialNo: string
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
  /** 创建支付单 */
  createOrder(order: PaymentOrderRecord): Promise<{
    prepayId?: string
    qrCode?: string
    payUrl?: string
    outTradeNo?: string
  }>
  /** 验证回调签名 */
  verifyNotify(payload: any): boolean
  /** 解析回调数据 */
  parseNotify(payload: any): {
    outTradeNo: string
    tradeNo: string
    amount: number
    paidAt: Date
    raw: any
  }
  /** 查询订单状态 */
  queryOrder(orderNo: string): Promise<{
    status: OrderStatus
    tradeNo?: string
    amount?: number
  }>
  /** 退款 */
  refund(orderNo: string, amount?: number): Promise<boolean>
}
