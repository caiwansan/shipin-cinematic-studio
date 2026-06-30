// ════════════════════════════════════════════════════════════
// K4 RC2 Sprint 3 — Object Storage Provider Interface
// ════════════════════════════════════════════════════════════
// Each Object Storage Provider implements this.
// ObjectStorageAdapter orchestrates the common workflow.
// Provider only implements platform-specific API calls.
//
// Supported providers:
//   AWS S3, Alibaba OSS, Tencent COS, Cloudflare R2, MinIO
// ════════════════════════════════════════════════════════════

export interface StorageProviderConfig {
  endpoint?: string       // Custom endpoint (useful for MinIO/S3-compatible)
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
}

export interface ObjectMeta {
  key: string
  etag?: string
  sizeBytes: number
  contentType?: string
  contentSha256?: string
  lastModified?: string
  publicUrl?: string
  storageClass?: string
}

export interface UploadOptions {
  key: string
  content: string | Buffer
  contentType?: string
  cacheControl?: string
}

export interface StorageProvider {
  readonly name: string    // 's3' | 'oss' | 'cos' | 'r2' | 'minio'

  /** Authenticate and verify access */
  authenticate(config: StorageProviderConfig): Promise<boolean>

  /** Check if bucket exists */
  bucketExists(config: StorageProviderConfig): Promise<boolean>

  /** Create bucket if it doesn't exist */
  createBucket(config: StorageProviderConfig): Promise<boolean>

  /** Upload an object */
  uploadObject(config: StorageProviderConfig, opts: UploadOptions): Promise<ObjectMeta>

  /** Delete an object */
  deleteObject(config: StorageProviderConfig, key: string): Promise<boolean>

  /** List objects with optional prefix */
  listObjects(config: StorageProviderConfig, prefix?: string): Promise<ObjectMeta[]>

  /** Head object (check existence + metadata) */
  headObject(config: StorageProviderConfig, key: string): Promise<ObjectMeta | null>

  /** Generate public URL for an object */
  generatePublicUrl(config: StorageProviderConfig, key: string): string

  /** Health check */
  health(config: StorageProviderConfig): Promise<{ ok: boolean; latencyMs: number; message?: string }>
}

// ─── Rollback Strategy ───
// Unified rollback for all Storage Providers:
//   1. PublishManifest(previous) → list objects that existed before
//   2. Delete all new objects
//   3. Restore previous objects
//   4. Verify
//
// Provider only implements deleteObject(). Rollback logic is in ObjectStorageAdapter.

// ─── Verification Strategy ───
// Unified verification for all Storage Providers:
//   1. Bucket exists
//   2. Each object exists (headObject + SHA256 match)
//   3. Content-Length matches
//   4. Content-Type matches (if specified)
//   5. Manifest consistency
//   6. Public URL accessible (if applicable)
//
// Provider implements headObject(). Verification logic is in ObjectStorageAdapter.
