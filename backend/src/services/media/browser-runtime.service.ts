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
}

class BrowserRuntimeService {
  private instances = new Map<string, BrowserInstance>()

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
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    })

    const context = await browser.newContext({
      userAgent: config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: config.viewport || { width: 1280, height: 800 },
    })

    this.instances.set(sessionId, { browser, context, page: undefined, headless: config.headless ?? true, persistent: false })
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

    const context = await chromium.launchPersistentContext(profilePath, {
      executablePath: CHROME_PATH,
      headless: config.headless ?? true,
      slowMo: config.slowMo ?? 0,
      viewport: config.viewport || { width: 1280, height: 800 },
      userAgent: config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    })

    this.instances.set(sessionId, { context, page: undefined, headless: config.headless ?? true, persistent: true, profilePath })
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
   */
  async getOrCreatePersistent(sessionId: string, profilePath: string, config: BrowserConfig = {}): Promise<BrowserInstance> {
    let instance = this.instances.get(sessionId)
    if (instance) {
      const sameProfile = instance.persistent && instance.profilePath === profilePath
      const headlessOk = config.headless === undefined || config.headless === instance.headless
      if (sameProfile && headlessOk) {
        return instance
      }
      // 模式/profile 变化 → 重启
      await this.close(sessionId)
      instance = undefined
    }
    if (!instance) {
      await this.launchPersistent(sessionId, profilePath, config)
      instance = this.instances.get(sessionId)!
    }
    return instance
  }

  /**
   * 创建新页面并导航（保持页面打开）
   */
  async navigate(sessionId: string, url: string, config: BrowserConfig = {}): Promise<NavigationResult> {
    try {
      const instance = await this.getOrCreate(sessionId, config)
      
      // 如果有已存在的页面，先关闭
      if (instance.page) {
        try { await instance.page.close() } catch {}
      }
      
      const page = await instance.context.newPage()
      instance.page = page

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })

      // 模拟人工等待
      await page.waitForTimeout(1000 + Math.random() * 2000)

      const title = await page.title()
      const finalUrl = page.url()

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
   * 在当前 Session 执行页面操作（高级）
   */
  async withPage(sessionId: string, action: (page: Page) => Promise<any>): Promise<any> {
    const { context } = await this.getOrCreate(sessionId)
    // 优先复用 navigate 打开的主页面（登录页必须保留，不能新建 about:blank / 不能关闭）
    const inst = this.instances.get(sessionId)
    let page = inst?.page
    if (!page || page.isClosed()) {
      page = await context.newPage()
      if (inst) inst.page = page
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
    const { context } = await this.getOrCreate(sessionId)
    await context.addCookies(cookies as any)
    return true
  }

  /**
   * 获取当前 Cookie
   */
  async getCookies(sessionId: string): Promise<CookieData[]> {
    const instance = this.instances.get(sessionId)
    if (!instance) throw new Error('BROWSER_NOT_RUNNING')
    return instance.context.cookies()
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
