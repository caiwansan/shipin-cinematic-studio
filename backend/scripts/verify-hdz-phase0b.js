/* Phase 0 补充：IDOR 章节/事件/角色状态 越权测试 */
require('dotenv').config()
const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // 用户A：取第一个有项目的用户；B：另一个用户（必须有章节或事件）
  const projects = await prisma.hdzProject.findMany({ take: 20, select: { id: true, userId: true } })
  const userA = await prisma.user.findFirst({ where: { id: projects[0].userId } })
  const tokenA = jwt.sign({ id: userA.id, email: userA.email, tokenVersion: userA.tokenVersion || 1 }, process.env.JWT_SECRET)
  const BASE = 'http://127.0.0.1:4002'
  const H = { 'Authorization': `Bearer ${tokenA}` }

  let pass = true
  const check = (name, code) => {
    const ok = code === 404
    console.log(`${ok ? '✅' : '❌'} ${name} → ${code}${ok ? '' : '（应 404）'}`)
    if (!ok) pass = false
  }

  // B 的章节（取 A 之外用户的章节）
  const bChapter = await prisma.hdzChapter.findFirst({
    where: { project: { userId: { not: userA.id } } },
    select: { id: true, projectId: true },
  })
  if (bChapter) {
    const r = await fetch(`${BASE}/api/hdz/projects/${projects[0].id}/chapters/${bChapter.id}`, {
      method: 'PUT', headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '越权修改测试' }),
    })
    check(`A用自己projectId改B的章节(${bChapter.id.slice(0,8)})`, r.status)
  } else console.log('⚠️ 无跨用户章节可测')

  // B 的故事事件
  const bEvent = await prisma.storyEvent.findFirst({
    where: { project: { userId: { not: userA.id } } },
    select: { id: true, projectId: true },
  })
  if (bEvent) {
    const r = await fetch(`${BASE}/api/hdz/projects/${projects[0].id}/story-events/${bEvent.id}`, {
      method: 'DELETE', headers: H,
    })
    check(`A用自己projectId删B的事件(${bEvent.id.slice(0,8)})`, r.status)
  } else console.log('⚠️ 无跨用户事件可测')

  // B 的角色状态 GET（character-state.ts:119 校验）
  const bCharState = await prisma.hdzCharacterState.findFirst({
    where: { character: { project: { userId: { not: userA.id } } } },
    select: { id: true, characterId: true, projectId: true },
  })
  if (bCharState) {
    const r = await fetch(`${BASE}/api/hdz/projects/${bCharState.projectId}/character-states/${bCharState.characterId}`, { headers: H })
    check(`A读B的角色状态(${bCharState.characterId.slice(0,8)})`, r.status)
  } else console.log('⚠️ 无跨用户角色状态可测')

  // 角色状态 DELETE
  if (bCharState) {
    const r = await fetch(`${BASE}/api/hdz/projects/${bCharState.projectId}/character-states/state-${bCharState.id}`, {
      method: 'DELETE', headers: H,
    })
    check(`A删B的角色状态记录(伪造stateId)`, r.status)
  }

  console.log(pass ? '\n✅✅✅ IDOR 全部隔离' : '\n❌ 存在漏洞')
}

main().finally(() => prisma.$disconnect())
