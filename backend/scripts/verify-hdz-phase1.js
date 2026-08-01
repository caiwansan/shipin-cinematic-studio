require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // 找一个有 masterPlan 的项目
  const project = await prisma.hdzProject.findFirst({
    where: { masterPlan: { not: null } },
    select: { id: true, title: true, masterPlan: true },
  })
  if (!project) {
    console.log('⚠️ 无项目有 masterPlan，无法验证总纲注入（可接受：新项目先走 Phase 2 总纲流程）')
    return
  }
  console.log(`项目「${project.title}」有 masterPlan，开始验证...`)

  const { buildStoryContext, formatStoryContextForLLM } = await import('../src/services/hdz/story-context-builder.service.js')
  const ctx = await buildStoryContext(project.id, 1)
  const text = formatStoryContextForLLM(ctx)

  console.log(`\n═══ StoryContext 输出（${text.length} 字符）═══`)
  console.log(text.slice(0, 1200))
  console.log(`\n...（截断显示）`)

  // 断言
  const checks = [
    ['含小说总规划', text.includes('小说总规划')],
    ['含卷规划', text.includes('卷规划')],
    ['含世界状态段', text.includes('世界状态')],
    ['无未替换占位符', !text.includes('$STORY_CONTEXT') && !text.includes('$TITLE')],
    ['consistencyWarnings 字段存在', Array.isArray(ctx.consistencyWarnings)],
  ]
  let pass = true
  for (const [name, ok] of checks) {
    console.log(`${ok ? '✅' : '❌'} ${name}`)
    if (!ok) pass = false
  }
  console.log(pass ? '\n✅✅✅ Phase 1 上下文构建验证通过' : '\n❌ 有问题')
}
main().finally(() => prisma.$disconnect())
