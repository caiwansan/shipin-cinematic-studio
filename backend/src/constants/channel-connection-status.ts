/**
 * SPRINT-MEDIA-REALITY-HARDENING-01 Task02 — ChannelConnectionStatus 状态机常量
 *
 * 唯一事实源：所有 EnterpriseChannelAccount.connectionStatus 写入/判断必须走此文件。
 * 禁止手写 'connected'/'pending' 字符串（大小写混乱是 Task01 造假温床）。
 *
 * 状态机（禁止 PENDING 直跳 connected）：
 *   PENDING → WAITING_LOGIN → VERIFYING → AUTHENTICATED → CONNECTED
 *                                      ↘ FAILED / EXPIRED / ERROR
 *
 * | 状态          | 意义                                        |
 * |---------------|---------------------------------------------|
 * | PENDING       | 初始（账号创建，未发起连接）                 |
 * | WAITING_LOGIN | 浏览器已打开，等待用户扫码                   |
 * | VERIFYING     | 扫码完成，等待平台/探针确认身份              |
 * | AUTHENTICATED | 平台确认真人身份（探针复核通过），凭证待落库 |
 * | CONNECTED     | 身份+凭证+runtime 全部正常（唯一可信在线态） |
 * | EXPIRED       | 登录态过期/失效，需要重新授权                |
 * | ERROR         | 连接流程失败                                 |
 */
export const ChannelConnectionStatus = {
  PENDING: 'PENDING',
  WAITING_LOGIN: 'WAITING_LOGIN',
  VERIFYING: 'VERIFYING',
  AUTHENTICATED: 'AUTHENTICATED',
  CONNECTED: 'CONNECTED',
  EXPIRED: 'EXPIRED',
  ERROR: 'ERROR',
} as const

export type ChannelConnectionStatusValue =
  (typeof ChannelConnectionStatus)[keyof typeof ChannelConnectionStatus]

/** 前端展示标签（AgentChannelCard / 渠道中心共用） */
export const ChannelConnectionStatusLabel: Record<string, string> = {
  PENDING: '待连接',
  WAITING_LOGIN: '等待扫码',
  VERIFYING: '验证中',
  AUTHENTICATED: '已确认身份',
  CONNECTED: '已连接',
  EXPIRED: '登录已过期',
  ERROR: '连接异常',
}

/** 是否处于「可信在线」语义（owner-view online 判定等） */
export function isChannelConnected(status: string | null | undefined): boolean {
  return status === ChannelConnectionStatus.CONNECTED
}

/**
 * 合法状态迁移表（校验用；null 表示终态）
 * 与 BrowserAuthSession 状态机（INIT→OPEN_BROWSER→WAIT_USER_LOGIN→PLATFORM_VERIFY→AUTH_SUCCESS）对齐：
 *   WAITING_LOGIN   ≈ OPEN_BROWSER / WAIT_USER_LOGIN
 *   VERIFYING       ≈ PLATFORM_VERIFY
 *   AUTHENTICATED   ≈ 探针复核通过（平台确认真人）
 *   CONNECTED       ≈ AUTH_SUCCESS + 凭证落库
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
  ],
  AUTHENTICATED: [ChannelConnectionStatus.CONNECTED, ChannelConnectionStatus.EXPIRED, ChannelConnectionStatus.ERROR],
  CONNECTED: [ChannelConnectionStatus.EXPIRED, ChannelConnectionStatus.ERROR, ChannelConnectionStatus.WAITING_LOGIN],
  EXPIRED: [ChannelConnectionStatus.WAITING_LOGIN, ChannelConnectionStatus.ERROR],
  ERROR: [ChannelConnectionStatus.WAITING_LOGIN, ChannelConnectionStatus.PENDING],
}
