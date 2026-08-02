/**
 * DouyinIdentityProbe — 抖音渠道身份探针
 * SPRINT-MEDIA-CHANNEL-01 Task03.2 Reality Identity Layer
 *
 * 从 DouyinBrowserAdapter.detectLoginState 升级为独立探针：
 * - 多信号判定（A 页面特征 / B Cookie / C 身份接口）→ authenticated
 * - 新增 avatar 提取（hydration 数据 user_info.avatar_thumb）
 * - 新增 permissions（当前阶段只读能力；L2/L3 由上层权限模型控制，探针不越权）
 * - expiresAt：抖音无公开过期时间，返回 undefined（健康 Agent 用 lastCheckAt 兜底）
 *
 * 小红书/视频号/B站 未来各自实现 ChannelIdentityProbe，注册同一 registry。
 */
import type { ChannelIdentity, ChannelIdentityProbe } from '../identity-probe.js'
import { identityProbeRegistry } from '../identity-probe.js'
import { browserRuntime } from '../../../services/media/browser-runtime.service.js'

/** 创作者工作台标记（页面特征信号 A） */
const WORKBENCH_MARKERS = ['内容管理', '发布作品', '创作灵感', '作品管理', '数据概览', '创作者服务', '我的主页']
/** 明确登录页营销文案（排除误判） */
const LOGIN_PAGE_MARKERS = ['扫码登录', '扫一扫', '验证码登录', '密码登录', '我是创作者', '我是MCN机构']
/** 抖音登录态核心 Cookie（信号 B） */
const KEY_COOKIES = ['sessionid', 'sid_guard', 'uid_tt']

export class DouyinIdentityProbe implements ChannelIdentityProbe {
  readonly platform = 'douyin'

  async probe(sessionId: string): Promise<ChannelIdentity> {
    const signals = { page: false, cookie: false, identity: false }
    let accountName: string | undefined
    let accountId: string | undefined
    let avatar: string | undefined

    // A 页面特征（创作者工作台菜单 ≥2）
    try {
      signals.page = await browserRuntime.withPage(sessionId, async (page) => {
        // TASK03.2.2-FIX — 页面跳转/恢复期间等待稳定（扫码成功跳转 2-4s）
        await page.waitForTimeout(2000 + Math.random() * 1000)
        if (page.isClosed()) return false
        const url = page.url()
        if (/passport|login|qr|sso/i.test(url)) return false
        const bodyText = await page.locator('body').innerText().catch(() => '')
        if (LOGIN_PAGE_MARKERS.some(m => bodyText.includes(m))) return false
        const hit = WORKBENCH_MARKERS.filter(m => bodyText.includes(m)).length
        return hit >= 2
      })
    } catch (e: any) {
      console.warn(`[DouyinIdentityProbe] 页面特征探测异常: ${e.message}`)
    }

    // B Cookie 信号（sessionid / sid_guard / uid_tt ≥2）
    try {
      const cookies = await browserRuntime.getCookies(sessionId)
      const names = new Set((cookies || []).map(c => c.name))
      signals.cookie = KEY_COOKIES.filter(k => names.has(k)).length >= 2
    } catch (e: any) {
      console.warn(`[DouyinIdentityProbe] Cookie 探测异常: ${e.message}`)
    }

    // C 身份接口（hydration 数据提取昵称 / sec_uid / 头像）
    try {
      await browserRuntime.withPage(sessionId, async (page) => {
        const identity = await page.evaluate(() => {
          const candidates: any[] = []
          const rd = (window as any)._ROUTER_DATA
          if (rd) candidates.push(rd)
          const nd = (window as any).__NEXT_DATA__
          if (nd) candidates.push(nd)
          const walk = (o: any, depth: number): any => {
            if (!o || depth > 8 || typeof o !== 'object') return null
            if (typeof o.user_name === 'string' && o.sec_uid) {
              return {
                accountName: o.user_name,
                accountId: o.sec_uid,
                avatar: o.avatar_thumb?.url_list?.[0] || o.avatar_larger?.url_list?.[0] || o.avatar_medium?.url_list?.[0] || undefined,
              }
            }
            for (const k of Object.keys(o)) {
              const r = walk(o[k], depth + 1)
              if (r) return r
            }
            return null
          }
          for (const c of candidates) {
            const r = walk(c, 0)
            if (r) return r
          }
          return null
        }).catch(() => null)
        if (identity) {
          accountName = identity.accountName
          accountId = identity.accountId
          avatar = identity.avatar
          signals.identity = true
        }
      })
    } catch (e: any) {
      console.warn(`[DouyinIdentityProbe] 身份提取异常: ${e.message}`)
    }

    // C2 DOM 文本兜底：hydration 数据缺失时，从工作台 DOM 提取「账号名 + 抖音号」
    // （创作者中心登录后页头/个人卡渲染 user_name + 抖音号：XXXX；抖音号即账号标识）
    if (!accountId || !accountName) {
      try {
        const domIdentity = await browserRuntime.withPage(sessionId, async (page) => {
          if (page.isClosed()) return null
          const text = await page.locator('body').innerText().catch(() => '')
          const nameMatch = text.match(/抖音号[：:]\s*(\d{6,})/)
          // 账号名：取「抖音号：」前最近的一段中文昵称（页头个人卡常见结构）
          const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean)
          const idx = lines.findIndex(l => /抖音号[：:]/.test(l))
          let nickname: string | undefined
          if (idx > 0) {
            const prev = lines[idx - 1]
            // 昵称一般 ≤12 字且不含标点/链接词
            if (prev && prev.length <= 12 && !/首页|内容管理|数据中心|收入变现|创作服务|作品发布/.test(prev)) {
              nickname = prev
            }
          }
          if (!nameMatch) return null
          return { name: nickname, id: nameMatch[1] }
        }).catch(() => null)
        if (domIdentity) {
          if (!accountName && domIdentity.name) accountName = domIdentity.name
          if (!accountId && domIdentity.id) {
            accountId = domIdentity.id
            signals.identity = true // DOM 文本确认登录身份，等同强信号
          }
        }
      } catch (e: any) {
        console.warn(`[DouyinIdentityProbe] DOM 身份提取异常: ${e.message}`)
      }
    }

    // 综合判定：页面特征或身份提取任一命中即认证（真实登录态）
    // ⚠️ 2026-08-02 修正：仅 cookie 信号（sessionid/sid_guard 残留）不算登录成功——
    //    抖音 session 失效时 cookie 仍在但页面已回登录页，误判 authenticated 会导致
    //    前端卡「请确认绑定」而实际已掉线（掌柜反馈：离开页面又没了）
    const authenticated = signals.page || signals.identity

    return {
      authenticated,
      accountId,
      accountName,
      avatar,
      permissions: authenticated ? ['read:metrics', 'read:comments', 'analyze'] : [],
      checkedAt: new Date().toISOString(),
      signals,
    }
  }
}

// 注册进全局 registry（模块加载即注册，channel service 直接 get）
identityProbeRegistry.register(new DouyinIdentityProbe())
