<template>
  <div class="geo-journey-bar">
    <div class="geo-journey-bar__steps">
      <div
        v-for="(step, idx) in steps"
        :key="step.key"
        :class="[
          'geo-journey-bar__step',
          `geo-journey-bar__step--${getStepState(step.key)}`,
        ]"
        @click="navigateToStep(step.key)"
      >
        <div class="geo-journey-bar__step-indicator">
          <svg v-if="getStepState(step.key) === 'completed'" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="8" fill="#22c55e" />
            <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span v-else-if="getStepState(step.key) === 'active'" class="geo-journey-bar__step-dot geo-journey-bar__step-dot--active">{{ idx + 1 }}</span>
          <span v-else class="geo-journey-bar__step-dot">{{ idx + 1 }}</span>
        </div>
        <span class="geo-journey-bar__step-label">{{ step.label }}</span>
        <span v-if="idx < steps.length - 1" class="geo-journey-bar__connector" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

interface JourneyStep {
  key: string
  label: string
  route: string
}

const props = withDefaults(defineProps<{
  steps: JourneyStep[]
  currentStep: string
  completedSteps?: string[]
}>(), {
  completedSteps: () => [],
})

const router = useRouter()

function getStepState(stepKey: string): 'completed' | 'active' | 'pending' {
  if (props.completedSteps.includes(stepKey)) return 'completed'
  if (stepKey === props.currentStep) return 'active'
  return 'pending'
}

function navigateToStep(stepKey: string) {
  const step = props.steps.find(s => s.key === stepKey)
  if (step) {
    router.push(step.route)
  }
}
</script>

<style scoped>
.geo-journey-bar {
  width: 100%;
  overflow-x: auto;
  padding: 12px 0;
}

.geo-journey-bar__steps {
  display: flex;
  align-items: flex-start;
  gap: 0;
  min-width: fit-content;
}

.geo-journey-bar__step {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background 0.15s;
  flex-shrink: 0;
  position: relative;
}

.geo-journey-bar__step:hover {
  background: #f8fafc;
}

.geo-journey-bar__step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.geo-journey-bar__step-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  background: #e5e7eb;
  color: #9ca3af;
}

.geo-journey-bar__step-dot--active {
  background: #3b82f6;
  color: #fff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.geo-journey-bar__step-label {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  color: #6b7280;
}

.geo-journey-bar__step--active .geo-journey-bar__step-label {
  color: #1d4ed8;
  font-weight: 600;
}

.geo-journey-bar__step--completed .geo-journey-bar__step-label {
  color: #22c55e;
}

.geo-journey-bar__connector {
  width: 32px;
  height: 2px;
  background: #e5e7eb;
  margin: 0 4px;
  flex-shrink: 0;
}

.geo-journey-bar__step--completed + .geo-journey-bar__connector {
  background: #22c55e;
}

.geo-journey-bar__step--active + .geo-journey-bar__connector {
  background: linear-gradient(90deg, #3b82f6 0%, #e5e7eb 100%);
}
</style>
