<!--
  EffortBadge.vue — 难度徽标

  P0-T007 — Action Plan Engine
-->
<template>
  <span class="kmki-effort-badge" :class="`kmki-effort-badge--${effort}`">
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  effort: 'easy' | 'medium' | 'hard'
}>()

const label = computed(() => {
  const map: Record<string, string> = { easy: '🟢 Easy', medium: '🟡 Medium', hard: '🔴 Hard' }
  return map[props.effort] ?? props.effort
})
</script>

<style scoped>
.kmki-effort-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.kmki-effort-badge--easy {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.kmki-effort-badge--medium {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}

.kmki-effort-badge--hard {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}
</style>
