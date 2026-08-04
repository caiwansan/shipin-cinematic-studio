// Workspace Connection Protocol — ticket exchange（S1）
// 云端页面检测 ?ticket= → 交换 accessToken → token-cache 存储（页面自身，ADR-021 合规）
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    try {
      const params = new URLSearchParams(window.location.search)
      const ticket = params.get('ticket')
      if (ticket) {
        fetch('/api/auth/ticket/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticket }),
        })
          .then((r) => r.json())
          .then(async (d) => {
            const token = d?.data?.accessToken || d?.accessToken
            if (token) {
              const { setToken } = await import('~/utils/token-cache')
              setToken(token)
              params.delete('ticket')
              const qs = params.toString()
              const url = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash
              window.history.replaceState({}, '', url)
              window.location.reload()
            }
          })
          .catch(() => {})
      }
    } catch (e) {
      /* ignore */
    }
  }
})
