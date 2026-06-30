// ============================================================
// Monitor Integration Test (GEO v4 Sprint 5)
// ============================================================

import { probeRegistry } from '../probes/probe-registry'
import type { Probe } from '../monitor.types'
import path from 'path'

async function testMonitor() {
  // Ensure discovery works by setting __dirname
  const originalDirname = __dirname

  // 1. Discover probes
  await probeRegistry.discover()
  const probes = probeRegistry.list()
  console.log(`Registered probes: ${probes.map(p => p.name).join(', ')}`)

  if (probes.length < 3) {
    console.warn(`  ⚠️ Expected at least 3 probes, got ${probes.length}`)
  }

  // 2. Verify probes
  const httpProbe = probeRegistry.resolve('http')
  console.log(`  HTTP probe name: ${httpProbe.name}`)
  console.log(`  HTTP probe type: ${httpProbe.type}`)
  console.log(`  Supports url: ${httpProbe.supports('url')}`)

  const indexProbe = probeRegistry.resolve('index')
  console.log(`  Index probe name: ${indexProbe.name}`)
  console.log(`  Index probe type: ${indexProbe.type}`)

  // 3. Test findSupports
  const urlProbes = probeRegistry.findSupports('url')
  console.log(`  Probes supporting url: ${urlProbes.length}`)
  if (urlProbes.length !== 1) {
    console.warn(`  ⚠️ Expected 1 probe for url, got ${urlProbes.length}`)
  }

  const seoProbes = probeRegistry.findSupports('seo')
  console.log(`  Probes supporting seo: ${seoProbes.length}`)
  if (seoProbes.length !== 1) {
    console.warn(`  ⚠️ Expected 1 probe for seo, got ${seoProbes.length}`)
  }

  // 4. Test HTTP probe (with a real URL)
  const result = await httpProbe.execute({ url: 'https://example.com', projectId: 'test' })
  console.log(`  HTTP probe on example.com: success=${result.success}, status=${result.statusCode}, latency=${result.latency}ms`)

  if (!result.success) {
    console.warn(`  ⚠️ HTTP probe failed: ${result.error}`)
  }

  // 5. Test Sitemap probe
  const sitemapProbe = probeRegistry.resolve('sitemap')
  const sitemapResult = await sitemapProbe.execute({ url: 'https://example.com/sitemap.xml', projectId: 'test' })
  console.log(`  Sitemap probe on example.com: success=${sitemapResult.success}, status=${sitemapResult.statusCode}`)

  // 6. Test Index probe
  const indexResult = await indexProbe.execute({ url: 'https://example.com', projectId: 'test' })
  console.log(`  Index probe: success=${indexResult.success}, indexed=${indexResult.details?.indexed}`)

  // 7. Validate all probe types
  const allNames = probeRegistry.getNames()
  console.log(`  All probe names: ${allNames.join(', ')}`)
  if (!allNames.includes('http') || !allNames.includes('sitemap') || !allNames.includes('index')) {
    throw new Error('Missing expected probes')
  }

  console.log('\n✅ Monitor test PASS')
}

testMonitor().catch(err => { console.error('\n❌ Monitor test FAIL:', err.message); process.exit(1) })
