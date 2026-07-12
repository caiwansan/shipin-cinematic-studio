/**
 * ScoreCard Contract Test
 *
 * 验证 ScoreCard 组件符合冻结 Contract：
 * - Props 类型化
 * - 使用 types/business 中的 ScoreCardModel & GRADE_COLORS
 * - 零业务逻辑
 * - data-testid 覆盖
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ScoreCard from '~/workspaces/geo/components/business/ScoreCard.vue'
import { GRADE_COLORS } from '~/workspaces/geo/types/business'
import type { ScoreCardModel } from '~/workspaces/geo/types/business'

/** 构造默认测试数据 */
function createModel(overrides: Partial<ScoreCardModel> = {}): ScoreCardModel {
  return {
    score: 85,
    grade: 'A',
    gradeLabel: '优秀',
    ...overrides,
  }
}

describe('ScoreCard Contract', () => {
  // ── 用例 1: loading 时展示骨架 ─────────────────────────────
  it('1. loading 时展示骨架', () => {
    const wrapper = mount(ScoreCard, {
      props: {
        data: createModel(),
        loading: true,
      },
    })

    expect(wrapper.find('[data-testid="score-card-loading"]').exists()).toBe(true)
  })

  // ── 用例 2: default 状态展示分数和等级 ─────────────────────
  it('2. default 状态展示分数和等级', () => {
    const wrapper = mount(ScoreCard, {
      props: {
        data: createModel({ score: 92, gradeLabel: '极佳' }),
      },
    })

    expect(wrapper.find('[data-testid="score-card-value"]').text()).toBe('92')
    expect(wrapper.find('[data-testid="score-card-grade"]').text()).toBe('极佳')
  })

  // ── 用例 3: 等级颜色映射正确 ─────────────────────────────
  it.each([
    ['A', GRADE_COLORS.A, 'rgb(34, 197, 94)'],
    ['B', GRADE_COLORS.B, 'rgb(59, 130, 246)'],
    ['C', GRADE_COLORS.C, 'rgb(234, 179, 8)'],
    ['D', GRADE_COLORS.D, 'rgb(249, 115, 22)'],
    ['F', GRADE_COLORS.F, 'rgb(239, 68, 68)'],
  ] as const)('3. 等级 %s 颜色映射为 %s', (grade, _hex, expectedRgb) => {
    const wrapper = mount(ScoreCard, {
      props: {
        data: createModel({ grade: grade as ScoreCardModel['grade'], gradeLabel: grade }),
      },
    })

    const valueEl = wrapper.find('[data-testid="score-card-value"]')
    expect(valueEl.attributes('style')).toContain(expectedRgb)
  })

  // ── 用例 4: trend up 展示 ↑ + 正号 ───────────────────────
  it('4. trend up 展示 ↑ + 正号', () => {
    const wrapper = mount(ScoreCard, {
      props: {
        data: createModel({
          trend: { direction: 'up', delta: 5, label: '较上月' },
        }),
      },
    })

    expect(wrapper.find('[data-testid="score-card-trend"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="score-card-trend-arrow"]').text()).toBe('↑')
    expect(wrapper.find('[data-testid="score-card-trend-delta"]').text()).toBe('+5')
  })

  // ── 用例 5: trend down 展示 ↓ + 数值（不含正号） ──────────
  it('5. trend down 展示 ↓ + 数值', () => {
    const wrapper = mount(ScoreCard, {
      props: {
        data: createModel({
          trend: { direction: 'down', delta: 3, label: '较上月' },
        }),
      },
    })

    expect(wrapper.find('[data-testid="score-card-trend-arrow"]').text()).toBe('↓')
    // delta 为绝对值，方向由箭头指示
    expect(wrapper.find('[data-testid="score-card-trend-delta"]').text()).toBe('3')
  })

  // ── 用例 6: 无 trend 时不渲染趋势区域 ─────────────────────
  it('6. 无 trend 时不渲染趋势区域', () => {
    const wrapper = mount(ScoreCard, {
      props: {
        data: createModel({ trend: undefined }),
      },
    })

    expect(wrapper.find('[data-testid="score-card-trend"]').exists()).toBe(false)
  })

  // ── 用例 7: label 被渲染 ────────────────────────────────
  it('7. label 被渲染', () => {
    const wrapper = mount(ScoreCard, {
      props: {
        data: createModel(),
        label: '品牌健康',
      },
    })

    expect(wrapper.find('[data-testid="score-card-label"]').text()).toBe('品牌健康')
  })

  // ── 用例 8: summary 被渲染 ─────────────────────────────
  it('8. summary 被渲染', () => {
    const wrapper = mount(ScoreCard, {
      props: {
        data: createModel({ summary: '当前品牌表现优异，建议持续关注。' }),
      },
    })

    expect(wrapper.find('[data-testid="score-card-summary"]').text()).toBe('当前品牌表现优异，建议持续关注。')
  })
})
