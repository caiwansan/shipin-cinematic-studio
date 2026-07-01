<template>
  <div class="verification-page">
    <!-- ===== Header: Entity Input ===== -->
    <div class="verification-page__header">
      <h1 class="verification-page__title">验证引擎</h1>
      <p class="verification-page__subtitle">
        对比 Before/After ADI 分数，验证优化措施的实际效果
      </p>
    </div>

    <div class="verification-page__input-bar">
      <div class="verification-page__input-group">
        <input
          v-model="entityName"
          type="text"
          placeholder="输入实体名称，如「昆仑镜AI」"
          class="verification-page__input"
          @keyup.enter="runVerification"
        />
        <button
          class="verification-page__verify-btn"
          :disabled="isLoading || !entityName.trim()"
          @click="runVerification"
        >
          <span v-if="isLoading" class="verification-page__spinner" />
          {{ isLoading ? '验证中...' : 'Verify Now' }}
        </button>
      </div>
      <div v-if="error" class="verification-page__error">{{ error }}</div>
    </div>

    <!-- ===== Loading State ===== -->
    <div v-if="isLoading" class="verification-page__loading">
      <div class="verification-page__loading-spinner" />
      <span>正在执行验证...</span>
    </div>

    <!-- ===== Results ===== -->
    <template v-if="report && !isLoading">
      <!-- 1. 主数据卡片：Score Comparison -->
      <section class="verification-page__section">
        <VerificationCard
          :title="`${report.entityName} — ADI 对比`"
          :before-adi="report.beforeAdi"
          :after-adi="report.afterAdi"
          :delta-adi="report.deltaAdi"
          :improvement-rate="report.improvementRate"
        />
      </section>

      <!-- 2. 子维度变化 -->
      <section class="verification-page__section">
        <h2 class="verification-page__section-title">子维度变化</h2>
        <div class="verification-page__dimensions">
          <div
            v-for="dim in dimensionsList"
            :key="dim.key"
            class="dimension-card"
          >
            <div class="dimension-card__header">
              <span class="dimension-card__name">{{ dim.label }}</span>
            </div>
            <div class="dimension-card__bars">
              <div class="dimension-card__bar-row">
                <span class="dimension-card__bar-label">Before</span>
                <div class="dimension-card__bar-track">
                  <div
                    class="dimension-card__bar-fill dimension-card__bar-fill--before"
                    :style="{ width: dim.before + '%' }"
                  />
                </div>
                <span class="dimension-card__bar-value">{{ dim.before }}</span>
              </div>
              <div class="dimension-card__bar-row">
                <span class="dimension-card__bar-label">After</span>
                <div class="dimension-card__bar-track">
                  <div
                    class="dimension-card__bar-fill dimension-card__bar-fill--after"
                    :style="{ width: dim.after + '%' }"
                  />
                </div>
                <span class="dimension-card__bar-value">{{ dim.after }}</span>
              </div>
            </div>
            <div class="dimension-card__delta">
              <span
                :class="dim.delta > 0 ? 'dimension-card__delta--pos' : 'dimension-card__delta--neg'"
              >
                {{ dim.delta > 0 ? '+' : '' }}{{ dim.delta }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- 3. Action Completion -->
      <section class="verification-page__section">
        <h2 class="verification-page__section-title">Action 完成情况</h2>
        <div class="action-completion">
          <div class="action-completion__progress">
            <div class="action-completion__progress-bar">
              <div
                class="action-completion__progress-fill"
                :style="{ width: report.completionRate + '%' }"
                :class="completionColorClass"
              />
            </div>
            <span class="action-completion__rate">{{ report.completionRate.toFixed(1) }}%</span>
          </div>
          <div class="action-completion__stats">
            <div class="action-completion__stat">
              <span class="action-completion__stat-value action-completion__stat-value--completed">{{ report.completedActions }}</span>
              <span class="action-completion__stat-label">已完成</span>
            </div>
            <div class="action-completion__stat">
              <span class="action-completion__stat-value">{{ report.pendingActions }}</span>
              <span class="action-completion__stat-label">待完成</span>
            </div>
            <div class="action-completion__stat">
              <span class="action-completion__stat-value action-completion__stat-value--skipped">{{ report.skippedActions }}</span>
              <span class="action-completion__stat-label">已忽略</span>
            </div>
            <div class="action-completion__stat">
              <span class="action-completion__stat-value">{{ report.totalActions }}</span>
              <span class="action-completion__stat-label">总计</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. Improvement Breakdown 瀑布图 -->
      <section class="verification-page__section">
        <h2 class="verification-page__section-title">改进瀑布图</h2>
        <div class="breakdown-waterfall">
          <div class="breakdown-waterfall__row breakdown-waterfall__row--baseline">
            <span class="breakdown-waterfall__label">Baseline</span>
            <span class="breakdown-waterfall__value">{{ report.beforeAdi }}</span>
          </div>
          <div
            v-for="(item, idx) in report.improvementBreakdown"
            :key="idx"
            class="breakdown-waterfall__row"
          >
            <span class="breakdown-waterfall__label">{{ item.label }}</span>
            <div class="breakdown-waterfall__arrow">
              <ImprovementBadge :contribution="item.contribution" />
            </div>
            <span class="breakdown-waterfall__value">{{ waterfallCumulative(idx) }}</span>
          </div>
        </div>
      </section>

      <!-- 5. Verified Items 列表 -->
      <section class="verification-page__section">
        <h2 class="verification-page__section-title">
          已验证条目
          <span class="verification-page__section-badge">{{ report.verifiedItems.length }}</span>
        </h2>
        <div class="verified-items-table">
          <div class="verified-items-table__header">
            <span class="verified-items-table__col verified-items-table__col--status">状态</span>
            <span class="verified-items-table__col verified-items-table__col--title">任务</span>
            <span class="verified-items-table__col verified-items-table__col--adi">ADI 贡献</span>
            <span class="verified-items-table__col verified-items-table__col--detail">详情</span>
          </div>
          <div
            v-for="item in report.verifiedItems"
            :key="item.id"
            class="verified-items-table__row"
          >
            <span class="verified-items-table__col verified-items-table__col--status">
              <span
                :class="[
                  'status-chip',
                  item.status === 'completed' ? 'status-chip--completed' : '',
                  item.status === 'pending' ? 'status-chip--pending' : '',
                  item.status === 'skipped' ? 'status-chip--skipped' : '',
                ]"
              >
                {{ statusLabel(item.status) }}
              </span>
            </span>
            <span class="verified-items-table__col verified-items-table__col--title">{{ item.title }}</span>
            <span class="verified-items-table__col verified-items-table__col--adi">
              <template v-if="item.adiContribution > 0">
                +{{ item.adiContribution }}
              </template>
              <template v-else>—</template>
            </span>
            <span class="verified-items-table__col verified-items-table__col--detail">{{ item.details }}</span>
          </div>
        </div>
      </section>

      <!-- 6. Remaining Issues -->
      <section class="verification-page__section">
        <h2 class="verification-page__section-title">剩余问题</h2>
        <div v-if="report.remainingIssues.length === 0" class="verification-page__empty">
          暂无剩余问题
        </div>
        <div v-else class="remaining-issues">
          <div
            v-for="issue in report.remainingIssues"
            :key="issue.scenarioId"
            class="remaining-issues__item"
          >
            <div class="remaining-issues__info">
              <span class="remaining-issues__name">{{ issue.scenarioName }}</span>
              <span class="remaining-issues__gap">差距: {{ issue.gap }}</span>
            </div>
            <span
              :class="[
                'priority-badge',
                issue.priority === 'high' ? 'priority-badge--high' : '',
                issue.priority === 'medium' ? 'priority-badge--medium' : '',
                issue.priority === 'low' ? 'priority-badge--low' : '',
              ]"
            >
              {{ priorityLabel(issue.priority) }}
            </span>
          </div>
        </div>
      </section>

      <!-- 7. Confidence -->
      <section class="verification-page__section">
        <h2 class="verification-page__section-title">置信度</h2>
        <ConfidenceMeter :confidence="report.confidence" />
      </section>
    </template>

    <!-- ===== Empty State ===== -->
    <div
      v-if="!report && !isLoading"
      class="verification-page__empty-state"
    >
      <div class="verification-page__empty-icon">🔬</div>
      <h2 class="verification-page__empty-title">输入实体名称开始验证</h2>
      <p class="verification-page__empty-desc">
        系统将获取该实体的 Discovery Baseline，结合 Action Plan 完成情况，
        计算 Before/After ADI 对比，并生成详细的改进分析报告。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { fetchEntityVerification } from '../services/verificationService'
import type { VerificationReport } from '../services/verificationService'
import VerificationCard from '../../../components/kmki-ui/VerificationCard/index.vue'
import ImprovementBadge from '../../../components/kmki-ui/ImprovementBadge/index.vue'
import ConfidenceMeter from '../../../components/kmki-ui/ConfidenceMeter/index.vue'

definePageMeta({
  title: '验证引擎 — GEO Workspace',
})

const entityName = ref('')
const report = ref<VerificationReport | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)

const dimensionsList = computed(() => {
  if (!report.value) return []
  const dc = report.value.dimensionChanges
  return [
    { key: 'coverage', label: 'Coverage', ...dc.coverage },
    { key: 'share', label: 'Share', ...dc.share },
    { key: 'position', label: 'Position', ...dc.position },
  ]
})

const completionColorClass = computed(() => {
  if (!report.value) return ''
  const rate = report.value.completionRate
  if (rate > 80) return 'action-completion__progress-fill--high'
  if (rate > 60) return 'action-completion__progress-fill--medium'
  if (rate > 40) return 'action-completion__progress-fill--fair'
  return 'action-completion__progress-fill--low'
})

async function runVerification() {
  if (!entityName.value.trim() || isLoading.value) return

  isLoading.value = true
  error.value = null
  report.value = null

  try {
    const result = await fetchEntityVerification(entityName.value.trim())
    report.value = result
  } catch (err: any) {
    error.value = err instanceof Error ? err.message : '验证执行失败'
  } finally {
    isLoading.value = false
  }
}

function waterfallCumulative(idx: number): number {
  if (!report.value) return 0
  let score = report.value.beforeAdi
  for (let i = 0; i <= idx; i++) {
    if (report.value.improvementBreakdown[i]) {
      score += report.value.improvementBreakdown[i].contribution
    }
  }
  return score
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    completed: '✅ 已完成',
    pending: '⏳ 待完成',
    skipped: '⏭ 已忽略',
  }
  return map[status] || status
}

function priorityLabel(priority: string): string {
  const map: Record<string, string> = {
    high: '高优先级',
    medium: '中优先级',
    low: '低优先级',
  }
  return map[priority] || priority
}
</script>

<style scoped>
.verification-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 0 0 48px;
}

.verification-page__header {
  margin-bottom: 24px;
}

.verification-page__title {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 8px;
}

.verification-page__subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.verification-page__input-bar {
  margin-bottom: 32px;
}

.verification-page__input-group {
  display: flex;
  gap: 12px;
}

.verification-page__input {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 15px;
  outline: none;
  transition: border-color 0.15s;
}

.verification-page__input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.verification-page__verify-btn {
  padding: 10px 24px;
  background-color: #059669;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.verification-page__verify-btn:hover:not(:disabled) {
  background-color: #047857;
}

.verification-page__verify-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.verification-page__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.verification-page__error {
  margin-top: 8px;
  font-size: 14px;
  color: #dc2626;
}

.verification-page__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px;
  color: #6b7280;
}

.verification-page__loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.verification-page__section {
  margin-bottom: 32px;
}

.verification-page__section-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.verification-page__section-badge {
  font-size: 12px;
  font-weight: 500;
  background-color: #f3f4f6;
  color: #6b7280;
  padding: 2px 8px;
  border-radius: 999px;
}

.verification-page__empty {
  color: #9ca3af;
  font-size: 14px;
  padding: 16px;
  text-align: center;
}

.verification-page__empty-state {
  text-align: center;
  padding: 64px 24px;
}

.verification-page__empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.verification-page__empty-title {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px;
}

.verification-page__empty-desc {
  font-size: 14px;
  color: #6b7280;
  max-width: 480px;
  margin: 0 auto;
  line-height: 1.6;
}

/* ===== Dimension Cards ===== */
.verification-page__dimensions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

@media (max-width: 768px) {
  .verification-page__dimensions {
    grid-template-columns: 1fr;
  }
}

.dimension-card {
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
}

.dimension-card__header {
  margin-bottom: 12px;
}

.dimension-card__name {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.dimension-card__bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dimension-card__bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dimension-card__bar-label {
  font-size: 12px;
  color: #6b7280;
  width: 44px;
  flex-shrink: 0;
}

.dimension-card__bar-track {
  flex: 1;
  height: 8px;
  background-color: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.dimension-card__bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s ease-out;
}

.dimension-card__bar-fill--before {
  background-color: #9ca3af;
}

.dimension-card__bar-fill--after {
  background-color: #059669;
}

.dimension-card__bar-value {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  width: 28px;
  text-align: right;
}

.dimension-card__delta {
  margin-top: 8px;
  text-align: right;
  font-size: 14px;
  font-weight: 600;
}

.dimension-card__delta--pos {
  color: #059669;
}

.dimension-card__delta--neg {
  color: #dc2626;
}

/* ===== Action Completion ===== */
.action-completion {
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 20px;
}

.action-completion__progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.action-completion__progress-bar {
  flex: 1;
  height: 12px;
  background-color: #e5e7eb;
  border-radius: 999px;
  overflow: hidden;
}

.action-completion__progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.6s ease-out;
}

.action-completion__progress-fill--high {
  background-color: #059669;
}

.action-completion__progress-fill--medium {
  background-color: #d97706;
}

.action-completion__progress-fill--fair {
  background-color: #f59e0b;
}

.action-completion__progress-fill--low {
  background-color: #ef4444;
}

.action-completion__rate {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  white-space: nowrap;
}

.action-completion__stats {
  display: flex;
  gap: 24px;
  justify-content: center;
}

.action-completion__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.action-completion__stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
}

.action-completion__stat-value--completed {
  color: #059669;
}

.action-completion__stat-value--skipped {
  color: #9ca3af;
}

.action-completion__stat-label {
  font-size: 12px;
  color: #6b7280;
}

/* ===== Breakdown Waterfall ===== */
.breakdown-waterfall {
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px 20px;
}

.breakdown-waterfall__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
}

.breakdown-waterfall__row:last-child {
  border-bottom: none;
}

.breakdown-waterfall__row--baseline {
  border-bottom: 2px solid #d1d5db;
  padding-bottom: 12px;
  margin-bottom: 4px;
}

.breakdown-waterfall__label {
  flex: 1;
  font-size: 14px;
  color: #374151;
  font-weight: 500;
}

.breakdown-waterfall__arrow {
  display: flex;
  align-items: center;
}

.breakdown-waterfall__value {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  min-width: 48px;
  text-align: right;
}

/* ===== Verified Items Table ===== */
.verified-items-table {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
}

.verified-items-table__header {
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  background-color: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
}

.verified-items-table__row {
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid #f3f4f6;
  font-size: 13px;
  align-items: center;
}

.verified-items-table__row:last-child {
  border-bottom: none;
}

.verified-items-table__col--status {
  width: 80px;
  flex-shrink: 0;
}

.verified-items-table__col--title {
  flex: 1;
  color: #111827;
  font-weight: 500;
}

.verified-items-table__col--adi {
  width: 80px;
  text-align: center;
  color: #059669;
  font-weight: 600;
  flex-shrink: 0;
}

.verified-items-table__col--detail {
  width: 200px;
  color: #6b7280;
  font-size: 12px;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .verified-items-table__col--detail {
    display: none;
  }
}

.status-chip {
  font-size: 12px;
  white-space: nowrap;
}

/* ===== Remaining Issues ===== */
.remaining-issues {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.remaining-issues__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.remaining-issues__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.remaining-issues__name {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}

.remaining-issues__gap {
  font-size: 12px;
  color: #6b7280;
}

.priority-badge {
  font-size: 12px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 999px;
}

.priority-badge--high {
  background-color: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.priority-badge--medium {
  background-color: #fffbeb;
  color: #d97706;
  border: 1px solid #fde68a;
}

.priority-badge--low {
  background-color: #f0fdf4;
  color: #16a34a;
  border: 1px solid #bbf7d0;
}
</style>
