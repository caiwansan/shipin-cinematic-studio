import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const proj = await prisma.project.findUnique({
    where: { id: 'c2370183-623e-4121-899e-793ecf41ce4e' },
    select: { id: true, name: true, executionResults: true }
  })

  const er = typeof proj.executionResults === 'string'
    ? JSON.parse(proj.executionResults)
    : (proj.executionResults || {})
  const bp = er.plotBlueprint
  if (!bp?.scenes?.length) { console.log('No scenes'); return }

  // 直接调 AI 为每个场景生成 script
  // 先试批量调 deepseek
  const sceneData = bp.scenes.map((s: any) => ({
    sceneId: s.sceneId,
    name: s.name,
    summary: s.summary || '',
    characters: s.characterVariants || {},
    env: s.env,
    time: s.time,
  }))

  // 调 narrativeLLM 路由（走统一队列）
  const prompt = `你是剧情总指挥 Agent。为以下 8 个场景，输出每个场景的完整剧本片段。

每个场景的 script 要求：
- 80-150 字
- 包含角色动作和对白（对白用引号标注）
- 包含角色入场/退场顺序
- 以"【场景】"开始

场景数据：
${JSON.stringify(sceneData, null, 2)}

只输出剧本内容，不是 JSON。按场景编号顺序输出。`

  // 直接用 curl 调本地 api
  console.log('Calling AI...')
  const res = await fetch('http://localhost:4002/api/v1/narrative/llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      systemPrompt: '你是一名专业影视编剧',
      userId: 'anonymous',
      model: 'deepseek-chat',
    }),
    signal: AbortSignal.timeout(60000),
  })
  const result = await res.json()
  console.log('Response:', JSON.stringify(result).substring(0, 500))

  // 如果 narrative/llm 不行，换其他路由
  // 先看看有什么可用的 API

  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
