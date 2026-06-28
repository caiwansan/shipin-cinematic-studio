/**
 * session/session-manager.ts — 生产就绪 Session 管理器
 *
 * 职责：创建、保存、恢复、销毁运行时会话
 * 存储格式：JSON 文件，按 sessionId 分文件
 * 路径：backend/session-store/{sessionId}.json
 *
 * 宪法：
 *   - 不修改任何核心架构
 *   - 可进程重启恢复
 *   - 确定性重建
 */

import fs from 'node:fs'
import path from 'node:path'

const SESSION_DIR = path.resolve(process.cwd(), 'session-store')

// ─── 类型 ─────────────────────────────────────────────────

export interface SessionRecord {
  sessionId: string
  createdAt: number
  lastActiveAt: number
  status: 'active' | 'completed' | 'crashed'
  storyGraph: any
  executionSnapshot: {
    currentSceneId: string | null
    currentShotIndex: number
    completedScenes: number
    totalScenes: number
    intensity: number
    playbackTime: number
    isPlaying: boolean
  }
}

// ─── SessionManager ───────────────────────────────────

export class SessionManager {
  private sessions = new Map<string, SessionRecord>()

  constructor() {
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true })
    }
  }

  /** 创建新 session */
  createSession(storyGraph: any): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const record: SessionRecord = {
      sessionId,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      status: 'active',
      storyGraph,
      executionSnapshot: {
        currentSceneId: null,
        currentShotIndex: 0,
        completedScenes: 0,
        totalScenes: 0,
        intensity: 0.5,
        playbackTime: 0,
        isPlaying: false,
      },
    }
    this.sessions.set(sessionId, record)
    this._persist(record)
    return sessionId
  }

  /** 获取 session */
  getSession(sessionId: string): SessionRecord | undefined {
    let record = this.sessions.get(sessionId)
    if (!record) {
      record = this._load(sessionId)
      if (record) this.sessions.set(sessionId, record)
    }
    return record
  }

  /** 更新 session 状态 */
  updateSession(sessionId: string, patch: Partial<SessionRecord>): void {
    const record = this.sessions.get(sessionId)
    if (!record) return
    Object.assign(record, patch, { lastActiveAt: Date.now() })
    this._persist(record)
  }

  /** 更新执行快照 */
  updateExecutionSnapshot(sessionId: string, snapshot: Partial<SessionRecord['executionSnapshot']>): void {
    const record = this.sessions.get(sessionId)
    if (!record) return
    Object.assign(record.executionSnapshot, snapshot)
    record.lastActiveAt = Date.now()
    this._persist(record)
  }

  /** 标记完成 */
  markCompleted(sessionId: string): void {
    this.updateSession(sessionId, { status: 'completed' })
  }

  /** 标记崩溃 */
  markCrashed(sessionId: string): void {
    this.updateSession(sessionId, { status: 'crashed' })
  }

  /** 销毁 session */
  destroySession(sessionId: string): void {
    this.sessions.delete(sessionId)
    const filePath = path.join(SESSION_DIR, `${sessionId}.json`)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  }

  /** 获取所有活跃 session */
  getActiveSessions(): SessionRecord[] {
    const active: SessionRecord[] = []
    for (const record of this.sessions.values()) {
      if (record.status === 'active') active.push(record)
    }
    return active
  }

  /** 从文件系统加载所有 session（启动恢复） */
  restoreAll(): number {
    if (!fs.existsSync(SESSION_DIR)) return 0
    const files = fs.readdirSync(SESSION_DIR).filter(f => f.endsWith('.json') && !f.includes('memory') && !f.includes('identity'))
    for (const file of files) {
      const sessionId = file.replace('.json', '')
      const record = this._load(sessionId)
      if (record) this.sessions.set(sessionId, record)
    }
    return this.sessions.size
  }

  // ─── 私有 ───────────────────────────────────────────

  private _persist(record: SessionRecord): void {
    const filePath = path.join(SESSION_DIR, `${record.sessionId}.json`)
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf-8')
  }

  private _load(sessionId: string): SessionRecord | undefined {
    const filePath = path.join(SESSION_DIR, `${sessionId}.json`)
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      }
    } catch { /* corrupted file → 忽略 */ }
    return undefined
  }
}

// 全局单例
export const sessionManager = new SessionManager()

export default sessionManager
