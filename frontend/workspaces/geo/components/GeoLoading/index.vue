<template>
  <div class="geo-loading">
    <div class="geo-loading__steps">
      <div
        v-for="(step, i) in steps"
        :key="i"
        class="geo-loading__step"
        :class="stepClass(i)"
      >
        <span class="geo-loading__icon">{{ step.icon }}</span>
        <span class="geo-loading__label">{{ step.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface LoadingStep {
  label: string
  icon: string
}

const props = withDefaults(defineProps<{
  steps?: LoadingStep[]
  currentStep?: number
}>(), {
  steps: () => [
    { label: '加载中...', icon: '🔍' },
    { label: '处理数据...', icon: '📋' },
    { label: '生成结果...', icon: '🧠' },
  ],
  currentStep: 0,
})

function stepClass(index: number): string {
  if (index < props.currentStep) return 'geo-loading__step--done'
  if (index === props.currentStep) return 'geo-loading__step--active'
  return 'geo-loading__step--pending'
}
</script>
