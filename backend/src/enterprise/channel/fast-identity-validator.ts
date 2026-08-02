/**
 * FastIdentityValidator — IDENTITY-V2-HARDENING-01 Task03 快速身份验证器
 *
 * 掌柜战略（借鉴 SynapseAutomation 但改造，坚持昆仑镜 BrowserWorkspace 路线）：
 *   「企业几十个账号不会每次启动几十个 Chrome」——恢复时优先轻量验证，
 *   失败再启动完整浏览器探针。
 *
 * 轻量验证三要素（不起浏览器）：
 *   1. credentialOk — DB 加密凭证里关键登录 cookie（meta.identityRules.cookies）≥2 存在
 *   2. snapshotOk   — 身份快照存在（externalAccountId）+ 最近验证时间在 TTL 内
 *
 * 判定：
 *   fresh   = credentialOk && snapshotOk      → 信任快照，不启动浏览器（懒加载）
 *   stale   = credentialOk && !snapshotOk     → 凭证在但快照旧/缺失 → 需完整浏览器探针复核
 *   invalid = !credentialOk                   → 凭证缺失 → 降级（EXPIRED/NEEDS_REAUTH）
 *
 * 诚实原则：fast 验证 ≠ 实时探针；reality API 以 verifiedBy: 'fast' | 'probe' 标注来源，
 * 前端可显示「快照验证」。fast 通过只代表「凭证+身份快照可信」，不代表浏览器当前在线。
 */
import { CHANNEL_META } from './adapters/browser-channel.meta.js'

export type FastIdentityStatus = 'fresh' | 'stale' | 'invalid'

export interface FastIdentityVerdict {
  status: FastIdentityStatus
  /** 凭证信号：关键登录 cookie ≥2 存在（读 DB 加密凭证，不起浏览器） */
  credentialOk: boolean
  /** 快照信号：externalAccountId + lastVerifiedAt 在 TTL 内 */
  snapshotOk: boolean
  lastVerifiedAt: string | null
  reason: string
}

export interface FastIdentityAccount {
  id: string
  channelType: string
  externalAccountId: string | null
  metadata: any
}

export interface FastIdentityCredentialSource {
  getCredential(accountId: string): Promise<Record<string, string>>
}

export class FastIdentityValidator {
  /** 快照新鲜度 TTL（默认 12h；超过则需浏览器复核） */
  constructor(private readonly snapshotTtlMs = 12 * 3600 * 1000) {}

  async verify(
    account: FastIdentityAccount,
    credSource: FastIdentityCredentialSource,
  ): Promise<FastIdentityVerdict> {
    const platform = account.channelType
    const meta = CHANNEL_META[platform]
    const keyCookies = meta?.identityRules?.cookies || []
    const accMeta = (account.metadata as any) || {}
    const lastVerifiedAt: string | null = accMeta.lastVerifiedAt || null

    // 1. 凭证信号：解密凭证 → cookie 数组 → 关键 cookie ≥2
    let credentialOk = false
    try {
      const cred = await credSource.getCredential(account.id)
      const raw = cred.cookieData || ''
      if (raw) {
        const cookies = JSON.parse(raw)
        const names = new Set((cookies || []).map((c: any) => c.name))
        credentialOk = keyCookies.filter(k => names.has(k)).length >= 2
      }
    } catch (e: any) {
      // 无凭证/解密失败 → credentialOk=false（invalid）
    }

    // 2. 快照信号：externalAccountId + lastVerifiedAt 新鲜
    let snapshotOk = false
    if (account.externalAccountId && lastVerifiedAt) {
      const at = new Date(lastVerifiedAt).getTime()
      snapshotOk = !Number.isNaN(at) && Date.now() - at < this.snapshotTtlMs
    }

    // 3. 组合判定
    let status: FastIdentityStatus
    let reason: string
    if (!credentialOk) {
      status = 'invalid'
      reason = '凭证缺失或关键 cookie 不足（可能从未登录成功/凭证被清）'
    } else if (!snapshotOk) {
      status = 'stale'
      reason = lastVerifiedAt
        ? `凭证在但快照超 TTL（lastVerifiedAt=${lastVerifiedAt}）→ 需浏览器复核`
        : '凭证在但无身份快照（externalAccountId/lastVerifiedAt 缺失）→ 需浏览器复核'
    } else {
      status = 'fresh'
      reason = `快照验证通过（${platform} 关键 cookie ${keyCookies.length} 项中 ≥2 存在，lastVerifiedAt=${lastVerifiedAt}）`
    }

    return { status, credentialOk, snapshotOk, lastVerifiedAt, reason }
  }
}

export const fastIdentityValidator = new FastIdentityValidator()
