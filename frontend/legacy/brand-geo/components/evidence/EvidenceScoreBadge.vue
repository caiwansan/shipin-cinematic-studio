<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <span :class="['geo-score-badge', scoreClass]" :title="`可信度: ${Math.round(score * 100)}%`">
    {{ Math.round(score * 100) }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  score: number
}>(), {
  score: 0,
})

const scoreClass = computed(() => {
  if (props.score >= 0.6) return 'geo-score-badge--high'
  if (props.score >= 0.3) return 'geo-score-badge--medium'
  return 'geo-score-badge--low'
})
</script>

<style scoped>
.geo-score-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
  font-family: var(--geo-font-mono);
}
.geo-score-badge--high {
  background: rgba(52, 211, 153, 0.15);
  color: var(--geo-success);
}
.geo-score-badge--medium {
  background: rgba(251, 191, 36, 0.15);
  color: var(--geo-warning);
}
.geo-score-badge--low {
  background: rgba(239, 68, 68, 0.15);
  color: var(--geo-error);
}
</style>
