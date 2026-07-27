/**
 * ResumeStorage 工厂
 *
 * 根据环境变量配置创建存储实现。
 * Beta 0.3: LocalStorage（本地磁盘）
 * GA: CosStorage（腾讯 COS / 阿里 OSS / S3）
 */

import { LocalStorage } from './local-storage'
import type { ResumeStorage } from './types'

export function createResumeStorage(): ResumeStorage {
  const storageType = process.env.STORAGE_TYPE || 'local'
  const basePath = process.env.RESUME_STORAGE_PATH || '/tmp/resumes'

  switch (storageType) {
    case 'local':
      return new LocalStorage(basePath)
    case 'cos':
      throw new Error('CosStorage not implemented yet (GA)')
    default:
      throw new Error(`Unknown storage type: ${storageType}`)
  }
}
