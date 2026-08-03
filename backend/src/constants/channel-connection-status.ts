/**
 * SPRINT-MEDIA-REALITY-HARDENING-01 Task02 — ChannelConnectionStatus 状态机常量
 * SPRINT-MEDIA-LOGIN-REALITY-FIX-01 Task03 — 新增 IDENTITY_VERIFIED 中间态
 *   （掌柜冻结状态模型：登录成功 ≠ 连接成功；身份锚定才允许推进 CONNECTED）
 *
 * 唯一事实源：所有 EnterpriseChannelAccount.connectionStatus 写入/判断必须走此文件。
 * 禁止手写 'connected'/'pending' 字符串（大小写混乱是 Task01 造假温床）。
 *
 * 掌柜冻结状态机（SPRINT-MEDIA-LOGIN-REALITY-FIX-01）：
 *   PENDING → WAITING_LOGIN → VERIFYING → AUTHENTICATED → IDENTITY_VERIFIED → CONNECTED
 *                                      ↘ FAILED / EXPIRED / ERROR
 *
 * IDENTITY-V2-HARDENING-01（掌柜战略：账号是长期资产，需要生命周期管理）：
 *   新增 SECURITY_CHECK / NEEDS_REAUTH / BLOCKED —— 平台验证/风控场景细分：
 *   - SECURITY_CHECK：登录流程中被平台要求安全验证（新登录时身份验证/风控弹层）
 *   - NEEDS_REAUTH：登录态仍有效但平台要求重新验证（短信/刷脸/设备确认，如抖音「为保障账号安全」）
 *   - BLOCKED：账号冻结/平台处罚/风控限制，需人工处理
 *   EXPIRED 保留 = 正常过期（cookie 失效/session 超时，重新扫码即可）
 *
 * | 状态              | 意义                                                  |
 * |-------------------|-------------------------------------------------------|
 * | PENDING           | 初始（账号创建，未发起连接）                           |
 * | WAITING_LOGIN     | 浏览器已打开，等待用户扫码                             |
 * | VERIFYING         | 扫码完成，等待平台/探针确认身份                        |
 * | AUTHENTICATED     | 浏览器确认平台登录（探针通过，身份尚未锚定）           |
 * | IDENTITY_VERIFIED | 已提取账号名称/ID/头像（SSOT 落库），凭证待落库        |
 * | CONNECTED         | 身份+凭证+runtime 全部正常（唯一可信在线态）           |
 * | READY（派生）      | AI员工可使用 = reality.usable（CONNECTED+探针+binding）|
 * | EXPIRED           | 登录态正常过期，重新扫码即可                            |
 * | NEEDS_REAUTH      | 登录态有效但平台要求重新验证（短信/刷脸/设备确认）     |
 * | SECURITY_CHECK    | 登录流程中被平台安全验证拦截（身份验证/风控弹层）      |
 * | BLOCKED           | 账号冻结/处罚/风控限制，需人工处理                     |
 * | ERROR             | 连接流程失败                                           |
 */
export const ChannelConnectionStatus = {
  PENDING: 'PENDING',
  WAITING_LOGIN: 'WAITING_LOGIN',
  VERIFYING: 'VERIFYING',
  AUTHENTICATED: 'AUTHENTICATED',
  IDENTITY_VERIFIED: 'IDENTITY_VERIFIED',
  CONNECTED: 'CONNECTED',
  EXPIRED: 'EXPIRED',
  // IDENTITY-V2-HARDENING-01 — 账号生命周期细分（掌柜指令）
  NEEDS_REAUTH: 'NEEDS_REAUTH',
  SECURITY_CHECK: 'SECURITY_CHECK',
  BLOCKED: 'BLOCKED',
  ERROR: 'ERROR',
  // SPRINT-MEDIA-VIRTUAL-COMPUTER-REALITY-01 — 用户主动退出登录（账号实体保留历史，认证环境已销毁）
  LOGGED_OUT: 'LOGGED_OUT',
} as const

export type ChannelConnectionStatusValue =
  (typeof ChannelConnectionStatus)[keyof typeof ChannelConnectionStatus]

/** 前端展示标签（AgentChannelCard / 渠道中心共用） */
export const ChannelConnectionStatusLabel: Record<string, string> = {
  PENDING: '待连接',
  WAITING_LOGIN: '等待扫码',
  VERIFYING: '验证中',
  AUTHENTICATED: '已确认登录',
  IDENTITY_VERIFIED: '身份已确认',
  CONNECTED: '已连接',
  EXPIRED: '登录已过期',
  NEEDS_REAUTH: '需要重新验证',
  SECURITY_CHECK: '安全验证中',
  BLOCKED: '账号已冻结',
  ERROR: '连接异常',
  LOGGED_OUT: '已退出登录',
}

/** 是否处于「可信在线」语义（owner-view online 判定等） */
export function isChannelConnected(status: string | null | undefined): boolean {
  return status === ChannelConnectionStatus.CONNECTED
}

/**
 * SPRINT-MEDIA-VIRTUAL-COMPUTER-REALITY-01 Task01 — BrowserProfileLoginState
 * 虚拟电脑登录状态模型：电脑实例在线 ≠ 平台账号在线，两者必须拆开。
 * 状态由 ChannelAccount.connectionStatus + 探针实时信号映射（登录推进/退出时同步）。
 *
 * | 状态                  | 含义                                              |
 * |-----------------------|---------------------------------------------------|
 * | UNKNOWN               | 未初始化/异常态（无 workspace 或状态不可判）       |
 * | EMPTY                 | 浏览器可用但无任何平台登录态（含 EXPIRED 会话失效）|
 * | WAITING_LOGIN         | 浏览器已打开，等待用户扫码                        |
 * | SESSION_AUTHENTICATED | 浏览器已确认平台登录（探针通过，身份未锚定）      |
 * | IDENTITY_READY        | 身份已锚定（账号ID/名称已确认，凭证待落库）       |
 * | WORKSPACE_READY       | 身份+凭证+runtime 全部正常（AI员工可用）          |
 * | LOGGED_OUT            | 用户主动退出，认证环境已销毁                      |
 */
export const BrowserProfileLoginState = {
  UNKNOWN: 'UNKNOWN',
  EMPTY: 'EMPTY',
  WAITING_LOGIN: 'WAITING_LOGIN',
  SESSION_AUTHENTICATED: 'SESSION_AUTHENTICATED',
  IDENTITY_READY: 'IDENTITY_READY',
  WORKSPACE_READY: 'WORKSPACE_READY',
  LOGGED_OUT: 'LOGGED_OUT',
} as const

export type BrowserProfileLoginStateValue =
  (typeof BrowserProfileLoginState)[keyof typeof BrowserProfileLoginState]

/**
 * 纯函数：ChannelAccount.connectionStatus → BrowserProfileLoginState
 * 唯一事实源，禁止手写字符串。
 */
export function mapToLoginRealityState(status: string | null | undefined): BrowserProfileLoginStateValue {
  switch (status) {
    case ChannelConnectionStatus.WAITING_LOGIN:
    case ChannelConnectionStatus.VERIFYING:
      return BrowserProfileLoginState.WAITING_LOGIN
    case ChannelConnectionStatus.AUTHENTICATED:
      return BrowserProfileLoginState.SESSION_AUTHENTICATED
    case ChannelConnectionStatus.IDENTITY_VERIFIED:
      return BrowserProfileLoginState.IDENTITY_READY
    case ChannelConnectionStatus.CONNECTED:
      return BrowserProfileLoginState.WORKSPACE_READY
    case ChannelConnectionStatus.LOGGED_OUT:
      return BrowserProfileLoginState.LOGGED_OUT
    case ChannelConnectionStatus.EXPIRED:
    case ChannelConnectionStatus.NEEDS_REAUTH:
      // 会话失效：浏览器里没有有效登录态（身份快照保留在 ChannelAccount，不算浏览器登录态）
      return BrowserProfileLoginState.EMPTY
    case ChannelConnectionStatus.PENDING:
      return BrowserProfileLoginState.EMPTY
    default:
      // BLOCKED / SECURITY_CHECK / ERROR / 未知 → 异常态
      return BrowserProfileLoginState.UNKNOWN
  }
}

/**
 * 合法状态迁移表（校验用；null 表示终态）
 * 与 BrowserAuthSession 状态机（INIT→OPEN_BROWSER→WAIT_USER_LOGIN→PLATFORM_VERIFY→AUTH_SUCCESS）对齐：
 *   WAITING_LOGIN      ≈ OPEN_BROWSER / WAIT_USER_LOGIN
 *   VERIFYING          ≈ PLATFORM_VERIFY
 *   AUTHENTICATED      ≈ 探针确认平台登录（浏览器层）
 *   IDENTITY_VERIFIED  ≈ 身份提取成功（SSOT 锚定，凭证待落库）
 *   CONNECTED          ≈ AUTH_SUCCESS + 凭证落库
 */
export const ChannelConnectionStatusTransitions: Record<string, string[]> = {
  PENDING: [ChannelConnectionStatus.WAITING_LOGIN, ChannelConnectionStatus.ERROR],
  WAITING_LOGIN: [
    ChannelConnectionStatus.VERIFYING,
    ChannelConnectionStatus.EXPIRED,
    ChannelConnectionStatus.ERROR,
  ],
  VERIFYING: [
    ChannelConnectionStatus.AUTHENTICATED,
    ChannelConnectionStatus.EXPIRED,
    ChannelConnectionStatus.ERROR,
    ChannelConnectionStatus.SECURITY_CHECK,
  ],
  AUTHENTICATED: [ChannelConnectionStatus.IDENTITY_VERIFIED, ChannelConnectionStatus.EXPIRED, ChannelConnectionStatus.ERROR, ChannelConnectionStatus.SECURITY_CHECK],
  IDENTITY_VERIFIED: [ChannelConnectionStatus.CONNECTED, ChannelConnectionStatus.EXPIRED, ChannelConnectionStatus.ERROR, ChannelConnectionStatus.NEEDS_REAUTH],
  CONNECTED: [ChannelConnectionStatus.EXPIRED, ChannelConnectionStatus.ERROR, ChannelConnectionStatus.WAITING_LOGIN, ChannelConnectionStatus.NEEDS_REAUTH, ChannelConnectionStatus.BLOCKED],
  // IDENTITY-V2 — 新状态迁移：验证完成可回到正常流程；BLOCKED 仅人工解除
  SECURITY_CHECK: [ChannelConnectionStatus.VERIFYING, ChannelConnectionStatus.AUTHENTICATED, ChannelConnectionStatus.NEEDS_REAUTH, ChannelConnectionStatus.EXPIRED, ChannelConnectionStatus.ERROR],
  NEEDS_REAUTH: [ChannelConnectionStatus.WAITING_LOGIN, ChannelConnectionStatus.CONNECTED, ChannelConnectionStatus.EXPIRED, ChannelConnectionStatus.ERROR, ChannelConnectionStatus.BLOCKED],
  BLOCKED: [ChannelConnectionStatus.ERROR, ChannelConnectionStatus.PENDING, ChannelConnectionStatus.NEEDS_REAUTH],
  EXPIRED: [ChannelConnectionStatus.WAITING_LOGIN, ChannelConnectionStatus.ERROR],
  ERROR: [ChannelConnectionStatus.WAITING_LOGIN, ChannelConnectionStatus.PENDING],
}

/**
 * IDENTITY-V2 — 探针信号 → 降级状态映射（恢复服务/状态机共用的纯函数）
 * 优先规则：BLOCKED（封禁文案）> NEEDS_REAUTH（验证文案）> EXPIRED（正常过期）
 */
export function demoteStatusFromSignals(signals: {
  securityCheck?: boolean
  identity?: boolean
  loginPage?: boolean
} | undefined, lastError?: string | null): string {
  const err = (lastError || '').toLowerCase()
  const blockedWords = ['封禁', '冻结', '处罚', '违规', '限制登录', 'blocked']
  const reauthWords = ['身份验证', '安全验证', '风控', '重新验证', '短信验证', '设备确认', '人脸']
  if (blockedWords.some(w => err.includes(w))) return ChannelConnectionStatus.BLOCKED
  if (signals?.securityCheck) {
    // 安全验证页 + 无身份信号 → 登录流程中被拦截（SECURITY_CHECK）；有身份 → 存量要求重新验证
    return signals.identity ? ChannelConnectionStatus.NEEDS_REAUTH : ChannelConnectionStatus.SECURITY_CHECK
  }
  if (reauthWords.some(w => err.includes(w))) return ChannelConnectionStatus.NEEDS_REAUTH
  return ChannelConnectionStatus.EXPIRED
}
