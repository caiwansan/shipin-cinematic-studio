<template>
      <section class="brand-overview__section">
        <h2 class="brand-overview__section-title">
          Optimization Center
          <GeoExplainButton @click="onOpenExplain('recommendation')" />
          <button
            v-if="hasAnalysis && !optimizationLoading && !optimizationData"
            class="brand-overview__optimization-trigger"
            @click="onLoadOptimizations"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            查看优化建议
          </button>
          <button
            v-if="optimizationData"
            class="brand-overview__optimization-trigger"
            @click="onClear"
          >
            收起
          </button>
        </h2>

        <!-- Optimization Loading State (三步骤) -->
        <GeoLoading
          v-if="optimizationLoading"
          :steps="optSteps"
          :current-step="optStepIndex"
        />

        <!-- Optimization Error -->
        <GeoErrorState v-else-if="optimizationError" :message="optimizationError" :on-retry="onLoadOptimizations" />

        <!-- Optimization Empty State -->
        <GeoEmptyState
          v-else-if="!hasAnalysis && !optimizationData"
          icon="💡"
          title="优化建议"
          description="Run Quick Discovery to generate optimization suggestions."
        >
          <template #actions>
            <button
              class="geo-btn geo-btn--primary"
              @click="onQuickDiscovery"
              :disabled="isQdRunning"
            >
              {{ isQdRunning ? '分析中...' : '运行 Quick Discovery' }}
            </button>
          </template>
        </GeoEmptyState>

        <!-- Optimization Data -->
        <div v-else-if="optimizationData" class="brand-overview__optimization-card">
          <!-- Optimization Summary (三列布局) -->
          <div class="brand-overview__opt-summary">
            <div class="brand-overview__opt-summary-item">
              <span class="brand-overview__opt-summary-label">当前 ADI</span>
              <span class="brand-overview__opt-summary-value">{{ optimizationData.currentADI }}</span>
            </div>
            <div class="brand-overview__opt-summary-item">
              <span class="brand-overview__opt-summary-label">预估 ADI</span>
              <span class="brand-overview__opt-summary-value brand-overview__opt-summary-value--estimated">
                {{ optimizationData.estimatedADI }}
              </span>
            </div>
            <div class="brand-overview__opt-summary-item">
              <span class="brand-overview__opt-summary-label">提升空间</span>
              <span
                v-if="optimizationData.potentialGainKnown"
                class="brand-overview__opt-summary-value brand-overview__opt-summary-value--gain"
              >
                +{{ optimizationData.potentialGain }}
              </span>
              <span v-else class="brand-overview__opt-summary-value brand-overview__opt-summary-value--unknown">
                未知
              </span>
            </div>
          </div>

          <!-- Recommendations -->
          <div class="brand-overview__opt-recommendations">
            <h4 class="brand-overview__opt-recommendations-title">
              优化建议 ({{ optimizationData.recommendations.length }})
            </h4>
            <div
              v-for="(rec, idx) in optimizationData.recommendations"
              :key="idx"
              class="brand-overview__opt-rec-card"
              :class="`brand-overview__opt-rec-card--${rec.priority}`"
            >
              <div class="brand-overview__opt-rec-left-bar" :class="`brand-overview__opt-rec-left-bar--${rec.priority}`" />
              <div class="brand-overview__opt-rec-content">
                <div class="brand-overview__opt-rec-header">
                  <span class="brand-overview__opt-rec-priority" :class="`brand-overview__opt-rec-priority--${rec.priority}`">
                    {{ priorityLabel(rec.priority) }}
                  </span>
                  <span class="brand-overview__opt-rec-difficulty" :class="`brand-overview__opt-rec-difficulty--${rec.difficulty}`">
                    {{ difficultyLabel(rec.difficulty) }}
                  </span>
                  <span class="brand-overview__opt-rec-impact">{{ rec.expectedImpact }}</span>
                </div>
                <p class="brand-overview__opt-rec-action">{{ rec.action }}</p>
                <p class="brand-overview__opt-rec-reason">{{ rec.reason }}</p>
                <button
                  class="brand-overview__opt-rec-start-btn"
                  @click="onStartOptimization(rec)"
                >
                  开始优化
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
</template>

<script setup lang="ts">
const props = defineProps<{
  hasAnalysis: boolean
  optimizationData: any
  optimizationLoading: boolean
  optimizationError: string | null
  optSteps: any[]
  optStepIndex: number
  isQdRunning: boolean
  onLoadOptimizations: () => void
  onQuickDiscovery: () => void
  onStartOptimization: (rec: any) => void
  onOpenExplain: (type: string) => void
  onClear: () => void
  priorityLabel: (priority: string) => string
  difficultyLabel: (difficulty: string) => string
}>()
</script>
