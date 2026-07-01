// ════════════════════════════════════════════════════════════
// K4 RC2 Sprint 3 — S3 Provider (S3-compatible: R2, MinIO)
// ════════════════════════════════════════════════════════════
// Uses @aws-sdk/client-s3 for AWS S3 and S3-compatible stores.
// MinIO, R2, and other S3-compatible services work by setting endpoint.
// ════════════════════════════════════════════════════════════

import { execSync } from 'child_process'
import * as fs from 'fs'
import {
  StorageProvider, StorageProviderConfig,
  ObjectMeta, UploadOptions,
} from './storage-provider'

export class S3Provider implements StorageProvider {
  readonly name = 's3'

  async authenticate(config: StorageProviderConfig): Promise<boolean> {
    try {
      execSync(
        `aws s3 ls --endpoint-url ${config.endpoint || 'https://s3.amazonaws.com'} --region ${config.region} 2>&1 | head -1`,
        {
          env: { ...process.env, AWS_ACCESS_KEY_ID: config.accessKeyId, AWS_SECRET_ACCESS_KEY: config.secretAccessKey },
          stdio: 'pipe',
          timeout: 10000,
        }
      )
      return true
    } catch {
      return false
    }
  }

  async bucketExists(config: StorageProviderConfig): Promise<boolean> {
    try {
      const endpoint = config.endpoint ? `--endpoint-url ${config.endpoint}` : ''
      execSync(
        `aws s3api head-bucket --bucket ${config.bucket} ${endpoint} --region ${config.region}`,
        {
          env: { ...process.env, AWS_ACCESS_KEY_ID: config.accessKeyId, AWS_SECRET_ACCESS_KEY: config.secretAccessKey },
          stdio: 'pipe',
          timeout: 10000,
        }
      )
      return true
    } catch {
      return false
    }
  }

  async createBucket(config: StorageProviderConfig): Promise<boolean> {
    try {
      const endpoint = config.endpoint ? `--endpoint-url ${config.endpoint}` : ''
      execSync(
        `aws s3 mb s3://${config.bucket} ${endpoint} --region ${config.region}`,
        {
          env: { ...process.env, AWS_ACCESS_KEY_ID: config.accessKeyId, AWS_SECRET_ACCESS_KEY: config.secretAccessKey },
          stdio: 'pipe',
          timeout: 10000,
        }
      )
      return true
    } catch {
      return false
    }
  }

  async uploadObject(config: StorageProviderConfig, opts: UploadOptions): Promise<ObjectMeta> {
    const endpoint = config.endpoint ? `--endpoint-url ${config.endpoint}` : ''

    // Write content to temp file
    const tmpFile = `/tmp/storage-upload-${Date.now()}`
    fs.writeFileSync(tmpFile, opts.content, 'utf8')

    try {
      const contentType = opts.contentType ? `--content-type "${opts.contentType}"` : ''
      const cacheControl = opts.cacheControl ? `--cache-control "${opts.cacheControl}"` : ''

      execSync(
        `aws s3 cp ${tmpFile} s3://${config.bucket}/${opts.key} ${endpoint} --region ${config.region} ${contentType} ${cacheControl}`,
        {
          env: { ...process.env, AWS_ACCESS_KEY_ID: config.accessKeyId, AWS_SECRET_ACCESS_KEY: config.secretAccessKey },
          stdio: 'pipe',
          timeout: 30000,
        }
      )

      // Head object to get etag and metadata
      return await this.headObject(config, opts.key) || {
        key: opts.key,
        sizeBytes: fs.statSync(tmpFile).size,
        contentType: opts.contentType,
      }
    } finally {
      try { fs.unlinkSync(tmpFile) } catch {}
    }
  }

  async deleteObject(config: StorageProviderConfig, key: string): Promise<boolean> {
    try {
      const endpoint = config.endpoint ? `--endpoint-url ${config.endpoint}` : ''
      execSync(
        `aws s3 rm s3://${config.bucket}/${key} ${endpoint} --region ${config.region}`,
        {
          env: { ...process.env, AWS_ACCESS_KEY_ID: config.accessKeyId, AWS_SECRET_ACCESS_KEY: config.secretAccessKey },
          stdio: 'pipe',
          timeout: 10000,
        }
      )
      return true
    } catch {
      return false
    }
  }

  async listObjects(config: StorageProviderConfig, prefix?: string): Promise<ObjectMeta[]> {
    try {
      const endpoint = config.endpoint ? `--endpoint-url ${config.endpoint}` : ''
      const prefixFlag = prefix ? `--prefix ${prefix}` : ''
      const result = execSync(
        `aws s3api list-objects --bucket ${config.bucket} ${endpoint} --region ${config.region} ${prefixFlag} --query 'Contents[].[Key,Size,ETag,LastModified]' --output json`,
        {
          env: { ...process.env, AWS_ACCESS_KEY_ID: config.accessKeyId, AWS_SECRET_ACCESS_KEY: config.secretAccessKey },
          stdio: 'pipe',
          timeout: 10000,
        }
      ).toString().trim()

      const parsed = JSON.parse(result || '[]')
      return parsed.map((item: any) => ({
        key: item[0],
        etag: item[2]?.replace(/"/g, ''),
        sizeBytes: item[1] || 0,
        lastModified: item[3],
        publicUrl: this.generatePublicUrl(config, item[0]),
      }))
    } catch {
      return []
    }
  }

  async headObject(config: StorageProviderConfig, key: string): Promise<ObjectMeta | null> {
    try {
      const endpoint = config.endpoint ? `--endpoint-url ${config.endpoint}` : ''
      const result = execSync(
        `aws s3api head-object --bucket ${config.bucket} --key ${key} ${endpoint} --region ${config.region} --output json`,
        {
          env: { ...process.env, AWS_ACCESS_KEY_ID: config.accessKeyId, AWS_SECRET_ACCESS_KEY: config.secretAccessKey },
          stdio: 'pipe',
          timeout: 10000,
        }
      ).toString().trim()

      const parsed = JSON.parse(result)
      return {
        key,
        etag: parsed.ETag?.replace(/"/g, ''),
        sizeBytes: parsed.ContentLength || 0,
        contentType: parsed.ContentType,
        lastModified: parsed.LastModified,
        publicUrl: this.generatePublicUrl(config, key),
        storageClass: parsed.StorageClass,
      }
    } catch {
      return null
    }
  }

  generatePublicUrl(config: StorageProviderConfig, key: string): string {
    if (config.endpoint) {
      // S3-compatible: R2, MinIO
      return `${config.endpoint}/${config.bucket}/${key}`
    }
    // Standard S3
    return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`
  }

  async health(config: StorageProviderConfig): Promise<{ ok: boolean; latencyMs: number; message?: string }> {
    const start = Date.now()
    const ok = await this.authenticate(config)
    return {
      ok,
      latencyMs: Date.now() - start,
      message: ok ? 'S3 API reachable' : 'S3 auth failed',
    }
  }
}
