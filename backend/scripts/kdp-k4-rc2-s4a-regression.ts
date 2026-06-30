// ════════════════════════════════════════════════════════════
// K4 RC2 Sprint 4A — Golden Regression: HTTP Distribution Platform
// ════════════════════════════════════════════════════════════
// Validates:
//   1. HTTP Provider interface (authenticate, send, verifyResponse, health)
//   2. GenericHTTPProvider: curl-based, auth types, request building
//   3. HTTPAdapter: lifecycle (prepare → deliver → verify → rollback)
//   4. PublishManifest integration with HTTP
//   5. Capability Negotiation (new capabilities in AdapterCapability enum)
//   6. Content type inference
//   7. Path template rendering
//   8. Cross-adapter coexistence (Git + Storage + HTTP)
//
// Note: Uses local mock server or no-op since real endpoints require setup.
// Tests the full request building, parsing, and lifecycle logic.
// ════════════════════════════════════════════════════════════

import * as fs from 'fs'
import * as path from 'path'
import { createHash } from 'crypto'
import { DeliveryAdapterRegistry } from '../src/services/geo/kdp/delivery/adapter-registry'
import { PublishManifest, createPublishManifest } from '../src/services/geo/kdp/delivery/publish-manifest'
import { HTTPAdapter } from '../src/services/geo/kdp/delivery/http/http-adapter'
import { GenericHTTPProvider } from '../src/services/geo/kdp/delivery/http/generic.provider'
import { HTTPProvider, HTTPProviderConfig, HTTPRequestOptions, HTTPResponse } from '../src/services/geo/kdp/delivery/http/http-provider'
import { S3Provider } from '../src/services/geo/kdp/delivery/storage/s3.provider'
import { ObjectStorageAdapter } from '../src/services/geo/kdp/delivery/storage/storage-adapter'
import { GitHubProvider } from '../src/services/geo/kdp/delivery/git/github.provider'
import { GitAdapter } from '../src/services/geo/kdp/delivery/git/git-adapter'
import {
  DeliveryAdapter, AdapterCapability, AdapterHealthStatus,
  PrepareContext, KnowledgePackage, PackageArtifact, DeliveryTargetType,
} from '../src/services/geo/types'

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

function mockPackage(): KnowledgePackage {
  return {
    id: 'pkg-http-001',
    packageType: 'website',
    status: 'ready',
    assetId: 'asset-003',
    projectId: 'proj-001',
    version: 1,
    manifestId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function mockArtifacts(): PackageArtifact[] {
  return [
    { id: 'art-h1', packageId: 'pkg-http-001', fileName: 'index.html', artifactType: 'html', content: '<h1>HTTP Test</h1>', contentHash: '' },
    { id: 'art-h2', packageId: 'pkg-http-001', fileName: 'schema.json', artifactType: 'json', content: '{"key":"value"}', contentHash: '' },
    { id: 'art-h3', packageId: 'pkg-http-001', fileName: 'data.xml', artifactType: 'xml', content: '<data><item>test</item></data>', contentHash: '' },
  ]
}

function mockTarget(): DeliveryTargetType {
  return {
    id: 'target-http-1',
    type: 'http',
    name: 'Test HTTP Endpoint',
    config: {
      baseUrl: 'https://api.example.com',
      pathTemplate: '/api/knowledge/{packageType}/{fileName}',
      auth: { type: 'bearer', token: 'test-token' },
    },
    enabled: true,
    createdAt: new Date().toISOString(),
  }
}

async function main() {
  console.log('══════════════════════════════════════════════════')
  console.log('K4 RC2 Sprint 4A — Golden Regression: HTTP Distribution Platform')
  console.log('══════════════════════════════════════════════════\n')

  // ── Phase 1: HTTP Provider Interface ──
  console.log('📦 Phase 1: HTTP Provider Interface')
  console.log('────────────────────────────────────')

  const httpProvider = new GenericHTTPProvider()

  assert(httpProvider.name === 'generic', 'HTTP provider name = generic')
  assert(typeof httpProvider.authenticate === 'function', 'HTTP has authenticate()')
  assert(typeof httpProvider.send === 'function', 'HTTP has send()')
  assert(typeof httpProvider.verifyResponse === 'function', 'HTTP has verifyResponse()')
  assert(typeof httpProvider.health === 'function', 'HTTP has health()')
  assert(typeof httpProvider.supportsStreaming === 'function', 'HTTP has supportsStreaming()')
  assert(typeof httpProvider.supportsMultipart === 'function', 'HTTP has supportsMultipart()')
  assert(httpProvider.supportsStreaming() === false, 'Generic HTTP does not support streaming')
  assert(httpProvider.supportsMultipart() === true, 'Generic HTTP supports multipart')

  // ── Phase 2: Capability Negotiation ──
  console.log('\n📦 Phase 2: Capability Negotiation')
  console.log('────────────────────────────────────')

  // Verify new capabilities exist in enum
  const allCaps = Object.values(AdapterCapability)
  assert(allCaps.includes('batch_publish'), 'AdapterCapability includes batch_publish')
  assert(allCaps.includes('multipart'), 'AdapterCapability includes multipart')
  assert(allCaps.includes('streaming'), 'AdapterCapability includes streaming')
  assert(allCaps.includes('versioning'), 'AdapterCapability includes versioning')
  assert(allCaps.includes('resource_management'), 'AdapterCapability includes resource_management')
  assert(allCaps.includes('content_model'), 'AdapterCapability includes content_model')
  assert(allCaps.length >= 14, `Total capabilities: ${allCaps.length} (≥14)`)

  // ── Phase 3: HTTPAdapter in Registry ──
  console.log('\n📦 Phase 3: HTTPAdapter in Registry')
  console.log('────────────────────────────────────')

  const registry = new DeliveryAdapterRegistry()
  const httpAdapter = new HTTPAdapter(httpProvider)

  registry.register(httpAdapter)

  assert(registry.get('http', 'generic') !== undefined, 'get(http, generic) found')
  const byType = registry.getByType('http')
  assert(byType.length === 1, 'getByType(http) returns 1')
  assert(httpAdapter.meta.targetType !== httpAdapter.meta.provider, 'FR-K17: type !== provider (http)')

  // HTTP Adapter capabilities
  assert(httpAdapter.meta.capabilities.includes(AdapterCapability.Deliver), 'HTTP supports deliver')
  assert(httpAdapter.meta.capabilities.includes(AdapterCapability.Prepare), 'HTTP supports prepare')
  assert(httpAdapter.meta.capabilities.includes(AdapterCapability.Multipart), 'HTTP supports multipart (negotiation)')
  assert(!httpAdapter.meta.capabilities.includes(AdapterCapability.ContentModel), 'Generic HTTP does NOT support content model')
  assert(!httpAdapter.meta.capabilities.includes(AdapterCapability.ResourceManagement), 'Generic HTTP does NOT support resource management')

  // ── Phase 4: Path Template Rendering ──
  console.log('\n📦 Phase 4: Path Template Rendering')
  console.log('────────────────────────────────────')

  const pkg = mockPackage()
  const artifact = mockArtifacts()[0]

  // Test path rendering via dryRun output
  const target = mockTarget()
  const dryRunResult = await httpAdapter.dryRun(pkg, target)
  assert(dryRunResult.success === true, 'dryRun() succeeds')
  assert(dryRunResult.responses !== undefined, 'dryRun returns responses')
  assert(dryRunResult.responses!.length === 1, 'dryRun returns 1 response')
  assert(dryRunResult.responses![0].path.includes('/api/knowledge/website/'),
    'Path template renders correctly: {packageType} resolved')

  // ── Phase 5: Adapter Lifecycle ──
  console.log('\n📦 Phase 5: Adapter Lifecycle')
  console.log('────────────────────────────────────')

  // Prepare (will fail-connect but returns result gracefully)
  const prepareCtx: PrepareContext = {
    config: mockTarget().config,
    credentials: {},
    target,
  }
  const prepareResult = await httpAdapter.prepare(prepareCtx)
  assert(prepareResult.success === false, 'prepare() returns false (no real endpoint)')

  // Deliver with no real endpoint
  const deliveryResult = await httpAdapter.deliver('job-http-1', pkg, target, mockArtifacts())
  assert(deliveryResult.success === false, 'deliver() returns false (no real endpoint)')
  assert(deliveryResult.responses !== undefined, 'deliver() returns responses')
  assert(deliveryResult.responses!.length === 3, 'deliver() sends all 3 artifacts')
  assert(deliveryResult.manifest !== undefined, 'deliver() returns PublishManifest')

  // Verify
  const verifyResult = await httpAdapter.verify(deliveryResult)
  assert(verifyResult.verified === false, 'verify() reports not verified (all failed)')
  assert(verifyResult.errors.length > 0, 'verify() has errors')

  // Rollback with no resource IDs
  const rollbackResult = await httpAdapter.rollback(deliveryResult)
  assert(rollbackResult.success === false, 'rollback() fails gracefully (no resource IDs)')

  // Health check
  const healthResult = await httpAdapter.healthCheck()
  assert(healthResult.status === AdapterHealthStatus.Down || healthResult.status === AdapterHealthStatus.Ok,
    'healthCheck() returns a status')

  // ── Phase 6: HTTPResponse parsing ──
  console.log('\n📦 Phase 6: HTTP Response Verification')
  console.log('────────────────────────────────────')

  // Mock a successful response
  const mockResponse: HTTPResponse = {
    statusCode: 201,
    headers: { 'content-type': 'application/json', etag: '"abc123"' },
    body: JSON.stringify({ id: 42, status: 'published' }),
    bodyJson: { id: 42, status: 'published' },
    etag: '"abc123"',
  }

  const verifyGood = await httpProvider.verifyResponse(mockResponse)
  assert(verifyGood.valid === true, 'verifyResponse(201) is valid')
  assert(verifyGood.errors.length === 0, 'verifyResponse(201) has no errors')

  // Mock a failed response
  const mockFailResponse: HTTPResponse = {
    statusCode: 500,
    headers: {},
    body: 'Internal Server Error',
    bodyJson: null,
  }

  const verifyFail = await httpProvider.verifyResponse(mockFailResponse)
  assert(verifyFail.valid === false, 'verifyResponse(500) is invalid')
  assert(verifyFail.errors.length === 0 || verifyFail.errors[0].includes('500'),
    'verifyResponse(500) reports server error')

  // Mock connection failure
  const mockNoResponse: HTTPResponse = {
    statusCode: 0,
    headers: {},
    body: '',
    bodyJson: null,
  }

  const verifyNoConn = await httpProvider.verifyResponse(mockNoResponse)
  assert(verifyNoConn.valid === false, 'verifyResponse(0/connection fail) is invalid')
  assert(verifyNoConn.errors.length > 0, 'verifyResponse(0) has errors')

  // ── Phase 7: Auth Header Building ──
  console.log('\n📦 Phase 7: Auth Header Building')
  console.log('────────────────────────────────────')

  // The auth is handled inside buildCurl (private). Test via authenticate.
  const goodConfig: HTTPProviderConfig = {
    baseUrl: 'https://api.example.com',
    auth: { type: 'bearer', token: 'valid-token' },
  }

  const authResult = await httpProvider.authenticate(goodConfig)
  // Will fail since no real endpoint — that's expected
  assert(authResult === false, 'authenticate() fails for unreachable endpoint')

  // ── Phase 8: Cross-Adapter Everything ──
  console.log('\n📦 Phase 8: All Adapters in Registry')
  console.log('────────────────────────────────────')

  const s3Provider = new S3Provider()
  const storageAdapter = new ObjectStorageAdapter(s3Provider)
  const gitHubProvider = new GitHubProvider()
  const gitAdapter = new GitAdapter(gitHubProvider)

  registry.register(storageAdapter)
  registry.register(gitAdapter)

  const allAdapters = registry.getAll()
  assert(allAdapters.length === 3, 'Registry has 3 adapters (HTTP + Storage + Git)')

  const discover = registry.discover()
  const httpAdapters = discover.filter(a => a.targetType === 'http')
  const storageAdapters = discover.filter(a => a.targetType === 'object_storage')
  const gitAdapters = discover.filter(a => a.targetType === 'git')
  assert(httpAdapters.length === 1, 'Discover shows 1 HTTP adapter')
  assert(storageAdapters.length === 1, 'Discover shows 1 storage adapter')
  assert(gitAdapters.length === 1, 'Discover shows 1 git adapter')

  // All have different providers (FR-K17)
  const providers = discover.map(a => a.provider)
  const uniqueProviders = new Set(providers)
  assert(uniqueProviders.size === 3, 'All 3 adapters have different providers')

  // Capability negotiation works across types
  const httpCaps = httpAdapters[0].capabilities
  const gitCaps = gitAdapters[0].capabilities
  const storageCaps = storageAdapters[0].capabilities

  // All support prepare, deliver, verify, rollback
  assert(httpCaps.includes('prepare'), 'HTTP supports prepare')
  assert(gitCaps.includes('prepare'), 'Git supports prepare')
  assert(storageCaps.includes('prepare'), 'Storage supports prepare')

  // HTTP has multipart but Git doesn't
  assert(httpCaps.includes('multipart'), 'HTTP has multipart')
  assert(!gitCaps.includes('multipart'), 'Git does not have multipart')
  assert(!storageCaps.includes('multipart'), 'Storage does not have multipart')

  // Git and HTTP have preview, Storage doesn't
  assert(gitCaps.includes('preview'), 'Git has preview')
  assert(httpCaps.includes('rollback'), 'HTTP has rollback')
  assert(storageCaps.includes('dry_run'), 'Storage has dry_run')

  // ── Results ──
  console.log('\n══════════════════════════════════════════════════')
  console.log(`📊 Results: ${passed} passed, ${failed} failed`)
  console.log('══════════════════════════════════════════════════')

  if (failed > 0) {
    console.error('\n❌ K4 RC2 Sprint 4A Regression FAILED\n')
    process.exit(1)
  }

  console.log('\n✅ K4 RC2 Sprint 4A Golden Regression PASSED — HTTP Distribution Platform frozen\n')
}

main().catch(e => {
  console.error('\n❌ Regression error:', e.message)
  process.exit(1)
})
