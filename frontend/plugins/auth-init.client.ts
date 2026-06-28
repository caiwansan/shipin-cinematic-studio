/**
 * auth-init.client.ts — 客户端全局认证状态恢复
 *
 * 所有页面加载时自动从 localStorage 恢复 token 到 Pinia store，
 * 确保 /hdz/* /ppt/* 等非标准保护路径也能使用 auth store 的认证状态。
 */
import { defineNuxtPlugin } from '#app'
import { useAuthStore } from '~/stores/auth'

export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()

  // 如果 state 初始化没有自动恢复 token（比如因为 store 被提前创建），手动恢复
  // 但不主动验证——等待具体 API 调用自然发现 token 无效
  if (!auth.token) {
    const { getToken } = await import('~/utils/token-cache')
    const cached = getToken()
    if (cached) {
      auth.setTokenToStore(cached)
    }
  }
})
