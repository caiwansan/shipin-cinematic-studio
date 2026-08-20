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

        <!-- P0: AI 实测可见度 + 知识质量 -->
        <section class="mc-layout__section mc-layout__ai-section">
          <AIVisibilityCard
            :result="aiVisibility"
            :loading="aiProbeLoading || closedLoopLoading"
            @probe="handleAIProbe"
            @closed-loop="handleClosedLoop"
          />
          <!-- 闭环优化结果 -->
          <div v-if="closedLoopResult" class="mc-layout__closed-loop-result">
            <p class="mc-layout__closed-loop-title">⚡ 闭环优化结果</p>
            <div class="mc-layout__closed-loop-scores">
              <span>优化前: {{ closedLoopResult.before }}分</span>
              <span class="mc-layout__closed-loop-arrow">→</span>
              <span>优化后: {{ closedLoopResult.after }}分</span>
              <span class="mc-layout__closed-loop-delta" :class="closedLoopResult.improvement >= 0 ? 'positive' : 'negative'">
                {{ closedLoopResult.improvement >= 0 ? '+' : '' }}{{ closedLoopResult.improvement }}分
              </span>
            </div>
            <!-- 详细报告 -->
            <div v-if="closedLoopReport" class="mc-layout__closed-loop-detail">
              <div class="mc-layout__closed-loop-phases">
                <div class="mc-layout__phase">
                  <span class="mc-layout__phase-num">1</span>
                  <span class="mc-layout__phase-label">探测基线</span>
                  <span class="mc-layout__phase-score">{{ closedLoopReport.phase1_probe.score }}分</span>
                </div>
                <div class="mc-layout__phase-arrow">→</div>
                <div class="mc-layout__phase">
                  <span class="mc-layout__phase-num">2</span>
                  <span class="mc-layout__phase-label">诊断分析</span>
                  <span class="mc-layout__phase-score">{{ closedLoopReport.phase2_diagnose.report?.knowledgeGaps?.length || 0 }}个缺口</span>
                </div>
                <div class="mc-layout__phase-arrow">→</div>
                <div class="mc-layout__phase">
                  <span class="mc-layout__phase-num">3</span>
                  <span class="mc-layout__phase-label">AI改写</span>
                  <span class="mc-layout__phase-score">+{{ closedLoopReport.comparison.knowledgeAdded }}条</span>
                </div>
                <div class="mc-layout__phase-arrow">→</div>
                <div class="mc-layout__phase">
                  <span class="mc-layout__phase-num">4</span>
                  <span class="mc-layout__phase-label">再探测</span>
                  <span class="mc-layout__phase-score">{{ closedLoopReport.phase4_reprobe.score }}分</span>
                </div>
              </div>
              <!-- 诊断摘要 -->
              <div v-if="closedLoopReport.phase2_diagnose.report" class="mc-layout__diagnosis-summary">
                <span v-for="(gap, i) in (closedLoopReport.phase2_diagnose.report?.knowledgeGaps || []).slice(0, 3)" :key="i" class="mc-layout__diagnosis-tag">
                  🔍 {{ gap.topic }}
                </span>
                <span v-for="(issue, i) in (closedLoopReport.phase2_diagnose.report?.contentIssues || []).slice(0, 2)" :key="'i'+i" class="mc-layout__diagnosis-tag">
                  ⚠️ {{ issue.type === 'too_short' ? '内容过短' : issue.type === 'no_data' ? '缺少数据' : issue.type === 'duplicate' ? '内容重复' : issue.type }}
                </span>
              </div>
              <p class="mc-layout__closed-loop-summary">{{ closedLoopReport.summary }}</p>
            </div>
          </div>
          <KnowledgeQualityCard :report="knowledgeQuality" />
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
import {
  fetchMissionCenter,
  runAIProbe,
  fetchKnowledgeQuality,
  runFullClosedLoop,
  type MissionCenterState,
  type Mission,
  type AIVisibilityResult,
  type KnowledgeQualityResult,
  type FullClosedLoopReport,
} from '../services/missionService'
import type { TaskCardModel } from '../types/business'
import { useJourney } from '../composables/useJourney'
import GeoPageSkeleton from '../components/GeoPageSkeleton/index.vue'
import GeoErrorState from '../components/GeoErrorState/index.vue'
import GeoEmptyState from '../components/GeoEmptyState/index.vue'
import MissionCard from '../components/MissionCard.vue'
import GeoJourneyBar from '../components/GeoJourneyBar/index.vue'
import GeoCTAFooter from '../components/GeoCTAFooter/index.vue'
import AIVisibilityCard from '../components/AIVisibilityCard/AIVisibilityCard.vue'
import KnowledgeQualityCard from '../components/KnowledgeQualityCard/KnowledgeQualityCard.vue'

const router = useRouter()
const store = useGeoProjectStore()
const { steps: journeySteps, currentStepKey, ctaLabels, goToNextStep, goToPrevStep } = useJourney()
const completedSteps = ref<string[]>([])

const pageState = ref<'loading' | 'ready' | 'empty' | 'error'>('loading')
const errorMessage = ref('')
const missionCenter = ref<MissionCenterState | null>(null)

// AI Probe state
const aiVisibility = ref<AIVisibilityResult | null>(null)
const knowledgeQuality = ref<KnowledgeQualityResult | null>(null)
const aiProbeLoading = ref(false)
const closedLoopLoading = ref(false)
const closedLoopResult = ref<{ before: number; after: number; improvement: number } | null>(null)
const closedLoopReport = ref<FullClosedLoopReport | null>(null)
const currentBrandId = ref<string>('')

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

// AI Probe actions
async function handleAIProbe() {
  if (!currentBrandId.value) return
  aiProbeLoading.value = true
  closedLoopResult.value = null
  try {
    aiVisibility.value = await runAIProbe(currentBrandId.value)
    // Also refresh knowledge quality
    knowledgeQuality.value = await fetchKnowledgeQuality(currentBrandId.value)
  } catch (err: any) {
    console.error('[AI Probe failed]', err)
  } finally {
    aiProbeLoading.value = false
  }
}

async function handleClosedLoop() {
  if (!currentBrandId.value) return
  closedLoopLoading.value = true
  closedLoopResult.value = null
  closedLoopReport.value = null
  try {
    const result = await runFullClosedLoop(currentBrandId.value)
    closedLoopReport.value = result
    closedLoopResult.value = {
      before: result.comparison.beforeScore,
      after: result.comparison.afterScore,
      improvement: result.comparison.scoreChange,
    }
    // Refresh after optimization
    aiVisibility.value = await runAIProbe(currentBrandId.value)
    knowledgeQuality.value = await fetchKnowledgeQuality(currentBrandId.value)
  } catch (err: any) {
    console.error('[Closed loop failed]', err)
  } finally {
    closedLoopLoading.value = false
  }
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
    currentBrandId.value = brandId
    missionCenter.value = await fetchMissionCenter(brandId)
    // Also load knowledge quality (non-blocking)
    try {
      knowledgeQuality.value = await fetchKnowledgeQuality(brandId)
    } catch {
      // non-critical
    }
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

/* AI Section */
.mc-layout__ai-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: start;
}

.mc-layout__closed-loop-result {
  grid-column: 1 / -1;
  background: linear-gradient(135deg, #eff6ff, #f0fdf4);
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  padding: 16px 20px;
  text-align: center;
}

.mc-layout__closed-loop-title {
  font-size: 14px;
  font-weight: 700;
  color: #1e40af;
  margin: 0 0 8px;
}

.mc-layout__closed-loop-scores {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 14px;
  color: #374151;
}

.mc-layout__closed-loop-arrow {
  font-size: 18px;
  color: #9ca3af;
}

.mc-layout__closed-loop-delta {
  font-weight: 800;
  font-size: 16px;
}

.mc-layout__closed-loop-delta.positive { color: #16a34a; }
.mc-layout__closed-loop-delta.negative { color: #dc2626; }

.mc-layout__closed-loop-detail {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #bfdbfe;
}

.mc-layout__closed-loop-phases {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.mc-layout__phase {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  min-width: 70px;
}

.mc-layout__phase-num {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #3b82f6;
  color: #fff;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
}

.mc-layout__phase-label {
  font-size: 11px;
  color: #6b7280;
  white-space: nowrap;
}

.mc-layout__phase-score {
  font-size: 13px;
  font-weight: 700;
  color: #1f2937;
}

.mc-layout__phase-arrow {
  font-size: 16px;
  color: #9ca3af;
}

.mc-layout__diagnosis-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin-bottom: 8px;
}

.mc-layout__diagnosis-tag {
  font-size: 11px;
  padding: 3px 8px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  color: #374151;
}

.mc-layout__closed-loop-summary {
  font-size: 13px;
  color: #374151;
  text-align: center;
  margin: 8px 0 0;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .mc-layout__ai-section {
    grid-template-columns: 1fr;
  }
  .mc-layout__closed-loop-phases {
    flex-direction: column;
  }
  .mc-layout__phase-arrow {
    transform: rotate(90deg);
  }
}
</style>
