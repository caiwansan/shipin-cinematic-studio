<template>
  <div class="dt-page-wrapper">
    <!-- Journey Bar -->
    <GeoJourneyBar
      :steps="journeySteps"
      :current-step="currentStepKey"
      :completed-steps="completedSteps"
    />

    <div class="dt-layout">
      <GeoPageSkeleton v-if="pageState === 'loading'" />
      <GeoErrorState v-else-if="pageState === 'error'" :message="errorMsg" @retry="loadData" />
      <template v-else-if="pageState === 'ready'">
        <DiscoveryTaskCard
          :brand="brandName"
          status-label="需要优化"
          summary="当前品牌需要进行 AI 可见度发现扫描，识别关键差距和优化机会"
          :issue-count="issueCount"
          cta-label="进入 Recommendations"
        />
        <DiscoveryJourney :steps="journeySteps" />
      </template>
      <GeoEmptyState v-else title="暂无发现数据" description="请先选择一个品牌开始发现扫描">
        <template #actions>
          <NuxtLink to="/workspace/geo/dashboard" class="dt-layout__back-btn">返回 Dashboard</NuxtLink>
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
import { useRouter } from 'vue-router'
import { useJourney } from '../composables/useJourney'
import GeoPageSkeleton from '../components/GeoPageSkeleton/index.vue'
import GeoErrorState from '../components/GeoErrorState/index.vue'
import GeoEmptyState from '../components/GeoEmptyState/index.vue'
import DiscoveryTaskCard from '../components/DiscoveryTask/DiscoveryTaskCard.vue'
import DiscoveryJourney from '../components/DiscoveryTask/DiscoveryJourney.vue'
import GeoJourneyBar from '../components/GeoJourneyBar/index.vue'
import GeoCTAFooter from '../components/GeoCTAFooter/index.vue'

const router = useRouter()
const { steps: journeySteps, currentStepKey, ctaLabels, goToNextStep, goToPrevStep } = useJourney()
const completedSteps = ref<string[]>([])

const pageState = ref<'loading' | 'ready' | 'empty' | 'error'>('empty')
const errorMsg = ref('')
const brandName = ref('')
const issueCount = ref(0)
</script>

<style scoped>
.dt-page-wrapper {
  max-width: 960px;
  margin: 0 auto;
}

.dt-layout { padding: 20px 0; }
</style>
