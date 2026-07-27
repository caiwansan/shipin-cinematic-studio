<!-- MetricCard — 数据指标卡片 -->
<!-- UX-03: 纯展示 + 可点击跳转，无 AI 词汇 -->
<template>
  <div class="metric-card" :class="{ clickable: !!href }" @click="onClick">
    <div class="metric-label">{{ label }}</div>
    <div class="metric-value">{{ value }}</div>
    <div v-if="trend" class="metric-trend">
      <span v-if="trendDirection === 'up'" class="trend-up">↑ {{ trend }}</span>
      <span v-else-if="trendDirection === 'down'" class="trend-down">↓ {{ trend }}</span>
      <span v-else class="trend-neutral">{{ trend }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  value: string | number
  trend?: string
  trendDirection?: 'up' | 'down' | 'neutral'
  href?: string
}>(), {
  trendDirection: 'neutral',
})

const router = useRouter()

function onClick() {
  if (props.href) {
    router.push(props.href)
  }
}
</script>

<style scoped>
.metric-card {
  background: var(--rec-bg-secondary);
  border: 1px solid var(--rec-border-primary);
  border-radius: var(--rec-radius-lg);
  padding: var(--rec-space-6);
  text-align: center;
  transition: box-shadow 0.15s;
}

.metric-card.clickable {
  cursor: pointer;
}

.metric-card.clickable:hover {
  box-shadow: var(--rec-shadow-md);
}

.metric-label {
  font-size: var(--rec-text-sm);
  color: var(--rec-text-secondary);
  margin-bottom: var(--rec-space-2);
}

.metric-value {
  font-size: var(--rec-text-3xl);
  font-weight: 700;
  color: var(--rec-text-primary);
  font-family: var(--rec-font-mono);
  line-height: 1.2;
}

.metric-trend {
  font-size: var(--rec-text-xs);
  margin-top: var(--rec-space-2);
}

.trend-up {
  color: var(--rec-success);
}

.trend-down {
  color: var(--rec-danger);
}

.trend-neutral {
  color: var(--rec-text-muted);
}
</style>
