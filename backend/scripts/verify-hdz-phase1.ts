/* Phase 1 验证：buildStoryContext → formatStoryContextForLLM 真实输出（tsx 运行） */
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const project = await prisma.hdzProject.findFirst({
    where: { masterPlan: { not: null } },
    select: { id: true, title: true, masterPlan: true },
  })
  if (!project) {
    console.log('⚠️ 无项目有 masterPlan（新项目将走 Phase 2 总纲流程，此验证跳过）')
    return
  }
  console.log(`项目「${project.title}」有 masterPlan，验证 StoryContext 构建...`)

  const { buildStoryContext, formatStoryContextForLLM } = await import('../src/services/hdz/story-context-builder.service.ts')
  const ctx = await buildStoryContext(project.id, 1)
  const text = formatStoryContextForLLM(ctx)

  console.log(`\n═══ StoryContext 输出（${text.length} 字符）═══`)
  console.log(text.slice(0, 1500))
  console.log('\n...（截断）')

  const checks: Array<[string, boolean]> = [
    ['含【小说总规划】', text.includes('小说总规划')],
    ['含【卷规划】', text.includes('卷规划')],
    ['含【世界状态】', text.includes('世界状态')],
    ['含角色状态', text.includes('角色当前状态') || text.includes('**')],
    ['无未替换占位符($STORY_CONTEXT/$TITLE)', !text.includes('$STORY_CONTEXT') && !text.includes('$TITLE')],
    ['consistencyWarnings 正常', Array.isArray(ctx.consistencyWarnings)],
  ]
  let pass = true
  for (const [name, ok] of checks) {
    console.log(`${ok ? '✅' : '❌'} ${name}`)
    if (!ok) pass = false
  }
  console.log(pass ? '\n✅✅✅ Phase 1 上下文构建验证通过' : '\n❌ 有问题')
}
main().finally(() => prisma.$disconnect())
