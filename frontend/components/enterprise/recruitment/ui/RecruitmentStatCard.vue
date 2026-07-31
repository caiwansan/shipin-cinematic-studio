<template>
  <div class="rec-stat-card" :style="{ '--card-color': resolvedColor }">
    <span class="rec-stat-value">{{ displayValue }}</span>
    <span class="rec-stat-label">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  value?: number | string
  label?: string
  color?: string
}>(), {
  value: 0,
  label: '',
  color: 'var(--color-decision)',
})

const displayValue = computed(() => {
  if (typeof props.value === 'number') {
    return props.value.toLocaleString()
  }
  return props.value || '0'
})

const resolvedColor = computed(() => {
  return props.color.startsWith('--') ? `var(${props.color})` : props.color
})
</script>

<style scoped>
.rec-stat-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-secondary);
  border-radius: 12px;
  transition: background 0.15s;
  min-width: 0;
}

.rec-stat-card:hover {
  background: var(--color-bg-hover);
}

.rec-stat-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: var(--card-color, var(--color-decision));
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.rec-stat-label {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 4px;
  font-weight: 500;
}

@media (max-width: 768px) {
  .rec-stat-card {
    flex: 1 1 calc(50% - 4px);
    padding: 12px 6px;
  }

  .rec-stat-value {
    font-size: 22px;
  }
}
</style>
