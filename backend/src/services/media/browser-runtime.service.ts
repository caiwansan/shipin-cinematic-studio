/**
 * Browser Runtime Service — BETA-06.6 Phase 3.1
 * 
 * 职责：管理 Playwright 浏览器实例
 * - 启动/关闭浏览器
 * - 页面导航
 * - Cookie 持久化
 * - Session 保存/读取
 * 
 * 这不是 AI。只是执行浏览器操作。
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright'
import path from 'path'
import fs from 'fs'

const CHROME_PATH = '/usr/bin/google-chrome'
const SESSION_DIR = path.resolve('/tmp/browser-sessions')
/** TASK03.1.5 — 持久化浏览器 profile 根目录（每渠道账号独立 user-data-dir） */
const PROFILE_ROOT = process.env.BROWSER_PROFILE_ROOT || path.resolve('/data/browser-profiles')

// 确保 session 目录存在
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true })
}
// 确保 profile 根目录存在
if (!fs.existsSync(PROFILE_ROOT)) {
  fs.mkdirSync(PROFILE_ROOT, { recursive: true })
}

export interface BrowserConfig {
  headless?: boolean
  slowMo?: number  // 模拟人工操作（毫秒）
  userAgent?: string
  viewport?: { width: number; height: number }
}

export interface NavigationResult {
  success: boolean
  url: string
  title: string
  screenshot?: string
  error?: string
}

export interface CookieData {
  name: string
  value: string
  domain: string
  path: string
  expires?: number
  httpOnly?: boolean
  secure?: boolean
}

/** TASK03.1.5 — 浏览器实例描述（persistent = 持久化 profile 主路径；临时 = cookie 注入 fallback） */
export interface BrowserInstance {
  browser?: Browser
  context: BrowserContext
  page?: Page
  headless: boolean
  persistent: boolean
  profilePath?: string
  /** TASK03.2 — 最近一次成功导航的 URL（页面被风控杀死后恢复用） */
  lastUrl?: string
  /** 调试端口（BROWSER_CDP_PORT 开启时按实例分配，避免多实例抢同一端口） */
  debugPort?: number
}

class BrowserRuntimeService {
  private instances = new Map<string, BrowserInstance>()

  /**
   * KUAISHOU-QR-FIX-01 — per-session 串行锁：status 轮询 / wait-for-login 探针 / 二维码 detect
   * 并发操作同一浏览器时互相踩（扫码确认窗口期被导航/点击打断 → 确认丢失 → 三平台扫码成功不登录）。
   * withPage / navigate / getCookies 等浏览器操作全部过锁，同一 session 的操作严格串行。
   */
  private locks = new Map<string, Promise<any>>()

  private withSessionLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(sessionId) || Promise.resolve()
    const run = prev.then(fn, fn)
    // 链上挂 catch 防止前序失败污染后续（失败也继续放行下一个）
    this.locks.set(sessionId, run.then(() => undefined, () => undefined))
    // 清理：全部完成后的下一个微任务移除（避免 Map 无限增长）
    run.then(() => undefined, () => undefined).then(() => {
      if (this.locks.get(sessionId) === run) this.locks.delete(sessionId)
    })
    return run
  }

  /**
   * 按 sessionId 稳定分配调试端口（18800 + hash%100），多渠道账号共存不抢端口。
   * 仅当 BROWSER_CDP_PORT 设置（诊断模式）时启用 remote-debugging-port。
   */
  private debugPortFor(sessionId: string): number | null {
    if (!process.env.BROWSER_CDP_PORT) return null
    let h = 0
    for (let i = 0; i < sessionId.length; i++) h = (h * 31 + sessionId.charCodeAt(i)) >>> 0
    return 18800 + (h % 100)
  }

  /**
   * SPRINT-MEDIA-BROWSER-WORKSPACE-01 Task 02 — Workspace 生命周期管理
   * 语义化方法：createWorkspace/startWorkspace/stopWorkspace/restartWorkspace/healthCheckWorkspace/destroyWorkspace
   * 底层复用现有 launchPersistentContext（launchPersistentContext 是唯一主路径，禁止 launch()+addCookies 作主流程）
   */

  /** 创建 workspace（确保 profile 目录就绪，READY 状态由上层 SSOT 记录） */
  async createWorkspace(sessionId: string, profilePath: string, config: BrowserConfig = {}): Promise<void> {
    if (!fs.existsSync(profilePath)) {
      fs.mkdirSync(profilePath, { recursive: true })
    }
    // 预启动验证 Chromium 可执行（不常驻，避免占用 profile 锁）
    const h = await this.healthCheck()
    if (h.status !== 'healthy') throw new Error(`Chromium 不可用: ${h.version}`)
    console.log(`[BrowserWorkspace] createWorkspace ${sessionId} profile=${profilePath}`)
  }

  /** 启动 workspace（拉起持久化浏览器实例，保留登录态） */
  async startWorkspace(sessionId: string, profilePath: string, config: BrowserConfig = {}): Promise<void> {
    await this.getOrCreatePersistent(sessionId, profilePath, config)
    console.log(`[BrowserWorkspace] startWorkspace ${sessionId}`)
  }

  /** 停止 workspace（关闭浏览器，profile 保留） */
  async stopWorkspace(sessionId: string): Promise<void> {
    await this.close(sessionId)
    console.log(`[BrowserWorkspace] stopWorkspace ${sessionId}`)
  }

  /** 重启 workspace */
  async restartWorkspace(sessionId: string, profilePath: string, config: BrowserConfig = {}): Promise<void> {
    await this.close(sessionId)
    await this.getOrCreatePersistent(sessionId, profilePath, config)
    console.log(`[BrowserWorkspace] restartWorkspace ${sessionId}`)
  }

  /** workspace 健康检查（实例存活 + 页面可用） */
  async healthCheckWorkspace(sessionId: string): Promise<{ ok: boolean; running: boolean; profilePath?: string; detail?: string }> {
    const inst = this.instances.get(sessionId)
    if (!inst) return { ok: false, running: false, detail: 'BROWSER_NOT_RUNNING' }
    try {
      const pageOk = !!(inst.page && !inst.page.isClosed())
      return { ok: pageOk, running: true, profilePath: inst.profilePath, detail: pageOk ? 'page_ok' : 'page_closed' }
    } catch (e: any) {
      return { ok: false, running: true, detail: e.message }
    }
  }

  /** 销毁 workspace（关闭浏览器；profile 目录由上层决定是否删除） */
  async destroyWorkspace(sessionId: string, profilePath?: string, deleteProfile = false): Promise<void> {
    await this.close(sessionId)
    if (deleteProfile && profilePath) {
      try {
        fs.rmSync(profilePath, { recursive: true, force: true })
        console.log(`[BrowserWorkspace] destroyWorkspace ${sessionId} profile 已删除`)
      } catch (e: any) {
        console.warn(`[BrowserWorkspace] destroyWorkspace 删除 profile 失败: ${e.message}`)
      }
    }
  }

  /**
   * TASK03.1.5 — 计算渠道账号的持久化 profile 路径
   * 目录结构：<PROFILE_ROOT>/<platform>/<accountId>（账号身份与运行环境分离）
   * 例：/data/browser-profiles/douyin/08a0f643-...
   */
  getProfilePath(platform: string, accountId: string): string {
    const safeId = String(accountId || 'new').replace(/[^a-zA-Z0-9_-]/g, '_')
    return path.join(PROFILE_ROOT, platform, safeId)
  }

  /** 当前实例是否持久化模式 */
  isPersistent(sessionId: string): boolean {
    return this.instances.get(sessionId)?.persistent ?? false
  }

  /**
   * 启动浏览器实例（临时模式 — fallback）
   */
  async launch(sessionId: string, config: BrowserConfig = {}): Promise<void> {
    // 如果已存在，先关闭
    if (this.instances.has(sessionId)) {
      await this.close(sessionId)
    }

    const browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: config.headless ?? true,
      slowMo: config.slowMo ?? 0,
      ignoreDefaultArgs: ['--enable-automation'],
      // BROWSER_CDP_PORT 环境变量控制调试端口（仅诊断时开启）；按实例分配避免多账号抢端口
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--no-first-run',
        '--no-default-browser-check',
        ...(process.env.BROWSER_CDP_PORT ? [`--remote-debugging-port=${this.debugPortFor(sessionId)}`] : []),
      ],
    })

    const context = await browser.newContext({
      userAgent: config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: config.viewport || { width: 1280, height: 800 },
    })

    this.instances.set(sessionId, { browser, context, page: undefined, headless: config.headless ?? true, persistent: false, debugPort: this.debugPortFor(sessionId) ?? undefined })
  }

  /**
   * TASK03.1.5 — 启动持久化浏览器实例（主路径）
   * launchPersistentContext(userDataDir)：真实 Chrome profile，登录一次长期有效
   * 同一 profile 目录不可被两个实例同时打开（Chromium 自身锁保证同账号串行）
   */
  async launchPersistent(sessionId: string, profilePath: string, config: BrowserConfig = {}): Promise<void> {
    // 如果已存在，先关闭
    if (this.instances.has(sessionId)) {
      await this.close(sessionId)
    }
    // 确保 profile 目录存在（launchPersistentContext 会自动创建，这里显式保证权限）
    if (!fs.existsSync(profilePath)) {
      fs.mkdirSync(profilePath, { recursive: true })
    }

    try {
      await this.doLaunchPersistent(sessionId, profilePath, config)
    } catch (e: any) {
      // SPRINT-MEDIA-LOGIN-REALITY-FIX-01 — 孤儿实例自愈：
      // profile 被残留 Chromium 占用（api-server 重启 Map 丢失 / 前端未关弹窗 / 崩溃残留）→
      // 清理占用进程 + 锁文件后重试一次，禁止直接把 400 抛给用户
      if (/existing browser session|already in use|profile/i.test(e.message || '')) {
        console.warn(`[BrowserRuntime] profile 被占用（孤儿实例）→ 自愈清理: ${String(e.message).slice(0, 140)}`)
        this.killOrphanChrome(profilePath)
        await this.doLaunchPersistent(sessionId, profilePath, config)
      } else {
        throw e
      }
    }
  }

  /**
   * LOGIN-REALITY-FIX-01 — 杀掉占用指定 profile 的残留 Chromium 进程 + 清理锁文件
   * 只杀 cmdline 精确包含该 profilePath 的进程，绝不误伤其他账号浏览器
   */
  private killOrphanChrome(profilePath: string): void {
    try {
      const { execSync } = require('node:child_process') as typeof import('node:child_process')
      const out = execSync(`ps -eo pid,args | grep -F "${profilePath}" | grep -v grep`, { encoding: 'utf8' })
      const pids = out.split('\n').map(l => l.trim().split(/\s+/)[0]).filter(Boolean)
      for (const pid of pids) {
        try { execSync(`kill -9 ${pid}`) } catch {}
      }
      for (const f of ['SingletonLock', 'SingletonSocket', 'SingletonCookie', 'Singleton']) {
        try { fs.rmSync(path.join(profilePath, f), { force: true }) } catch {}
      }
      console.warn(`[BrowserRuntime] 已清理孤儿实例 ${pids.length} 个（${profilePath}）+ 锁文件`)
    } catch (e: any) {
      console.warn(`[BrowserRuntime] 孤儿实例清理失败: ${e.message}`)
    }
  }

  /** 实际启动持久化浏览器（launchPersistent 的重试单元） */
  private async doLaunchPersistent(sessionId: string, profilePath: string, config: BrowserConfig = {}): Promise<void> {
    const context = await chromium.launchPersistentContext(profilePath, {
      executablePath: CHROME_PATH,
      headless: config.headless ?? true,
      slowMo: config.slowMo ?? 0,
      viewport: config.viewport || { width: 1280, height: 800 },
      userAgent: config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      // Channel Browser Identity Layer — Browser Context 固定（不随机）：
      // timezone/locale/language 固化，与 UA（zh-CN）一致，避免平台识别为异常环境信号
      timezoneId: 'Asia/Shanghai',
      locale: 'zh-CN',
      // TASK03.2 反风控：隐藏自动化特征（抖音身份验证层会检测 webdriver/自动化标志并杀页面）
      ignoreDefaultArgs: ['--enable-automation'],
      // SPRINT-MEDIA-LOGIN-REALITY-FIX-01：BROWSER_CDP_PORT 环境变量控制调试端口
      // （仅诊断时开启：外部 playwright connectOverCDP 可监听登录轮询 XHR / cookie 写入）
      // 2026-08-03：改为按实例分配端口（debugPortFor），多个渠道账号浏览器共存不抢 18801
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--no-first-run',
        '--no-default-browser-check',
        ...(process.env.BROWSER_CDP_PORT ? [`--remote-debugging-port=${this.debugPortFor(sessionId)}`] : []),
      ],
    })

    // 反自动化：抹掉 navigator.webdriver 等指纹
    await context.addInitScript(() => {
      try {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
      } catch {}
      try {
        Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh'] })
      } catch {}
      try {
        Object.defineProperty(navigator, 'language', { get: () => 'zh-CN' })
      } catch {}
      try {
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })
      } catch {}
      try {
        // @ts-ignore
        window.chrome = { runtime: {} }
      } catch {}
      // Channel Browser Identity Layer — 固定环境指纹：时区/语言与 UA 一致（Asia/Shanghai + zh-CN）
      try {
        Object.defineProperty(Intl.DateTimeFormat.prototype, 'resolvedOptions', {
          value: function (this: any) {
            const orig = Intl.DateTimeFormat.prototype.resolvedOptions
            const res = orig.call(this)
            res.timeZone = 'Asia/Shanghai'
            return res
          },
        })
      } catch {}
      try {
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 })
      } catch {}
      try {
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 })
      } catch {}
    })

    this.instances.set(sessionId, { context, page: undefined, headless: config.headless ?? true, persistent: true, profilePath, debugPort: this.debugPortFor(sessionId) ?? undefined })
  }

  /**
   * 获取或创建浏览器实例（临时模式；模式不匹配时按请求模式重启）
   */
  async getOrCreate(sessionId: string, config: BrowserConfig = {}): Promise<BrowserInstance> {
    let instance = this.instances.get(sessionId)
    if (instance && config.headless !== undefined) {
      // 仅当调用方显式指定 headless 模式且与现有实例不一致时重启（避免误杀现有浏览器）
      if (config.headless !== instance.headless) {
        await this.close(sessionId)
        instance = undefined
      }
    }
    if (!instance) {
      await this.launch(sessionId, config)
      instance = this.instances.get(sessionId)!
    }
    return instance
  }

  /**
   * TASK03.1.5 — 获取或创建持久化实例（主路径）
   * 复用规则：同 sessionId 已存在且同为 persistent 同 profile → 直接复用（保留登录态与页面）
   * LOGIN-REALITY-FIX-01 — 复用前存活探测：浏览器被外部 kill（孤儿清理/手动杀进程）后
   *   Map 引用已死，必须 close 重建，否则 navigate 炸 Target closed
   */
  async getOrCreatePersistent(sessionId: string, profilePath: string, config: BrowserConfig = {}): Promise<BrowserInstance> {
    let instance = this.instances.get(sessionId)
    if (instance) {
      const alive = await this.isAlive(instance)
      const sameProfile = instance.persistent && instance.profilePath === profilePath
      const headlessOk = config.headless === undefined || config.headless === instance.headless
      if (alive && sameProfile && headlessOk) {
        return instance
      }
      // 浏览器已死 / 模式或 profile 变化 → 重启
      if (!alive) console.warn(`[BrowserRuntime] 复用检测到实例已死（${sessionId}）→ 重建`)
      await this.close(sessionId)
      instance = undefined
    }
    if (!instance) {
      await this.launchPersistent(sessionId, profilePath, config)
      instance = this.instances.get(sessionId)!
    }
    return instance
  }

  /** LOGIN-REALITY-FIX-01 — 实例存活探测（不抛异常） */
  private async isAlive(instance: BrowserInstance): Promise<boolean> {
    try {
      if (instance.persistent) {
        // persistent 模式只持有 context：浏览器死后 pages() 抛 Target closed
        const pages = instance.context.pages()
        void pages
        return true
      }
      return !!instance.browser?.isConnected()
    } catch {
      return false
    }
  }

  /**
   * 创建新页面并导航（保持页面打开）
   * KUAISHOU-QR-FIX-01 — 串行锁包装：与 withPage/getCookies 同 session 互斥，防扫码确认窗口期被并发导航打断
   */
  async navigate(sessionId: string, url: string, config: BrowserConfig = {}): Promise<NavigationResult> {
    return this.withSessionLock(sessionId, () => this.navigateInner(sessionId, url, config))
  }

  private async navigateInner(sessionId: string, url: string, config: BrowserConfig = {}): Promise<NavigationResult> {
    try {
      // SPRINT-MEDIA-BROWSER-WORKSPACE-01 Task 02 — navigate 感知持久化实例：
      // 已存在 persistent 实例时直接复用（不得用 getOrCreate 把持久化浏览器重启成临时模式）
      const existing = this.instances.get(sessionId)
      let instance: BrowserInstance
      if (existing?.persistent) {
        instance = existing
      } else {
        instance = await this.getOrCreate(sessionId, config)
      }
      
      // XHS-LOGIN-FIX-2026-08-03 — 复用存活页面导航，禁止 close+newPage：
      // 每次 navigate 重建页面会杀掉登录页上的二维码轮询 JS，扫码确认结果直接丢失
      // （掌柜实测：扫码确认后 web_session 未更新、creator 401，登录永不生效）。
      // 策略：存活且非 about:blank → 直接 goto 复用；SPA about:blank 中间态等 1.5s；真死页才重建。
      let page = instance.page && !instance.page.isClosed() ? instance.page : null
      if (page && page.url() === 'about:blank') {
        try {
          await page.waitForLoadState('domcontentloaded', { timeout: 1500 }).catch(() => {})
          await page.waitForTimeout(1500)
        } catch {}
        if (page.url() === 'about:blank') page = null
      }
      if (!page) {
        if (instance.page) {
          try { await instance.page.close() } catch {}
        }
        page = await instance.context.newPage()
        instance.page = page
      }

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })

      // 模拟人工等待
      await page.waitForTimeout(1000 + Math.random() * 2000)

      const title = await page.title()
      const finalUrl = page.url()
      // TASK03.2 — 记录最后成功导航的 URL（风控杀页后恢复用）
      if (!/^about:blank/.test(finalUrl)) {
        instance.lastUrl = finalUrl
      }
      console.log(`[BrowserRuntime] navigate ${sessionId} -> ${finalUrl.slice(0, 80)} success`)
      console.log(`[BrowserRuntime] navigate pages count: ${instance.context.pages().length}`)

      // 截图
      const screenshotPath = path.join(SESSION_DIR, `${sessionId}-${Date.now()}.png`)
      await page.screenshot({ path: screenshotPath, fullPage: false })

      // 注意：不关闭页面 — 用户需要在页面上完成登录

      return {
        success: true,
        url: finalUrl,
        title,
        screenshot: screenshotPath,
      }
    } catch (error: any) {
      return {
        success: false,
        url,
        title: '',
        error: error.message,
      }
    }
  }

  /**
   * 获取浏览器当前状态（URL + 截图）
   */
  async getStatus(sessionId: string): Promise<{ currentUrl: string; title: string; screenshot?: string }> {
    const instance = this.instances.get(sessionId)
    if (!instance?.page) {
      return { currentUrl: '', title: 'BROWSER_NOT_RUNNING' }
    }

    try {
      const currentUrl = instance.page.url()
      const title = await instance.page.title()
      const screenshotPath = path.join(SESSION_DIR, `${sessionId}-status-${Date.now()}.png`)
      await instance.page.screenshot({ path: screenshotPath, fullPage: false })
      
      return { currentUrl, title, screenshot: screenshotPath }
    } catch (e: any) {
      return { currentUrl: '', title: `ERROR: ${e.message}` }
    }
  }

  /**
   * 截图当前页面
   */
  async takeScreenshot(sessionId: string): Promise<string> {
    const instance = this.instances.get(sessionId)
    if (!instance?.page) throw new Error('BROWSER_NOT_RUNNING')
    
    const screenshotPath = path.join(SESSION_DIR, `${sessionId}-${Date.now()}.png`)
    await instance.page.screenshot({ path: screenshotPath, fullPage: false })
    return screenshotPath
  }

  /**
   * SPRINT-MEDIA-BROWSER-WORKSPACE-01 Task 02 — 获取会话 context（优先复用持久化实例）
   * 持久化实例存在 → 直接返回其 context（绝不重启为临时模式）；否则 getOrCreate
   */
  private async ensureContext(sessionId: string, config: BrowserConfig = {}): Promise<BrowserContext> {
    const existing = this.instances.get(sessionId)
    if (existing?.persistent) return existing.context
    const instance = await this.getOrCreate(sessionId, config)
    return instance.context
  }

  /**
   * 在当前 Session 执行页面操作（高级）
   * KUAISHOU-QR-FIX-01 — 串行锁包装：同 session 与 navigate 互斥，防并发点击/导航打断扫码确认
   */
  async withPage(sessionId: string, action: (page: Page) => Promise<any>, fallbackUrl?: string): Promise<any> {
    return this.withSessionLock(sessionId, () => this.withPageInner(sessionId, action, fallbackUrl))
  }

  private async withPageInner(sessionId: string, action: (page: Page) => Promise<any>, fallbackUrl?: string): Promise<any> {
    const { context } = { context: await this.ensureContext(sessionId) }
    // 优先复用 navigate 打开的主页面（登录页必须保留，不能新建 about:blank / 不能关闭）
    const inst = this.instances.get(sessionId)
    let page = inst?.page
    if (page && !page.isClosed() && page.url() === 'about:blank') {
      // SPA 跳转中间态：等 1.5s 看是否恢复（抖音扫码成功跳转 / 登录页路由切换）
      try {
        await page.waitForLoadState('domcontentloaded', { timeout: 1500 }).catch(() => {})
        await page.waitForTimeout(1500)
      } catch {}
      // LOGIN-REALITY-FIX-01 — about:blank 仍为空 → 换 context 其他存活页面：
      // 视频号 SPA 跳转后主页面对象可能废弃（login.html → /platform/），探针若继续跑在
      // about:blank 上会永远 miss（authenticated 判定失效 → confirm 400）。
      if (page.url() === 'about:blank') {
        const alive = context.pages().find((p: any) => !p.isClosed() && p.url() !== 'about:blank')
        if (alive) {
          console.log(`[BrowserRuntime] withPage about:blank 废弃，切换到存活页 ${alive.url().slice(0, 60)}`)
          page = alive
          if (inst) inst.page = alive
        }
      }
    }
    if (!page || page.isClosed()) {
      // 真死页 → 重建（优先从 context 现有存活页面里挑，其次新建）
      let rebuilt: Page | undefined
      try {
        const alive = context.pages().find((p: any) => !p.isClosed() && p.url() !== 'about:blank')
        if (alive) {
          rebuilt = alive
          if (inst) inst.page = rebuilt
        } else {
          rebuilt = await context.newPage()
          if (inst) inst.page = rebuilt
          const restoreUrl = fallbackUrl || inst?.lastUrl
          console.log(`[BrowserRuntime] withPage 页面死亡(prev=${inst?.lastUrl?.slice(0,60) || 'none'})，恢复导航到 ${restoreUrl?.slice(0,60)}`)
          if (restoreUrl) {
            try {
              await rebuilt.goto(restoreUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
              await rebuilt.waitForTimeout(800 + Math.random() * 1200)
              if (inst) inst.lastUrl = rebuilt.url()
              console.log(`[BrowserRuntime] withPage 恢复成功 -> ${rebuilt.url().slice(0, 80)}`)
            } catch (e: any) {
              console.log(`[BrowserRuntime] withPage 恢复 goto 失败: ${e.message.slice(0, 120)}`)
            }
          }
        }
      } catch (e: any) {
        console.warn(`[BrowserRuntime] withPage 恢复页面失败: ${e.message}`)
      }
      if (rebuilt) page = rebuilt
    }
    if (!page) {
      throw new Error('BROWSER_PAGE_UNAVAILABLE')
    }
    try {
      return await action(page)
    } finally {
      // 不关闭页面 — 登录页需要保持打开
    }
  }

  /**
   * 保存 Session Cookie（持久化登录态）
   */
  async saveSession(sessionId: string): Promise<string> {
    const instance = this.instances.get(sessionId)
    if (!instance) throw new Error('BROWSER_NOT_RUNNING')

    const cookies = await instance.context.cookies()
    const sessionData = {
      cookies,
      timestamp: Date.now(),
      userAgent: (instance.context as any)._options?.userAgent || '',
    }

    const sessionPath = path.join(SESSION_DIR, `${sessionId}.json`)
    fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2))

    return sessionPath
  }

  /**
   * 恢复 Session
   */
  async restoreSession(sessionId: string): Promise<boolean> {
    const sessionPath = path.join(SESSION_DIR, `${sessionId}.json`)
    if (!fs.existsSync(sessionPath)) return false

    const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'))

    const { context } = await this.getOrCreate(sessionId, {
      userAgent: sessionData.userAgent,
    })

    await context.addCookies(sessionData.cookies)
    return true
  }

  /**
   * 注入 Cookie（SPRINT-MEDIA-CHANNEL-01 Task03.1）
   * 供 Channel Runtime Adapter 从解密凭证恢复登录态（Credential Layer 在 EnterpriseChannelService，不在浏览器层）
   * 不落盘、不持久化——凭证存储仅限 EnterpriseChannelAccount.credentialEncrypted
   */
  async restoreCookies(sessionId: string, cookies: CookieData[]): Promise<boolean> {
    if (!cookies || cookies.length === 0) return false
    const context = await this.ensureContext(sessionId)
    await context.addCookies(cookies as any)
    return true
  }

  /**
   * 获取当前 Cookie
   */
  async getCookies(sessionId: string): Promise<CookieData[]> {
    return this.withSessionLock(sessionId, async () => {
      const instance = this.instances.get(sessionId)
      if (!instance) throw new Error('BROWSER_NOT_RUNNING')
      return instance.context.cookies()
    })
  }

  /**
   * KUAISHOU-QR-FIX-02 — 按域清理 cookie（连接时清残留缓存用）。
   * domainFilter 为空时清全部；传入平台域数组时仅清匹配域（保 profile 内其他数据）。
   */
  async clearCookies(sessionId: string, domainFilter?: string[]): Promise<void> {
    return this.withSessionLock(sessionId, async () => {
      const instance = this.instances.get(sessionId)
      if (!instance) throw new Error('BROWSER_NOT_RUNNING')
      if (domainFilter?.length) {
        for (const d of domainFilter) {
          await instance.context.clearCookies({ domain: d }).catch(() => {})
        }
      } else {
        await instance.context.clearCookies().catch(() => {})
      }
    })
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ status: string; version: string }> {
    try {
      const browser = await chromium.launch({
        executablePath: CHROME_PATH,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
      const version = browser.version()
      await browser.close()
      return { status: 'healthy', version }
    } catch (e: any) {
      return { status: 'unhealthy', version: 'unknown' }
    }
  }

  /**
   * 关闭浏览器实例
   * - 持久化模式：关闭 context（不删 profile 目录 — 登录态保留）
   * - 临时模式：关闭 browser
   */
  async close(sessionId: string): Promise<void> {
    const instance = this.instances.get(sessionId)
    if (instance) {
      try {
        if (instance.persistent) {
          await instance.context.close()
        } else if (instance.browser) {
          await instance.browser.close()
        }
      } catch (e: any) {
        console.warn(`[BrowserRuntime] close ${sessionId} warning: ${e.message}`)
      }
      this.instances.delete(sessionId)
    }
  }

  /**
   * 关闭所有浏览器实例
   */
  async closeAll(): Promise<void> {
    for (const [sessionId] of this.instances) {
      await this.close(sessionId)
    }
  }

  /**
   * TASK03.1.5 — 返回所有活跃实例（含 profile 信息，供 ChannelBrowserSession 维护）
   */
  listInstances(): { sessionId: string; persistent: boolean; profilePath?: string; headless: boolean }[] {
    return Array.from(this.instances.entries()).map(([sessionId, inst]) => ({
      sessionId,
      persistent: inst.persistent,
      profilePath: inst.profilePath,
      headless: inst.headless,
    }))
  }
}

export const browserRuntime = new BrowserRuntimeService()
