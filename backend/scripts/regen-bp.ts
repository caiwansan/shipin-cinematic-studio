import { aigcSpecAgent } from '../src/agents/aigc-spec-agent.js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const proj = await prisma.project.findUnique({
    where: { id: 'c2370183-623e-4121-899e-793ecf41ce4e' },
    select: { id: true, name: true, description: true, executionResults: true }
  })

  const er = typeof proj.executionResults === 'string'
    ? JSON.parse(proj.executionResults)
    : (proj.executionResults || {})
  const bp = er.plotBlueprint
  if (!bp?.scenes?.length) { console.log('No scenes'); return }

  // 构建需要传给 plot-supervisor 的场景摘要
  const sceneText = bp.scenes.map((s: any, i: number) =>
    `场景${s.sceneId}: ${s.name}（${s.env}，${s.time}，${s.weather}）\n情绪：${s.mood}\n概要：${s.summary || ''}\n角色：${JSON.stringify(s.characterVariants || {})}`
  ).join('\n---\n')

  const storyText = `故事主题：${bp.theme || ''}
背景：${bp.mood || ''} ${bp.worldView || ''} ${bp.timeline || ''}
角色：${(bp.characters || []).map((c: any) => c.name + '(' + c.role + ')').join('、')}

${sceneText}`

  console.log('Calling AigcSpecAgent for storyboard (plot supervisor)...')
  console.log('Story text length:', storyText.length)

  const result = await aigcSpecAgent.generateSpec({
    text: storyText,
    title: proj.name || '百花仙子',
    userId: '5cbabc6d',
    type: 'storyboard',
  })

  console.log('Result success:', result.success)

  if (result.success && (result as any).rawSpec?.plotBlueprint?.scenes) {
    const newBp = (result as any).rawSpec.plotBlueprint
    const newMap: Record<number, any> = {}
    newBp.scenes.forEach((s: any) => { newMap[s.sceneId] = s })

    bp.scenes = bp.scenes.map((s: any) => ({
      ...s,
      script: newMap[s.sceneId]?.script || ''
    }))

    er.plotBlueprint = bp
    await prisma.project.update({
      where: { id: 'c2370183-623e-4121-899e-793ecf41ce4e' },
      data: { executionResults: er }
    })

    console.log('\n✅ 合并完成')
    bp.scenes.forEach((s: any) => {
      console.log(`  Scene ${s.sceneId} (${s.name}): script=${(s.script || '').substring(0, 80)}`)
    })
  } else {
    console.log('❌ Failed to regenerate plotBlueprint')
    console.log('Error:', (result as any).error)
    console.log('Data keys:', Object.keys(result))
  }

  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
