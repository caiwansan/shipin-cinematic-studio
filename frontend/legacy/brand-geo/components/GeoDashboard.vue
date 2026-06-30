<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div class="geo-dashboard">
    <!-- Loading -->
    <div v-if="loading" class="geo-loading-wrapper">
      <div class="geo-loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <template v-else>
      <!-- ════════ SECTION 0: Empty State — Start Analysis CTA ════════ -->
      <div v-if="!hasProjects" class="geo-mission-card">
        <div class="geo-mission-content">
          <div class="geo-mission-icon-wrapper">
            <span class="geo-mission-icon">🚀</span>
          </div>
          <div class="geo-mission-text">
            <h2 class="geo-mission-title">开始品牌 GEO 分析</h2>
            <p class="geo-mission-desc">添加品牌信息，获取 AI 推荐指数并开启增长之旅</p>
          </div>
          <button class="geo-btn geo-btn-primary geo-btn-lg" @click="onMissionAction">
            开始分析
          </button>
        </div>
      </div>

      <template v-if="hasProjects">
        <!-- ════════ SECTION 1: AI Recommendation Score ════════ -->
        <div class="geo-section">
          <div class="geo-section-header">
            <h3 class="geo-section-title">AI 推荐指数</h3>
          </div>
          <div class="geo-score-card">
            <div class="geo-score-overall">
              <div class="geo-score-circle" :class="scoreColorClass">
                <span class="geo-score-number">{{ scoreData.overall }}</span>
                <span class="geo-score-max">/100</span>
              </div>
              <div class="geo-score-label">综合评分</div>
            </div>
            <div class="geo-score-bars">
              <div class="geo-score-bar-item">
                <div class="geo-score-bar-header">
                  <span class="geo-score-bar-label">可见度</span>
                  <span class="geo-score-bar-value">{{ scoreData.visibility }}</span>
                </div>
                <div class="geo-score-bar-track">
                  <div class="geo-score-bar-fill geo-bar-visibility" :style="{ width: scoreData.visibility + '%' }"></div>
                </div>
              </div>
              <div class="geo-score-bar-item">
                <div class="geo-score-bar-header">
                  <span class="geo-score-bar-label">权威性</span>
                  <span class="geo-score-bar-value">{{ scoreData.authority }}</span>
                </div>
                <div class="geo-score-bar-track">
                  <div class="geo-score-bar-fill geo-bar-authority" :style="{ width: scoreData.authority + '%' }"></div>
                </div>
              </div>
              <div class="geo-score-bar-item">
                <div class="geo-score-bar-header">
                  <span class="geo-score-bar-label">内容</span>
                  <span class="geo-score-bar-value">{{ scoreData.content }}</span>
                </div>
                <div class="geo-score-bar-track">
                  <div class="geo-score-bar-fill geo-bar-content" :style="{ width: scoreData.content + '%' }"></div>
                </div>
              </div>
              <div class="geo-score-bar-item">
                <div class="geo-score-bar-header">
                  <span class="geo-score-bar-label">网站</span>
                  <span class="geo-score-bar-value">{{ scoreData.website }}</span>
                </div>
                <div class="geo-score-bar-track">
                  <div class="geo-score-bar-fill geo-bar-website" :style="{ width: scoreData.website + '%' }"></div>
                </div>
              </div>
              <div class="geo-score-bar-item">
                <div class="geo-score-bar-header">
                  <span class="geo-score-bar-label">知识</span>
                  <span class="geo-score-bar-value">{{ scoreData.knowledge }}</span>
                </div>
                <div class="geo-score-bar-track">
                  <div class="geo-score-bar-fill geo-bar-knowledge" :style="{ width: scoreData.knowledge + '%' }"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ════════ SECTION 2: Today's Tasks (Growth) ════════ -->
        <div class="geo-section">
          <div class="geo-section-header">
            <h3 class="geo-section-title">📋 今天建议完成</h3>
            <span class="geo-section-badge">{{ growthOptions.length }} 项可用</span>
          </div>
          <div class="geo-tasks-list">
            <div
              v-for="option in growthOptions"
              :key="option.type"
              class="geo-task-card"
            >
              <div class="geo-task-info">
                <div class="geo-task-title">{{ option.label }}</div>
                <div class="geo-task-meta">
                  <span class="geo-task-effort" :class="'geo-effort-' + option.effort.toLowerCase()">
                    {{ effortLabel(option.effort) }}
                  </span>
                  <span class="geo-task-impact">预计 +{{ option.impact }} 分</span>
                </div>
              </div>
              <button
                class="geo-btn geo-btn-primary geo-btn-sm"
                :disabled="executingTask === option.type"
                @click="executeTask(option.type)"
              >
                {{ executingTask === option.type ? '执行中...' : '执行' }}
              </button>
            </div>
          </div>
        </div>

        <!-- ════════ SECTION 3: Simulator ════════ -->
        <div class="geo-section">
          <div class="geo-section-header">
            <h3 class="geo-section-title">🔮 如果... (模拟器)</h3>
          </div>
          <div class="geo-simulator-card">
            <div class="geo-sim-controls">
              <div class="geo-sim-slider">
                <label>添加知识条目: {{ simScenario.additionalKnowledge }}</label>
                <div class="geo-slider-row">
                  <input type="range" v-model.number="simScenario.additionalKnowledge" min="0" max="20" />
                  <span class="geo-slider-val">{{ simScenario.additionalKnowledge }}</span>
                </div>
              </div>
              <div class="geo-sim-slider">
                <label>添加事实声明: {{ simScenario.additionalClaims }}</label>
                <div class="geo-slider-row">
                  <input type="range" v-model.number="simScenario.additionalClaims" min="0" max="20" />
                  <span class="geo-slider-val">{{ simScenario.additionalClaims }}</span>
                </div>
              </div>
              <div class="geo-sim-slider">
                <label>添加引用证据: {{ simScenario.additionalEvidence }}</label>
                <div class="geo-slider-row">
                  <input type="range" v-model.number="simScenario.additionalEvidence" min="0" max="20" />
                  <span class="geo-slider-val">{{ simScenario.additionalEvidence }}</span>
                </div>
              </div>
              <div class="geo-sim-checkboxes">
                <label class="geo-checkbox">
                  <input type="checkbox" v-model="simScenario.hasWebsite" />
                  配置官网
                </label>
                <label class="geo-checkbox">
                  <input type="checkbox" v-model="simScenario.hasFAQ" />
                  添加 FAQ
                </label>
                <label class="geo-checkbox">
                  <input type="checkbox" v-model="simScenario.hasSchema" />
                  添加 Schema
                </label>
              </div>
            </div>
            <div class="geo-sim-result" v-if="simResult">
              <div class="geo-sim-score-change" :class="simResult.improvement > 0 ? 'positive' : 'negative'">
                {{ simResult.currentScore }} → {{ simResult.simulatedScore }}
                <span class="geo-sim-delta">({{ simResult.improvement > 0 ? '+' : '' }}{{ simResult.improvement }})</span>
              </div>
              <div class="geo-sim-visibility">{{ simResult.estimatedVisibilityIncrease }}</div>
            </div>
            <button
              class="geo-btn geo-btn-secondary"
              :disabled="simulating"
              @click="runSimulation"
            >
              {{ simulating ? '模拟中...' : '模拟' }}
            </button>
          </div>
        </div>

        <!-- ════════ SECTION 4: Growth Forecast ════════ -->
        <div class="geo-section">
          <div class="geo-section-header">
            <h3 class="geo-section-title">📈 未来增长预测</h3>
          </div>
          <div class="geo-forecast-grid" v-if="forecast.forecast && forecast.forecast.length">
            <div
              v-for="f in forecast.forecast"
              :key="f.period"
              class="geo-forecast-card"
            >
              <div class="geo-forecast-period">{{ periodLabel(f.period) }}</div>
              <div class="geo-forecast-score">{{ f.estimatedScore }}</div>
              <div class="geo-forecast-visibility">{{ f.estimatedVisibility }}</div>
              <div class="geo-forecast-actions">
                <div v-for="action in f.keyActions.slice(0, 3)" :key="action" class="geo-forecast-action">
                  • {{ action }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ════════ SECTION 5: Growth Timeline ════════ -->
        <div class="geo-section" v-if="timelinePoints && timelinePoints.length">
          <div class="geo-section-header">
            <h3 class="geo-section-title">📊 评分变化</h3>
          </div>
          <div class="geo-timeline-sparkline">
            <div class="geo-sparkline-container">
              <div
                v-for="(pt, idx) in timelinePoints"
                :key="idx"
                class="geo-sparkline-bar"
                :style="{ height: (pt.score / 100) * 120 + 'px' }"
                :title="pt.label + ': ' + pt.score"
              ></div>
            </div>
            <div class="geo-sparkline-labels">
              <span v-for="(pt, idx) in timelinePoints" :key="'l-' + idx" class="geo-sparkline-label">
                {{ pt.label }}
              </span>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fetchScore, fetchIntelligence } from '../services/recommendationService'
import { fetchGrowthOptions, fetchGrowthForecast, executeGrowthTask } from '../services/growthService'
import { simulateScore, SimulationScenario } from '../services/simulatorService'

const props = defineProps<{
  projectId?: string
}>()

const emit = defineEmits<{
  (e: 'action', type: string): void
}>()

// ── State ──
const loading = ref(true)
const hasProjects = ref(false)
const scoreData = ref({
  overall: 0,
  visibility: 0,
  authority: 0,
  content: 0,
  website: 0,
  knowledge: 0,
})
const growthOptions = ref<any[]>([])
const forecast = ref<any>({})
const timelinePoints = ref<any[]>([])
const executingTask = ref<string | null>(null)
const simScenario = ref<SimulationScenario>({
  additionalKnowledge: 0,
  additionalClaims: 0,
  additionalEvidence: 0,
  additionalEntities: 0,
  hasWebsite: false,
  hasFAQ: false,
  hasSchema: false,
})
const simResult = ref<any>(null)
const simulating = ref(false)

// ── Computed ──
const scoreColorClass = computed(() => {
  const s = scoreData.value.overall
  if (s >= 80) return 'geo-score-excellent'
  if (s >= 60) return 'geo-score-good'
  if (s >= 40) return 'geo-score-average'
  return 'geo-score-low'
})

const missionIcon = computed(() => scoreData.value.overall < 60 ? '🚀' : '📈')
const missionTitle = computed(() => scoreData.value.overall < 60 ? '提升 AI 推荐指数' : '保持增长势头')
const missionDesc = computed(() => scoreData.value.overall < 60 ? '完成今天的优化任务，快速提升评分' : '持续优化内容，扩大 AI 推荐优势')
const missionAction = computed(() => scoreData.value.overall < 60 ? '开始优化' : '查看详情')

// ── Helpers ──
function effortLabel(effort: string): string {
  const labels: Record<string, string> = { EASY: '⚡ 简单', MEDIUM: '⏳ 中等', HARD: '🔥 复杂' }
  return labels[effort] || effort
}

function periodLabel(period: string): string {
  const labels: Record<string, string> = { '7d': '7 天', '30d': '30 天', '90d': '90 天' }
  return labels[period] || period
}

// ── Actions ──
function onMissionAction() {
  emit('action', 'start')
}

async function executeTask(type: string) {
  if (!props.projectId) return
  executingTask.value = type
  try {
    const result = await executeGrowthTask({
      projectId: props.projectId,
      type,
      brandName: '当前品牌',
    })
    if (result.status === 'completed') {
      await loadData()
    }
  } catch (err) {
    console.error('[GeoDashboard] Task execution failed:', err)
  } finally {
    executingTask.value = null
  }
}

async function runSimulation() {
  if (!props.projectId) return
  simulating.value = true
  try {
    simResult.value = await simulateScore(props.projectId, simScenario.value)
  } catch (err) {
    console.error('[GeoDashboard] Simulation failed:', err)
  } finally {
    simulating.value = false
  }
}

// ── Load Data ──
async function loadData() {
  if (!props.projectId) {
    loading.value = false
    return
  }

  try {
    const [scoreRes, optionsRes, forecastRes, intelRes] = await Promise.allSettled([
      fetchScore(props.projectId),
      fetchGrowthOptions(),
      fetchGrowthForecast(props.projectId),
      fetchIntelligence(props.projectId),
    ])

    if (scoreRes.status === 'fulfilled' && scoreRes.value) {
      scoreData.value = scoreRes.value
      hasProjects.value = true
    }

    if (optionsRes.status === 'fulfilled' && optionsRes.value) {
      growthOptions.value = optionsRes.value
    }

    if (forecastRes.status === 'fulfilled' && forecastRes.value) {
      forecast.value = forecastRes.value
    }

    if (intelRes.status === 'fulfilled' && intelRes.value) {
      const d = intelRes.value
      if (d.timeline && d.timeline.length) {
        // Extract timeline points for sparkline
        timelinePoints.value = d.timeline.map((p: any) => ({
          label: new Date(p.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
          score: p.overall ?? p.score ?? 0,
        }))
      }
    }
  } catch (err) {
    console.error('[GeoDashboard] Failed to load data:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.geo-dashboard {
  max-width: 720px;
  margin: 0 auto;
  padding: 20px 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Loading */
.geo-loading-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: #888;
}
.geo-loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #e0e0e0;
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Section */
.geo-section {
  margin-bottom: 24px;
}
.geo-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.geo-section-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0;
}
.geo-section-badge {
  font-size: 12px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 10px;
}

/* Mission Card (Empty / CTA) */
.geo-mission-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  color: #fff;
}
.geo-mission-content {
  display: flex;
  align-items: center;
  gap: 16px;
}
.geo-mission-icon-wrapper {
  flex-shrink: 0;
}
.geo-mission-icon {
  font-size: 36px;
}
.geo-mission-text {
  flex: 1;
}
.geo-mission-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 4px;
}
.geo-mission-desc {
  font-size: 13px;
  opacity: 0.85;
  margin: 0;
}

/* Buttons */
.geo-btn {
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
  white-space: nowrap;
}
.geo-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.geo-btn-primary {
  background: #fff;
  color: #4f46e5;
  padding: 8px 20px;
}
.geo-btn-primary:hover:not(:disabled) {
  background: #f0f0ff;
}
.geo-btn-secondary {
  background: #4f46e5;
  color: #fff;
  padding: 8px 20px;
  margin-top: 12px;
}
.geo-btn-secondary:hover:not(:disabled) {
  background: #4338ca;
}
.geo-btn-lg {
  padding: 12px 28px;
  font-size: 15px;
}
.geo-btn-sm {
  padding: 6px 14px;
  font-size: 13px;
}

/* Score Card */
.geo-score-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
}
.geo-score-overall {
  text-align: center;
  margin-bottom: 20px;
}
.geo-score-circle {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 4px solid;
  margin-bottom: 8px;
}
.geo-score-excellent { border-color: #10b981; color: #059669; }
.geo-score-good { border-color: #3b82f6; color: #2563eb; }
.geo-score-average { border-color: #f59e0b; color: #d97706; }
.geo-score-low { border-color: #ef4444; color: #dc2626; }
.geo-score-number { font-size: 28px; font-weight: 700; line-height: 1; }
.geo-score-max { font-size: 12px; opacity: 0.7; }
.geo-score-label { font-size: 14px; color: #6b7280; }

/* Score Bars */
.geo-score-bars { display: flex; flex-direction: column; gap: 10px; }
.geo-score-bar-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 13px;
}
.geo-score-bar-label { color: #374151; font-weight: 500; }
.geo-score-bar-value { color: #6b7280; font-weight: 600; }
.geo-score-bar-track {
  height: 8px;
  background: #f3f4f6;
  border-radius: 4px;
  overflow: hidden;
}
.geo-score-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s ease;
}
.geo-bar-visibility { background: #10b981; }
.geo-bar-authority { background: #3b82f6; }
.geo-bar-content { background: #8b5cf6; }
.geo-bar-website { background: #f59e0b; }
.geo-bar-knowledge { background: #06b6d4; }

/* Tasks */
.geo-tasks-list { display: flex; flex-direction: column; gap: 8px; }
.geo-task-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px 16px;
}
.geo-task-title { font-size: 14px; font-weight: 600; color: #1a1a2e; margin-bottom: 4px; }
.geo-task-meta { display: flex; gap: 8px; align-items: center; }
.geo-task-effort { font-size: 11px; padding: 1px 6px; border-radius: 4px; }
.geo-effort-easy { background: #d1fae5; color: #065f46; }
.geo-effort-medium { background: #fef3c7; color: #92400e; }
.geo-effort-hard { background: #fee2e2; color: #991b1b; }
.geo-task-impact { font-size: 12px; color: #059669; font-weight: 600; }

/* Simulator */
.geo-simulator-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
}
.geo-sim-controls { margin-bottom: 12px; }
.geo-sim-slider {
  margin-bottom: 12px;
}
.geo-sim-slider label {
  font-size: 13px;
  color: #374151;
  margin-bottom: 4px;
  display: block;
}
.geo-slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.geo-slider-row input[type="range"] {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: #e5e7eb;
  border-radius: 3px;
  outline: none;
}
.geo-slider-row input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: #4f46e5;
  border-radius: 50%;
  cursor: pointer;
}
.geo-slider-val {
  font-size: 14px;
  font-weight: 600;
  color: #4f46e5;
  min-width: 24px;
  text-align: right;
}
.geo-sim-checkboxes {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.geo-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
}
.geo-sim-result {
  text-align: center;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 8px;
}
.geo-sim-score-change { font-size: 18px; font-weight: 700; }
.geo-sim-score-change.positive { color: #059669; }
.geo-sim-score-change.negative { color: #dc2626; }
.geo-sim-delta { font-size: 14px; }
.geo-sim-visibility { font-size: 13px; color: #6b7280; margin-top: 4px; }

/* Forecast */
.geo-forecast-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.geo-forecast-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
  text-align: center;
}
.geo-forecast-period { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
.geo-forecast-score { font-size: 28px; font-weight: 700; color: #4f46e5; margin-bottom: 2px; }
.geo-forecast-visibility { font-size: 13px; color: #059669; font-weight: 600; margin-bottom: 8px; }
.geo-forecast-actions { text-align: left; }
.geo-forecast-action { font-size: 11px; color: #6b7280; line-height: 1.6; }

/* Timeline Sparkline */
.geo-timeline-sparkline {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
}
.geo-sparkline-container {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 120px;
  margin-bottom: 8px;
}
.geo-sparkline-bar {
  flex: 1;
  background: linear-gradient(to top, #667eea, #764ba2);
  border-radius: 3px 3px 0 0;
  min-height: 4px;
  transition: height 0.3s;
  opacity: 0.8;
}
.geo-sparkline-bar:hover { opacity: 1; }
.geo-sparkline-labels {
  display: flex;
  gap: 4px;
}
.geo-sparkline-label {
  flex: 1;
  font-size: 10px;
  color: #9ca3af;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Responsive */
@media (max-width: 600px) {
  .geo-forecast-grid { grid-template-columns: 1fr; }
  .geo-mission-content { flex-direction: column; text-align: center; }
}
</style>
