/**
 * VIP 补账/激活脚本（临时任务：用户购买 VIP 等级不变化）
 * 背景：微信支付回调解密失败（apiV3Key 31 位 ≠ 32 位）→ 真实付款订单卡 pending → 等级未激活
 * 用法：
 *   npx tsx scripts/vip-activate-fix.ts --orderNo VIP1785841392306LO4V9E   # 激活指定订单
 *   npx tsx scripts/vip-activate-fix.ts --user email@example.com          # 激活该用户所有 pending VIP 订单
 *   npx tsx scripts/vip-activate-fix.ts --all-pending                      # 列出所有 pending VIP 订单（不激活）
 * 激活动作 = 同回调逻辑：PaymentOrder → paid + provisionFromPayment（Commerce Authority 唯一入口）
 */
import { PrismaClient } from '@prisma/client'
import { provisionFromPayment } from '../src/services/commerce/commerce-provision.service.js'

const prisma = new PrismaClient()

function parseArgs() {
  const a = process.argv.slice(2)
  const out: Record<string, string> = {}
  for (let i = 0; i < a.length; i += 2) {
    const k = a[i].replace(/^--/, '')
    out[k] = a[i + 1] ?? ''
  }
  return out
}

async function main() {
  const args = parseArgs()
  const orders = await prisma.paymentOrder.findMany({
    where: {
      status: 'pending',
      planType: { startsWith: 'vip_' },
    },
    orderBy: { createdAt: 'desc' },
  })

  console.log(`[vip-activate] pending VIP 订单 ${orders.length} 笔:`)
  for (const o of orders) {
    const u = await prisma.user.findUnique({ where: { id: o.userId }, select: { email: true, username: true, memberTier: true } })
    console.log(`  - ${o.orderNo} | ${o.planType} | ¥${o.amount} | ${o.method} | ${o.createdAt.toISOString()} | user=${u?.username || u?.email || o.userId} | tier=${u?.memberTier}`)
  }

  let targets = orders
  if (args.orderNo) targets = orders.filter(o => o.orderNo === args.orderNo)
  else if (args.user) {
    const user = await prisma.user.findFirst({ where: { OR: [{ email: args.user }, { username: args.user }] } })
    if (!user) { console.log('[vip-activate] 用户不存在'); return }
    targets = orders.filter(o => o.userId === user.id)
  } else if (!args.all) {
    console.log('[vip-activate] 未指定目标（--orderNo / --user / --all-pending），仅列示')
    return
  }

  if (targets.length === 0) { console.log('[vip-activate] 无可激活订单'); return }

  console.log(`\n[vip-activate] 开始激活 ${targets.length} 笔...`)
  for (const o of targets) {
    try {
      await prisma.paymentOrder.update({
        where: { id: o.id },
        data: { status: 'paid', payTime: new Date(), method: o.method === 'auto' ? 'manual_confirm' : o.method },
      })
      const result = await provisionFromPayment(
        { id: o.id, userId: o.userId, orderNo: o.orderNo, amount: o.amount, planType: o.planType, status: 'paid' },
        `MANUAL-${Date.now()}`,
        new Date(),
      )
      const u = await prisma.user.findUnique({ where: { id: o.userId }, select: { memberTier: true, memberExpiresAt: true } })
      console.log(`  ✅ ${o.orderNo} → provisioned=${result.provisioned} | user tier=${u?.memberTier} expires=${u?.memberExpiresAt?.toISOString()}`)
    } catch (e: any) {
      console.error(`  ❌ ${o.orderNo} 激活失败: ${e.message}`)
    }
  }
}

main().finally(() => prisma.$disconnect())
