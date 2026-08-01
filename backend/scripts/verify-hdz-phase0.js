/* Phase 0 安全验证脚本：跨用户访问隔离测试 */
require('dotenv').config()
const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // 找两个不同的用户：A 有 hdzProject，B 也有 hdzProject
  const projects = await prisma.hdzProject.findMany({ take: 10, select: { id: true, userId: true, title: true } })
  if (projects.length < 2) {
    console.log('❌ 项目不足 2 个，无法测试跨用户。现有：', projects.length)
    return
  }
  const pA = projects[0]
  const pB = projects.find(p => p.userId !== pA.userId) || projects[1]
  console.log(`用户A=${pA.userId?.substring(0, 8)} 项目A=${pA.id?.substring(0, 8)}「${pA.title}」`)
  console.log(`用户B=${pB.userId?.substring(0, 8)} 项目B=${pB.id?.substring(0, 8)}「${pB.title}」`)

  const userA = await prisma.user.findUnique({ where: { id: pA.userId } })
  if (!userA) { console.log('❌ 用户A不存在'); return }

  // 签发用户A的 token（tokenVersion 与库一致）
  const tokenA = jwt.sign({ id: userA.id, email: userA.email, tokenVersion: userA.tokenVersion || 1 }, process.env.JWT_SECRET)

  const BASE = 'http://127.0.0.1:4002'
  const H = { 'Authorization': `Bearer ${tokenA}` }

  const results = []
  // 1. A 访问自己的项目 → 应 200/非404
  const ownRes = await fetch(`${BASE}/api/hdz/projects/${pA.id}`, { headers: H })
  results.push(['A访问自己项目', ownRes.status])

  // 2. A 访问 B 的 screenplay 列表 → 应 404
  const r2 = await fetch(`${BASE}/api/hdz/agent/screenplay/${pB.id}`, { headers: H })
  results.push(['A访问B剧本列表', r2.status])

  // 3. A 访问 B 的 PDF → 应 404
  const r3 = await fetch(`${BASE}/api/hdz/agent/screenplay/${pB.id}/pdf/by-chapter`, { headers: H })
  results.push(['A访问B剧本PDF', r3.status])

  // 4. A 转 B 的项目为剧本 → 应 404
  const r4 = await fetch(`${BASE}/api/hdz/agent/screenplay`, {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: pB.id, chapterNos: [1] }),
  })
  results.push(['A转B项目为剧本', r4.status])

  // 5. A 改 B 的章节（IDOR 测试）
  const bChapter = await prisma.hdzChapter.findFirst({ where: { projectId: pB.id }, select: { id: true } })
  if (bChapter) {
    const r5 = await fetch(`${BASE}/api/hdz/projects/${pA.id}/chapters/${bChapter.id}`, {
      method: 'PUT', headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '越权修改测试' }),
    })
    results.push(['A跨项目改B章节', r5.status])
  }

  // 6. A 删 B 的故事事件（IDOR）
  const bEvent = await prisma.storyEvent.findFirst({ where: { projectId: pB.id }, select: { id: true } })
  if (bEvent) {
    const r6 = await fetch(`${BASE}/api/hdz/projects/${pA.id}/story-events/${bEvent.id}`, {
      method: 'DELETE', headers: H,
    })
    results.push(['A跨项目删B事件', r6.status])
  }

  console.log('\n═══ 测试结果 ═══')
  let pass = true
  for (const [name, code] of results) {
    const ok = code === 200 || code === 404
    if (name.startsWith('A访问自己') && code !== 200) { console.log(`❌ ${name} → ${code}（自己项目应 200）`); pass = false; continue }
    if (name.startsWith('A访问自己')) { console.log(`✅ ${name} → ${code}`); continue }
    if (code === 404) console.log(`✅ ${name} → 404（已隔离）`)
    else { console.log(`❌ ${name} → ${code}（应 404）`); pass = false }
  }
  console.log(pass ? '\n✅✅✅ Phase 0 全部通过' : '\n❌ 存在失败项')
}

main().finally(() => prisma.$disconnect())
