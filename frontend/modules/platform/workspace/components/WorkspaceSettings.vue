<template>
  <div class="workspace-settings">
    <h3 class="workspace-settings__title">Workspace Settings</h3>
    <form @submit.prevent="handleSave" class="workspace-settings__form">
      <div class="form-group">
        <label>Name</label>
        <input v-model="form.name" class="form-input" required />
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea v-model="form.description" class="form-input" rows="3"></textarea>
      </div>
      <div class="form-group">
        <label>Auto-Save Interval (ms)</label>
        <input v-model.number="autoSaveConfig.interval" type="number" class="form-input" min="5000" step="1000" />
      </div>
      <div class="form-group">
        <label>Max Snapshots</label>
        <input v-model.number="autoSaveConfig.maxSnapshots" type="number" class="form-input" min="5" max="200" />
      </div>
      <div class="form-group">
        <label>Debounce (ms)</label>
        <input v-model.number="autoSaveConfig.debounceMs" type="number" class="form-input" min="500" step="500" />
      </div>
      <div class="workspace-settings__actions">
        <button type="submit" class="btn btn--primary" :disabled="saving">
          {{ saving ? 'Saving...' : 'Save Settings' }}
        </button>
        <button type="button" class="btn btn--outline" @click="handleDelete" v-if="showDelete">
          Delete Workspace
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import type { Workspace } from '../types/index'

const props = defineProps<{
  workspace: Workspace | null
  showDelete?: boolean
}>()

const emit = defineEmits<{
  save: [data: { name: string; description?: string }]
  delete: []
  autoSaveConfig: [config: { interval: number; maxSnapshots: number; debounceMs: number }]
}>()

const saving = ref(false)

const form = reactive({
  name: '',
  description: '',
})

const autoSaveConfig = reactive({
  interval: 30000,
  maxSnapshots: 50,
  debounceMs: 5000,
})

onMounted(() => {
  if (props.workspace) {
    form.name = props.workspace.name
    form.description = props.workspace.description || ''
  }
})

async function handleSave() {
  saving.value = true
  emit('save', { name: form.name, description: form.description })
  emit('autoSaveConfig', { ...autoSaveConfig })
  setTimeout(() => { saving.value = false }, 500)
}

function handleDelete() {
  if (confirm('Are you sure you want to delete this workspace?')) {
    emit('delete')
  }
}
</script>

<style scoped>
.workspace-settings {
  padding: 16px;
  max-width: 480px;
}

.workspace-settings__title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 20px;
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

textarea.form-input {
  resize: vertical;
}

.workspace-settings__actions {
  display: flex;
  gap: 8px;
  margin-top: 24px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid transparent;
  font-size: 14px;
  cursor: pointer;
  font-weight: 500;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn--primary {
  background: #4299e1;
  color: white;
}

.btn--outline {
  background: transparent;
  border-color: #fc8181;
  color: #e53e3e;
}

.btn--outline:hover {
  background: #fff5f5;
}
</style>
