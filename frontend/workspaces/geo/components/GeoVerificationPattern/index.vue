<template>
  <div class="geo-verification-pattern">
    <!-- ===== STATE: Loading ===== -->
    <div v-if="loading" class="geo-verification-pattern__loading">
      <div class="geo-verification-pattern__loading-spinner" />
      <span>正在执行验证...</span>
    </div>

    <!-- ===== STATE: Error ===== -->
    <div v-else-if="error" class="geo-verification-pattern__error">
      <StatusBanner
        variant="error"
        :title="'验证执行失败'"
        :message="error"
      />
    </div>

    <!-- ===== STATE: Empty (no report) ===== -->
    <div
      v-else-if="!report"
      class="geo-verification-pattern__empty"
    >
      <slot name="empty">
        <div class="geo-verification-pattern__empty-icon">🔬</div>
        <h2 class="geo-verification-pattern__empty-title">输入实体名称开始验证</h2>
        <p class="geo-verification-pattern__empty-desc">
          系统将获取该实体的 Discovery Baseline，结合 Action Plan 完成情况，
          计算 Before/After ADI 对比，并生成详细的改进分析报告。
        </p>
      </slot>
    </div>

    <!-- ===== STATE: Data ===== -->
    <template v-else>
      <!-- 1. Score Comparison -->
      <section class="geo-verification-pattern__section">
        <div class="geo-verification-pattern__section-title-row">
          <h2 class="geo-verification-pattern__section-title">验证结果</h2>
          <slot name="explain-trigger" />
        </div>
        <VerificationSummary
          :entity-name="report.meta.entityName"
          :before-adi="report.payload.beforeAdi"
          :after-adi="report.payload.afterAdi"
          :delta-adi="report.payload.deltaAdi"
          :improvement-rate="report.payload.improvementRate"
        />
      </section>

      <!-- 2. Dimension Changes -->
      <section v-if="hasDimensionChanges" class="geo-verification-pattern__section">
        <h2 class="geo-verification-pattern__section-title">子维度变化</h2>
        <DimensionChanges
          :coverage="report.payload.dimensionChanges.coverage"
          :share="report.payload.dimensionChanges.share"
          :position="report.payload.dimensionChanges.position"
        />
      </section>

      <!-- 3. Action Completion -->
      <section class="geo-verification-pattern__section">
        <h2 class="geo-verification-pattern__section-title">Action 完成情况</h2>
        <ActionCompletion
          :completion-rate="report.payload.completionRate"
          :total-actions="report.payload.totalActions"
          :completed-actions="report.payload.completedActions"
          :pending-actions="report.payload.pendingActions"
          :skipped-actions="report.payload.skippedActions"
        />
      </section>

      <!-- 4. Breakdown Block -->
      <section v-if="report.payload.breakdowns.length > 0" class="geo-verification-pattern__section">
        <h2 class="geo-verification-pattern__section-title">改进瀑布图</h2>
        <BreakdownBlock
          :breakdowns="report.payload.breakdowns"
          :baseline="report.payload.beforeAdi"
        />
      </section>

      <!-- 5. Verified Items -->
      <section v-if="report.payload.verifiedItems.length > 0" class="geo-verification-pattern__section">
        <h2 class="geo-verification-pattern__section-title">
          已验证条目
          <span class="geo-verification-pattern__section-badge">{{ report.payload.verifiedItems.length }}</span>
        </h2>
        <VerifiedItemsTable :items="report.payload.verifiedItems" />
      </section>

      <!-- 6. Remaining Issues -->
      <section class="geo-verification-pattern__section">
        <h2 class="geo-verification-pattern__section-title">剩余问题</h2>
        <RemainingIssuesList :items="report.payload.remainingIssues" />
      </section>

      <!-- 7. Confidence -->
      <section class="geo-verification-pattern__section">
        <h2 class="geo-verification-pattern__section-title">置信度</h2>
        <ConfidenceIndicator :confidence="report.payload.confidence" />
      </section>

      <!-- 8. Next Actions -->
      <section class="geo-verification-pattern__section">
        <NextActionsBlock
          :entity-name="report.meta.entityName"
          @generate-report="emit('generate-report')"
        />
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { VerificationReport } from './types'
import StatusBanner from './StatusBanner.vue'
import VerificationSummary from './VerificationSummary.vue'
import DimensionChanges from './DimensionChanges.vue'
import ActionCompletion from './ActionCompletion.vue'
import BreakdownBlock from './BreakdownBlock.vue'
import VerifiedItemsTable from './VerifiedItemsTable.vue'
import RemainingIssuesList from './RemainingIssuesList.vue'
import ConfidenceIndicator from './ConfidenceIndicator.vue'
import NextActionsBlock from './NextActionsBlock.vue'

const props = defineProps<{
  report?: VerificationReport | null
  loading: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  'generate-report': []
}>()

const hasDimensionChanges = computed(() => {
  if (!props.report) return false
  const dc = props.report.payload.dimensionChanges
  return dc?.coverage != null && dc?.share != null && dc?.position != null
})
</script>

<style scoped>
.geo-verification-pattern {
  max-width: 900px;
  margin: 0 auto;
}

.geo-verification-pattern__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px;
  color: #6b7280;
}

.geo-verification-pattern__loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.geo-verification-pattern__empty {
  text-align: center;
  padding: 64px 24px;
}

.geo-verification-pattern__empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.geo-verification-pattern__empty-title {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px;
}

.geo-verification-pattern__empty-desc {
  font-size: 14px;
  color: #6b7280;
  max-width: 480px;
  margin: 0 auto;
  line-height: 1.6;
}

.geo-verification-pattern__error {
  padding: 16px 0;
}

.geo-verification-pattern__section {
  margin-bottom: 32px;
}

.geo-verification-pattern__section-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.geo-verification-pattern__section-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.geo-verification-pattern__section-title-row .geo-verification-pattern__section-title {
  margin-bottom: 0;
}

.geo-verification-pattern__section-badge {
  font-size: 12px;
  font-weight: 500;
  background-color: #f3f4f6;
  color: #6b7280;
  padding: 2px 8px;
  border-radius: 999px;
}
</style>
