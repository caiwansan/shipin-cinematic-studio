/**
 * 文件下载服务：从外部URL下载文件到本地存储，生成持久化链接
 */
import { resolve } from 'path'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { createWriteStream, existsSync, createReadStream } from 'fs'
import { randomUUID } from 'crypto'
import { get } from 'https'
import { request as httpRequest } from 'http'

const UPLOAD_DIR = '/root/shipin-cinematic-studio/backend/public/uploads'
const BASE_URL = '/api/v1/uploads'

/**
 * 从外部URL下载文件到本地持久化存储
 * @param sourceUrl 外部URL（如火山TOS链接）
 * @param type 类型：image / video
 * @returns 本地持久化URL
 */
export async function downloadToLocal(sourceUrl: string, type: 'image' | 'video', prompt?: string): Promise<{
  localUrl: string
  localPath: string
  ext: string
  size: number
}> {
  const ext = getExtension(sourceUrl, type)
  const filename = `${randomUUID()}.${ext}`
  const localPath = resolve(UPLOAD_DIR, filename)
  await mkdir(UPLOAD_DIR, { recursive: true })

  await downloadFile(sourceUrl, localPath)

  // 检查文件是否有效
  const { stat } = await import('fs/promises')
  const stats = await stat(localPath)
  if (stats.size === 0) {
    throw new Error(`下载失败: 文件大小为0 [${sourceUrl.slice(0, 50)}]`)
  }

  const localUrl = `${BASE_URL}/${filename}`
  return { localUrl, localPath, ext, size: stats.size }
}

/**
 * 获取文件扩展名
 */
function getExtension(url: string, type: 'image' | 'video'): string {
  if (type === 'video') return 'mp4'

  // 从URL中推导扩展名
  const clean = url.split('?')[0].split('#')[0]
  const extMatch = clean.match(/\.(\w+)$/)
  if (extMatch) {
    const ext = extMatch[1].toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return ext
  }
  return 'png' // 默认
}

/**
 * 下载文件（支持 HTTPS 和 HTTP）
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? get : httpRequest
    const req = protocol(url, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        // 跟随重定向
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject)
        return
      }
      if (!response.statusCode || response.statusCode >= 400) {
        reject(new Error(`下载失败: HTTP ${response.statusCode} [${url.slice(0, 50)}]`))
        return
      }

      const file = createWriteStream(destPath)
      response.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve()
      })
      file.on('error', (err) => {
        file.close()
        unlink(destPath).catch(() => {})
        reject(err)
      })
    })
    req.on('error', reject)
    req.setTimeout(120000, () => {
      req.destroy()
      reject(new Error('下载超时'))
    })
    req.end()
  })
}

/**
 * 从本地文件读取并返回buffer
 */
export async function readLocalFile(filename: string): Promise<Buffer> {
  const filepath = resolve(UPLOAD_DIR, filename)
  const { readFile } = await import('fs/promises')
  return readFile(filepath)
}

export { UPLOAD_DIR }

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

