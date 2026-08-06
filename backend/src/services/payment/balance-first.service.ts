/**
 * balance-first.service.ts — PAYMENT-BALANCE-FIRST-01 余额优先支付
 *
 * 掌柜 2026-08-06 指令：所有付款（VIP/订阅套餐、充值钻石、商城购物）先扣账户余额；
 * 余额不足以支付时，差额走微信/支付宝（余额部分在外部支付成功回调后扣除）。
 *
 * 用法：
 *   const ev = await evaluateBalanceFirst(userId, amount)
 *   ev.mode === 'wallet'  → completeWalletPayment(orderId, userId, amount) 直接完成
 *   ev.mode === 'external' → 订单记录 walletPaid=ev.walletPaid，外部只付 ev.externalAmount，
 *                            回调成功 → settleWalletDeduction(order)
 */
import { prisma } from '../../utils/index.js'

/** 余额优先评估：余额 >= 应付 → 全余额支付；否则余额抵扣 + 外部支付差额 */
export async function evaluateBalanceFirst(userId: string, amount: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true } })
  const balance = user?.walletBalance || 0
  const total = Math.round(amount * 100) / 100
  if (balance >= total) {
    return { mode: 'wallet' as const, walletPaid: total, externalAmount: 0, balance }
  }
  return {
    mode: 'external' as const,
    walletPaid: Math.round(balance * 100) / 100,
    externalAmount: Math.round((total - balance) * 100) / 100,
    balance,
  }
}

/** 余额直接支付完成：扣余额 + 订单标记 paid（返回是否成功；并发下余额被花掉则失败） */
export async function completeWalletPayment(orderId: string, userId: string, walletPaid: number) {
  try {
    const updated = await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "wallet_balance" = "wallet_balance" - $1 WHERE id = $2::uuid AND "wallet_balance" >= $1`,
      walletPaid, userId
    )
    if (updated === 0) return false
    await prisma.paymentOrder.update({
      where: { id: orderId },
      data: { status: 'paid', payTime: new Date(), method: 'wallet' },
    })
    return true
  } catch {
    return false
  }
}

/** 差额支付回调成功后：扣除订单记录的余额抵扣部分（并发安全，扣到 0 为止） */
export async function settleWalletDeduction(payOrder: { id: string; userId: string; walletPaid?: number | null }) {
  const walletPaid = Number(payOrder.walletPaid || 0)
  if (walletPaid <= 0) return
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "wallet_balance" = GREATEST("wallet_balance" - $1, 0) WHERE id = $2::uuid AND "wallet_balance" > 0`,
      walletPaid, payOrder.userId
    )
    console.log(`[balance-first] 订单 ${payOrder.id} 差额支付成功，扣除余额 ¥${walletPaid}`)
  } catch (err: any) {
    console.error('[balance-first] 扣余额失败:', err.message)
  }
}

/** 充值到账：发钻石 + 记流水（余额支付与外部回调共用） */
export async function grantRechargeCoins(payOrder: any, tradeNo: string, payTime: Date, methodLabel: string) {
  const coins = payOrder.coins || 0
  if (coins <= 0) return
  await prisma.membership.upsert({
    where: { userId: payOrder.userId },
    create: { userId: payOrder.userId, credits: coins },
    update: { credits: { increment: coins } },
  }).catch((e: any) => console.error('[recharge] membership upsert 失败:', e.message))
  await prisma.coinLog.create({
    data: {
      userId: payOrder.userId,
      amount: coins,
      type: 'recharge',
      remark: `充值 ${coins} 钻石 (¥${payOrder.amount}，${methodLabel})`,
      relatedId: payOrder.id,
    },
  }).catch((e: any) => console.error('[recharge] coinLog 失败:', e.message))
  console.log(`[recharge] 订单 ${payOrder.orderNo} 到账 ${coins} 钻石 (tradeNo=${tradeNo})`)
}
