require('dotenv').config()
const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

/**
 * Task 3 验证：人物心理状态卡（CharacterMindState）
 * 链路：GET 自动初始化 → PUT 校正 → 回写聚合（MENTAL 事件）→ 上下文注入
 */
async function main() {
  const results = []
  const add = (n, ok, d) => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${n} — ${d}`) }

  const user = await prisma.user.findFirst()
  if (!user) { console.log('⚠️ 无用户'); return }
  const token = jwt.sign({ id: user.id, email: user.email, tokenVersion: user.tokenVersion || 1 }, process.env.JWT_SECRET)
  const BASE = 'http://127.0.0.1:4002'
  const H = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }

  const proj = await prisma.hdzProject.create({
    data: { userId: user.id, title: '__VERIFY_02A_T3__', genre: '玄幻', status: 'active' },
  })
  const char = await prisma.hdzCharacter.create({
    data: {
      projectId: proj.id, name: '林凡', role: 'protagonist',
      properties: { personality: '谨慎稳重、隐忍理智', motivation: '守护家人，为师父复仇', background: '幼年失去双亲，被师父收养' },
      arc: '从复仇者到守护者',
    },
  })

  try {
    // 1. GET 自动初始化（规则从 properties 提取）
    let r = await fetch(`${BASE}/api/hdz/projects/${proj.id}/character-minds/${char.id}`, { headers: H })
    let j = await r.json()
    const mind = j.data
    add('1 GET 自动初始化', j.success && mind?.id, `desire=${mind?.desire?.slice(0, 20)}...`)
    add('1 初始化含欲望(动机)', mind?.desire?.includes('复仇') || mind?.desire?.includes('守护'), `desire=${mind?.desire}`)
    add('1 初始化含创伤(背景)', mind?.trauma?.includes('失去') || mind?.trauma?.includes('双亲'), `trauma=${mind?.trauma?.slice(0, 40)}`)
    add('1 初始化含信念(性格)', mind?.belief?.includes('性格底色'), `belief=${mind?.belief?.slice(0, 30)}`)

    // 2. PUT 用户校正
    r = await fetch(`${BASE}/api/hdz/projects/${proj.id}/character-minds/${char.id}`, {
      method: 'PUT', headers: H,
      body: JSON.stringify({ fear: '害怕再次失去亲人', moralBoundary: '不伤无辜', chapterNo: 5 }),
    })
    j = await r.json()
    add('2 PUT 校正成功', j.success && j.data?.fear === '害怕再次失去亲人', `fear=${j.data?.fear}`)
    add('2 道德底线写入', j.data?.moralBoundary === '不伤无辜', `moralBoundary=${j.data?.moralBoundary}`)

    // 3. 回写聚合：MENTAL 事件 → summary + 漂移检测（谨慎底色 + 冲动事件 → 警告）
    const { updateMindStateFromEvents } = require('../src/services/hdz/character-mind.service.js')
    await updateMindStateFromEvents(proj.id, char.id, 6, [
      { event: '暴怒失控', description: '得知仇人下落，不顾一切冲入敌营' },
    ])
    const after = await prisma.characterMindState.findUnique({ where: { projectId_characterId: { projectId: proj.id, characterId: char.id } } })
    add('3 MENTAL 事件聚合进 summary', after.summary?.includes('第6章') && after.summary?.includes('暴怒失控'), `summary=${after.summary?.slice(0, 50)}`)
    add('3 漂移警告生成', after.personalityDrift?.includes('漂移'), `drift=${after.personalityDrift?.slice(0, 50)}`)

    // 4. 上下文注入：buildStoryContext 角色段含心理档案
    const { buildStoryContext, formatStoryContextForLLM } = require('../src/services/hdz/story-context-builder.service.js')
    const ctx = await buildStoryContext(proj.id, 6)
    const charCtx = ctx.characters.find(c => c.id === char.id)
    add('4 StoryContext 角色带 mindState', !!charCtx?.mindState?.fear, `mindState.fear=${charCtx?.mindState?.fear?.slice(0, 15)}`)
    const text = formatStoryContextForLLM(ctx)
    add('4 LLM 上下文含心理档案段', text.includes('🧠 心理档案') && text.includes('恐惧'), '角色段含 🧠 心理档案')

    // 5. GET 全部
    r = await fetch(`${BASE}/api/hdz/projects/${proj.id}/character-minds`, { headers: H })
    j = await r.json()
    add('5 GET 全部含角色名', j.success && j.data.some(m => m.character?.name === '林凡'), `count=${j.data.length}`)

    const pass = results.every(Boolean)
    console.log(`\n${pass ? '🏆 Task 3 全部验证通过' : '⚠️ 有失败项'}（${results.filter(Boolean).length}/${results.length}）`)
  } finally {
    await prisma.characterMindState.deleteMany({ where: { projectId: proj.id } })
    await prisma.hdzCharacterState.deleteMany({ where: { projectId: proj.id } })
    await prisma.hdzCharacter.deleteMany({ where: { projectId: proj.id } })
    await prisma.hdzProject.deleteMany({ where: { id: proj.id } })
    console.log('🧹 测试数据已清理')
  }
}
main().finally(() => prisma.$disconnect())
