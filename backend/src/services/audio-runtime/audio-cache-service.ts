/**
 * Narrative Audio Runtime — Audio Cache Service
 * 
 * 缓存键格式: chapterId_voiceId_speed
 * 缓存层: 内存 + 文件系统（可扩展 Redis + MinIO）
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'

interface CacheEntry {
  /** 音频 buffer */
  buffer: Buffer
  /** 创建时间 */
  createdAt: number
  /** 最后访问时间 */
  lastAccessed: number
}

export class AudioCacheService {
  private memoryCache: Map<string, CacheEntry> = new Map()
  private maxMemoryEntries = 200
  private fsCacheDir: string

  constructor(fsCacheDir?: string) {
    this.fsCacheDir = fsCacheDir || '/tmp/nar-cache'
    if (!existsSync(this.fsCacheDir)) {
      mkdirSync(this.fsCacheDir, { recursive: true })
    }
  }

  cacheKey(chapterId: string, voiceId: string, speed: number): string {
    return `${chapterId}_${voiceId}_${speed}x`
  }

  /**
   * 获取缓存
   */
  get(key: string): Buffer | null {
    // 1. 检查内存缓存
    const mem = this.memoryCache.get(key)
    if (mem) {
      mem.lastAccessed = Date.now()
      return mem.buffer
    }

    // 2. 检查文件缓存
    const filePath = this.fsPath(key)
    if (existsSync(filePath)) {
      const buffer = readFileSync(filePath)
      // 提升到内存
      this.setMemory(key, buffer)
      return buffer
    }

    return null
  }

  /**
   * 写入缓存
   */
  set(key: string, buffer: Buffer): void {
    this.setMemory(key, buffer)
    this.setFs(key, buffer)
  }

  private setMemory(key: string, buffer: Buffer): void {
    if (this.memoryCache.size >= this.maxMemoryEntries) {
      // 淘汰最久未访问的
      let oldestKey = key
      let oldestTime = Infinity
      for (const [k, v] of this.memoryCache) {
        if (v.lastAccessed < oldestTime) {
          oldestTime = v.lastAccessed
          oldestKey = k
        }
      }
      this.memoryCache.delete(oldestKey)
    }

    this.memoryCache.set(key, {
      buffer,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    })
  }

  private setFs(key: string, buffer: Buffer): void {
    const filePath = this.fsPath(key)
    writeFileSync(filePath, buffer)
  }

  private fsPath(key: string): string {
    return path.join(this.fsCacheDir, `${key}.mp3`)
  }

  /**
   * 缓存命中率统计
   */
  stats() {
    return {
      memoryEntries: this.memoryCache.size,
      maxMemoryEntries: this.maxMemoryEntries,
      cacheDir: this.fsCacheDir,
    }
  }
}
