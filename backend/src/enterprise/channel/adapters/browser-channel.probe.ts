/**
 * BrowserChannelProbe — 通用浏览器渠道身份探针（多平台）
 * 2026-08-02 — 抖音打通后按同范式铺开：快手/小红书/视频号/公众号等
 *
 * 平台差异全部来自 BrowserChannelMeta（browser-channel.meta.ts）：
 * - 工作台 URL 片段 + 页面 markers → 页面特征信号
 * - 平台关键 cookie 名 → cookie 信号
 * - 账号名/ID 提取正则 → DOM 文本兜底身份
 *
 * 综合判定与抖音探针一致：页面特征或身份提取任一命中即认证；
 * 仅 cookie 残留不算登录成功（session 失效时 cookie 仍在，页面已回登录页）。
 */
import type { ChannelIdentity, ChannelIdentityProbe } from '../identity-probe.js'
import { identityProbeRegistry } from '../identity-probe.js'
import { browserRuntime } from '../../../services/media/browser-runtime.service.js'
import { CHANNEL_META, type BrowserChannelMeta } from './browser-channel.meta.js'

export class BrowserChannelProbe implements ChannelIdentityProbe {
  readonly platform: string
  private readonly meta: BrowserChannelMeta
  /** 平台关键 cookie（登录态核心；各平台不同，配置在 meta 派生） */
  private readonly keyCookies: string[]

  constructor(platform: string, keyCookies: string[] = []) {
    this.platform = platform
    const meta = CHANNEL_META[platform]
    if (!meta) throw new Error(`BrowserChannelProbe: 未知平台 ${platform}（browser-channel.meta.ts 未配置）`)
    this.meta = meta
    this.keyCookies = keyCookies.length > 0 ? keyCookies : this.defaultKeyCookies(platform)
  }

  private defaultKeyCookies(platform: string): string[] {
    switch (platform) {
      case 'kuaishou':
        return ['kuaishou.api_st', 'kuaishou.server_st', 'userId']
      case 'xiaohongshu':
        return ['web_session', 'customerClientId']
      case 'channels_wechat':
        return ['wxuin', 'wxsid', 'rand_info']
      case 'wechat_mp':
        return ['slave_sid', 'slave_user', 'data_ticket']
      case 'weibo':
        return ['SUB', 'SUBP', 'WBPSESS']
      case 'toutiao':
        return ['sessionid', 'sid_guard', 'uid_tt']
      case 'baijiahao':
        return ['BDUSS', 'BDUSS_BFESS', 'STOKEN']
      default:
        return []
    }
  }

  async probe(sessionId: string): Promise<ChannelIdentity> {
    const signals = { page: false, cookie: false, identity: false }
    let accountName: string | undefined
    let accountId: string | undefined
    let avatar: string | undefined

    // A 页面特征：工作台 URL 片段 或 页面 markers ≥2（且非登录页）
    try {
      signals.page = await browserRuntime.withPage(sessionId, async (page) => {
        await page.waitForTimeout(1500 + Math.random() * 800)
        if (page.isClosed()) return false
        const url = page.url()
        // ⚠️ 登录页 URL 排除（2026-08-02 多平台误判修复）：
        //    快手未登录跳 /profile、小红书 /login 也在 creator 域下，
        //    工作台 URL 片段命中前必须先排除登录路径
        if (/\/login|\/signin|\/passport|\/auth|\/sso|login\.html|login\.php/i.test(url)) return false
        // 命中工作台 URL 片段 → 直接算页面特征命中
        if (this.meta.workspaceUrlFragments.some(f => url.includes(f))) return true
        if (/passport|login|qr|sso|signin/i.test(url)) return false
        const bodyText = await page.locator('body').innerText().catch(() => '')
        if (this.meta.loginPageMarkers.some(m => bodyText.includes(m))) return false
        const hit = this.meta.pageMarkers.filter(m => bodyText.includes(m)).length
        return hit >= 2
      })
    } catch (e: any) {
      console.warn(`[BrowserChannelProbe:${this.platform}] 页面特征探测异常: ${e.message}`)
    }

    // B Cookie 信号（平台关键 cookie ≥2）
    try {
      const cookies = await browserRuntime.getCookies(sessionId)
      const names = new Set((cookies || []).map(c => c.name))
      signals.cookie = this.keyCookies.filter(k => names.has(k)).length >= 2
    } catch (e: any) {
      console.warn(`[BrowserChannelProbe:${this.platform}] Cookie 探测异常: ${e.message}`)
    }

    // C 身份提取：hydration 数据通用遍历（user_name/name/nickname + id 字段）
    try {
      await browserRuntime.withPage(sessionId, async (page) => {
        const identity = await page.evaluate(() => {
          const candidates: any[] = []
          const rd = (window as any)._ROUTER_DATA
          if (rd) candidates.push(rd)
          const nd = (window as any).__NEXT_DATA__
          if (nd) candidates.push(nd)
          const walk = (o: any, depth: number): any => {
            if (!o || depth > 8 || typeof o !== 'object') return null
            // 通用身份节点：有昵称类字段 + 有 id 类字段
            const nameVal = o.user_name || o.nickname || o.name
            const idVal = o.sec_uid || o.user_id || o.uid || o.id
            if (typeof nameVal === 'string' && nameVal.length > 0 && typeof idVal === 'string' && idVal.length > 0) {
              return {
                accountName: nameVal,
                accountId: idVal,
                avatar: o.avatar_thumb?.url_list?.[0] || o.avatar_larger?.url_list?.[0] || o.avatar_url || o.avatar || undefined,
              }
            }
            for (const k of Object.keys(o)) {
              const r = walk(o[k], depth + 1)
              if (r) return r
            }
            return null
          }
          for (const c of candidates) {
            const r = walk(c, 0)
            if (r) return r
          }
          return null
        }).catch(() => null)
        if (identity) {
          accountName = identity.accountName
          accountId = identity.accountId
          avatar = identity.avatar
          signals.identity = true
        }
      })
    } catch (e: any) {
      console.warn(`[BrowserChannelProbe:${this.platform}] 身份提取异常: ${e.message}`)
    }

    // C2 DOM 文本兜底：按平台正则从 body 文本提取账号名/ID
    if (!accountId || !accountName) {
      try {
        const domIdentity = await browserRuntime.withPage(sessionId, async (page) => {
          if (page.isClosed()) return null
          const text = await page.locator('body').innerText().catch(() => '')
          let name: string | undefined
          let id: string | undefined
          for (const re of this.meta.accountNamePatterns) {
            const m = text.match(re)
            if (m && m[1]) { name = m[1]; break }
          }
          for (const re of this.meta.accountIdPatterns) {
            const m = text.match(re)
            if (m && m[1]) { id = m[1]; break }
          }
          if (!name && !id) return null
          return { name, id }
        }).catch(() => null)
        if (domIdentity) {
          if (!accountName && domIdentity.name) accountName = domIdentity.name
          if (!accountId && domIdentity.id) {
            accountId = domIdentity.id
            signals.identity = true
          }
        }
      } catch (e: any) {
        console.warn(`[BrowserChannelProbe:${this.platform}] DOM 身份提取异常: ${e.message}`)
      }
    }

    // 综合判定：页面特征或身份提取任一命中即认证（真实登录态；cookie 残留不算）
    const authenticated = signals.page || signals.identity

    return {
      authenticated,
      accountId,
      accountName,
      avatar,
      permissions: authenticated ? ['read:metrics', 'read:comments', 'analyze'] : [],
      checkedAt: new Date().toISOString(),
      signals,
    }
  }
}
