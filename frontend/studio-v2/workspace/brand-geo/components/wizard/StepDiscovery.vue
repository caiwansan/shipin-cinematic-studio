<template>
  <div class="geo-wizard-step">
    <div class="geo-wizard-progress-status">
      <div
        v-for="(step, idx) in steps"
        :key="idx"
        class="geo-wizard-progress-item"
        :class="step.class"
      >
        <span class="geo-progress-icon">{{ step.icon }}</span>
        <div class="geo-progress-content">
          <strong>{{ step.label }}</strong>
          <span>{{ step.statusText }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: {
    type: String,
    default: ''
    // scanComplete | entityComplete | kgComplete | error
  }
})

const phase = computed(() => {
  if (!props.status || props.status === 'error') return 0
  if (props.status === 'scanComplete') return 1
  if (props.status === 'entityComplete') return 2
  if (props.status === 'kgComplete') return 3
  return 0
})

const steps = computed(() => [
  {
    label: '网站扫描',
    icon: phase.value >= 1 ? '✅' : phase.value === 0 && props.status !== 'error' ? '⏳' : props.status === 'error' ? '❌' : '⏳',
    statusText: phase.value >= 1 ? '已完成' : props.status === 'error' ? '失败' : '等待中...',
    class: phase.value >= 1 ? 'complete' : props.status === 'error' ? 'error' : 'pending'
  },
  {
    label: '实体发现',
    icon: phase.value >= 2 ? '✅' : phase.value === 1 ? '⏳' : '⚪',
    statusText: phase.value >= 2 ? '已完成' : phase.value === 1 ? '进行中...' : '等待中',
    class: phase.value >= 2 ? 'complete' : phase.value === 1 ? 'active' : 'pending'
  },
  {
    label: '知识图谱构建',
    icon: phase.value >= 3 ? '✅' : phase.value === 2 ? '⏳' : '⚪',
    statusText: phase.value >= 3 ? '已完成' : phase.value === 2 ? '进行中...' : '等待中',
    class: phase.value >= 3 ? 'complete' : phase.value === 2 ? 'active' : 'pending'
  }
])
</script>
