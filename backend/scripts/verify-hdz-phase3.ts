/* Phase 3 验证：processChapterEvents 真实回写（事件 + 角色状态落库） */
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const ch = await prisma.hdzChapter.findFirst({
    where: { status: { in: ['reviewed', 'waiting_approval', 'final'] }, content: { not: null } },
    select: { id: true, projectId: true, chapterNo: true, title: true, content: true },
    orderBy: { chapterNo: 'asc' },
  })
  if (!ch || !ch.content) { console.log('⚠️ 无已完成且有内容的章节'); return }
  const proj = await prisma.hdzProject.findUnique({ where: { id: ch.projectId }, select: { userId: true, title: true } })
  console.log(`项目「${proj?.title}」第${ch.chapterNo}章「${ch.title}」回写验证（正文 ${ch.content.length} 字）...`)

  const { processChapterEvents } = await import('../src/services/hdz/event-extractor.service.ts')
  const t0 = Date.now()
  const { events, statesCreated } = await processChapterEvents(ch.projectId, ch.chapterNo, ch.content, proj.userId)
  console.log(`⏱ ${Date.now() - t0}ms | 提取事件 ${events.length} 个 | 状态变化 ${statesCreated} 条`)

  // 查库确认
  const dbEvents = await prisma.storyEvent.count({ where: { projectId: ch.projectId, chapterNo: ch.chapterNo } })
  const dbStates = await prisma.hdzCharacterState.count({ where: { projectId: ch.projectId, chapterNo: ch.chapterNo } })
  console.log(`📦 落库确认: StoryEvent=${dbEvents}, HdzCharacterState=${dbStates}`)

  const pass = events.length > 0 && dbEvents > 0
  console.log(pass ? '\n✅✅✅ Phase 3 回写链验证通过' : '\n⚠️ 事件为空（可能是 LLM 判定本章无重大事件）')
}
main().finally(() => prisma.$disconnect())
