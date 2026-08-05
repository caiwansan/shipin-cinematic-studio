import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()

  // Skip auth check for login page
  if (to.path === '/login') {
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

  // Protected routes: /studio/*, /dashboard/*, /user/*, /workspace/*, /admin/*
  const isProtected = to.path.startsWith('/studio') || to.path.startsWith('/dashboard/') || to.path.startsWith('/user/') || to.path.startsWith('/workspace/')
  if (isProtected && !auth.isAuthenticated && !auth.token) {
    if (import.meta.server) {
      // SSR：/workspace/* 为 client-only（SSR 只渲染空壳），SSR 端不做完整鉴权。
      // 仅做 cookie 存在性检查 —— 避免访问 document（SSR 无）导致 500，
      // 已登录用户放行后由客户端 hydrate 时真正验证，未登录直接回登录弹窗。
      const cookieHeader = useRequestHeaders(['cookie']).cookie || ''
      const hasAuthCookie = /(^| )(auth_token|auth_user)=/.test(cookieHeader)
      if (!hasAuthCookie) {
        return navigateTo('/?showLogin=1&redirect=' + encodeURIComponent(to.fullPath))
      }
      return
    }
    // Try to restore from cookie/localStorage before redirecting
    await auth.restoreSession()
    if (!auth.isAuthenticated) {
      // SPRINT-MEDIA-IDENTITY-ALIGN-01 401-FIX: /login 路由已废弃（routeRules 301→/）
      // 登录入口 = 首页弹窗（?showLogin=1），redirect 参数登录成功后回跳
      return navigateTo('/?showLogin=1&redirect=' + encodeURIComponent(to.fullPath))
    }
  } else if (isProtected && auth.isAuthenticated) {
    // 已登录用户，从 API 刷新用户数据（确保会员级别同步）
    if (import.meta.client) {
      await auth.restoreSession()
    }
  }
})
