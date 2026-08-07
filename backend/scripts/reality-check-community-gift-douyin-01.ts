/**
 * COMMUNITY-GIFT-DOUYIN-01 — 抖音式礼物库 Reality Gate
 * G1 礼物库 ≥ 20 款且上架 ≥ 18（掌柜：礼物太少）
 * G2 每个礼物带 iconGradient 渐变（图标漂亮）
 * G3 三档分类齐全（热门/豪华/专属）
 * G4 价格阶梯合理（热门 1-99 / 豪华 100-999 / 专属 ≥1000 至少各 3 款）
 * G5 admin POST 带 iconGradient 创建成功
 * G6 admin PATCH 更新 iconGradient 生效
 * G7 聊天接口分组响应含 iconGradient
 */
import { prisma } from '../src/utils/index.js'

const BASE = 'http://127.0.0.1:4002'
let pass = 0
let fail = 0
const check = (name: string, cond: boolean, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name} ${extra}`) }
  else { fail++; console.log(`  ❌ ${name} ${extra}`) }
}

async function api(path: string, method = 'GET', body?: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  let json: any = null
  try { json = await res.json() } catch { }
  return { status: res.status, json }
}

async function main() {
  console.log('═══ COMMUNITY-GIFT-DOUYIN-01 抖音式礼物库 Reality Gate ═══\n')

  const gifts = await prisma.giftProduct.findMany()
  const active = gifts.filter((g) => g.isActive)
  check('G1 礼物总数 ≥ 20', gifts.length >= 20, `(共 ${gifts.length} 款，上架 ${active.length})`)
  check('G1 上架中 ≥ 18', active.length >= 18, `(上架 ${active.length})`)
  check('G2 全部礼物带 iconGradient', active.every((g) => g.iconGradient && g.iconGradient.startsWith('linear-gradient')), `(渐变覆盖 ${active.filter(g => g.iconGradient).length}/${active.length})`)
  check('G2 全部礼物带 emoji 图标', active.every((g) => g.iconUrl && /^\p{Extended_Pictographic}/u.test(g.iconUrl)), '')

  const cats = ['热门', '豪华', '专属']
  for (const c of cats) {
    const items = active.filter((g) => g.category === c)
    check(`G3 分类「${c}」≥ 3 款`, items.length >= 3, `(${items.length} 款)`)
  }
  const hot = active.filter((g) => g.category === '热门' && g.priceDiamonds <= 99)
  const lux = active.filter((g) => g.category === '豪华' && g.priceDiamonds >= 100 && g.priceDiamonds <= 999)
  const ex = active.filter((g) => g.category === '专属' && g.priceDiamonds >= 1000)
  check('G4 价格阶梯：热门 ≤99 / 豪华 100-999 / 专属 ≥1000', hot.length >= 3 && lux.length >= 3 && ex.length >= 3, `(热门低档 ${hot.length} / 豪华中档 ${lux.length} / 专属高档 ${ex.length})`)

  // 聊天接口（需登录用户 token）——用真实注册用户
  const suffix = Date.now().toString().slice(-8)
  const phone = `135${suffix}`
  await prisma.smsCode.create({ data: { phone, code: '888866', expiresAt: new Date(Date.now() + 600000), used: false } })
  const reg = await api('/api/auth/register', 'POST', { phone, username: `礼物验收_${suffix}`, password: 'Test@123456', code: '888866' })
  const utoken = reg.json?.accessToken || reg.json?.token || reg.json?.data?.token || ''
  const regUserId = reg.json?.user?.id
  const r7 = await api('/api/gifts/products', 'GET', undefined, utoken)
  const groups = r7.json?.data?.gifts || []
  const items = groups.flatMap((g: any) => g.items || [])
  check('G7 聊天接口分组 ≥ 3 类', groups.length >= 3, `(${groups.map((g: any) => g.category).join('/')})`)
  check('G7 聊天接口礼物 ≥ 18 且带渐变', items.length >= 18 && items.every((i: any) => i.iconGradient), `(${items.length} 款，渐变 ${items.filter((i: any) => i.iconGradient).length})`)
  check('G7 价格档位透传正确', items.some((i: any) => i.priceDiamonds === 1314) && items.some((i: any) => i.priceDiamonds === 10), '')

  // admin CRUD（创建带渐变 → 更新渐变 → 删除）
  const an = `gf_admin_${suffix}`
  await prisma.adminUser.create({ data: { username: an, passwordHash: await (await import('bcryptjs')).default.hash('AdminTest@123', 10), role: 'superadmin', displayName: 'gf-test' } })
  const al = await api('/api/admin/login', 'POST', { username: an, password: 'AdminTest@123' })
  const at = al.json?.token
  const r5 = await api('/api/admin/gifts/products', 'POST', { name: '验收测试礼物', priceDiamonds: 99, iconUrl: '🎀', iconGradient: 'linear-gradient(135deg,#ff9a9e,#fecfef)', category: '热门', sortOrder: 99 }, at)
  const gid = r5.json?.data?.id
  check('G5 admin 创建带渐变成功', !!gid && r5.json?.data?.iconGradient === 'linear-gradient(135deg,#ff9a9e,#fecfef)', `(id=${gid})`)
  const r6 = await api('/api/admin/gifts/products/' + gid, 'PATCH', { iconGradient: 'linear-gradient(135deg,#43e97b,#38f9d7)', priceDiamonds: 188 }, at)
  check('G6 admin 更新渐变生效', r6.json?.data?.iconGradient === 'linear-gradient(135deg,#43e97b,#38f9d7)' && r6.json?.data?.priceDiamonds === 188, `(gradient=${r6.json?.data?.iconGradient})`)
  await api('/api/admin/gifts/products/' + gid, 'DELETE', undefined, at)
  const del = await prisma.giftProduct.findUnique({ where: { id: gid } })
  check('G5 清理：删除成功', !del)

  await prisma.user.deleteMany({ where: { phone } }).catch(() => {})
  if (regUserId) {
    await prisma.coinLog.deleteMany({ where: { userId: regUserId } }).catch(() => {})
    await prisma.membership.deleteMany({ where: { userId: regUserId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: regUserId } }).catch(() => {})
  }
  await prisma.smsCode.deleteMany({ where: { phone } }).catch(() => {})
  await prisma.adminUser.delete({ where: { username: an } }).catch(() => {})

  console.log(`\n═══ 结果: ${pass} PASS / ${fail} FAIL ═══`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error('脚本异常:', e); process.exit(1) })
