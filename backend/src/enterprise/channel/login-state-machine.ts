/**
 * LoginStateMachine — 统一渠道登录状态机（所有平台共用，禁止平台自定义状态）
 * SPRINT-MEDIA-CHANNEL-ADAPTER-EXPANSION-01 Task05
 *
 * 标准状态流（掌柜定义）：
 *   INIT → OPEN_BROWSER → WAIT_LOGIN → USER_ACTION_REQUIRED → VERIFYING
 *        → AUTHENTICATED → CONNECTED → READY
 *
 * MEDIA-LOGIN-CAPABILITY-V3 Task01 — 三层认证链（Session/Identity/Workspace）：
 *   WAIT_LOGIN → SCAN_CONFIRMED → SESSION_AUTHENTICATED → IDENTITY_RESOLVED
 *              → WORKSPACE_READY → CONNECTED
 *   LOGIN_PARTIAL = 已登录（session）但身份/工作台未确认（诚实中间态，禁止伪装 CONNECTED）
 *   CONNECTED 硬条件（Task02 强制）：externalAccountId != null + identity 来源可信 + workspaceReady
 */
export const LOGIN_STATES = [
  'INIT',
  'OPEN_BROWSER',
  'WAIT_LOGIN',
  'USER_ACTION_REQUIRED',
  'SCAN_CONFIRMED',
  'VERIFYING',
  'SESSION_AUTHENTICATED',
  'IDENTITY_RESOLVED',
  'WORKSPACE_READY',
  'LOGIN_PARTIAL',
  'AUTHENTICATED',
  'CONNECTED',
  'READY',
] as const

export type LoginState = (typeof LOGIN_STATES)[number]

/** 合法状态转换表（白名单；未列出的迁移一律拒绝）
 * MEDIA-LOGIN-CAPABILITY-V3 Task02 — 补全三信号推进边：
 * - 登录中状态（INIT/OPEN_BROWSER/WAIT_LOGIN/USER_ACTION_REQUIRED/SCAN_CONFIRMED/VERIFYING）
 *   → 允许直接 IDENTITY_RESOLVED/WORKSPACE_READY（持久化登录态 fast path：session+identity+workspace 全绿）
 * - AUTHENTICATED → WAIT_LOGIN（session 过期降级；修复旧卡死——AUTHENTICATED 永不降级导致 refreshCredential 拒绝后永久卡认证态）
 */
const TRANSITIONS: Record<LoginState, LoginState[]> = {
  INIT: ['OPEN_BROWSER', 'WAIT_LOGIN', 'IDENTITY_RESOLVED', 'WORKSPACE_READY', 'LOGIN_PARTIAL'],
  OPEN_BROWSER: ['WAIT_LOGIN', 'USER_ACTION_REQUIRED', 'VERIFYING', 'SCAN_CONFIRMED', 'AUTHENTICATED', 'SESSION_AUTHENTICATED', 'IDENTITY_RESOLVED', 'WORKSPACE_READY', 'LOGIN_PARTIAL'],
  WAIT_LOGIN: ['USER_ACTION_REQUIRED', 'SCAN_CONFIRMED', 'VERIFYING', 'AUTHENTICATED', 'SESSION_AUTHENTICATED', 'IDENTITY_RESOLVED', 'WORKSPACE_READY', 'LOGIN_PARTIAL', 'WAIT_LOGIN'],
  USER_ACTION_REQUIRED: ['WAIT_LOGIN', 'VERIFYING', 'SCAN_CONFIRMED', 'AUTHENTICATED', 'SESSION_AUTHENTICATED', 'IDENTITY_RESOLVED', 'WORKSPACE_READY', 'LOGIN_PARTIAL'],
  SCAN_CONFIRMED: ['SESSION_AUTHENTICATED', 'VERIFYING', 'AUTHENTICATED', 'IDENTITY_RESOLVED', 'WORKSPACE_READY', 'LOGIN_PARTIAL', 'WAIT_LOGIN'],
  VERIFYING: ['SESSION_AUTHENTICATED', 'AUTHENTICATED', 'IDENTITY_RESOLVED', 'WORKSPACE_READY', 'LOGIN_PARTIAL', 'USER_ACTION_REQUIRED', 'WAIT_LOGIN', 'SCAN_CONFIRMED'],
  SESSION_AUTHENTICATED: ['IDENTITY_RESOLVED', 'WORKSPACE_READY', 'LOGIN_PARTIAL', 'AUTHENTICATED', 'CONNECTED', 'WAIT_LOGIN'],
  IDENTITY_RESOLVED: ['WORKSPACE_READY', 'LOGIN_PARTIAL', 'AUTHENTICATED', 'CONNECTED', 'WAIT_LOGIN'],
  WORKSPACE_READY: ['CONNECTED', 'LOGIN_PARTIAL', 'AUTHENTICATED', 'WAIT_LOGIN'],
  LOGIN_PARTIAL: ['SESSION_AUTHENTICATED', 'IDENTITY_RESOLVED', 'WORKSPACE_READY', 'AUTHENTICATED', 'CONNECTED', 'WAIT_LOGIN'],
  AUTHENTICATED: ['CONNECTED', 'READY', 'AUTHENTICATED', 'IDENTITY_RESOLVED', 'WORKSPACE_READY', 'LOGIN_PARTIAL', 'WAIT_LOGIN'],
  CONNECTED: ['READY', 'AUTHENTICATED', 'WORKSPACE_READY', 'LOGIN_PARTIAL', 'WAIT_LOGIN'],
  READY: ['AUTHENTICATED', 'WAIT_LOGIN'],
}

/** 旧 loginStage → 标准状态（兼容映射，探针推导用） */
export const LEGACY_TO_STATE: Record<string, LoginState> = {
  waiting_scan: 'WAIT_LOGIN',
  scan_confirming: 'SCAN_CONFIRMED',
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
  SCAN_CONFIRMED: 'scan_confirming',
  VERIFYING: 'verifying',
  SESSION_AUTHENTICATED: 'awaiting_confirmation',
  IDENTITY_RESOLVED: 'awaiting_confirmation',
  WORKSPACE_READY: 'awaiting_confirmation',
  LOGIN_PARTIAL: 'awaiting_confirmation',
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

  /**
   * 按探针推导结果驱动状态迁移（getLoginStatus 轮询调用）
   * MEDIA-LOGIN-CAPABILITY-V3 Task01 — 三信号驱动：
   *   sessionAuthenticated / identityResolved / workspaceReady
   *   （authenticated/hasIdentity 兼容旧调用方；V3 信号存在时优先）
   *   LOGIN_PARTIAL：session 有但身份/工作台不完整 → 诚实中间态（禁止伪装 CONNECTED）
   *   CONNECTED/READY 保护：身份快照原则——已连接账号单次探针不完整不降级（保留历史身份），
   *   session 丢失（cookie 失效）才降级 WAIT_LOGIN。
   */
  derive(probe: {
    authenticated?: boolean
    hasIdentity?: boolean
    sessionAuthenticated?: boolean
    identityResolved?: boolean
    workspaceReady?: boolean
    verifying?: boolean
    userActionRequired?: boolean
  }): LoginState {
    const { sessionAuthenticated, identityResolved, workspaceReady, authenticated, verifying, userActionRequired } = probe
    const v3 = sessionAuthenticated !== undefined

    // ═══ V3 三信号驱动（MEDIA-LOGIN-CAPABILITY-V3 Task01）═══
    if (v3) {
      // 0) 短信验证码等人工操作页（优先级最高，覆盖一切推进）
      if (userActionRequired) {
        this.transition('USER_ACTION_REQUIRED', 'probe user action required')
        return this.state
      }
      // 1) 完整认证：session + identity + workspace 全绿
      if (sessionAuthenticated && identityResolved && workspaceReady) {
        if (this.state === 'CONNECTED' || this.state === 'READY') return this.state
        // 推进链：SESSION_AUTHENTICATED → IDENTITY_RESOLVED → WORKSPACE_READY
        if (this.state !== 'WORKSPACE_READY') {
          if (this.state !== 'IDENTITY_RESOLVED') this.transition('IDENTITY_RESOLVED', 'probe full auth (identity)')
          this.transition('WORKSPACE_READY', 'probe full auth (workspace)')
        }
        return this.state
      }
      // 2) session 有，但身份/工作台不完整
      if (sessionAuthenticated) {
        // 身份快照原则：已连接账号单次探针不完整 → 保持（不降级，保留历史身份；下次探针重试）
        if (this.state === 'CONNECTED' || this.state === 'READY') return this.state
        if (identityResolved) {
          // 身份已解析，工作台未确认 → IDENTITY_RESOLVED
          if (this.state !== 'IDENTITY_RESOLVED') this.transition('IDENTITY_RESOLVED', 'identity resolved, workspace pending')
          return this.state
        }
        // 身份未解析 → 区分扫码推进与持久态：
        //   verifying=true（扫码确认窗口期）→ SESSION_AUTHENTICATED 推进链（等身份提取）
        //   非 verifying（持久登录态/已过推进期，session 在但身份确认不了）→ LOGIN_PARTIAL（诚实中间态）
        //   快手实锤：/profile + passport 会话 → LOGIN_PARTIAL（绝不假 connected/EXPIRED）
        if (verifying || this.state === 'SCAN_CONFIRMED') {
          this.transition('SESSION_AUTHENTICATED', 'session authenticated, identity pending (scan flow)')
        } else if (this.state !== 'LOGIN_PARTIAL' && this.state !== 'SESSION_AUTHENTICATED' && this.state !== 'AUTHENTICATED') {
          this.transition('LOGIN_PARTIAL', 'session ok but identity missing (persistent session)')
        }
        return this.state
      }
      // 3) 扫码确认中间态（手机已确认，session 尚未落定）
      if (verifying) {
        if (this.state === 'WAIT_LOGIN' || this.state === 'INIT' || this.state === 'OPEN_BROWSER') {
          this.transition('SCAN_CONFIRMED', 'scan confirmed (verifying)')
        } else if (this.state !== 'SCAN_CONFIRMED' && this.state !== 'VERIFYING') {
          this.transition('VERIFYING', 'probe verifying')
        }
        return this.state
      }
      // 4) session 丢失 → 降级
      if (this.state === 'AUTHENTICATED' || this.state === 'CONNECTED' || this.state === 'READY') {
        this.transition('WAIT_LOGIN', 'session expired (v3 probe unauthenticated)')
      } else {
        this.transition('WAIT_LOGIN', 'probe waiting login')
      }
      return this.state
    }

    // ═══ 旧路径（兼容旧调用方，行为不变）═══
    if (authenticated) {
      // 已认证 → 目标 AUTHENTICATED（经 VERIFYING 或直接，依当前状态）
      if (this.state === 'VERIFYING' || this.state === 'USER_ACTION_REQUIRED' || this.state === 'SCAN_CONFIRMED') {
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
