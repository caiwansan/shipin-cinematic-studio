// 移动 UA 访问根路径 → 手机版落地页（/mobile）
// 仅处理 '/'，其余路由不动；保留 query（showLogin/redirect 等）
import { detectMobile } from '~/utils/mobile-detect'

export default defineNuxtRouteMiddleware((to) => {
  if (to.path !== '/') return
  if (!detectMobile()) return
  const q = to.fullPath.includes('?') ? to.fullPath.slice(to.fullPath.indexOf('?')) : ''
  return navigateTo('/mobile' + q)
})
