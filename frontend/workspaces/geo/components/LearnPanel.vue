<!-- @deprecated 未被任何页面或组件引用，保留作参考
  LearnPanel.vue — Sprint 4-4: Discovery → Learn (Moment of Value)

  NOT a page, NOT a dashboard.
  This is the post-completion overlay that:
    1. Summarizes what just happened (GEO's insight)
    2. Structures signals into 3 categories (AI cognition / Content / External Ref)
    3. Recommends the next best action
    4. Offers one-click "Create Next Mission"

  This panel appears automatically after VERIFY:COMPLETED or PUBLISH:COMPLETED events.

  Reuses:
    - TaskCardModel (via NextAction.taskCard)
    - ExplainModel (via LearningSignal.explain)
    - GeoExplainButton, GeoBadge
-->
<template>
  <div v-if="visible" class="learn-panel" :class="{ 'learn-panel--slide-up': animateIn }">
    <!-- ===== Header: GEO 主动告诉你 ===== -->
    <div class="learn-panel__header">
      <div class="learn-panel__header-left">
        <span class="learn-panel__icon">🧠</span>
        <div>
          <h2 class="learn-panel__title">GEO 学习摘要</h2>
          <p class="learn-panel__subtitle">
            {{ store.currentInsight || '本轮优化完成，以下是 GEO 的分析与建议' }}
          </p>
        </div>
      </div>
      <button class="learn-panel__close-btn" @click="$emit('dismiss')" aria-label="关闭学习面板">
        ✕
      </button>
    </div>

    <!-- ===== Signal Summary Bar ===== -->
    <div v-if="summary" class="learn-panel__summary-bar">
      <div class="learn-panel__summary-item">
        <span class="learn-panel__summary-value">{{ summary.total_signals }}</span>
        <span class="learn-panel__summary-label">信号总数</span>
      </div>
      <div class="learn-panel__summary-item learn-panel__summary-item--positive">
        <span class="learn-panel__summary-value">{{ summary.positive_signals }}</span>
        <span class="learn-panel__summary-label">正面信号</span>
      </div>
      <div v-if="summary.negative_signals > 0" class="learn-panel__summary-item learn-panel__summary-item--negative">
        <span class="learn-panel__summary-value">{{ summary.negative_signals }}</span>
        <span class="learn-panel__summary-label">待关注</span>
      </div>
    </div>

    <!-- ===== Three Signal Categories ===== -->
    <div class="learn-panel__signals">
      <!-- AI Cognition -->
      <LearningSignalCard
        :signals="aiCognitionSignals"
        category="ai_cognition"
      />
      <!-- Content -->
      <LearningSignalCard
        :signals="contentSignals"
        category="content"
      />
      <!-- External Reference -->
      <LearningSignalCard
        :signals="externalRefSignals"
        category="external_reference"
      />
    </div>

    <!-- ===== Next Action CTA ===== -->
    <div v-if="nextAction" class="learn-panel__next-action">
      <div class="learn-panel__next-header">
        <span class="learn-panel__next-icon">🎯</span>
        <div>
          <p class="learn-panel__next-label">GEO 建议下一步</p>
          <h3 class="learn-panel__next-title">{{ nextAction.missionTitle }}</h3>
        </div>
      </div>
      <p class="learn-panel__next-desc">{{ nextAction.missionDescription }}</p>
      <p class="learn-panel__next-why">{{ nextAction.why }}</p>

      <div class="learn-panel__next-actions">
        <button
          class="learn-panel__btn learn-panel__btn--primary"
          @click="handleCreateMission"
        >
          🚀 创建新 Mission
        </button>
        <button
          class="learn-panel__btn learn-panel__btn--ghost"
          @click="handleViewDetails"
        >
          查看详情
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useLearningStore } from '../stores/useLearningStore'
import type { LearningSignal, NextAction } from '../types/learning/learning-signal'
import { SIGNAL_CATEGORY_LABELS, SIGNAL_CATEGORY_ICONS } from '../types/learning/learning-signal'
import LearningSignalCard from './LearningSignalCard.vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  dismiss: []
  'create-mission': [nextAction: NextAction]
  'view-details': []
}>()

const store = useLearningStore()
const animateIn = ref(false)

// Derived
const summary = computed(() => store.currentSignalSummary)
const nextAction = computed(() => store.currentNextAction)

const aiCognitionSignals = computed(() =>
  store.positiveSignals.filter(s => s.category === 'ai_cognition')
)
const contentSignals = computed(() =>
  store.positiveSignals.filter(s => s.category === 'content')
)
const externalRefSignals = computed(() =>
  store.positiveSignals.filter(s => s.category === 'external_reference')
)

// Animation trigger
watch(() => props.visible, (newVal) => {
  if (newVal) {
    // Small delay for DOM to register before animating
    setTimeout(() => { animateIn.value = true }, 50)
  } else {
    animateIn.value = false
  }
})

function handleCreateMission() {
  if (nextAction.value) {
    emit('create-mission', nextAction.value)
  }
}

function handleViewDetails() {
  emit('view-details')
}
</script>

<style scoped>
.learn-panel {
  /* Floating panel that appears at the bottom of the content area */
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.08);
  padding: 24px;
  margin-top: 32px;
  margin-bottom: -8px;
  max-width: 900px;
  margin-left: auto;
  margin-right: auto;

  /* Slide-up animation */
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.learn-panel--slide-up {
  opacity: 1;
  transform: translateY(0);
}

/* ===== Header ===== */
.learn-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.learn-panel__header-left {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.learn-panel__icon {
  font-size: 28px;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 2px;
}

.learn-panel__title {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 4px;
}

.learn-panel__subtitle {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
  line-height: 1.5;
}

.learn-panel__close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  color: #9ca3af;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.learn-panel__close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

/* ===== Summary Bar ===== */
.learn-panel__summary-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 10px;
  border: 1px solid #f3f4f6;
}

.learn-panel__summary-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-right: 12px;
  border-right: 1px solid #e5e7eb;
}

.learn-panel__summary-item:last-child {
  border-right: none;
}

.learn-panel__summary-value {
  font-size: 20px;
  font-weight: 700;
  color: #374151;
  line-height: 1;
}

.learn-panel__summary-label {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}

.learn-panel__summary-item--positive .learn-panel__summary-value {
  color: #059669;
}

.learn-panel__summary-item--negative .learn-panel__summary-value {
  color: #dc2626;
}

/* ===== Signal Cards ===== */
.learn-panel__signals {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

/* ===== Next Action ===== */
.learn-panel__next-action {
  background: linear-gradient(135deg, #f0f9ff 0%, #eff6ff 100%);
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  padding: 20px;
}

.learn-panel__next-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.learn-panel__next-icon {
  font-size: 24px;
  line-height: 1;
  flex-shrink: 0;
}

.learn-panel__next-label {
  font-size: 12px;
  font-weight: 600;
  color: #3b82f6;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 2px;
}

.learn-panel__next-title {
  font-size: 16px;
  font-weight: 700;
  color: #1e40af;
  margin: 0;
}

.learn-panel__next-desc {
  font-size: 14px;
  color: #374151;
  margin: 0 0 8px;
  line-height: 1.5;
}

.learn-panel__next-why {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 16px;
  padding: 8px 12px;
  background: rgba(59, 130, 246, 0.08);
  border-radius: 6px;
  line-height: 1.5;
}

.learn-panel__next-actions {
  display: flex;
  gap: 10px;
}

.learn-panel__btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
  font-family: inherit;
}

.learn-panel__btn--primary {
  background: #2563eb;
  color: #fff;
}

.learn-panel__btn--primary:hover {
  background: #1d4ed8;
}

.learn-panel__btn--ghost {
  background: transparent;
  color: #3b82f6;
  border: 1px solid #bfdbfe;
}

.learn-panel__btn--ghost:hover {
  background: #eff6ff;
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .learn-panel {
    padding: 16px;
    border-radius: 12px 12px 0 0;
    margin-top: 24px;
  }

  .learn-panel__summary-bar {
    flex-wrap: wrap;
    gap: 8px;
  }

  .learn-panel__summary-item {
    padding-right: 8px;
  }

  .learn-panel__next-actions {
    flex-direction: column;
  }

  .learn-panel__btn {
    width: 100%;
    text-align: center;
  }
}
</style>
