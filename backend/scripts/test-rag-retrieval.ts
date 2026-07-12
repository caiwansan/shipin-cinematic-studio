import { legalRAG } from '../src/services/legal/legal-rag.service.js'

async function main() {
  console.log('=== 关键词搜索测试 ===')
  const r = await legalRAG.retrieve('被公司拖欠工资三个月', 3)
  console.log('Results:', r.length)
  for (const i of r) {
    console.log(`  [${(i.score * 100).toFixed(1)}%] ${i.citation}`)
    console.log(`    ${i.content.slice(0, 120)}`)
  }

  console.log('\n=== 检索测试2: 网上购物退货 ===')
  const r2 = await legalRAG.retrieve('网上买东西质量有问题，商家不退钱', 3)
  console.log('Results:', r2.length)
  for (const i of r2) {
    console.log(`  [${(i.score * 100).toFixed(1)}%] ${i.citation}`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
