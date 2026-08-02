/**
 * DouyinBrowserAdapter — 抖音渠道浏览器自动化适配器（Channel Runtime Layer）
 * SPRINT-MEDIA-CHANNEL-01 Task03.1 — DouyinBrowserAdapter Reality Runtime
 *
 * ── 职责边界（掌柜批准约束）──
 * - 只负责浏览器执行：PlaywrightRuntime(Chromium) → 抖音创作者中心
 * - 不包含：企业权限 / AI员工逻辑 / UI逻辑 / 数据库业务逻辑
 * - 不复制旧实现：内部 wrap browserRuntime（BrowserRuntimeService，唯一 Playwright 执行层）
 *
 * ── Credential 流程（Task03.1.4，禁止 adapter 自己保存凭证）──
 *   Adapter → channelAccountId → 注入 getCredential() → AES 解密 → runtime 使用
 *   续期：浏览器取新 cookie → 注入 persistCredential() → 上层加密落库 credentialEncrypted
 *   adapter 无 DB 依赖、无明文落盘、无第二套凭证体系
 *
 * ── 未来 OAuth ──
 * 官方开放平台 OAuth 到位后只替换执行层（DouyinBrowserAdapter → DouyinOAuthAdapter），
 * EnterpriseChannelAdapter v1.0 接口不变。
 */
import { browserRuntime } from '../../../services/media/browser-runtime.service.js'
import type { CookieData } from '../../../services/media/browser-runtime.service.js'
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

/** 抖音创作者中心 */
const CREATOR_CENTER_URL = 'https://creator.douyin.com/'
/** 数据概览页 */
const DATA_OVERVIEW_URL = 'https://creator.douyin.com/creator-micro/data/overview'

/**
 * Credential 依赖注入（由 EnterpriseChannelService 提供）
 * - getCredential: 解密读取 credentialEncrypted（唯一凭证源）
 * - persistCredential: 加密写回 credentialEncrypted（续期流程）
 */
export interface DouyinAdapterDeps {
  getCredential: (accountId: string) => Promise<Record<string, string>>
  persistCredential: (accountId: string, credential: Record<string, string>) => Promise<void>
}

export class DouyinBrowserAdapter implements EnterpriseChannelAdapter {
  readonly platform = 'douyin'
  readonly name = '抖音'

  constructor(private readonly deps: DouyinAdapterDeps) {}

  private sessionIdFor(accountId: string): string {
    return `douyin:${accountId}`
  }

  /**
   * [v1.0] 连接渠道账号（TASK03.1.5 持久化 profile 主路径）
   * - 主路径：launchPersistentContext(profilePath) — 真实 Chrome profile，登录一次长期有效
   * - fallback：已有凭证（cookieData）→ restoreCookies 注入（兼容旧登录态/跨机迁移）
   * - 无凭证/登录态失效：打开登录页等待扫码（waiting_login）
   */
  async connect(accountId?: string): Promise<ConnectResult> {
    const sid = this.sessionIdFor(accountId ?? 'new')

    // TASK03.1.5 — 持久化 profile 路径（账号身份 → 独立浏览器环境）
    const profilePath = browserRuntime.getProfilePath('douyin', accountId ?? 'new')

    // 主路径：持久化浏览器（同一 profile 已存在实例则复用，保留登录态）
    await browserRuntime.getOrCreatePersistent(sid, profilePath, { headless: false })

    // fallback：持久化 profile 无登录态时，尝试用已有凭证注入 cookie（旧登录态/跨机迁移）
    if (accountId) {
      try {
        const cred = await this.deps.getCredential(accountId)
        const cookieData = cred.cookieData
        if (cookieData) {
          const cookies: CookieData[] = JSON.parse(cookieData)
          await browserRuntime.restoreCookies(sid, cookies)
        }
      } catch (e: any) {
        console.warn(`[DouyinBrowserAdapter] 凭证恢复失败（继续打开登录页）: ${e.message}`)
      }
    }

    const nav = await browserRuntime.navigate(sid, CREATOR_CENTER_URL, { headless: false })
    if (!nav.success) {
      console.warn(`[DouyinBrowserAdapter] 浏览器启动/导航失败: ${nav.error}`)
      return {
        sessionId: sid,
        status: 'waiting_login',
        loginUrl: CREATOR_CENTER_URL,
        message: `登录浏览器启动失败，请稍后重试（${nav.error}）`,
      }
    }

    // 检测登录态
    let loggedIn = false
    try {
      loggedIn = await this.detectLoggedIn(sid)
    } catch (e: any) {
      // 浏览器异常（反爬关闭）→ 降级为等待登录，由 waitForLogin 恢复
      console.warn(`[DouyinBrowserAdapter] connect 阶段登录态检测异常: ${e.message}`)
    }
    if (loggedIn) {
      return { sessionId: sid, status: 'connected', accountName: '抖音创作者中心' }
    }

    return {
      sessionId: sid,
      status: 'waiting_login',
      loginUrl: CREATOR_CENTER_URL,
      message: '请在浏览器中扫码登录抖音创作者中心，登录成功后调用 refresh-credential 保存登录态',
    }
  }
  /**
   * [v1.0] 等待扫码登录完成（SPRINT-MEDIA-CHANNEL-01 Task03.2 Phase A）
   * 不刷新页面（避免打断扫码）；登录成功后由上层 refresh-credential 保存登录态
   */
  async waitForLogin(accountId: string, timeoutMs = 300000): Promise<ConnectResult> {
    const sid = this.sessionIdFor(accountId)
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      let loggedIn = false
      try {
        loggedIn = await this.detectLoggedIn(sid)
      } catch (e: any) {
        // 浏览器被反爬/异常关闭 → 重新 navigate 恢复（新二维码），不中断轮询
        console.warn(`[DouyinBrowserAdapter] 浏览器异常（${e.message}），重新打开登录页...`)
        try {
          const nav = await browserRuntime.navigate(sid, CREATOR_CENTER_URL, { headless: false })
          if (!nav.success) {
            await new Promise(r => setTimeout(r, 5000))
            continue
          }
        } catch (navErr: any) {
          console.warn(`[DouyinBrowserAdapter] 恢复失败: ${navErr.message}`)
          await new Promise(r => setTimeout(r, 5000))
          continue
        }
      }
      if (loggedIn) {
        return { sessionId: sid, status: 'connected', accountName: '抖音创作者中心' }
      }
      await new Promise(r => setTimeout(r, 8000))
    }
    return {
      sessionId: sid,
      status: 'waiting_login',
      loginUrl: CREATOR_CENTER_URL,
      message: '扫码超时，请重新连接',
    }
  }

  /**
   * [v1.0] 刷新凭证（浏览器取新 cookie → persistCredential 加密落库）
   * 必须由上层在登录完成后调用；adapter 不保存任何凭证
   */
  async refreshCredential(accountId: string): Promise<{ ok: boolean; error?: string }> {
    const sid = this.sessionIdFor(accountId)
    let cookies: CookieData[]
    try {
      cookies = await browserRuntime.getCookies(sid)
    } catch (e: any) {
      return { ok: false, error: `浏览器会话不存在: ${e.message}` }
    }
    if (!cookies || cookies.length === 0) {
      return { ok: false, error: '浏览器无 cookie（可能未完成登录）' }
    }
    // 交上层加密落库（Credential Layer 唯一载体 = EnterpriseChannelAccount.credentialEncrypted）
    await this.deps.persistCredential(accountId, { cookieData: JSON.stringify(cookies) })
    return { ok: true }
  }

  /**
   * ── 浏览器登录交互（Task03.2 Phase A+：工作台可测扫码/短信登录）──
   * 选择器用属性/文本定位（抖音 class 动态）；事件用原生 setter + 全事件触发
   */

  /** 登录页截图 + 状态（前端轮询） */
  async getLoginStatus(sessionId: string): Promise<{
    url: string
    title: string
    screenshotBase64?: string
    loggedIn: boolean
    error?: string
    debug?: any
  }> {
    try {
      const status = await browserRuntime.getStatus(sessionId)
      let screenshotBase64: string | undefined
      if (status.screenshot) {
        const buf = await import('fs').then(fs => fs.promises.readFile(status.screenshot!))
        screenshotBase64 = buf.toString('base64')
      }
      let loggedIn = false
      try {
        loggedIn = await this.detectLoggedIn(sessionId)
      } catch { /* 浏览器异常时按未登录处理 */ }
      // debug：输入框状态（排查填充问题）
      let debug: any = null
      try {
        debug = await browserRuntime.withPage(sessionId, async (page) => {
          return page.evaluate(() => {
            const tel = Array.from(document.querySelectorAll('input[type="tel"]')) as HTMLInputElement[]
            const telVals = tel.map(i => ({ w: Math.round(i.getBoundingClientRect().width), v: i.value }))
            const codeInput = (Array.from(document.querySelectorAll('input')) as HTMLInputElement[]).find((i: HTMLInputElement) => /验证码|短信/.test(i.placeholder || '') && i.offsetParent !== null)
            return {
              telVals,
              codeVal: codeInput ? codeInput.value : null,
              hasGetCode: Array.from(document.querySelectorAll('span,div,button')).some(e => (e.textContent || '').trim() === '获取验证码'),
              bodyText: (document.body ? document.body.innerText : '').replace(/\n+/g, ' | ').slice(0, 800),
            }
          })
        })
      } catch {}
      return { url: status.currentUrl, title: status.title, screenshotBase64, loggedIn, debug }
    } catch (e: any) {
      return { url: '', title: '', loggedIn: false, error: e.message }
    }
  }

  /** 填手机号（原生 setter + input/change 事件，兼容 React 受控组件） */
  async fillPhone(sessionId: string, phone: string): Promise<{ ok: boolean; message?: string }> {
    return browserRuntime.withPage(sessionId, async (page) => {
      const r = await page.evaluate((p) => {
        // 手机号框：优先 placeholder 含「手机」，否则取最靠上的 tel 输入框（验证码框也是 tel 类型）
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

  /** 点「获取验证码」（全事件触发：pointerdown/mousedown/.../click + touch） */
  async clickSendCode(sessionId: string): Promise<{ ok: boolean; message?: string; countdown?: string }> {
    const fired = await browserRuntime.withPage(sessionId, async (page) => {
      return page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('span,div,button')) as HTMLElement[]
        // 优先 span/button（最小可点击元素），fallback 任意
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
    // 等倒计时出现（短信发出）
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

  /** 填验证码 + 点登录（真实键盘输入 isTrusted=true + 坐标点击 + Enter 兜底 + URL 轮询） */
  async fillCodeAndLogin(sessionId: string, code: string): Promise<{ ok: boolean; message?: string }> {
    const msg = await browserRuntime.withPage(sessionId, async (page) => {
      // 1. 定位验证码框（placeholder 含「验证码/短信」，可见）
      const inputs = page.locator('input')
      const count = await inputs.count()
      let target: any = null
      for (let i = 0; i < count; i++) {
        const ph = await inputs.nth(i).getAttribute('placeholder').catch(() => '')
        const visible = await inputs.nth(i).isVisible().catch(() => false)
        if (/验证码|短信/.test(ph || '') && visible) { target = inputs.nth(i); break }
      }
      if (!target) return 'NO_CODE_INPUT'
      // 2. React/Vue 受控组件官方模拟输入：native setter + input/change 事件（不依赖焦点，100% 触发 onChange）+ focus 保险
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
      // 3. 登录：坐标点击；URL 未变则 Enter 提交；监听网络请求 + 响应 body 定位提交结果
      const responses: string[] = []
      const respPromises: Promise<void>[] = []
      const onResp = (r: any) => {
        const u = String(r.url() || '')
        if (/sms|verify|login|passport|check|code|phone|captcha/i.test(u)) {
          const p = r
            .text()
            .then((t: string) => {
              const snippet = String(t).slice(0, 250).replace(/\s+/g, ' ')
              responses.push(`${r.status()} ${u.split('?')[0].slice(-55)} | ${snippet}`)
            })
            .catch(() => {})
          respPromises.push(p)
        }
      }
      page.on('response', onResp)
      const before = page.url()
      const loginMsg = await this.clickLogin(sessionId)
      let step = String(loginMsg.message || '')
      await page.waitForTimeout(4500)
      if (page.url() === before) {
        await page.keyboard.press('Enter')
        await page.waitForTimeout(4500)
        step += '+ENTER'
      }
      page.off('response', onResp)
      await Promise.allSettled(respPromises)
      return `TYPED:${val} | ${step} | resp:[${responses.slice(0, 4).join(' || ')}] | url:${page.url().slice(0, 70)}`
    })
    return { ok: true, message: msg }
  }

  /** 切换登录方式 tab：sms / qr / password */
  async switchLoginTab(sessionId: string, tab: 'sms' | 'qr' | 'password'): Promise<{ ok: boolean; message?: string }> {
    const label = tab === 'sms' ? '验证码登录' : tab === 'qr' ? '扫码登录' : '密码登录'
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

  /** 点「登录」按钮（Playwright 原生坐标点击，isTrusted=true；选最后一个可见「登录」= 表单提交按钮） */
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
        // 点击后等 3s，确认页面是否开始跳转（登录提交成功）
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
   * [v1.0] 读取账号真实核心指标（粉丝/作品/获赞等，禁止 mock）
   * TASK03.1.5：优先持久化 profile（保留登录态），凭证 cookie 仅作 fallback
   */
  async fetchMetrics(accountId: string): Promise<ChannelMetrics> {
    const sid = this.sessionIdFor(accountId)
    const profilePath = browserRuntime.getProfilePath('douyin', accountId)
    await browserRuntime.getOrCreatePersistent(sid, profilePath, { headless: false })

    // fallback：持久化 profile 无登录态时注入凭证 cookie
    try {
      const cred = await this.deps.getCredential(accountId)
      const cookieData = cred.cookieData
      if (cookieData) {
        await browserRuntime.restoreCookies(sid, JSON.parse(cookieData))
      }
    } catch (e: any) {
      console.warn(`[DouyinBrowserAdapter] fetchMetrics 凭证恢复失败（依赖持久化登录态）: ${e.message}`)
    }

    const nav = await browserRuntime.navigate(sid, DATA_OVERVIEW_URL, { headless: false })
    if (!nav.success) {
      throw new Error(`打开抖音数据概览失败: ${nav.error}`)
    }

    // 等待数据面板渲染
    await new Promise(r => setTimeout(r, 4000 + Math.random() * 2000))

    // 抓取核心指标（候选选择器 + 文本正则兜底，失败明确报错不 mock）
    const metrics = await this.extractMetrics(sid)
    await browserRuntime.close(sid)
    return metrics
  }

  /**
   * [v1.0] 拉取评论列表（尽力而为；Task 阶段禁止自动发布/回复，仅读取）
   * TASK03.1.5：优先持久化 profile，凭证 cookie 仅作 fallback
   */
  async fetchComments(accountId: string, postId?: string): Promise<ChannelComment[]> {
    const sid = this.sessionIdFor(accountId)
    const profilePath = browserRuntime.getProfilePath('douyin', accountId)
    await browserRuntime.getOrCreatePersistent(sid, profilePath, { headless: false })

    try {
      const cred = await this.deps.getCredential(accountId)
      const cookieData = cred.cookieData
      if (cookieData) {
        await browserRuntime.restoreCookies(sid, JSON.parse(cookieData))
      }
    } catch (e: any) {
      console.warn(`[DouyinBrowserAdapter] fetchComments 凭证恢复失败（依赖持久化登录态）: ${e.message}`)
    }

    const url = postId
      ? `https://creator.douyin.com/creator-micro/content/manage?filter=2&aid=${postId}`
      : 'https://creator.douyin.com/creator-micro/content/manage'
    await browserRuntime.navigate(sid, url, { headless: false })
    await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000))

    const comments: ChannelComment[] = []
    try {
      await browserRuntime.withPage(sid, async (page) => {
        const items = await page.locator('[class*="comment"]').count()
        for (let i = 0; i < Math.min(items, 20); i++) {
          const el = page.locator('[class*="comment"]').nth(i)
          const text = (await el.innerText().catch(() => '')).trim()
          if (text) {
            comments.push({
              commentId: `dy_${Date.now()}_${i}`,
              authorName: '抖音用户',
              content: text.slice(0, 200),
              createdAt: new Date(),
            })
          }
        }
      })
    } catch (e: any) {
      console.warn(`[DouyinBrowserAdapter] 评论抓取受限: ${e.message}`)
    }
    await browserRuntime.close(sid)
    return comments
  }

  /**
   * 发布（Task 03 阶段禁用——掌柜暂时禁止事项：❌ 自动发布）
   * 诚实返回 failed，不 mock、不假装成功
   */
  async publish(content: ChannelContent): Promise<PublishResult> {
    return {
      publishId: '',
      publishedAt: new Date(),
      status: 'failed',
      error: '自动发布在 Task 03 阶段禁用（SPRINT-MEDIA-CHANNEL-01 暂时禁止事项）',
    }
  }

  async schedule(content: ChannelContent, scheduledTime: Date): Promise<PublishResult> {
    return this.publish(content)
  }

  async fetchInteractions(since?: Date): Promise<PlatformInteraction[]> {
    // Task 阶段只读核心指标，互动流后续 Task 接入
    return []
  }

  async reply(interactionId: string, message: string): Promise<boolean> {
    // 禁止自动回复（与 publish 同属暂时禁止事项）
    return false
  }

  /**
   * 健康检查（Chromium 可启动性 + 平台标识）
   */
  async healthCheck(): Promise<ChannelHealth> {
    const h = await browserRuntime.healthCheck()
    if (h.status !== 'healthy') {
      return { platform: 'douyin', status: 'error', errorMessage: `Chromium 不可用: ${h.version}` }
    }
    return { platform: 'douyin', status: 'connected', rateLimitRemaining: undefined }
  }

  async getAccountInfo() {
    return { accountId: 'douyin', accountName: '抖音创作者中心' }
  }

  // ─── 内部：登录态检测 ───

  private async detectLoggedIn(sessionId: string): Promise<boolean> {
    try {
      return await browserRuntime.withPage(sessionId, async (page) => {
        await page.waitForTimeout(3000 + Math.random() * 2000)
        const url = page.url()
        const bodyText = await page.locator('body').innerText().catch(() => '')
        // 1. 明确的登录页特征（优先级最高）— 登录页营销文案可能含「数据」等宽泛词，必须先排除
        const explicitLoginMarkers = ['扫码登录', '扫一扫', '验证码登录', '密码登录', '登录即代表同意', '我是创作者', '我是MCN机构']
        const hasExplicitLogin = explicitLoginMarkers.some(m => bodyText.includes(m))
        if (hasExplicitLogin) return false
        // 2. 登录页 URL 特征
        if (/passport|login|qr|sso/i.test(url)) return false
        // 3. 工作台特征（组合判定：至少命中 2 个才认为已登录）
        const workbenchMarkers = ['内容管理', '发布作品', '创作灵感', '作品管理', '数据概览', '创作者服务', '我的主页']
        const hit = workbenchMarkers.filter(m => bodyText.includes(m)).length
        return hit >= 2
      })
    } catch (e: any) {
      // 浏览器已关闭/目标页销毁 → 上抛，由 waitForLogin/connect 恢复浏览器（抖音反爬可能杀页面）
      if (/closed|Target page|crash/i.test(e.message)) throw e
      console.warn(`[DouyinBrowserAdapter] 登录态检测失败: ${e.message}`)
      return false
    }
  }

  // ─── 内部：指标抓取（容错，不 mock）───

  private async extractMetrics(sessionId: string): Promise<ChannelMetrics> {
    return browserRuntime.withPage(sessionId, async (page) => {
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

      const followerCount = parse('粉丝')
      const likeCount = parse('获赞')
      const workCount = parse('作品')

      if (followerCount === undefined && likeCount === undefined && workCount === undefined) {
        throw new Error(
          `未能从抖音数据概览解析核心指标（可能未登录或页面结构变化）。页面片段: ${bodyText.slice(0, 120).replace(/\n/g, ' ')}`,
        )
      }

      return {
        followerCount: followerCount ?? 0,
        videoCount: workCount ?? 0,
        totalViews: 0,
        totalLikes: likeCount ?? 0,
        totalComments: 0,
        totalShares: 0,
        collectedAt: new Date(),
        rawData: { source: 'creator-center', pageUrl: page.url() },
      }
    })
  }
}
