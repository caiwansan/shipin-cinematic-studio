<template>
  <Teleport to="body">
    <Transition name="geo-drawer-fade">
      <div
        v-if="visible"
        class="geo-drawer-overlay"
        @click.self="handleClose"
      >
        <Transition name="geo-drawer-slide">
          <div v-if="visible" class="geo-drawer-panel">
            <!-- Inner Card -->
            <GeoExplainCard
              :explain="explain"
              :loading="loading"
              :error="error"
              @close="handleClose"
            />
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { ExplainResult } from '../../types/explain'
import GeoExplainCard from '../GeoExplainCard/index.vue'

const props = defineProps<{
  visible: boolean
  explain: ExplainResult | null
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

function handleClose() {
  emit('close')
}
</script>

<style scoped>
/* ===== Overlay ===== */
.geo-drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  justify-content: flex-end;
  align-items: stretch;
}

/* ===== Panel ===== */
.geo-drawer-panel {
  width: 420px;
  max-width: 90vw;
  height: 100vh;
  background: #ffffff;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.08);
  overflow-y: auto;
}

/* ===== Fade Transition (overlay) ===== */
.geo-drawer-fade-enter-active,
.geo-drawer-fade-leave-active {
  transition: opacity 0.2s ease;
}

.geo-drawer-fade-enter-from,
.geo-drawer-fade-leave-to {
  opacity: 0;
}

/* ===== Slide Transition (panel) ===== */
.geo-drawer-slide-enter-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.geo-drawer-slide-leave-active {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.geo-drawer-slide-enter-from {
  transform: translateX(100%);
}

.geo-drawer-slide-leave-to {
  transform: translateX(100%);
}
</style>
