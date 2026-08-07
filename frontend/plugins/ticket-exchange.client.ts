// S1.1 Identity Ticket Bridge — 云端页面插件（正式版）
// 部署位置: frontend/plugins/ticket-exchange.client.ts（线上 Nuxt build 后生效）
// 依据: KUNLUN-AI-OS-IDENTITY-BRIDGE-v1.md / ADR-021（页面自己写自己域 localStorage）
// 行为: 检测 ?ticket= → exchange → 存 auth_token → 清 URL → reload
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  try {
    const params = new URLSearchParams(window.location.search)
    const ticket = params.get('ticket')
    if (!ticket) return

    fetch('/api/auth/ticket/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('exchange failed: ' + r.status)
        return r.json()
      })
      .then((d) => {
        const token = d?.data?.accessToken || d?.accessToken
        if (!token) throw new Error('no accessToken in response')

        // 页面域内存储（与 utils/auth/token.ts 的 auth_token 同 key）
        localStorage.setItem('auth_token', token)

        // 清除 URL 中的 ticket（防泄漏/防重复交换）
        params.delete('ticket')
        const qs = params.toString()
        const url = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash
        window.history.replaceState({}, '', url)
        window.location.reload()
      })
      .catch((e) => {
        // 静默失败: 不阻塞页面正常使用（无 ticket 场景零影响）
        console.warn('[ticket-exchange]', e?.message || e)
      })
  } catch (e) {
    /* ignore */
  }
})
