<template>
  <div class="cg-page-wrapper">
    <!-- Journey Bar -->
    <GeoJourneyBar
      :steps="journeySteps"
      :current-step="currentStepKey"
      :completed-steps="completedSteps"
    />

    <div class="cg-layout">
      <GeoPageSkeleton v-if="pageState === 'loading'" />
      <GeoErrorState v-else-if="pageState === 'error'" :message="errorMsg" @retry="loadData" />
      <template v-else-if="pageState === 'ready'">
        <CompletionCard
          :status="passStatus ? 'pass' : 'fail'"
          :brand="brandName"
          :summary="summaryText"
          :details="details"
          @close="handleClose"
          @retry="handleRetry"
        />
        <!-- Sprint G: Customer Success Card (shown on pass) -->
        <section v-if="passStatus" class="cg-layout__section">
          <CustomerSuccessCard
            :report="customerSuccessReport"
            :loading="customerSuccessLoading"
            :error="customerSuccessError"
            @retry="loadCustomerSuccess"
            @view-report="goToFullReport"
          />
        </section>
        <CompletionJourney :steps="journeySteps" />
      </template>
      <GeoEmptyState v-else title="暂无验证任务" description="请先完成优化 Mission">
        <template #actions>
          <NuxtLink to="/workspace/geo/dashboard" class="cg-layout__link-btn">返回 Dashboard</NuxtLink>
        </template>
      </GeoEmptyState>
    </div>

    <!-- CTA Footer -->
    <GeoCTAFooter
      :next-step-label="ctaLabels.nextStepLabel"
      :primary-action="{ label: ctaLabels.primaryLabel, onClick: goToNextStep }"
      :secondary-action="ctaLabels.secondaryLabel ? { label: ctaLabels.secondaryLabel, onClick: goToPrevStep } : null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useJourney } from '../composables/useJourney'
import GeoPageSkeleton from '../components/GeoPageSkeleton/index.vue'
import GeoErrorState from '../components/GeoErrorState/index.vue'
import GeoEmptyState from '../components/GeoEmptyState/index.vue'
import CompletionCard from '../components/CompletionGate/CompletionCard.vue'
import CompletionJourney from '../components/CompletionGate/CompletionJourney.vue'
import GeoJourneyBar from '../components/GeoJourneyBar/index.vue'
import GeoCTAFooter from '../components/GeoCTAFooter/index.vue'
import CustomerSuccessCard from '../components/business/CustomerSuccessCard.vue'
import { fetchCustomerSuccessReport } from '../services/customerSuccessService'
import type { CustomerSuccessReport } from '../services/customerSuccessService'
import { useGeoProjectContext } from '../composables/useGeoProjectContext'

const router = useRouter()
const route = useRoute()
const { steps: journeySteps, currentStepKey, ctaLabels, goToNextStep, goToPrevStep } = useJourney()
const completedSteps = ref<string[]>([])

// ── Sprint G: Customer Success State ──
const customerSuccessReport = ref<CustomerSuccessReport | null>(null)
const customerSuccessLoading = ref(false)
const customerSuccessError = ref<string | null>(null)

// ── Sprint G: Load customer success report ──
async function loadCustomerSuccess() {
  const { projectId: ctxId } = useGeoProjectContext()
  const projectId = ctxId.value || ''
  if (!projectId) return

  customerSuccessLoading.value = true
  customerSuccessError.value = null
  customerSuccessReport.value = null

  try {
    customerSuccessReport.value = await fetchCustomerSuccessReport(projectId)
  } catch (err: any) {
    customerSuccessError.value = err instanceof Error ? err.message : '获取客户成功报告失败'
  } finally {
    customerSuccessLoading.value = false
  }
}

function goToFullReport() {
  const { projectId: ctxId } = useGeoProjectContext()
  const projectId = ctxId.value
  if (projectId) {
    window.open(`/workspace/geo/report/${projectId}`, '_blank')
  }
}

const pageState = ref<'loading' | 'ready' | 'empty' | 'error'>('empty')
const errorMsg = ref('')
const passStatus = ref(false)
const brandName = ref('')
const summaryText = ref('')
const details = ref([])

function handleClose() { router.push('/workspace/geo/dashboard') }
function handleRetry() { router.push('/workspace/geo/mission-center') }

async function loadData() {
  pageState.value = 'empty'
}
</script>

<style scoped>
.cg-page-wrapper {
  max-width: 960px;
  margin: 0 auto;
}

.cg-layout { padding: 20px 0; }

.cg-layout__section {
  margin-top: 24px;
  margin-bottom: 24px;
}
</style>
