<template>
  <div v-if="report" class="customer-success-card">
    <!-- 🎉 Congratulations Header -->
    <div class="customer-success-card__header">
      <span class="customer-success-card__emoji">🎉</span>
      <h2 class="customer-success-card__title">{{ report.congratulations || '恭喜！你的优化已完成！' }}</h2>
    </div>

    <!-- ===== STATE: Loading ===== -->
    <div v-if="loading" class="customer-success-card__loading">
      <div class="customer-success-card__spinner" />
      <span>正在生成客户成功报告...</span>
    </div>

    <!-- ===== STATE: Error ===== -->
    <div v-else-if="error" class="customer-success-card__error">
      <p class="customer-success-card__error-text">{{ error }}</p>
      <button class="customer-success-card__retry-btn" @click="$emit('retry')">重试</button>
    </div>

    <!-- ===== STATE: Data ===== -->
    <template v-else-if="report">
      <!-- Projected Impact -->
      <div class="customer-success-card__impact">
        <h3 class="customer-success-card__section-title">
          预计{{ report.projectedImpact.timeFrame || '未来30天' }}
        </h3>
        <div class="customer-success-card__metrics">
          <!-- AI Exposure -->
          <div class="customer-success-card__metric">
            <div class="customer-success-card__metric-icon">📈</div>
            <div class="customer-success-card__metric-content">
              <span class="customer-success-card__metric-value customer-success-card__metric-value--positive">
                +{{ report.projectedImpact.aiExposureIncrease }}%
              </span>
              <span class="customer-success-card__metric-label">AI 曝光提升</span>
            </div>
          </div>

          <!-- Citation Growth -->
          <div class="customer-success-card__metric">
            <div class="customer-success-card__metric-icon">📄</div>
            <div class="customer-success-card__metric-content">
              <span class="customer-success-card__metric-value customer-success-card__metric-value--positive">
                +{{ report.projectedImpact.aiCitationIncrease }}%
              </span>
              <span class="customer-success-card__metric-label">引用增长</span>
            </div>
          </div>

          <!-- New Inquiries -->
          <div class="customer-success-card__metric">
            <div class="customer-success-card__metric-icon">💬</div>
            <div class="customer-success-card__metric-content">
              <span class="customer-success-card__metric-value customer-success-card__metric-value--positive">
                +{{ report.projectedImpact.newInquiries }}
              </span>
              <span class="customer-success-card__metric-label">新增咨询</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Next Actions -->
      <div v-if="report.nextActions && report.nextActions.length > 0" class="customer-success-card__actions">
        <h3 class="customer-success-card__section-title">建议下一步</h3>
        <div class="customer-success-card__action-list">
          <div
            v-for="(action, idx) in report.nextActions"
            :key="idx"
            class="customer-success-card__action-item"
          >
            <div class="customer-success-card__action-icon">
              <template v-if="action.suggestedDate === '现在'">👉</template>
              <template v-else-if="action.suggestedDate === '7天后'">📅</template>
              <template v-else>⏰</template>
            </div>
            <div class="customer-success-card__action-body">
              <span class="customer-success-card__action-text">{{ action.action }}</span>
              <span class="customer-success-card__action-impact">{{ action.estimatedImpact }}</span>
            </div>
            <span class="customer-success-card__action-date">{{ action.suggestedDate }}</span>
          </div>
        </div>
      </div>

      <!-- Summary -->
      <div class="customer-success-card__summary">
        <p class="customer-success-card__summary-text">{{ report.summary }}</p>
      </div>

      <!-- CTA -->
      <div class="customer-success-card__cta">
        <button
          class="customer-success-card__report-btn"
          @click="$emit('view-report')"
        >
          📄 查看完整报告
        </button>
        <span class="customer-success-card__cta-hint">建议 7 天后再次验证，跟踪优化趋势</span>
      </div>
    </template>

    <!-- ===== STATE: Empty / No report ===== -->
    <div v-else class="customer-success-card__empty">
      <div class="customer-success-card__empty-icon">✨</div>
      <p class="customer-success-card__empty-text">完成优化后将自动生成长远收益预览</p>
    </div>
  </div>
</template>

<script setup lang="ts">
// Local type definition for CustomerSuccessReport
export interface CustomerSuccessReport {
  congratulations: string
  projectedImpact: {
    aiExposureIncrease: number
    aiCitationIncrease: number
    newInquiries: number
    timeFrame: string
  }
  nextActions: Array<{
    action: string
    estimatedImpact: string
    timeToComplete: string
    suggestedDate: string
  }>
  summary: string
}

interface Props {
  report?: CustomerSuccessReport | null
  loading?: boolean
  error?: string | null
}

defineProps<Props>()

defineEmits<{
  (e: 'retry'): void
  (e: 'view-report'): void
}>()
</script>

<style scoped>
.customer-success-card {
  background: linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%);
  border: 1px solid #bbf7d0;
  border-radius: 16px;
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 640px;
  margin: 0 auto;
}

/* ── Header ── */
.customer-success-card__header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.customer-success-card__emoji {
  font-size: 32px;
  line-height: 1;
}

.customer-success-card__title {
  font-family: Inter, -apple-system, sans-serif;
  font-size: 20px;
  font-weight: 700;
  color: #166534;
  margin: 0;
}

/* ── Section Title ── */
.customer-success-card__section-title {
  font-family: Inter, -apple-system, sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 12px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* ── Loading ── */
.customer-success-card__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  color: #6b7280;
  font-size: 14px;
}

.customer-success-card__spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Error ── */
.customer-success-card__error {
  text-align: center;
  padding: 16px;
}

.customer-success-card__error-text {
  color: #dc2626;
  font-size: 14px;
  margin: 0 0 12px;
}

.customer-success-card__retry-btn {
  padding: 8px 20px;
  background: #ef4444;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

/* ── Metrics ── */
.customer-success-card__impact {
  background: rgba(255, 255, 255, 0.7);
  border-radius: 12px;
  padding: 16px;
}

.customer-success-card__metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.customer-success-card__metric {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.customer-success-card__metric-icon {
  font-size: 24px;
  line-height: 1;
}

.customer-success-card__metric-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.customer-success-card__metric-value {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
}

.customer-success-card__metric-value--positive {
  color: #16a34a;
}

.customer-success-card__metric-label {
  font-size: 11px;
  color: #6b7280;
  white-space: nowrap;
}

/* ── Next Actions ── */
.customer-success-card__actions {
  background: rgba(255, 255, 255, 0.7);
  border-radius: 12px;
  padding: 16px;
}

.customer-success-card__action-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.customer-success-card__action-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.15s;
}

.customer-success-card__action-item:hover {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.customer-success-card__action-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.customer-success-card__action-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.customer-success-card__action-text {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
}

.customer-success-card__action-impact {
  font-size: 11px;
  color: #6b7280;
}

.customer-success-card__action-date {
  font-size: 11px;
  font-weight: 600;
  color: #3b82f6;
  background: #eff6ff;
  padding: 3px 8px;
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;
}

/* ── Summary ── */
.customer-success-card__summary {
  background: rgba(255, 255, 255, 0.5);
  border-radius: 8px;
  padding: 12px 16px;
}

.customer-success-card__summary-text {
  font-size: 13px;
  line-height: 1.6;
  color: #4b5563;
  margin: 0;
}

/* ── CTA ── */
.customer-success-card__cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.customer-success-card__report-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 32px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  font-family: inherit;
}

.customer-success-card__report-btn:hover {
  background: #2563eb;
}

.customer-success-card__cta-hint {
  font-size: 12px;
  color: #9ca3af;
}

/* ── Empty ── */
.customer-success-card__empty {
  text-align: center;
  padding: 24px;
}

.customer-success-card__empty-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.customer-success-card__empty-text {
  font-size: 14px;
  color: #9ca3af;
  margin: 0;
}

/* ── Responsive ── */
@media (max-width: 600px) {
  .customer-success-card__metrics {
    grid-template-columns: 1fr;
  }

  .customer-success-card {
    padding: 20px 16px;
  }
}
</style>
