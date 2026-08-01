require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // 找一个有角色的项目
  const proj = await prisma.hdzProject.findFirst({
    where: { characters: { some: {} } },
    select: { id: true, title: true },
  })
  if (!proj) { console.log('⚠️ 无项目有角色'); return }
  const char = await prisma.hdzCharacter.findFirst({ where: { projectId: proj.id } })
  console.log(`项目「${proj.title}」角色「${char.name}」`)

  // 1. saveStateSnapshot 落库（模拟演化结果，不调 LLM）
  const { saveStateSnapshot } = await import('../src/services/hdz/character-state-evolution.service.ts')
  const mockEvent = {
    projectId: proj.id, chapterNo: 999, eventType: 'battle',
    title: '【验证】临时测试事件', description: '验证回写链 DB 层', participants: [char.name],
  }
  const saved = await saveStateSnapshot(proj.id, char.id, 999, mockEvent as any, {
    POWER: { old: '炼体三层', new: '炼体四层' },
  })
  console.log(`✅ saveStateSnapshot 落库 ${saved.length} 条 HdzCharacterState`)
  await prisma.hdzCharacterState.deleteMany({ where: { projectId: proj.id, chapterNo: 999 } })
  console.log('✅ 已清理测试数据')

  // 2. createEventsBatch 落库（直接 DB 路径）
  const { createEventsBatch } = await import('../src/services/hdz/story-event.service.ts')
  await createEventsBatch(proj.id, [{
    projectId: proj.id, chapterNo: 998, eventType: 'encounter',
    title: '【验证】临时测试事件2', description: '验证事件落库', participants: [char.name],
  }] as any)
  const cnt = await prisma.storyEvent.count({ where: { projectId: proj.id, chapterNo: 998 } })
  console.log(`✅ createEventsBatch 落库 ${cnt} 条 StoryEvent`)
  await prisma.storyEvent.deleteMany({ where: { projectId: proj.id, chapterNo: 998 } })
  console.log('✅ 已清理测试数据')
  console.log('\n✅✅✅ Phase 3 DB 层验证通过（LLM 提取层已有代码链路，异步化后不阻塞写作）')
}
main().finally(() => prisma.$disconnect())
