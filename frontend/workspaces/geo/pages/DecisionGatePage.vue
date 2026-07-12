<template>
  <div class="dg-page-wrapper">
    <!-- Journey Bar -->
    <GeoJourneyBar
      :steps="journeySteps"
      :current-step="currentStepKey"
      :completed-steps="completedSteps"
    />

    <div class="dg-layout">
      <GeoPageSkeleton v-if="pageState === 'loading'" />
      <GeoErrorState v-else-if="pageState === 'error'" :message="errorMsg" @retry="loadData" />
      <template v-else-if="pageState === 'ready'">
        <DecisionCard
          :problem="primaryProblem"
          :solution="primarySolution"
          :expected-result="primaryGain"
          :effort="primaryEffort"
          :disabled="executing"
          cta-label="创建 Mission 执行 →"
          show-secondary
          secondary-label="查看更多建议"
          @execute="executePrimary"
          @secondary="showAll = !showAll"
        />
        <DecisionJourney :steps="journeySteps" />
      </template>
      <GeoEmptyState v-else title="暂无决策数据" description="请先运行发现扫描">
        <template #actions>
          <NuxtLink to="/workspace/geo/dashboard" class="dg-layout__link-btn">返回 Dashboard</NuxtLink>
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
import DecisionCard from '../components/DecisionPoint/DecisionCard.vue'
import DecisionJourney from '../components/DecisionPoint/DecisionJourney.vue'
import GeoJourneyBar from '../components/GeoJourneyBar/index.vue'
import GeoCTAFooter from '../components/GeoCTAFooter/index.vue'

const router = useRouter()
const { steps: journeySteps, currentStepKey, ctaLabels, goToNextStep, goToPrevStep } = useJourney()
const completedSteps = ref<string[]>([])

const pageState = ref<'loading' | 'ready' | 'empty' | 'error'>('empty')
const errorMsg = ref('')
const executing = ref(false)
const showAll = ref(false)
const primaryProblem = ref('Brand Health 有待提升')
const primarySolution = ref('通过优化知识覆盖和引用质量来提升 Overall Score')
const primaryGain = ref('+15')
const primaryEffort = ref('medium')

async function executePrimary() {
  executing.value = true
  router.push('/workspace/geo/mission-center')
  executing.value = false
}
</script>

<style scoped>
.dg-page-wrapper {
  max-width: 960px;
  margin: 0 auto;
}

.dg-layout { padding: 20px 0; }
</style>
