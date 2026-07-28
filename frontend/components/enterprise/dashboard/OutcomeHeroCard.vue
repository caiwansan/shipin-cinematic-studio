<template>
  <div class="outcome-hero" :class="{ 'outcome-hero--empty': !hasData }">
    <!-- Background decoration -->
    <div class="outcome-hero__glow"></div>

    <!-- Main Content -->
    <div class="outcome-hero__content">
      <!-- Loading state -->
      <div v-if="loading" class="outcome-hero__loading">
        <div class="outcome-hero__spinner"></div>
        <span>汇总今日成果中...</span>
      </div>

      <!-- Empty state -->
      <div v-else-if="!hasData" class="outcome-hero__empty">
        <div class="outcome-hero__empty-icon">🎯</div>
        <h3 class="outcome-hero__empty-title">AI 员工即将开始工作</h3>
        <p class="outcome-hero__empty-desc">现在，你的 AI 团队已就绪。第一次成果报告，将在 AI 员工完成任务后出现。</p>
        <button class="outcome-hero__empty-cta" @click="$emit('go-to-employees')">
          查看 AI 员工团队 →
        </button>
      </div>

      <!-- Has data: CEO Value Story -->
      <div v-else class="outcome-hero__story">
        <!-- Hero headline -->
        <div class="outcome-hero__headline">
          <span class="outcome-hero__emoji">🎉</span>
          <h2 class="outcome-hero__title">
            今天，你的 AI 企业部门创造了
            <span class="outcome-hero__value">{{ formattedImpactValue }}</span>
            业务价值
          </h2>
          <div v-if="yesterdayComparison" class="outcome-hero__comparison" :class="comparisonClass">
            {{ yesterdayComparison }}
          </div>
        </div>

        <!-- Stats bar -->
        <div class="outcome-hero__stats">
          <div class="outcome-hero__stat">
            <span class="outcome-hero__stat-value">{{ totals.actions }}</span>
            <span class="outcome-hero__stat-label">完成工作</span>
          </div>
          <div class="outcome-hero__stat-divider"></div>
          <div class="outcome-hero__stat">
            <span class="outcome-hero__stat-value">{{ totals.outcomes }}</span>
            <span class="outcome-hero__stat-label">产生成果</span>
          </div>
          <div class="outcome-hero__stat-divider"></div>
          <div class="outcome-hero__stat">
            <span class="outcome-hero__stat-value">{{ activeAgentCount }}</span>
            <span class="outcome-hero__stat-label">AI 在岗</span>
          </div>
        </div>

        <!-- Agent contributions -->
        <div v-if="agents && agents.length > 0" class="outcome-hero__agents">
          <div class="outcome-hero__agents-label">主要贡献</div>
          <div class="outcome-hero__agents-list">
            <div
              v-for="agent in topAgents"
              :key="agent.agentId"
              class="outcome-hero__agent-chip"
            >
              <span class="outcome-hero__agent-emoji">{{ agentEmoji(agent.agentName) }}</span>
              <span class="outcome-hero__agent-name">{{ agent.agentName }}</span>
              <span class="outcome-hero__agent-stat">
                {{ agent.actionsCompleted }} 项工作
              </span>
              <span v-if="agent.topOutcome" class="outcome-hero__agent-outcome">
                · {{ agent.topOutcome }}
              </span>
            </div>
          </div>
        </div>

        <!-- CTA -->
        <div class="outcome-hero__actions">
          <button class="outcome-hero__cta" @click="$emit('view-timeline')">
            查看今日工作时间线 →
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
import { ref, computed, onMounted } from 'vue'

// Types
interface OutcomeAgent {
  agentId: string
  agentName: string
  actionsCompleted: number
  outcomesGenerated: number
  impactValue: string
  topOutcome: string | null
}

interface OutcomeSummaryData {
  period: string
  totals: {
    actions: number
    outcomes: number
    impactValue: string
  }
  agents: OutcomeAgent[]
}

interface Props {
  organizationId?: string
  // Optional: pass data directly from parent (avoids double fetch)
  prefetchedData?: OutcomeSummaryData | null
  // Yesterday's impact value for comparison (optional)
  yesterdayImpactValue?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'view-timeline'): void
  (e: 'go-to-employees'): void
}>()

const loading = ref(true)
const outcomeData = ref<OutcomeSummaryData | null>(null)
const error = ref<string | null>(null)

const hasData = computed(() => {
  return outcomeData.value && outcomeData.value.totals.actions > 0
})

const totals = computed(() => outcomeData.value?.totals ?? { actions: 0, outcomes: 0, impactValue: '0' })

const formattedImpactValue = computed(() => {
  return totals.value.impactValue
})

const activeAgentCount = computed(() => {
  if (!outcomeData.value?.agents) return 0
  return outcomeData.value.agents.filter(a => a.actionsCompleted > 0).length
})

const topAgents = computed(() => {
  if (!outcomeData.value?.agents) return []
  return [...outcomeData.value.agents]
    .sort((a, b) => b.actionsCompleted - a.actionsCompleted)
    .slice(0, 3)
})

const yesterdayComparison = computed(() => {
  if (!props.yesterdayImpactValue || !hasData.value) return null
  const today = parseImpactNumber(totals.value.impactValue)
  const yesterday = props.yesterdayImpactValue
  if (yesterday <= 0) return null
  const change = ((today - yesterday) / yesterday) * 100
  const sign = change >= 0 ? '+' : ''
  return `比昨日 ${sign}${change.toFixed(0)}%`
})

const comparisonClass = computed(() => {
  if (!yesterdayComparison.value) return ''
  const today = parseImpactNumber(totals.value.impactValue)
  return today >= (props.yesterdayImpactValue ?? 0) ? 'up' : 'down'
})

// Agents max 3
function agentEmoji(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('销售') || lower.includes('sale') || lower.includes('增长')) return '🤖'
  if (lower.includes('内容') || lower.includes('content') || lower.includes('创作')) return '✍️'
  if (lower.includes('运营') || lower.includes('operation') || lower.includes('市场')) return '📊'
  if (lower.includes('客服') || lower.includes('support') || lower.includes('成功')) return '💬'
  if (lower.includes('分析') || lower.includes('analy')) return '🔍'
  return '🤖'
}

function parseImpactNumber(value: string): number {
  if (!value) return 0
  const num = value.replace(/[¥,]/g, '').replace(/[^0-9.]/g, '')
  return parseFloat(num) || 0
}

// Fetch data from backend
async function fetchData() {
  // If prefetched data provided, use it directly
  if (props.prefetchedData) {
    outcomeData.value = props.prefetchedData
    loading.value = false
    return
  }

  if (!props.organizationId) {
    loading.value = false
    return
  }

  try {
    const token = getAuthToken() || ''
    const res = await fetch(`/api/enterprise/outcomes/summary?period=TODAY`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.ok) {
      const json = await res.json()
      if (json.code === 0 && json.data) {
        outcomeData.value = json.data
      }
    }
  } catch (e) {
    error.value = 'fetch-failed'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
/* =============== Outcome Hero Card =============== */
.outcome-hero {
  position: relative;
  border-radius: var(--radius-xl, 16px);
  overflow: hidden;
  background: linear-gradient(135deg, #0a1628 0%, #0f2a4a 40%, #143a5c 100%);
  border: 1px solid rgba(30, 120, 200, 0.25);
  margin-bottom: var(--space-lg, 24px);
}

.outcome-hero__glow {
  position: absolute;
  top: -40%;
  right: -10%;
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(0, 200, 120, 0.06) 0%, transparent 70%);
  pointer-events: none;
}

.outcome-hero__content {
  position: relative;
  z-index: 1;
  padding: var(--space-xl, 32px);
}

/* Loading */
.outcome-hero__loading {
  display: flex;
  align-items: center;
  gap: var(--space-md, 16px);
  padding: var(--space-2xl, 48px) 0;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: var(--font-size-sm, 14px);
}

.outcome-hero__spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #00ff88;
  border-radius: 50%;
  animation: outcome-hero-spin 1s linear infinite;
}

@keyframes outcome-hero-spin {
  to { transform: rotate(360deg); }
}

/* Empty state */
.outcome-hero__empty {
  text-align: center;
  padding: var(--space-xl, 32px) var(--space-lg, 24px);
}

.outcome-hero__empty-icon {
  font-size: 48px;
  margin-bottom: var(--space-md, 16px);
  opacity: 0.8;
}

.outcome-hero__empty-title {
  font-size: 20px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: var(--space-sm, 12px);
}

.outcome-hero__empty-desc {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  max-width: 400px;
  margin: 0 auto var(--space-lg, 24px);
  line-height: 1.6;
}

.outcome-hero__empty-cta {
  padding: 10px 24px;
  background: rgba(0, 200, 120, 0.15);
  color: #00ff88;
  border: 1px solid rgba(0, 200, 120, 0.3);
  border-radius: 999px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.outcome-hero__empty-cta:hover {
  background: rgba(0, 200, 120, 0.25);
  border-color: rgba(0, 200, 120, 0.5);
}

/* Story / Has data */
.outcome-hero__story {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg, 24px);
}

/* Headline */
.outcome-hero__headline {
  text-align: center;
}

.outcome-hero__emoji {
  font-size: 36px;
  display: block;
  margin-bottom: var(--space-sm, 12px);
}

.outcome-hero__title {
  font-size: 18px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  margin: 0;
  line-height: 1.5;
}

.outcome-hero__value {
  display: inline;
  font-size: 32px;
  font-weight: 800;
  color: #00ff88;
  margin: 0 4px;
  text-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
}

.outcome-hero__comparison {
  display: inline-block;
  margin-top: var(--space-sm, 12px);
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.outcome-hero__comparison.up {
  background: rgba(0, 200, 120, 0.15);
  color: #00ff88;
}

.outcome-hero__comparison.down {
  background: rgba(255, 100, 100, 0.15);
  color: #ff6b6b;
}

/* Stats bar */
.outcome-hero__stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xl, 32px);
  padding: var(--space-md, 16px) 0;
}

.outcome-hero__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.outcome-hero__stat-value {
  font-size: 28px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.95);
}

.outcome-hero__stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 500;
}

.outcome-hero__stat-divider {
  width: 1px;
  height: 36px;
  background: rgba(255, 255, 255, 0.15);
}

/* Agents */
.outcome-hero__agents {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm, 12px);
}

.outcome-hero__agents-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-align: center;
}

.outcome-hero__agents-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-sm, 12px);
}

.outcome-hero__agent-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  font-size: 13px;
}

.outcome-hero__agent-emoji {
  font-size: 14px;
}

.outcome-hero__agent-name {
  color: rgba(255, 255, 255, 0.85);
  font-weight: 600;
}

.outcome-hero__agent-stat {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

.outcome-hero__agent-outcome {
  color: rgba(0, 220, 255, 0.7);
  font-size: 12px;
  font-weight: 500;
}

/* CTA */
.outcome-hero__actions {
  text-align: center;
}

.outcome-hero__cta {
  padding: 10px 28px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.outcome-hero__cta:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
  color: white;
}

/* Empty modifier */
.outcome-hero--empty {
  background: linear-gradient(135deg, #0d1a2d 0%, #112035 100%);
  border-color: rgba(30, 80, 140, 0.2);
}

/* Responsive */
@media (max-width: 640px) {
  .outcome-hero__content {
    padding: var(--space-lg, 24px);
  }
  .outcome-hero__title {
    font-size: 15px;
  }
  .outcome-hero__value {
    font-size: 24px;
  }
  .outcome-hero__stats {
    gap: var(--space-lg, 24px);
  }
  .outcome-hero__stat-value {
    font-size: 22px;
  }
}
</style>
