/**
 * session/runtime-persistence.ts — 运行时持久化层
 *
 * 职责：将 PlaybackController + MemoryKernel + IdentityKernel 的
 *   状态持久化到 JSON 文件，支持进程重启后恢复。
 *
 * 宪法：
 *   - 不修改 IR/Timeline/ExecutionPlan
 *   - 确定性重建
 *   - 可回放
 */

import fs from 'node:fs'
import path from 'node:path'
import { sessionManager, type SessionRecord } from './session-manager.js'
import type { PlaybackControllerState } from '../runtime/playback-controller.js'

const STORE_DIR = path.resolve(process.cwd(), 'session-store')

// ─── RuntimePersistence ──────────────────────────────

export class RuntimePersistence {
  constructor() {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true })
    }
  }

  /** 保存运行时快照 */
  saveRuntimeSnapshot(sessionId: string, state: PlaybackControllerState, bundleJson: string): void {
    const data = {
      savedAt: Date.now(),
      tick: state.runtimeState.playbackTime,
      runtimeState: state.runtimeState,
      bundle: bundleJson,
      isPlaying: state.isPlaying,
    }
    fs.writeFileSync(path.join(STORE_DIR, `runtime-${sessionId}.json`), JSON.stringify(data, null, 2), 'utf-8')

    // 同时更新 session manager 的执行快照
    sessionManager.updateExecutionSnapshot(sessionId, {
      currentSceneId: state.runtimeState.currentSceneId,
      currentShotIndex: state.runtimeState.currentShotIndex,
      completedScenes: state.runtimeState.completedScenes,
      totalScenes: state.runtimeState.totalScenes,
      intensity: state.runtimeState.intensity,
      playbackTime: state.runtimeState.playbackTime,
      isPlaying: state.isPlaying,
    })
  }

  /** 加载运行时快照 */
  loadRuntimeSnapshot(sessionId: string): { state: PlaybackControllerState; bundle: any } | null {
    const filePath = path.join(STORE_DIR, `runtime-${sessionId}.json`)
    try {
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        return {
          state: {
            runtimeState: data.runtimeState,
            sceneContexts: {},
            frame: null,
            isPlaying: data.isPlaying,
          },
          bundle: data.bundle ? JSON.parse(data.bundle) : null,
        }
      }
    } catch { /* corrupted */ }
    return null
  }

  /** 保存记忆快照 */
  saveMemorySnapshot(sessionId: string, memoryData: any): void {
    fs.writeFileSync(
      path.join(STORE_DIR, `memory-${sessionId}.json`),
      JSON.stringify({ savedAt: Date.now(), data: memoryData }, null, 2),
      'utf-8',
    )
  }

  /** 加载记忆快照 */
  loadMemorySnapshot(sessionId: string): any | null {
    const filePath = path.join(STORE_DIR, `memory-${sessionId}.json`)
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8')).data
      }
    } catch { /* corrupted */ }
    return null
  }

  /** 保存身份快照 */
  saveIdentitySnapshot(sessionId: string, identityData: any): void {
    fs.writeFileSync(
      path.join(STORE_DIR, `identity-${sessionId}.json`),
      JSON.stringify({ savedAt: Date.now(), data: identityData }, null, 2),
      'utf-8',
    )
  }

  /** 加载身份快照 */
  loadIdentitySnapshot(sessionId: string): any | null {
    const filePath = path.join(STORE_DIR, `identity-${sessionId}.json`)
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8')).data
      }
    } catch { /* corrupted */ }
    return null
  }

  /** 销毁所有 session 相关文件 */
  destroySession(sessionId: string): void {
    for (const prefix of ['', 'runtime-', 'memory-', 'identity-']) {
      const filePath = path.join(STORE_DIR, `${prefix}${sessionId}.json`)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    }
  }
}

export const runtimePersistence = new RuntimePersistence()
export default runtimePersistence
