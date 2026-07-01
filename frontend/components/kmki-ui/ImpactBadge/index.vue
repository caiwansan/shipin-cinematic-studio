<!--
  ImpactBadge.vue — ADI 收益徽标

  P0-T007 — Action Plan Engine
-->
<template>
  <span class="kmki-impact-badge" :class="[`kmki-impact-badge--${level}`]">
    +{{ value }} ADI
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  value: number
}>()

const level = computed(() => {
  if (props.value >= 30) return 'high'
  if (props.value >= 15) return 'medium'
  return 'low'
})
</script>

<style scoped>
.kmki-impact-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.kmki-impact-badge--high {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.kmki-impact-badge--medium {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}

.kmki-impact-badge--low {
  background: #f3f4f6;
  color: #6b7280;
  border: 1px solid #e5e7eb;
}
</style>
