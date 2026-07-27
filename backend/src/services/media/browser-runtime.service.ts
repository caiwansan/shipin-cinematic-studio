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

// 确保 session 目录存在
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true })
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

class BrowserRuntimeService {
  private instances = new Map<string, { browser: Browser; context: BrowserContext; page?: Page }>()

  /**
   * 启动浏览器实例
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

    this.instances.set(sessionId, { browser, context, page: undefined })
  }

  /**
   * 获取或创建浏览器实例
   */
  async getOrCreate(sessionId: string, config: BrowserConfig = {}): Promise<{ browser: Browser; context: BrowserContext; page?: Page }> {
    let instance = this.instances.get(sessionId)
    if (!instance) {
      await this.launch(sessionId, config)
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
    const page = await context.newPage()
    try {
      return await action(page)
    } finally {
      await page.close()
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
   */
  async close(sessionId: string): Promise<void> {
    const instance = this.instances.get(sessionId)
    if (instance) {
      await instance.browser.close()
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
}

export const browserRuntime = new BrowserRuntimeService()
