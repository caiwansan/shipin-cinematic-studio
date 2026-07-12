/**
 * StatusRegistry — 状态横幅主题注册表
 *
 * 通过 Design Token 引用颜色，支持 Dark Mode / Theme Brand 覆盖。
 */
import type { Registry } from '../../../lib/registry'

export type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral'

export interface StatusTheme {
  tokenBg: string
  tokenBorder: string
  tokenText: string
  icon: string
  label: string
}

const defaults: Record<StatusVariant, StatusTheme> = {
  success: { tokenBg: '--geo-status-bg-success',  tokenBorder: '--geo-status-border-success',  tokenText: '--geo-status-text-success',  icon: '✅', label: '成功' },
  warning: { tokenBg: '--geo-status-bg-warning',  tokenBorder: '--geo-status-border-warning',  tokenText: '--geo-status-text-warning',  icon: '⚠️', label: '警告' },
  error:   { tokenBg: '--geo-status-bg-error',    tokenBorder: '--geo-status-border-error',    tokenText: '--geo-status-text-error',    icon: '❌', label: '错误' },
  info:    { tokenBg: '--geo-status-bg-info',      tokenBorder: '--geo-status-border-info',      tokenText: '--geo-status-text-info',      icon: 'ℹ️', label: '信息' },
  neutral: { tokenBg: '--geo-status-bg-neutral',  tokenBorder: '--geo-status-border-neutral',  tokenText: '--geo-status-text-neutral',  icon: '•',  label: '默认' },
}

// Simple in-memory status registry
const _store = new Map(Object.entries(defaults)) as Map<StatusVariant | string, StatusTheme>

export function registerStatusVariant(key: string, theme: StatusTheme): void {
  _store.set(key, theme)
}

export function resolveStatusVariant(key: string): StatusTheme | undefined {
  return _store.get(key)
}

export function listStatusVariants(): string[] {
  return Array.from(_store.keys())
}
