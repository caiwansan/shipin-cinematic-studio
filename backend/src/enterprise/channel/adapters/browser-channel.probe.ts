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
 * - identityRules.securityCheckMarkers → 安全验证页标记（SECURITY_CHECK / NEEDS_REAUTH）
 *
 * IDENTITY-V2-HARDENING-01 — 三层信号综合判定：
 *   credential（关键 cookie + 非登录页）&& (identity || workspace 页面特征) 才认证。
 * 禁止：仅 cookie 残留算成功（session 失效时 cookie 仍在，页面已回登录页）。
 * 禁止：仅页面特征算成功（游客页可能命中 markers，必须凭证伴随）。
 * 禁止在此文件写 if(platform==="xxx") 平台分支——差异全部走配置。
 */
import type { ChannelIdentity, ChannelIdentityProbe } from '../identity-probe.js'
import { identityProbeRegistry } from '../identity-probe.js'
import { browserRuntime } from '../../../services/media/browser-runtime.service.js'
import { CHANNEL_META, type ChannelPlatformDefinition, type ExtractionRule } from './browser-channel.meta.js'

/**
 * IDENTITY-V2 综合判定纯函数（可单测；探针与单测共用同一逻辑）
 * 规则：credential = cookie && !loginPage；authenticated = credential && (identity || page)
 * 禁止 cookie 数量>0 即成功；身份/页面特征必须伴随凭证信号。
 */
export function judgeIdentityV2(signals: {
  page: boolean
  cookie: boolean
  identity: boolean
  loginPage?: boolean
  securityCheck?: boolean
}): { authenticated: boolean; credential: boolean } {
  const loginPage = !!signals.loginPage
  const credential = signals.cookie && !loginPage
  // 安全验证页：页面特征/身份仍在 → 保持认证（上层标 NEEDS_REAUTH）；否则未认证（上层标 SECURITY_CHECK）
  const authenticated = credential && (signals.identity || signals.page)
  return { authenticated, credential }
}

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
    const signals = { page: false, cookie: false, identity: false, loginPage: false, securityCheck: false, credential: false }
    const identity: { userId?: string; nickname?: string; avatar?: string; accountType?: string } = {}

    // A 单次 withPage 收集：页面特征 + 登录页排除 + 安全验证页（减少浏览器操作，探针更快）
    try {
      const pageRes = await browserRuntime.withPage(sessionId, async (page) => {
        await page.waitForTimeout(1500 + Math.random() * 800)
        if (page.isClosed()) return null
        const url = page.url()
        // WECHAT-CHANNELS-FIX-01 — innerText 空时 fallback textContent（视频号 SPA 渲染）
        let bodyText = await page.locator('body').innerText().catch(() => '')
        if (!bodyText || bodyText.trim().length === 0) {
          bodyText = await page.evaluate(() => document.body ? document.body.textContent || '' : '').catch(() => '') || ''
        }
        // ⚠️ 登录页 URL 排除（2026-08-02 多平台误判修复）：
        //    快手未登录跳 /profile、小红书 /login 也在 creator 域下，
        //    工作台 URL 片段命中前必须先排除登录路径
        const loginByUrl = /\/login|\/signin|\/passport|\/auth|\/sso|login\.html|login\.php/i.test(url)
        const loginByBody = this.meta.identityRules.loginPageMarkers.some(m => bodyText.includes(m))
        const loginPage = loginByUrl || loginByBody
        // IDENTITY-V2 — 安全验证页（身份验证/风控，区别于普通登录页）
        const securityByUrl = this.meta.identityRules.securityCheckUrlPatterns?.some(re => re.test(url)) || false
        const securityByBody = this.meta.identityRules.securityCheckMarkers?.some(m => bodyText.includes(m)) || false
        const securityCheck = securityByUrl || securityByBody

        if (loginPage) return { loginPage, securityCheck, page: false }
        // Task04：排除 URL 正则（命中 → 明确非工作台；如快手普通用户主页 v.kuaishou.com/profile）
        if (this.meta.identityRules.excludeUrlPatterns?.some(re => re.test(url))) return { loginPage, securityCheck, page: false }
        if (this.meta.identityRules.urlFragments.some(f => url.includes(f))) return { loginPage, securityCheck, page: true }
        if (/passport|login|qr|sso|signin/i.test(url)) return { loginPage, securityCheck, page: false }
        if (this.meta.identityRules.loginPageMarkers.some(m => bodyText.includes(m))) return { loginPage, securityCheck, page: false }
        const hit = this.meta.identityRules.markers.filter(m => bodyText.includes(m)).length
        return { loginPage, securityCheck, page: hit >= 2 }
      })
      if (pageRes) {
        signals.page = pageRes.page
        signals.loginPage = pageRes.loginPage
        signals.securityCheck = pageRes.securityCheck
      }
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

    // IDENTITY-V2 — 三层信号综合判定（纯函数，可单测）
    const { authenticated, credential } = judgeIdentityV2(signals)
    signals.credential = credential

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
      // WECHAT-CHANNELS-FIX-01 — innerText 空时 fallback textContent：
      // 视频号工作台 SPA 渲染后 innerText 可能为空（隐藏层/特殊渲染），
      // 但 DOM textContent 稳定可用（实测 textContent 含完整工作台文本与视频号ID）
      let bodyText = await page.locator('body').innerText().catch(() => '')
      if (!bodyText || bodyText.trim().length === 0) {
        bodyText = await page.evaluate(() => document.body ? document.body.textContent || '' : '').catch(() => '') || ''
      }
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

      // 4) network：body 无 UID 明文 + 内部 API 需签名（如快手 cp.kuaishou.com）→
      //    刷新页面监听内部 API 响应捕获官方 userId/userName（页面自身请求自带签名）
      //    结果缓存 5 分钟，避免探针轮询期间反复刷新页面
      const netCfg = this.meta.identityRules.networkApis
      if (!out.userId && netCfg?.userApis?.length) {
        const cache = this._networkIdentityCache
        const cached = cache && cache.sessionId === sessionId && Date.now() - cache.at < 5 * 60 * 1000 ? cache.data : null
        const cap = cached ?? (await this.captureIdentityFromNetwork(page, netCfg, sessionId))
        if (cap) {
          if (cap.userId && !out.userId) out.userId = cap.userId
          if (cap.nickname && !out.nickname) out.nickname = cap.nickname
          if (cap.avatar && !out.avatar) out.avatar = cap.avatar
        }
      }

      urlText.push(currentUrl)
    })

    // 至少拿到 userId 或 nickname 才算身份提取成功（仅 avatar/accountType 不算）
    if (!out.userId && !out.nickname) return null
    return out
  }

  /** network 捕获缓存（sessionId → 数据，5 分钟有效） */
  private _networkIdentityCache: { sessionId: string; at: number; data: { userId?: string; nickname?: string; avatar?: string } } | null = null

  /**
   * KUAISHOU-FIX-01 — 刷新页面监听内部 API 响应，捕获官方身份（页面自身请求自带 __NS_sig3 签名）
   */
  private async captureIdentityFromNetwork(
    page: any,
    cfg: { userApis: string[]; userIdKeys: string[]; nicknameKeys: string[]; avatarKeys?: string[] },
    sessionId: string,
  ): Promise<{ userId?: string; nickname?: string; avatar?: string } | null> {
    try {
      return await new Promise<{ userId?: string; nickname?: string; avatar?: string } | null>((resolve) => {
        let settled = false
        const timer = setTimeout(() => { if (!settled) { settled = true; resolve(null) } }, 9000)
        const cleanup = () => { try { page.off('response', handler) } catch {} }
        const handler = async (resp: any) => {
          try {
            const u = resp.url()
            if (!cfg.userApis.some(p => u.includes(p))) return
            const ct = resp.headers()['content-type'] || ''
            if (!ct.includes('json')) return
            const j = await resp.json().catch(() => null)
            if (!j) return
            const deepPick = (obj: any, key: string, depth = 0): any => {
              if (!obj || typeof obj !== 'object' || depth > 4) return undefined
              if (obj[key] !== undefined && obj[key] !== null) return obj[key]
              for (const v of Object.values(obj)) {
                const r = deepPick(v, key, depth + 1)
                if (r !== undefined) return r
              }
              return undefined
            }
            const pick = (keys: string[]): string | undefined => {
              for (const k of keys) {
                const v = deepPick(j, k)
                if (typeof v === 'string' && v) return v
                if (typeof v === 'number' && v) return String(v)
              }
              return undefined
            }
            const userId = pick(cfg.userIdKeys)
            const nickname = pick(cfg.nicknameKeys)
            if (userId || nickname) {
              if (!settled) {
                settled = true
                clearTimeout(timer)
                cleanup()
                const data = { userId, nickname, avatar: cfg.avatarKeys ? pick(cfg.avatarKeys) : undefined }
                this._networkIdentityCache = { sessionId, at: Date.now(), data }
                resolve(data)
              }
            }
          } catch {}
        }
        page.on('response', handler)
        page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
      })
    } catch (e: any) {
      console.warn(`[BrowserChannelProbe:${this.platform}] network 身份捕获失败: ${e.message}`)
      return null
    }
  }
}
