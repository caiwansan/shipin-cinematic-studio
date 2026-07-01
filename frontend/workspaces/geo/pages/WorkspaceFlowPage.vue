<template>
  <div class="flow-page" v-if="projectLoaded">
    <!-- ===== Top: Back to Dashboard ===== -->
    <NuxtLink to="/workspace/geo/dashboard" class="flow-page__back-btn">← 返回工作台</NuxtLink>

    <!-- ===== Top: Workflow Stepper ===== -->
    <WorkflowStepper
      @step-change="onStepChange"
      @next="onStepChange(workflow.currentStep)"
      @prev="onStepChange(workflow.currentStep)"
    />

    <!-- ===== Middle: Dynamic Step Content ===== -->
    <div class="flow-page__content">
      <!-- Assessment Step -->
      <div v-if="workflow.currentStep === 'assessment'" class="flow-page__step-panel">
        <h2 class="flow-page__step-title">📊 评估</h2>
        <p class="flow-page__step-desc">评估项目当前品牌健康和 ADI 得分。</p>
        <div class="flow-page__embedded">
          <HealthPageEmbedded
            :project-id="projectId"
            @data-loaded="onAssessmentComplete"
          />
        </div>
      </div>

      <!-- Discovery Step -->
      <div v-else-if="workflow.currentStep === 'discovery'" class="flow-page__step-panel">
        <h2 class="flow-page__step-title">🔍 发现</h2>
        <p class="flow-page__step-desc">分析实体在各需求场景中的表现。</p>
        <div class="flow-page__embedded">
          <DiscoveryLabPageEmbedded
            :project-id="projectId"
            @data-loaded="onDiscoveryComplete"
          />
        </div>
      </div>

      <!-- Opportunity Review Step -->
      <div v-else-if="workflow.currentStep === 'opportunity'" class="flow-page__step-panel">
        <h2 class="flow-page__step-title">💡 机会评估</h2>
        <p class="flow-page__step-desc">查看高优先级的优化机会。</p>
        <div class="flow-page__embedded">
          <OpportunityPanelEmbedded
            :project-id="projectId"
            @data-loaded="onOpportunityComplete"
          />
        </div>
      </div>

      <!-- Action Plan Step -->
      <div v-else-if="workflow.currentStep === 'action-plan'" class="flow-page__step-panel">
        <h2 class="flow-page__step-title">📋 行动计划</h2>
        <p class="flow-page__step-desc">基于识别出的机会制定和审查行动计划。</p>
        <div class="flow-page__embedded">
          <ActionPlanPanelEmbedded
            :project-id="projectId"
            @data-loaded="onActionPlanComplete"
          />
        </div>
      </div>

      <!-- Execution Step (Placeholder) -->
      <div v-else-if="workflow.currentStep === 'execution'" class="flow-page__step-panel">
        <h2 class="flow-page__step-title">⚡ 执行</h2>
        <p class="flow-page__step-desc">执行已规划的操作。此步骤预留用于后续实现。</p>
        <div class="flow-page__embedded">
          <div class="flow-page__placeholder">
            <div class="flow-page__placeholder-icon">🚧</div>
            <h3>执行引擎 — 即将上线</h3>
            <p>后续将支持直接从平台执行优化操作。</p>
            <p class="flow-page__placeholder-hint">目前可以标记此步骤为完成以继续。</p>
            <button
              class="flow-page__placeholder-btn"
              @click="workflow.completeStep('execution')"
            >
              标记为完成
            </button>
          </div>
        </div>
      </div>

      <!-- Verification Step -->
      <div v-else-if="workflow.currentStep === 'verification'" class="flow-page__step-panel">
        <h2 class="flow-page__step-title">✅ 验证</h2>
        <p class="flow-page__step-desc">通过优化前后 ADI 对比验证优化效果。</p>
        <div class="flow-page__embedded">
          <VerificationPageEmbedded
            :project-id="projectId"
            @data-loaded="onVerificationComplete"
          />
        </div>
      </div>

      <!-- Report Step -->
      <div v-else-if="workflow.currentStep === 'report'" class="flow-page__step-panel">
        <h2 class="flow-page__step-title">📄 报告</h2>
        <p class="flow-page__step-desc">查看完整的 GEO 优化报告。</p>
        <div class="flow-page__embedded">
          <ReportPanelEmbedded
            :project-id="projectId"
            @data-loaded="onReportComplete"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- ===== Loading State ===== -->
  <div v-else-if="loading" class="flow-page__loading">
    <div class="flow-page__spinner" />
    <span>正在加载项目...</span>
  </div>

  <!-- ===== Error State ===== -->
  <div v-else-if="loadError" class="flow-page__error">
    <p>{{ loadError }}</p>
    <button class="flow-page__btn" @click="initProject">重试</button>
  </div>

  <!-- ===== Not Found ===== -->
  <div v-else class="flow-page__not-found">
    <p>项目未找到。</p>
    <NuxtLink to="/workspace/geo/dashboard" class="flow-page__btn">← 返回工作台</NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGeoProjectStore } from '../stores/useGeoProjectStore'
import { useWorkflowStore } from '../stores/useWorkflowStore'
import WorkflowStepper from '../../../components/kmki-ui/WorkflowStepper/index.vue'
import HealthPageEmbedded from '../components/HealthPageEmbedded.vue'
import DiscoveryLabPageEmbedded from '../components/DiscoveryLabPageEmbedded.vue'
import OpportunityPanelEmbedded from '../components/OpportunityPanelEmbedded.vue'
import ActionPlanPanelEmbedded from '../components/ActionPlanPanelEmbedded.vue'
import VerificationPageEmbedded from '../components/VerificationPageEmbedded.vue'
import ReportPanelEmbedded from '../components/ReportPanelEmbedded.vue'

definePageMeta({
  title: 'Project Workflow — GEO Workspace',
})

const route = useRoute()
const router = useRouter()
const projectStore = useGeoProjectStore()
const workflow = useWorkflowStore()

const projectId = ref<string>('')
const projectLoaded = ref(false)
const loading = ref(true)
const loadError = ref<string | null>(null)

onMounted(async () => {
  const id = route.params.id as string
  if (!id) {
    router.replace('/workspace/geo/dashboard')
    return
  }

  projectId.value = id
  await initProject()
})

onUnmounted(() => {
  // Don't reset workflow state when navigating within the page
})

async function initProject() {
  loading.value = true
  loadError.value = null

  try {
    await projectStore.loadProject(projectId.value)
    if (!projectStore.currentProject) {
      loading.value = false
      return
    }

    // Restore or initialize workflow state
    try {
      const savedState = sessionStorage.getItem(`wf-${projectId.value}`)
      if (savedState) {
        const parsed = JSON.parse(savedState)
        workflow.currentStep = parsed.currentStep || 'assessment'
        if (parsed.stepStatuses) {
          workflow.setStepStatuses(parsed.stepStatuses)
        }
      } else {
        workflow.initializeForProject(projectId.value)
        workflow.setInProgress('assessment')
      }
    } catch {
      workflow.initializeForProject(projectId.value)
      workflow.setInProgress('assessment')
    }

    projectLoaded.value = true
  } catch (err: any) {
    loadError.value = err?.message || 'Failed to load project'
  } finally {
    loading.value = false
  }
}

function saveWorkflowState() {
  try {
    sessionStorage.setItem(
      `wf-${projectId.value}`,
      JSON.stringify({
        currentStep: workflow.currentStep,
        stepStatuses: workflow.stepStatuses,
      })
    )
  } catch {
    // Silently fail — sessionStorage might be unavailable
  }
}

function onStepChange(stepId: string) {
  saveWorkflowState()
}

function onAssessmentComplete(data?: any) {
  workflow.completeStep('assessment')
  workflow.setInProgress('discovery')
  saveWorkflowState()
}

function onDiscoveryComplete(data?: any) {
  workflow.completeStep('discovery')
  workflow.setInProgress('opportunity')
  // Save the discovery report
  if (data && projectId.value) {
    projectStore.saveDiscoveryReport(projectId.value, data).catch(() => {})
  }
  saveWorkflowState()
}

function onOpportunityComplete(data?: any) {
  workflow.completeStep('opportunity')
  workflow.setInProgress('action-plan')
  saveWorkflowState()
}

function onActionPlanComplete(data?: any) {
  workflow.completeStep('action-plan')
  workflow.setInProgress('execution')
  // Save the action plan
  if (data && projectId.value) {
    projectStore.saveActionPlan(projectId.value, data).catch(() => {})
  }
  saveWorkflowState()
}

function onVerificationComplete(data?: any) {
  workflow.completeStep('verification')
  workflow.setInProgress('report')
  // Save the verification report
  if (data && projectId.value) {
    projectStore.saveVerificationReport(projectId.value, data).catch(() => {})
  }
  saveWorkflowState()
}

function onReportComplete(data?: any) {
  workflow.completeStep('report')
  saveWorkflowState()
}
</script>

<style scoped>
.flow-page {
  max-width: 1100px;
  margin: 0 auto;
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
}

.flow-page__content {
  margin-top: 24px;
}

.flow-page__step-panel {
  animation: panel-enter 0.25s ease-out;
}

@keyframes panel-enter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.flow-page__step-title {
  font-size: 22px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 4px;
}

.flow-page__step-desc {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 20px;
}

.flow-page__back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #6b7280;
  text-decoration: none;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.15s;
  margin-bottom: 12px;
}

.flow-page__back-btn:hover {
  color: #374151;
  background: #f3f4f6;
}

.flow-page__embedded {
  min-height: 200px;
}

/* ===== Placeholder ===== */
.flow-page__placeholder {
  text-align: center;
  padding: 48px;
  background: #f9fafb;
  border: 1px dashed #e5e7eb;
  border-radius: 12px;
}

.flow-page__placeholder-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.flow-page__placeholder h3 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px;
}

.flow-page__placeholder p {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 4px;
}

.flow-page__placeholder-hint {
  font-size: 13px;
  color: #9ca3af;
  font-style: italic;
}

.flow-page__placeholder-btn {
  margin-top: 16px;
  padding: 10px 24px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.flow-page__placeholder-btn:hover {
  background: #2563eb;
}

/* ===== Loading / Error / Not Found ===== */
.flow-page__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px;
  color: #6b7280;
}

.flow-page__spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.flow-page__error {
  text-align: center;
  padding: 32px;
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
}

.flow-page__not-found {
  text-align: center;
  padding: 60px;
  color: #6b7280;
}

.flow-page__btn {
  display: inline-block;
  margin-top: 12px;
  padding: 8px 20px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s;
}

.flow-page__btn:hover {
  background: #2563eb;
}
</style>
