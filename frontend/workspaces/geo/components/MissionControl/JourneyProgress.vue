<!-- @deprecated 未被任何页面引用，MissionControl 重构中废弃 -->
<template>
  <div class="mc-journey">
    <div
      v-for="(step, i) in steps"
      :key="step.key"
      class="mc-journey__step"
      :class="{
        'mc-journey__step--done': step.done,
        'mc-journey__step--active': step.active,
      }"
    >
      <div class="mc-journey__marker">
        <span v-if="step.done">✓</span>
        <span v-else-if="step.active">●</span>
        <span v-else>○</span>
      </div>
      <span class="mc-journey__label">{{ step.label }}</span>
      <div v-if="i < steps.length - 1" class="mc-journey__connector" :class="{ 'mc-journey__connector--done': step.done }" />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  steps: Array<{ key: string; label: string; done: boolean; active: boolean }>
}>()
</script>

<style scoped>
.mc-journey {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 20px 24px;
  background: #f9fafb;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}
.mc-journey__step {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
  flex: 1;
}
.mc-journey__marker {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
  background: #e5e7eb;
  color: #9ca3af;
}
.mc-journey__step--done .mc-journey__marker {
  background: #16a34a;
  color: #fff;
}
.mc-journey__step--active .mc-journey__marker {
  background: #3b82f6;
  color: #fff;
  box-shadow: 0 0 0 4px rgba(59,130,246,0.15);
}
.mc-journey__label {
  font-size: 13px;
  font-weight: 500;
  color: #9ca3af;
  white-space: nowrap;
}
.mc-journey__step--done .mc-journey__label {
  color: #16a34a;
}
.mc-journey__step--active .mc-journey__label {
  color: #1e40af;
  font-weight: 600;
}
.mc-journey__connector {
  flex: 1;
  height: 2px;
  background: #e5e7eb;
  margin: 0 8px;
  min-width: 16px;
}
.mc-journey__connector--done {
  background: #16a34a;
}
</style>
