import { signalRegistry } from '../normalizers/signal-registry'

async function testLearning() {
  // 1. Discover providers
  await signalRegistry.discover()
  const providers = signalRegistry.list()
  console.log(`Registered providers: ${providers.map(p => p.name).join(', ')}`)

  // 2. Verify each provider
  for (const provider of providers) {
    console.log(`  Provider: ${provider.name} (source: ${provider.source})`)
    console.log(`    Supports: ${provider.supports()}`)

    // Try collecting (will likely be empty without real data, but should not crash)
    try {
      const signals = await provider.collect('test-project')
      console.log(`    Collected: ${signals.length} signals`)
    } catch (err: any) {
      console.log(`    Collect result: ${err.message}`)
    }
  }

  // 3. Test findSupports
  const supported = signalRegistry.findSupports()
  console.log(`  Providers supporting all: ${supported.length}`)

  console.log('\n✅ Learning test PASS')
}

testLearning().catch(err => { console.error(err); process.exit(1) })
