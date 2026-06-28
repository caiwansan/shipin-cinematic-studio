<template>
  <div class="workspace-center">
    <header class="workspace-center__header">
      <h1>Workspace Center</h1>
      <div class="workspace-center__actions">
        <button class="btn btn--primary" @click="showCreateModal = true">
          + New Workspace
        </button>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="store.loading" class="workspace-center__loading">
      Loading workspaces...
    </div>

    <!-- Error State -->
    <div v-else-if="store.error" class="workspace-center__error">
      {{ store.error }}
    </div>

    <!-- Workspace Types Grid -->
    <section v-if="!store.loading" class="workspace-center__types">
      <h2>Workspace Types</h2>
      <div class="workspace-center__grid">
        <div
          v-for="type in workspaceTypes"
          :key="type.key"
          class="workspace-type-card"
          @click="filterByType(type.key)"
        >
          <div class="workspace-type-card__icon">{{ type.icon }}</div>
          <div class="workspace-type-card__name">{{ type.label }}</div>
          <div class="workspace-type-card__count">
            {{ typeCount(type.key) }} workspaces
          </div>
        </div>
      </div>
    </section>

    <!-- Recent Workspaces -->
    <section v-if="!store.loading" class="workspace-center__recent">
      <h2>Recent Workspaces</h2>
      <div v-if="store.recentWorkspaces.length === 0" class="workspace-center__empty">
        No workspaces yet. Create your first one!
      </div>
      <div v-else class="workspace-center__list">
        <div
          v-for="w in store.recentWorkspaces"
          :key="w.id"
          class="workspace-card"
        >
          <div class="workspace-card__header">
            <span class="workspace-card__type-badge" :class="`badge--${w.type}`">
              {{ typeLabel(w.type) }}
            </span>
            <span class="workspace-card__status" :class="`status--${w.status}`">
              {{ w.status }}
            </span>
          </div>
          <div class="workspace-card__name">{{ w.name }}</div>
          <div class="workspace-card__meta">
            <span>v{{ store.versions.length }} · {{ store.snapshots.length }} snapshots</span>
          </div>
          <div class="workspace-card__footer">
            <span class="workspace-card__date">Updated: {{ formatDate(w.updatedAt) }}</span>
            <div class="workspace-card__actions">
              <button class="btn btn--sm" @click="openWorkspace(w.id)">Open</button>
              <button class="btn btn--sm btn--outline" @click="archiveWorkspace(w.id)" v-if="w.status === 'active'">
                Archive
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Create Modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal">
        <h3>Create Workspace</h3>
        <form @submit.prevent="handleCreate">
          <div class="form-group">
            <label>Name</label>
            <input v-model="newWorkspace.name" class="form-input" required />
          </div>
          <div class="form-group">
            <label>Type</label>
            <select v-model="newWorkspace.type" class="form-input" required>
              <option v-for="t in workspaceTypes" :key="t.key" :value="t.key">
                {{ t.label }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea v-model="newWorkspace.description" class="form-input"></textarea>
          </div>
          <div class="modal__actions">
            <button type="button" class="btn btn--outline" @click="showCreateModal = false">
              Cancel
            </button>
            <button type="submit" class="btn btn--primary">
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useWorkspaceStore } from '../store/useWorkspaceStore'
import type { WorkspaceType } from '../types/index'

const store = useWorkspaceStore()
const showCreateModal = ref(false)
const currentFilter = ref<string | null>(null)

const newWorkspace = ref({
  name: '',
  type: 'short_drama' as WorkspaceType,
  description: '',
  tenantId: 'default',
})

const workspaceTypes = [
  { key: 'short_drama' as WorkspaceType, label: 'Short Drama', icon: '🎬' },
  { key: 'novel' as WorkspaceType, label: 'Novel', icon: '📖' },
  { key: 'ppt' as WorkspaceType, label: 'Presentation', icon: '📊' },
  { key: 'geo' as WorkspaceType, label: 'GEO', icon: '🌍' },
  { key: 'asset' as WorkspaceType, label: 'Asset', icon: '📁' },
]

function typeLabel(type: string): string {
  const t = workspaceTypes.find(wt => wt.key === type)
  return t ? t.label : type
}

function typeCount(type: string): number {
  return store.workspaces.filter(w => w.type === type).length
}

function filterByType(type: string) {
  currentFilter.value = currentFilter.value === type ? null : type
  store.loadWorkspaces({ type: currentFilter.value ?? undefined })
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function openWorkspace(id: string) {
  await store.openWorkspace(id)
}

async function archiveWorkspace(id: string) {
  await store.archiveWorkspace(id)
}

async function handleCreate() {
  await store.createWorkspace({
    ...newWorkspace.value,
    tenantId: 'default',
  })
  showCreateModal.value = false
  newWorkspace.value = { name: '', type: 'short_drama', description: '', tenantId: 'default' }
}

onMounted(() => {
  store.loadWorkspaces()
})
</script>

<style scoped>
.workspace-center {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.workspace-center__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.workspace-center__header h1 {
  font-size: 28px;
  font-weight: 700;
}

.workspace-center__loading,
.workspace-center__error {
  text-align: center;
  padding: 48px;
  color: #666;
}

.workspace-center__error {
  color: #e53e3e;
}

.workspace-center__types {
  margin-bottom: 40px;
}

.workspace-center__types h2 {
  font-size: 18px;
  margin-bottom: 16px;
  color: #444;
}

.workspace-center__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.workspace-type-card {
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.workspace-type-card:hover {
  border-color: #4299e1;
  box-shadow: 0 4px 12px rgba(66, 153, 225, 0.15);
}

.workspace-type-card__icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.workspace-type-card__name {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
}

.workspace-type-card__count {
  font-size: 12px;
  color: #888;
}

.workspace-center__recent {
  margin-bottom: 40px;
}

.workspace-center__recent h2 {
  font-size: 18px;
  margin-bottom: 16px;
  color: #444;
}

.workspace-center__empty {
  text-align: center;
  padding: 48px;
  color: #999;
  background: #f7fafc;
  border-radius: 12px;
  border: 2px dashed #e2e8f0;
}

.workspace-center__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.workspace-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
  transition: box-shadow 0.2s;
}

.workspace-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.workspace-card__header {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.workspace-card__type-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  text-transform: uppercase;
}

.badge--short_drama { background: #fef3c7; color: #92400e; }
.badge--novel { background: #dbeafe; color: #1e40af; }
.badge--ppt { background: #d1fae5; color: #065f46; }
.badge--geo { background: #e0e7ff; color: #3730a3; }
.badge--asset { background: #fce7f3; color: #9d174d; }

.workspace-card__status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.status--active { background: #c6f6d5; color: #276749; }
.status--archived { background: #e2e8f0; color: #4a5568; }
.status--published { background: #bee3f8; color: #2a4365; }

.workspace-card__name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.workspace-card__meta {
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
}

.workspace-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.workspace-card__date {
  font-size: 12px;
  color: #aaa;
}

.workspace-card__actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid transparent;
  font-size: 14px;
  cursor: pointer;
  font-weight: 500;
}

.btn--primary {
  background: #4299e1;
  color: white;
}

.btn--primary:hover {
  background: #3182ce;
}

.btn--outline {
  background: transparent;
  border-color: #cbd5e0;
  color: #4a5568;
}

.btn--outline:hover {
  background: #f7fafc;
}

.btn--sm {
  padding: 4px 12px;
  font-size: 12px;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 12px;
  padding: 24px;
  width: 90%;
  max-width: 480px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

.modal h3 {
  margin-bottom: 20px;
  font-size: 18px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #4a5568;
  margin-bottom: 4px;
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
}

.form-input:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 2px rgba(66, 153, 225, 0.2);
}

.modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}
</style>
