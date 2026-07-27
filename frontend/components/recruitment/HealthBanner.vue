<!-- HealthBanner — 招聘运行状态横幅 -->
<!-- UX-03: 第一屏最顶部，5 秒内知道今天正常还是异常 -->
<template>
  <div class="health-banner" :class="`health-${status}`">
    <span class="health-icon">
      <span v-if="status === 'healthy'">✓</span>
      <span v-else-if="status === 'warning'">!</span>
      <span v-else>✕</span>
    </span>
    <div class="health-content">
      <span class="health-message">{{ message }}</span>
      <span class="health-summary">{{ summary }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  status: 'healthy' | 'warning' | 'critical'
  message: string
  summary: string
}>()
</script>

<style scoped>
.health-banner {
  display: flex;
  align-items: center;
  gap: var(--rec-space-4);
  padding: var(--rec-space-4) var(--rec-space-6);
  border-radius: var(--rec-radius-lg);
  margin-bottom: var(--rec-space-6);
}

.health-healthy {
  background: var(--rec-success-light);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.health-warning {
  background: var(--rec-warning-light);
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.health-critical {
  background: var(--rec-danger-light);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.health-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: var(--rec-text-md);
  font-weight: 700;
  flex-shrink: 0;
}

.health-healthy .health-icon {
  background: var(--rec-success);
  color: #fff;
}

.health-warning .health-icon {
  background: var(--rec-warning);
  color: #fff;
}

.health-critical .health-icon {
  background: var(--rec-danger);
  color: #fff;
}

.health-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.health-message {
  font-size: var(--rec-text-md);
  font-weight: 500;
}

.health-healthy .health-message {
  color: var(--rec-success);
}

.health-warning .health-message {
  color: var(--rec-warning);
}

.health-critical .health-message {
  color: var(--rec-danger);
}

.health-summary {
  font-size: var(--rec-text-sm);
  color: var(--rec-text-secondary);
}
</style>
