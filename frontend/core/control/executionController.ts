// P3.2 — Execution Controller (Sprint 1)
// ============================================================
// UML:
//   ExecutionStudioPage → ExecutionController → ExecutionStateManager
//                              │
//                              └→ emit('control:event') → UI binding
//
// 核心职责:
//   - dispatch pause/resume/step/abort
//   - sync ExecutionStateManager
//   - emit runtime events
//
// 约束:
//   ❌ 不存储 state machine 状态（交由 ExecutionStateManager）
//   ❌ 不发 API 请求
//   ✅ 只做控制信号转发
// ============================================================

import { ExecutionStateManager } from '~/utils/executionStateManager'
import type { CapabilityId } from '~/utils/geoCapability'
import type { ExecutionMode, ExecutionPolicy } from './executionPolicy'

// ─── 事件类型 ───

export type ExecutionControlEvent =
  | { type: 'pause'; payload: { reason?: string } }
  | { type: 'resume' }
  | { type: 'stepForward' }
  | { type: 'stepBack' }
  | { type: 'abort' }
  | { type: 'modeChange'; payload: { mode: ExecutionMode } }

export type ExecutionControlListener = (event: ExecutionControlEvent) => void

// ─── Controller ───

export class ExecutionController {
  private stateMgr: ExecutionStateManager
  private listeners: Set<ExecutionControlListener> = new Set()
  private _paused = false
  private _currentStepIndex = 0
  private _mode: ExecutionMode = 'auto'
  private _policy: ExecutionPolicy
  private _projectId: string | null = null
  private _stepHistory: Array<{
    stepIndex: number
    capabilityId: CapabilityId
    action: 'start' | 'complete' | 'skip'
    timestamp: number
  }> = []
  private abortController: AbortController | null = null

  constructor(policy: ExecutionPolicy) {
    this._policy = policy
    this._mode = policy.mode
    this.stateMgr = ExecutionStateManager.getInstance()
  }

  // ─── 侦听控制事件 ───
  onEvent(listener: ExecutionControlListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: ExecutionControlEvent): void {
    this.listeners.forEach(fn => fn(event))
  }

  // ─── 绑定项目 ───
  bindProject(projectId: string): void {
    this._projectId = projectId
    this._currentStepIndex = 0
    this._paused = false
    this._stepHistory = []
  }

  unbindProject(): void {
    this._projectId = null
    this._paused = false
    this._currentStepIndex = 0
    this._stepHistory = []
    this.abortController = null
  }

  // ─── 访问器 ───
  get paused(): boolean { return this._paused }
  get currentStepIndex(): number { return this._currentStepIndex }
  get mode(): ExecutionMode { return this._mode }
  get policy(): ExecutionPolicy { return this._policy }
  get stepHistory() { return [...this._stepHistory] }
  get projectId(): string | null { return this._projectId }

  // ─── 模式切换 ───
  setMode(mode: ExecutionMode): void {
    this._mode = mode
    this.emit({ type: 'modeChange', payload: { mode } })
  }

  // ─── 控制信号 ───

  /** 暂停执行 */
  pause(reason?: string): void {
    if (!this._policy.allowPause) return
    this._paused = true
    this.emit({ type: 'pause', payload: { reason } })
  }

  /** 恢复执行 */
  resume(): void {
    if (!this._paused) return
    this._paused = false
    this.emit({ type: 'resume' })
  }

  /** 步进——执行下一个 step */
  stepForward(): void {
    if (!this._policy.allowStep) return
    this._currentStepIndex++
    this.emit({ type: 'stepForward' })
  }

  /** 步退——回退到前一个 step */
  stepBack(): void {
    if (!this._policy.allowStep || this._currentStepIndex <= 0) return
    this._currentStepIndex--
    this.emit({ type: 'stepBack' })
  }

  /** 中止当前执行 */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    this._paused = false
    this.emit({ type: 'abort' })
  }

  // ─── 执行痕迹记录 ───
  recordStep(stepIndex: number, capabilityId: CapabilityId, action: 'start' | 'complete' | 'skip'): void {
    this._stepHistory.push({ stepIndex, capabilityId, action, timestamp: Date.now() })
  }

  /** 获取前 N 条执行痕迹 */
  getRecentTraces(limit = 10): Array<{
    stepIndex: number
    capabilityId: CapabilityId
    action: string
    timestamp: number
  }> {
    return this._stepHistory.slice(-limit).reverse()
  }

  // ─── 检查是否应该继续执行下一步 ───
  shouldProceed(): boolean {
    if (this._paused) return false
    if (this._mode === 'step') {
      // step 模式：等外部调用 stepForward
      // 由外部控制是否推进，这里不阻塞
      return true
    }
    return true
  }

  // ─── 重置 ───
  reset(): void {
    this._paused = false
    this._currentStepIndex = 0
    this._stepHistory = []
    this.abortController = null
  }
}
