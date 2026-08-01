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
   * [v1.0] 连接渠道账号
   * - 已有凭证：解密 → 恢复 cookie → 打开创作者中心
   * - 无凭证/登录态失效：打开登录页等待扫码（waiting_login）
   */
  async connect(accountId?: string): Promise<ConnectResult> {
    const sid = this.sessionIdFor(accountId ?? 'new')

    // 恢复已保存登录态（凭证来自 EnterpriseChannelService，adapter 不落库）
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

    await browserRuntime.navigate(sid, CREATOR_CENTER_URL)

    // 检测登录态
    const loggedIn = await this.detectLoggedIn(sid)
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
   * [v1.0] 读取账号真实核心指标（粉丝/作品/获赞等，禁止 mock）
   * 流程：getCredential → 恢复 cookie → 打开数据概览 → 抓取
   */
  async fetchMetrics(accountId: string): Promise<ChannelMetrics> {
    const sid = this.sessionIdFor(accountId)

    // 恢复登录态
    const cred = await this.deps.getCredential(accountId)
    const cookieData = cred.cookieData
    if (!cookieData) {
      throw new Error('该渠道账号尚未保存登录凭证，请先 connect 并完成登录')
    }
    await browserRuntime.restoreCookies(sid, JSON.parse(cookieData))

    const nav = await browserRuntime.navigate(sid, DATA_OVERVIEW_URL)
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
   */
  async fetchComments(accountId: string, postId?: string): Promise<ChannelComment[]> {
    const sid = this.sessionIdFor(accountId)
    const cred = await this.deps.getCredential(accountId)
    const cookieData = cred.cookieData
    if (!cookieData) {
      throw new Error('该渠道账号尚未保存登录凭证，请先 connect 并完成登录')
    }
    await browserRuntime.restoreCookies(sid, JSON.parse(cookieData))

    const url = postId
      ? `https://creator.douyin.com/creator-micro/content/manage?filter=2&aid=${postId}`
      : 'https://creator.douyin.com/creator-micro/content/manage'
    await browserRuntime.navigate(sid, url)
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
        // 登录页特征：二维码/扫码登录/登录表单
        const loginMarkers = ['login', 'passport', 'qr', '扫码', '登录']
        const hasLoginMarker = loginMarkers.some(m => url.includes(m))
        // 创作者工作台特征
        const workbenchMarkers = ['[class*="header"]', '[class*="nav"]', '[class*="workspace"]', '[class*="creator"]']
        const bodyText = await page.locator('body').innerText().catch(() => '')
        const hasWorkbenchText = bodyText.includes('内容管理') || bodyText.includes('数据') || bodyText.includes('创作灵感')
        const hasQrLogin = await page.locator('img[src*="qr"], [class*="qrcode"], [class*="qr-code"]').count().then((c: number) => c > 0).catch(() => false)
        if (hasQrLogin || hasLoginMarker) return false
        return hasWorkbenchText
      })
    } catch (e: any) {
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
