// Quick 10-shot production test runner
// Uses compiled dist modules directly

const path = require('path')
const productionLoop = path.resolve(__dirname, '../dist/production-loop')

async function main() {
  console.log('🚀 Running 10-shot Production Test (via dist)')
  console.log('===========================================')

  const { productionRunner } = require(path.join(productionLoop, 'production-runner'))

  const shots = [
    { shotNumber: 1, sceneNumber: 1, description: 'Wide shot of misty bamboo forest at dawn', emotion: 'peaceful', camera: 'wide', duration: '8s' },
    { shotNumber: 2, sceneNumber: 1, description: 'Medium tracking shot following lone figure on stone path', emotion: 'graceful', camera: 'tracking', duration: '10s' },
    { shotNumber: 3, sceneNumber: 1, description: 'Close up of hand reaching to touch bamboo stalk with dew', emotion: 'tender', camera: 'close-up', duration: '6s' },
    { shotNumber: 4, sceneNumber: 2, description: 'Interior of dimly lit wooden tea house with candle and cups', emotion: 'intimate', camera: 'wide', duration: '8s' },
    { shotNumber: 5, sceneNumber: 2, description: 'Two hands reaching for same cup hovering in candlelight', emotion: 'tense', camera: 'close-up', duration: '5s' },
    { shotNumber: 6, sceneNumber: 2, description: 'Slow dolly into face of woman lit by candlelight, rain outside', emotion: 'melancholy', camera: 'dolly', duration: '9s' },
    { shotNumber: 7, sceneNumber: 3, description: 'Wide shot of wooden bridge over stream at dusk with lanterns', emotion: 'magical', camera: 'wide', duration: '8s' },
    { shotNumber: 8, sceneNumber: 3, description: 'Low angle shot of bridge structure with rain falling in sheets', emotion: 'dramatic', camera: 'low-angle', duration: '6s' },
    { shotNumber: 9, sceneNumber: 3, description: 'Figure at bridge highest point looking outward as rain clears', emotion: 'peaceful', camera: 'wide', duration: '12s' },
    { shotNumber: 10, sceneNumber: 3, description: 'Final wide shot of landscape at dawn, mist rising over valley', emotion: 'peaceful', camera: 'wide', duration: '10s' },
  ]

  const result = await productionRunner.run({
    projectId: 'prod-10shots-v2',
    sceneId: 'bamboo-forest',
    shots,
    sceneContext: {
      genre: 'historical-drama',
      artStyle: 'cinematic',
      era: 'classical-chinese',
      tone: 'poetic',
      aspectRatio: '16:9',
    },
    qualityTier: 'balanced',
  })

  console.log('\n📊 RESULTS')
  console.log('==========')
  console.log(`Run:      ${result.runId}`)
  console.log(`Duration: ${result.summary.totalDuration}ms`)
  console.log(`Success:  ${result.summary.successRate} (${result.shots.filter(s => s.success).length}/${result.shots.length})`)
  console.log(`SLA Pass: ${result.summary.slaPassRate}`)
  console.log(`Avg Lat:  ${result.summary.avgLatencyMs}ms`)

  console.log('\nPer-shot:')
  for (const s of result.shots) {
    const slaNote = s.slaViolations.length ? ` ⚠️ ${s.slaViolations.length}v` : ''
    console.log(`  Shot ${String(s.shotNumber).padStart(2)}: ${s.success ? '✅' : '❌'} ${String(s.latencyMs).padStart(5)}ms  $${(s.cost || 0).toFixed(4)}${slaNote}`)
  }

  console.log('\n🧠 Cost Learner Stats:')
  const { costLearner } = require(path.join(productionLoop, 'cost-learner'))
  console.log(JSON.stringify(costLearner.getStats(), null, 2))

  console.log('\n🏁 DONE')
}

main().catch(err => {
  console.error('FATAL:', err.message)
  process.exit(1)
})
