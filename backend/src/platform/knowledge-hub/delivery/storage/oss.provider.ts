// ════════════════════════════════════════════════════════════
// K4 RC2 Sprint 3 — Alibaba OSS Provider
// ════════════════════════════════════════════════════════════
// Uses ossutil CLI for Alibaba Cloud Object Storage Service.
// ════════════════════════════════════════════════════════════

import { execSync } from 'child_process'
import * as fs from 'fs'
import {
  StorageProvider, StorageProviderConfig,
  ObjectMeta, UploadOptions,
} from './storage-provider'

export class OSSProvider implements StorageProvider {
  readonly name = 'oss'

  async authenticate(config: StorageProviderConfig): Promise<boolean> {
    try {
      execSync(
        `ossutil ls --endpoint ${this.resolveEndpoint(config)} -i ${config.accessKeyId} -k ${config.secretAccessKey} 2>&1 | head -1`,
        { stdio: 'pipe', timeout: 10000 }
      )
      return true
    } catch {
      return false
    }
  }

  async bucketExists(config: StorageProviderConfig): Promise<boolean> {
    try {
      execSync(
        `ossutil ls oss://${config.bucket} --endpoint ${this.resolveEndpoint(config)} -i ${config.accessKeyId} -k ${config.secretAccessKey} 2>&1 | head -1`,
        { stdio: 'pipe', timeout: 10000 }
      )
      return true
    } catch {
      return false
    }
  }

  async createBucket(config: StorageProviderConfig): Promise<boolean> {
    try {
      execSync(
        `ossutil mb oss://${config.bucket} --endpoint ${this.resolveEndpoint(config)} -i ${config.accessKeyId} -k ${config.secretAccessKey}`,
        { stdio: 'pipe', timeout: 10000 }
      )
      return true
    } catch {
      return false
    }
  }

  async uploadObject(config: StorageProviderConfig, opts: UploadOptions): Promise<ObjectMeta> {
    const tmpFile = `/tmp/oss-upload-${Date.now()}`
    fs.writeFileSync(tmpFile, opts.content, 'utf8')

    try {
      const headers = opts.contentType ? `--header Content-Type:${opts.contentType}` : ''
      execSync(
        `ossutil cp ${tmpFile} oss://${config.bucket}/${opts.key} --endpoint ${this.resolveEndpoint(config)} -i ${config.accessKeyId} -k ${config.secretAccessKey} ${headers}`,
        { stdio: 'pipe', timeout: 30000 }
      )

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
      execSync(
        `ossutil rm oss://${config.bucket}/${key} --endpoint ${this.resolveEndpoint(config)} -i ${config.accessKeyId} -k ${config.secretAccessKey}`,
        { stdio: 'pipe', timeout: 10000 }
      )
      return true
    } catch {
      return false
    }
  }

  async listObjects(config: StorageProviderConfig, prefix?: string): Promise<ObjectMeta[]> {
    try {
      const prefixFlag = prefix || ''
      const result = execSync(
        `ossutil ls oss://${config.bucket}/${prefixFlag} --endpoint ${this.resolveEndpoint(config)} -i ${config.accessKeyId} -k ${config.secretAccessKey}`,
        { stdio: 'pipe', timeout: 10000 }
      ).toString().trim()

      // Parse ossutil output (lines: 2024-01-01 12:00:00 12345 oss://bucket/key)
      const lines = result.split('\n').filter(l => l.includes('oss://'))
      return lines.map(line => {
        const parts = line.trim().split(/\s+/)
        const sizeBytes = parseInt(parts[parts.length - 2], 10) || 0
        const fullPath = parts[parts.length - 1]
        const key = fullPath.replace(`oss://${config.bucket}/`, '')
        return {
          key,
          sizeBytes,
          publicUrl: this.generatePublicUrl(config, key),
        }
      })
    } catch {
      return []
    }
  }

  async headObject(config: StorageProviderConfig, key: string): Promise<ObjectMeta | null> {
    try {
      const result = execSync(
        `ossutil stat oss://${config.bucket}/${key} --endpoint ${this.resolveEndpoint(config)} -i ${config.accessKeyId} -k ${config.secretAccessKey}`,
        { stdio: 'pipe', timeout: 10000 }
      ).toString().trim()

      return {
        key,
        sizeBytes: 0,
        publicUrl: this.generatePublicUrl(config, key),
      }
    } catch {
      return null
    }
  }

  generatePublicUrl(config: StorageProviderConfig, key: string): string {
    const endpoint = this.resolveEndpoint(config)
    const bucketEndpoint = endpoint.replace(/^oss-/, '')
    return `${config.bucket}.${bucketEndpoint}/${key}`
  }

  async health(config: StorageProviderConfig): Promise<{ ok: boolean; latencyMs: number; message?: string }> {
    const start = Date.now()
    const ok = await this.authenticate(config)
    return {
      ok,
      latencyMs: Date.now() - start,
      message: ok ? 'OSS API reachable' : 'OSS auth failed',
    }
  }

  private resolveEndpoint(config: StorageProviderConfig): string {
    return config.endpoint || `oss-${config.region}.aliyuncs.com`
  }
}
