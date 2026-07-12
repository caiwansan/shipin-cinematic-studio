<template>
  <Teleport to="body">
    <Transition name="drawer">
      <aside
        v-if="open"
        class="explain-drawer"
        data-testid="explain-drawer"
        role="dialog"
        aria-modal="true"
        @keydown.escape="emit('close')"
      >
        <!-- Overlay -->
        <div
          class="explain-drawer__overlay"
          @click="emit('close')"
        />
        <!-- Panel -->
        <div class="explain-drawer__panel">
          <header class="explain-drawer__header">
            <h2 class="explain-drawer__title">分析说明</h2>
            <button
              class="explain-drawer__close"
              aria-label="关闭"
              @click="emit('close')"
            >
              ✕
            </button>
          </header>
          <div class="explain-drawer__content">
            <section class="explain-drawer__section">
              <h3 class="explain-drawer__section-title">发生了什么</h3>
              <p class="explain-drawer__section-text">{{ model.what }}</p>
            </section>
            <section class="explain-drawer__section">
              <h3 class="explain-drawer__section-title">为什么</h3>
              <p class="explain-drawer__section-text">{{ model.why }}</p>
            </section>
            <section
              v-if="model.whyNow"
              class="explain-drawer__section"
            >
              <h3 class="explain-drawer__section-title">为什么现在</h3>
              <p class="explain-drawer__section-text">{{ model.whyNow }}</p>
            </section>
            <section class="explain-drawer__section">
              <h3 class="explain-drawer__section-title">证据</h3>
              <EvidencePanel :items="mappedEvidence" />
            </section>
            <section class="explain-drawer__section">
              <h3 class="explain-drawer__section-title">影响</h3>
              <p class="explain-drawer__section-text">{{ model.impact }}</p>
            </section>
            <section class="explain-drawer__section">
              <h3 class="explain-drawer__section-title">建议</h3>
              <p class="explain-drawer__section-text">{{ model.recommendation }}</p>
            </section>
            <ConfidenceBadge
              v-if="model.confidence"
              :confidence="model.confidence"
            />
          </div>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import type { ExplainModel } from '~/workspaces/geo/types/ai'
import type { EvidenceItem } from '~/workspaces/geo/types/ai'
import EvidencePanel from './EvidencePanel.vue'
import ConfidenceBadge from './ConfidenceBadge.vue'

interface ExplainDrawerProps {
  model: ExplainModel
  open: boolean
}

const props = defineProps<ExplainDrawerProps>()

const emit = defineEmits<{
  close: []
}>()

// Map ExplainEvidence (type + detail + source) to EvidenceItem (source + detail)
// ExplainEvidence.type maps to EvidenceItem.source
const mappedEvidence = computed<EvidenceItem[]>(() => {
  return props.model.evidence.map((e) => ({
    id: e.id,
    source: e.type,
    summary: e.summary,
    detail: e.detail,
  }))
})

// Escape key handler
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.explain-drawer {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
  align-items: stretch;
}

.explain-drawer__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
}

.explain-drawer__panel {
  position: relative;
  width: 480px;
  max-width: 90vw;
  height: 100vh;
  background: #ffffff;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.08);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  animation: drawer-slide-in 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes drawer-slide-in {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.explain-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.explain-drawer__title {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.explain-drawer__close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  font-size: 1.125rem;
  color: #6b7280;
  cursor: pointer;
  border-radius: 6px;
}

.explain-drawer__close:hover {
  background: #f3f4f6;
  color: #111827;
}

.explain-drawer__content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.explain-drawer__section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.explain-drawer__section-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.explain-drawer__section-text {
  font-size: 0.875rem;
  color: #1f2937;
  line-height: 1.6;
  margin: 0;
}
</style>
