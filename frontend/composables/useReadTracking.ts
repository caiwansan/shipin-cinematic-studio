// COMMUNITY-READ-TRACKING-01 完读率埋点（掌柜 2026-08-07 拍板）
// 采集：页面可见 + 用户活跃（滚动/点击/按键）才计时，挂机不计；
// 上报：切走/卸载/滚动到底/满 600s 时上报一次；优先 sendBeacon（beforeunload 可靠）。
// 判定：有效阅读 = seconds>=15 && depth>=0.4（服务端聚合时判定）
import { onMounted, onUnmounted } from 'vue'

const MAX_SESSION_SECONDS = 600 // 与服务端封顶一致
const ACTIVE_TIMEOUT_MS = 10_000 // 10s 无活动视为挂机，暂停计时
const TICK_MS = 5_000 // 计时精度

export function useReadTracking(postId: string | undefined) {
  let activeSeconds = 0
  let maxDepth = 0
  let lastActivity = Date.now()
  let timer: ReturnType<typeof setInterval> | null = null
  let reported = false
  let started = false

  const getToken = () => window.localStorage?.getItem('auth_token') || ''

  const report = (final = false) => {
    if (reported) return
    if (activeSeconds < 1 && maxDepth < 0.01) return // 零阅读不上报
    if (!postId) return

    const payload = JSON.stringify({ seconds: Math.min(activeSeconds, MAX_SESSION_SECONDS), depth: maxDepth })
    const url = `/api/community/posts/${postId}/read-progress`
    const token = getToken()
    if (!token) return // 未登录不上报（防刷最小化）

    if (final && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' })
      // sendBeacon 不带自定义 header，token 通过 query 传（GET 无副作用，仅统计）
      navigator.sendBeacon(`${url}?token=${encodeURIComponent(token)}`, blob)
    } else {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: payload,
        keepalive: true,
      }).catch(() => {})
    }
    reported = true
  }

  const onActivity = () => {
    lastActivity = Date.now()
  }

  const onScroll = () => {
    onActivity()
    const el = document.documentElement
    const scrollable = el.scrollHeight - el.clientHeight
    if (scrollable > 0) {
      const d = (el.scrollTop + el.clientHeight) / el.scrollHeight
      if (d > maxDepth) maxDepth = Math.min(d, 1)
    }
    // 滚动到底（深度 >= 0.95）视为读完，提前上报
    if (maxDepth >= 0.95 && activeSeconds >= 5) report()
  }

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      report(true)
    } else {
      lastActivity = Date.now() // 回来重新算活跃
    }
  }

  const tick = () => {
    const now = Date.now()
    if (document.visibilityState === 'visible' && now - lastActivity < ACTIVE_TIMEOUT_MS) {
      activeSeconds += TICK_MS / 1000
      if (activeSeconds >= MAX_SESSION_SECONDS) report(true)
    }
  }

  onMounted(() => {
    if (!postId) return
    started = true
    lastActivity = Date.now()
    timer = setInterval(tick, TICK_MS)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('mousemove', onActivity, { passive: true })
    window.addEventListener('touchmove', onActivity, { passive: true })
    window.addEventListener('keydown', onActivity, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
  })

  function onPageHide() {
    report(true)
  }

  onUnmounted(() => {
    report(true) // SPA 路由离开：fetch keepalive 上报
    if (timer) clearInterval(timer)
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('mousemove', onActivity)
    window.removeEventListener('touchmove', onActivity)
    window.removeEventListener('keydown', onActivity)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
  })

  return { started }
}
