require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

/**
 * 02-B Task 1 验证：章节生成前 Context Gate
 * 场景：非法章节号 / 重复生成 / 前置章未审+critical / 前置章已审 / 上下文缺失 / 跳章 / rewrite 放行 / orchestrator 接入
 */
async function main() {
  const results = []
  const add = (n, ok, d) => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${n} — ${d}`) }

  const user = await prisma.user.findFirst()
  if (!user) { console.log('⚠️ 无用户'); return }
  const proj = await prisma.hdzProject.create({
    data: { userId: user.id, title: '__VERIFY_02B_T1__', genre: '玄幻', status: 'active' },
  })

  try {
    const { consistencyVerifier } = require('../src/services/hdz/consistency-verifier.service.js')

    // 建两个角色（让 StoryContext 有数据，G3 通过）
    await prisma.hdzCharacter.create({ data: { projectId: proj.id, name: '林凡', role: 'protagonist', properties: {} } })
    await prisma.hdzCharacter.create({ data: { projectId: proj.id, name: '苏瑶', role: 'supporting', properties: {} } })

    // 场景 A：非法章节号 → fail
    const va = await consistencyVerifier.verifyBeforeGeneration(proj.id, 0)
    add('A 非法章节号拦截', !va.ok && va.gates.some(g => g.check === '章节合法性' && g.status === 'fail'), `score=${va.score}`)

    // 场景 B：正常第一章 → pass
    const vb = await consistencyVerifier.verifyBeforeGeneration(proj.id, 1)
    add('B 第一章放行', vb.ok && vb.score >= 70, `score=${vb.score}, gates=${vb.gates.map(g=>g.status).join('/')}`)

    // 建第1章（reviewed）+ 第2章（draft + critical reviewNotes）
    await prisma.hdzChapter.create({ data: { projectId: proj.id, chapterNo: 1, title: '第一章', status: 'reviewed', content: '正文一', wordCount: 100 } })
    await prisma.hdzChapter.create({ data: { projectId: proj.id, chapterNo: 2, title: '第二章', status: 'draft', content: '正文二', wordCount: 100, reviewNotes: [{ severity: 'critical', issue: '角色崩坏', suggestion: '重写' }] } })

    // 场景 C：第3章，前置第2章未审且 critical → fail（错误不传播）
    const vc = await consistencyVerifier.verifyBeforeGeneration(proj.id, 3)
    add('C 前置章critical问题→拦截', !vc.ok && vc.gates.some(g => g.check === '前置审批门' && g.status === 'fail'), `score=${vc.score}`)

    // 场景 D：重复生成第2章（已有正文，非 rewrite）→ fail
    const vd = await consistencyVerifier.verifyBeforeGeneration(proj.id, 2)
    add('D 重复生成拦截', !vd.ok && vd.gates.some(g => g.check === '章节合法性' && g.status === 'fail'), `score=${vd.score}`)

    // 场景 E：第2章 rewrite 模式 → 跳过覆盖拦截（isRewrite=true）
    const ve = await consistencyVerifier.verifyBeforeGeneration(proj.id, 2, { isRewrite: true })
    add('E rewrite 模式放行覆盖', ve.ok && ve.gates.some(g => g.check === '章节合法性' && g.status === 'pass'), `score=${ve.score}`)

    // 场景 F：跳章（第1章存在，直接写第10章）→ warn 不 fail
    const vf = await consistencyVerifier.verifyBeforeGeneration(proj.id, 10)
    add('F 跳章→warn不阻断', vf.ok && vf.gates.some(g => g.check === '时间线单调' && g.status === 'warn'), `score=${vf.score}`)

    // 场景 G：orchestrator 接入（静态验证）
    const orchSrc = require('fs').readFileSync('src/services/hdz/orchestrator.service.ts', 'utf8')
    add('G orchestrator 接入 Gate', orchSrc.includes('verifyBeforeGeneration') && orchSrc.includes("status: 'blocked'"), 'writer 分支前校验 + blocked 状态')

    // 场景 H：空项目（无角色）→ G3 fail
    const projEmpty = await prisma.hdzProject.create({ data: { userId: user.id, title: '__VERIFY_02B_T1_EMPTY__', genre: '玄幻', status: 'active' } })
    const vh = await consistencyVerifier.verifyBeforeGeneration(projEmpty.id, 1)
    add('H 无角色上下文→拦截', !vh.ok && vh.gates.some(g => g.check === '上下文完整性' && g.status === 'fail'), `score=${vh.score}`)
    await prisma.hdzProject.delete({ where: { id: projEmpty.id } })

    const pass = results.every(Boolean)
    console.log(`\n${pass ? '🏆 Task 1 全部验证通过' : '⚠️ 有失败项'}（${results.filter(Boolean).length}/${results.length}）`)
  } finally {
    await prisma.hdzChapter.deleteMany({ where: { projectId: proj.id } })
    await prisma.hdzCharacter.deleteMany({ where: { projectId: proj.id } })
    await prisma.hdzAgentTask.deleteMany({ where: { projectId: proj.id } })
    await prisma.eventLog.deleteMany({ where: { entityId: { startsWith: `${proj.id}:` } } })
    await prisma.hdzProject.deleteMany({ where: { id: proj.id } })
    console.log('🧹 测试数据已清理')
  }
}
main().finally(() => prisma.$disconnect())
