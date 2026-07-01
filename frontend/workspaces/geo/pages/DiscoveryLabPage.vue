<!--
  DiscoveryLabPage.vue — AI Discovery Lab

  P0-T005 — AI Discovery Lab MVP
  P0-T006 — Opportunity Engine (First Edition) — 升级 Opportunity 展示

  Features:
    1. Entity input + search
    2. ADI large card with 3 sub-dimensions (Coverage / Share / Position)
    3. Scenario Coverage table
    4. High-priority opportunities list — 带 Expected ADI Gain / Reason / Suggestion / Effort
    5. Top 5 scenarios comparison
-->
<template>
  <div class="discovery-lab">
    <!-- Page Header -->
    <header class="discovery-lab__header">
      <h1 class="discovery-lab__title">AI Discovery Lab</h1>
      <p class="discovery-lab__subtitle">
        Evaluate how your entity performs across demand scenarios
      </p>
    </header>

    <!-- Search Section -->
    <section class="discovery-lab__search">
      <div class="discovery-lab__search-inner">
        <input
          v-model="entityInput"
          type="text"
          class="discovery-lab__input"
          placeholder="输入实体名称，如：昆仑镜AI、特斯拉、Nike..."
          @keyup.enter="search"
          @keydown.escape="entityInput = ''"
          :disabled="store.isLoading"
          aria-label="Entity name input"
        />
        <button
          class="discovery-lab__search-btn"
          :disabled="store.isLoading || !entityInput.trim()"
          @click="search"
        >
          <span v-if="store.isLoading" class="discovery-lab__spinner">⟳</span>
          <span v-else>🔍 发现扫描</span>
        </button>
      </div>
      <p v-if="store.error" class="discovery-lab__error">{{ store.error }}</p>
    </section>

    <!-- Loading State -->
    <section v-if="store.isLoading" class="discovery-lab__loading">
      <div class="discovery-lab__loading-card">
        <div class="discovery-lab__spinner-lg">⟳</div>
        <p>正在对「{{ entityInput }}」进行发现扫描...</p>
        <p class="discovery-lab__loading-hint">SIE 场景匹配 → Mock 发现扫描 → ADI 评估 → Opportunity 分析</p>
      </div>
    </section>

    <!-- Empty State -->
    <section v-if="!store.hasData && !store.isLoading" class="discovery-lab__empty">
      <div class="discovery-lab__empty-card">
        <p class="discovery-lab__empty-icon">🔬</p>
        <p class="discovery-lab__empty-title">开始你的第一次发现扫描</p>
        <p class="discovery-lab__empty-desc">
          输入一个品牌、产品或概念的名称，系统将通过 Scenario Intelligence Engine (SIE) 匹配相关需求场景，并模拟 AI 发现扫描过程，生成完整的发现评估报告。
        </p>
      </div>
    </section>

    <!-- Report Section -->
    <template v-if="store.hasData && store.report">
      <!-- ADI Score Card -->
      <section class="discovery-lab__section">
        <div class="discovery-lab__adi-card">
          <div class="discovery-lab__adi-main">
            <div class="discovery-lab__adi-ring">
              <svg viewBox="0 0 120 120" class="discovery-lab__adi-svg">
                <circle cx="60" cy="60" r="54" fill="none" stroke="#e5e7eb" stroke-width="8" />
                <circle
                  cx="60" cy="60" r="54"
                  fill="none"
                  :stroke="adiColor"
                  stroke-width="8"
                  stroke-linecap="round"
                  :stroke-dasharray="`${scorePercent * 3.39} 339`"
                  transform="rotate(-90 60 60)"
                  class="discovery-lab__adi-arc"
                />
              </svg>
              <div class="discovery-lab__adi-value">
                <span class="discovery-lab__adi-number">{{ store.report.adi }}</span>
                <span class="discovery-lab__adi-label">ADI</span>
              </div>
            </div>
            <div class="discovery-lab__adi-info">
              <h2 class="discovery-lab__adi-entity">{{ store.report.entityName }}</h2>
              <p class="discovery-lab__adi-desc">
                {{ adiLabel }} — {{ store.report.adi >= 80 ? 'Excellent brand discovery readiness' : store.report.adi >= 60 ? 'Good discovery foundation' : store.report.adi >= 40 ? 'Needs significant improvement' : 'Critical gaps detected' }}
              </p>
              <div class="discovery-lab__adi-meta">
                <span>Report ID: {{ store.report.id.slice(0, 20) }}...</span>
                <span>Generated: {{ formatDate(store.report.generatedAt) }}</span>
              </div>
            </div>
          </div>

          <!-- Sub-dimensions -->
          <div class="discovery-lab__dims">
            <div v-for="dim in dimensions" :key="dim.id" class="discovery-lab__dim">
              <div class="discovery-lab__dim-header">
                <span class="discovery-lab__dim-label">{{ dim.label }}</span>
                <span class="discovery-lab__dim-score" :style="{ color: dim.color }">{{ dim.value }}/100</span>
              </div>
              <div class="discovery-lab__dim-bar">
                <div
                  class="discovery-lab__dim-fill"
                  :style="{ width: dim.value + '%', backgroundColor: dim.color }"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Coverage Summary -->
      <section class="discovery-lab__section">
        <div class="discovery-lab__card">
          <h3 class="discovery-lab__card-title">Coverage Overview</h3>
          <div class="discovery-lab__coverage-grid">
            <div class="discovery-lab__coverage-stat">
              <span class="discovery-lab__stat-value">{{ store.coveredScenarios.length }}</span>
              <span class="discovery-lab__stat-label">Covered Scenarios</span>
            </div>
            <div class="discovery-lab__coverage-stat">
              <span class="discovery-lab__stat-value">{{ store.uncoveredScenarios.length }}</span>
              <span class="discovery-lab__stat-label">Uncovered Scenarios</span>
            </div>
            <div class="discovery-lab__coverage-stat">
              <span class="discovery-lab__stat-value">{{ store.report.scenarios.length }}</span>
              <span class="discovery-lab__stat-label">Total Scenarios</span>
            </div>
            <div class="discovery-lab__coverage-stat">
              <span class="discovery-lab__stat-value">{{ coveragePercent }}%</span>
              <span class="discovery-lab__stat-label">Coverage Rate</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Scenario Coverage Table -->
      <section class="discovery-lab__section">
        <div class="discovery-lab__card">
          <h3 class="discovery-lab__card-title">Scenario Coverage Details</h3>
          <div class="discovery-lab__table-wrap">
            <table class="discovery-lab__table">
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>Industry</th>
                  <th>Coverage</th>
                  <th>Confidence</th>
                  <th>Trend</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in sortedScenarios" :key="s.scenarioId">
                  <td class="discovery-lab__td-name">{{ s.scenarioName }}</td>
                  <td>{{ s.industryId }}</td>
                  <td>
                    <div class="discovery-lab__td-bar">
                      <div
                        class="discovery-lab__td-fill"
                        :style="{ width: s.coverageScore + '%', backgroundColor: scoreColor(s.coverageScore) }"
                      />
                    </div>
                    <span class="discovery-lab__td-score">{{ s.coverageScore }}</span>
                  </td>
                  <td>{{ (s.confidence * 100).toFixed(0) }}%</td>
                  <td>
                    <span
                      :class="['discovery-lab__trend', `discovery-lab__trend--${s.trend}`]"
                    >
                      {{ trendIcon(s.trend) }} {{ trendLabel(s.trend) }}
                    </span>
                  </td>
                  <td>
                    <span
                      :class="['discovery-lab__badge', s.entityCoverage ? 'discovery-lab__badge--covered' : 'discovery-lab__badge--gap']"
                    >
                      {{ s.entityCoverage ? '✅ Covered' : '⚠️ Gap' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Opportunities — 升级版展示 -->
      <section v-if="store.report.opportunities.length > 0" class="discovery-lab__section">
        <div class="discovery-lab__card">
          <h3 class="discovery-lab__card-title">
            Optimization Opportunities
            <span class="discovery-lab__card-badge">{{ store.report.opportunities.length }}</span>
          </h3>

          <!-- High Priority -->
          <div v-if="store.highPriorityOpportunities.length > 0" class="discovery-lab__opp-group">
            <h4 class="discovery-lab__opp-group-title">🔴 High Priority</h4>
            <div
              v-for="opp in store.highPriorityOpportunities"
              :key="opp.scenarioId"
              class="discovery-lab__opp-item discovery-lab__opp-item--high"
            >
              <div class="discovery-lab__opp-header">
                <span class="discovery-lab__opp-name">{{ opp.scenarioName }}</span>
                <div class="discovery-lab__opp-badges">
                  <span class="discovery-lab__opp-badge discovery-lab__opp-badge--gain">+{{ opp.expectedAdiGain }} ADI</span>
                  <span class="discovery-lab__opp-badge" :class="effortClass(opp.effort)">{{ effortLabel(opp.effort) }}</span>
                  <span class="discovery-lab__opp-gap">Gap: {{ opp.gap }}/100</span>
                </div>
              </div>
              <p class="discovery-lab__opp-reason">📋 {{ opp.reason }}</p>
              <p class="discovery-lab__opp-suggestion">💡 {{ opp.suggestion }}</p>
              <div v-if="opp.tags && opp.tags.length > 0" class="discovery-lab__opp-tags">
                <span v-for="tag in opp.tags" :key="tag" class="discovery-lab__opp-tag">{{ tag }}</span>
              </div>
            </div>
          </div>

          <!-- Medium Priority -->
          <div v-if="store.mediumPriorityOpportunities.length > 0" class="discovery-lab__opp-group">
            <h4 class="discovery-lab__opp-group-title">🟡 Medium Priority</h4>
            <div
              v-for="opp in store.mediumPriorityOpportunities"
              :key="opp.scenarioId"
              class="discovery-lab__opp-item discovery-lab__opp-item--medium"
            >
              <div class="discovery-lab__opp-header">
                <span class="discovery-lab__opp-name">{{ opp.scenarioName }}</span>
                <div class="discovery-lab__opp-badges">
                  <span class="discovery-lab__opp-badge discovery-lab__opp-badge--gain">+{{ opp.expectedAdiGain }} ADI</span>
                  <span class="discovery-lab__opp-badge" :class="effortClass(opp.effort)">{{ effortLabel(opp.effort) }}</span>
                  <span class="discovery-lab__opp-gap">Gap: {{ opp.gap }}/100</span>
                </div>
              </div>
              <p class="discovery-lab__opp-reason">📋 {{ opp.reason }}</p>
              <p class="discovery-lab__opp-suggestion">💡 {{ opp.suggestion }}</p>
              <div v-if="opp.tags && opp.tags.length > 0" class="discovery-lab__opp-tags">
                <span v-for="tag in opp.tags" :key="tag" class="discovery-lab__opp-tag">{{ tag }}</span>
              </div>
            </div>
          </div>

          <!-- Low Priority -->
          <div v-if="store.lowPriorityOpportunities.length > 0" class="discovery-lab__opp-group">
            <h4 class="discovery-lab__opp-group-title">⚪ Low Priority</h4>
            <div
              v-for="opp in store.lowPriorityOpportunities"
              :key="opp.scenarioId"
              class="discovery-lab__opp-item discovery-lab__opp-item--low"
            >
              <div class="discovery-lab__opp-header">
                <span class="discovery-lab__opp-name">{{ opp.scenarioName }}</span>
                <span class="discovery-lab__opp-gap">Gap: {{ opp.gap }}/100</span>
              </div>
              <p class="discovery-lab__opp-suggestion">💡 {{ opp.suggestion }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Top / Bottom Scenarios -->
      <section class="discovery-lab__section discovery-lab__section--split">
        <div class="discovery-lab__card">
          <h3 class="discovery-lab__card-title">🏆 Top 5 Scenarios</h3>
          <div v-for="s in store.topScenarios" :key="s.scenarioId" class="discovery-lab__rank-item">
            <div class="discovery-lab__rank-name">{{ s.scenarioName }}</div>
            <div class="discovery-lab__rank-bar-wrap">
              <div
                class="discovery-lab__rank-bar"
                :style="{ width: s.coverageScore + '%', backgroundColor: '#22c55e' }"
              />
            </div>
            <span class="discovery-lab__rank-score">{{ s.coverageScore }}</span>
          </div>
        </div>
        <div class="discovery-lab__card">
          <h3 class="discovery-lab__card-title">🔻 Bottom 5 Scenarios</h3>
          <div v-for="s in store.bottomScenarios" :key="s.scenarioId" class="discovery-lab__rank-item">
            <div class="discovery-lab__rank-name">{{ s.scenarioName }}</div>
            <div class="discovery-lab__rank-bar-wrap">
              <div
                class="discovery-lab__rank-bar"
                :style="{ width: s.coverageScore + '%', backgroundColor: '#ef4444' }"
              />
            </div>
            <span class="discovery-lab__rank-score">{{ s.coverageScore }}</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDiscoveryStore } from '../stores/useDiscoveryStore'

const store = useDiscoveryStore()
const entityInput = ref('')

const sortedScenarios = computed(() => {
  if (!store.report) return []
  return [...store.report.scenarios].sort((a, b) => b.coverageScore - a.coverageScore)
})

const scorePercent = computed(() => (store.report?.adi ?? 0) / 100 * 100)

const coveragePercent = computed(() => {
  if (!store.report) return 0
  const total = store.report.scenarios.length
  const covered = store.report.scenarios.filter((s) => s.entityCoverage).length
  return Math.round((covered / total) * 100)
})

const adiColor = computed(() => {
  const score = store.report?.adi ?? 0
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#3b82f6'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
})

const adiLabel = computed(() => {
  const score = store.report?.adi ?? 0
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Moderate'
  return 'Critical'
})

const dimensions = computed(() => {
  if (!store.report) return []
  const d = store.report.dimensions
  return [
    { id: 'coverage', label: 'Discovery Coverage', value: d.coverage, color: '#3b82f6' },
    { id: 'share', label: 'Recommendation Share', value: d.share, color: '#8b5cf6' },
    { id: 'position', label: 'Position Score', value: d.position, color: '#f59e0b' },
  ]
})

function search() {
  store.evaluateEntity(entityInput.value)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#3b82f6'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

function trendIcon(trend: string): string {
  if (trend === 'up') return '📈'
  if (trend === 'down') return '📉'
  return '📊'
}

function trendLabel(trend: string): string {
  if (trend === 'up') return 'Improving'
  if (trend === 'down') return 'Declining'
  return 'Stable'
}

function effortLabel(effort: string): string {
  if (effort === 'easy') return '🟢 Easy'
  if (effort === 'hard') return '🔴 Hard'
  return '🟡 Medium'
}

function effortClass(effort: string): string {
  return `discovery-lab__opp-badge--${effort}`
}
</script>

<style scoped>
.discovery-lab {
  max-width: 1100px;
  margin: 0 auto;
  font-family: Inter, -apple-system, sans-serif;
}

/* ===== Header ===== */
.discovery-lab__header {
  margin-bottom: 32px;
}

.discovery-lab__title {
  font-size: 28px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 4px;
  letter-spacing: -0.03em;
}

.discovery-lab__subtitle {
  font-size: 15px;
  color: #6b7280;
  margin: 0;
}

/* ===== Search ===== */
.discovery-lab__search {
  margin-bottom: 24px;
}

.discovery-lab__search-inner {
  display: flex;
  gap: 12px;
  align-items: center;
}

.discovery-lab__input {
  flex: 1;
  height: 48px;
  padding: 0 16px;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  font-size: 15px;
  color: #111827;
  background: #fff;
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
}

.discovery-lab__input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.discovery-lab__input:disabled {
  background: #f9fafb;
  color: #9ca3af;
}

.discovery-lab__search-btn {
  height: 48px;
  padding: 0 24px;
  border: none;
  border-radius: 10px;
  background: #3b82f6;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}

.discovery-lab__search-btn:hover:not(:disabled) {
  background: #2563eb;
}

.discovery-lab__search-btn:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

.discovery-lab__error {
  margin: 8px 0 0;
  font-size: 14px;
  color: #ef4444;
}

.discovery-lab__spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ===== Loading ===== */
.discovery-lab__loading {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.discovery-lab__loading-card {
  text-align: center;
  padding: 48px;
  background: #f9fafb;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
}

.discovery-lab__spinner-lg {
  font-size: 48px;
  color: #3b82f6;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

.discovery-lab__loading-hint {
  font-size: 13px;
  color: #9ca3af;
  margin: 8px 0 0;
}

/* ===== Empty State ===== */
.discovery-lab__empty {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.discovery-lab__empty-card {
  text-align: center;
  padding: 48px;
  background: #f9fafb;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  max-width: 480px;
}

.discovery-lab__empty-icon {
  font-size: 48px;
  margin: 0 0 12px;
}

.discovery-lab__empty-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px;
}

.discovery-lab__empty-desc {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
  line-height: 1.6;
}

/* ===== Sections ===== */
.discovery-lab__section {
  margin-bottom: 24px;
}

.discovery-lab__section--split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

/* ===== ADI Card ===== */
.discovery-lab__adi-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 32px;
}

.discovery-lab__adi-main {
  display: flex;
  gap: 32px;
  align-items: center;
  margin-bottom: 28px;
}

.discovery-lab__adi-ring {
  position: relative;
  width: 120px;
  height: 120px;
  flex-shrink: 0;
}

.discovery-lab__adi-svg {
  width: 100%;
  height: 100%;
}

.discovery-lab__adi-arc {
  transition: stroke-dasharray 0.6s ease-out;
}

.discovery-lab__adi-value {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.discovery-lab__adi-number {
  font-size: 36px;
  font-weight: 800;
  color: #111827;
  line-height: 1;
}

.discovery-lab__adi-label {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.discovery-lab__adi-info {
  flex: 1;
}

.discovery-lab__adi-entity {
  font-size: 22px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 4px;
}

.discovery-lab__adi-desc {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 12px;
}

.discovery-lab__adi-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #9ca3af;
}

/* ===== Sub-dimensions ===== */
.discovery-lab__dims {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  padding-top: 20px;
  border-top: 1px solid #f3f4f6;
}

.discovery-lab__dim-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.discovery-lab__dim-label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.discovery-lab__dim-score {
  font-size: 14px;
  font-weight: 700;
}

.discovery-lab__dim-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.discovery-lab__dim-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease-out;
}

/* ===== Coverage Grid ===== */
.discovery-lab__coverage-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.discovery-lab__coverage-stat {
  text-align: center;
  padding: 16px;
  background: #f9fafb;
  border-radius: 10px;
}

.discovery-lab__stat-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #111827;
}

.discovery-lab__stat-label {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

/* ===== Cards ===== */
.discovery-lab__card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
}

.discovery-lab__card-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.discovery-lab__card-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: #3b82f6;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
}

/* ===== Table ===== */
.discovery-lab__table-wrap {
  overflow-x: auto;
}

.discovery-lab__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.discovery-lab__table th {
  text-align: left;
  padding: 10px 12px;
  font-weight: 600;
  color: #6b7280;
  border-bottom: 2px solid #e5e7eb;
  white-space: nowrap;
}

.discovery-lab__table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f3f4f6;
  color: #374151;
  vertical-align: middle;
}

.discovery-lab__table tbody tr:hover {
  background: #f9fafb;
}

.discovery-lab__td-name {
  font-weight: 500;
  white-space: nowrap;
}

.discovery-lab__td-bar {
  display: inline-block;
  width: 60px;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  vertical-align: middle;
  margin-right: 8px;
}

.discovery-lab__td-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}

.discovery-lab__td-score {
  font-size: 12px;
  font-weight: 600;
  vertical-align: middle;
}

/* ===== Trend ===== */
.discovery-lab__trend {
  font-size: 12px;
  font-weight: 500;
}

.discovery-lab__trend--up { color: #22c55e; }
.discovery-lab__trend--stable { color: #6b7280; }
.discovery-lab__trend--down { color: #ef4444; }

/* ===== Badge ===== */
.discovery-lab__badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.discovery-lab__badge--covered {
  background: #dcfce7;
  color: #166534;
}

.discovery-lab__badge--gap {
  background: #fef3c7;
  color: #92400e;
}

/* ===== Opportunities — 升级版 ===== */
.discovery-lab__opp-group {
  margin-bottom: 20px;
}

.discovery-lab__opp-group:last-child {
  margin-bottom: 0;
}

.discovery-lab__opp-group-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px;
  color: #374151;
}

.discovery-lab__opp-item {
  padding: 14px 16px;
  border-radius: 10px;
  margin-bottom: 10px;
}

.discovery-lab__opp-item--high {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.discovery-lab__opp-item--medium {
  background: #fffbeb;
  border: 1px solid #fde68a;
}

.discovery-lab__opp-item--low {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
}

.discovery-lab__opp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.discovery-lab__opp-name {
  font-weight: 600;
  font-size: 14px;
  color: #111827;
}

.discovery-lab__opp-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.discovery-lab__opp-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.discovery-lab__opp-badge--gain {
  background: #dcfce7;
  color: #166534;
}

.discovery-lab__opp-badge--easy {
  background: #dcfce7;
  color: #166534;
}

.discovery-lab__opp-badge--medium {
  background: #fef3c7;
  color: #92400e;
}

.discovery-lab__opp-badge--hard {
  background: #fef2f2;
  color: #991b1b;
}

.discovery-lab__opp-gap {
  font-size: 12px;
  font-weight: 700;
  color: #dc2626;
}

.discovery-lab__opp-reason {
  font-size: 13px;
  color: #374151;
  margin: 0 0 6px;
  line-height: 1.5;
}

.discovery-lab__opp-suggestion {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
  line-height: 1.5;
}

.discovery-lab__opp-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.discovery-lab__opp-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 11px;
  font-weight: 500;
}

/* ===== Rank Items ===== */
.discovery-lab__rank-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
}

.discovery-lab__rank-item:last-child {
  border-bottom: none;
}

.discovery-lab__rank-name {
  width: 140px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.discovery-lab__rank-bar-wrap {
  flex: 1;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.discovery-lab__rank-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}

.discovery-lab__rank-score {
  width: 32px;
  text-align: right;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .discovery-lab__section--split {
    grid-template-columns: 1fr;
  }

  .discovery-lab__adi-main {
    flex-direction: column;
    text-align: center;
  }

  .discovery-lab__dims {
    grid-template-columns: 1fr;
  }

  .discovery-lab__coverage-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .discovery-lab__search-inner {
    flex-direction: column;
  }

  .discovery-lab__input {
    width: 100%;
  }

  .discovery-lab__search-btn {
    width: 100%;
  }
}
</style>
