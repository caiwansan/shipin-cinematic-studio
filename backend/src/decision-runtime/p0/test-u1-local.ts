import { findBestSeed, convertAllU0Seeds } from '../p0/u1-seed-matcher.js'
import { DEFAULT_SEEDS } from '../p0/u0-seed-schema.js'

console.log("=== U-1 findBestSeed 测试 ===\n")

const semanticSeeds = convertAllU0Seeds(DEFAULT_SEEDS)

// 领域统计
const byDomain = {} as Record<string, number>
for (const s of semanticSeeds) {
  byDomain[s.domain] = (byDomain[s.domain] || 0) + 1
}
console.log("SemanticSeed 领域分布:", JSON.stringify(byDomain))
console.log("")

const queries = [
  '杭州西湖区最好吃的杭帮菜馆',
  '厦门鼓浪屿民宿推荐',
  '黄山旅游最佳路线',
  '郑州哪家律师事务所比较好',
  '成都春熙路附近的火锅店推荐',
  '西安回民街必吃的美食有哪些',
  '大连海鲜自助餐厅推荐',
  '长沙臭豆腐哪家最好吃',
]

for (const q of queries) {
  const result = findBestSeed(q, semanticSeeds, {})
  console.log(`"${q}"`)
  console.log(`  bestSeed: ${result.bestSeed} (score=${result.bestScore.toFixed(4)}, level=${result.matchLevel})`)
  // 显示 top 3 candidates
  if (result.candidates && result.candidates.length > 0) {
    const top3 = result.candidates.slice(0, 3)
    console.log(`  top3: ${top3.map(c => `${c.seedId}(${c.score.toFixed(3)})`).join(', ')}`)
  }
  console.log("")
}
