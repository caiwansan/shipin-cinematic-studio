require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

/**
 * 02-B Task 2 补充验证：真实 HTTP 回滚 → 受影响章节 needs_rewrite
 */
async function main() {
  const results = []
  const add = (n, ok, d) => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${n} — ${d}`) }

  const phone = `139${String(Date.now()).slice(-8)}`
  const code = '123456'
  await prisma.smsCode.create({ data: { phone, code, expiresAt: new Date(Date.now() + 600000) } })

  const base = 'http://127.0.0.1:4002'
  const reg = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, username: `t2_${Date.now()}`, password: 'test1234', code }),
  })
  const regJson = await reg.json()
  const token = regJson.token || regJson.data?.token || regJson.accessToken
  if (!token) { console.log('❌ 注册失败', JSON.stringify(regJson).slice(0, 200)); return }
  add('0 测试用户注册', true, 'token 获取成功')

  const user = await prisma.user.findFirst({ where: { phone } })
  const proj = await prisma.hdzProject.create({
    data: { userId: user.id, title: '__VERIFY_02B_T2_HTTP__', genre: '玄幻', status: 'active' },
  })

  try {
    for (let n = 1; n <= 3; n++) {
      await prisma.hdzChapter.create({ data: { projectId: proj.id, chapterNo: n, title: `第${n}章`, status: 'reviewed', content: `正文${n}`, wordCount: 100 } })
    }
    // 第51章在受影响区间外（卷2 51-100），不应被标记
    await prisma.hdzChapter.create({ data: { projectId: proj.id, chapterNo: 51, title: '第51章', status: 'reviewed', content: '正文51', wordCount: 100 } })

    const v1 = { worldDirection: '修仙', volumes: [{ volume: 1, chapterRange: '1-50', title: '入门' }, { volume: 2, chapterRange: '51-100', title: '进阶' }], forbiddenRules: [] }
    const v2 = { worldDirection: '修仙', volumes: [{ volume: 1, chapterRange: '1-50', title: '入门改' }, { volume: 2, chapterRange: '51-100', title: '进阶' }], forbiddenRules: [] }
    await prisma.hdzPlanRevision.create({ data: { projectId: proj.id, version: 1, reason: 'v1', planBefore: {}, planAfter: v1, diffSummary: '初始' } })
    await prisma.hdzPlanRevision.create({ data: { projectId: proj.id, version: 2, reason: 'v2', planBefore: v1, planAfter: v2, diffSummary: '卷1调整' } })
    await prisma.hdzProject.update({ where: { id: proj.id }, data: { masterPlan: v2, masterPlanVersion: 2 } })

    const rb = await fetch(`${base}/api/hdz/projects/${proj.id}/master-plan/rollback`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ version: 1 }),
    })
    const rbJson = await rb.json()
    const chapters = await prisma.hdzChapter.findMany({ where: { projectId: proj.id }, select: { chapterNo: true, status: true } })
    const marked = chapters.filter(c => c.status === 'needs_rewrite').map(c => c.chapterNo).sort((a, b) => a - b)

    add('A 受影响区间(1-50)章节标记', JSON.stringify(marked) === JSON.stringify([1, 2, 3]), `marked=${marked.join(',')}, needsRewrite=${rbJson.data?.needsRewrite}`)
    add('A2 范围外章节不误伤', chapters.find(c => c.chapterNo === 51)?.status === 'reviewed', `ch51=${chapters.find(c => c.chapterNo === 51)?.status}`)
    add('A3 版本还原为 V3(回滚自V2→V1)', rbJson.data?.version === 3 && rbJson.data?.rolledBackTo === 1, `version=${rbJson.data?.version}`)
    add('A4 总纲内容已还原', JSON.stringify(rbJson.data?.masterPlan?.volumes?.[0]?.title) === '"入门"', `卷1=${rbJson.data?.masterPlan?.volumes?.[0]?.title}`)

    const pass = results.every(Boolean)
    console.log(`\n${pass ? '🏆 Task 2 HTTP 验证全部通过' : '⚠️ 有失败项'}（${results.filter(Boolean).length}/${results.length}）`)
  } finally {
    await prisma.hdzChapter.deleteMany({ where: { projectId: proj.id } })
    await prisma.hdzPlanRevision.deleteMany({ where: { projectId: proj.id } })
    await prisma.hdzProject.deleteMany({ where: { id: proj.id } })
    await prisma.smsCode.deleteMany({ where: { phone } })
    await prisma.user.deleteMany({ where: { phone } })
    console.log('🧹 测试数据已清理')
  }
}
main().finally(() => prisma.$disconnect())
