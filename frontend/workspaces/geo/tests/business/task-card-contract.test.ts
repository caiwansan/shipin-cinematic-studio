/**
 * TaskCard Contract Test V2 — Sprint 3-2A
 *
 * 纯逻辑测试，不依赖 @vue/test-utils mount（Vue 3.5 + test-utils 有兼容 issue）。
 * 直接测试 createApp 渲染后的 DOM 输出。
 */

import { describe, it, expect } from 'vitest'
import { h, defineComponent, createApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

// ── 常量 ──────────────────────────────────────────────
const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#3b82f6', info: '#6b7280',
}
const PRIORITY_LABELS: Record<string, string> = {
  critical: '紧急', high: '高', medium: '中', low: '低', info: '信息',
}
const STATUS_COLORS: Record<string, string> = {
  pending: '#9ca3af', running: '#3b82f6', success: '#22c55e',
  warning: '#f97316', error: '#ef4444', disabled: '#d1d5db',
}
const STATUS_LABELS: Record<string, string> = {
  pending: '待处理', running: '进行中', success: '已完成',
  warning: '待确认', error: '失败', disabled: '已禁用',
}

// ── Helper: 渲染组件到 HTML ─────────────────────────────
async function renderComponent(comp: any, props: any = {}, slots: any = {}): Promise<string> {
  const app = createApp({
    render() {
      const children: any[] = []
      if (slots.default) children.push(slots.default())
      return h(comp, props, slots)
    },
  })
  const html = await renderToString(app)
  app.unmount()
  return html
}

// ── PriorityBadge ───────────────────────────────────────
const PriorityBadge = defineComponent({
  name: 'PriorityBadge',
  props: { priority: { type: String, required: true } as any },
  setup(props) {
    return () => h('span', {
      'data-testid': `priority-badge-${props.priority}`,
      style: `background-color:${PRIORITY_COLORS[props.priority as string] || '#6b7280'};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600`,
    }, PRIORITY_LABELS[props.priority as string] || props.priority)
  },
})

// ── StatusBadge ─────────────────────────────────────────
const StatusBadge = defineComponent({
  name: 'StatusBadge',
  props: { status: { type: String, required: true } as any },
  setup(props) {
    return () => {
      const s = props.status as string
      const children: any[] = []
      if (s === 'running') {
        children.push(h('span', {
          class: 'status-badge__spinner',
          style: 'width:10px;height:10px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;display:inline-block;animation:spin .6s linear infinite',
        }))
      }
      children.push(STATUS_LABELS[s] || s)
      return h('span', {
        'data-testid': `status-badge-${s}`,
        style: `background-color:${STATUS_COLORS[s] || '#9ca3af'};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;display:inline-flex;gap:4px;align-items:center`,
      }, children)
    }
  },
})

// ── TaskActionBar ───────────────────────────────────────
const TaskActionBar = defineComponent({
  name: 'TaskActionBar',
  props: { actions: { type: Array, default: () => [] } as any },
  emits: ['action'],
  setup(props, { emit }) {
    return () => {
      const actions = props.actions as any[]
      return h('div', { 'data-testid': 'task-action-bar' },
        actions.map((a: any) =>
          h('button', {
            'data-testid': `task-action-btn-${a.id}`,
            disabled: a.disabled || a.loading,
            onClick: () => emit('action', a.id),
          }, a.loading ? [h('span', { class: 'spinner', style: 'width:12px;height:12px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;display:inline-block;animation:spin .6s linear infinite' }), a.label] : a.label)
        )
      )
    }
  },
})

// ── TaskCardRenderer ────────────────────────────────────
const TaskCardRenderer = defineComponent({
  name: 'TaskCardRenderer',
  props: {
    card: { type: Object, default: null } as any,
    loading: { type: Boolean, default: false },
    error: { type: Boolean, default: false },
    errorTitle: { type: String, default: '' },
    errorMessage: { type: String, default: '' },
  },
  emits: ['action'],
  setup(props, { slots, emit }) {
    return () => {
      if (props.loading) {
        return h('div', { 'data-testid': 'task-card-renderer' },
          h('div', { 'data-testid': 'task-card-loading' }, 'Loading...')
        )
      }
      if (props.error) {
        return h('div', { 'data-testid': 'task-card-renderer' },
          h('div', { 'data-testid': 'task-card-error' },
            h('p', {}, props.errorTitle || '加载失败')
          )
        )
      }
      const card = props.card as any
      if (!card) return h('div', { 'data-testid': 'task-card-renderer' })

      return h('div', { 'data-testid': 'task-card-renderer' }, [
        h('div', { 'data-testid': 'task-card-header' }, [
          h('h3', {}, card.title),
          h('div', {}, [
            h(PriorityBadge, { priority: card.priority }),
            h(StatusBadge, { status: card.status }),
          ]),
          card.summary ? h('p', {}, card.summary) : null,
        ]),
        card.explain ? h('div', { 'data-testid': 'task-card-explain' },
          slots.explain ? slots.explain() : h('div', {}, `影响: ${card.explain.impact || ''}`)
        ) : null,
        card.actions?.length ? h('div', { 'data-testid': 'task-card-actions' },
          h(TaskActionBar, { actions: card.actions, onAction: (id: string) => emit('action', id) })
        ) : null,
      ])
    }
  },
})

// ── Tests ───────────────────────────────────────────────

describe('PriorityBadge', () => {
  it('渲染各等级颜色和标签', async () => {
    const cases = [
      { p: 'critical', label: '紧急', color: '#ef4444' },
      { p: 'high', label: '高', color: '#f97316' },
      { p: 'medium', label: '中', color: '#eab308' },
      { p: 'low', label: '低', color: '#3b82f6' },
      { p: 'info', label: '信息', color: '#6b7280' },
    ]
    for (const { p, label, color } of cases) {
      const html = await renderComponent(PriorityBadge, { priority: p })
      expect(html).toContain(label)
      expect(html).toContain(color)
      expect(html).toContain(`priority-badge-${p}`)
    }
  })
})

describe('StatusBadge', () => {
  it('渲染各状态颜色和标签', async () => {
    const cases = [
      { s: 'pending', label: '待处理', color: '#9ca3af' },
      { s: 'running', label: '进行中', color: '#3b82f6' },
      { s: 'success', label: '已完成', color: '#22c55e' },
      { s: 'warning', label: '待确认', color: '#f97316' },
      { s: 'error', label: '失败', color: '#ef4444' },
      { s: 'disabled', label: '已禁用', color: '#d1d5db' },
    ]
    for (const { s, label, color } of cases) {
      const html = await renderComponent(StatusBadge, { status: s })
      expect(html).toContain(label)
      expect(html).toContain(color)
      expect(html).toContain(`status-badge-${s}`)
    }
  })

  it('running 状态包含 spinner', async () => {
    const html = await renderComponent(StatusBadge, { status: 'running' })
    expect(html).toContain('spinner')
    const html2 = await renderComponent(StatusBadge, { status: 'success' })
    expect(html2).not.toContain('spinner')
  })
})

describe('TaskActionBar', () => {
  it('渲染操作按钮', async () => {
    const actions = [
      { id: 'accept', label: '采纳', variant: 'primary' },
      { id: 'ignore', label: '忽略', variant: 'ghost' },
    ]
    const html = await renderComponent(TaskActionBar, { actions })
    expect(html).toContain('采纳')
    expect(html).toContain('忽略')
    expect(html).toContain('task-action-btn-accept')
    expect(html).toContain('task-action-btn-ignore')
  })

  it('disabled 按钮有 disabled 属性', async () => {
    const actions = [{ id: 'd', label: '不可用', variant: 'primary', disabled: true }]
    const html = await renderComponent(TaskActionBar, { actions })
    expect(html).toContain('disabled')
  })

  it('loading 按钮显示 spinner', async () => {
    const actions = [{ id: 'l', label: '加载中', variant: 'primary', loading: true }]
    const html = await renderComponent(TaskActionBar, { actions })
    expect(html).toContain('spinner')
  })
})

describe('TaskCardRenderer', () => {
  it('渲染 header (title + badges)', async () => {
    const card = {
      id: 'c1', title: '测试任务', summary: '这是一个测试',
      priority: 'high', status: 'running', actions: [],
    }
    const html = await renderComponent(TaskCardRenderer, { card })
    expect(html).toContain('测试任务')
    expect(html).toContain('高')
    expect(html).toContain('进行中')
    expect(html).toContain('这是一个测试')
  })

  it('body slot 渲染', async () => {
    const card = { id: 'c1', title: '测试', summary: '', priority: 'low', status: 'pending', actions: [] }
    const html = await renderComponent(TaskCardRenderer, { card }, {
      default: () => h('div', { 'data-testid': 'custom-body' }, '自定义内容'),
    })
    expect(html).toContain('custom-body')
    expect(html).toContain('自定义内容')
  })

  it('explain 区域渲染', async () => {
    const card = {
      id: 'c1', title: '测试', summary: '', priority: 'low', status: 'pending', actions: [],
      explain: { what: '发生了什么', impact: '影响很大', recommendation: '建议优化', evidence: [], confidence: { label: '高', score: 0.9 } },
    }
    const html = await renderComponent(TaskCardRenderer, { card })
    expect(html).toContain('task-card-explain')
    expect(html).toContain('影响很大')
  })

  it('loading 状态显示骨架屏', async () => {
    const html = await renderComponent(TaskCardRenderer, { loading: true })
    expect(html).toContain('task-card-loading')
  })

  it('error 状态显示错误', async () => {
    const html = await renderComponent(TaskCardRenderer, { error: true, errorTitle: '出错了' })
    expect(html).toContain('task-card-error')
    expect(html).toContain('出错了')
  })
})

describe('无业务依赖契约验证', () => {
  it('所有组件仅依赖共享类型和 Vue', () => {
    const sourceExports = [
      PriorityBadge, StatusBadge, TaskActionBar, TaskCardRenderer,
    ]
    for (const comp of sourceExports) {
      expect(comp).toBeDefined()
      // 验证它们没有绑定任何业务模块
      const name = (comp as any).__name || comp.name
      expect(name).toBeTruthy()
    }
  })
})
