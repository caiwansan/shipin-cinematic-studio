require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

/**
 * Task 1 离线验证：审批状态机修复（不调 LLM）
 * 三路径：
 *   A. 用户「拒绝」→ 触发 writer rewrite（带批评意见）
 *   B. 用户「通过」未达标章节 → reviewed + 真实 user_approved
 *   C. 合格自动路径 → reviewed + reviewer_pass（回归）
 */
async function main() {
  const results = []
  const add = (n, ok, d) => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${n} — ${d}`) }

  // 测试项目 + 章节
  const proj = await prisma.hdzProject.create({
    data: {
      userId: '00000000-0000-4000-8000-000000000001', // 测试用户（不存在也可，仅占位）
      title: '__VERIFY_REALITY_02A__',
      genre: '玄幻', status: 'active',
    },
  })
  const ch = await prisma.hdzChapter.create({
    data: { projectId: proj.id, chapterNo: 1, title: '测试章', status: 'draft', content: '测试内容' },
  })

  // 伪造 reviewer 任务（未达标 score=60 < pass）
  const fakeTask = {
    id: 'verify-fake-reviewer',
    projectId: proj.id,
    agentType: 'reviewer',
    status: 'waiting_approval',
    input: { chapterNo: 1 },
    output: { score: 60, issues: [{ issue: '水', severity: 'high' }] },
  }

  const { hdzOrchestrator } = require('../src/services/hdz/orchestrator.service.js')

  // mock executeTask：绝对不调 LLM
  const origExec = hdzOrchestrator.executeTask
  const createdTaskIds = []
  hdzOrchestrator.executeTask = async (taskId) => {
    createdTaskIds.push(taskId)
    console.log(`  [MOCK] executeTask(${taskId}) 被调用（不执行，仅记录）`)
  }

  try {
    // ── 路径 A：用户拒绝 → rewrite ──
    await hdzOrchestrator.continueChain(fakeTask, '剧情太水，主角降智', true)
    const rewriteTask = await prisma.hdzAgentTask.findUnique({ where: { id: createdTaskIds[0] } })
    add('A 拒绝→创建 rewrite 任务', !!rewriteTask && rewriteTask.agentType === 'writer' && rewriteTask.input?.mode === 'rewrite',
      `task=${rewriteTask?.id?.slice(0,8)}, mode=${rewriteTask?.input?.mode}, chapterNo=${rewriteTask?.input?.chapterNo}`)
    add('A 批评意见传入 rewrite', (rewriteTask?.input?.userInput || '').includes('剧情太水'),
      'userInput 含用户批评意见')
    const chAfterA = await prisma.hdzChapter.findUnique({ where: { projectId_chapterNo: { projectId: proj.id, chapterNo: 1 } } })
    add('A 拒绝后章节不被标 reviewed', chAfterA.status === 'draft', `status=${chAfterA.status}`)

    // ── 路径 B：用户「通过」未达标章节 → reviewed + 真实 user_approved ──
    await hdzOrchestrator.continueChain(fakeTask, '用户说可以', false)
    const chAfterB = await prisma.hdzChapter.findUnique({ where: { projectId_chapterNo: { projectId: proj.id, chapterNo: 1 } } })
    add('B 用户通过→章节 reviewed', chAfterB.status === 'reviewed', `status=${chAfterB.status}`)
    const evtB = await prisma.eventLog.findFirst({
      where: { entityId: `${proj.id}:1`, eventType: 'CHAPTER_STATUS_CHANGED' },
      orderBy: { createdAt: 'desc' },
    })
    add('B 事件真实标记 user_approved', evtB?.payload?.source === 'user_approved' && evtB?.payload?.note === '用户说可以',
      `source=${evtB?.payload?.source}, note=${evtB?.payload?.note}`)

    // ── 路径 C：合格自动 → reviewed + reviewer_pass（回归）──
    const passTask = { ...fakeTask, output: { score: 96 } }
    await hdzOrchestrator.continueChain(passTask, undefined, false)
    const evtC = await prisma.eventLog.findFirst({
      where: { entityId: `${proj.id}:1`, eventType: 'CHAPTER_STATUS_CHANGED' },
      orderBy: { createdAt: 'desc' },
    })
    add('C 合格→reviewer_pass', evtC?.payload?.source === 'reviewer_pass' && evtC?.payload?.score === 96,
      `source=${evtC?.payload?.source}, score=${evtC?.payload?.score}`)

    // ── 路径 D：executeTask 短路已移除（静态）──
    const src = require('fs').readFileSync('src/services/hdz/orchestrator.service.ts', 'utf8')
    add('D 无 waiting_approval→completed 强制短路', !src.includes('自动改为 completed 以触发飞轮') && src.includes("保持 waiting_approval，等待用户审批"),
      '强制短路代码已删除，保留等待审批')

    const pass = results.every(Boolean)
    console.log(`\n${pass ? '🏆 Task 1 全部验证通过' : '⚠️ 有失败项'}（${results.filter(Boolean).length}/${results.length}）`)
  } finally {
    hdzOrchestrator.executeTask = origExec
    // 清理：删除测试任务 + 项目（级联删章节/事件）
    await prisma.hdzAgentTask.deleteMany({ where: { projectId: proj.id } })
    await prisma.eventLog.deleteMany({ where: { entityId: { startsWith: `${proj.id}:` } } })
    await prisma.hdzChapter.deleteMany({ where: { projectId: proj.id } })
    await prisma.hdzProject.deleteMany({ where: { id: proj.id } })
    console.log('🧹 测试数据已清理')
  }
}
main().finally(() => prisma.$disconnect())
