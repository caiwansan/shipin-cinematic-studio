import { findBestSeed, convertAllU0Seeds } from './src/decision-runtime/p0/u1-seed-matcher.js'
import { DEFAULT_SEEDS } from './src/decision-runtime/p0/u0-seed-schema.js'

const semanticSeeds = convertAllU0Seeds(DEFAULT_SEEDS)
console.log("semanticSeeds count:", semanticSeeds.length)
const enterpriseSeeds = semanticSeeds.filter(s => s.domain === 'enterprise')
console.log("enterprise seeds:", enterpriseSeeds.map(s => s.id))
console.log("enterprise-company keywords:", enterpriseSeeds.find(s => s.id === 'enterprise-company')?.keywords)
console.log("")

const queries = [
  '阿里巴巴最新财报分析',
  '华为公司最新动态',
  '比亚迪销量',
  '2025年互联网公司排名',
]

for (const q of queries) {
  const result = findBestSeed(q, semanticSeeds, {})
  console.log(`"${q}"`)
  console.log(`  bestSeed: ${result.bestSeed} (score=${result.bestScore?.toFixed(4)}, level=${result.matchLevel})`)
  if (result.candidates && result.candidates.length > 0) {
    const top3 = result.candidates.slice(0, 3)
    console.log(`  top3: ${top3.map(c => `${c.seedId}(${c.score.toFixed(3)})`).join(', ')}`)
  }
  console.log('')
}
