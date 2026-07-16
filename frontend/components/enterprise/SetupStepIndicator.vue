<template>
  <div class="step-indicator">
    <div class="step-line"></div>
    <div
      v-for="step in steps"
      :key="step.id"
      class="step-item"
      :class="{
        active: step.id === currentStep,
        completed: step.id < currentStep,
      }"
    >
      <div class="step-circle">
        <span v-if="step.id < currentStep" class="step-check">✓</span>
        <span v-else class="step-icon">{{ step.icon }}</span>
      </div>
      <span class="step-label">{{ step.title }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  currentStep: number
  steps: Array<{ id: number; title: string; icon: string }>
}>()
</script>

<style scoped>
.step-indicator {
  position: relative;
  display: flex;
  justify-content: space-between;
  padding: 2rem 1rem;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}

.step-line {
  position: absolute;
  top: 3.25rem;
  left: 3rem;
  right: 3rem;
  height: 2px;
  background: #e5e7eb;
  z-index: 0;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  z-index: 1;
}

.step-circle {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  background: #f1f5f9;
  border: 2px solid #d1d5db;
  transition: all 0.3s;
}

.step-item.active .step-circle {
  background: #6366f1;
  border-color: #6366f1;
  transform: scale(1.1);
}

.step-item.completed .step-circle {
  background: #22c55e;
  border-color: #22c55e;
  color: white;
}

.step-check {
  color: white;
  font-size: 1rem;
  font-weight: 700;
}

.step-icon {
  filter: grayscale(1);
  opacity: 0.7;
}

.step-item.active .step-icon {
  filter: none;
  opacity: 1;
}

.step-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #94a3b8;
}

.step-item.active .step-label {
  color: #6366f1;
}

.step-item.completed .step-label {
  color: #22c55e;
}
</style>
