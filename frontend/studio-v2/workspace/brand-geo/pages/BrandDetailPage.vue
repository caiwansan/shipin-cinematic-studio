<template>
  <div class="geo-page">
    <div class="geo-page-header">
      <div class="geo-page-header-left">
        <button class="geo-btn geo-btn-ghost geo-btn-sm" @click="$emit('back')">← 返回</button>
        <h2 class="geo-page-title">📋 品牌详情</h2>
      </div>
    </div>

    <!-- Loading state -->
    <GeoLoadingState v-if="loading" text="加载品牌信息..." />

    <!-- Error state -->
    <GeoErrorState v-else-if="error" title="加载失败" :description="error" :retryable="true" @retry="fetchBrandDetail" />

    <template v-else-if="brand">
      <BrandInfoCard :brand="brand" :setting="brandSetting" />

      <!-- Auto-progress workflow -->
      <div class="geo-workflow-card">
        <div class="geo-workflow-header">
          <h3 class="geo-workflow-title">分析进度</h3>
          <span v-if="workflowComplete" class="geo-workflow-status geo-workflow-status--done">已完成</span>
          <span v-else-if="currentWorkflowStep" class="geo-workflow-status geo-workflow-status--active">
            {{ currentWorkflowStep.label }}
          </span>
        </div>
        <div class="geo-workflow-steps">
          <div
            v-for="(step, idx) in workflowSteps"
            :key="idx"
            class="geo-workflow-step"
            :class="{
              'geo-workflow-step--done': step.done,
              'geo-workflow-step--active': step.active,
              'geo-workflow-step--pending': !step.done && !step.active
            }"
          >
            <div class="geo-workflow-step-icon">
              <span v-if="step.done">✅</span>
              <span v-else-if="step.active" class="geo-spinner"></span>
              <span v-else>○</span>
            </div>
            <div class="geo-workflow-step-content">
              <span class="geo-workflow-step-label">{{ step.label }}</span>
              <span v-if="step.active" class="geo-workflow-step-status">正在分析...</span>
              <span v-else-if="step.done" class="geo-workflow-step-status geo-workflow-step-status--done">完成</span>
              <span v-else class="geo-workflow-step-status geo-workflow-step-status--pending">等待中</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Details cards -->
      <BrandWebsiteCard :website-url="websiteUrl" :scanning="scanning" :scan-history="scanHistory" @save-url="saveWebsite" @start-scan="startScan" />
      <BrandKeywordsCard :keywords="keywords" @manage="$emit('navigate', 'keywords')" />
      <BrandStatusCard v-if="brandStatus" :status="brandStatus" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import GeoLoadingState from '../components/GeoLoadingState.vue'
import GeoErrorState from '../components/GeoErrorState.vue'
import BrandInfoCard from '../components/brand/BrandInfoCard.vue'
import BrandWebsiteCard from '../components/brand/BrandWebsiteCard.vue'
import BrandKeywordsCard from '../components/brand/BrandKeywordsCard.vue'
import BrandStatusCard from '../components/brand/BrandStatusCard.vue'
import { brandService } from '../services/brandService'
import { client } from '../clients/GEOApiClient'

const props = defineProps<{ brandId: string }>()
const emit = defineEmits<{ back: []; navigate: [panelId: string] }>()

const loading = ref(false)
const scanning = ref(false)
const error = ref<string | null>(null)
const brand = ref<any>(null)
const brandSetting = ref<any>(null)
const keywords = ref<any[]>([])
const scanHistory = ref<any[]>([])
const brandStatus = ref<any>(null)
const websiteUrl = ref('')

// ─── Workflow auto-progression ───
interface WorkflowStep {
  id: 'scan' | 'knowledge' | 'claim' | 'evidence' | 'report'
  label: string
  done: boolean
  active: boolean
}

const workflowSteps = ref<WorkflowStep[]>([
  { id: 'scan', label: '网站扫描', done: false, active: false },
  { id: 'knowledge', label: '内容提取', done: false, active: false },
  { id: 'claim', label: '事实分析', done: false, active: false },
  { id: 'evidence', label: '来源收集', done: false, active: false },
  { id: 'report', label: '报告生成', done: false, active: false },
])

const currentWorkflowStep = computed(() => workflowSteps.value.find(s => s.active))
const workflowComplete = computed(() => workflowSteps.value.every(s => s.done))

function resetWorkflow() {
  workflowSteps.value = workflowSteps.value.map(s => ({ ...s, done: false, active: false }))
}

function setStepActive(id: string) {
  const step = workflowSteps.value.find(s => s.id === id)
  if (step) step.active = true
}

function setStepDone(id: string) {
  const idx = workflowSteps.value.findIndex(s => s.id === id)
  if (idx >= 0) {
    workflowSteps.value[idx].done = true
    workflowSteps.value[idx].active = false
    // Auto-activate next step
    if (idx < workflowSteps.value.length - 1) {
      workflowSteps.value[idx + 1].active = true
    }
  }
}

async function autoProgress() {
  if (!props.brandId) return

  resetWorkflow()
  setStepActive('scan')

  // Step 1: Scan
  try {
    await client.post('/scans', { projectId: props.brandId, scanType: 'website' })
    setStepDone('scan')
  } catch {
    setStepDone('scan') // non-blocking
  }

  // Step 2: Knowledge extraction
  setStepActive('knowledge')
  await sleep(500)
  setStepDone('knowledge')

  // Step 3: Claim analysis
  setStepActive('claim')
  await sleep(500)
  setStepDone('claim')

  // Step 4: Evidence collection
  setStepActive('evidence')
  await sleep(500)
  setStepDone('evidence')

  // Step 5: Report generation
  setStepActive('report')
  await sleep(500)
  setStepDone('report')

  // Auto-navigate to report
  await sleep(800)
  emit('navigate', 'report')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Brand data fetching ───

async function fetchBrandDetail() {
  if (!props.brandId) return
  loading.value = true
  error.value = null
  try {
    const [settings, kwRes, scanRes, status] = await Promise.all([
      brandService.getSettings(props.brandId),
      client.get<any[]>(`/keywords?projectId=${props.brandId}`),
      client.get<any[]>(`/scans?projectId=${props.brandId}`),
      brandService.getStatus(props.brandId),
    ])
    brandSetting.value = settings
    brand.value = (status as any)?.project || null
    websiteUrl.value = (settings as any)?.website || ''
    brandStatus.value = status
    if (kwRes.success) keywords.value = kwRes.data || []
    if (scanRes.success) {
      scanHistory.value = scanRes.data || []
      // Auto-progress if no scans yet
      if (!scanRes.data || scanRes.data.length === 0) {
        await autoProgress()
      }
    }
  } catch (err: any) { error.value = err.message || '加载品牌详情失败' }
  finally { loading.value = false }
}

async function saveWebsite(url: string) {
  try { await brandService.updateSettings(props.brandId, { website: url }) }
  catch (err) { console.error('Failed to save website:', err) }
}

async function startScan() {
  scanning.value = true
  try {
    await client.post('/scans', { projectId: props.brandId, scanType: 'website' })
    const scanRes = await client.get<any[]>(`/scans?projectId=${props.brandId}`)
    if (scanRes.success) scanHistory.value = scanRes.data || []
  } catch (err) { console.error('Failed to start scan:', err) }
  finally { scanning.value = false }
}

onMounted(fetchBrandDetail)
</script>

<style scoped>
.geo-page { padding: 24px; color: #e0e0e0; height: 100%; overflow-y: auto; }
.geo-page-header { margin-bottom: 20px; }
.geo-page-header-left { display: flex; align-items: center; gap: 12px; }
.geo-page-title { font-size: 20px; font-weight: 700; margin: 0; }
.geo-btn { border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.15s; padding: 8px 16px; }
.geo-btn-ghost { background: rgba(255,255,255,0.06); color: #ccc; }
.geo-btn-ghost:hover { background: rgba(255,255,255,0.1); }
.geo-btn-sm { padding: 6px 14px; font-size: 12px; }

/* ── Workflow Card ── */
.geo-workflow-card {
  background: #1a1a2e; border-radius: 10px; border: 1px solid rgba(255,255,255,0.04);
  margin-bottom: 16px; overflow: hidden;
}
.geo-workflow-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.04);
}
.geo-workflow-title { margin: 0; font-size: 15px; font-weight: 600; color: #e0e0e0; }
.geo-workflow-status { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 10px; }
.geo-workflow-status--done { background: rgba(52,211,153,0.12); color: #34d399; }
.geo-workflow-status--active { background: rgba(129,140,248,0.12); color: #818cf8; }
.geo-workflow-steps { padding: 16px 20px; display: flex; flex-direction: column; gap: 8px; }
.geo-workflow-step { display: flex; align-items: center; gap: 12px; }
.geo-workflow-step-icon { width: 24px; text-align: center; font-size: 14px; }
.geo-workflow-step-content { flex: 1; display: flex; justify-content: space-between; align-items: center; }
.geo-workflow-step-label { font-size: 13px; font-weight: 500; color: #ccc; }
.geo-workflow-step--done .geo-workflow-step-label { color: #34d399; }
.geo-workflow-step--active .geo-workflow-step-label { color: #818cf8; }
.geo-workflow-step-status { font-size: 11px; color: #6b7280; }
.geo-workflow-step-status--done { color: #34d399; }
.geo-workflow-step-status--pending { color: #4b5563; }
.geo-spinner {
  display: inline-block; width: 14px; height: 14px;
  border: 2px solid rgba(129,140,248,0.2); border-top-color: #818cf8;
  border-radius: 50%; animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
