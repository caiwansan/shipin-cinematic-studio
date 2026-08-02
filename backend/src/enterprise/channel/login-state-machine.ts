/**
 * LoginStateMachine — 统一渠道登录状态机（所有平台共用，禁止平台自定义状态）
 * SPRINT-MEDIA-CHANNEL-ADAPTER-EXPANSION-01 Task05
 *
 * 标准状态流（掌柜定义）：
 *   INIT → OPEN_BROWSER → WAIT_LOGIN → USER_ACTION_REQUIRED → VERIFYING
 *        → AUTHENTICATED → CONNECTED → READY
 *
 * 设计：
 * - 所有平台共用同一枚举，平台 adapter 不得自造状态
 * - 状态转换受 TRANSITIONS 约束（非法迁移拒绝并告警，暴露调试问题）
 * - 会话级：每个 browser session 一个状态实例（adapter 持有 Map）
 * - 兼容层：toLegacy() 映射回旧 loginStage（waiting_scan 等），前端迁移期双态可用
 */
export const LOGIN_STATES = [
  'INIT',
  'OPEN_BROWSER',
  'WAIT_LOGIN',
  'USER_ACTION_REQUIRED',
  'VERIFYING',
  'AUTHENTICATED',
  'CONNECTED',
  'READY',
] as const

export type LoginState = (typeof LOGIN_STATES)[number]

/** 合法状态转换表（白名单；未列出的迁移一律拒绝） */
const TRANSITIONS: Record<LoginState, LoginState[]> = {
  INIT: ['OPEN_BROWSER', 'WAIT_LOGIN'],
  OPEN_BROWSER: ['WAIT_LOGIN', 'USER_ACTION_REQUIRED', 'VERIFYING', 'AUTHENTICATED'],
  WAIT_LOGIN: ['USER_ACTION_REQUIRED', 'VERIFYING', 'AUTHENTICATED', 'WAIT_LOGIN'],
  USER_ACTION_REQUIRED: ['WAIT_LOGIN', 'VERIFYING', 'AUTHENTICATED'],
  VERIFYING: ['AUTHENTICATED', 'USER_ACTION_REQUIRED', 'WAIT_LOGIN'],
  AUTHENTICATED: ['CONNECTED', 'READY', 'AUTHENTICATED'],
  CONNECTED: ['READY', 'AUTHENTICATED', 'WAIT_LOGIN'],
  READY: ['AUTHENTICATED', 'WAIT_LOGIN'],
}

/** 旧 loginStage → 标准状态（兼容映射，探针推导用） */
export const LEGACY_TO_STATE: Record<string, LoginState> = {
  waiting_scan: 'WAIT_LOGIN',
  scan_confirming: 'VERIFYING',
  verifying: 'VERIFYING',
  awaiting_confirmation: 'AUTHENTICATED',
  connected: 'CONNECTED',
  ready: 'READY',
}

/** 标准状态 → 旧 loginStage（前端迁移期兼容输出） */
export const STATE_TO_LEGACY: Record<LoginState, string> = {
  INIT: 'waiting_scan',
  OPEN_BROWSER: 'waiting_scan',
  WAIT_LOGIN: 'waiting_scan',
  USER_ACTION_REQUIRED: 'verifying',
  VERIFYING: 'verifying',
  AUTHENTICATED: 'awaiting_confirmation',
  CONNECTED: 'connected',
  READY: 'ready',
}

export class LoginStateMachine {
  private state: LoginState = 'INIT'
  private readonly history: { from: LoginState; to: LoginState; at: number }[] = []

  get current(): LoginState {
    return this.state
  }

  /** 迁移到目标状态；非法迁移拒绝并告警（不 throw，保持轮询健壮） */
  transition(to: LoginState, context: string): boolean {
    if (to === this.state) return true
    const allowed = TRANSITIONS[this.state]
    if (!allowed.includes(to)) {
      console.warn(`[LoginStateMachine] 非法状态迁移 ${this.state} → ${to}（${context}），已拒绝`)
      return false
    }
    this.history.push({ from: this.state, to, at: Date.now() })
    this.state = to
    if (this.history.length > 50) this.history.shift()
    return true
  }

  /** 强制设置（探针回退场景：浏览器重开/会话重建时允许重置） */
  force(to: LoginState): void {
    this.history.push({ from: this.state, to, at: Date.now() })
    this.state = to
  }

  /** 按探针推导结果驱动状态迁移（getLoginStatus 轮询调用） */
  derive(probe: { authenticated: boolean; hasIdentity: boolean; verifying?: boolean; userActionRequired?: boolean }): LoginState {
    if (probe.authenticated) {
      // 已认证 → 目标 AUTHENTICATED（经 VERIFYING 或直接，依当前状态）
      if (this.state === 'VERIFYING' || this.state === 'USER_ACTION_REQUIRED') {
        this.transition('AUTHENTICATED', 'probe authenticated')
      } else if (this.state !== 'AUTHENTICATED' && this.state !== 'CONNECTED' && this.state !== 'READY') {
        // INIT/OPEN_BROWSER/WAIT_LOGIN 直接认证（如复用持久化登录态）→ 允许
        this.transition('AUTHENTICATED', 'probe authenticated (fast path)')
      }
      return this.state
    }
    if (probe.userActionRequired) {
      this.transition('USER_ACTION_REQUIRED', 'probe user action required')
      return this.state
    }
    if (probe.verifying) {
      this.transition('VERIFYING', 'probe verifying')
      return this.state
    }
    // 未登录且无中间态 → WAIT_LOGIN
    if (this.state === 'AUTHENTICATED' || this.state === 'CONNECTED' || this.state === 'READY') {
      this.transition('WAIT_LOGIN', 'session expired (probe unauthenticated)')
    } else {
      this.transition('WAIT_LOGIN', 'probe waiting login')
    }
    return this.state
  }

  /** 兼容层：标准状态 → 旧 loginStage */
  toLegacy(): string {
    return STATE_TO_LEGACY[this.state]
  }

  /** 调试：最近状态轨迹 */
  trail(): { from: LoginState; to: LoginState; at: number }[] {
    return [...this.history]
  }
}
