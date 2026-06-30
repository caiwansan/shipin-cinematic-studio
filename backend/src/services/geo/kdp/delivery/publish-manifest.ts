// ════════════════════════════════════════════════════════════
// K4 RC2 Sprint 2 — PublishManifest
// ════════════════════════════════════════════════════════════
// Unified metadata for all Delivery Adapters.
// Every adapter (Git, S3, CMS, HTTP Webhook) outputs this on successful delivery.
// Verification, Monitoring, and Learning all consume this directly.
// ════════════════════════════════════════════════════════════

import { createHash } from 'crypto'

export interface PublishManifest {
  adapter: string            // 'git' | 's3' | 'oss' | 'cms' | 'http' | 'webhook' | 'local'
  provider: string           // 'github' | 'gitlab' | 'gitea' | 'aws' | 'aliyun' | 'generic'
  version: string            // Manifest schema version
  packageId: string
  jobId: string
  targetType: string
  targetUrl: string          // Actual destination URL/path (e.g., repo URL, bucket URL)
  branch?: string            // Git-specific
  commitHash?: string        // Git-specific
  commitMessage?: string     // Git-specific
  bucket?: string            // S3/OSS-specific
  endpoint?: string          // S3/OSS/CMS-specific
  fileCount: number
  totalBytes: number
  manifestSha256: string     // SHA256 of the manifest itself (for tamper detection)
  publishedAt: string        // ISO timestamp
  files: Array<{
    path: string
    status: 'added' | 'modified' | 'deleted' | 'unchanged'
    sizeBytes: number
    sha256: string
  }>
  previousCommitHash?: string  // Git-specific: for diff/rollback
  rollbackCommand?: string     // How to undo this publish (adapter-specific)
}

export function createPublishManifest(opts: {
  adapter: string
  provider: string
  packageId: string
  jobId: string
  targetType: string
  targetUrl: string
  fileCount: number
  totalBytes: number
  files: Array<{ path: string; status: 'added' | 'modified' | 'deleted' | 'unchanged'; sizeBytes: number; sha256: string }>
  branch?: string
  commitHash?: string
  commitMessage?: string
  previousCommitHash?: string
  bucket?: string
  endpoint?: string
}): PublishManifest {
  const manifest: PublishManifest = {
    adapter: opts.adapter,
    provider: opts.provider,
    version: '1.0.0',
    packageId: opts.packageId,
    jobId: opts.jobId,
    targetType: opts.targetType,
    targetUrl: opts.targetUrl,
    branch: opts.branch,
    commitHash: opts.commitHash,
    commitMessage: opts.commitMessage,
    previousCommitHash: opts.previousCommitHash,
    bucket: opts.bucket,
    endpoint: opts.endpoint,
    fileCount: opts.fileCount,
    totalBytes: opts.totalBytes,
    manifestSha256: '',
    publishedAt: new Date().toISOString(),
    files: opts.files,
  }

  // Self-checksum: SHA256 of serialized manifest (without the checksum field)
  const { manifestSha256: _, ...rest } = manifest
  const serialized = JSON.stringify(rest, Object.keys(rest).sort())
  manifest.manifestSha256 = createHash('sha256').update(serialized).digest('hex')

  return manifest
}
