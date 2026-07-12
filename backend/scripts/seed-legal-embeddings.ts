// Run: npx tsx scripts/seed-legal-embeddings.ts
import { prisma } from '../src/utils/index.js'
import { legalRAG } from '../src/services/legal/legal-rag.service.js'
import { initLegalEmbedding } from '../src/providers/embedding/dashscope-embedding.provider.js'

async function main() {
  console.log('=== Legal RAG: 初始化 Embedding Provider ===')
  initLegalEmbedding()

  console.log('=== Legal RAG: 重建所有索引 ===')
  const result = await legalRAG.reindexAll()
  console.log(`完成! knowledge=${result.knowledge}, regulation=${result.regulation}`)
  
  // Test retrieval
  console.log('\n=== 检索测试: "被公司拖欠工资" ===')
  const results = await legalRAG.retrieve('被公司拖欠工资三个月，没有签劳动合同', 3)
  for (const r of results) {
    console.log(`  [${(r.score*100).toFixed(1)}%] ${r.citation}`)
    console.log(`    ${r.content.slice(0, 100)}`)
  }

  console.log('\n=== 检索测试: "网上买东西质量有问题" ===')
  const results2 = await legalRAG.retrieve('网上买东西质量有问题，商家不退钱', 3)
  for (const r of results2) {
    console.log(`  [${(r.score*100).toFixed(1)}%] ${r.citation}`)
    console.log(`    ${r.content.slice(0, 100)}`)
  }

  await prisma.$disconnect()
}

main().catch((err) => { console.error(err); process.exit(1) })
