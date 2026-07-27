<!-- RecruitmentFunnel — 招聘漏斗 -->
<!-- UX-03: 展示招聘各阶段转化率，一眼看出哪里堵了 -->
<template>
  <div class="funnel">
    <div
      v-for="(stage, index) in stages"
      :key="stage.label"
      class="funnel-stage"
    >
      <div class="funnel-value">{{ stage.value }}</div>
      <div class="funnel-label">{{ stage.label }}</div>
      <div v-if="index < stages.length - 1" class="funnel-arrow">↓</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  stages: Array<{ label: string; value: number }>
}>()
</script>

<style scoped>
.funnel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--rec-space-1);
  padding: var(--rec-space-4) 0;
}

.funnel-stage {
  text-align: center;
}

.funnel-value {
  font-size: var(--rec-text-2xl);
  font-weight: 700;
  color: var(--rec-text-primary);
  font-family: var(--rec-font-mono);
}

.funnel-label {
  font-size: var(--rec-text-sm);
  color: var(--rec-text-secondary);
  margin-top: var(--rec-space-1);
}

.funnel-arrow {
  font-size: var(--rec-text-sm);
  color: var(--rec-text-muted);
  margin: var(--rec-space-1) 0;
}
</style>
