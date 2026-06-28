<template>
  <div class="version-history">
    <h3 class="version-history__title">Version History</h3>
    <div v-if="versions.length === 0" class="version-history__empty">
      No versions yet.
    </div>
    <div v-else class="version-history__list">
      <div
        v-for="v in versions"
        :key="v.id"
        class="version-card"
        :class="{ 'version-card--published': v.published }"
      >
        <div class="version-card__header">
          <span class="version-card__label">{{ v.label }}</span>
          <span v-if="v.published" class="version-card__badge">Published</span>
          <span v-if="v.parentVersion" class="version-card__fork">Forked from v{{ v.parentVersion }}</span>
        </div>
        <div v-if="v.description" class="version-card__desc">{{ v.description }}</div>
        <div class="version-card__date">{{ formatDate(v.createdAt) }}</div>
        <div class="version-card__actions">
          <button v-if="!v.published" class="btn btn--sm btn--primary" @click="$emit('publish', v.id)">
            Publish
          </button>
          <button class="btn btn--sm btn--outline" @click="$emit('restore', v.id)">
            Restore
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WorkspaceVersion } from '../types/index'

defineProps<{
  versions: WorkspaceVersion[]
}>()

defineEmits<{
  publish: [versionId: string]
  restore: [versionId: string]
}>()

function formatDate(date: string): string {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
</script>

<style scoped>
.version-history {
  padding: 16px;
}

.version-history__title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

.version-history__empty {
  text-align: center;
  padding: 32px;
  color: #999;
}

.version-history__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.version-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
}

.version-card--published {
  border-color: #4299e1;
  background: #ebf8ff;
}

.version-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.version-card__label {
  font-weight: 600;
  font-size: 14px;
}

.version-card__badge {
  font-size: 10px;
  background: #4299e1;
  color: white;
  padding: 1px 8px;
  border-radius: 3px;
  font-weight: 600;
}

.version-card__fork {
  font-size: 10px;
  color: #805ad5;
  background: #faf5ff;
  padding: 1px 6px;
  border-radius: 3px;
}

.version-card__desc {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.version-card__date {
  font-size: 11px;
  color: #aaa;
  margin-bottom: 8px;
}

.version-card__actions {
  display: flex;
  gap: 6px;
}
</style>
