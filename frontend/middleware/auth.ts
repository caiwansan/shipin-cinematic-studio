import { useAuthStore } from '~/stores/auth'
import { detectMobile, safeRedirect } from '~/utils/mobile-detect'

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()

  // Skip auth check for login page
  if (to.path === '/login') {
    return
  }

  // 手机版登录页：未登录放行（页面自身处理），已登录直接回跳
  if (to.path === '/mobile-login') {
    if (import.meta.client && auth.isAuthenticated && auth.token) {
      return navigateTo(safeRedirect(to.query.redirect, '/mobile-app'))
    }
    return
  }

  // 🛡️ Admin routes: check token existence in localStorage (no API call)
  if (to.path.startsWith('/admin/')) {
    // Skip the login page itself to avoid redirect loop
    if (to.path === '/admin/aigc/login') {
      return
    }
    const hasToken = import.meta.client
      ? !!window.localStorage?.getItem('auth_token')
      : false
    if (!hasToken && !auth.token) {
      return navigateTo('/admin/aigc/login')
    }
    return
  }

  // Protected routes: /studio/*, /dashboard/*, /user/*, /workspace/*, /mobile-app
  const isProtected = to.path.startsWith('/studio') || to.path.startsWith('/dashboard/') || to.path.startsWith('/user/') || to.path.startsWith('/workspace/') || to.path === '/mobile-app'
  if (isProtected && !auth.isAuthenticated && !auth.token) {
    const isMobile = detectMobile()
    if (import.meta.server) {
      // SSR：/workspace/* 为 client-only（SSR 只渲染空壳），SSR 端不做完整鉴权。
      // 仅做 cookie 存在性检查 —— 避免访问 document（SSR 无）导致 500，
      // 已登录用户放行后由客户端 hydrate 时真正验证，未登录直接回登录弹窗。
      const cookieHeader = useRequestHeaders(['cookie']).cookie || ''
      const hasAuthCookie = /(^| )(auth_token|auth_user)=/.test(cookieHeader)
      if (!hasAuthCookie) {
        // 移动端：跳手机版登录页；桌面端：首页登录弹窗
        if (isMobile) {
          return navigateTo('/mobile-login?redirect=' + encodeURIComponent(to.fullPath))
        }
        return navigateTo('/?showLogin=1&redirect=' + encodeURIComponent(to.fullPath))
      }
      return
    }
    // Try to restore from cookie/localStorage before redirecting
    await auth.restoreSession()
    if (!auth.isAuthenticated) {
      // SPRINT-MEDIA-IDENTITY-ALIGN-01 401-FIX: /login 路由已废弃（routeRules 301→/）
      // 登录入口 = 首页弹窗（?showLogin=1），redirect 参数登录成功后回跳；移动端 = /mobile-login
      if (isMobile) {
        return navigateTo('/mobile-login?redirect=' + encodeURIComponent(to.fullPath))
      }
      return navigateTo('/?showLogin=1&redirect=' + encodeURIComponent(to.fullPath))
    }
  } else if (isProtected && auth.isAuthenticated) {
    // 已登录用户，从 API 刷新用户数据（确保会员级别同步）
    if (import.meta.client) {
      await auth.restoreSession()
    }
  }
})
