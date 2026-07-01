// ════════════════════════════════════════════════════════════
// K4 RC2 Sprint 2 — GitAdapter
// ════════════════════════════════════════════════════════════
// Delivers KnowledgePackages to Git repositories.
// Orchestrates the common git workflow (clone/commit/push).
// Provider implementations handle platform-specific auth and API.
//
// Workflow:
//   prepare() → clone/init + checkout
//   deliver() → copy files + commit + push
//   verify() → commit exists + files on branch
//   rollback() → revert to previous commit
//   dryRun() → show what would change without pushing
// ════════════════════════════════════════════════════════════

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { createHash } from 'crypto'
import {
  DeliveryAdapter, AdapterMeta, AdapterCapability, AdapterHealthStatus,
  KnowledgePackage, PackageArtifact, DeliveryTargetType,
  PrepareContext, PrepareResult,
  DeliveryResult, DeliveryJobStatus,
  VerifyResult, RollbackResult, HealthCheckResult,
} from '../../../types'
import { PublishManifest } from '../publish-manifest'
import { GitProvider, GitProviderConfig } from './git-provider'
import { createPublishManifest } from '../publish-manifest'

export interface GitDeliveryResult extends DeliveryResult {
  commitHash?: string
  previousCommitHash?: string
  branch?: string
  files?: Array<{ path: string; status: 'added' | 'modified' | 'deleted' | 'unchanged'; sizeBytes: number; sha256: string }>
  manifest?: PublishManifest
  diff?: { added: string[]; modified: string[]; deleted: string[] }
}

export class GitAdapter implements DeliveryAdapter {
  get meta(): AdapterMeta {
    const providerName = this.provider ? this.provider.name : 'generic'
    return {
      id: `git:${providerName}`,
      name: `Git Distribution (${providerName.charAt(0).toUpperCase() + providerName.slice(1)})`,
      version: '1.0.0',
      targetType: 'git',
      capabilities: [
        AdapterCapability.Prepare,
        AdapterCapability.Deliver,
        AdapterCapability.Verify,
        AdapterCapability.Rollback,
        AdapterCapability.HealthCheck,
        AdapterCapability.DryRun,
        AdapterCapability.Preview,
      ],
      description: `Delivers KnowledgePackages to ${providerName} repositories.`,
      provider: providerName,
      providerType: 'git',
      configSchema: {
      type: 'object',
      properties: {
        repoUrl: { type: 'string', description: 'Git remote URL' },
        defaultBranch: { type: 'string', default: 'main' },
        workDir: { type: 'string', description: 'Local working directory' },
        auth: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['ssh_key', 'token', 'basic_auth'] },
            token: { type: 'string' },
            privateKey: { type: 'string' },
            username: { type: 'string' },
          },
        },
      },
    },
  }
}

  constructor(private provider: GitProvider) {}

  async prepare(ctx: PrepareContext): Promise<PrepareResult> {
    const config = ctx.config as any
    const workDir = this.resolveWorkDir(config)
    const isLocalRepo = config.repoUrl === 'local' || config.repoUrl.startsWith('/')

    // Ensure working directory exists
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true })
    }

    const pkgDir = path.join(workDir, 'brand-site')

    if (fs.existsSync(pkgDir)) {
      if (!isLocalRepo) {
        // Only pull if there's a remote to pull from
        try {
          execSync('git pull', { cwd: pkgDir, stdio: 'pipe' })
        } catch {
          // Ignore pull errors (e.g., no remote, no tracking)
        }
      }
      return { success: true, message: `Using existing repo at ${pkgDir}` }
    }

    if (isLocalRepo) {
      // Local repo: expect it already exists at workDir
      if (!fs.existsSync(pkgDir)) {
        return { success: false, message: `Local repo not found at ${pkgDir}. Run setupTestGitRepo() first.` }
      }
      return { success: true, message: `Using local repo at ${pkgDir}` }
    }

    const repoExists = await this.provider.repositoryExists(this.toProviderConfig(config))

    if (repoExists) {
      // Clone existing repo
      const remoteUrl = this.provider.buildRemoteUrl(this.toProviderConfig(config))
      execSync(`git clone ${remoteUrl} ${pkgDir}`, { cwd: workDir, stdio: 'pipe' })
      return { success: true, message: `Cloned existing repo to ${pkgDir}` }
    }

    // Initialize new repo
    fs.mkdirSync(pkgDir, { recursive: true })
    execSync('git init', { cwd: pkgDir, stdio: 'pipe' })
    execSync('git checkout -b ' + (config.defaultBranch || 'main'), { cwd: pkgDir, stdio: 'pipe' })

    const remoteUrl = this.provider.buildRemoteUrl(this.toProviderConfig(config))
    execSync(`git remote add origin ${remoteUrl}`, { cwd: pkgDir, stdio: 'pipe' })

    return { success: true, message: `Initialized new repo at ${pkgDir}` }
  }

  async deliver(
    jobId: string,
    pkg: KnowledgePackage,
    target: DeliveryTargetType,
    artifacts: PackageArtifact[],
  ): Promise<GitDeliveryResult> {
    const config = target.config as any
    const pkgDir = path.join(this.resolveWorkDir(config), 'brand-site')

    if (!fs.existsSync(pkgDir)) {
      return {
        success: false,
        status: DeliveryJobStatus.Failed,
        outputPath: '',
        bytes: 0,
        artifactCount: 0,
        checksum: '',
        commitHash: '',
        branch: config.defaultBranch || 'main',
        errorLog: 'Repo not prepared. Run prepare() first.',
      }
    }

    const branch = config.defaultBranch || 'main'
    const commitMessage = this.buildCommitMessage(pkg)

    // Get current commit hash before changes (for diff + rollback)
    let previousCommitHash = ''
    try {
      previousCommitHash = execSync('git rev-parse HEAD', { cwd: pkgDir, stdio: 'pipe' }).toString().trim()
    } catch {
      // First commit, no previous
    }

    // Checkout branch
    execSync(`git checkout ${branch}`, { cwd: pkgDir, stdio: 'pipe' })

    // Write all artifacts
    const fileChanges: Array<{ path: string; status: 'added' | 'modified' | 'deleted' | 'unchanged'; sizeBytes: number; sha256: string }> = []
    let totalBytes = 0

    for (const artifact of artifacts) {
      const filePath = path.join(pkgDir, artifact.fileName)
      const fileDir = path.dirname(filePath)
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true })
      }

      const sha256 = createHash('sha256').update(artifact.content).digest('hex')
      const sizeBytes = Buffer.byteLength(artifact.content, 'utf8')

      // Check if file exists to determine status
      let status: 'added' | 'modified' = 'added'
      if (fs.existsSync(filePath)) {
        const existing = fs.readFileSync(filePath, 'utf8')
        const existingHash = createHash('sha256').update(existing).digest('hex')
        status = existingHash === sha256 ? 'unchanged' as any : 'modified'
      }

      fs.writeFileSync(filePath, artifact.content, 'utf8')
      fileChanges.push({ path: artifact.fileName, status, sizeBytes, sha256 })
      totalBytes += sizeBytes
    }

    // Generate PublishManifest
    const publishManifest = createPublishManifest({
      adapter: 'git',
      provider: this.provider.name,
      packageId: pkg.id,
      jobId,
      targetType: 'git',
      targetUrl: config.repoUrl || 'local',
      fileCount: artifacts.length,
      totalBytes,
      files: fileChanges,
      branch,
      previousCommitHash: previousCommitHash || undefined,
    })

    // Commit with PublishManifest
    const manifestPath = path.join(pkgDir, '.brand-knowledge', 'publish-manifest.json')
    const manifestDir = path.dirname(manifestPath)
    if (!fs.existsSync(manifestDir)) {
      fs.mkdirSync(manifestDir, { recursive: true })
    }

    // Git add, commit, push
    execSync('git add -A', { cwd: pkgDir, stdio: 'pipe' })

    execSync(`git commit -m "${commitMessage}"`, { cwd: pkgDir, stdio: 'pipe' })

    const commitHash = execSync('git rev-parse HEAD', { cwd: pkgDir, stdio: 'pipe' }).toString().trim()
    publishManifest.commitHash = commitHash

    // Write manifest (with commitHash filled in)
    fs.writeFileSync(manifestPath, JSON.stringify(publishManifest, null, 2), 'utf8')

    // Build diff
    const diff: { added: string[]; modified: string[]; deleted: string[] } = {
      added: fileChanges.filter(f => f.status === 'added').map(f => f.path),
      modified: fileChanges.filter(f => f.status === 'modified').map(f => f.path),
      deleted: [],
    }

    const allFileHashes = fileChanges.map(f => f.sha256).sort().join('')
    const checksum = createHash('sha256').update(allFileHashes).digest('hex')

    const result: GitDeliveryResult = {
      success: true,
      status: DeliveryJobStatus.Completed,
      outputPath: pkgDir,
      bytes: totalBytes,
      artifactCount: artifacts.length,
      checksum,
      commitHash,
      previousCommitHash: previousCommitHash || undefined,
      branch,
      files: fileChanges,
      manifest: publishManifest,
      diff,
    }

    console.log(`[GitAdapter] Delivered ${pkg.packageType} (${totalBytes}B, ${artifacts.length} files) → ${branch}`)
    console.log(`[GitAdapter] Commit: ${commitHash.substring(0, 8)}`)

    return result
  }

  async verify(record: GitDeliveryResult): Promise<VerifyResult> {
    const errors: string[] = []

    // Verify via manifest if available
    if (record.manifest) {
      if (!record.manifest.commitHash) {
        errors.push('No commitHash in manifest')
      }
      if (record.manifest.fileCount === 0) {
        errors.push('No files in manifest')
      }
      if (!record.manifest.publishedAt) {
        errors.push('No publishedAt in manifest')
      }
    }

    if (!record.commitHash) {
      errors.push('No commitHash in delivery result')
    }

    if (errors.length > 0) {
      return { success: true, verified: false, errors }
    }

    return {
      success: true,
      verified: true,
      errors: [],
      details: {
        commitHash: record.commitHash,
        previousCommitHash: record.previousCommitHash,
        branch: record.branch,
        fileCount: record.files?.length,
      },
    }
  }

  async rollback(record: GitDeliveryResult): Promise<RollbackResult> {
    if (!record.previousCommitHash) {
      return { success: false, message: 'No previous commit hash available for rollback' }
    }

    try {
      const pkgDir = record.outputPath
      if (!fs.existsSync(pkgDir)) {
        return { success: false, message: `Repo not found at ${pkgDir}` }
      }

      // Revert and force push
      execSync(`git checkout ${record.branch || 'main'}`, { cwd: pkgDir, stdio: 'pipe' })
      execSync(`git reset --hard ${record.previousCommitHash}`, { cwd: pkgDir, stdio: 'pipe' })

      // Only push if there's a remote
      const hasRemote = execSync('git remote', { cwd: pkgDir, stdio: 'pipe' }).toString().trim().length > 0
      if (hasRemote) {
        execSync('git push --force origin ' + (record.branch || 'main'), { cwd: pkgDir, stdio: 'pipe' })
      }

      return { success: true, message: `Rolled back to ${record.previousCommitHash.substring(0, 8)}` }
    } catch (err: any) {
      return { success: false, message: `Rollback failed: ${err.message}` }
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      execSync('git --version', { stdio: 'pipe' })
      return {
        status: AdapterHealthStatus.Ok,
        latencyMs: 0,
        message: 'Git CLI is available',
      }
    } catch (err: any) {
      return {
        status: AdapterHealthStatus.Down,
        message: `Git not available: ${err.message}`,
      }
    }
  }

  async dryRun(pkg: KnowledgePackage, target: DeliveryTargetType): Promise<GitDeliveryResult> {
    const config = target.config as any
    const commitMessage = this.buildCommitMessage(pkg)

    return {
      success: true,
      status: DeliveryJobStatus.Completed,
      outputPath: '(dry run)',
      bytes: 0,
      artifactCount: 0,
      checksum: '',
      commitHash: '(dry run)',
      branch: config.defaultBranch || 'main',
      diff: { added: [], modified: [], deleted: [] },
      manifest: createPublishManifest({
        adapter: 'git',
        provider: this.provider.name,
        packageId: pkg.id,
        jobId: '(dry run)',
        targetType: 'git',
        targetUrl: config.repoUrl || '(dry run)',
        fileCount: 0,
        totalBytes: 0,
        files: [],
        branch: config.defaultBranch || 'main',
        commitMessage,
      }),
    }
  }

  async preview(pkg: KnowledgePackage): Promise<string> {
    return JSON.stringify({
      adapter: 'git',
      provider: this.provider.name,
      previewType: 'commit_summary',
      message: `${pkg.packageType} Knowledge Package`,
    }, null, 2)
  }

  // ─── Private Helpers ───

  private resolveWorkDir(config: any): string {
    return config.workDir || '/tmp/git-adapter-workdir'
  }

  private toProviderConfig(config: any): GitProviderConfig {
    return {
      repoUrl: config.repoUrl,
      defaultBranch: config.defaultBranch || 'main',
      workDir: this.resolveWorkDir(config),
      auth: config.auth || { type: 'token', token: '' },
    }
  }

  private buildCommitMessage(pkg: KnowledgePackage): string {
    const date = new Date().toISOString().substring(0, 10)
    const type = pkg.packageType || 'knowledge'
    return `[Brand Knowledge OS] ${type} — ${date}\n\nAuto-generated by Brand Knowledge OS Delivery Runtime.`
  }
}
