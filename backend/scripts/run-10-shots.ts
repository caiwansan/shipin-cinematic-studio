// 10-shot Production Test
// Runs 10 real storyboard shots through the full pipeline

import { productionRunner } from '../src/production-loop/production-runner.js'
import type { StoryboardShot } from '../src/production-loop/prompt-compiler.js'

async function main() {
  console.log('🚀 Starting 10-shot Production Test')
  console.log('================================')

  const shots: StoryboardShot[] = [
    {
      shotNumber: 1, sceneNumber: 1,
      description: 'Wide establishing shot of a misty bamboo forest at dawn. Light streams through tall stalks. A winding stone path disappears into the fog.',
      emotion: 'peaceful', camera: 'wide', duration: '8s',
    },
    {
      shotNumber: 2, sceneNumber: 1,
      description: 'Medium tracking shot following a lone figure in a flowing white robe walking along the stone path. Her feet step lightly on fallen bamboo leaves.',
      emotion: 'graceful', camera: 'tracking', duration: '10s',
    },
    {
      shotNumber: 3, sceneNumber: 1,
      description: 'Close up of the figure\'s hand reaching out to touch a bamboo stalk. Dew drops glisten on the green surface. Her fingers brush against it gently.',
      emotion: 'tender', camera: 'close-up', duration: '6s',
    },
    {
      shotNumber: 4, sceneNumber: 1,
      description: 'Overhead shot looking down through bamboo canopy. The figure walks beneath, small against nature. Mist swirls between the tall stalks.',
      emotion: 'awe', camera: 'overhead', duration: '7s',
    },
    {
      shotNumber: 5, sceneNumber: 2,
      description: 'Interior of a dimly lit wooden tea house. A single candle flickers on a low table. Steam rises from two ceramic cups. Rain can be heard outside.',
      emotion: 'intimate', camera: 'wide', duration: '8s',
    },
    {
      shotNumber: 6, sceneNumber: 2,
      description: 'Reverse angle shot of two hands reaching for the same cup. They pause, hovering. The candlelight catches gold rings on one hand.',
      emotion: 'tense', camera: 'close-up', duration: '5s',
    },
    {
      shotNumber: 7, sceneNumber: 2,
      description: 'Slow dolly into the face of a woman illuminated by candlelight. Rain streaks visible through the window behind her. Her eyes reflect the flame.',
      emotion: 'melancholy', camera: 'dolly', duration: '9s',
    },
    {
      shotNumber: 8, sceneNumber: 3,
      description: 'Wide shot of a traditional wooden bridge over a rain-swollen stream at dusk. Orange lanterns cast warm pools of light. Fireflies drift in the dark.',
      emotion: 'magical', camera: 'wide', duration: '8s',
    },
    {
      shotNumber: 9, sceneNumber: 3,
      description: 'Low angle shot looking up at the bridge structure. Rain falls in sheets. The wooden beams glisten wet under lantern light.',
      emotion: 'dramatic', camera: 'low-angle', duration: '6s',
    },
    {
      shotNumber: 10, sceneNumber: 3,
      description: 'Final shot: the figure stands at the bridge\'s highest point, looking outward. The rain begins to clear. A sliver of moon appears between clouds. She closes her eyes.',
      emotion: 'peaceful', camera: 'wide', duration: '12s',
    },
  ]

  const result = await productionRunner.run({
    projectId: 'prod-test-10shots',
    sceneId: 'scene-1-2-3',
    shots,
    sceneContext: {
      genre: 'historical-drama',
      artStyle: 'cinematic',
      era: 'classical-chinese',
      tone: 'poetic',
      aspectRatio: '16:9',
      flashback: false,
    },
    qualityTier: 'balanced',
  })

  // Pretty print summary
  console.log('\n📊 Production Run Complete')
  console.log('========================')
  console.log(`Run ID:   ${result.runId}`)
  console.log(`Duration: ${result.summary.totalDuration}ms`)
  console.log(`Shots:    ${result.shots.length}`)
  console.log(`Success:  ${result.summary.successRate} (${result.shots.filter(s => s.success).length}/${result.shots.length})`)
  console.log(`SLA Pass: ${result.summary.slaPassRate}`)
  console.log(`Total Cost:  $${result.summary.totalCost.toFixed(4)}`)
  console.log(`Avg Latency: ${result.summary.avgLatencyMs}ms`)
  console.log()

  // Per-shot breakdown
  console.log('Per-shot breakdown:')
  for (const shot of result.shots) {
    const slaInfo = shot.slaViolations.length > 0 ? ` ⚠️ ${shot.slaViolations.length} SLA violations` : ''
    console.log(`  Shot ${shot.shotNumber}: ${shot.success ? '✅' : '❌'} ${shot.latencyMs}ms $${shot.cost}${slaInfo}`)
  }

  console.log('\n=== Cost Learner Stats ===')
  console.log(JSON.stringify(result.summary.costLearnerStats, null, 2))
  console.log('\n=== SLA Status ===')
  console.log(JSON.stringify(result.summary.slaStatus, null, 2))

  // Summary
  const totalLatency = result.shots.reduce((s, r) => s + r.latencyMs, 0)
  console.log(`\n🏁 Total wall time: ${result.summary.totalDuration}ms (avg ${result.summary.avgLatencyMs}ms/shot)`)
  console.log(`💰 Cost (mock): $0.00 — REPLICATE_KEY → real video`)
}

main().catch(console.error)
