/**
 * LocalStorage — 本地磁盘存储实现
 *
 * Beta 0.3 使用本地磁盘存储简历文件。
 * GA 可切换为 CosStorage（腾讯 COS / 阿里 OSS / S3）。
 */

import { promises as fs } from 'fs'
import * as path from 'path'
import type { ResumeStorage } from './types'

export class LocalStorage implements ResumeStorage {
  private basePath: string

  constructor(basePath: string) {
    this.basePath = basePath
  }

  async save(file: Buffer, relativePath: string): Promise<string> {
    const fullPath = path.join(this.basePath, relativePath)
    const dir = path.dirname(fullPath)

    // 递归创建目录
    await fs.mkdir(dir, { recursive: true })

    // 写入文件
    await fs.writeFile(fullPath, file)

    return fullPath
  }

  async read(relativePath: string): Promise<Buffer> {
    const fullPath = path.join(this.basePath, relativePath)
    return fs.readFile(fullPath)
  }

  async delete(relativePath: string): Promise<void> {
    const fullPath = path.join(this.basePath, relativePath)
    await fs.unlink(fullPath)
  }

  async exists(relativePath: string): Promise<boolean> {
    const fullPath = path.join(this.basePath, relativePath)
    try {
      await fs.access(fullPath)
      return true
    } catch {
      return false
    }
  }
}
