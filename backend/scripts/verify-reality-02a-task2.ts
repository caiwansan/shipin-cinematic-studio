require('dotenv').config()
const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

/**
 * Task 2 验证：MasterPlan 版本治理
 * 链路：PUT(带diff) → confirm → impact 分析 → rollback → 历史
 */
async function main() {
  const results = []
  const add = (n, ok, d) => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${n} — ${d}`) }

  const user = await prisma.user.findFirst()
  if (!user) { console.log('⚠️ 无用户'); return }
  const token = jwt.sign({ id: user.id, email: user.email, tokenVersion: user.tokenVersion || 1 }, process.env.JWT_SECRET)
  const BASE = 'http://127.0.0.1:4002'
  const H = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }

  // 测试项目
  const proj = await prisma.hdzProject.create({
    data: { userId: user.id, title: '__VERIFY_02A_T2__', genre: '玄幻', status: 'active' },
  })
  const P = `${BASE}/api/hdz/projects/${proj.id}/master-plan`

  try {
    // V1 总纲（基础版）
    const v1 = { title: '测试', status: 'draft', worldDirection: '灵气复苏世界', endingDirection: '主角成神', forbiddenRules: ['主角不死'], volumes: [{ volume: 1, chapterRange: '1-100', theme: '新手村' }], foreshadowing: [{ chapter: 5, event: '玉佩', payoff: '第50章' }] }
    await fetch(`${BASE}/api/hdz/projects/${proj.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ ...proj, masterPlan: v1 }) }).catch(()=>{})
    // 直接用 PUT master-plan 建 V1（无历史时 planBefore 为 null）
    let r = await fetch(P, { method: 'PUT', headers: H, body: JSON.stringify({ masterPlan: v1, reason: '初始版本' }) })
    let j = await r.json()
    add('PUT V1 成功', r.status === 200 && j.success, `version=${j.data?.masterPlanVersion}`)

    // V2：改世界观 + 加禁则 + 改卷区间 + 加伏笔
    const v2 = { ...v1, worldDirection: '灵气复苏+科技修真世界', forbiddenRules: ['主角不死', '不能出现穿越者'], volumes: [{ volume: 1, chapterRange: '1-120', theme: '新手村与学院' }], foreshadowing: [v1.foreshadowing[0], { chapter: 10, event: '断剑', payoff: '第80章' }] }
    r = await fetch(P, { method: 'PUT', headers: H, body: JSON.stringify({ masterPlan: v2, reason: '调整世界观' }) })
    j = await r.json()
    add('PUT V2 成功', j.success, `version=${j.data?.masterPlanVersion}`)

    // diffSummary 非空且描述变更
    const revs = await (await fetch(`${P}/revisions`, { headers: H })).json()
    const revV2 = revs.data.find(x => x.version === 2)
    add('V2 diffSummary 生成', !!revV2?.diffSummary && revV2.diffSummary.includes('世界观'), `diff=${revV2?.diffSummary?.slice(0, 60)}`)
    add('V2 修订历史含 planBefore/After', !!revV2?.planBefore && !!revV2?.planAfter, 'planBefore/planAfter 已记录')

    // confirm → 状态机版本
    r = await fetch(`${P}/confirm`, { method: 'POST', headers: H })
    j = await r.json()
    add('confirm 成功且记 revision', j.success && j.data?.version === 3, `version=${j.data?.version}`)

    // impact 分析：V1 vs 当前（V3）
    r = await fetch(`${P}/impact?version=1`, { headers: H })
    j = await r.json()
    const impact = j.data?.impact
    add('impact 分析返回', j.success && impact, `affectedVolumes=${impact?.affectedVolumeCount}, severity=${impact?.severity}`)
    add('impact 识别受影响区间', (impact?.affectedChapterRanges || []).length > 0, `ranges=${JSON.stringify(impact?.affectedChapterRanges)}`)

    // rollback 到 V1
    r = await fetch(`${P}/rollback`, { method: 'POST', headers: H, body: JSON.stringify({ version: 1 }) })
    j = await r.json()
    add('rollback 到 V1 成功', j.success && j.data?.rolledBackTo === 1, `newVersion=${j.data?.version}, status=${j.data?.masterPlan?.status}`)
    const after = await (await fetch(P, { headers: H })).json()
    add('回滚后内容=V1', after.data?.masterPlan?.worldDirection === '灵气复苏世界', `worldDirection=${after.data?.masterPlan?.worldDirection}`)
    const revs2 = await (await fetch(`${P}/revisions`, { headers: H })).json()
    add('回滚生成了新修订记录', revs2.data.some(x => x.reason.includes('回滚')), `totalRevisions=${revs2.data.length}`)

    // locked 状态禁止 rollback
    await fetch(`${P}/confirm`, { method: 'POST', headers: H })
    await fetch(`${P}/lock`, { method: 'POST', headers: H })
    r = await fetch(`${P}/rollback`, { method: 'POST', headers: H, body: JSON.stringify({ version: 1 }) })
    j = await r.json()
    add('locked 禁止 rollback', r.status === 400, `error=${j.error}`)

    const pass = results.every(Boolean)
    console.log(`\n${pass ? '🏆 Task 2 全部验证通过' : '⚠️ 有失败项'}（${results.filter(Boolean).length}/${results.length}）`)
  } finally {
    await prisma.hdzPlanRevision.deleteMany({ where: { projectId: proj.id } })
    await prisma.hdzProject.deleteMany({ where: { id: proj.id } })
    console.log('🧹 测试数据已清理')
  }
}
main().finally(() => prisma.$disconnect())
