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
import type { ChannelIdentity, ChannelIdentityProbe, LoginRealityState } from '../identity-probe.js'
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

  /** TASK02 — identityRequirements 强信号 cookie（登录主体凭证，必须全命中）；未配置回退 keyCookies */
  private get requiredCookieKeys(): string[] {
    return this.meta.identityRules.identityRequirements?.requiredCookies ?? this.keyCookies
  }

  /** TASK02 — identityRequirements 弱信号 cookie（仅诊断日志） */
  private get weakCookieKeys(): string[] {
    return this.meta.identityRules.identityRequirements?.weakCookies ?? []
  }

  async probe(sessionId: string): Promise<ChannelIdentity> {
    const signals = { page: false, cookie: false, identity: false, loginPage: false, securityCheck: false, credential: false, sessionAuthenticated: false, identityResolved: false, workspaceReady: false }
    const identity: { userId?: string; nickname?: string; avatar?: string; accountType?: string } = {}
    // LOGIN-CAPABILITY-V2 — 探针通道按 identityStrategy 显式启用/禁用（禁止 if(platform) 分支）
    const strategy = this.meta.identityStrategy ?? { pageProbe: true, cookieProbe: true, networkCapture: false, allowReload: false }

    // A 单次 withPage 收集：页面特征 + 登录页排除 + 安全验证页（减少浏览器操作，探针更快）
    // KUAISHOU-QR-FIX-01：fallbackUrl = workspaceUrl——实例重启/页面死后恢复导航到工作台，
    // cookie 有效则直接进入已登录视图，探针才能测到 page 信号（否则 about:blank 永远 miss）
    if (strategy.pageProbe) {
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

        if (loginPage) return { loginPage, securityCheck, page: false, workspaceReady: false }
        // Task04：排除 URL 正则（命中 → 明确非工作台；如快手普通用户主页 v.kuaishou.com/profile）
        if (this.meta.identityRules.excludeUrlPatterns?.some(re => re.test(url))) return { loginPage, securityCheck, page: false, workspaceReady: false }
        // MEDIA-LOGIN-CAPABILITY-V3 Task01 — workspaceReady 只认工作台专属 URL 片段（urlFragments），
        // 与 page 信号（兼容层）解耦：markers 命中 ≥2 只能算 page，不算 workspace（防个人中心导航词误判）
        if (this.meta.identityRules.urlFragments.some(f => url.includes(f))) return { loginPage, securityCheck, page: true, workspaceReady: true }
        if (/passport|login|qr|sso|signin/i.test(url)) return { loginPage, securityCheck, page: false, workspaceReady: false }
        if (this.meta.identityRules.loginPageMarkers.some(m => bodyText.includes(m))) return { loginPage, securityCheck, page: false, workspaceReady: false }
        // MEDIA-LOGIN-CAPABILITY-V3 Task02 — 删除 markers≥2 → page=true（假成功根因）。
        // 实证：快手 cp.kuaishou.com/profile（创作者个人中心）含「作品管理/创作服务/视频管理」等
        // 工作台导航词 → markers 命中≥2 → page=true → authenticated=true（passport 会话+误判）→
        // connect 返回 connected + displayName 假名 + extId 缺失（假成功）。
        // markers 现在只作诊断日志，绝不参与认证；page 信号只认工作台 URL 片段（urlFragments）。
        const hit = this.meta.identityRules.markers.filter(m => bodyText.includes(m)).length
        if (hit > 0) {
          console.log(`[BrowserChannelProbe:${this.platform}] 非工作台页命中 markers=${hit}（仅诊断，不参与认证）url=${url.slice(0, 60)}`)
        }
        return { loginPage, securityCheck, page: false, workspaceReady: false }
      }, this.meta.workspaceUrl)
      if (pageRes) {
        signals.page = pageRes.page
        signals.workspaceReady = !!pageRes.workspaceReady
        signals.loginPage = pageRes.loginPage
        signals.securityCheck = pageRes.securityCheck
      }
    } catch (e: any) {
      console.warn(`[BrowserChannelProbe:${this.platform}] 页面特征探测异常: ${e.message}`)
    }
    }

    // B Cookie 信号（TASK02：配置 identityRequirements 的平台 = requiredCookies 全命中；
    // 未配置平台保持旧逻辑 cookies≥2。仅信号，不单独判定登录）
    if (strategy.cookieProbe) {
    try {
      const cookies = await browserRuntime.getCookies(sessionId)
      const names = new Set((cookies || []).map(c => c.name))
      const req = this.meta.identityRules.identityRequirements
      if (req?.requiredCookies?.length) {
        // 强信号全命中才成立：脏会话（kwssectoken+did 无 bUserId）→ false，杜绝假阳性
        signals.cookie = req.requiredCookies.every(k => names.has(k))
      } else {
        signals.cookie = this.keyCookies.filter(k => names.has(k)).length >= 2
      }
    } catch (e: any) {
      console.warn(`[BrowserChannelProbe:${this.platform}] Cookie 探测异常: ${e.message}`)
    }
    }

    // C 身份提取：extractionRules 配置驱动（hydration / regex / url 三方法）
    // AUDIT-2026-08-03 — 登录页短路：登录页不提取身份、不触发 network 捕获（reload）。
    // 根因：captureIdentityFromNetwork 无条件 page.reload()，扫码确认窗口期（1-5s）
    // reload 会把 passport「已扫码待确认」状态刷掉 → 确认结果丢失 → 三平台扫码成功不登录。
    // LOGIN-CAPABILITY-V2 — networkCapture=false 的平台（抖音/小红书/视频号）完全跳过 network 通道；
    // allowReload=false 时 network 捕获走 passive 模式（只监听自然请求，绝不主动 reload）
    try {
      const skipNetwork = signals.loginPage || signals.securityCheck || !strategy.networkCapture
      const extracted = await this.extractIdentity(sessionId, { skipNetwork, allowReload: strategy.allowReload })
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
    // MEDIA-LOGIN-CAPABILITY-V3 Task01 — 三信号拆分：
    //   sessionAuthenticated = credential（session 层：真实登录凭证 + 非登录页）
    //   identityResolved     = identity（身份层：userId/nickname 提取成功）
    //   workspaceReady       = urlFragments 命中（工作台层，已在页面阶段计算；不含 markers 误判）
    signals.sessionAuthenticated = credential
    signals.identityResolved = signals.identity

    // MEDIA-LOGIN-CAPABILITY-V3 Task01 — 三层认证现实（LoginRealityState）
    // 上层（状态机/owner-view）以此为准；authenticated 兼容字段保留旧语义供存量调用方过渡
    let reality: LoginRealityState = {
      session: { authenticated: !!signals.sessionAuthenticated },
      identity: { resolved: !!signals.identityResolved, accountId: identity.userId, accountName: identity.nickname },
      workspace: { ready: !!signals.workspaceReady },
    }

    // LOGIN-REALITY-HARDENING-02 Task01 — 探针信号明细观测（每轮输出，还原登录状态链）：
    // 记录 URL / 登录页判定 / cookie 命中 / 页面特征 / 身份提取 / 综合判定
    try {
      const url = await browserRuntime.withPage(sessionId, async (page) => page.url()).catch(() => '')
      reality.identity.sourceUrl = url || undefined
      reality.workspace.url = url || undefined
      const cookieNames = await browserRuntime.getCookies(sessionId).catch(() => [])
      const names = (cookieNames || []).map((c: any) => c.name)
      const req = this.meta.identityRules.identityRequirements
      const reqHit = req?.requiredCookies?.filter(k => names.includes(k)) ?? []
      const weakHit = (req?.weakCookies ?? []).filter(k => names.includes(k))
      console.log(
        `[LOGIN-TIMELINE][${this.platform}] probe url=${url.slice(0, 80)} | ` +
        `page=${signals.page} workspace=${signals.workspaceReady} loginPage=${signals.loginPage} securityCheck=${signals.securityCheck} | ` +
        `cookie=${signals.cookie} (req=${reqHit.join(',') || 'none'}/${req?.requiredCookies?.join(',') || this.keyCookies.join(',')} weak=${weakHit.join(',') || 'none'} have:${names.slice(0, 10).join(',')}) | ` +
        `identity=${signals.identity} (${identity.userId || '-'}/${identity.nickname || '-'}) | ` +
        `V3(session=${signals.sessionAuthenticated} identity=${signals.identityResolved} workspace=${signals.workspaceReady}) | ` +
        `=> authenticated=${authenticated} credential=${credential}`
      )
    } catch {}

    return {
      authenticated,
      accountId: identity.userId,
      accountName: identity.nickname,
      avatar: identity.avatar,
      accountType: identity.accountType,
      permissions: authenticated ? ['read:metrics', 'read:comments', 'analyze'] : [],
      checkedAt: new Date().toISOString(),
      signals,
      reality,
    }
  }

  /**
   * extractionRules 驱动的身份提取
   * - hydration: 遍历 window._ROUTER_DATA / __NEXT_DATA__ / __INITIAL_STATE__ 等前端状态树，
   *              按 hydrationKeys（支持 a.b.c 嵌套路径）取值
   * - regex:     页面 body 文本正则提取
   * - url:       当前 URL 正则提取
   */
  private async extractIdentity(sessionId: string, opts?: { skipNetwork?: boolean; allowReload?: boolean }): Promise<{
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
      //    AUDIT-2026-08-03 — skipNetwork=true（登录页/安全验证页）禁止 reload：
      //    reload 会打断 passport 扫码确认窗口期 → 确认结果丢失（扫码成功不登录根因）
      const netCfg = this.meta.identityRules.networkApis
      if (!out.userId && netCfg?.userApis?.length && !opts?.skipNetwork) {
        // VC-REALITY-HOTFIX-01 — 常驻缓存优先（导航/SPA 自然请求/主动 reload 已累积捕获）
        const persData = this.getPersistentCapture(sessionId)
        const cap = persData ?? (await this.captureIdentityFromNetwork(page, netCfg, sessionId, { allowReload: !!opts?.allowReload }))
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

  /**
   * VC-REALITY-HOTFIX-01 — per-session 常驻网络监听：
   * listener 挂在 page 上不清理（页面生命周期内持续捕获），导航/SPA 自然请求/主动 reload
   * 触发的官方身份 API 响应都会被累积捕获。根治「快手已登录但 accountId 空」：
   * 旧实现 listener 只在 captureIdentityFromNetwork 内挂 12s 就移除，导航发生在 probe 之间
   * → 页面加载请求永远错过 → 快手 home API（__NS_sig3 签名）永不捕获 → waitForLogin 硬条件
   * identity.accountId 永不满足 → 永远「轮询未认证」→ 前端永远等待扫码（掌柜 2026-08-03 真机实锤）。
   */
  private _persistentCapture = new Map<string, { page: any; data: { userId?: string; nickname?: string; avatar?: string } | null; handler?: any }>()

  /**
   * 确保该 session 的常驻监听已挂载（导航/reload 前调用，避免错过整页加载的 API 请求）。
   * page 引用变化（页面重建）时自动重挂。返回当前已捕获数据（无则 null）。
   */
  ensurePersistentCapture(page: any, sessionId: string): { userId?: string; nickname?: string; avatar?: string } | null {
    const cfg = this.meta.identityRules.networkApis
    if (!cfg?.userApis?.length) return null
    const cur = this._persistentCapture.get(sessionId)
    if (cur && cur.page === page && cur.handler) {
      return cur.data && (cur.data.userId || cur.data.nickname) ? cur.data : null
    }
    // 页面引用变化 → 旧 listener 已随旧 page 失效（off 安全幂等）
    try {
      if (cur?.handler && cur.page && cur.page !== page) cur.page.off('response', cur.handler)
    } catch {}
    let data: { userId?: string; nickname?: string; avatar?: string } | null = null
    const handler = async (resp: any) => {
      try {
        const u = resp.url()
        if (!cfg.userApis.some(p => u.includes(p))) return
        const ct = resp.headers()['content-type'] || ''
        if (!ct.includes('json')) return
        const j = await resp.json().catch(() => null)
        if (!j) return
        const userId = this.pickKeys(j, cfg.userIdKeys)
        const nickname = this.pickKeys(j, cfg.nicknameKeys)
        if (userId || nickname) {
          // KS-DEBUG-2026-08-03 — 合并策略（防宽前缀 API 污染覆盖）：
          // 快手 taskCardV2 等接口命中 userApis 宽前缀但无 userId（仅 nickname 如「我的成长任务」），
          // 若后到会覆盖已捕获的官方 userId → probe 永远读不到 userId（掌柜实锤：捕获 4541961964
          // 后探针仍输出 '-'）。合并：新值缺失时保留已有值，新值存在时升级。
          const prev = this._persistentCapture.get(sessionId)?.data
          const merged = {
            userId: userId || prev?.userId,
            nickname: nickname || prev?.nickname,
            avatar: (cfg.avatarKeys ? this.pickKeys(j, cfg.avatarKeys) : undefined) || prev?.avatar,
          }
          data = merged
          this._persistentCapture.set(sessionId, { page, data, handler })
          console.log(`[BrowserChannelProbe:${this.platform}] 常驻监听捕获官方身份 ${merged.userId || '-'}/${merged.nickname || '-'}（${u.slice(0, 80)}）`)
        }
      } catch {}
    }
    page.on('response', handler)
    this._persistentCapture.set(sessionId, { page, data, handler })
    return null
  }

  /** 只读：该 session 常驻捕获的数据（无则 null） */
  getPersistentCapture(sessionId: string): { userId?: string; nickname?: string; avatar?: string } | null {
    const cur = this._persistentCapture.get(sessionId)
    if (!cur || !cur.data) return null
    return cur.data.userId || cur.data.nickname ? cur.data : null
  }

  /** 深度取值（复用 capture 与常驻监听的 pick 逻辑） */
  private pickKeys(obj: any, keys: string[]): string | undefined {
    const deepPick = (o: any, key: string, depth = 0): any => {
      if (!o || typeof o !== 'object' || depth > 4) return undefined
      if (o[key] !== undefined && o[key] !== null) return o[key]
      for (const v of Object.values(o)) {
        const r = deepPick(v, key, depth + 1)
        if (r !== undefined) return r
      }
      return undefined
    }
    for (const k of keys) {
      const v = deepPick(obj, k)
      if (typeof v === 'string' && v) return v
      if (typeof v === 'number' && v) return String(v)
    }
    return undefined
  }

  /**
   * KUAISHOU-FIX-01 — 监听内部 API 响应，捕获官方身份（页面自身请求自带 __NS_sig3 签名）
   * LOGIN-CAPABILITY-V2 — passive/reload 双模式：
   *   allowReload=true  → 监听 + 主动 reload 触发请求（登录态稳定后可用）
   *   allowReload=false → passive 模式：只监听自然请求（SPA 轮询/跳转），绝不主动 reload。
   *                       扫码确认窗口期 reload 会把 passport「已扫码待确认」状态刷掉 → 确认丢失。
   *                       自然请求可能不立即出现（快手工作台首屏 API 在跳转后触发），监听窗口拉长。
   */
  private async captureIdentityFromNetwork(
    page: any,
    cfg: { userApis: string[]; userIdKeys: string[]; nicknameKeys: string[]; avatarKeys?: string[] },
    sessionId: string,
    opts?: { allowReload?: boolean },
  ): Promise<{ userId?: string; nickname?: string; avatar?: string } | null> {
    // AUDIT-2026-08-03 — 双保险：reload 前再次确认当前页面不是登录页/安全验证页。
    // 登录页 reload = 扫码确认窗口期自杀（passport 已扫码待确认状态被刷掉 → 永不登录）
    const allowReload = !!opts?.allowReload
    // VC-REALITY-HOTFIX-01 — 常驻监听已捕获（导航/SPA 自然请求/主动 reload 累积）→ 直接命中，
    // 不再重复 12s 等待（旧实现每次 probe 都白等——页面已稳定无自然请求，永远捕获不到）
    const persistent = this.getPersistentCapture(sessionId)
    if (persistent) {
      console.log(`[BrowserChannelProbe:${this.platform}] network 常驻缓存命中 ${persistent.userId || '-'}/${persistent.nickname || '-'}`)
      return persistent
    }
    try {
      const url = page.url() || ''
      if (/\/login|\/signin|\/passport|\/auth|\/sso|login\.html|login\.php/i.test(url)) {
        console.log(`[BrowserChannelProbe:${this.platform}] 登录页跳过 network 捕获（保护扫码确认窗口期）`)
        return null
      }
      const bodyText = await page.evaluate(() => document.body ? document.body.textContent || '' : '').catch(() => '')
      if (this.meta.identityRules.loginPageMarkers.some(m => bodyText.includes(m))) {
        console.log(`[BrowserChannelProbe:${this.platform}] 登录页 body 标记命中，跳过 network 捕获`)
        return null
      }
    } catch {}
    try {
      return await new Promise<{ userId?: string; nickname?: string; avatar?: string } | null>((resolve) => {
        let settled = false
        // passive 模式监听窗口 12s（自然请求可能晚到）；reload 模式 9s（reload 触发后请求较快）
        const timer = setTimeout(() => { if (!settled) { settled = true; resolve(null) } }, allowReload ? 9000 : 12000)
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
                // KS-DEBUG-2026-08-03 — 与常驻监听一致的合并策略：新捕获缺 userId 时保留已有值
                const prev = this._persistentCapture.get(sessionId)?.data
                const data = {
                  userId: userId || prev?.userId,
                  nickname: nickname || prev?.nickname,
                  avatar: (cfg.avatarKeys ? pick(cfg.avatarKeys) : undefined) || prev?.avatar,
                }
                // VC-REALITY-HOTFIX-01 — 临时窗口捕获结果写入常驻缓存（后续 probe 秒读）
                this._persistentCapture.set(sessionId, { page, data, handler: this._persistentCapture.get(sessionId)?.handler })
                resolve(data)
              }
            }
          } catch {}
        }
        page.on('response', handler)
        // VC-REALITY-HOTFIX-01 — 等待窗口内同时挂常驻监听（窗口内到来的官方 API 也累积，
        // 后续 probe 秒读缓存；页面导航后请求也能捕获，根治「页面已稳定无自然请求」）
        this.ensurePersistentCapture(page, sessionId)
        // 仅 allowReload=true 时主动 reload 触发请求；passive 模式绝不 reload（保护扫码确认窗口期）
        if (allowReload) {
          console.log(`[BrowserChannelProbe:${this.platform}] network 捕获 reload 触发（allowReload=true）`)
          page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
        } else {
          console.log(`[BrowserChannelProbe:${this.platform}] network 捕获 passive 模式（不 reload，监听自然请求）`)
        }
      })
    } catch (e: any) {
      console.warn(`[BrowserChannelProbe:${this.platform}] network 身份捕获失败: ${e.message}`)
      return null
    }
  }
}
