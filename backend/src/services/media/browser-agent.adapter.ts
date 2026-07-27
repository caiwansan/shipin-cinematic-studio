/**
 * Browser Agent Adapter — BETA-06.6 Phase 3.1
 * 
 * 职责：将 AI Agent 的命令转换为浏览器操作
 * 
 * 架构：
 *   Agent Command → Browser Action → Result
 * 
 * 例如：
 *   AI: "发布这篇小红书笔记" 
 *   → BrowserTask: open creator center → upload image → fill title → fill content → submit
 */

import { Page, Locator } from 'playwright'
import { browserRuntime } from './browser-runtime.service.js'

// ─── Types ───

export type BrowserActionType = 
  | 'navigate' 
  | 'click' 
  | 'fill' 
  | 'screenshot' 
  | 'wait' 
  | 'evaluate'
  | 'select'
  | 'upload'

export interface BrowserAction {
  type: BrowserActionType
  selector?: string
  value?: string
  url?: string
  waitTime?: number
  expression?: string
  filePath?: string
  label?: string  // 用于日志
}

export interface ActionResult {
  success: boolean
  action: BrowserAction
  result?: any
  error?: string
  timestamp: number
}

export interface BrowserTask {
  sessionId: string
  actions: BrowserAction[]
  description?: string
}

// ─── Selectors for Xiaohongshu Creator Center ───

const XHS_SELECTORS = {
  // 登录页
  login: {
    phoneInput: 'input[type="tel"], input[placeholder*="手机号"]',
    codeInput: 'input[placeholder*="验证码"], input[type="text"].code',
    submitBtn: 'button:has-text("登录"), button[type="submit"]',
    qrcodeImg: 'img[class*="qrcode"], .login-qrcode img',
  },
  // 创作者中心
  creator: {
    publishLink: 'a:has-text("发布笔记"), a[href*="publish"]',
    publishBtn: 'button:has-text("发布笔记"), .publish-btn',
  },
  // 发布笔记页
  publish: {
    titleInput: '#title-input, input[placeholder*="标题"], [class*="title"] input',
    contentEditor: '#post-textarea, [contenteditable="true"], .ql-editor, [class*="editor"]',
    tagInput: 'input[placeholder*="标签"], [class*="tag"] input',
    imageUpload: '.upload-wrapper input[type="file"], [class*="upload"] input[type="file"]',
    submitBtn: 'button:has-text("发布"), [class*="publish"] button[type="submit"]',
    publishConfirmBtn: 'button:has-text("确认发布"), .confirm-btn',
  },
  // 首页
  home: {
    notesList: '.note-item, [class*="note-card"]',
    noteTitle: '.title, [class*="note-title"]',
  },
}

// ─── Service ───

class BrowserAgentAdapterService {

  /**
   * 执行浏览器任务
   */
  async executeTask(task: BrowserTask): Promise<{
    success: boolean
    results: ActionResult[]
    error?: string
  }> {
    const results: ActionResult[] = []
    let hasError = false

    for (const action of task.actions) {
      try {
        const result = await this.executeAction(task.sessionId, action)
        results.push(result)
        if (!result.success) {
          hasError = true
          break
        }
      } catch (e: any) {
        results.push({
          success: false,
          action,
          error: e.message,
          timestamp: Date.now(),
        })
        hasError = true
        break
      }
    }

    return {
      success: !hasError,
      results,
    }
  }

  /**
   * 执行单个浏览器操作
   */
  async executeAction(sessionId: string, action: BrowserAction): Promise<ActionResult> {
    const startTime = Date.now()

    try {
      const result = await browserRuntime.withPage(sessionId, async (page: Page) => {
        switch (action.type) {
          case 'navigate':
            await page.goto(action.url!, { waitUntil: 'domcontentloaded', timeout: 30000 })
            await this.randomWait(page, 1000, 3000)
            return { url: page.url(), title: page.title() }

          case 'click':
            await this.waitForSelector(page, action.selector!)
            await this.humanClick(page, action.selector!)
            await this.randomWait(page, 500, 1500)
            return { clicked: action.selector }

          case 'fill':
            await this.waitForSelector(page, action.selector!)
            await this.humanType(page, action.selector!, action.value!)
            await this.randomWait(page, 300, 800)
            return { filled: action.selector, value: action.value?.length }

          case 'select':
            await this.waitForSelector(page, action.selector!)
            await page.selectOption(action.selector!, action.value!)
            return { selected: action.selector, value: action.value }

          case 'screenshot':
            const screenshotPath = `/tmp/browser-sessions/${sessionId}-${Date.now()}.png`
            await page.screenshot({ path: screenshotPath, fullPage: false })
            return { screenshot: screenshotPath }

          case 'wait':
            await page.waitForTimeout(action.waitTime || 1000)
            return { waited: action.waitTime }

          case 'evaluate':
            const evalResult = await page.evaluate(action.expression!)
            return { result: evalResult }

          case 'upload':
            if (action.filePath) {
              const fileInput = await page.$(action.selector!)
              if (fileInput) {
                await fileInput.setInputFiles(action.filePath)
                await this.randomWait(page, 2000, 4000)  // 等待上传
                return { uploaded: action.filePath }
              }
            }
            return { error: 'Upload input not found' }

          default:
            return { error: `Unknown action type: ${action.type}` }
        }
      })

      return {
        success: true,
        action,
        result,
        timestamp: Date.now() - startTime,
      }
    } catch (error: any) {
      return {
        success: false,
        action,
        error: error.message,
        timestamp: Date.now() - startTime,
      }
    }
  }

  /**
   * 小红书发布笔记任务
   */
  async publishXiaohongshuNote(params: {
    sessionId: string
    title: string
    body: string
    imagePaths?: string[]
    tags?: string[]
  }): Promise<{ success: boolean; results: ActionResult[]; error?: string }> {
    const { sessionId, title, body, imagePaths, tags } = params

    const actions: BrowserAction[] = [
      { type: 'navigate', url: 'https://creator.xiaohongshu.com/publish/publish', label: '打开小红书发布页' },
    ]

    // 上传图片
    if (imagePaths && imagePaths.length > 0) {
      actions.push({
        type: 'upload',
        selector: XHS_SELECTORS.publish.imageUpload,
        filePath: imagePaths[0],  // 首张图
        label: '上传图片',
      })
    }

    // 填写标题
    actions.push({
      type: 'fill',
      selector: XHS_SELECTORS.publish.titleInput,
      value: title,
      label: '填写标题',
    })

    // 填写正文
    actions.push({
      type: 'fill',
      selector: XHS_SELECTORS.publish.contentEditor,
      value: body,
      label: '填写正文',
    })

    // 添加标签
    if (tags && tags.length > 0) {
      for (const tag of tags) {
        actions.push({
          type: 'fill',
          selector: XHS_SELECTORS.publish.tagInput,
          value: tag,
          label: `添加标签: ${tag}`,
        })
        actions.push({ type: 'wait', waitTime: 500, label: '等待标签添加' })
      }
    }

    // 截图确认
    actions.push({ type: 'screenshot', label: '截图确认' })

    // 发布
    actions.push({
      type: 'click',
      selector: XHS_SELECTORS.publish.submitBtn,
      label: '点击发布',
    })

    // 确认发布
    actions.push({
      type: 'click',
      selector: XHS_SELECTORS.publish.publishConfirmBtn,
      label: '确认发布',
    })

    return this.executeTask({
      sessionId,
      actions,
      description: `发布小红书笔记: ${title}`,
    })
  }

  /**
   * 小红书登录
   */
  async loginXiaohongshu(params: {
    sessionId: string
    phone?: string
    code?: string
    useQrCode?: boolean
  }): Promise<{ success: boolean; results: ActionResult[]; error?: string; qrcode?: string }> {
    const { sessionId, phone, code, useQrCode } = params
    const actions: BrowserAction[] = []

    actions.push({ type: 'navigate', url: 'https://creator.xiaohongshu.com/login', label: '打开登录页' })
    actions.push({ type: 'screenshot', label: '获取二维码' })

    if (useQrCode) {
      // 获取二维码路径
      const result = await browserRuntime.withPage(sessionId, async (page: Page) => {
        const qrPath = `/tmp/browser-sessions/${sessionId}-qrcode.png`
        await page.screenshot({ path: qrPath })
        return qrPath
      })
      return { success: true, results: [], qrcode: result }
    }

    if (phone) {
      actions.push({
        type: 'fill',
        selector: XHS_SELECTORS.login.phoneInput,
        value: phone,
        label: '输入手机号',
      })
    }

    if (code) {
      actions.push({
        type: 'fill',
        selector: XHS_SELECTORS.login.codeInput,
        value: code,
        label: '输入验证码',
      })
      actions.push({
        type: 'click',
        selector: XHS_SELECTORS.login.submitBtn,
        label: '点击登录',
      })
    }

    return this.executeTask({
      sessionId,
      actions,
      description: '小红书登录',
    })
  }

  // ─── Private Helpers ───

  private async waitForSelector(page: Page, selector: string, timeout = 10000): Promise<Locator> {
    const locator = page.locator(selector).first()
    await locator.waitFor({ state: 'visible', timeout })
    return locator
  }

  private async humanClick(page: Page, selector: string): Promise<void> {
    const locator = page.locator(selector).first()
    await locator.scrollIntoViewIfNeeded()
    await page.waitForTimeout(200 + Math.random() * 300)
    await locator.click({ delay: 50 + Math.random() * 100 })
  }

  private async humanType(page: Page, selector: string, text: string): Promise<void> {
    const locator = page.locator(selector).first()
    await locator.scrollIntoViewIfNeeded()
    await locator.click()
    await page.waitForTimeout(200 + Math.random() * 300)
    // 逐字输入，模拟人工
    for (const char of text) {
      await locator.fill(text.substring(0, text.indexOf(char) + 1))
      await page.waitForTimeout(20 + Math.random() * 50)
    }
  }

  private async randomWait(page: Page, min: number, max: number): Promise<void> {
    const delay = min + Math.random() * (max - min)
    await page.waitForTimeout(delay)
  }
}

export const browserAgentAdapter = new BrowserAgentAdapterService()
