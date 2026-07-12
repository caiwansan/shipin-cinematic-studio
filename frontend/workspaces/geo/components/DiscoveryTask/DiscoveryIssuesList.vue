<!-- @deprecated 未被引用，保留作参考 -->
<template>
  <div class="dt-issues">
    <h3 class="dt-issues__title">发现问题</h3>
    <div v-if="issues.length === 0" class="dt-issues__empty">暂无发现</div>
    <div
      v-for="(issue, i) in issues"
      :key="i"
      class="dt-issues__item"
      :class="'dt-issues__item--' + issue.severity"
    >
      <div class="dt-issues__severity">
        <span v-if="issue.severity === 'high'">🔴</span>
        <span v-else-if="issue.severity === 'medium'">🟡</span>
        <span v-else>🟢</span>
      </div>
      <div class="dt-issues__body">
        <p class="dt-issues__text">{{ issue.text }}</p>
        <NuxtLink
          v-if="issue.actionUrl"
          :to="issue.actionUrl"
          class="dt-issues__action"
        >
          {{ issue.actionLabel || '查看详情 →' }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  issues: Array<{
    severity: 'high' | 'medium' | 'low'
    text: string
    actionUrl?: string
    actionLabel?: string
  }>
}>()
</script>

<style scoped>
.dt-issues {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px 24px;
}
.dt-issues__title {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 16px;
}
.dt-issues__empty {
  color: #9ca3af;
  font-size: 14px;
  text-align: center;
  padding: 16px;
}
.dt-issues__item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f3f4f6;
  align-items: flex-start;
}
.dt-issues__item:last-child {
  border-bottom: none;
}
.dt-issues__severity {
  flex-shrink: 0;
  font-size: 18px;
  margin-top: 2px;
}
.dt-issues__body {
  flex: 1;
  min-width: 0;
}
.dt-issues__text {
  font-size: 14px;
  color: #374151;
  margin: 0 0 6px;
  line-height: 1.5;
}
.dt-issues__action {
  font-size: 13px;
  font-weight: 600;
  color: #3b82f6;
  text-decoration: none;
}
.dt-issues__action:hover {
  text-decoration: underline;
}
.dt-issues__item--high .dt-issues__text { color: #dc2626; }
.dt-issues__item--medium .dt-issues__text { color: #d97706; }
</style>
