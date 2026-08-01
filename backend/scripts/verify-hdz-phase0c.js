/* Phase 0 最终：真实 IDOR 场景（A的projectId + B的资源ID） */
require('dotenv').config()
const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const projects = await prisma.hdzProject.findMany({ take: 20, select: { id: true, userId: true } })
  const userA = await prisma.user.findFirst({ where: { id: projects[0].userId } })
  const tokenA = jwt.sign({ id: userA.id, email: userA.email, tokenVersion: userA.tokenVersion || 1 }, process.env.JWT_SECRET)
  const BASE = 'http://127.0.0.1:4002'
  const H = { 'Authorization': `Bearer ${tokenA}` }
  const myProjectId = projects[0].id

  let pass = true
  const check = (name, code) => {
    const ok = code === 404
    console.log(`${ok ? '✅' : '❌'} ${name} → ${code}${ok ? '' : '（应 404）'}`)
    if (!ok) pass = false
  }

  // B 的角色（不属于 A 的项目）
  const bChar = await prisma.hdzCharacter.findFirst({
    where: { project: { userId: { not: userA.id } } },
    select: { id: true },
  })
  if (bChar) {
    const r = await fetch(`${BASE}/api/hdz/projects/${myProjectId}/character-states/${bChar.id}`, { headers: H })
    check('A自己的projectId + B的characterId 读状态', r.status)
  } else console.log('⚠️ 无跨用户角色')

  // B 的角色状态记录
  const bState = await prisma.hdzCharacterState.findFirst({
    where: { character: { project: { userId: { not: userA.id } } } },
    select: { id: true },
  })
  if (bState) {
    const r = await fetch(`${BASE}/api/hdz/projects/${myProjectId}/character-states/${bState.id}`, { method: 'DELETE', headers: H })
    check('A自己的projectId + B的stateId 删状态', r.status)
  } else console.log('⚠️ 无跨用户状态记录')

  // 章节 PUT 已测 ✅（phase0b 通过）
  // 事件 DELETE 已测 ✅（phase0b 通过）

  console.log(pass ? '\n✅✅✅ IDOR 全部隔离（真实场景）' : '\n❌ 仍存在漏洞')
}
main().finally(() => prisma.$disconnect())
