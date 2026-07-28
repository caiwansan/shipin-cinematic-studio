/**
 * SSOT Route Redirect (Unified) — 2026-07-28
 * Per Enterprise Recruitment SSOT Constitution v1.0 §7
 *
 * Handles all legacy path redirects:
 *   /workspace/recruitment/* → /workspace/enterprise/*
 *   /enterprise/*           → /workspace/enterprise/*
 *
 * 301 = 永久重定向，浏览器会缓存
 *
 * FRONTEND-RECRUITMENT-ENTRY-CONSOLIDATION-01 SubTask 1:
 * 统一 3 个 redirect 为 1 个 middleware。
 * 旧 recruitment-redirect.global.ts + Nuxt config routeRules 已移除。
 */
export default defineNuxtRouteMiddleware((to) => {
  // ─── Case 1: /workspace/recruitment/* → /workspace/enterprise/* ───
  if (to.path.startsWith('/workspace/recruitment')) {
    const redirectMap: Record<string, string> = {
      '/workspace/recruitment': '/workspace/enterprise',
      '/workspace/recruitment/': '/workspace/enterprise',
      '/workspace/recruitment/index': '/workspace/enterprise',
      '/workspace/recruitment/jobs': '/workspace/enterprise/jobs',
      '/workspace/recruitment/jobs/create': '/workspace/enterprise/jobs',
      '/workspace/recruitment/matches': '/workspace/enterprise/talent',
      '/workspace/recruitment/matches/index': '/workspace/enterprise/talent',
      '/workspace/recruitment/resumes': '/workspace/enterprise/candidates',
      '/workspace/recruitment/resumes/index': '/workspace/enterprise/candidates',
      '/workspace/recruitment/pipeline': '/workspace/enterprise/jobs',
      '/workspace/recruitment/onboarding': '/workspace/enterprise/onboarding',
    }

    const target = redirectMap[to.path]
    if (target) {
      return navigateTo(target, { redirectCode: 301 })
    }

    // Fallback: any other /workspace/recruitment/* subpath → enterprise home
    return navigateTo('/workspace/enterprise', { redirectCode: 301 })
  }

  // ─── Case 2: /enterprise/* → /workspace/enterprise/* ───
  if (to.path.startsWith('/enterprise')) {
    const newPath = to.path.replace(/^\/enterprise/, '/workspace/enterprise')
    return navigateTo(newPath, { redirectCode: 301 })
  }
})
