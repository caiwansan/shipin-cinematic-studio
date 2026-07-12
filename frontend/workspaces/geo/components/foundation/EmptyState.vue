<template>
  <div
    v-if="hasContent"
    class="foundation-empty"
  >
    <div class="foundation-empty__icon">{{ icon }}</div>
    <h3 class="foundation-empty__title">{{ resolvedTitle }}</h3>
    <p v-if="resolvedDescription" class="foundation-empty__description">
      {{ resolvedDescription }}
    </p>
    <button
      v-if="props.onAction"
      class="foundation-empty__action"
      @click="props.onAction"
    >
      {{ resolvedActionLabel }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EmptyStateType } from '~/workspaces/geo/types/foundation'

const props = withDefaults(defineProps<{
  type?: EmptyStateType
  title?: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}>(), {
  type: 'custom',
})

/**
 * 默认配置映射
 */
const defaultConfig: Record<string, { icon: string; title: string; description: string }> = {
  'new-user': {
    icon: '📋',
    title: '还没有数据',
    description: '开始创建品牌后即可开始分析',
  },
  'no-results': {
    icon: '🔍',
    title: 'AI 暂无分析结果',
    description: '建议完善品牌信息后重新检测',
  },
  'no-history': {
    icon: '📅',
    title: '暂无历史记录',
    description: '完成优化后即可查看历史数据',
  },
  'no-brand': {
    icon: '🏷️',
    title: '尚未创建品牌',
    description: '创建品牌后系统将自动分析',
  },
  'no-connection': {
    icon: '🔗',
    title: '尚未连接渠道',
    description: '添加发布渠道后可将品牌知识发布到更多平台',
  },
  'no-selection': {
    icon: '📌',
    title: '未选择项目',
    description: '请选择一个项目以继续',
  },
  'custom': {
    icon: '💡',
    title: '',
    description: '',
  },
}

const config = computed(() => {
  return defaultConfig[props.type ?? 'custom'] ?? defaultConfig.custom
})

const icon = computed(() => config.value.icon)

const resolvedTitle = computed(() => {
  if (props.title) return props.title
  return config.value.title
})

const resolvedDescription = computed(() => {
  if (props.description) return props.description
  return config.value.description
})

const resolvedActionLabel = computed(() => {
  if (props.actionLabel) return props.actionLabel
  // 默认按钮文案
  return '开始'
})

/**
 * 如果既没有 title 也没有 type，不渲染
 * type=custom 且没传 title 时，也不渲染
 */
const hasContent = computed(() => {
  if (props.title) return true
  if (!props.type || props.type === 'custom') return false
  return true
})
</script>

<style scoped>
.foundation-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 56px 24px;
  min-height: 240px;
}

.foundation-empty__icon {
  font-size: 48px;
  line-height: 1;
  margin-bottom: 16px;
}

.foundation-empty__title {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 8px 0;
}

.foundation-empty__description {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 24px 0;
  max-width: 400px;
  line-height: 1.5;
}

.foundation-empty__action {
  display: inline-flex;
  align-items: center;
  padding: 10px 28px;
  background: #3b82f6;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.foundation-empty__action:hover {
  background: #2563eb;
}

.foundation-empty__action:active {
  background: #1d4ed8;
}
</style>
