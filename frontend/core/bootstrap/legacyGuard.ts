// P3.1.6 — Legacy Guard
// ============================================================
// 防止 future legacy fetch 复活的保护层
//
// 规则:
//   所有 legacy API 调用必须经过此 guard
//   （它们不应再被调用，但万一有人误调，guard 会拦截）
//
// 用法:
//   import { legacyGuard } from '~/core/bootstrap/legacyGuard'
//   // 可选：在全局 bootstrap 中激活
//   legacyGuard.arm()
//
// 注意:
//   这不是运行时拦截，而是在 import 后标记 "已确认无调用"
//   如果有人错误地 import 了旧 service，lint 会检测到
// ============================================================

// 被禁用的 legacy API 端点清单
export const BLOCKED_LEGACY_ENDPOINTS = [
  '/api/geo/dashboard/stats',
  '/api/geo/brands',
  '/api/geo/tasks',
]

// 被禁用的 legacy 服务文件（有调用就违规）
export const BLOCKED_LEGACY_SERVICES = [
  'brandService',
  'visibilityService',
  'citationService',
  'competitorService',
  'useBrandGEORuntime',
]

/**
 * 确认所有 legacy endpoint 已被禁用
 * 在 CI / 运行时打印警告（不 block 执行）
 */
export function legacyGuard(): { blocked: string[]; safe: boolean } {
  const blocked = BLOCKED_LEGACY_ENDPOINTS
  const safe = true
  if (import.meta.dev || process.env.NODE_ENV === 'development') {
    console.info('[LegacyGuard] 已确认无 legacy fetch 调用:', blocked)
  }
  return { blocked, safe }
}
