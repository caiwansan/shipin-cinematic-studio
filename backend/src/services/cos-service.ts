/**
 * COS 对象存储服务（腾讯云 COS 官方 SDK）
 *
 * 从数据库 StorageConfig 读取配置，上传文件到 COS 存储桶。
 * 支持：腾讯云 COS
 *
 * 使用方式：
 *   import { cosService } from '../services/cos-service.js'
 *   const url = await cosService.uploadFile(sourceUrl, 'image', userId)
 */

import COS from 'cos-nodejs-sdk-v5'
import { createReadStream, createWriteStream } from 'fs'
import { mkdir, unlink, stat } from 'fs/promises'
import { resolve } from 'path'
import { randomUUID } from 'crypto'
import { get } from 'https'
import { request as httpRequest } from 'http'
import crypto from 'crypto'
import { prisma } from '../utils/index.js'

// AES-GCM 解密
const ALGORITHM = 'aes-256-gcm'
function decryptKey(ciphertext: string): string {
  try {
    const key = Buffer.from(process.env.CRYPTO_ENCRYPTION_KEY || '', 'hex')
    const parts = ciphertext.split(':')
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]
    const authTag = Buffer.from(parts[2], 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    return ciphertext
  }
}

interface CosConfig {
  endpoint: string
  region: string
  accessKey: string
  secretKey: string
  bucket: string
}

class CosService {
  private cachedConfig: CosConfig | null = null
  private cosInstance: COS | null = null
  private tempDir = '/tmp/cos-uploads'

  /**
   * 从数据库加载默认配置
   */
  async loadDefaultConfig(): Promise<CosConfig | null> {
    try {
      const config = await prisma.storageConfig.findFirst({
        where: { enabled: true },
        orderBy: { isDefault: 'desc' },
      })
      if (!config) return null

      // 尝试解密，如解密失败（密钥变更）则直接使用原始值
      let rawSecretKey = config.secretKey
      try {
        rawSecretKey = decryptKey(config.secretKey)
      } catch {
        console.warn('[COS] ⚠️ secretKey 解密失败（加密密钥可能已变更），使用原始值')
        rawSecretKey = config.secretKey
      }

      this.cachedConfig = {
        endpoint: config.endpoint,
        region: config.region || 'ap-guangzhou',
        accessKey: config.accessKey,
        secretKey: rawSecretKey,
        bucket: config.bucket,
      }

      this.cosInstance = new COS({
        SecretId: this.cachedConfig.accessKey,
        SecretKey: this.cachedConfig.secretKey,
        UseAccelerate: false,
      })

      return this.cachedConfig
    } catch (err) {
      console.error('[COS] 加载配置失败:', err)
      return null
    }
  }

  /**
   * 获取 COS 实例
   */
  async getCOS(): Promise<COS> {
    if (!this.cosInstance) await this.loadDefaultConfig()
    if (!this.cosInstance) throw new Error('[COS] 未配置存储，请在后台设置 COS 存储配置')
    return this.cosInstance
  }

  /**
   * 获取配置
   */
  async getConfig(): Promise<CosConfig> {
    if (!this.cachedConfig) await this.loadDefaultConfig()
    if (!this.cachedConfig) throw new Error('[COS] 未配置存储，请在后台设置 COS 存储配置')
    return this.cachedConfig
  }

  /**
   * 从外部 URL 下载文件到临时目录
   */
  async downloadToTemp(sourceUrl: string): Promise<{ filepath: string; size: number }> {
    await mkdir(this.tempDir, { recursive: true })
    const ext = this.getExtension(sourceUrl)
    const filename = `${randomUUID()}.${ext}`
    const filepath = resolve(this.tempDir, filename)

    await this.downloadFile(sourceUrl, filepath)

    const fstat = await stat(filepath)
    if (fstat.size === 0) {
      throw new Error(`[COS] 下载失败: 文件大小为0 [${sourceUrl.slice(0, 50)}]`)
    }

    return { filepath, size: fstat.size }
  }

  /**
   * 上传文件到 COS
   * @param sourceUrl 源 URL（外部 API 返回的临时链接）
   * @param type image | video
   * @param userId 用户 ID（可选，用于组织目录）
   * @returns COS 上可公开访问的 URL
   */
  async uploadFile(sourceUrl: string, type: 'image' | 'video', userId?: string): Promise<{ cosUrl: string; cosKey: string }> {
    const cos = await this.getCOS()
    const config = await this.getConfig()

    // 下载到临时目录
    const { filepath } = await this.downloadToTemp(sourceUrl)

    // 构建 COS 路径
    const ext = this.getExtension(sourceUrl)
    const dir = type === 'video' ? 'videos' : 'images'
    const userIdPath = userId ? `${userId}/` : ''
    const key = `${dir}/${userIdPath}${randomUUID()}.${ext}`

    try {
      // 使用腾讯云 COS 官方 SDK 上传
      await new Promise<void>((resolve, reject) => {
        cos.putObject({
          Bucket: config.bucket,
          Region: config.region,
          Key: key,
          Body: createReadStream(filepath),
          ContentLength: undefined, // 自动计算
        }, (err, data) => {
          if (err) reject(new Error(err.message || 'COS上传失败'))
          else resolve()
        })
      })

      // 构建可访问 URL
      const cosUrl = this.buildCosUrl(key)

      // 清理临时文件
      await unlink(filepath).catch(() => {})

      return { cosUrl, cosKey: key }
    } catch (err) {
      await unlink(filepath).catch(() => {})
      throw err
    }
  }

  /**
   * 上传本地 Buffer 到 COS
   */
  async uploadBuffer(buffer: Buffer, filename: string, userId?: string): Promise<{ cosUrl: string; cosKey: string }> {
    const cos = await this.getCOS()
    const config = await this.getConfig()

    const ext = filename.split('.').pop()?.toLowerCase() || 'png'
    const dir = ext === 'mp4' ? 'videos' : 'images'
    const userIdPath = userId ? `${userId}/` : ''
    const key = `uploads/${userIdPath}${randomUUID()}.${ext}`

    await new Promise<void>((resolve, reject) => {
      cos.putObject({
        Bucket: config.bucket,
        Region: config.region,
        Key: key,
        Body: buffer,
      }, (err) => {
        if (err) reject(new Error(err.message || 'COS上传失败'))
        else resolve()
      })
    })

    return { cosUrl: this.buildCosUrl(key), cosKey: key }
  }

  /**
   * 构建 COS 可访问 URL
   * 虚拟主机风格: https://<bucket>.cos.<region>.myqcloud.com/<key>
   */
  private buildCosUrl(key: string): string {
    const bucket = this.cachedConfig?.bucket || ''
    const region = this.cachedConfig?.region || 'ap-guangzhou'
    return `https://${bucket}.cos.${region}.myqcloud.com/${key}`
  }

  private getExtension(url: string): string {
    const clean = url.split('?')[0].split('#')[0]
    const extMatch = clean.match(/\.(\w+)$/)
    if (extMatch) {
      const ext = extMatch[1].toLowerCase()
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'mp4', 'mov', 'avi', 'wmv'].includes(ext)) return ext
    }
    return 'png'
  }

  private async downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? get : httpRequest
      const req = protocol(url, (response) => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          this.downloadFile(response.headers.location, destPath).then(resolve).catch(reject)
          return
        }
        if (!response.statusCode || response.statusCode >= 400) {
          reject(new Error(`[COS] 下载失败: HTTP ${response.statusCode} [${url.slice(0, 50)}]`))
          return
        }

        const file = createWriteStream(destPath)
        response.pipe(file)
        file.on('finish', () => { file.close(); resolve() })
        file.on('error', (err) => { file.close(); unlink(destPath).catch(() => {}); reject(err) })
      })
      req.on('error', reject)
      req.setTimeout(180000, () => { req.destroy(); reject(new Error('[COS] 下载超时')) })
      req.end()
    })
  }
}

export const cosService = new CosService()
