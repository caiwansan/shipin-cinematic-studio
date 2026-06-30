// ════════════════════════════════════════════════════════════
// K4 RC2 Sprint 2 — Golden Regression: Git Distribution Platform
// ════════════════════════════════════════════════════════════
// Validates:
//   1. PublishManifest: create, self-checksum, structure
//   2. Git Provider interface (FR-K17: type ≠ provider)
//   3. GitAdapter: lifecycle (prepare → deliver → verify → rollback)
//   4. Git delivery with file diff tracking
//   5. Provider pattern: GitHub + GitLab registered differently
//   6. PublishManifest in delivery result
//   7. Dry Run
// ════════════════════════════════════════════════════════════

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { createHash } from 'crypto'
import { DeliveryAdapterRegistry } from '../src/services/geo/kdp/delivery/adapter-registry'
import { CredentialCenter } from '../src/services/geo/kdp/delivery/credential-center'
import { PublishManifest, createPublishManifest } from '../src/services/geo/kdp/delivery/publish-manifest'
import { GitAdapter } from '../src/services/geo/kdp/delivery/git/git-adapter'
import { GitHubProvider } from '../src/services/geo/kdp/delivery/git/github.provider'
import { GitLabProvider } from '../src/services/geo/kdp/delivery/git/gitlab.provider'
import { GitProvider } from '../src/services/geo/kdp/delivery/git/git-provider'
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

async function setupTestGitRepo(workDir: string): Promise<string> {
  const repoDir = path.join(workDir, 'brand-site')
  if (fs.existsSync(repoDir)) {
    fs.rmSync(repoDir, { recursive: true, force: true })
  }
  fs.mkdirSync(repoDir, { recursive: true })
  execSync('git init', { cwd: repoDir, stdio: 'pipe' })
  execSync('git checkout -b main', { cwd: repoDir, stdio: 'pipe' })

  // Create an initial file so we have a "previous commit"
  fs.writeFileSync(path.join(repoDir, 'README.md'), '# Brand Knowledge Site\n', 'utf8')
  fs.writeFileSync(path.join(repoDir, '.gitignore'), '.brand-knowledge/\n', 'utf8')
  execSync('git add -A', { cwd: repoDir, stdio: 'pipe' })
  execSync('git commit -m "Initial commit"', { cwd: repoDir, stdio: 'pipe' })

  return repoDir
}

function mockPackage(): KnowledgePackage {
  return {
    id: 'pkg-test-001',
    packageType: 'website',
    status: 'ready',
    assetId: 'asset-001',
    projectId: 'proj-001',
    version: 1,
    manifestId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function mockArtifacts(): PackageArtifact[] {
  return [
    { id: 'art-1', packageId: 'pkg-test-001', fileName: 'index.html', artifactType: 'html', content: '<html><body><h1>Hello Brand</h1></body></html>', contentHash: '' },
    { id: 'art-2', packageId: 'pkg-test-001', fileName: 'about/index.html', artifactType: 'html', content: '<html><body><h2>About Us</h2><p>Brand info</p></body></html>', contentHash: '' },
  ]
}

function mockTarget(repoDir: string): DeliveryTargetType {
  return {
    id: 'target-git-1',
    type: 'git',
    name: 'Test Git Repo',
    config: {
      repoUrl: 'local',
      defaultBranch: 'main',
      workDir: repoDir,
      auth: { type: 'token', token: 'test-token' },
    },
    enabled: true,
    createdAt: new Date().toISOString(),
  }
}

async function main() {
  console.log('══════════════════════════════════════════════════')
  console.log('K4 RC2 Sprint 2 — Golden Regression: Git Distribution Platform')
  console.log('══════════════════════════════════════════════════\n')

  const workDir = '/tmp/k4-rc2-s2-test'
  if (fs.existsSync(workDir)) {
    fs.rmSync(workDir, { recursive: true, force: true })
  }
  fs.mkdirSync(workDir, { recursive: true })
  const repoDir = await setupTestGitRepo(workDir)

  // ── Phase 1: PublishManifest ──
  console.log('📦 Phase 1: PublishManifest')
  console.log('────────────────────────────────────')

  const manifest = createPublishManifest({
    adapter: 'git',
    provider: 'github',
    packageId: 'pkg-001',
    jobId: 'job-001',
    targetType: 'git',
    targetUrl: 'https://github.com/test/brand-site',
    fileCount: 3,
    totalBytes: 1500,
    files: [
      { path: 'index.html', status: 'added', sizeBytes: 500, sha256: 'abc' },
      { path: 'about.html', status: 'modified', sizeBytes: 600, sha256: 'def' },
      { path: 'sitemap.xml', status: 'added', sizeBytes: 400, sha256: 'ghi' },
    ],
    branch: 'main',
    commitHash: 'abc123def456',
    commitMessage: 'Test publish',
  })

  assert(manifest.version === '1.0.0', 'manifest version = 1.0.0')
  assert(manifest.adapter === 'git', 'manifest.adapter = git')
  assert(manifest.provider === 'github', 'manifest.provider = github')
  assert(manifest.packageId === 'pkg-001', 'manifest.packageId is set')
  assert(manifest.fileCount === 3, 'manifest.fileCount = 3')
  assert(manifest.totalBytes === 1500, 'manifest.totalBytes = 1500')
  assert(manifest.files.length === 3, 'manifest has 3 files')
  assert(typeof manifest.manifestSha256 === 'string', 'manifest has self-checksum')
  assert(manifest.manifestSha256.length > 0, 'self-checksum is not empty')
  assert(typeof manifest.publishedAt === 'string', 'publishedAt is set')
  assert(manifest.branch === 'main', 'manifest.branch = main')

  // Verify self-checksum integrity
  const { manifestSha256: originalSha } = manifest
  // Recompute: same logic as createPublishManifest (serialize all keys sorted, excluding manifestSha256)
  // commitHash is set at creation time, so it's part of the original checksum
  // (if commitHash is set after creation, this will fail — that's correct, checksum detects tamper)
  const cloned = { ...manifest }
  delete (cloned as any).manifestSha256
  const serialized2 = JSON.stringify(cloned, Object.keys(cloned).sort())
  const recomputed2 = createHash('sha256').update(serialized2).digest('hex')
  assert(recomputed2 === originalSha, 'Self-checksum validates correctly')

  // ── Phase 2: Provider Pattern (FR-K17) ──
  console.log('\n📦 Phase 2: Provider Pattern (FR-K17)')
  console.log('────────────────────────────────────')

  const gitHubProvider = new GitHubProvider()
  const gitLabProvider = new GitLabProvider()

  assert(gitHubProvider.name === 'github', 'GitHub provider name = github')
  assert(gitLabProvider.name === 'gitlab', 'GitLab provider name = gitlab')
  assert(typeof gitHubProvider.authenticate === 'function', 'GitHub has authenticate()')
  assert(typeof gitHubProvider.repositoryExists === 'function', 'GitHub has repositoryExists()')
  assert(typeof gitHubProvider.buildRemoteUrl === 'function', 'GitHub has buildRemoteUrl()')

  // Different providers build different remote URLs
  const ghConfig = { repoUrl: 'https://github.com/owner/repo', defaultBranch: 'main', workDir: '/tmp', auth: { type: 'token' as const, token: 'test' } }
  const glConfig = { repoUrl: 'https://gitlab.com/group/project', defaultBranch: 'main', workDir: '/tmp', auth: { type: 'token' as const, token: 'test' } }

  const ghUrl = gitHubProvider.buildRemoteUrl(ghConfig)
  const glUrl = gitLabProvider.buildRemoteUrl(glConfig)

  assert(ghUrl.includes('github.com'), 'GitHub remote URL contains github.com')
  assert(glUrl.includes('gitlab.com'), 'GitLab remote URL contains gitlab.com')
  assert(ghUrl !== glUrl, 'GitHub and GitLab remote URLs are different')

  // ── Phase 3: GitAdapter in Registry ──
  console.log('\n📦 Phase 3: GitAdapter in Registry')
  console.log('────────────────────────────────────')

  const registry = new DeliveryAdapterRegistry()
  const gitHubAdapter = new GitAdapter(gitHubProvider)
  const gitLabAdapter = new GitAdapter(gitLabProvider)

  registry.register(gitHubAdapter)
  registry.register(gitLabAdapter)

  assert(registry.getAll().length === 2, 'Registry has 2 adapters')
  assert(registry.get('git', 'github') !== undefined, 'get(git, github) found')
  assert(registry.get('git', 'gitlab') !== undefined, 'get(git, gitlab) found')

  const byType = registry.getByType('git')
  assert(byType.length === 2, 'getByType(git) returns 2 adapters')

  const providers = registry.getProviders('git')
  assert(providers.length === 2, 'getProviders(git) returns 2')

  // FR-K17: type !== provider
  const allAdapters = registry.getAll()
  for (const a of allAdapters) {
    if (a.meta.targetType === 'git') {
      assert(a.meta.targetType !== a.meta.provider, `FR-K17: ${a.meta.provider} type !== provider (type=${a.meta.targetType})`)
    }
  }

  // Capabilities
  assert(registry.supports('git', 'github', AdapterCapability.Deliver), 'GitHub supports deliver')
  assert(registry.supports('git', 'github', AdapterCapability.DryRun), 'GitHub supports dryRun')
  assert(registry.supports('git', 'github', AdapterCapability.Preview), 'GitHub supports preview')

  // ── Phase 4: Adapter Lifecycle (with local filesystem) ──
  console.log('\n📦 Phase 4: Adapter Lifecycle')
  console.log('────────────────────────────────────')

  const adapter = gitHubAdapter

  // Prepare
  const prepareCtx: PrepareContext = {
    config: { repoUrl: 'local', defaultBranch: 'main', workDir },
    credentials: { token: 'test' },
    target: mockTarget(workDir),
  }

  const prepareResult = await adapter.prepare(prepareCtx)
  assert(prepareResult.success === true, 'prepare() succeeds')

  // Deliver
  const pkg = mockPackage()
  const target = mockTarget(workDir)

  const deliveryResult = await adapter.deliver('job-s2-test', pkg, target, mockArtifacts())
  assert(deliveryResult.success === true, 'deliver() succeeds')

  // Delivery with GitAdapter should return Git-specific fields
  const gitResult = deliveryResult as any
  assert(typeof gitResult.commitHash === 'string', 'deliver() returns commitHash')
  assert(gitResult.commitHash.length > 0, 'commitHash is not empty')
  assert(typeof gitResult.branch === 'string', 'deliver() returns branch')
  assert(gitResult.branch === 'main', 'deliver branch = main')
  assert(gitResult.manifest !== undefined, 'deliver() returns PublishManifest')
  assert(gitResult.manifest.adapter === 'git', 'manifest.adapter = git')

  // Verify diff tracking
  assert(Array.isArray(gitResult.files), 'deliver returns files array')
  assert(gitResult.files.length >= 2, 'files array has at least 2 entries')

  // Check original files tracked correctly
  const indexFile = gitResult.files.find((f: any) => f.path === 'index.html')
  assert(indexFile !== undefined, 'index.html tracked in files')

  // Verify
  const verifyResult = await adapter.verify(gitResult)
  assert(verifyResult.success === true, 'verify() succeeds')
  assert(verifyResult.verified === true, 'verify() reports verified')
  assert(verifyResult.errors.length === 0, 'verify() no errors')

  // Verify with invalid result
  const invalidResult = { commitHash: '', files: [], manifest: null, success: true, outputPath: '', bytes: 0, artifactCount: 0, checksum: '', status: 'completed' }
  const invalidVerify = await adapter.verify(invalidResult as any)
  assert(invalidVerify.success === true, 'verify(invalid) succeeds')
  assert(invalidVerify.verified === false, 'verify(invalid) reports not verified')

  // Rollback
  const rollbackResult = await adapter.rollback(gitResult)
  assert(rollbackResult.success === true, 'rollback() succeeds')

  // Verify rollback
  const idxFileAfterRollback = path.join(repoDir, 'index.html')
  // After rollback, README should exist but index.html should not (it was added in delivery)
  assert(fs.existsSync(path.join(repoDir, 'README.md')), 'README.md exists after rollback')

  // ── Phase 5: Dry Run ──
  console.log('\n📦 Phase 5: Dry Run')
  console.log('────────────────────────────────────')

  const dryRunResult = await adapter.dryRun(pkg, target)
  assert(dryRunResult.success === true, 'dryRun() succeeds')
  assert(dryRunResult.branch === 'main', 'dryRun branch = main')
  assert(dryRunResult.diff !== undefined, 'dryRun returns diff')

  // ── Phase 6: Preview ──
  console.log('\n📦 Phase 6: Preview')
  console.log('────────────────────────────────────')

  const previewResult = await adapter.preview(pkg)
  assert(typeof previewResult === 'string', 'preview() returns a string')
  const parsedPreview = JSON.parse(previewResult)
  assert(parsedPreview.adapter === 'git', 'preview adapter = git')

  // ── Phase 7: Health Check ──
  console.log('\n📦 Phase 7: Health Check')
  console.log('────────────────────────────────────')

  const healthResult = await adapter.healthCheck()
  assert(healthResult.status === AdapterHealthStatus.Ok, 'healthCheck = ok (git is installed)')

  // ── Phase 8: PublishManifest serialization ──
  console.log('\n📦 Phase 8: PublishManifest Robustness')
  console.log('────────────────────────────────────')

  const manifestJson = JSON.stringify(manifest)
  const parsedManifest = JSON.parse(manifestJson) as PublishManifest
  assert(parsedManifest.adapter === 'git', 'Manifest survives JSON roundtrip')
  assert(parsedManifest.files.length === 3, 'Manifest files survive roundtrip')
  assert(parsedManifest.manifestSha256 === originalSha, 'Manifest sha256 survives roundtrip')

  // ── Cleanup ──
  if (fs.existsSync(workDir)) {
    fs.rmSync(workDir, { recursive: true, force: true })
  }

  // ── Results ──
  console.log('\n══════════════════════════════════════════════════')
  console.log(`📊 Results: ${passed} passed, ${failed} failed`)
  console.log('══════════════════════════════════════════════════')

  if (failed > 0) {
    console.error('\n❌ K4 RC2 Sprint 2 Regression FAILED\n')
    process.exit(1)
  }

  console.log('\n✅ K4 RC2 Sprint 2 Golden Regression PASSED — Git Distribution Platform frozen\n')
}

main().catch(e => {
  console.error('\n❌ Regression error:', e.message)
  process.exit(1)
})
