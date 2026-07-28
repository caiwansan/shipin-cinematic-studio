<!-- TodayTasks — 今日 AI 招聘任务组件 -->
<!-- TASK-UX-01: 统一使用 recruitment-tokens.css -->
<template>
  <div class="today-tasks">
    <div class="tt-header">
      <h3 class="tt-title">📌 今日 AI 招聘任务</h3>
    </div>

    <div v-if="hasTasks" class="tt-grid">
      <div class="tt-item">
        <span class="tt-item-value">{{ pendingCandidates }}</span>
        <span class="tt-item-label">待分析候选人</span>
      </div>
      <div class="tt-item">
        <span class="tt-item-value">{{ pendingJobs }}</span>
        <span class="tt-item-label">待优化 JD</span>
      </div>
      <div class="tt-item">
        <span class="tt-item-value">{{ pendingResumes }}</span>
        <span class="tt-item-label">待筛选简历</span>
      </div>
    </div>

    <div v-else class="tt-empty">
      <div class="tt-empty-icon">✅</div>
      <p class="tt-empty-text">暂无待处理任务，创建岗位开始招聘吧</p>
      <button class="tt-empty-btn" @click="$emit('create-job')">
        ➕ 创建岗位
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  pendingCandidates: number
  pendingJobs: number
  pendingResumes: number
}>()

defineEmits<{
  (e: 'create-job'): void
}>()

const hasTasks = computed(() => {
  return props.pendingCandidates > 0 || props.pendingJobs > 0 || props.pendingResumes > 0
})
</script>

<style scoped>
@import '~/assets/styles/recruitment-tokens.css';

.today-tasks {
  background: var(--rec-bg-secondary, #fff);
  border: 1px solid var(--rec-border-primary, #e5e7eb);
  border-radius: var(--product-radius-card, 10px);
  padding: var(--rec-space-5, 20px);
  box-shadow: var(--product-shadow-card, none);
}

.tt-header {
  margin-bottom: var(--rec-space-4, 16px);
}

.tt-title {
  font-size: var(--rec-text-lg, 16px);
  font-weight: 600;
  color: var(--rec-text-primary, #1a1a1a);
  margin: 0;
}

.tt-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--rec-space-4, 16px);
}

.tt-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--rec-space-4, 16px);
  background: var(--product-gradient-ai, rgba(37, 99, 235, 0.04));
  border: 1px solid var(--rec-border-primary, #e5e7eb);
  border-radius: var(--rec-radius-md, 6px);
}

.tt-item-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--rec-brand, #2563eb);
  line-height: 1.2;
}

.tt-item-label {
  font-size: var(--rec-text-sm, 12px);
  color: var(--rec-text-muted, #9ca3af);
  margin-top: 4px;
}

.tt-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--rec-space-8, 32px) var(--rec-space-4, 16px);
  text-align: center;
}

.tt-empty-icon {
  font-size: 2.5rem;
  margin-bottom: var(--rec-space-3, 12px);
}

.tt-empty-text {
  font-size: var(--rec-text-md, 14px);
  color: var(--rec-text-muted, #9ca3af);
  margin: 0 0 var(--rec-space-4, 16px);
}

.tt-empty-btn {
  padding: 10px 24px;
  font-size: var(--rec-text-md, 14px);
  font-weight: 600;
  background: var(--product-gradient-primary, linear-gradient(135deg, #2563eb, #3b82f6));
  border: none;
  border-radius: var(--rec-radius-md, 6px);
  color: #fff;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s;
}

.tt-empty-btn:hover {
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.3);
  transform: translateY(-1px);
}

@media (max-width: 768px) {
  .tt-grid {
    grid-template-columns: 1fr;
  }
}
</style>
