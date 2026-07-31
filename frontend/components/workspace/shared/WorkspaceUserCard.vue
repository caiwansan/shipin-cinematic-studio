<!--
  WorkspaceUserCard.vue — 左侧导航底部用户身份卡片
  Sprint-13: 统一 Shell 改造

  展示：
  ┌─────────────────┐
  │ 🟢 admin        │
  │ 昆仑镜科技       │
  │ ● 人事部 ¥999/月│
  │ ⚙️ 模型  📦 套餐│
  └─────────────────┘
-->
<template>
  <div class="w-user-card">
    <!-- User Identity -->
    <div class="wuc-row-top">
      <div class="wuc-avatar" :title="username">
        {{ avatarLetter }}
      </div>
      <div class="wuc-info">
        <div class="wuc-name">{{ displayName }}</div>
        <div class="wuc-org">{{ orgName }}</div>
      </div>
    </div>

    <!-- Subscription Status -->
    <div class="wuc-plan-row" v-if="planName">
      <span class="wuc-plan-dot"></span>
      <span class="wuc-plan-name">{{ planName }}</span>
    </div>

    <!-- Actions -->
    <div class="wuc-actions">
      <button class="wuc-btn" @click="$emit('open-model-settings')" title="模型设置">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        <span>模型</span>
      </button>
      <button class="wuc-btn" @click="$emit('open-billing')" title="套餐管理">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
        </svg>
        <span>套餐</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  username: string
  displayName?: string
  orgName?: string
  planName?: string
}>()

defineEmits<{
  'open-model-settings': []
  'open-billing': []
}>()

const avatarLetter = computed(() => {
  return (props.displayName || props.username || '?').charAt(0).toUpperCase()
})
</script>

<style scoped>
.w-user-card {
  padding: 12px;
  border-top: 1px solid var(--color-border-primary, #334155);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wuc-row-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.wuc-avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--color-decision, #3b82f6), var(--color-intelligence, #8b5cf6));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}

.wuc-info {
  flex: 1;
  min-width: 0;
}

.wuc-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary, #F1F5F9);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wuc-org {
  font-size: 11px;
  color: var(--color-text-muted, #64748B);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wuc-plan-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--color-bg-secondary, #1e293b);
  border-radius: 6px;
  font-size: 11px;
  color: var(--color-success, #22c55e);
  font-weight: 500;
}

.wuc-plan-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-success, #22c55e);
  flex-shrink: 0;
}

.wuc-plan-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wuc-actions {
  display: flex;
  gap: 4px;
}

.wuc-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 8px;
  border: 1px solid var(--color-border-primary, #334155);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted, #94A3B8);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.wuc-btn:hover {
  background: var(--color-bg-hover, #1e293b);
  color: var(--color-text-secondary, #CBD5E1);
  border-color: var(--color-border-hover, #475569);
}
</style>
