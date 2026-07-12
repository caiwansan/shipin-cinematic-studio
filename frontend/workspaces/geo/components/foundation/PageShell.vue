<template>
  <main class="foundation-page-shell" data-testid="page-shell">
    <!-- PageHeader 始终渲染 -->
    <PageHeaderEl
      :title="title"
      :description="description"
      :breadcrumbs="breadcrumbs"
    />

    <!-- Summary Slot — 始终在加载区域之上，独立于 displayState -->
    <section v-if="$slots.summary" class="foundation-page-shell__summary" data-testid="page-summary">
      <slot name="summary" />
    </section>

    <!-- 状态区域 — 按 displayState 切换 -->
    <section class="foundation-page-shell__state" data-testid="page-state">
      <LoadingStateEl v-if="displayState === 'loading'" variant="skeleton" />
      <ErrorStateEl
        v-else-if="displayState === 'error'"
        :title="props.error!.title"
        :reason="props.error!.reason"
        :suggestion="props.error!.suggestion"
        :on-retry="props.error!.onRetry"
      />
      <EmptyStateEl
        v-else-if="displayState === 'empty'"
        v-bind="getEmptyBindings(props.empty!)"
      />
      <slot v-else name="content" />
    </section>

    <!-- Explain Slot — 独立于状态，但可由 hideExplain 控制 -->
    <section
      v-if="$slots.explain && !hideExplain"
      class="foundation-page-shell__explain"
      data-testid="page-explain"
    >
      <slot name="explain" />
    </section>

    <!-- Next Action Slot — 独立于状态，但可由 hideNext 控制 -->
    <section
      v-if="$slots.next && !hideNext"
      class="foundation-page-shell__next"
      data-testid="page-next"
    >
      <slot name="next" />
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Breadcrumb, EmptyStateConfig, ErrorState, EmptyStateType } from '~/workspaces/geo/types/foundation'
import PageHeader from './PageHeader.vue'
import PageHeaderEl from './PageHeader.vue'
import LoadingStateEl from './LoadingState.vue'
import EmptyStateEl from './EmptyState.vue'
import ErrorStateEl from './ErrorState.vue'

interface PageShellProps {
  /** 页面标题，渲染为 <h1> */
  title: string
  /** 页面描述 */
  description?: string
  /** 面包屑路径 */
  breadcrumbs?: Breadcrumb[]
  /** 是否处于加载状态 */
  loading?: boolean
  /** 错误状态（非 null 时显示错误卡片） */
  error?: ErrorState | null
  /** 空状态配置（非 null 时显示空状态） */
  empty?: EmptyStateConfig | null
  /** 是否隐藏 explain slot */
  hideExplain?: boolean
  /** 是否隐藏 next slot */
  hideNext?: boolean
}

const props = defineProps<PageShellProps>()

/**
 * 单一状态入口 — 所有模板围绕 displayState 展开
 * 优先级：loading > error > empty > default
 */
const displayState = computed<'loading' | 'error' | 'empty' | 'default'>(() => {
  if (props.loading) return 'loading'
  if (props.error) return 'error'
  if (props.empty) return 'empty'
  return 'default'
})

/**
 * 将 EmptyStateConfig 转换为 EmptyState 组件的 props
 * 确保 EmptyStateConfig 的接口兼容 EmptyState 的 props
 */
function getEmptyBindings(config: NonNullable<EmptyStateConfig>): {
  type?: EmptyStateType
  title?: string
  description?: string
  actionLabel?: string
  onAction?: () => void
} {
  return {
    type: config.type,
    title: config.title,
    description: config.description,
    actionLabel: config.actionLabel,
    onAction: config.onAction,
  }
}
</script>

<style scoped>
.foundation-page-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 24px;
}

.foundation-page-shell__summary {
  padding: 0 0 20px;
  min-height: 0;
}

.foundation-page-shell__state {
  flex: 1;
  min-height: 0;
}

.foundation-page-shell__explain {
  padding: 0 0 16px;
}

.foundation-page-shell__next {
  padding: 16px 0 0;
  border-top: 1px solid #e2e8f0;
  position: sticky;
  bottom: 0;
  background-color: #fff;
  z-index: 10;
}
<style scoped>
.foundation-page-shell {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 32px;
  min-height: calc(100vh - 80px);
}

.foundation-page-shell__summary,
.foundation-page-shell__state,
.foundation-page-shell__explain,
.foundation-page-shell__next {
  margin-top: 20px;
}

@media (max-width: 640px) {
  .foundation-page-shell {
    padding: 16px;
  }
}
<style scoped>
.foundation-page-shell {
  padding: 24px 32px;
  min-height: calc(100vh - 80px);
}

.foundation-page-shell__summary,
.foundation-page-shell__state,
.foundation-page-shell__explain,
.foundation-page-shell__next {
  margin-top: 24px;
}

@media (max-width: 640px) {
  .foundation-page-shell {
    padding: 16px;
  }
}
</style>
