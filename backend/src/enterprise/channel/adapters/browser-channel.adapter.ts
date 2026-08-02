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
import { CHANNEL_META, type BrowserChannelMeta } from './browser-channel.meta.js'
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

  protected get meta(): BrowserChannelMeta {
    return CHANNEL_META[this.platform]
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

    return {
      sessionId: sid,
      status: 'waiting_login',
      loginUrl: meta.loginUrl,
      message: `请在浏览器中扫码登录${meta.displayName}，登录成功后自动保存登录态`,
    }
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
   * 与抖音一致：串行锁由路由层保证；二维码放大逻辑复用
   */
  async getLoginStatus(sessionId: string): Promise<{
    url: string
    title: string
    screenshotBase64?: string
    qrCodeBase64?: string
    loggedIn: boolean
    loginStage?: 'waiting_scan' | 'scan_confirming' | 'verifying' | 'awaiting_confirmation' | 'connected'
    accountName?: string
    externalAccountId?: string
    avatar?: string
    verificationRequired?: boolean
    verificationType?: 'sms' | 'app' | 'face' | 'none'
    verificationTriggered?: boolean
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

      // 提取放大二维码（兼容三种形态，2026-08-02 多平台升级）：
      // 1) data:image/png 且 ~120-260px（抖音/快手）
      // 2) https URL 二维码图（视频号 iframe 内 open.weixin.qq.com/connect/qrcode/*）
      // 3) iframe 内的二维码（视频号登录页 = 主页面 + open.weixin.qq.com 二维码 iframe）
      let qrCodeBase64: string | undefined
      try {
        qrCodeBase64 = await browserRuntime.withPage(sessionId, async (page) => {
          // 跨 iframe 查二维码：主 frame + 所有子 frame（视频号二维码在 open.weixin.qq.com iframe）
          // ⚠️ 不能用 contentDocument（跨域被拒），用 page.frames() 逐个 evaluate
          const frames = [page.mainFrame(), ...page.frames().filter(f => f !== page.mainFrame())]
          let qrInfo: any = null
          let qrFrame: any = null
          for (const f of frames) {
            try {
              const info = await f.evaluate(() => {
                const imgs = Array.from(document.querySelectorAll('img'))
                const hit =
                  imgs.find((el: HTMLImageElement) => {
                    const r = el.getBoundingClientRect()
                    return (el.src || '').startsWith('data:image/png') && r.width >= 120 && r.width <= 260
                  }) ||
                  imgs.find((el: HTMLImageElement) => {
                    const r = el.getBoundingClientRect()
                    return (el.src || '').startsWith('data:image') && r.width >= 80 && r.width <= 400 && Math.abs(r.width - r.height) < 30
                  }) ||
                  // 视频号：open.weixin.qq.com/connect/qrcode/*（https 二维码图）
                  imgs.find((el: HTMLImageElement) => {
                    const r = el.getBoundingClientRect()
                    return /qrcode|qr_|qrCode/i.test(el.src || '') && r.width >= 120 && r.width <= 400 && r.height >= 120 && r.height <= 400
                  })
                if (!hit) return null
                const r = hit.getBoundingClientRect()
                return {
                  src: (hit as HTMLImageElement).src,
                  x: Math.round(r.x),
                  y: Math.round(r.y),
                  w: Math.round(r.width),
                  h: Math.round(r.height),
                }
              }).catch(() => null)
              if (info) { qrInfo = info; qrFrame = f; break }
            } catch { /* 单个 frame 失败跳过 */ }
          }
          if (!qrInfo) return undefined
          // 方式1：data:image 原图 base64
          const mimeMatch = qrInfo.src.match(/^data:image\/(png|jpeg|jpg|webp);base64,/)
          let b64 = mimeMatch ? qrInfo.src.slice(mimeMatch[0].length) : qrInfo.src
          // 方式2：https URL 二维码图 → 从所在 frame 上下文 fetch（带 referer/cookie）转 base64
          if (!mimeMatch && /^https?:\/\//.test(qrInfo.src)) {
            try {
              const fetched = await (qrFrame || page.mainFrame()).evaluate(async (src: string) => {
                try {
                  const resp = await fetch(src, { credentials: 'include' })
                  if (!resp.ok) return null
                  const buf = await resp.arrayBuffer()
                  const bytes = new Uint8Array(buf)
                  let bin = ''
                  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
                  return btoa(bin)
                } catch { return null }
              }, qrInfo.src)
              if (fetched) b64 = fetched
              else return undefined
            } catch {
              return undefined
            }
          }
          const raw = Buffer.from(b64, 'base64')
          if (raw.length > 800) {
            try {
              const { execSync } = await import('child_process')
              const fs = await import('fs')
              const os = await import('os')
              const path = await import('path')
              const tmp = path.join(os.tmpdir(), `channel-qr-${Date.now()}.png`)
              fs.writeFileSync(tmp, raw)
              const out = path.join(os.tmpdir(), `channel-qr-out-${Date.now()}.png`)
              execSync(`python3 -c "
from PIL import Image
img = Image.open('${tmp}').convert('RGB')
big = img.resize((1024,1024), Image.LANCZOS)
canvas = Image.new('RGB', (1154,1154), 'white')
canvas.paste(big, (65,65))
canvas.save('${out}')
"`)
              const outBuf = fs.readFileSync(out)
              try { fs.unlinkSync(tmp) } catch {}
              try { fs.unlinkSync(out) } catch {}
              return outBuf.toString('base64')
            } catch {
              return b64
            }
          }
          return undefined
        })
      } catch { /* 二维码提取失败不影响主流程 */ }

      let loggedIn = false
      let loginStage: 'waiting_scan' | 'scan_confirming' | 'verifying' | 'awaiting_confirmation' | 'connected' = 'waiting_scan'
      let accountName: string | undefined
      let externalAccountId: string | undefined
      let avatar: string | undefined
      let debug: any = {}
      try {
        const identity = await identityProbeRegistry.get(this.platform)!.probe(sessionId)
        loggedIn = identity.authenticated
        accountName = identity.accountName
        externalAccountId = identity.accountId
        avatar = identity.avatar
        debug = { ...debug, probeSignals: identity.signals, probeAuthenticated: identity.authenticated, probeAccount: identity.accountName || '' }
        if (identity.authenticated) {
          loginStage = 'awaiting_confirmation'
        }
      } catch { /* 浏览器异常时按未登录处理 */ }

      return {
        url: status.currentUrl,
        title: status.title,
        screenshotBase64,
        qrCodeBase64,
        loggedIn,
        loginStage,
        accountName,
        externalAccountId,
        avatar,
        debug,
      }
    } catch (e: any) {
      return { url: '', title: '', loggedIn: false, loginStage: 'waiting_scan', error: e.message }
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

  /** 各平台数据页结构差异大，默认诚实报未实现（子类按需覆写） */
  async fetchMetrics(accountId: string): Promise<ChannelMetrics> {
    throw new Error(`[${this.name}Adapter] fetchMetrics 未实现（${this.platform} 数据页解析待接入）`)
  }

  async fetchComments(accountId: string, postId?: string): Promise<ChannelComment[]> {
    return []
  }
}
