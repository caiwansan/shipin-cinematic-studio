<template>
  <section class="brand-overview__section">
    <h2 class="brand-overview__section-title">
      品牌 Explain
      <GeoExplainButton @click="openExplainDrawer('discovery')" />
      <button
        v-if="hasAnalysis && !explainLoading && !explainData"
        class="brand-overview__explain-trigger"
        @click="loadExplain"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
        查看 Explain
      </button>
      <button
        v-if="explainData"
        class="brand-overview__explain-trigger"
        @click="onClear"
      >
        收起
      </button>
    </h2>

    <!-- Explain Loading State -->
    <GeoLoading
      v-if="explainLoading"
      :steps="explainSteps"
      :current-step="explainStepIndex"
    />

    <!-- Explain Error -->
    <GeoErrorState v-else-if="explainError" :message="explainError" :on-retry="loadExplain" />

    <!-- Explain Empty State -->
    <GeoEmptyState
      v-else-if="!hasAnalysis && !explainData"
      icon="📖"
      title="品牌 Explain"
      description="运行 Quick Discovery 以生成品牌 Explain。"
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

    <!-- Explain Data -->
    <div v-else-if="explainData" class="brand-overview__explain-card">
      <!-- Confidence Badge (Use GeoBadge) -->
      <div class="brand-overview__explain-confidence">
        <GeoBadge :variant="explainData.explain.confidence >= 70 ? 'success' : explainData.explain.confidence >= 40 ? 'warning' : 'neutral'">
          {{ explainData.explain.confidence > 0 ? `Confidence ${explainData.explain.confidence}%` : 'Confidence Unknown' }}
        </GeoBadge>
        <span
          v-if="explainData.score > 0"
          class="brand-overview__explain-adi-badge"
        >
          ADI {{ explainData.score }}
        </span>
      </div>

      <!-- Summary -->
      <p class="brand-overview__explain-summary">{{ explainData.explain.summary }}</p>

      <!-- Evidence Section -->
      <div class="brand-overview__explain-section">
        <h4 class="brand-overview__explain-section-title">证据来源</h4>
        <div
          v-for="ev in explainData.evidence"
          :key="ev.id"
          class="brand-overview__explain-evidence"
        >
          <div class="brand-overview__explain-evidence-header" @click="toggleEvidence(ev.id)">
            <span class="brand-overview__explain-evidence-source">{{ sourceLabel(ev.source) }}</span>
            <span class="brand-overview__explain-evidence-confidence">{{ ev.confidence }}%</span>
            <span class="brand-overview__explain-evidence-toggle">{{ expandedEvidence[ev.id] ? '−' : '+' }}</span>
          </div>
          <div v-if="expandedEvidence[ev.id]" class="brand-overview__explain-evidence-body">
            <p>{{ ev.content }}</p>
            <small>{{ formatDate(ev.createdAt) }}</small>
          </div>
        </div>
        <div v-if="explainData.evidence.length === 0" class="brand-overview__explain-evidence-empty">
          暂无可用证据
        </div>
      </div>

      <!-- Reasons Section -->
      <div class="brand-overview__explain-section">
        <h4 class="brand-overview__explain-section-title">原因分析</h4>
        <ul class="brand-overview__explain-reasons">
          <li v-for="(reason, idx) in explainData.explain.reasons" :key="idx" class="brand-overview__explain-reason">
            <code>{{ reason.code }}</code>
            <span>{{ reason.message }}</span>
          </li>
          <li v-if="explainData.explain.reasons.length === 0" class="brand-overview__explain-reason brand-overview__explain-reason--empty">
            暂无分析原因
          </li>
        </ul>
      </div>

      <!-- Limitations -->
      <div v-if="explainData.explain.limitations.length > 0" class="brand-overview__explain-section">
        <h4 class="brand-overview__explain-section-title">局限性</h4>
        <ul class="brand-overview__explain-limitations">
          <li v-for="(lim, idx) in explainData.explain.limitations" :key="idx">{{ lim }}</li>
        </ul>
      </div>

      <!-- Recommendations Section -->
      <div class="brand-overview__explain-section">
        <h4 class="brand-overview__explain-section-title">优化建议</h4>
        <div
          v-for="(rec, idx) in explainData.recommendations"
          :key="idx"
          class="brand-overview__explain-recommendation"
          :class="`brand-overview__explain-recommendation--${rec.priority}`"
        >
          <div class="brand-overview__explain-rec-header">
            <span class="brand-overview__explain-rec-priority">{{ priorityLabel(rec.priority) }}</span>
            <span class="brand-overview__explain-rec-difficulty">{{ difficultyLabel(rec.difficulty) }}</span>
          </div>
          <p class="brand-overview__explain-rec-action">{{ rec.action }}</p>
          <div class="brand-overview__explain-rec-impact">
            <span>预期收益: {{ rec.expectedImpact }}</span>
            <span>难度: {{ difficultyLabel(rec.difficulty) }}</span>
          </div>
        </div>
        <div v-if="explainData.recommendations.length === 0" class="brand-overview__explain-rec-empty">
          暂无优化建议
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  hasAnalysis: boolean
  explainData: any
  explainLoading: boolean
  explainError: string | null
  explainSteps: { key: string; label: string }[]
  explainStepIndex: number
  isQdRunning: boolean
  onLoadExplain: () => void
  onQuickDiscovery: () => void
  onClear: () => void
  onOpenExplain: (type: string) => void
  sourceLabel: (source: string) => string
  formatDate: (dateStr: string) => string
  priorityLabel: (p: string) => string
  difficultyLabel: (d: string) => string
}>()

const loadExplain = props.onLoadExplain
const openExplainDrawer = props.onOpenExplain

const expandedEvidence = ref<Record<string, boolean>>({})

function toggleEvidence(id: string) {
  expandedEvidence.value[id] = !expandedEvidence.value[id]
}
</script>
