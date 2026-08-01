require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

/**
 * Task 4 验证：剧情一致性引擎（verifyChapterText + reviewer 集成）
 * 复用确认：consistency-verifier.service.ts 已存在（5 维 delta 校验 + shadow 钩子），本次补文本级校验
 */
async function main() {
  const results = []
  const add = (n, ok, d) => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${n} — ${d}`) }

  const user = await prisma.user.findFirst()
  if (!user) { console.log('⚠️ 无用户'); return }

  const proj = await prisma.hdzProject.create({
    data: { userId: user.id, title: '__VERIFY_02A_T4__', genre: '玄幻', status: 'active' },
  })
  // 角色A：已死亡（identity 含死亡）
  const deadChar = await prisma.hdzCharacter.create({
    data: { projectId: proj.id, name: '青云老祖', role: 'supporting', properties: {} },
  })
  // 角色B：正常（物品已失去）
  const aliveChar = await prisma.hdzCharacter.create({
    data: { projectId: proj.id, name: '林凡', role: 'protagonist', properties: {} },
  })
  // 死亡状态（chapterNo=5 前死亡）
  await prisma.hdzCharacterState.create({
    data: { projectId: proj.id, characterId: deadChar.id, chapterNo: 5, stateType: 'IDENTITY', event: '殒命', description: '青云老祖陨落', severity: 'critical' },
  })
  // 物品失去状态
  await prisma.hdzCharacterState.create({
    data: { projectId: proj.id, characterId: aliveChar.id, chapterNo: 6, stateType: 'ITEM', event: '失去', description: '屠龙刀', severity: 'high' },
  })

  try {
    const { consistencyVerifier } = require('../src/services/hdz/consistency-verifier.service.js')

    // 场景 A：第8章正文，死亡角色在说话 → 警告
    const textA = '林凡看着眼前的敌人，突然听到一个声音。青云老祖缓缓说道：「徒儿，为师来助你！」众人皆惊。'
    const va = await consistencyVerifier.verifyChapterText(proj.id, 8, textA)
    add('A 死亡角色行动→警告', va.warnings.some(w => w.includes('青云老祖') && w.includes('死亡')), `warnings=${va.warnings.length}, score=${va.score}`)

    // 场景 B：第8章正文，已失去物品在使用 → 警告
    const textB = '林凡手持屠龙刀，一刀斩出，刀光映照天地。'
    const vb = await consistencyVerifier.verifyChapterText(proj.id, 8, textB)
    add('B 失去物品在用→警告', vb.warnings.some(w => w.includes('屠龙刀') && w.includes('失去')), `warnings=${vb.warnings.length}, score=${vb.score}`)

    // 场景 C：干净章节（回忆场景明确标注）→ 无警告
    const textC = '林凡回想起青云老祖生前的教诲，不禁握紧了拳头。他在梦中再次见到师父的身影。'
    const vc = await consistencyVerifier.verifyChapterText(proj.id, 8, textC)
    add('C 回忆/梦境场景不误报', vc.warnings.filter(w => w.includes('青云老祖')).length === 0, `warnings=${vc.warnings.length}, score=${vc.score}`)

    // 场景 D：空文本 → 直接通过
    const vd = await consistencyVerifier.verifyChapterText(proj.id, 8, '')
    add('D 空文本通过', vd.ok && vd.score === 100, `score=${vd.score}`)

    // 场景 E：reviewer 集成（静态验证：预检调用 + 警告注入 + 结果存储）
    const reviewerSrc = require('fs').readFileSync('src/services/hdz/reviewer.service.ts', 'utf8')
    add('E reviewer 接入一致性预检', reviewerSrc.includes('verifyChapterText') && reviewerSrc.includes('一致性预检警告'), '预检调用 + 警告注入 prompt')
    add('E 预检结果存入 reviewData', reviewerSrc.includes('consistencyWarnings,') && reviewerSrc.includes('consistencyScore,'), '结果随审核数据落库')

    const pass = results.every(Boolean)
    console.log(`\n${pass ? '🏆 Task 4 全部验证通过' : '⚠️ 有失败项'}（${results.filter(Boolean).length}/${results.length}）`)
  } finally {
    await prisma.hdzCharacterState.deleteMany({ where: { projectId: proj.id } })
    await prisma.hdzCharacter.deleteMany({ where: { projectId: proj.id } })
    await prisma.eventLog.deleteMany({ where: { entityId: { startsWith: `${proj.id}:` } } })
    await prisma.hdzProject.deleteMany({ where: { id: proj.id } })
    console.log('🧹 测试数据已清理')
  }
}
main().finally(() => prisma.$disconnect())
