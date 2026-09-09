// 移动 UA 访问根路径 → 手机版落地页（/mobile）
// 仅处理 '/'，其余路由不动；保留 query（showLogin/redirect 等）
import { detectMobile } from '~/utils/mobile-detect'

export default defineNuxtRouteMiddleware((to) => {
  // 手机APP(内置壳)中：强制所有路径进入手机版 /mobile-app（登录/注册页除外，路由会自行跳转）
  if (import.meta.client && !!(window as any).Capacitor?.isNativePlatform?.()) {
    const allowed = ['/mobile-app', '/mobile-login', '/mobile-register']
    if (!allowed.includes(to.path)) {
      const q = to.fullPath.includes('?') && to.fullPath.startsWith('/mobile') ? to.fullPath.slice(to.fullPath.indexOf('?')) : ''
      return navigateTo('/mobile-app' + q)
    }
    return
  }
  // ⛔ 已下线（2026-08-24）：旧 H5 手机版页面废弃，移动 UA 不再跳 /mobile。
  // 扫码邀请统一走首页注册弹窗（?showLogin=1&register=1&ref=xxx），已登录用户直达下载中心。
  // if (to.path !== '/') return
  // if (!detectMobile()) return
  // const q = to.fullPath.includes('?') ? to.fullPath.slice(to.fullPath.indexOf('?')) : ''
  // return navigateTo('/mobile' + q)
  return
})
