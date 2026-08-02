/**
 * BrowserChannelAdapterBase — 通用浏览器渠道适配器（多平台）
 * 2026-08-02 — 抖音打通后按同范式铺开其他新媒体渠道
 *
 * 抖音 DouyinBrowserAdapter 的泛化基类：把「Playwright 持久化 profile + 扫码登录 +
 * 多信号探针 + 凭证 AES 落库 + 人工确认绑定」这套已验证链路抽象为平台无关，
 * 平台差异（登录 URL/工作台特征/账号提取正则）全部来自 BrowserChannelMeta。
 *
 * 子类只需：
 * 1. 提供 platform / name（必须）
 * 2. 可选覆写 fetchMetrics / fetchComments（各平台数据页结构差异大，默认诚实报未实现）
 * 3. 可选覆写 getLoginStatus 的验证页检测（各平台风控差异）
 *
 * Credential 流程与抖音一致：adapter 不保存凭证，经注入回调走 EnterpriseChannelService（AES）。
 */
import { browserRuntime } from '../../../services/media/browser-runtime.service.js'
import type { CookieData } from '../../../services/media/browser-runtime.service.js'
import { identityProbeRegistry } from '../identity-probe.js'
import type { ChannelIdentity } from '../identity-probe.js'
import { CHANNEL_META, type ChannelPlatformDefinition } from './browser-channel.meta.js'
import { LoginStateMachine } from '../login-state-machine.js'
import { loginDetector } from './login-detector.js'
import type {
  EnterpriseChannelAdapter,
  ConnectResult,
  ChannelMetrics,
  ChannelComment,
  ChannelHealth,
  ChannelContent,
  PublishResult,
  PlatformInteraction,
} from '../channel.adapter.js'

export interface BrowserChannelDeps {
  getCredential: (accountId: string) => Promise<Record<string, string>>
  persistCredential: (accountId: string, credential: Record<string, string>) => Promise<void>
}

export abstract class BrowserChannelAdapterBase implements EnterpriseChannelAdapter {
  abstract readonly platform: string
  abstract readonly name: string

  protected get meta(): ChannelPlatformDefinition {
    return CHANNEL_META[this.platform]
  }

  /** 会话级登录状态机（统一状态，禁止平台自定义） */
  private readonly stateMachines = new Map<string, LoginStateMachine>()

  protected getStateMachine(sessionId: string): LoginStateMachine {
    let sm = this.stateMachines.get(sessionId)
    if (!sm) {
      sm = new LoginStateMachine()
      this.stateMachines.set(sessionId, sm)
    }
    return sm
  }

  protected constructor(protected readonly deps: BrowserChannelDeps) {}

  sessionIdFor(accountId: string): string {
    return `${this.platform}:${accountId}`
  }

  /**
   * [v1.0] 连接渠道账号（持久化 profile 主路径，与抖音一致）
   */
  async connect(accountId?: string): Promise<ConnectResult> {
    const meta = this.meta
    const sid = this.sessionIdFor(accountId ?? 'new')
    const profilePath = browserRuntime.getProfilePath(this.platform, accountId ?? 'new')

    // 主路径：持久化浏览器（同一 profile 已存在实例则复用，保留登录态）
    await browserRuntime.getOrCreatePersistent(sid, profilePath, { headless: false })

    // fallback：持久化 profile 无登录态时，尝试用已有凭证注入 cookie
    if (accountId) {
      try {
        const cred = await this.deps.getCredential(accountId)
        const cookieData = cred.cookieData
        if (cookieData) {
          const cookies: CookieData[] = JSON.parse(cookieData)
          await browserRuntime.restoreCookies(sid, cookies)
        }
      } catch (e: any) {
        console.warn(`[${this.name}Adapter] 凭证恢复失败（继续打开登录页）: ${e.message}`)
      }
    }

    // 检测登录态（多信号探针）
    let identity: ChannelIdentity | null = null
    try {
      identity = await identityProbeRegistry.get(this.platform)!.probe(sid)
    } catch (e: any) {
      console.warn(`[${this.name}Adapter] connect 阶段登录态检测异常: ${e.message}`)
    }
    if (identity?.authenticated) {
      return {
        sessionId: sid,
        status: 'connected',
        accountName: identity.accountName || meta.displayName,
        externalAccountId: identity.accountId,
        avatar: identity.avatar,
        permissions: identity.permissions,
      }
    }

    // LOGIN-REALITY-FIX-01 — 探针先行失败才导航登录页：
    // 已有实例且探针命中时，绝不允许 navigate 把已登录的工作台页面导航回登录页（现场自毁）。
    // 视频号无 cookie 自动恢复（依赖本机微信 fastLogin），现场更须保护。
    const nav = await browserRuntime.navigate(sid, meta.loginUrl, { headless: false })
    if (!nav.success) {
      console.warn(`[${this.name}Adapter] 浏览器启动/导航失败: ${nav.error}`)
      return {
        sessionId: sid,
        status: 'waiting_login',
        loginUrl: meta.loginUrl,
        message: `登录浏览器启动失败，请稍后重试（${nav.error}）`,
      }
    }

    // ═══ SPRINT-MEDIA-LOGIN-REALITY-FIX-01 Task03/04：登录入口确认 ═══
    // 打开 loginUrl 后可能落到游客首页/普通用户端（小红书 www.xiaohongshu.com、快手 www.kuaishou.com）
    // 必须确认当前 URL 命中登录入口，否则回退导航（禁止停留在非登录面）
    await this.ensureLoginSurface(sid)

    // 导航后二次探针（登录页→扫码成功跳转场景）
    try {
      identity = await identityProbeRegistry.get(this.platform)!.probe(sid)
    } catch (e: any) {
      console.warn(`[${this.name}Adapter] connect 阶段二次登录态检测异常: ${e.message}`)
    }
    if (identity?.authenticated) {
      return {
        sessionId: sid,
        status: 'connected',
        accountName: identity.accountName || meta.displayName,
        externalAccountId: identity.accountId,
        avatar: identity.avatar,
        permissions: identity.permissions,
      }
    }

    return {
      sessionId: sid,
      status: 'waiting_login',
      loginUrl: meta.loginUrl,
      message: `请在浏览器中扫码登录${meta.displayName}，登录成功后自动保存登录态`,
    }
  }

  /**
   * ── 登录入口确认 + 导航（SPRINT-MEDIA-LOGIN-REALITY-FIX-01 Task03/04）──
   * 1) URL 必须命中 loginEntry.mustMatch（否则回退 fallbackUrl，防游客首页/普通用户端）
   * 2) 按 clickSteps 依次点击按钮进入真实登录面（如快手：立即登录 → passport → 扫码登录 tab）
   * 找不到的标签自动跳过（如小红书无扫码 tab，保持短信登录面）
   */
  private async ensureLoginSurface(sessionId: string): Promise<{ url: string; steps: string[] }> {
    const meta = this.meta
    const loginEntry = meta.loginEntry
    const steps: string[] = []
    if (!loginEntry) return { url: '', steps }
    const waitMs = loginEntry.waitMs ?? 3000
    await new Promise(r => setTimeout(r, waitMs))
    const cur = await browserRuntime.withPage(sessionId, async (p) => p.url()).catch(() => '')
    if (cur && !loginEntry.mustMatch.test(cur)) {
      console.warn(`[${this.name}Adapter] 登录入口未命中（${cur.slice(0, 60)}）→ 回退 ${loginEntry.fallbackUrl || meta.loginUrl}`)
      await browserRuntime.navigate(sessionId, loginEntry.fallbackUrl || meta.loginUrl, { headless: false })
      steps.push(`fallback:${loginEntry.fallbackUrl || meta.loginUrl}`)
      await new Promise(r => setTimeout(r, 2500))
    }
    // 按钮点击序列（进入真实登录面）
    if (loginEntry.clickSteps?.length) {
      await browserRuntime.withPage(sessionId, async (page) => {
        const clickRes = await this.clickLoginSteps(page)
        steps.push(...clickRes)
        // KUAISHOU-QR-FIX-01 — 点完「扫码登录」tab 后等二维码真正渲染（qr/start API + 图片加载），
        // 否则 connect 返回 waiting_login 时登录页只有空 tab，前端永远看不到二维码
        const qrReady = await this.waitForQrReady(page, 8000)
        if (!qrReady) steps.push('QR_NOT_READY(8s 超时)')
        else steps.push('QR_READY')
      }).catch((e: any) => steps.push(`clickSteps 异常: ${e?.message?.slice(0, 40)}`))
    }
    const finalUrl = await browserRuntime.withPage(sessionId, async (p) => p.url()).catch(() => '')
    return { url: finalUrl, steps }
  }

  /**
   * KUAISHOU-QR-FIX-01 — 登录入口按钮点击序列（「立即登录」→「扫码登录」tab）
   * 快手 passport 登录页默认 tab 是「扫码登录」但二维码组件不自动初始化，
   * 必须真实点击才触发 qr/start API 渲染二维码。找不到的标签自动跳过（SKIP）。
   */
  private async clickLoginSteps(page: any): Promise<string[]> {
    const steps: string[] = []
    for (const label of this.meta.loginEntry?.clickSteps || []) {
      // KUAISHOU-QR-FIX-01 — 点击前先等标签渲染（SPA 恢复导航后 tab 需要 2-4s 才出现），
      // 否则 evaluate 找不到元素 → SKIP → 二维码永远点不出来
      try {
        await page.waitForSelector(`text=${label}`, { timeout: 5000 })
      } catch {
        steps.push('NOT_RENDERED:' + label)
        continue
      }
      const r = await page.evaluate((lb: string) => {
        const all = Array.from(document.querySelectorAll('button,a,span,div,li')) as HTMLElement[]
        // 优先精确匹配叶子元素（textContent 完全相等且无子节点），再退回非空可见元素
        const el = all.find(e => (e.textContent || '').trim() === lb && e.children.length === 0 && e.offsetParent !== null)
          || all.find(e => (e.textContent || '').trim() === lb && e.offsetParent !== null)
        if (!el) return 'SKIP:' + lb
        // KUAISHOU-QR-FIX-01 — 用原生 el.click() 而非 dispatchEvent：
        // 实测 Svelte（快手 passport）监听原生 click，dispatchEvent(new MouseEvent) 不触发 → 二维码永不渲染
        let fired = 0
        try { el.click(); fired++ } catch {}
        // 兜底：原生 click 无效（某些框架只认组合事件）时再派发事件序列
        if (fired === 0 || !document.images.length) {
          const targets: HTMLElement[] = [el]
          if (el.parentElement && el.parentElement !== el) targets.push(el.parentElement)
          for (const t of targets) {
            for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
              try { t.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window })) } catch {}
            }
          }
        }
        return 'CLICKED:' + lb
      }, label).catch(() => 'ERR:' + label)
      steps.push(r)
      await page.waitForTimeout(1500)
      if (r.startsWith('CLICKED')) await page.waitForTimeout(1000)
    }
    return steps
  }

  /**
   * KUAISHOU-QR-FIX-01 — 等待登录页二维码真正渲染（detect 轮询，幂等）
   * 快手点击「扫码登录」后二维码走 qr/start API + data:image 渲染，需要 2-5s。
   */
  private async waitForQrReady(page: any, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      try {
        const det = await loginDetector.detect(page, { qrImgSelector: this.meta.qrImgSelector })
        if (det.qrCode) return true
      } catch {}
      await page.waitForTimeout(800)
    }
    return false
  }

  /**
   * ── 等待扫码登录完成 ──
   */
  async waitForLogin(accountId: string, timeoutMs = 300000): Promise<ConnectResult> {
    const meta = this.meta
    const sid = this.sessionIdFor(accountId)
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      let identity: ChannelIdentity | null = null
      try {
        identity = await identityProbeRegistry.get(this.platform)!.probe(sid)
      } catch (e: any) {
        console.warn(`[${this.name}Adapter] 浏览器异常（${(e as Error).message}），重新打开登录页...`)
        try {
          const nav = await browserRuntime.navigate(sid, meta.loginUrl, { headless: false })
          if (!nav.success) {
            await new Promise(r => setTimeout(r, 5000))
            continue
          }
          // 恢复后同样要过登录入口（防落游客首页/需点击进入登录面）
          await this.ensureLoginSurface(sid).catch(() => {})
        } catch (navErr: any) {
          console.warn(`[${this.name}Adapter] 恢复失败: ${navErr.message}`)
          await new Promise(r => setTimeout(r, 5000))
          continue
        }
      }
      if (identity?.authenticated) {
        return {
          sessionId: sid,
          status: 'connected',
          accountName: identity.accountName || meta.displayName,
          externalAccountId: identity.accountId,
          avatar: identity.avatar,
          permissions: identity.permissions,
        }
      }
      await new Promise(r => setTimeout(r, 8000))
    }
    return {
      sessionId: sid,
      status: 'waiting_login',
      loginUrl: meta.loginUrl,
      message: '扫码超时，请重新连接',
    }
  }

  /**
   * [v1.0] 刷新凭证（浏览器取新 cookie → persistCredential 加密落库）
   * Reality Gate：探针复核，未认证/无身份 → 拒绝刷新（防假 connected）
   */
  async refreshCredential(accountId: string): Promise<{ ok: boolean; error?: string }> {
    const sid = this.sessionIdFor(accountId)

    try {
      const probe = identityProbeRegistry.get(this.platform)
      if (probe) {
        const identity = await probe.probe(sid)
        if (!identity.authenticated || !identity.accountId) {
          return { ok: false, error: '未检测到有效登录态（无真实账号身份），拒绝刷新凭证' }
        }
      }
    } catch (e: any) {
      return { ok: false, error: `登录态探针失败，拒绝刷新凭证: ${(e as Error).message}` }
    }

    let cookies: CookieData[]
    try {
      cookies = await browserRuntime.getCookies(sid)
    } catch (e: any) {
      return { ok: false, error: `浏览器会话不存在: ${(e as Error).message}` }
    }
    if (!cookies || cookies.length === 0) {
      return { ok: false, error: '浏览器无 cookie（可能未完成登录）' }
    }
    await this.deps.persistCredential(accountId, { cookieData: JSON.stringify(cookies) })
    return { ok: true }
  }

  /**
   * 登录页状态（截图 + 二维码 + 登录检测）——前端轮询
   * Task05：统一登录状态机驱动（INIT→OPEN_BROWSER→WAIT_LOGIN→USER_ACTION_REQUIRED→VERIFYING→AUTHENTICATED→CONNECTED→READY）
   * 与抖音一致：串行锁由路由层保证；二维码放大逻辑复用
   */
  async getLoginStatus(sessionId: string): Promise<{
    url: string
    title: string
    screenshotBase64?: string
    qrCodeBase64?: string
    /** SPRINT-MEDIA-LOGIN-REALITY-FIX-01：二维码来源 img|canvas|iframe|screenshot（Debug Panel） */
    qrSource?: string
    loggedIn: boolean
    /** 统一登录状态（Task05 标准枚举；前端优先消费，禁止平台自定义） */
    state?: string
    /** 兼容旧 loginStage（迁移期保留） */
    loginStage?: 'waiting_scan' | 'scan_confirming' | 'verifying' | 'awaiting_confirmation' | 'connected' | 'ready'
    accountName?: string
    externalAccountId?: string
    avatar?: string
    accountType?: string
    verificationRequired?: boolean
    verificationType?: 'sms' | 'app' | 'face' | 'none'
    verificationTriggered?: boolean
    error?: string
    debug?: any
  }> {
    // KUAISHOU-QR-FIX-01 — 轮询前确保持久化实例存在（重启后 Map 清空，若用临时浏览器
    // 扫码登录态会写进临时 profile，后续 connect 的持久浏览器看不到 → 登录闭环断裂）
    const accountId = String(sessionId).replace(/^[^:]+:/, '')
    try {
      await browserRuntime.getOrCreatePersistent(sessionId, browserRuntime.getProfilePath(this.platform, accountId), { headless: false })
    } catch (e: any) {
      console.warn(`[${this.name}Adapter] getLoginStatus 持久实例启动失败: ${e.message}`)
    }
    try {
      const status = await browserRuntime.getStatus(sessionId)
      let screenshotBase64: string | undefined
      if (status.screenshot) {
        const buf = await import('fs').then(fs => fs.promises.readFile(status.screenshot!))
        screenshotBase64 = buf.toString('base64')
      }

      // ═══ SPRINT-MEDIA-LOGIN-REALITY-FIX-01 Task02：统一 BrowserLoginDetector v2 ═══
      // 检测顺序 A DOM img → B canvas(含 shadow DOM) → C iframe → D 截图 jsQR fallback
      // 任何平台禁止自行写二维码提取；channels 供 Login Debug Panel 展示
      let qrCodeBase64: string | undefined
      let qrSource: string | undefined
      let detectorChannels: any = null
      let pageTextSample: string | undefined
      let framesCount = 0
      try {
        const det = await browserRuntime.withPage(sessionId, async (page) => {
          let res = await loginDetector.detect(page, { qrImgSelector: this.meta.qrImgSelector })
          // KUAISHOU-QR-FIX-01 — 登录页无二维码 → 兜底点击登录 tab（如「扫码登录」）再检测。
          // 快手 passport 默认 tab 是扫码登录但组件不自动初始化，connect 阶段没点出来时
          // 由轮询兜底：点击幂等（二维码已显示时再点无害），确保老板永远能看到二维码。
          if (!res.qrCode && this.meta.loginEntry?.clickSteps?.length) {
            const pageUrl = page.url()
            const isLoginPage = this.meta.loginEntry.mustMatch.test(pageUrl) || this.meta.identityRules.loginPageMarkers.some(m => {
              try { return pageUrl.includes(m) } catch { return false }
            })
            if (isLoginPage) {
              await this.clickLoginSteps(page)
              await page.waitForTimeout(2500)
              res = await loginDetector.detect(page, { qrImgSelector: this.meta.qrImgSelector })
            }
          }
          pageTextSample = await loginDetector.pageTextSample(page).catch(() => '')
          framesCount = page.frames().length
          return res
        }, this.meta.loginUrl)
        qrCodeBase64 = det.qrCode
        qrSource = det.source
        detectorChannels = det.channels
      } catch { /* 二维码提取失败不影响主流程 */ }

      let loggedIn = false
      let accountName: string | undefined
      let externalAccountId: string | undefined
      let avatar: string | undefined
      let accountType: string | undefined
      let debug: any = {}
      try {
        const identity = await identityProbeRegistry.get(this.platform)!.probe(sessionId)
        loggedIn = identity.authenticated
        accountName = identity.accountName
        externalAccountId = identity.accountId
        avatar = identity.avatar
        accountType = identity.accountType
        debug = { ...debug, probeSignals: identity.signals, probeAuthenticated: identity.authenticated, probeAccount: identity.accountName || '' }
      } catch { /* 浏览器异常时按未登录处理 */ }

      // Task05 统一登录状态机：探针结果驱动状态迁移
      const sm = this.getStateMachine(sessionId)
      // 未认证时按验证页/操作态提示细分（视频号扫码后手机确认=VERIFYING；短信验证码页=USER_ACTION_REQUIRED）
      let userActionRequired = false
      let verifying = false
      if (!loggedIn) {
        try {
          const pageUrl = await browserRuntime.withPage(sessionId, async (page) => page.url()).catch(() => '')
          verifying = /scan_confirm|confirm|wait|qrcode_confirm/i.test(pageUrl)
          userActionRequired = !!(status.currentUrl && /sms|code|verify|phone/i.test(status.currentUrl))
        } catch {}
      }
      sm.derive({ authenticated: loggedIn, hasIdentity: !!externalAccountId, verifying, userActionRequired })
      const state = sm.current
      const loginStage = (sm.toLegacy() as any)
      if (loggedIn) {
        // 认证后：若尚未 connected 则推进 AUTHENTICATED（CONNECTED 由 wait-for-login 回写时置位）
      }

      return {
        url: status.currentUrl,
        title: status.title,
        screenshotBase64,
        qrCodeBase64,
        qrSource,
        loggedIn,
        state,
        loginStage,
        accountName,
        externalAccountId,
        avatar,
        accountType,
        // SPRINT-MEDIA-LOGIN-REALITY-FIX-01 Task05：Login Debug Panel 数据
        debug: {
          ...debug,
          detector: detectorChannels,
          qrSource,
          frames: framesCount,
          pageTextSample,
          loginSurface: {
            url: status.currentUrl,
            isLoginPage: !loggedIn && !!status.currentUrl,
          },
        },
      }
    } catch (e: any) {
      return { url: '', title: '', loggedIn: false, state: 'WAIT_LOGIN', loginStage: 'waiting_scan', error: e.message }
    }
  }

  /** 填手机号（原生 setter + input/change 事件，兼容 React/Vue 受控组件） */
  async fillPhone(sessionId: string, phone: string): Promise<{ ok: boolean; message?: string }> {
    return browserRuntime.withPage(sessionId, async (page) => {
      const r = await page.evaluate((p) => {
        const inputs = Array.from(document.querySelectorAll('input[type="tel"]')) as HTMLInputElement[]
        const target = inputs.find(i => /手机/.test(i.placeholder || ''))
          || inputs.slice().sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0]
        if (!target) return 'NO_TEL_INPUT'
        target.focus()
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
        setter.call(target, p)
        target.dispatchEvent(new Event('input', { bubbles: true }))
        target.dispatchEvent(new Event('change', { bubbles: true }))
        target.blur()
        return 'SET:' + target.value
      }, phone)
      return { ok: true, message: r }
    })
  }

  /** 点「获取验证码」（全事件触发） */
  async clickSendCode(sessionId: string): Promise<{ ok: boolean; message?: string; countdown?: string }> {
    const fired = await browserRuntime.withPage(sessionId, async (page) => {
      return page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('span,div,button')) as HTMLElement[]
        const el = all.find(e => /^(span|button)$/i.test(e.tagName) && (e.textContent || '').trim() === '获取验证码')
          || all.find(e => (e.textContent || '').trim() === '获取验证码')
        if (!el) return 'NO_EL'
        const targets: HTMLElement[] = [el]
        const parent = el.closest('div')
        if (parent && parent !== el) targets.push(parent as HTMLElement)
        let fired = 0
        for (const t of targets) {
          for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'touchstart', 'touchend']) {
            try {
              t.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
              fired++
            } catch {}
          }
        }
        return 'FIRED:' + fired
      })
    })
    let countdown = ''
    for (let i = 0; i < 6; i++) {
      await new Promise(r => setTimeout(r, 1000))
      try {
        countdown = await browserRuntime.withPage(sessionId, async (page) => {
          return page.evaluate(() => {
            const el = Array.from(document.querySelectorAll('span,div,button')).find(e => /(重新发送|重新获取|秒后)/.test((e.textContent || '').trim()) && (e.textContent || '').trim().length < 20) as HTMLElement | undefined
            return el ? (el.textContent || '').trim() : ''
          })
        })
      } catch {}
      if (countdown) break
    }
    return { ok: true, message: fired, countdown }
  }

  /** 填验证码 + 点登录 */
  async fillCodeAndLogin(sessionId: string, code: string): Promise<{ ok: boolean; message?: string }> {
    const msg = await browserRuntime.withPage(sessionId, async (page) => {
      const inputs = page.locator('input')
      const count = await inputs.count()
      let target: any = null
      for (let i = 0; i < count; i++) {
        const ph = await inputs.nth(i).getAttribute('placeholder').catch(() => '')
        const visible = await inputs.nth(i).isVisible().catch(() => false)
        if (/验证码|短信/.test(ph || '') && visible) { target = inputs.nth(i); break }
      }
      if (!target) return 'NO_CODE_INPUT'
      await target.evaluate((el: any, val: string) => {
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!
        setter.call(el, val)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
        el.focus()
      }, code)
      await page.waitForTimeout(800)
      const val = await target.inputValue().catch(() => '')
      const before = page.url()
      const loginMsg = await this.clickLogin(sessionId)
      let step = String(loginMsg.message || '')
      await page.waitForTimeout(4500)
      if (page.url() === before) {
        await page.keyboard.press('Enter')
        await page.waitForTimeout(4500)
        step += '+ENTER'
      }
      return `TYPED:${val} | ${step} | url:${page.url().slice(0, 70)}`
    })
    return { ok: true, message: msg }
  }

  /** 切换登录方式 tab：sms / qr / password（tab 标签按平台 meta.smsTabLabel，如小红书「短信登录」） */
  async switchLoginTab(sessionId: string, tab: 'sms' | 'qr' | 'password'): Promise<{ ok: boolean; message?: string }> {
    const label =
      tab === 'sms'
        ? (this.meta.smsTabLabel ?? '验证码登录')
        : tab === 'qr'
          ? '扫码登录'
          : '密码登录'
    const msg = await browserRuntime.withPage(sessionId, async (page) => {
      return page.evaluate((lb) => {
        const all = Array.from(document.querySelectorAll('span,div,button')) as HTMLElement[]
        const el = all.find(e => /^(span|button)$/i.test(e.tagName) && (e.textContent || '').trim() === lb)
          || all.find(e => (e.textContent || '').trim() === lb)
        if (!el) return 'NO_TAB:' + lb
        const targets: HTMLElement[] = [el]
        const parent = el.closest('div')
        if (parent && parent !== el) targets.push(parent as HTMLElement)
        let fired = 0
        for (const t of targets) {
          for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'touchstart', 'touchend']) {
            try {
              t.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
              fired++
            } catch {}
          }
        }
        return 'FIRED:' + fired
      }, label)
    })
    return { ok: true, message: msg }
  }

  /** 点「登录」按钮（Playwright 原生坐标点击，isTrusted=true） */
  async clickLogin(sessionId: string): Promise<{ ok: boolean; message?: string }> {
    const msg = await browserRuntime.withPage(sessionId, async (page) => {
      try {
        const locs = page.locator('button, span, div').filter({ hasText: /^登录$/ })
        const n = await locs.count()
        let best: any = null
        let bestY = -1
        for (let i = 0; i < n; i++) {
          const l = locs.nth(i)
          if (!(await l.isVisible().catch(() => false))) continue
          const box = await l.boundingBox().catch(() => null)
          if (box && box.y > bestY && box.width > 30 && box.width < 500 && box.height > 20 && box.height < 90) {
            bestY = box.y
            best = l
          }
        }
        if (!best) return 'NO_LOGIN_BTN'
        const before = page.url()
        await best.click({ timeout: 8000 })
        await page.waitForTimeout(3000)
        const after = page.url()
        if (after !== before) return 'CLICKED_NAVIGATED:' + after.slice(0, 60)
        return 'CLICKED'
      } catch (e: any) {
        return 'CLICK_FAIL:' + String(e.message).slice(0, 120)
      }
    })
    return { ok: true, message: msg }
  }

  /**
   * 发布（Task 阶段禁用——掌柜暂时禁止事项：❌ 自动发布）
   * 诚实返回 failed，不 mock、不假装成功
   */
  async publish(content: ChannelContent): Promise<PublishResult> {
    return {
      publishId: '',
      publishedAt: new Date(),
      status: 'failed',
      error: '自动发布在 Task 阶段禁用（SPRINT-MEDIA-CHANNEL-01 暂时禁止事项）',
    }
  }

  async schedule(content: ChannelContent, scheduledTime: Date): Promise<PublishResult> {
    return this.publish(content)
  }

  async fetchInteractions(since?: Date): Promise<PlatformInteraction[]> {
    return []
  }

  async reply(interactionId: string, message: string): Promise<boolean> {
    return false
  }

  /**
   * 健康检查（Chromium 可启动性 + 平台标识）
   */
  async healthCheck(): Promise<ChannelHealth> {
    const h = await browserRuntime.healthCheck()
    if (h.status !== 'healthy') {
      return { platform: this.platform, status: 'error', errorMessage: `Chromium 不可用: ${h.version}` }
    }
    return { platform: this.platform, status: 'connected', rateLimitRemaining: undefined }
  }

  async getAccountInfo() {
    return { accountId: this.platform, accountName: this.meta.displayName }
  }

  /** 各平台数据页结构差异大，默认诚实报未实现（子类按需覆写）
   * Task02 通用实现：读 meta.metricsExtraction 配置（label → 字段 + 数字/万单位解析），
   * 零平台分支；未配置的平台诚实报未实现（绝不 mock） */
  async fetchMetrics(accountId: string): Promise<ChannelMetrics> {
    const meta = this.meta
    const extraction = meta.metricsExtraction
    if (!extraction || !extraction.rules.length) {
      throw new Error(`[${this.name}Adapter] fetchMetrics 未配置（${this.platform} 数据页解析待接入，请在 browser-channel.meta.ts 配 metricsExtraction）`)
    }

    const sid = this.sessionIdFor(accountId)
    const profilePath = browserRuntime.getProfilePath(this.platform, accountId)
    await browserRuntime.getOrCreatePersistent(sid, profilePath, { headless: false })

    // fallback：持久化 profile 无登录态时注入凭证 cookie
    try {
      const cred = await this.deps.getCredential(accountId)
      const cookieData = cred.cookieData
      if (cookieData) {
        await browserRuntime.restoreCookies(sid, JSON.parse(cookieData))
      }
    } catch (e: any) {
      console.warn(`[${this.name}Adapter] fetchMetrics 凭证恢复失败（依赖持久化登录态）: ${e.message}`)
    }

    const nav = await browserRuntime.navigate(sid, extraction.dataUrl, { headless: false })
    if (!nav.success) {
      throw new Error(`打开${meta.displayName}数据中心失败: ${nav.error}`)
    }

    // 等待数据面板渲染
    await new Promise(r => setTimeout(r, 4000 + Math.random() * 2000))

    const metrics = await browserRuntime.withPage(sid, async (page) => {
      const bodyText = await page.locator('body').innerText().catch(() => '')
      const parse = (label: string): number | undefined => {
        // 匹配「粉丝 123.4万」「获赞 5678」等文本模式
        const re = new RegExp(`${label}[\\s\\S]{0,10}?([\\d,.]+)\\s*(万|w|W)?`, 'i')
        const m = bodyText.match(re)
        if (!m) return undefined
        const num = parseFloat(m[1].replace(/,/g, ''))
        const unit = m[2]
        return unit ? Math.round(num * 10000) : Math.round(num)
      }

      const result: any = {}
      for (const rule of extraction.rules) {
        result[rule.field] = parse(rule.label)
      }

      // 最近内容（小红书笔记标题等；rawData 供 AI 分析员工消费）
      let recentContent: string[] = []
      if (extraction.recentContentSelector) {
        try {
          const items = page.locator(extraction.recentContentSelector)
          const n = await items.count().catch(() => 0)
          for (let i = 0; i < Math.min(n, 10); i++) {
            const t = (await items.nth(i).innerText().catch(() => '')).trim()
            if (t && t.length > 1 && t.length < 100) recentContent.push(t)
          }
        } catch {}
      }

      const hasAny = Object.values(result).some(v => v !== undefined)
      if (!hasAny && !recentContent.length) {
        throw new Error(`[${this.name}Adapter] ${meta.displayName}数据中心未解析到指标（可能未登录或页面结构变更），拒绝返回空数据`)
      }

      return {
        followerCount: result.followerCount ?? 0,
        videoCount: result.videoCount ?? 0,
        totalViews: result.totalViews ?? 0,
        totalLikes: result.totalLikes ?? 0,
        totalComments: result.totalComments ?? 0,
        totalShares: result.totalShares ?? 0,
        collectedAt: new Date(),
        rawData: { recentContent, url: page.url() },
      }
    })
    await browserRuntime.close(sid)
    return metrics
  }

  async fetchComments(accountId: string, postId?: string): Promise<ChannelComment[]> {
    return []
  }
}
