// reality-check-gift-gold-eco-01.ts — 礼物金币体系验收（GIFT-GOLD-ECO-01）
// 链条：钻石(充值) → 礼物(打赏,65%金币) → 金币(10:1兑余额,200起) → 余额(提现,5%手续费)
import 'dotenv/config'

const BASE = 'https://aigc.fushtn.com'
import { readFileSync } from 'node:fs'
import { prisma } from '../src/utils/index.js'
const adminToken = readFileSync('/tmp/admin-token.txt', 'utf8').trim()
const AH = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken }

const EMAIL_A = 'credits_src_test@test.com' // 送礼方
const EMAIL_B = 'tenant_org_test@audit.local' // 收礼方
const PW = { [EMAIL_A]: 'SrcTest@123', [EMAIL_B]: 'AuditTest@123' }

let pass = 0, fail = 0
function check(name: string, cond: boolean, extra = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name} ${extra}`) }
}

async function api(path: string, opts: any = {}) {
  const res = await fetch(BASE + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

async function login(email: string) {
  const r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password: PW[email] }) })
  return r.body.accessToken
}

async function main() {
  console.log('═ GIFT-GOLD-ECO-01 验收 ═')
  // ── 0. 基线重置（测试账号 B 金币/余额清零，删残留 pending 提现；A 钻石清零） ──
  await prisma.$executeRawUnsafe(`UPDATE "User" SET "gold_coins" = 0, "wallet_balance" = 0 WHERE "email" = $1`, EMAIL_B)
  await prisma.$executeRawUnsafe(`DELETE FROM "AgentWithdraw" WHERE "userId" = (SELECT id FROM "User" WHERE "email" = $1) AND "status" = 'pending'`, EMAIL_B)
  await prisma.$executeRawUnsafe(`DELETE FROM "gift_record" WHERE "receiverId" = (SELECT id FROM "User" WHERE "email" = $1)`, EMAIL_B)
  await prisma.$executeRawUnsafe(`DELETE FROM "gold_coin_log" WHERE "userId" = (SELECT id FROM "User" WHERE "email" = $1)`, EMAIL_B)
  await prisma.$executeRawUnsafe(`UPDATE "Membership" SET "credits" = 0 WHERE "userId" = (SELECT id FROM "User" WHERE "email" = $1)`, EMAIL_A)
  await prisma.$executeRawUnsafe(`DELETE FROM "CoinLog" WHERE "userId" = (SELECT id FROM "User" WHERE "email" = $1)`, EMAIL_A)
  // ── 0. 测试用户钻石清零基线 ──
  const list0 = await api('/api/admin/members', { headers: AH })
  const find = (em: string) => (list0.body.data || []).find((u: any) => u.email === em)

  // ── 1. 礼物商品：已有则复用（幂等），否则后台创建（抖音式分类） ──
  console.log('\n[1] 礼物商品（后台创建 + 用户端分组）')
  const existing = await api('/api/admin/gifts/products', { headers: AH })
  console.log('  [debug] existing:', existing.status, 'success:', existing.body.success, 'count:', existing.body.data?.gifts?.length)
  const giftsSeed = [
    { name: '小心心', priceDiamonds: 10, iconUrl: '💗', category: '热门', sortOrder: 1 },
    { name: '奶茶', priceDiamonds: 66, iconUrl: '🧋', category: '热门', sortOrder: 2 },
    { name: '热气球', priceDiamonds: 100, iconUrl: '🎈', category: '热门', sortOrder: 3 },
    { name: '豪华游艇', priceDiamonds: 520, iconUrl: '🛥️', category: '豪华', sortOrder: 1 },
    { name: '至尊皇冠', priceDiamonds: 1314, iconUrl: '👑', category: '专属', sortOrder: 1 },
  ]
  const created: any[] = []
  for (const g of giftsSeed) {
    const found = (existing.body.data?.gifts || []).find((x: any) => x.name === g.name)
    if (found) created.push(found)
    else {
      const r = await api('/api/admin/gifts/products', { method: 'POST', headers: AH, body: JSON.stringify(g) })
      if (r.body.data?.id) created.push(r.body.data)
    }
  }
  check(`礼物商品 5 个就绪（复用或新建，实际 ${created.length}）`, created.length === 5)

  const tokenA = await login(EMAIL_A)
  const tokenB = await login(EMAIL_B)
  const products = await api('/api/gifts/products', { headers: { Authorization: 'Bearer ' + tokenA } })
  const groups = products.body.data?.gifts || []
  const totalItems = groups.reduce((s: number, g: any) => s + g.items.length, 0)
  check(`用户端礼物列表分组可见（共 ${totalItems} 个）`, totalItems >= 5, JSON.stringify(groups.map((g: any) => g.category + ':' + g.items.length)))
  check('结算比例标注 65%', products.body.data?.coinsAwardedPercent === 65)

  // ── 2. 送礼事务：扣钻 + 金币结算 ──
  console.log('\n[2] 送礼：扣钻 → 接收方金币 65% 即时到账')
  const uidA = find(EMAIL_A).id
  const uidB = find(EMAIL_B).id
  // 给 A 充 1000 钻
  await api('/api/admin/members/' + uidA + '/credits', { method: 'POST', headers: AH, body: JSON.stringify({ amount: 1000, remark: '验收-充钻' }) })
  const hotAir = created.find((g: any) => g.name === '热气球')
  const send1 = await api('/api/gifts/send', { method: 'POST', headers: { Authorization: 'Bearer ' + tokenA }, body: JSON.stringify({ giftId: hotAir.id, receiverUid: uidB, channelId: 'kl_public_tea', channelType: 4 }) })
  check(`A 送「热气球」(100钻) 成功`, send1.body.success === true, JSON.stringify(send1.body))
  check(`结算金币 = 65（100×65%）`, send1.body.data?.coinsAwarded === 65, `got ${send1.body.data?.coinsAwarded}`)
  const balA = await api('/api/user/diamonds', { headers: { Authorization: 'Bearer ' + tokenA } })
  check(`A 钻石扣减 100 → ${(balA.body.data || {}).totalDiamonds}（基线1000-100=900）`, (balA.body.data || {}).totalDiamonds === 900, JSON.stringify(balA.body.data))
  const balB = await api('/api/user/gold-coins', { headers: { Authorization: 'Bearer ' + tokenB } })
  check(`B 金币 = 65（即时到账）`, (balB.body.data || {}).goldCoins === 65, JSON.stringify(balB.body.data))
  check(`B 金币流水含「收到礼物「热气球」」`, (balB.body.data || {}).logs?.some((l: any) => l.type === 'gift_in' && l.amount === 65))

  // ── 3. 防刷：余额不足拒绝 ──
  console.log('\n[3] 防刷：钻石不足 / 自己送自己')
  const crown = created.find((g: any) => g.name === '至尊皇冠')
  const send2 = await api('/api/gifts/send', { method: 'POST', headers: { Authorization: 'Bearer ' + tokenA }, body: JSON.stringify({ giftId: crown.id, receiverUid: uidB, channelId: 'kl_public_tea', channelType: 4 }) })
  check(`A(900钻) 送皇冠(1314钻) → 拒绝 DIAMOND_INSUFFICIENT`, send2.status === 400 && send2.body.code === 'DIAMOND_INSUFFICIENT', JSON.stringify(send2.body))
  const sendSelf = await api('/api/gifts/send', { method: 'POST', headers: { Authorization: 'Bearer ' + tokenA }, body: JSON.stringify({ giftId: hotAir.id, receiverUid: uidA }) })
  check(`自己送自己 → 拒绝`, sendSelf.status === 400, JSON.stringify(sendSelf.body))

  // ── 4. 兑换：200 起 / 10 倍数 / 10:1 ──
  console.log('\n[4] 金币兑换余额（10:1，最低200）')
  const ex1 = await api('/api/user/gold-coins/exchange', { method: 'POST', headers: { Authorization: 'Bearer ' + tokenB }, body: JSON.stringify({ coins: 65 }) })
  check(`B(65金币) 兑换 → 拒绝（不足200）`, ex1.status === 400, JSON.stringify(ex1.body))
  // 给 A 再充 1500，送皇冠 1314
  await api('/api/admin/members/' + uidA + '/credits', { method: 'POST', headers: AH, body: JSON.stringify({ amount: 1500, remark: '验收-充钻2' }) })
  const send3 = await api('/api/gifts/send', { method: 'POST', headers: { Authorization: 'Bearer ' + tokenA }, body: JSON.stringify({ giftId: crown.id, receiverUid: uidB, channelId: 'kl_public_tea', channelType: 4 }) })
  check(`A 送「至尊皇冠」(1314钻) 成功`, send3.body.success === true, JSON.stringify(send3.body).slice(0, 200))
  check(`结算金币 = 854（1314×65% floor）`, send3.body.data?.coinsAwarded === 854, `got ${send3.body.data?.coinsAwarded}`)
  const balB2 = await api('/api/user/gold-coins', { headers: { Authorization: 'Bearer ' + tokenB } })
  check(`B 金币累计 = 919（65+854）`, (balB2.body.data || {}).goldCoins === 919, `got ${(balB2.body.data || {}).goldCoins}`)
  const exBad = await api('/api/user/gold-coins/exchange', { method: 'POST', headers: { Authorization: 'Bearer ' + tokenB }, body: JSON.stringify({ coins: 205 }) })
  check(`兑换 205（非10倍数）→ 拒绝`, exBad.status === 400, JSON.stringify(exBad.body))
  const ex2 = await api('/api/user/gold-coins/exchange', { method: 'POST', headers: { Authorization: 'Bearer ' + tokenB }, body: JSON.stringify({ coins: 200 }) })
  check(`兑换 200 金币 → 余额 +20`, ex2.body.data?.yuan === 20 && ex2.body.data?.walletBalance === 20, JSON.stringify(ex2.body.data))
  const balB3 = await api('/api/user/gold-coins', { headers: { Authorization: 'Bearer ' + tokenB } })
  check(`兑换后金币 = 719（919-200）`, (balB3.body.data || {}).goldCoins === 719, `got ${(balB3.body.data || {}).goldCoins}`)
  check(`可兑换金额提示 = 71 元`, (balB3.body.data || {}).exchangeableYuan === 71)

  // ── 5. 提现手续费 5% ──
  console.log('\n[5] 余额提现（手续费 5%，到账=金额-手续费）')
  // 绑定收款账号
  await api('/api/wallet/bind-account', { method: 'POST', headers: { Authorization: 'Bearer ' + tokenB }, body: JSON.stringify({ accountType: 'alipay', accountName: '验收测试' }) })
  const w1 = await api('/api/wallet/withdraw', { method: 'POST', headers: { Authorization: 'Bearer ' + tokenB }, body: JSON.stringify({ amount: 100 }) })
  check(`余额20 提现100 → 拒绝（不足）`, w1.body.success !== true, JSON.stringify(w1.body))
  // 补兑换 700 金币 → 余额 90
  const ex3 = await api('/api/user/gold-coins/exchange', { method: 'POST', headers: { Authorization: 'Bearer ' + tokenB }, body: JSON.stringify({ coins: 700 }) })
  check(`补兑换 700 金币 → 余额 +70（90）`, ex3.body.data?.yuan === 70, JSON.stringify(ex3.body.data))
  // A 再送「豪华游艇」(520钻) → B 金币 +338 = 357
  const yacht = created.find((g: any) => g.name === '豪华游艇')
  const send4 = await api('/api/gifts/send', { method: 'POST', headers: { Authorization: 'Bearer ' + tokenA }, body: JSON.stringify({ giftId: yacht.id, receiverUid: uidB, channelId: 'kl_public_tea', channelType: 4 }) })
  check(`A 送「豪华游艇」(520钻) 成功`, send4.body.success === true, JSON.stringify(send4.body).slice(0, 160))
  // B 兑换 350 → 余额 125
  const ex4 = await api('/api/user/gold-coins/exchange', { method: 'POST', headers: { Authorization: 'Bearer ' + tokenB }, body: JSON.stringify({ coins: 350 }) })
  check(`B 兑换 350 金币 → 余额 125`, ex4.body.data?.walletBalance === 125, JSON.stringify(ex4.body.data))
  const balNow = 125
  const w2 = await api('/api/wallet/withdraw', { method: 'POST', headers: { Authorization: 'Bearer ' + tokenB }, body: JSON.stringify({ amount: 100 }) })
  check(`提现 100 成功（余额 ${balNow} ≥ 100）`, w2.body.success === true, JSON.stringify(w2.body))
  check(`手续费 fee = 5`, w2.body.data?.fee === 5, JSON.stringify(w2.body.data))
  check(`到账 payout = 95`, w2.body.data?.payout === 95, JSON.stringify(w2.body.data))
  const wallet = await api('/api/wallet', { headers: { Authorization: 'Bearer ' + tokenB } })
  check(`提现后余额 = 25（扣全额，手续费单记）`, Math.abs((wallet.body.data || {}).balance - 25) < 0.001, `got ${(wallet.body.data || {}).balance}`)
  check(`钱包接口返回手续费率 5%`, wallet.body.data?.withdrawFeeRate === 0.05)
  const wRec = (wallet.body.data || {}).withdraws?.[0]
  check(`提现记录带 fee=5 / payout=95`, wRec?.fee === 5 && wRec?.payout === 95, JSON.stringify(wRec))

  // ── 6. 管理端审批：reject 退回余额（wallet_balance 列名修复验证） ──
  console.log('\n[6] 管理端提现审核（reject 退回余额）')
  const wList = await api('/api/admin/wallet/withdraws', { headers: AH })
  const pending = (wList.body.data?.items || []).find((w: any) => w.status === 'pending')
  check('有待处理提现记录', !!pending)
  if (pending) {
    const rejectR = await api('/api/admin/wallet/withdraw/' + pending.id + '/reject', { method: 'POST', headers: AH, body: JSON.stringify({ remark: '验收退回' }) })
    check(`reject 成功（wallet_balance 修复）`, rejectR.body.success === true, JSON.stringify(rejectR.body))
    const wallet2 = await api('/api/wallet', { headers: { Authorization: 'Bearer ' + tokenB } })
    check(`拒绝后退回余额 = 125（100 退回）`, Math.abs((wallet2.body.data || {}).balance - 125) < 0.001, `got ${(wallet2.body.data || {}).balance}`)
  }

  // ── 7. 礼物记录落库 ──
  console.log('\n[7] 礼物记录与流水落库')
  const recv = await api('/api/gifts/received', { headers: { Authorization: 'Bearer ' + tokenB } })
  check(`B 收到礼物记录 3 条（热气球+皇冠+游艇）`, recv.body.data?.total === 3, JSON.stringify(recv.body.data?.total))
  check(`皇冠记录：1314钻 / 854金币 / 送者名`, (recv.body.data?.records || []).some((r: any) => r.giftName === '至尊皇冠' && r.priceDiamonds === 1314 && r.coinsAwarded === 854))

  // ── 清理：A 钻石恢复 0 ──
  await prisma.$executeRawUnsafe(`UPDATE "Membership" SET "credits" = 0 WHERE "userId" = (SELECT id FROM "User" WHERE "email" = $1)`, EMAIL_A)

  console.log(`\n════ 结果: ${pass} PASS / ${fail} FAIL ════`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
