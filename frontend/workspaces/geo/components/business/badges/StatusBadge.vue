<template>
  <span
    class="status-badge"
    :class="[
      `status-badge--${status}`,
      { 'status-badge--running': status === 'running' }
    ]"
    :style="{ backgroundColor: color }"
    :data-testid="`status-badge status-badge-${status}`"
  >
    <span v-if="status === 'running'" class="status-badge__spinner" />
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TaskStatus } from '~/workspaces/geo/types/business'
import { STATUS_COLORS, STATUS_LABELS } from '~/workspaces/geo/types/business'

const props = defineProps<{
  status: TaskStatus
}>()

const color = computed(() => STATUS_COLORS[props.status])
const label = computed(() => STATUS_LABELS[props.status])
</script>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  line-height: 1.5;
  white-space: nowrap;
}

.status-badge__spinner {
  width: 10px;
  height: 10px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
