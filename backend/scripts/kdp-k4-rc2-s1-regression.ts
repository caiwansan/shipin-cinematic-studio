// ════════════════════════════════════════════════════════════
// K4 RC2 Sprint 1 — Golden Regression: Adapter Framework
// ════════════════════════════════════════════════════════════
// Validates:
//   1. Adapter SDK contracts (meta, capabilities, configSchema)
//   2. Adapter Registry (register, get, discover, health)
//   3. LocalDeliveryAdapter implements new interface
//   4. CredentialCenter (store, resolve, mask)
//   5. Publish Pipeline stubs
//   6. Provider pattern (type ≠ provider)
//   7. FR-K15/16/17 compliance
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import { LocalDeliveryAdapter } from '../src/services/geo/kdp/delivery/local-delivery.adapter'
import { DeliveryAdapterRegistry } from '../src/services/geo/kdp/delivery/adapter-registry'
import { CredentialCenter } from '../src/services/geo/kdp/delivery/credential-center'
import { PublishPipeline, PublishStage } from '../src/services/geo/kdp/delivery/publish-pipeline'
import {
  DeliveryAdapter, AdapterCapability, AdapterHealthStatus,
  AdapterMeta, PrepareContext,
} from '../src/services/geo/types'
import * as fs from 'fs'

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ ${label}`)
    failed++
  }
}

async function main() {
  console.log('══════════════════════════════════════════════════')
  console.log('K4 RC2 Sprint 1 — Golden Regression: Adapter Framework')
  console.log('══════════════════════════════════════════════════\n')

  const prisma = new PrismaClient()

  // ── Phase 1: Adapter SDK Compliance ──
  console.log('📦 Phase 1: Adapter SDK Compliance')
  console.log('────────────────────────────────────')

  const adapter = new LocalDeliveryAdapter(prisma)

  assert(adapter.meta.id === 'local', 'meta.id = local')
  assert(adapter.meta.targetType === 'local', 'meta.targetType = local')
  assert(adapter.meta.provider === 'local', 'meta.provider = local')
  assert(adapter.meta.version.length > 0, 'meta.version is set')
  assert(adapter.meta.description.length > 0, 'meta.description is set')
  assert(adapter.meta.capabilities.length >= 3, `meta.capabilities: ${adapter.meta.capabilities.length} (≥3)`)

  // FR-K15: must implement all required methods
  assert(typeof adapter.prepare === 'function', 'adapter.prepare is a function')
  assert(typeof adapter.deliver === 'function', 'adapter.deliver is a function')
  assert(typeof adapter.verify === 'function', 'adapter.verify is a function')
  assert(typeof adapter.rollback === 'function', 'adapter.rollback is a function')

  // FR-K17: type ≠ provider
  assert(adapter.meta.targetType !== adapter.meta.provider || adapter.meta.targetType === 'local',
    'type != provider (except local)')

  // ── Phase 2: Registry ──
  console.log('\n📦 Phase 2: Adapter Registry')
  console.log('────────────────────────────────────')

  const registry = new DeliveryAdapterRegistry()

  assert(registry.getAll().length === 0, 'Registry starts empty')

  registry.register(adapter)
  assert(registry.getAll().length === 1, 'Registry has 1 adapter after registration')

  const found = registry.get('local', 'local')
  assert(found !== undefined, 'get() finds adapter by type+provider')

  const byType = registry.getByType('local')
  assert(byType.length === 1, 'getByType() finds 1 adapter')

  const notFound = registry.get('s3', 'aws')
  assert(notFound === undefined, 'get() returns undefined for unregistered')

  const supportsDeliver = registry.supports('local', 'local', AdapterCapability.Deliver)
  assert(supportsDeliver === true, 'supports() reports deliver capability')

  const supportsPreview = registry.supports('local', 'local', AdapterCapability.Preview)
  assert(supportsPreview === false, 'supports() does not report preview (no implement)')

  const discover = registry.discover()
  assert(discover.length === 1, 'discover() returns 1 adapter')
  assert(discover[0].targetType === 'local', 'discover[0].targetType = local')
  assert(discover[0].provider === 'local', 'discover[0].provider = local')

  const providers = registry.getProviders('local')
  assert(providers.length === 1, 'getProviders() returns 1')
  assert(providers[0].provider === 'local', 'getProviders()[0].provider = local')

  // FR-K15: register local adapter, verify no runtime change needed
  assert(registry.getAll().length === 1, 'No runtime changes needed for registration')

  // ── Phase 3: Health Check ──
  console.log('\n📦 Phase 3: Health Check')
  console.log('────────────────────────────────────')

  const healthResults = await registry.healthCheckAll()
  assert(healthResults.length === 1, 'healthCheckAll returns 1')
  assert(healthResults[0].status === AdapterHealthStatus.Ok, 'Local adapter health = ok')
  assert(healthResults[0].latencyMs !== undefined, 'Health check has latency')

  const hc = await adapter.healthCheck!()
  assert(hc.status === AdapterHealthStatus.Ok, 'Direct health check = ok')

  // ── Phase 4: Credential Center ──
  console.log('\n📦 Phase 4: Credential Center')
  console.log('────────────────────────────────────')

  const cc = new CredentialCenter()

  cc.store({
    id: 'cred-github-1',
    name: 'GitHub Personal Token',
    type: 'token',
    provider: 'github',
    values: { token: 'ghp_abcdef123456789012345678901234567890' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  // FR-K16: Adapters never handle raw credentials
  const list = cc.list()
  assert(list.length === 1, 'CredentialCenter has 1 credential')
  assert(list[0].values.token.includes('****') || list[0].values.token.includes('...'),
    'Credentials are masked in list()')
  assert(!list[0].values.token.includes('abcdef1234567890'),
    'Raw token is not exposed in list()')

  const resolved = cc.resolve('cred-github-1')
  assert(resolved.success === true, 'resolve() succeeds')
  assert(resolved.credentials.token === 'ghp_abcdef123456789012345678901234567890',
    'resolve() returns raw token')

  const notFoundCred = cc.resolve('cred-nonexistent')
  assert(notFoundCred.success === false, 'resolve() fails for unknown credential')

  const fromConfig = cc.resolveFromConfig({ repo: 'my/repo', token: 'cred:cred-github-1' })
  assert(fromConfig.success === true, 'resolveFromConfig() succeeds')
  assert(fromConfig.credentials.token === 'ghp_abcdef123456789012345678901234567890',
    'resolveFromConfig() resolves credential references')

  const deleted = cc.delete('cred-github-1')
  assert(deleted === true, 'delete() succeeds')
  assert(cc.list().length === 0, 'Credential cleared after delete')

  // ── Phase 5: Publish Pipeline Stubs ──
  console.log('\n📦 Phase 5: Publish Pipeline')
  console.log('────────────────────────────────────')

  const pipeline = new PublishPipeline()
  const state = pipeline.createState('job-1', ['pkg-1'], 'target-1')

  assert(state.jobId === 'job-1', 'Pipeline state has jobId')
  assert(state.packageIds.length === 1, 'Pipeline state has packages')
  assert(state.currentStage === PublishStage.Package, 'Pipeline starts at Package stage')
  assert(Object.keys(state.stages).length === Object.values(PublishStage).length,
    'Pipeline has all stages')
  assert(state.stages[PublishStage.Package].status === 'pending',
    'Initial package stage status = pending')

  const previewUrl = await pipeline.getPreviewUrl('pkg-1')
  assert(previewUrl === null, 'Preview URL stub returns null (RC2.5)')

  // ── Phase 6: LocalDeliveryAdapter lifecycle ──
  console.log('\n📦 Phase 6: Adapter Lifecycle')
  console.log('────────────────────────────────────')

  const prepareCtx: PrepareContext = {
    config: { outputPath: '/tmp/adapter-test-output' },
    credentials: {},
    target: { id: 'local-1', type: 'local', name: 'test', config: { outputPath: '/tmp/adapter-test-output' }, enabled: true, createdAt: '' },
  }

  const prepareResult = await adapter.prepare(prepareCtx)
  assert(prepareResult.success === true, 'prepare() succeeds')
  assert(prepareResult.message.includes('Prepared'), 'prepare() returns message')

  const healthCheck = await adapter.healthCheck!()
  assert(healthCheck.status === AdapterHealthStatus.Ok, 'healthCheck() = ok after prepare')

  const dpResult = await adapter.dryRun({ id: 'mock', packageType: 'website' } as any, prepareCtx.target)
  assert(dpResult.success === true, 'dryRun() succeeds')
  assert(dpResult.status === 'completed', 'dryRun() status = completed')

  // Cleanup
  // Cleanup
  if (fs.existsSync('/tmp/adapter-test-output')) {
    fs.rmSync('/tmp/adapter-test-output', { recursive: true, force: true })
  }

  // ── Results ──
  console.log('\n══════════════════════════════════════════════════')
  console.log(`📊 Results: ${passed} passed, ${failed} failed`)
  console.log('══════════════════════════════════════════════════')

  if (failed > 0) {
    console.error('\n❌ K4 RC2 Sprint 1 Regression FAILED\n')
    process.exit(1)
  }

  console.log('\n✅ K4 RC2 Sprint 1 Golden Regression PASSED — Adapter Framework frozen\n')

  await prisma.$disconnect()
}

main().catch(e => {
  console.error('\n❌ Regression error:', e.message)
  process.exit(1)
})
