<template>
  <div class="undo-redo-toolbar">
    <button
      class="toolbar-btn"
      :disabled="!canUndo"
      title="Undo (Ctrl+Z)"
      @click="$emit('undo')"
    >
      <span class="toolbar-btn__icon">↩</span>
      <span class="toolbar-btn__label">Undo</span>
      <span v-if="undoCount > 0" class="toolbar-btn__count">{{ undoCount }}</span>
    </button>
    <button
      class="toolbar-btn"
      :disabled="!canRedo"
      title="Redo (Ctrl+Shift+Z)"
      @click="$emit('redo')"
    >
      <span class="toolbar-btn__icon">↪</span>
      <span class="toolbar-btn__label">Redo</span>
      <span v-if="redoCount > 0" class="toolbar-btn__count">{{ redoCount }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  canUndo: boolean
  canRedo: boolean
  undoCount: number
  redoCount: number
}>()

defineEmits<{
  undo: []
  redo: []
}>()
</script>

<style scoped>
.undo-redo-toolbar {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #4a5568;
  transition: all 0.15s;
}

.toolbar-btn:hover:not(:disabled) {
  background: #edf2f7;
}

.toolbar-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar-btn__icon {
  font-size: 16px;
}

.toolbar-btn__label {
  font-weight: 500;
}

.toolbar-btn__count {
  font-size: 10px;
  background: #4299e1;
  color: white;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
  min-width: 18px;
  text-align: center;
}
</style>
