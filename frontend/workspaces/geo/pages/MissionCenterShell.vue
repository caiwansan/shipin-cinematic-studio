<template>
  <div class="mc-page-wrapper">
    <!-- Journey Bar -->
    <GeoJourneyBar
      :steps="journeySteps"
      :current-step="currentStepKey"
      :completed-steps="completedSteps"
    />

    <div class="mc-layout">
      <GeoPageSkeleton v-if="pageState === 'loading'" />
      <GeoErrorState v-else-if="pageState === 'error'" :message="errorMessage" @retry="loadData" />

      <template v-else-if="pageState === 'ready'">
        <header class="mc-layout__header">
          <h1 class="mc-layout__title">🎯 优化任务中心</h1>
          <p class="mc-layout__subtitle">按优先级排序的优化任务 — 提升 Brand Health</p>
        </header>

        <section v-if="missionCenter" class="mc-layout__section">
          <div class="mc-layout__progress-card">
            <div class="mc-layout__progress-header">
              <h2 class="mc-layout__progress-title">总体进度</h2>
              <span class="mc-layout__progress-score">{{ missionCenter.score }}%</span>
            </div>
            <div class="mc-layout__progress-bar">
              <div class="mc-layout__progress-fill" :style="{ width: missionCenter.score + '%' }" />
            </div>
          </div>
        </section>

        <!-- IA-01-St4: Missions empty state -->
        <section v-if="missionCenter && sortedMissions.length === 0" class="mc-layout__section">
          <div class="mc-layout__empty-missions">
            <p class="mc-layout__empty-text">当前暂无可执行优化任务</p>
            <p class="mc-layout__empty-hint">完成 Discovery 后，系统会自动生成优化任务</p>
            <button class="mc-layout__continue-btn" @click="router.push('/workspace/geo/dashboard')">
              返回工作台
            </button>
          </div>
        </section>

        <section v-else-if="missionCenter" class="mc-layout__section">
          <h2 class="mc-layout__section-title">任务列表 ({{ sortedMissions.length }})</h2>
          <div class="mc-layout__mission-list">
            <div v-for="m in sortedMissions" :key="m.id" class="mc-layout__mission-item">
              <MissionCard :card="missionToTaskCard(m)" @action="handleAction" />
            </div>
          </div>
        </section>
      </template>

      <GeoEmptyState v-else title="欢迎使用 GEO" description="创建品牌开始优化">
        <template #actions>
          <NuxtLink to="/workspace/geo/create" class="mc-layout__create-btn">创建品牌</NuxtLink>
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
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGeoProjectStore } from '../stores/useGeoProjectStore'
import { fetchMissionCenter, type MissionCenterState, type Mission } from '../services/missionService'
import type { TaskCardModel } from '../types/business'
import { useJourney } from '../composables/useJourney'
import GeoPageSkeleton from '../components/GeoPageSkeleton/index.vue'
import GeoErrorState from '../components/GeoErrorState/index.vue'
import GeoEmptyState from '../components/GeoEmptyState/index.vue'
import MissionCard from '../components/MissionCard.vue'
import GeoJourneyBar from '../components/GeoJourneyBar/index.vue'
import GeoCTAFooter from '../components/GeoCTAFooter/index.vue'

const router = useRouter()
const store = useGeoProjectStore()
const { steps: journeySteps, currentStepKey, ctaLabels, goToNextStep, goToPrevStep } = useJourney()
const completedSteps = ref<string[]>([])

const pageState = ref<'loading' | 'ready' | 'empty' | 'error'>('loading')
const errorMessage = ref('')
const missionCenter = ref<MissionCenterState | null>(null)

const sortedMissions = computed(() => {
  if (!missionCenter.value) return []
  return [...missionCenter.value.missions].sort((a, b) => a.order - b.order)
})

function missionToTaskCard(mission: Mission): TaskCardModel {
  return {
    id: mission.id,
    title: mission.title,
    summary: mission.description,
    priority: 'medium',
    status: 'pending',
    actions: [{ id: 'navigate', label: mission.action?.label || '查看详情', variant: 'primary' }],
    metadata: {
      why: mission.why,
      impact: mission.impact,
      estimatedTime: mission.estimatedTime,
      difficulty: mission.difficulty,
    },
    createdAt: mission.createdAt,
  }
}

function handleAction(actionId: string) {
  // Navigate based on action
  router.push('/workspace/geo/recommendations')
}

async function loadData() {
  pageState.value = 'loading'
  try {
    const storeProjects = await store.listProjects()
    if (storeProjects.length === 0) {
      pageState.value = 'empty'
      return
    }
    const brandId = storeProjects[0].id
    missionCenter.value = await fetchMissionCenter(brandId)
    pageState.value = 'ready'
  } catch (err: any) {
    errorMessage.value = err?.message || '加载失败'
    pageState.value = 'error'
  }
}

onMounted(loadData)
</script>

<style scoped>
.mc-page-wrapper {
  max-width: 960px;
  margin: 0 auto;
}

.mc-layout {
  padding: 20px 0;
}

.mc-layout__header { margin-bottom: 24px; }
.mc-layout__title { font-size: 24px; font-weight: 700; margin: 0 0 4px; }
.mc-layout__subtitle { font-size: 14px; color: #6b7280; margin: 0; }

.mc-layout__section { margin-bottom: 24px; }

.mc-layout__progress-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
}

.mc-layout__progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.mc-layout__progress-title { font-size: 16px; font-weight: 700; margin: 0; }
.mc-layout__progress-score { font-size: 24px; font-weight: 800; color: #3b82f6; }

.mc-layout__progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.mc-layout__progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #22c55e);
  border-radius: 4px;
  transition: width 0.5s ease;
}

.mc-layout__section-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 16px;
}

.mc-layout__mission-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mc-layout__create-btn {
  display: inline-flex;
  padding: 12px 28px;
  background: #3b82f6;
  color: #fff;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
}

/* IA-01-St4: Empty missions state */
.mc-layout__empty-missions {
  text-align: center;
  padding: 48px 24px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.mc-layout__empty-text {
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 8px;
}

.mc-layout__empty-hint {
  font-size: 14px;
  color: #9ca3af;
  margin: 0 0 24px;
}

.mc-layout__continue-btn {
  display: inline-flex;
  padding: 10px 24px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.mc-layout__continue-btn:hover {
  background: #2563eb;
}
</style>
