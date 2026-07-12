/**
 * PriorityRegistry — 优先级标签主题注册表（Token 化）
 */
import type { Registry } from '../../../lib/registry'

export interface PriorityTheme {
  tokenBg: string
  tokenText: string
  tokenBorder: string
  label: string
}

const _store: Record<string, PriorityTheme> = {
  high:   { tokenBg: '--geo-priority-bg-high',   tokenText: '--geo-priority-text-high',   tokenBorder: '--geo-priority-border-high',   label: '高优先级' },
  medium: { tokenBg: '--geo-priority-bg-medium', tokenText: '--geo-priority-text-medium', tokenBorder: '--geo-priority-border-medium', label: '中优先级' },
  low:    { tokenBg: '--geo-priority-bg-low',    tokenText: '--geo-priority-text-low',    tokenBorder: '--geo-priority-border-low',    label: '低优先级' },
}

export function registerPriority(key: string, theme: PriorityTheme): void {
  _store[key] = theme
}

export function resolvePriority(key: string): PriorityTheme | undefined {
  return _store[key]
}

export function listPriorities(): string[] {
  return Object.keys(_store)
}
