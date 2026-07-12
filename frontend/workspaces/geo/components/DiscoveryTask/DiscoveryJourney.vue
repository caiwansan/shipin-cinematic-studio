<template>
  <div class="dt-journey">
    <div
      v-for="(step, i) in steps"
      :key="step.key"
      class="dt-journey__step"
      :class="{
        'dt-journey__step--done': step.done,
        'dt-journey__step--active': step.active,
      }"
    >
      <div class="dt-journey__marker">
        <span v-if="step.done">✓</span>
        <span v-else-if="step.active">●</span>
        <span v-else>○</span>
      </div>
      <div class="dt-journey__info">
        <span class="dt-journey__label">{{ step.label }}</span>
        <span class="dt-journey__status" v-if="step.done">已完成</span>
        <span class="dt-journey__status dt-journey__status--active" v-else-if="step.active">当前</span>
      </div>
      <div v-if="i < steps.length - 1" class="dt-journey__line" :class="{ 'dt-journey__line--done': step.done }" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  steps: Array<{ key: string; label: string; done: boolean; active: boolean }>
}>()
</script>

<style scoped>
.dt-journey {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 20px 24px;
  background: #f9fafb;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}
.dt-journey__step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  position: relative;
  padding: 8px 0;
}
.dt-journey__marker {
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
  margin-top: 2px;
}
.dt-journey__step--done .dt-journey__marker {
  background: #16a34a;
  color: #fff;
}
.dt-journey__step--active .dt-journey__marker {
  background: #3b82f6;
  color: #fff;
  box-shadow: 0 0 0 4px rgba(59,130,246,0.15);
}
.dt-journey__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dt-journey__label {
  font-size: 14px;
  font-weight: 500;
  color: #9ca3af;
}
.dt-journey__step--done .dt-journey__label { color: #16a34a; }
.dt-journey__step--active .dt-journey__label { color: #1e40af; font-weight: 600; }
.dt-journey__status {
  font-size: 11px;
  color: #9ca3af;
}
.dt-journey__status--active {
  color: #3b82f6;
  font-weight: 600;
}
.dt-journey__line {
  width: 2px;
  height: 100%;
  background: #e5e7eb;
  margin-left: 13px;
  min-height: 16px;
  flex-shrink: 0;
}
.dt-journey__line--done {
  background: #16a34a;
}
</style>
