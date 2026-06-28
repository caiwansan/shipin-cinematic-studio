<template>
  <div class="workspace-manifest">
    <h3 class="workspace-manifest__title">Workspace Manifest</h3>
    <div v-if="!manifest" class="workspace-manifest__empty">
      No manifest available. <button class="btn btn--sm btn--primary" @click="$emit('generate')">Generate</button>
    </div>
    <div v-else class="workspace-manifest__content">
      <!-- Summary -->
      <div class="manifest-section">
        <h4>Summary</h4>
        <div class="manifest-grid">
          <div class="manifest-item">
            <span class="manifest-item__label">Name</span>
            <span class="manifest-item__value">{{ manifest.name }}</span>
          </div>
          <div class="manifest-item">
            <span class="manifest-item__label">Type</span>
            <span class="manifest-item__value">{{ manifest.type }}</span>
          </div>
          <div class="manifest-item">
            <span class="manifest-item__label">Generated</span>
            <span class="manifest-item__value">{{ formatDate(manifest.generatedAt) }}</span>
          </div>
        </div>
      </div>

      <!-- Capabilities -->
      <div class="manifest-section">
        <h4>Capabilities ({{ manifest.capabilities.length }})</h4>
        <div class="manifest-tags">
          <span v-for="cap in manifest.capabilities" :key="cap.id" class="tag">
            {{ cap.name }} v{{ cap.version }}
          </span>
        </div>
      </div>

      <!-- Assets -->
      <div class="manifest-section">
        <h4>Assets ({{ manifest.assets.length }})</h4>
        <div class="manifest-table">
          <div v-for="a in manifest.assets" :key="a.id" class="manifest-row">
            <span class="manifest-row__type">{{ a.type }}</span>
            <span class="manifest-row__path">{{ a.path }}</span>
            <span class="manifest-row__size">{{ formatSize(a.size) }}</span>
          </div>
        </div>
      </div>

      <!-- Output Versions -->
      <div class="manifest-section">
        <h4>Output Versions ({{ manifest.outputVersions.length }})</h4>
        <div class="manifest-table">
          <div v-for="ov in manifest.outputVersions" :key="ov.version" class="manifest-row">
            <span class="manifest-row__label">{{ ov.label }}</span>
            <span class="manifest-row__version">{{ ov.version }}</span>
            <span class="manifest-row__status" :class="{ 'is-published': ov.published }">
              {{ ov.published ? 'Published' : 'Draft' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Cost Summary -->
      <div class="manifest-section">
        <h4>Cost Summary</h4>
        <div class="manifest-grid">
          <div class="manifest-item">
            <span class="manifest-item__label">Estimated Cost</span>
            <span class="manifest-item__value">{{ manifest.costSummary.totalEstimatedCost }} {{ manifest.costSummary.currency }}</span>
          </div>
          <div class="manifest-item">
            <span class="manifest-item__label">Resources</span>
            <span class="manifest-item__value">{{ manifest.costSummary.resourceCount }}</span>
          </div>
        </div>
      </div>

      <!-- Audit Trail -->
      <div class="manifest-section">
        <h4>Audit Trail ({{ manifest.auditTrail.length }})</h4>
        <div class="manifest-table">
          <div v-for="(entry, i) in manifest.auditTrail.slice(0, 20)" :key="i" class="manifest-row">
            <span class="manifest-row__operation">{{ entry.operation }}</span>
            <span class="manifest-row__user">{{ entry.userId || 'system' }}</span>
            <span class="manifest-row__time">{{ formatDate(entry.timestamp) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WorkspaceManifest } from '../types/index'

defineProps<{
  manifest: WorkspaceManifest | null
}>()

defineEmits<{
  generate: []
}>()

function formatDate(date: string): string {
  return new Date(date).toLocaleString()
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}
</script>

<style scoped>
.workspace-manifest {
  padding: 16px;
  max-height: 80vh;
  overflow-y: auto;
}

.workspace-manifest__title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

.workspace-manifest__empty {
  text-align: center;
  padding: 32px;
  color: #999;
}

.manifest-section {
  margin-bottom: 20px;
}

.manifest-section h4 {
  font-size: 13px;
  font-weight: 600;
  color: #4a5568;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #e2e8f0;
}

.manifest-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.manifest-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
}

.manifest-item__label {
  color: #718096;
}

.manifest-item__value {
  font-weight: 500;
}

.manifest-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  font-size: 11px;
  background: #edf2f7;
  color: #4a5568;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.manifest-table {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.manifest-row {
  display: flex;
  gap: 12px;
  padding: 4px 0;
  font-size: 12px;
  align-items: center;
}

.manifest-row__type {
  font-weight: 500;
  min-width: 60px;
}

.manifest-row__path { flex: 1; color: #4a5568; }
.manifest-row__size { color: #888; min-width: 60px; text-align: right; }
.manifest-row__label { font-weight: 500; min-width: 100px; }
.manifest-row__version { color: #718096; }
.manifest-row__status {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  background: #e2e8f0;
}
.manifest-row__status.is-published {
  background: #c6f6d5;
  color: #276749;
}
.manifest-row__operation { font-weight: 500; min-width: 80px; }
.manifest-row__user { color: #718096; min-width: 80px; }
.manifest-row__time { color: #aaa; }
</style>
