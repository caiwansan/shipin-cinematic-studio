/**
 * BrowserChannelProbe — 通用浏览器渠道身份探针（配置驱动，零平台分支）
 * SPRINT-MEDIA-CHANNEL-ADAPTER-EXPANSION-01 Task01 平台接入标准化
 *
 * 平台差异 100% 来自 ChannelPlatformDefinition（browser-channel.meta.ts）：
 * - identityRules.urlFragments / markers → 页面特征信号
 * - identityRules.cookies              → cookie 信号
 * - identityRules.extractionRules      → 身份提取（userId/nickname/avatar/accountType，
 *                                         method: hydration / regex / url）
 * - identityRules.loginPageMarkers     → 登录页排除（防误判）
 *
 * 综合判定与抖音探针一致：页面特征或身份提取任一命中即认证；
 * 仅 cookie 残留不算登录成功（session 失效时 cookie 仍在，页面已回登录页）。
 * 禁止在此文件写 if(platform==="xxx") 平台分支——差异全部走配置。
 */
import type { ChannelIdentity, ChannelIdentityProbe } from '../identity-probe.js'
import { identityProbeRegistry } from '../identity-probe.js'
import { browserRuntime } from '../../../services/media/browser-runtime.service.js'
import { CHANNEL_META, type ChannelPlatformDefinition, type ExtractionRule } from './browser-channel.meta.js'

export class BrowserChannelProbe implements ChannelIdentityProbe {
  readonly platform: string
  private readonly meta: ChannelPlatformDefinition

  constructor(platform: string) {
    this.platform = platform
    const meta = CHANNEL_META[platform]
    if (!meta) throw new Error(`BrowserChannelProbe: 未知平台 ${platform}（browser-channel.meta.ts 未配置）`)
    this.meta = meta
  }

  private get keyCookies(): string[] {
    return this.meta.identityRules.cookies
  }

  async probe(sessionId: string): Promise<ChannelIdentity> {
    const signals = { page: false, cookie: false, identity: false }
    const identity: { userId?: string; nickname?: string; avatar?: string; accountType?: string } = {}

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
        // Task04：排除 URL 正则（命中 → 明确非工作台；如快手普通用户主页 v.kuaishou.com/profile）
        if (this.meta.identityRules.excludeUrlPatterns?.some(re => re.test(url))) return false
        if (this.meta.identityRules.urlFragments.some(f => url.includes(f))) return true
        if (/passport|login|qr|sso|signin/i.test(url)) return false
        const bodyText = await page.locator('body').innerText().catch(() => '')
        if (this.meta.identityRules.loginPageMarkers.some(m => bodyText.includes(m))) return false
        const hit = this.meta.identityRules.markers.filter(m => bodyText.includes(m)).length
        return hit >= 2
      })
    } catch (e: any) {
      console.warn(`[BrowserChannelProbe:${this.platform}] 页面特征探测异常: ${e.message}`)
    }

    // B Cookie 信号（平台关键 cookie ≥2；仅信号，不单独判定登录）
    try {
      const cookies = await browserRuntime.getCookies(sessionId)
      const names = new Set((cookies || []).map(c => c.name))
      signals.cookie = this.keyCookies.filter(k => names.has(k)).length >= 2
    } catch (e: any) {
      console.warn(`[BrowserChannelProbe:${this.platform}] Cookie 探测异常: ${e.message}`)
    }

    // C 身份提取：extractionRules 配置驱动（hydration / regex / url 三方法）
    try {
      const extracted = await this.extractIdentity(sessionId)
      if (extracted) {
        identity.userId = extracted.userId
        identity.nickname = extracted.nickname
        identity.avatar = extracted.avatar
        identity.accountType = extracted.accountType
        // 身份提取命中即算 identity 信号（真实页面数据，非 cookie 残留）
        if (extracted.userId || extracted.nickname) signals.identity = true
      }
    } catch (e: any) {
      console.warn(`[BrowserChannelProbe:${this.platform}] 身份提取异常: ${e.message}`)
    }

    // 综合判定：页面特征或身份提取任一命中即认证（真实登录态；cookie 残留不算）
    const authenticated = signals.page || signals.identity

    return {
      authenticated,
      accountId: identity.userId,
      accountName: identity.nickname,
      avatar: identity.avatar,
      accountType: identity.accountType,
      permissions: authenticated ? ['read:metrics', 'read:comments', 'analyze'] : [],
      checkedAt: new Date().toISOString(),
      signals,
    }
  }

  /**
   * extractionRules 驱动的身份提取
   * - hydration: 遍历 window._ROUTER_DATA / __NEXT_DATA__ / __INITIAL_STATE__ 等前端状态树，
   *              按 hydrationKeys（支持 a.b.c 嵌套路径）取值
   * - regex:     页面 body 文本正则提取
   * - url:       当前 URL 正则提取
   */
  private async extractIdentity(sessionId: string): Promise<{
    userId?: string
    nickname?: string
    avatar?: string
    accountType?: string
  } | null> {
    const rules = this.meta.identityRules.extractionRules
    if (!rules.length) return null

    const out: { userId?: string; nickname?: string; avatar?: string; accountType?: string } = {}
    const urlText: string[] = []

    await browserRuntime.withPage(sessionId, async (page) => {
      if (page.isClosed()) return
      const bodyText = await page.locator('body').innerText().catch(() => '')
      const currentUrl = page.url()

      // 按规则类型分组执行
      const hydrationRules = rules.filter(r => r.method === 'hydration')
      const regexRules = rules.filter(r => r.method === 'regex')
      const urlRules = rules.filter(r => r.method === 'url')

      // 1) hydration：前端状态树取值
      if (hydrationRules.length) {
        const hydrated = await page.evaluate((hrules) => {
          const roots: any[] = []
          for (const key of ['_ROUTER_DATA', '__NEXT_DATA__', '__INITIAL_STATE__', '__NUXT__', 'INITIAL_STATE']) {
            const v = (window as any)[key]
            if (v) roots.push(v)
          }
          const pick = (o: any, path: string): any => {
            const parts = path.split('.')
            let cur = o
            for (const p of parts) {
              if (cur == null || typeof cur !== 'object') return undefined
              cur = cur[p]
            }
            return cur
          }
          const res: Record<string, string> = {}
          for (const rule of hrules) {
            if (!rule.hydrationKeys || !rule.hydrationKeys.length) continue
            if (res[rule.field]) continue // 已有值不覆盖
            for (const root of roots) {
              for (const k of rule.hydrationKeys) {
                // 支持 a.b.c 和 a.b.0（数组下标）
                const v = pick(root, k)
                if (typeof v === 'string' && v.length > 0 && v.length < 200) {
                  res[rule.field] = v
                  break
                }
              }
              if (res[rule.field]) break
            }
          }
          return res
        }, hydrationRules.map(r => ({ field: r.field, hydrationKeys: r.hydrationKeys }))).catch(() => null)
        if (hydrated) {
          for (const [k, v] of Object.entries(hydrated)) {
            if (v) (out as any)[k] = v
          }
        }
      }

      // 2) regex：body 文本
      for (const rule of regexRules) {
        if ((out as any)[rule.field]) continue
        if (!rule.pattern) continue
        const m = bodyText.match(rule.pattern)
        if (m && m[rule.group ?? 1]) (out as any)[rule.field] = m[rule.group ?? 1].trim()
      }

      // 3) url：当前 URL
      for (const rule of urlRules) {
        if ((out as any)[rule.field]) continue
        if (!rule.pattern) continue
        const m = currentUrl.match(rule.pattern)
        if (m && m[rule.group ?? 1]) (out as any)[rule.field] = m[rule.group ?? 1].trim()
      }

      urlText.push(currentUrl)
    })

    // 至少拿到 userId 或 nickname 才算身份提取成功（仅 avatar/accountType 不算）
    if (!out.userId && !out.nickname) return null
    return out
  }
}
