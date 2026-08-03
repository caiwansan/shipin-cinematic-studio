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

  // ─── Case 3: /media-department/* → /workspace/media/* ───
  // SPRINT-MEDIA-ROUTE-MIGRATION-01 (2026-08-02, 掌柜指令)
  // 旧媒体部门工作台入口收敛到 AI 新媒体运营中心；旧页面保留不删除。
  // 保留 query + hash（例如 /media-department/content?id=xxx → /workspace/media/content?id=xxx）
  if (to.path.startsWith('/media-department')) {
    const legacyMap: Record<string, string> = {
      '/media-department': '/workspace/media',
      '/media-department/': '/workspace/media',
      '/media-department/index': '/workspace/media',
      '/media-department/workspace': '/workspace/media',
      '/media-department/employees': '/workspace/media/team',
      '/media-department/analytics': '/workspace/media/analytics',
      '/media-department/settings': '/workspace/media/accounts',
      '/media-department/settings/channels': '/workspace/media/accounts',
    }
    const target = legacyMap[to.path]
    return navigateTo(
      { path: target || '/workspace/media', query: to.query, hash: to.hash },
      { redirectCode: 301 },
    )
  }

  // ─── Case 4: /user/download → /download/desktop ───
  // RELEASE-01.2 Task 02（技术总监+产品经理裁定）：下载页属于公共发行层，不属于用户中心。
  // 旧下载页曾要求登录（middleware: auth），用户访问被登录墙拦截。
  // 统一 301 到公开下载页 /download/desktop（唯一真机下载入口，无需登录）。
  if (to.path === '/user/download' || to.path.startsWith('/user/download/')) {
    return navigateTo('/download/desktop', { redirectCode: 301 })
  }
})
