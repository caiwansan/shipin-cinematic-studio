/**
 * Journey navigation composable for GEO Workspace productization.
 * 
 * Maps each page to a position in the Discovery → Knowledge → Optimization → Verification → Observation flow.
 * Provides computed properties for the JourneyBar and CTAFooter.
 */
import { useRouter, useRoute } from 'vue-router'
import { computed } from 'vue'

export interface JourneyStepDef {
  key: string
  label: string
  route: string
}

export const JOURNEY_STEPS: JourneyStepDef[] = [
  { key: 'discovery', label: 'Discovery', route: '/workspace/geo/dashboard' },
  { key: 'knowledge', label: 'Knowledge', route: '/workspace/geo/knowledge' },
  { key: 'optimization', label: 'Optimization', route: '/workspace/geo/recommendations' },
  { key: 'verification', label: 'Verification', route: '/workspace/geo/verification' },
  { key: 'observation', label: 'Observation', route: '/workspace/geo/growth' },
]

/**
 * Map current route path to a journey step key.
 */
function routeToStepKey(path: string): string {
  if (path.includes('/dashboard') || path.includes('/brand/') || path.includes('/health') || path.includes('/detail')) return 'discovery'
  if (path.includes('/knowledge')) return 'knowledge'
  if (path.includes('/recommendation') || path.includes('/mission')) return 'optimization'
  if (path.includes('/verification')) return 'verification'
  if (path.includes('/growth')) return 'observation'
  return 'discovery'
}

/**
 * Get the next step after the current one.
 */
function getNextStep(currentKey: string): JourneyStepDef | null {
  const idx = JOURNEY_STEPS.findIndex(s => s.key === currentKey)
  if (idx >= 0 && idx < JOURNEY_STEPS.length - 1) return JOURNEY_STEPS[idx + 1]
  return null
}

/**
 * Get the previous step before the current one.
 */
function getPrevStep(currentKey: string): JourneyStepDef | null {
  const idx = JOURNEY_STEPS.findIndex(s => s.key === currentKey)
  if (idx > 0) return JOURNEY_STEPS[idx - 1]
  return null
}

/**
 * Generate CTA labels based on the current step.
 */
function getCTALabels(currentKey: string): {
  nextStepLabel: string
  primaryLabel: string
  secondaryLabel: string | null
} {
  const next = getNextStep(currentKey)
  const prev = getPrevStep(currentKey)

  switch (currentKey) {
    case 'discovery':
      return {
        nextStepLabel: '进入 Knowledge 阶段',
        primaryLabel: '查看知识库',
        secondaryLabel: null,
      }
    case 'knowledge':
      return {
        nextStepLabel: '进入 Optimization 阶段',
        primaryLabel: '查看优化建议',
        secondaryLabel: prev ? '返回 Discovery' : null,
      }
    case 'optimization':
      return {
        nextStepLabel: '进入 Verification 阶段',
        primaryLabel: '进入 Verification',
        secondaryLabel: '继续优化',
      }
    case 'verification':
      return {
        nextStepLabel: '进入 Observation 阶段',
        primaryLabel: '进入 Observation',
        secondaryLabel: '查看 Optimization',
      }
    case 'observation':
      return {
        nextStepLabel: '持续监控品牌健康',
        primaryLabel: '返回 Dashboard',
        secondaryLabel: '查看完整报告',
      }
    default:
      return {
        nextStepLabel: '继续',
        primaryLabel: '查看 Dashboard',
        secondaryLabel: null,
      }
  }
}

export function useJourney() {
  const router = useRouter()
  const route = useRoute()

  const currentStepKey = computed(() => routeToStepKey(route.path))
  const currentStep = computed(() => JOURNEY_STEPS.find(s => s.key === currentStepKey.value) || JOURNEY_STEPS[0])
  const nextStep = computed(() => getNextStep(currentStepKey.value))
  const prevStep = computed(() => getPrevStep(currentStepKey.value))
  const ctaLabels = computed(() => getCTALabels(currentStepKey.value))

  function navigateToStep(stepKey: string) {
    const step = JOURNEY_STEPS.find(s => s.key === stepKey)
    if (step) router.push(step.route)
  }

  function goToNextStep() {
    if (nextStep.value) router.push(nextStep.value.route)
  }

  function goToPrevStep() {
    if (prevStep.value) router.push(prevStep.value.route)
  }

  return {
    steps: JOURNEY_STEPS,
    currentStepKey,
    currentStep,
    nextStep,
    prevStep,
    ctaLabels,
    navigateToStep,
    goToNextStep,
    goToPrevStep,
  }
}
