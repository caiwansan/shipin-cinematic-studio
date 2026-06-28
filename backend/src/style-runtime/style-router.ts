/**
 * style-runtime/style-router.ts
 *
 * ⚔️ Phase 4 — Style Router
 *
 * 输入：DirectorPlan + StyleType
 * 输出：StyleProfile
 *
 * 规则：
 *   - pure mapping only
 *   - no inference
 *   - no generation of structure
 *   - 给定相同输入 → 相同 style
 */

import type { DirectorPlan } from '../director-runtime/types.js'
import { getStyle, listStyles, type StyleProfile } from './style-registry.js'

// ── Style 选择器 ──

export type StyleSelectionStrategy = 'fixed' | 'auto_by_genre' | 'random'

export interface StyleSelection {
  /** 选中的风格名称 */
  styleName: string
  /** 选择策略 */
  strategy: StyleSelectionStrategy
  /** 选择理由 */
  rationale: string
}

// ── 风格匹配（genre → style） ──

const GENRE_TO_STYLE: Record<string, string> = {
  '灾难': 'noir',
  '爱情': 'cinematic',
  '悬疑': 'noir',
  '古装': 'vintage',
  '科幻': 'tech',
  '冒险': 'cinematic',
  '成长': 'minimalist',
  '战争': 'noir',
  '喜剧': 'anime',
  '奇幻': 'anime',
}

// ── 选择器 ──

/**
 * selectStyle — DirectorPlan + 策略 → StyleProfile
 *
 * 支持三种选择策略：
 *   - fixed: 使用指定风格
 *   - auto_by_genre: 根据叙事类型自动匹配
 *   - random: 随机选择
 */
export function selectStyle(
  plan: DirectorPlan,
  strategy: StyleSelectionStrategy = 'auto_by_genre',
  preferredStyle?: string
): StyleSelection {
  switch (strategy) {
    case 'fixed': {
      if (!preferredStyle) {
        return {
          styleName: 'cinematic',
          strategy: 'fixed',
          rationale: '未指定风格，使用默认电影感',
        }
      }
      const exists = getStyle(preferredStyle)
      return {
        styleName: exists ? preferredStyle : 'cinematic',
        strategy: 'fixed',
        rationale: exists
          ? `用户指定风格: ${preferredStyle}`
          : `风格 ${preferredStyle} 不存在，回退到电影感`,
      }
    }

    case 'auto_by_genre': {
      // 从 plan 的 themeKeywords 匹配
      const keywords = plan.narrativeConstraints?.themeKeywords ?? []
      let matched = 'cinematic'

      for (const keyword of keywords) {
        const mapped = GENRE_TO_STYLE[keyword]
        if (mapped) {
          matched = mapped
          break
        }
      }

      // 如果关键词没命中，从 intent 识别
      if (matched === 'cinematic' && plan.narrativeIntent) {
        const intent = plan.narrativeIntent
        for (const [genre, style] of Object.entries(GENRE_TO_STYLE)) {
          if (intent.includes(genre)) {
            matched = style
            break
          }
        }
      }

      return {
        styleName: matched,
        strategy: 'auto_by_genre',
        rationale: `根据叙事类型匹配风格: ${matched}`,
      }
    }

    case 'random': {
      const all = listStyles()
      const randomIdx = Math.floor(Math.random() * all.length)
      const selected = all[randomIdx]
      return {
        styleName: selected.name,
        strategy: 'random',
        rationale: `随机选择风格: ${selected.displayName}`,
      }
    }

    default:
      return {
        styleName: 'cinematic',
        strategy: 'auto_by_genre',
        rationale: '默认电影感风格',
      }
  }
}

/**
 * resolveStyle — 根据选择结果获取完整的 StyleProfile
 */
export function resolveStyle(selection: StyleSelection): StyleProfile {
  const style = getStyle(selection.styleName)
  if (style) return style

  // fallback
  console.warn(`[STYLE_ROUTER] 风格 ${selection.styleName} 不存在，回退到电影感`)
  return getStyle('cinematic')!
}

export { getStyle, listStyles }
