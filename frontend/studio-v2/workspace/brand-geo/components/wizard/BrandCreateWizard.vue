<template>
  <div v-if="visible" class="geo-wizard-overlay" @click.self="handleClose">
    <div class="geo-wizard-modal">
      <div class="geo-wizard-header">
        <h3 style="margin:0;color:#e0e0e0;font-size:15px">创建品牌 — {{ stepLabels[currentStep] }}</h3>
        <button class="geo-btn geo-btn-ghost" @click="handleClose">✕</button>
      </div>

      <div class="geo-wizard-progress">
        <template v-for="(label, idx) in stepLabels" :key="idx">
          <div class="geo-progress-dot" :class="{ active: idx <= currentStep, done: idx < currentStep }" />
          <div v-if="idx < stepLabels.length - 1" class="geo-progress-line" :class="{ filled: idx < currentStep }" />
        </template>
      </div>

      <div class="geo-wizard-body">
        <StepBasicInfo v-if="currentStep === 0" v-model="draft" />

        <StepProvider v-else-if="currentStep === 1" @configured="onProviderConfigured" @navigate="emit('navigate', $event)" />

        <StepWebsite v-else-if="currentStep === 2" v-model="websiteOptions" />

        <StepKeywords v-else-if="currentStep === 3" v-model="keywordsText" />

        <StepAnalysis v-else-if="currentStep === 4" :summary="analysisSummary" @start="startAnalysis" />

        <StepDiscovery v-else-if="currentStep === 5" :status="discoveryStatus" />

        <StepFinish v-else-if="currentStep === 6" :result-summary="resultSummary" :brand-name="draft.name" @navigate="onNavigate" />
      </div>

      <div class="geo-wizard-footer">
        <button v-if="currentStep > 0 && currentStep < 5" class="geo-btn geo-btn-ghost" @click="prevStep">上一步</button>
        <button v-else class="geo-btn geo-btn-ghost" style="visibility:hidden">占位</button>

        <div style="display:flex;gap:8px">
          <button v-if="currentStep < 4" class="geo-btn geo-btn-secondary" @click="handleClose">取消</button>
          <button v-if="currentStep < 4" class="geo-btn geo-btn-primary" :disabled="!canNext" @click="nextStep">
            {{ currentStep === 4 ? '开始分析' : '下一步' }}
          </button>
          <button v-if="currentStep === 6" class="geo-btn geo-btn-primary" @click="handleClose">完成</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onBeforeUnmount } from 'vue'
import StepBasicInfo from './StepBasicInfo.vue'
import StepProvider from './StepProvider.vue'
import StepWebsite from './StepWebsite.vue'
import StepKeywords from './StepKeywords.vue'
import StepAnalysis from './StepAnalysis.vue'
import StepDiscovery from './StepDiscovery.vue'
import StepFinish from './StepFinish.vue'

const props = defineProps({ visible: Boolean })
const emit = defineEmits(['close', 'navigate'])

const stepLabels = ['基本信息', 'Provider', '官网配置', '关键词', '确认分析', '发现中', '完成']

const currentStep = ref(0)
const draft = ref(JSON.parse(localStorage.getItem('geo-create-draft') || '{}'))
const providerConfigured = ref(false)
const websiteOptions = ref({ url: '', deepScan: true, extractMeta: true, autoDiscover: true })
const keywordsText = ref('')
const discoveryStatus = ref('')
const resultSummary = ref({ koCount: 0, entityCount: 0, relationCount: 0, keywordCount: 0 })
let pollTimer = null

const canNext = computed(() => {
  if (currentStep.value === 0) return !!draft.value.name
  if (currentStep.value === 1) return providerConfigured.value
  if (currentStep.value === 2) return !!websiteOptions.value.url
  if (currentStep.value === 3) return keywordsText.value.trim().length > 0
  return true
})

const analysisSummary = computed(() => ({
  name: draft.value.name,
  websiteUrl: websiteOptions.value.url,
  keywordCount: keywordsText.value.split('\n').filter(s => s.trim()).length,
  deepScan: websiteOptions.value.deepScan,
  providerConfigured: providerConfigured.value
}))

watch(draft, (v) => {
  if (v.name || v.website) localStorage.setItem('geo-create-draft', JSON.stringify(v))
}, { deep: true })

function nextStep() {
  if (currentStep.value < 4) currentStep.value++
}

function prevStep() {
  if (currentStep.value > 0) currentStep.value--
}

function handleClose() {
  stopPolling()
  emit('close')
}

function onProviderConfigured(v) { providerConfigured.value = v }

async function startAnalysis() {
  currentStep.value = 5
  try {
    const brandRes = await fetch('/api/geo/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draft.value.name,
        website: draft.value.website,
        industry: draft.value.industry,
        region: draft.value.region,
        language: draft.value.language,
        description: draft.value.description
      })
    })
    const brand = await brandRes.json()
    const brandId = brand.id

    const keywords = keywordsText.value.split('\n').filter(s => s.trim())
    if (keywords.length) {
      await fetch(`/api/geo/brands/${brandId}/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords })
      })
    }

    await fetch(`/api/geo/brands/${brandId}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: websiteOptions.value.url,
        deepScan: websiteOptions.value.deepScan,
        extractMeta: websiteOptions.value.extractMeta,
        autoDiscover: websiteOptions.value.autoDiscover
      })
    })

    pollTimer = setInterval(() => pollStatus(brandId), 3000)
  } catch {
    discoveryStatus.value = 'error'
  }
}

async function pollStatus(brandId) {
  try {
    const res = await fetch(`/api/geo/brands/${brandId}/status`)
    const data = await res.json()
    discoveryStatus.value = data.status
    if (data.status === 'kgComplete') {
      resultSummary.value = {
        koCount: data.koCount || 0,
        entityCount: data.entityCount || 0,
        relationCount: data.relationCount || 0,
        keywordCount: data.keywordCount || 0
      }
      stopPolling()
      currentStep.value = 6
      localStorage.removeItem('geo-create-draft')
    }
  } catch {
    discoveryStatus.value = 'error'
    stopPolling()
  }
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

function onNavigate(panel) {
  stopPolling()
  emit('navigate', panel)
}

onBeforeUnmount(stopPolling)
</script>

<style scoped>
.geo-progress-dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: rgba(255,255,255,0.12); flex-shrink: 0;
  transition: all 0.3s;
}
.geo-progress-dot.active { background: #818cf8; }
.geo-progress-dot.done { background: #6366f1; }
.geo-progress-line {
  flex: 1; height: 2px; background: rgba(255,255,255,0.08); margin: 0 4px;
  transition: all 0.3s;
}
.geo-progress-line.filled { background: #818cf8; }
.text-green { color: #34d399; }
.text-warning { color: #f59e0b; }
</style>
