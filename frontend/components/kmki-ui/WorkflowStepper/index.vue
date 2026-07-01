<template>
  <div class="workflow-stepper">
    <!-- Steps Bar -->
    <div class="workflow-stepper__steps">
      <div
        v-for="(step, idx) in steps"
        :key="step.id"
        :class="[
          'workflow-stepper__step',
          {
            'workflow-stepper__step--active': currentStep === step.id,
            'workflow-stepper__step--completed': isCompleted(step.id),
            'workflow-stepper__step--locked': !isStepAccessible(step.id) && !isCompleted(step.id),
          },
        ]"
        :title="!isStepAccessible(step.id) && !isCompleted(step.id) ? (guardMessages[step.id] || '此步骤尚不可用') : step.label"
        @click="handleStepClick(step.id)"
        role="button"
        :tabindex="isStepAccessible(step.id) || isCompleted(step.id) ? 0 : -1"
        :aria-label="`Step ${idx + 1}: ${step.label}${!isStepAccessible(step.id) && !isCompleted(step.id) ? ' (locked)' : ''}`"
        :aria-current="currentStep === step.id ? 'step' : undefined"
        @keydown.enter="handleStepClick(step.id)"
      >
        <div class="workflow-stepper__step-indicator">
          <span v-if="isCompleted(step.id)" class="workflow-stepper__step-icon workflow-stepper__step-icon--completed">✓</span>
          <span v-else-if="currentStep === step.id" class="workflow-stepper__step-icon workflow-stepper__step-icon--active">●</span>
          <span v-else-if="isStepAccessible(step.id)" class="workflow-stepper__step-icon workflow-stepper__step-icon--available">{{ step.icon }}</span>
          <span v-else class="workflow-stepper__step-icon workflow-stepper__step-icon--locked">🔒</span>
        </div>
        <span class="workflow-stepper__step-label">{{ step.label }}</span>

        <!-- Connector line -->
        <div
          v-if="idx < steps.length - 1"
          :class="[
            'workflow-stepper__step-connector',
            {
              'workflow-stepper__step-connector--active':
                (isCompleted(step.id) || currentStepIndex > idx),
            },
          ]"
        />
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="workflow-stepper__progress">
      <div class="workflow-stepper__progress-track">
        <div
          class="workflow-stepper__progress-bar"
          :style="{ width: progress + '%' }"
        />
      </div>
      <span class="workflow-stepper__progress-text">{{ progress }}% 已完成</span>
    </div>

    <!-- Navigation -->
    <div class="workflow-stepper__nav">
      <button
        class="workflow-stepper__nav-btn workflow-stepper__nav-btn--prev"
        :disabled="!canPrev"
        @click="goPrev"
        aria-label="Go to previous step"
      >
        ← 后退
      </button>

      <div v-if="guardMessage" class="workflow-stepper__guard">
        <span class="workflow-stepper__guard-icon">⚠️</span>
        <span class="workflow-stepper__guard-text">{{ guardMessage }}</span>
      </div>

      <button
        class="workflow-stepper__nav-btn workflow-stepper__nav-btn--next"
        :disabled="!canNext"
        @click="handleNext"
        aria-label="下一步"
      >
        下一步 →
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useWorkflowStore } from '../../../workspaces/geo/stores/useWorkflowStore'
import type { WorkflowStep } from '../../../workspaces/geo/stores/useWorkflowStore'

const emit = defineEmits<{
  (e: 'step-change', stepId: string): void
  (e: 'next'): void
  (e: 'prev'): void
}>()

const workflow = useWorkflowStore()

const steps = computed<readonly WorkflowStep[]>(() => workflow.steps)
const currentStep = computed(() => workflow.currentStep)
const currentStepIndex = computed(() => workflow.currentStepIndex)
const progress = computed(() => workflow.progress)
const canNext = computed(() => workflow.canNext)
const canPrev = computed(() => workflow.canPrev)
const guardMessage = computed(() => workflow.guardMessage)
const guardMessages = computed(() => workflow.guardMessages)

function isCompleted(stepId: string): boolean {
  return workflow.isCompleted(stepId)
}

function isStepAccessible(stepId: string): boolean {
  return workflow.isStepAccessible(stepId)
}

function handleStepClick(stepId: string): void {
  if (workflow.isCompleted(stepId) || workflow.isStepAccessible(stepId)) {
    workflow.goToStep(stepId)
    emit('step-change', stepId)
  }
}

function handleNext(): void {
  if (workflow.goNext()) {
    emit('next')
    emit('step-change', workflow.currentStep)
  }
}

function goPrev(): void {
  workflow.goPrev()
  emit('prev')
  emit('step-change', workflow.currentStep)
}
</script>

<style scoped>
.workflow-stepper {
  width: 100%;
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
}

/* ===== Steps ===== */
.workflow-stepper__steps {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  position: relative;
  padding: 0 8px;
}

.workflow-stepper__step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  position: relative;
  flex: 1;
  cursor: pointer;
  padding: 8px 4px;
  border-radius: 8px;
  transition: all 0.15s ease-out;
  user-select: none;
  min-width: 0;
}

.workflow-stepper__step:hover:not(.workflow-stepper__step--locked) {
  background-color: #f3f4f6;
}

.workflow-stepper__step:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.workflow-stepper__step--active {
  background-color: #eff6ff;
}

.workflow-stepper__step--completed {
  cursor: pointer;
}

.workflow-stepper__step--locked {
  cursor: not-allowed;
  opacity: 0.5;
}

/* ===== Step Indicator ===== */
.workflow-stepper__step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  z-index: 1;
  background-color: #fff;
  border: 2px solid #e5e7eb;
  transition: all 0.2s ease-out;
}

.workflow-stepper__step--active .workflow-stepper__step-indicator {
  border-color: #3b82f6;
  background-color: #eff6ff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.workflow-stepper__step--completed .workflow-stepper__step-indicator {
  border-color: #22c55e;
  background-color: #22c55e;
}

.workflow-stepper__step--locked .workflow-stepper__step-indicator {
  border-color: #d1d5db;
  background-color: #f9fafb;
}

.workflow-stepper__step-icon {
  font-size: 14px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.workflow-stepper__step-icon--active {
  color: #3b82f6;
  font-size: 16px;
}

.workflow-stepper__step-icon--completed {
  color: #fff;
  font-weight: 700;
  font-size: 14px;
}

.workflow-stepper__step-icon--available {
  color: #6b7280;
  font-size: 14px;
}

.workflow-stepper__step-icon--locked {
  color: #9ca3af;
  font-size: 13px;
}

/* ===== Step Label ===== */
.workflow-stepper__step-label {
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  text-align: center;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  transition: color 0.15s;
}

.workflow-stepper__step--active .workflow-stepper__step-label {
  color: #3b82f6;
  font-weight: 600;
}

.workflow-stepper__step--completed .workflow-stepper__step-label {
  color: #16a34a;
}

.workflow-stepper__step--locked .workflow-stepper__step-label {
  color: #9ca3af;
}

/* ===== Connector ===== */
.workflow-stepper__step-connector {
  position: absolute;
  top: 24px;
  left: calc(50% + 20px);
  right: calc(-50% + 20px);
  height: 2px;
  background-color: #e5e7eb;
  z-index: 0;
  transition: background-color 0.3s;
}

.workflow-stepper__step-connector--active {
  background-color: #22c55e;
}

/* ===== Progress ===== */
.workflow-stepper__progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding: 0 8px;
}

.workflow-stepper__progress-track {
  flex: 1;
  height: 6px;
  background-color: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.workflow-stepper__progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #22c55e);
  border-radius: 3px;
  transition: width 0.4s ease-out;
}

.workflow-stepper__progress-text {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  white-space: nowrap;
  min-width: 100px;
  text-align: right;
}

/* ===== Navigation ===== */
.workflow-stepper__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
  padding: 12px 8px;
  border-top: 1px solid #e5e7eb;
}

.workflow-stepper__nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease-out;
  background-color: #fff;
  color: #374151;
}

.workflow-stepper__nav-btn:hover:not(:disabled) {
  background-color: #f9fafb;
  border-color: #9ca3af;
}

.workflow-stepper__nav-btn:active:not(:disabled) {
  background-color: #f3f4f6;
}

.workflow-stepper__nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.workflow-stepper__nav-btn--next {
  background-color: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}

.workflow-stepper__nav-btn--next:hover:not(:disabled) {
  background-color: #2563eb;
  border-color: #2563eb;
}

.workflow-stepper__nav-btn--next:active:not(:disabled) {
  background-color: #1d4ed8;
}

/* ===== Guard Message ===== */
.workflow-stepper__guard {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background-color: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 6px;
  flex: 1;
  max-width: 400px;
}

.workflow-stepper__guard-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.workflow-stepper__guard-text {
  font-size: 12px;
  color: #92400e;
  line-height: 1.3;
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .workflow-stepper__step-label {
    font-size: 10px;
  }

  .workflow-stepper__step-indicator {
    width: 28px;
    height: 28px;
  }

  .workflow-stepper__step-icon {
    font-size: 12px;
  }

  .workflow-stepper__step-connector {
    top: 22px;
  }

  .workflow-stepper__nav {
    flex-wrap: wrap;
  }

  .workflow-stepper__guard {
    order: 3;
    max-width: 100%;
    width: 100%;
  }
}
</style>
