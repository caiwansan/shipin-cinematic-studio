import { matchSeeds, DEFAULT_SEEDS } from '../p0/u0-seed-schema.js'

const queries = [
  '杭州西湖区最好吃的杭帮菜馆',
  '成都春熙路附近的火锅店推荐',
  '黄山旅游最佳路线',
  '厦门鼓浪屿民宿推荐',
  '郑州哪家律师事务所比较好',
  '西安回民街必吃的美食有哪些',
  '上海浦东三甲医院哪家好',
  '深圳福田区哪个驾校好',
  '深圳南山区幼儿园排名',
  '成都比较好的装修公司推荐',
  '拉萨高原反应怎么预防',
  '旅游保险有必要买吗',
  '大连海鲜自助餐厅推荐',
  '大理洱海骑行路线',
  '长沙臭豆腐哪家最好吃',
]

console.log('=== Seed 总数:', DEFAULT_SEEDS.length, '===\n')

for (const q of queries) {
  const matched = matchSeeds(q)
  const matchedNames = matched.map(m => m.seed.id).join(', ')
  console.log(`${matched.length > 0 ? '✓' : '✗'} "${q}"`)
  if (matched.length > 0) {
    console.log(`   → ${matchedNames}`)
  }
}

// 领域统计
const byDomain = {} as Record<string, number>
for (const s of DEFAULT_SEEDS) {
  byDomain[s.domain] = (byDomain[s.domain] || 0) + 1
}
console.log('\n=== Seed 领域分布 ===')
for (const [d, c] of Object.entries(byDomain)) {
  console.log(`  ${d}: ${c}`)
}
