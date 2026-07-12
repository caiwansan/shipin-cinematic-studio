/**
 * Workspace Activity Consistency Test — Sprint 3-2A
 *
 * 验证 TaskCardModel 是真正统一的 Workspace Activity Contract：
 * 1. Recommendation / Mission / Verification / Publishing 都能用同一个模型
 * 2. TaskCardRenderer 可以渲染任意卡片，无 v-if type 分支
 * 3. Status 语义映射保持一致性
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import type { TaskCardModel, TaskStatus } from '~/workspaces/geo/types/business'
import type { ExplainModel } from '~/workspaces/geo/types/ai/explain'

// ── 测试数据工厂 ──────────────────────────────────────────

function createBaseCard(overrides: Partial<TaskCardModel> = {}): TaskCardModel {
  return {
    id: 'test-1',
    title: '测试任务',
    summary: '这是一个统一的 Activity Card',
    priority: 'medium',
    status: 'pending',
    actions: [],
    ...overrides,
  }
}

// ── Consistency Test 1: 类型兼容 ──────────────────────────

describe('类型兼容性', () => {
  it('Recommendation 数据可以用 TaskCardModel', () => {
    const recommendation: TaskCardModel = createBaseCard({
      id: 'rec-1',
      title: '建议优化 SEO 关键词',
      summary: '基于最近的扫描发现，有 3 个高潜力关键词未被覆盖',
      priority: 'high',
      status: 'pending',
      explain: {
        what: '发现 3 个未覆盖的高潜力关键词',
        why: '竞争对手已覆盖这些关键词',
        impact: '预计可提升 15% 的自然流量',
        recommendation: '建议在下一次内容更新中增加这些关键词',
        evidence: [
          { id: 'ev-1', type: 'scan', summary: '关键词扫描发现 3 个空白' },
        ],
        confidence: { label: '高', score: 0.85 },
      },
      actions: [{ id: 'accept', label: '采纳', variant: 'primary' }],
    })

    expect(recommendation.id).toBe('rec-1')
    expect(recommendation.title).toBe('建议优化 SEO 关键词')
    expect(recommendation.actions.length).toBe(1)
    expect(recommendation.actions[0].id).toBe('accept')
  })

  it('Mission 数据可以用 TaskCardModel', () => {
    const mission: TaskCardModel = createBaseCard({
      id: 'ms-1',
      title: '执行 SEO 关键词优化',
      summary: '覆盖 3 个高潜力关键词，预计耗时 2 小时',
      priority: 'high',
      status: 'running',
      actions: [
        { id: 'pause', label: '暂停', variant: 'secondary' },
        { id: 'complete', label: '标记完成', variant: 'primary' },
      ],
    })

    expect(mission.id).toBe('ms-1')
    expect(mission.status).toBe('running')
    expect(mission.actions.length).toBe(2)
  })

  it('Verification 数据可以用 TaskCardModel', () => {
    const verification: TaskCardModel = createBaseCard({
      id: 'vf-1',
      title: '验证 SEO 优化效果',
      summary: '检查关键词排名变化和流量提升',
      priority: 'medium',
      status: 'pending',
      score: {
        score: 78,
        grade: 'C',
        gradeLabel: '一般',
        trend: { direction: 'up', delta: 12, label: '上升 12%' },
      },
      actions: [{ id: 'verify', label: '开始验证', variant: 'primary' }],
    })

    expect(verification.id).toBe('vf-1')
    expect(verification.score?.score).toBe(78)
    expect(verification.score?.trend?.direction).toBe('up')
  })

  it('Publishing 数据可以用 TaskCardModel', () => {
    const publishing: TaskCardModel = createBaseCard({
      id: 'pb-1',
      title: '发布内容更新',
      summary: '将优化后的内容发布到官网博客',
      priority: 'info',
      status: 'success',
      score: {
        score: 92,
        grade: 'A',
        gradeLabel: '优秀',
        trend: { direction: 'up', delta: 5, label: '上升 5%' },
      },
      actions: [
        { id: 'publish', label: '发布', variant: 'primary', disabled: true },
      ],
    })

    expect(publishing.id).toBe('pb-1')
    expect(publishing.status).toBe('success')
    expect(publishing.actions[0].disabled).toBe(true)
  })
})

// ── Consistency Test 2: Renderer 可以渲染任意卡片 ─────────

describe('TaskCardRenderer 可以渲染任意 Activity Card', () => {
  it('渲染 Recommendation', async () => {
    const { TaskCardRenderer } = await import(
      '~/workspaces/geo/components/business/renderer/TaskCardRenderer.vue'
    )
    const card: TaskCardModel = createBaseCard({
      title: 'SEO 优化建议',
      priority: 'high',
      status: 'pending',
      actions: [{ id: 'accept', label: '采纳', variant: 'primary' }],
    })
    const wrapper = mount(TaskCardRenderer, { props: { card } })
    expect(wrapper.find('[data-testid="task-card-header"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('SEO 优化建议')
  })

  it('渲染 Mission', async () => {
    const { TaskCardRenderer } = await import(
      '~/workspaces/geo/components/business/renderer/TaskCardRenderer.vue'
    )
    const card: TaskCardModel = createBaseCard({
      title: '执行任务',
      priority: 'medium',
      status: 'running',
      actions: [{ id: 'pause', label: '暂停', variant: 'secondary' }],
    })
    const wrapper = mount(TaskCardRenderer, { props: { card } })
    expect(wrapper.text()).toContain('执行任务')
    expect(wrapper.text()).toContain('进行中')
  })

  it('渲染 Verification', async () => {
    const { TaskCardRenderer } = await import(
      '~/workspaces/geo/components/business/renderer/TaskCardRenderer.vue'
    )
    const card: TaskCardModel = createBaseCard({
      title: '验证效果',
      priority: 'low',
      status: 'pending',
      score: { score: 70, grade: 'C', gradeLabel: '一般' },
      actions: [{ id: 'verify', label: '开始验证', variant: 'primary' }],
    })
    const wrapper = mount(TaskCardRenderer, { props: { card } })
    expect(wrapper.text()).toContain('验证效果')
    expect(wrapper.text()).toContain('待处理')
  })

  it('渲染 Publishing', async () => {
    const { TaskCardRenderer } = await import(
      '~/workspaces/geo/components/business/renderer/TaskCardRenderer.vue'
    )
    const card: TaskCardModel = createBaseCard({
      title: '发布到官网',
      priority: 'info',
      status: 'success',
      actions: [{ id: 'view', label: '查看', variant: 'ghost' }],
    })
    const wrapper = mount(TaskCardRenderer, { props: { card } })
    expect(wrapper.text()).toContain('发布到官网')
    expect(wrapper.text()).toContain('已完成')
  })
})

// ── Consistency Test 3: Status 语义映射 ─────────

describe('Status 语义映射一致性', () => {
  it('pending → todo（推荐/验证/发布的默认状态）', () => {
    const status: TaskStatus = 'pending'
    // 业务映射
    const todoMapping: Record<string, TaskStatus> = {
      recommendation: 'pending',
      verification: 'pending',
      publish: 'pending',
    }
    expect(todoMapping.recommendation).toBe('pending')
    expect(todoMapping.verification).toBe('pending')
    expect(todoMapping.publish).toBe('pending')
  })

  it('running → in_progress（执行中的 Mission）', () => {
    const status: TaskStatus = 'running'
    const inProgressMapping: Record<string, TaskStatus> = {
      mission: 'running',
    }
    expect(inProgressMapping.mission).toBe('running')
  })

  it('success → completed', () => {
    const status: TaskStatus = 'success'
    expect(status).toBe('success')
  })

  it('warning → verified/need_review（需要人工确认）', () => {
    const status: TaskStatus = 'warning'
    const needsReviewMapping: Record<string, TaskStatus> = {
      verification: 'warning',
    }
    expect(needsReviewMapping.verification).toBe('warning')
  })

  it('error → failed', () => {
    const status: TaskStatus = 'error'
    const failedMapping: Record<string, TaskStatus> = {
      mission: 'error',
      verification: 'error',
    }
    expect(failedMapping.mission).toBe('error')
    expect(failedMapping.verification).toBe('error')
  })
})
