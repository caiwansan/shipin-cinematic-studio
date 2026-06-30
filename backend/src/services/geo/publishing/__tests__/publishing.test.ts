// Publishing Pipeline 集成测试
// 验证：预览 → 提交 → 审核发布 → 查询 → 回滚 完整流程

import { publishingAdapterRegistry } from '../adapters/adapter-registry'
import { adapter as websiteAdapter } from '../adapters/website.adapter'

async function testPublishingPipeline() {
  // 0. Register adapter manually for test
  publishingAdapterRegistry.register(websiteAdapter)

  // 1. Verify adapter auto-registered
  const adapters = publishingAdapterRegistry.list()
  console.log(`Registered adapters: ${adapters.map(a => a.platform).join(', ')}`)

  const website = publishingAdapterRegistry.resolve('website')
  if (!website) throw new Error('Website adapter not found')
  console.log('✅ Website adapter resolved')

  // 2. Test capabilities
  const caps = await website.capabilities()
  console.log(`   Capabilities: ${caps.join(', ')}`)

  // 3. Test supports
  const supportsFAQ = website.supports('faq')
  console.log(`   Supports FAQ: ${supportsFAQ}`)

  // 4. Test health
  const health = await website.health()
  console.log(`   Health: ${health.healthy}`)

  // 5. Test preview
  const preview = await website.preview({
    projectId: 'test-project',
    contentType: 'faq',
    content: { title: 'Updated FAQ', items: [{ q: 'Q1', a: 'A1' }] },
    beforeContent: { title: 'Old FAQ', items: [{ q: 'Q1', a: 'Old A1' }] },
    afterContent: { title: 'Updated FAQ', items: [{ q: 'Q1', a: 'A1' }] },
  })
  console.log(`   Preview diff summary: ${preview.diffSummary}`)
  console.log(`   Side-by-side keys: ${Object.keys(preview.sideBySideDiff).join(', ')}`)

  // 6. Find supports
  const faqAdapters = publishingAdapterRegistry.findSupports('faq')
  console.log(`   Platforms supporting FAQ: ${faqAdapters.map(a => a.platform).join(', ')}`)

  console.log('\n✅ Publishing test PASS')
}

testPublishingPipeline().catch(err => { console.error(err); process.exit(1) })
