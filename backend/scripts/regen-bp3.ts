import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

// 系统 prompt
const SYSTEM_PROMPT = readFileSync(
  join(__dirname, '../src/prompts/aigc-spec-system.txt'),
  'utf-8'
)

async function callLLM(messages: any[]) {
  const apiKey = process.env.ALIYUN_API_KEY
  const res = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'qwen-max',
      input: {
        messages,
      },
      parameters: {
        temperature: 0.6,
        max_tokens: 8192,
        result_format: 'message',
      },
    }),
    signal: AbortSignal.timeout(120000),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`API error: ${res.status} ${txt}`)
  }
  const data = await res.json()
  return data?.output?.choices?.[0]?.message?.content || data?.output?.text || ''
}

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

  // 构建带已有数据的 prompt
  const scenesData = bp.scenes.map((s: any) => ({
    sceneId: s.sceneId,
    name: s.name,
    env: s.env,
    time: s.time,
    weather: s.weather,
    mood: s.mood,
    summary: s.summary || '',
    description: s.description || '',
    characters: s.characterVariants || {},
  }))

  const userPrompt = `你是剧情总指挥 Agent。根据以下故事数据和已有场景信息，为每个场景输出完整剧本片段。

要求：
1. 每个场景的 script 字段必须是 80-150 字的完整剧本，包含：
   - 角色入场顺序和动作
   - 角色之间的对话（对白用引号标注）
   - 情绪变化节点
   - 退场或结束状态

2. 保持 sceneId、name 等已有字段不变

3. 输出 JSON 格式：{"scenes": [{"sceneId": 1, "script": "...", ...}, ...]}

已有场景数据：
${JSON.stringify(scenesData, null, 2)}`

  console.log('Calling LLM (qwen-max)...')
  const result = await callLLM([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ])
  console.log('Result length:', result.length)

  // 提取 JSON
  const match = result.match(/\{[\s\S]*\}/)
  if (match) {
    const parsed = JSON.parse(match[0])
    const newScenes = parsed.scenes || parsed
    if (Array.isArray(newScenes) && newScenes.length > 0) {
      const newMap: Record<number, any> = {}
      newScenes.forEach((s: any) => { newMap[s.sceneId] = s })

      bp.scenes = bp.scenes.map((s: any) => ({
        ...s,
        script: newMap[s.sceneId]?.script || ''
      }))

      er.plotBlueprint = bp
      await prisma.project.update({
        where: { id: 'c2370183-623e-4121-899e-793ecf41ce4e' },
        data: { executionResults: er }
      })

      console.log('\n✅ 合并完成！')
      bp.scenes.forEach((s: any) => {
        console.log(`\nScene ${s.sceneId} (${s.name || ''}):`)
        console.log(`  script: ${(s.script || 'N/A').substring(0, 100)}`)
      })
    } else {
      console.log('Unexpected response format:', JSON.stringify(parsed).substring(0, 300))
    }
  } else {
    console.log('No JSON found in response. Raw:')
    console.log(result.substring(0, 800))
  }

  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
