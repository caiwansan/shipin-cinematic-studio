/**
 * Workflow Store — Guided Workflow Engine + Step Guard + Progress Tracker
 *
 * P1-B: Guided Workflow Engine
 *
 * Manages the 7-step GEO workflow:
 *   assessment → discovery → opportunity → action-plan → execution → verification → report
 *
 * Features:
 *  - Step status tracking (not-started / in-progress / completed)
 *  - Progress computation
 *  - Step Guard: prerequisites check with guard messages
 *  - Navigation: goNext, goPrev, goToStep with validation
 *  - Integration with GeoProjectStore for data checks
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useGeoProjectStore } from './useGeoProjectStore'

// ── Types ──

export interface WorkflowStep {
  id: string
  label: string
  icon: string
}

export type StepStatus = 'not-started' | 'in-progress' | 'completed'

// ── WORKFLOW STEPS (ordered list) ──

export const WORKFLOW_STEPS: readonly WorkflowStep[] = [
  { id: 'assessment', label: '评估', icon: '📊' },
  { id: 'discovery', label: '发现', icon: '🔍' },
  { id: 'opportunity', label: '机会评估', icon: '💡' },
  { id: 'action-plan', label: '行动计划', icon: '📋' },
  { id: 'execution', label: '执行', icon: '⚡' },
  { id: 'verification', label: '验证', icon: '✅' },
  { id: 'report', label: '报告', icon: '📄' },
] as const

// ── Step Guard Definitions ──

interface GuardRule {
  stepId: string
  prerequisiteStepIds: string[]
  dataCheck?: () => boolean
  message: string
}

function createGuardRules(projectStore: ReturnType<typeof useGeoProjectStore>): GuardRule[] {
  return [
    {
      stepId: 'assessment',
      prerequisiteStepIds: [],
      message: '',
    },
    {
      stepId: 'discovery',
      prerequisiteStepIds: ['assessment'],
      message: '请先完成 Assessment 评估',
    },
    {
      stepId: 'opportunity',
      prerequisiteStepIds: ['discovery'],
      dataCheck: () => !!projectStore.discoveryReport?.reportData,
      message: '请先完成 Discovery 并获取发现报告',
    },
    {
      stepId: 'action-plan',
      prerequisiteStepIds: ['opportunity'],
      dataCheck: () => {
        // Check if any opportunity data exists from discovery report
        const report = projectStore.discoveryReport
        return !!report?.reportData && Array.isArray(report.reportData?.opportunities)
      },
      message: '请先完成 Opportunity Review 并确认优化机会',
    },
    {
      stepId: 'execution',
      prerequisiteStepIds: ['action-plan'],
      // Execution is always passable as a placeholder
      message: '',
    },
    {
      stepId: 'verification',
      prerequisiteStepIds: ['execution'],
      dataCheck: () => !!projectStore.verificationReport?.reportData,
      message: '请先完成执行步骤，并在验证页面中输入关键词进行验证',
    },
    {
      stepId: 'report',
      prerequisiteStepIds: ['verification'],
      dataCheck: () => !!projectStore.verificationReport?.reportData,
      message: '请先完成 Verification 并获取验证报告',
    },
  ]
}

// ── Store ──

export const useWorkflowStore = defineStore('geo-workflow', () => {
  // ── State ──

  const currentStep = ref<string>('assessment')
  const stepStatuses = ref<Record<string, StepStatus>>(
    Object.fromEntries(WORKFLOW_STEPS.map((s) => [s.id, 'not-started']))
  )
  const completedSteps = ref<string[]>([])
  const projectId = ref<string | null>(null)

  // ── Computed ──

  const steps = computed(() => [...WORKFLOW_STEPS])

  const currentStepIndex = computed(() => {
    const idx = WORKFLOW_STEPS.findIndex((s) => s.id === currentStep.value)
    return idx >= 0 ? idx : 0
  })

  const progress = computed(() => {
    const total = WORKFLOW_STEPS.length
    const done = WORKFLOW_STEPS.filter(
      (s) => stepStatuses.value[s.id] === 'completed'
    ).length
    return Math.round((done / total) * 100)
  })

  const canNext = computed(() => {
    const rule = getGuardRule(currentStep.value)
    if (!rule) return true
    return checkGuard(rule)
  })

  const canPrev = computed(() => {
    return currentStepIndex.value > 0
  })

  const nextStep = computed(() => {
    const nextIdx = currentStepIndex.value + 1
    if (nextIdx < WORKFLOW_STEPS.length) {
      return WORKFLOW_STEPS[nextIdx]
    }
    return null
  })

  const prevStep = computed(() => {
    const prevIdx = currentStepIndex.value - 1
    if (prevIdx >= 0) {
      return WORKFLOW_STEPS[prevIdx]
    }
    return null
  })

  const guardMessages = computed(() => {
    const messages: Record<string, string> = {}
    for (const rule of getGuardRules()) {
      if (!checkGuard(rule)) {
        messages[rule.stepId] = rule.message
      }
    }
    return messages
  })

  const guardMessage = computed(() => {
    return guardMessages.value[currentStep.value] || ''
  })

  // ── Helpers ──

  function getGuardRules(): GuardRule[] {
    const projectStore = useGeoProjectStore()
    return createGuardRules(projectStore)
  }

  function getGuardRule(stepId: string): GuardRule | undefined {
    return getGuardRules().find((r) => r.stepId === stepId)
  }

  function checkGuard(rule: GuardRule): boolean {
    // Check prerequisite steps
    for (const prereqId of rule.prerequisiteStepIds) {
      if (stepStatuses.value[prereqId] !== 'completed') {
        return false
      }
    }
    // Check data condition
    if (rule.dataCheck && !rule.dataCheck()) {
      return false
    }
    return true
  }

  // ── Methods ──

  function isStepAccessible(stepId: string): boolean {
    const rule = getGuardRule(stepId)
    if (!rule) return true
    if (stepStatuses.value[stepId] === 'completed') return true
    return checkGuard(rule)
  }

  function isCompleted(stepId: string): boolean {
    return stepStatuses.value[stepId] === 'completed'
  }

  function isInProgress(stepId: string): boolean {
    return stepStatuses.value[stepId] === 'in-progress'
  }

  function goNext(): boolean {
    if (!canNext.value) return false
    const guardMsg = guardMessage.value
    if (guardMsg) return false

    // Mark current step as completed if it was in-progress
    if (stepStatuses.value[currentStep.value] !== 'completed') {
      completeStep(currentStep.value)
    }

    // Move to next step
    if (nextStep.value) {
      currentStep.value = nextStep.value.id
      if (stepStatuses.value[currentStep.value] === 'not-started') {
        stepStatuses.value[currentStep.value] = 'in-progress'
      }
      return true
    }
    return false
  }

  function goPrev(): boolean {
    if (!canPrev.value) return false
    if (prevStep.value) {
      currentStep.value = prevStep.value.id
      // Ensure current step is marked as in-progress
      if (stepStatuses.value[currentStep.value] === 'not-started') {
        stepStatuses.value[currentStep.value] = 'in-progress'
      }
      return true
    }
    return false
  }

  function goToStep(stepId: string): boolean {
    // Allow going to completed or accessible steps
    if (isStepAccessible(stepId) || isCompleted(stepId) || stepId === currentStep.value) {
      currentStep.value = stepId
      if (stepStatuses.value[stepId] === 'not-started') {
        stepStatuses.value[stepId] = 'in-progress'
      }
      return true
    }
    return false
  }

  function completeStep(stepId: string): void {
    if (stepStatuses.value[stepId] !== 'completed') {
      stepStatuses.value[stepId] = 'completed'
      if (!completedSteps.value.includes(stepId)) {
        completedSteps.value.push(stepId)
      }
    }
  }

  function setInProgress(stepId: string): void {
    if (stepStatuses.value[stepId] === 'not-started') {
      stepStatuses.value[stepId] = 'in-progress'
    }
  }

  function reset(): void {
    currentStep.value = 'assessment'
    stepStatuses.value = Object.fromEntries(
      WORKFLOW_STEPS.map((s) => [s.id, 'not-started'])
    )
    completedSteps.value = []
    projectId.value = null
  }

  function initializeForProject(id: string): void {
    projectId.value = id
    reset()

    // Try to restore state from URL params or store
    // Load project data to check which steps have data
    const projectStore = useGeoProjectStore()
    if (id) {
      projectStore.loadProject(id)
    }
  }

  function setStepStatuses(statuses: Record<string, StepStatus>): void {
    stepStatuses.value = { ...statuses }
    completedSteps.value = Object.entries(stepStatuses.value)
      .filter(([_, status]) => status === 'completed')
      .map(([id, _]) => id)
  }

  return {
    // State
    currentStep,
    stepStatuses,
    completedSteps,
    projectId,

    // Computed
    steps,
    currentStepIndex,
    progress,
    canNext,
    canPrev,
    nextStep,
    prevStep,
    guardMessages,
    guardMessage,

    // Methods
    isStepAccessible,
    isCompleted,
    isInProgress,
    goNext,
    goPrev,
    goToStep,
    completeStep,
    setInProgress,
    reset,
    initializeForProject,
    setStepStatuses,
  }
})
