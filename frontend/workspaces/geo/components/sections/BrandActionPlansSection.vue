<template>
      <section class="brand-overview__section">
        <h2 class="brand-overview__section-title">
          执行计划
          <span v-if="actionPlanData" class="brand-overview__ap-count">
            {{ actionPlanData.summary.todo }} 待办 ·
            {{ actionPlanData.summary.running }} 进行中 ·
            {{ actionPlanData.summary.completed }} 已完成
          </span>
          <button
            v-if="hasAnalysis && !actionPlanLoading && !actionPlanData"
            class="brand-overview__ap-trigger"
            @click="onLoadActionPlans"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            生成执行计划
          </button>
          <button
            v-if="actionPlanData"
            class="brand-overview__ap-refresh-btn"
            @click="onRefresh"
            :disabled="isRefreshing"
          >
            {{ isRefreshing ? '刷新中...' : '🔄 刷新计划' }}
          </button>
          <button
            v-if="actionPlanData && !actionPlanLoading"
            class="brand-overview__ap-trigger"
            @click="onClear"
          >
            收起
          </button>
        </h2>

        <!-- Action Plan Loading State -->
        <GeoLoading
          v-if="actionPlanLoading"
          :steps="apSteps"
          :current-step="apStepIndex"
        />

        <!-- Action Plan Error -->
        <GeoErrorState v-else-if="actionPlanError" :message="actionPlanError" :on-retry="onLoadActionPlans" />

        <!-- Action Plan Empty State -->
        <GeoEmptyState
          v-else-if="!hasAnalysis && !actionPlanData"
          icon="📋"
          title="执行计划"
          description="请运行优化中心以生成执行计划。"
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

        <!-- Action Plan Data -->
        <div v-else-if="actionPlanData" class="brand-overview__ap-card">
          <!-- Summary Bar -->
          <div class="brand-overview__ap-summary">
            <div class="brand-overview__ap-summary-item">
              <span class="brand-overview__ap-summary-label">总提升</span>
              <span class="brand-overview__ap-summary-value brand-overview__ap-summary-value--gain">
                +{{ actionPlanData.summary.totalEstimatedGain }} <small>ADI</small>
              </span>
            </div>
            <div class="brand-overview__ap-summary-item">
              <span class="brand-overview__ap-summary-label">待办</span>
              <span class="brand-overview__ap-summary-value">{{ actionPlanData.summary.todo }}</span>
            </div>
            <div class="brand-overview__ap-summary-item">
              <span class="brand-overview__ap-summary-label">进行中</span>
              <span class="brand-overview__ap-summary-value">{{ actionPlanData.summary.running }}</span>
            </div>
            <div class="brand-overview__ap-summary-item">
              <span class="brand-overview__ap-summary-label">已完成</span>
              <span class="brand-overview__ap-summary-value">{{ actionPlanData.summary.completed }}</span>
            </div>
          </div>

          <!-- Action Plan List -->
          <div class="brand-overview__ap-list">
            <div
              v-for="plan in actionPlanData.plans"
              :key="plan.id"
              class="brand-overview__ap-plan-card"
              :class="`brand-overview__ap-plan-card--${plan.priority}`"
            >
              <div class="brand-overview__ap-plan-left-bar" :class="`brand-overview__ap-plan-left-bar--${plan.priority}`" />
              <div class="brand-overview__ap-plan-content">
                <div class="brand-overview__ap-plan-header">
                  <span class="brand-overview__ap-plan-priority" :class="`brand-overview__ap-plan-priority--${plan.priority}`">
                    {{ priorityLabel(plan.priority) }}
                  </span>
                  <h4 class="brand-overview__ap-plan-title">{{ plan.title }}</h4>
                </div>
                <div class="brand-overview__ap-plan-meta">
                  <span class="brand-overview__ap-plan-impact">{{ plan.expectedImpact }}</span>
                  <span class="brand-overview__ap-plan-difficulty" :class="`brand-overview__ap-plan-difficulty--${plan.difficulty}`">
                    {{ difficultyLabel(plan.difficulty) }}
                  </span>
                  <span class="brand-overview__ap-plan-duration">约 {{ plan.estimatedMinutes }} 分钟</span>
                </div>

                <!-- Explain (可展开) -->
                <div class="brand-overview__ap-plan-explain">
                  <button
                    class="brand-overview__ap-plan-explain-toggle"
                    @click="toggleExplain(plan.id)"
                  >
                    <span>{{ expandedExplain[plan.id] ? '📖' : '📋' }}</span>
                    <span>{{ expandedExplain[plan.id] ? '收起详情' : '查看详情' }}</span>
                  </button>
                  <div v-if="expandedExplain[plan.id]" class="brand-overview__ap-plan-explain-body">
                    <p><strong>原因：</strong> {{ plan.explain }}</p>
                    <p><strong>预期提升：</strong> {{ plan.expectedImpact }}</p>
                    <p><strong>预计耗时：</strong> {{ plan.estimatedMinutes }} 分钟</p>
                  </div>
                </div>

                <!-- Status + Action Buttons -->
                <div class="brand-overview__ap-plan-actions">
                  <!-- Status: todo -->
                  <template v-if="plan.status === 'todo'">
                    <span class="brand-overview__ap-plan-status brand-overview__ap-plan-status--todo">○ 待办</span>
                    <button
                      class="brand-overview__ap-plan-btn brand-overview__ap-plan-btn--start"
                      @click="onStart(plan.id)"
                    >
                      ▶ 开始
                    </button>
                  </template>
                  <!-- Status: running -->
                  <template v-else-if="plan.status === 'running'">
                    <span class="brand-overview__ap-plan-status brand-overview__ap-plan-status--running">● 进行中</span>
                    <button
                      class="brand-overview__ap-plan-btn brand-overview__ap-plan-btn--pause"
                      @click="onPause(plan.id)"
                    >
                      ⏸ 暂停
                    </button>
                    <button
                      class="brand-overview__ap-plan-btn brand-overview__ap-plan-btn--complete"
                      @click="onComplete(plan.id)"
                    >
                      ✓ 完成
                    </button>
                  </template>
                  <!-- Status: completed -->
                  <template v-else>
                    <span class="brand-overview__ap-plan-status brand-overview__ap-plan-status--completed">✅ 已完成</span>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  hasAnalysis: boolean
  actionPlanData: any
  actionPlanLoading: boolean
  actionPlanError: string | null
  apSteps: any[]
  apStepIndex: number
  isQdRunning: boolean
  isRefreshing: boolean
  onLoadActionPlans: () => void
  onQuickDiscovery: () => void
  onRefresh: () => void
  onClear: () => void
  onStart: (planId: string) => void
  onPause: (planId: string) => void
  onComplete: (planId: string) => void
  priorityLabel: (priority: string) => string
  difficultyLabel: (difficulty: string) => string
}>()

// Local explain toggle state (moved from parent)
const expandedExplain = ref<Record<string, boolean>>({})

function toggleExplain(id: string) {
  expandedExplain.value[id] = !expandedExplain.value[id]
}
</script>
