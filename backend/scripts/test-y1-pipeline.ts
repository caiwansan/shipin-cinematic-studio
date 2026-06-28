/**
 * scripts/test-y1-pipeline.ts
 * 测试 Y.1 Narrative Reader pipeline
 *
 * 用法：npx tsx scripts/test-y1-pipeline.ts
 */

import { initY1Pipeline, runY1Pipeline } from '../src/services/narrative-reader/index.js'
import { getEventLogByDoc } from '../src/services/narrative-reader/storage/event_store.js'
import { getDriftTimeline } from '../src/services/narrative-reader/observation/drift.js'

async function main() {
  // 初始化
  const ready = await initY1Pipeline()
  if (!ready) {
    console.log('❌ Gemma 3 270M 不可用')
    process.exit(1)
  }
  console.log('✅ Gemma 3 270M 就绪')

  // 测试文本
  const testText = `十二岁的陆云舟坐在渔村海边的礁石上，等待父亲归航。黄昏时分，天边忽然有两道璀璨光芒如流星般坠下，照亮了整个海面。他还没反应过来，那道光芒便已落在渔村上空。

巨大的冲击波将他震晕。等他醒来时，发现渔村已经化为废墟，母亲在废墟中永远闭上了眼睛，父亲不知所踪。陆云舟跪在废墟前，握紧双拳。

"我要找到你们，无论你们是谁。"

次日清晨，一艘黑色大船出现在海平面上。船上走下一个身穿道袍的中年男子，他扫视废墟，目光落在陆云舟身上。

"这孩子身上有灵气波动。"男子说道，"跟我走吧，小子。你我有师徒之缘。"

陆云舟抬起头，眼中带着恨意。"你能帮我变强吗？"

"能让你比任何人都强。"

"那我跟你走。"

陆云舟回头看了一眼废墟，头也不回地上了船。黑色大船消失在晨雾中。`

  const docId = 'test-novel-001'

  // 运行 pipeline
  console.log('\n🚀 运行 Y.1 pipeline...')
  const result = await runY1Pipeline(testText, docId, 'test-ch001')
  console.log(`\n📊 结果: ${result.succeeded}/${result.totalChunks} chunks OK, ${result.failed} failed`)
  if (result.errors.length > 0) {
    console.log('错误:', result.errors.slice(0, 3))
  }

  // 查看 EventLog
  console.log('\n📝 EventLog 记录:')
  const logs = await getEventLogByDoc(docId)
  for (const log of logs) {
    const entities = (log.entities as any[]) || []
    const events = (log.events as any[]) || []
    const relations = (log.relations as any[]) || []
    console.log(`  ${log.chunkId}: entities=${entities.length}, events=${events.length}, relations=${relations.length}`)
    console.log(`    summary: ${(log.summaryState as any)?.scene_state || 'N/A'}`)
    if (entities.length > 0) {
      console.log(`    entities: [${entities.map((e: any) => e.name).join(', ')}]`)
    }
  }

  // 查看 Drift
  console.log('\n📈 Drift 趋势:')
  const drift = await getDriftTimeline(docId)
  for (const d of drift) {
    console.log(`  ${d.chunkId}: entities=${d.entityCount}, events=${d.eventCount}, density=${d.relationDensity.toFixed(2)}, entropy=${d.entropyProxy.toFixed(2)}`)
  }

  console.log('\n✅ Y.1 pipeline test complete')
}

main().catch(console.error)
