<!-- AINextActionCard — CEO 下一步行动建议 -->
<!-- 基于企业当前状态，AI 推荐最紧迫的下一步行动 -->
<template>
  <div class="next-action-card">
    <div class="card-header">
      <h4 class="card-title">💡 AI 建议行动</h4>
      <span class="action-count">{{ actions.length }} 条建议</span>
    </div>

    <div v-if="actions.length > 0" class="action-list">
      <div
        v-for="(action, idx) in actions"
        :key="idx"
        class="action-item"
        :class="`action-${action.type}`"
        @click="handleAction(action)"
      >
        <span class="action-icon">{{ action.icon }}</span>
        <div class="action-content">
          <div class="action-title">{{ action.title }}</div>
          <div class="action-desc">{{ action.description }}</div>
        </div>
        <span class="action-arrow">→</span>
      </div>
    </div>

    <div v-else-if="loading" class="action-loading">
      <span class="text-xs text-gray-500">AI 正在分析企业状态...</span>
    </div>

    <div v-else class="action-empty">
      <span class="text-xs text-gray-500">暂无建议，AI 部门运行正常</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface NextAction {
  type: 'urgent' | 'suggestion' | 'warning'
  icon: string
  title: string
  description: string
  action?: string
}

const actions = ref<NextAction[]>([])
const loading = ref(true)

function handleAction(action: NextAction) {
  // 根据 action 类型触发对应操作
  if (action.action === 'create_agent') {
    window.dispatchEvent(new CustomEvent('navigate-to-module', { detail: { module: 'ai-employees' } }))
  } else if (action.action === 'connect_channel') {
    window.dispatchEvent(new CustomEvent('navigate-to-module', { detail: { module: 'channels' } }))
  } else if (action.action === 'bind_model') {
    window.dispatchEvent(new CustomEvent('navigate-to-module', { detail: { module: 'ai-employees' } }))
  } else if (action.action === 'view_signals') {
    window.dispatchEvent(new CustomEvent('navigate-to-module', { detail: { module: 'intelligence' } }))
  } else if (action.action === 'view_dashboard') {
    // already on dashboard
  }
}

async function loadNextActions() {
  try {
    const res = await fetch('/api/enterprise/agent-identity/next-actions')
    if (res.ok) {
      const data = await res.json()
      if (data.code === 0) {
        actions.value = data.data
      }
    }
  } catch (e) {
    console.warn('[AINextActionCard] Load failed:', e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadNextActions()
})
</script>

<style scoped>
.next-action-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.action-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  background: var(--color-bg-elevated);
  padding: 2px 8px;
  border-radius: 99px;
}

.action-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.action-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.action-item:hover {
  transform: translateX(2px);
}

.action-urgent {
  background: rgba(239, 68, 68, 0.05);
  border-color: rgba(239, 68, 68, 0.2);
}

.action-urgent:hover {
  background: rgba(239, 68, 68, 0.1);
}

.action-warning {
  background: rgba(245, 158, 11, 0.05);
  border-color: rgba(245, 158, 11, 0.2);
}

.action-warning:hover {
  background: rgba(245, 158, 11, 0.1);
}

.action-suggestion {
  background: rgba(59, 130, 246, 0.05);
  border-color: rgba(59, 130, 246, 0.2);
}

.action-suggestion:hover {
  background: rgba(59, 130, 246, 0.1);
}

.action-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.action-content {
  flex: 1;
  min-width: 0;
}

.action-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 2px;
}

.action-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-arrow {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.action-loading,
.action-empty {
  text-align: center;
  padding: var(--space-md);
}
</style>
