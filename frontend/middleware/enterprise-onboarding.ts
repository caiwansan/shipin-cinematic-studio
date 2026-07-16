/**
 * Enterprise Onboarding Guard
 * 
 * 用户进入 /enterprise 前检查：
 * 1. 是否已登录？
 * 2. 是否已初始化企业（Tenant + Organization + Quota）？
 * 3. 如果未初始化，重定向到 /enterprise/setup
 * 
 * 使用方式（在 setup.vue 需要检测的页面中）：
 *   definePageMeta({ middleware: 'enterprise-onboarding' })
 */

export default defineNuxtRouteMiddleware(async (to, from) => {
  const authStore = useAuthStore()
  
  // 未登录，走默认行为（由其他 auth guard 处理）
  if (!authStore.isAuthenticated) {
    return
  }

  // /enterprise/setup 页面本身不需要守卫
  if (to.path === '/enterprise/setup' || to.path.startsWith('/enterprise/demo')) {
    return
  }

  // 检查是否已初始化
  try {
    const res = await $fetch<{ code: number; data: { isComplete: boolean; tenant: boolean; agents: number } }>(
      `/api/enterprise/onboarding/status`,
      { headers: { Authorization: `Bearer ${authStore.getToken()}` } }
    )
    
    if (res.code === 0 && res.data && !res.data.isComplete) {
      // 未初始化，跳转到 Setup Wizard
      return navigateTo('/enterprise/setup')
    }
  } catch (e) {
    // API 错误时允许进入（可能是网络问题）
    console.warn('[OnboardingGuard] 检查初始化状态失败:', e)
  }
})
