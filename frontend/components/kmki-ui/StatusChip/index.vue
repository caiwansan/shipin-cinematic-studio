<!--
  StatusChip.vue — 状态标签

  P0-T007 — Action Plan Engine
-->
<template>
  <span class="kmki-status-chip" :class="`kmki-status-chip--${status}`">
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status: 'pending' | 'completed' | 'skipped' | 'later'
}>()

const label = computed(() => {
  const map: Record<string, string> = {
    pending: '⏳ 待处理',
    completed: '✅ 已完成',
    skipped: '⏭️ 已跳过',
    later: '📅 稍后处理',
  }
  return map[props.status] ?? props.status
})
</script>

<style scoped>
.kmki-status-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.kmki-status-chip--pending {
  background: #f3f4f6;
  color: #6b7280;
  border: 1px solid #e5e7eb;
}

.kmki-status-chip--completed {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.kmki-status-chip--skipped {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}

.kmki-status-chip--later {
  background: #e0f2fe;
  color: #075985;
  border: 1px solid #bae6fd;
}
</style>
