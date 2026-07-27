/**
 * BETA-06.6.1 Gate 1: Enterprise → Media Department 路由迁移
 * 
 * 所有旧 Enterprise 路由统一重定向到 AI新媒体运营部门
 * 301 = 永久重定向，浏览器会缓存
 */
export default defineNuxtRouteMiddleware((to) => {
  // 完全匹配：/enterprise 或 /enterprise/
  if (to.path === '/enterprise' || to.path === '/enterprise/') {
    return navigateTo('/media-department', { redirectCode: 301 })
  }

  // 任何 /enterprise/* 子页面 → /media-department
  if (to.path.startsWith('/enterprise/')) {
    const subPath = to.path.replace('/enterprise/', '')
    // 功能映射
    if (subPath.startsWith('tasks') || subPath.startsWith('leads') || 
        subPath.startsWith('approval') || subPath.startsWith('intelligence') ||
        subPath.startsWith('decisions') || subPath.startsWith('execution') ||
        subPath.startsWith('people') || subPath.startsWith('channels') ||
        subPath.startsWith('sales') || subPath.startsWith('growth')) {
      return navigateTo('/media-department/workspace', { redirectCode: 301 })
    }
    if (subPath.startsWith('roi') || subPath.startsWith('analytics')) {
      return navigateTo('/media-department/analytics', { redirectCode: 301 })
    }
    if (subPath.startsWith('setup') || subPath.startsWith('settings') || subPath.startsWith('provider-settings')) {
      return navigateTo('/media-department/settings', { redirectCode: 301 })
    }
    // recruitment 已迁移到 /workspace/recruitment，不走 media-department
    if (subPath.startsWith('recruitment')) {
      return navigateTo('/workspace/recruitment', { redirectCode: 301 })
    }
    // 默认映射到首页
    return navigateTo('/media-department', { redirectCode: 301 })
  }
})
