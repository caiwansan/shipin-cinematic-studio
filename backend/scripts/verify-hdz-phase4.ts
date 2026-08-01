require('dotenv').config()
const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // 找有 masterPlan + 有章节的项目（验证总纲注入对话）
  const proj = await prisma.hdzProject.findFirst({
    where: { masterPlan: { not: null }, chapters: { some: {} } },
    select: { id: true, userId: true, title: true },
  })
  if (!proj) { console.log('⚠️ 无合适项目'); return }
  const user = await prisma.user.findUnique({ where: { id: proj.userId } })
  const token = jwt.sign({ id: user.id, email: user.email, tokenVersion: user.tokenVersion || 1 }, process.env.JWT_SECRET)
  const BASE = 'http://127.0.0.1:4002'
  const H = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }

  // 1. worldbuilder 对话（非写作意图）——应走 worldbuilder + 注入总纲
  console.log('测试 1: 普通对话（应走 worldbuilder）...')
  const r1 = await fetch(`${BASE}/api/hdz/chat/send`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ projectId: proj.id, message: '帮我看看主角的性格设定合理吗' }),
  })
  const j1 = await r1.json()
  console.log(`  HTTP ${r1.status} | success=${j1?.success} | 回复: ${(j1?.data?.response || j1?.error || '').slice(0, 60)}`)

  // 2. 写作指令（无大纲章节）——应返回 need_outline 而不是卡住
  console.log('测试 2: 写作指令（新章节无大纲 → need_outline）...')
  const lastCh = await prisma.hdzChapter.findFirst({ where: { projectId: proj.id }, orderBy: { chapterNo: 'desc' }, select: { chapterNo: true } })
  const nextCh = (lastCh?.chapterNo || 0) + 1
  const r2 = await fetch(`${BASE}/api/hdz/chat/send`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ projectId: proj.id, message: `写第${nextCh}章` }),
  })
  const j2 = await r2.json()
  console.log(`  HTTP ${r2.status} | type=${j2?.data?.type} | ${(j2?.data?.response || j2?.error || '').slice(0, 60)}`)

  console.log('\n✅ Phase 4 路由验证完成（写正文链路需真实 LLM 时长，由前端长超时+轮询兜底）')
}
main().finally(() => prisma.$disconnect())
