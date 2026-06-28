<template>
  <div class="snapshot-timeline">
    <h3 class="snapshot-timeline__title">Snapshot Timeline</h3>
    <div v-if="snapshots.length === 0" class="snapshot-timeline__empty">
      No snapshots yet.
    </div>
    <div v-else class="snapshot-timeline__list">
      <div
        v-for="sn in snapshots"
        :key="sn.id"
        class="snapshot-timeline__item"
        :class="{ 'snapshot-timeline__item--auto': sn.autoSave }"
      >
        <div class="snapshot-timeline__dot"></div>
        <div class="snapshot-timeline__content">
          <div class="snapshot-timeline__label">
            {{ sn.label || `Snapshot #${sn.version}` }}
            <span v-if="sn.autoSave" class="snapshot-timeline__badge">auto</span>
          </div>
          <div class="snapshot-timeline__date">{{ formatDate(sn.createdAt) }}</div>
          <div class="snapshot-timeline__actions">
            <button class="btn btn--xs btn--outline" @click="$emit('restore', sn.id)">
              Restore
            </button>
            <button class="btn btn--xs btn--ghost" @click="$emit('delete', sn.id)">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WorkspaceSnapshot } from '../types/index'

defineProps<{
  snapshots: WorkspaceSnapshot[]
}>()

defineEmits<{
  restore: [snapshotId: string]
  delete: [snapshotId: string]
}>()

function formatDate(date: string): string {
  return new Date(date).toLocaleString('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
</script>

<style scoped>
.snapshot-timeline {
  padding: 16px;
}

.snapshot-timeline__title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

.snapshot-timeline__empty {
  text-align: center;
  padding: 32px;
  color: #999;
}

.snapshot-timeline__list {
  position: relative;
  padding-left: 20px;
}

.snapshot-timeline__list::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #e2e8f0;
}

.snapshot-timeline__item {
  position: relative;
  margin-bottom: 16px;
  padding-left: 16px;
}

.snapshot-timeline__dot {
  position: absolute;
  left: -16px;
  top: 4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #4299e1;
  border: 2px solid white;
  box-shadow: 0 0 0 2px #4299e1;
}

.snapshot-timeline__item--auto .snapshot-timeline__dot {
  background: #a0aec0;
  box-shadow: 0 0 0 2px #a0aec0;
}

.snapshot-timeline__label {
  font-weight: 600;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.snapshot-timeline__badge {
  font-size: 10px;
  background: #e2e8f0;
  color: #718096;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 500;
}

.snapshot-timeline__date {
  font-size: 11px;
  color: #a0aec0;
  margin: 2px 0 6px;
}

.snapshot-timeline__actions {
  display: flex;
  gap: 6px;
}

.btn--xs {
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid transparent;
  cursor: pointer;
}

.btn--ghost {
  background: transparent;
  color: #718096;
  border-color: transparent;
}

.btn--ghost:hover {
  color: #e53e3e;
}
</style>
