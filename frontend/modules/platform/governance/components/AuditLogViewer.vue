<template>
  <div class="audit-viewer">
    <h3>📜 Audit Log</h3>

    <div class="av-filters">
      <input v-model="filterAction" placeholder="Filter by action..." class="av-input" />
      <select v-model="filterLimit" class="av-select">
        <option :value="20">20</option>
        <option :value="50">50</option>
        <option :value="100">100</option>
      </select>
      <button @click="$emit('refresh')" class="av-btn">🔄 Refresh</button>
    </div>

    <table class="av-table" v-if="logs.length">
      <thead>
        <tr>
          <th>Action</th>
          <th>Resource</th>
          <th>User</th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="log in filteredLogs" :key="log.id">
          <td><code>{{ log.action }}</code></td>
          <td>{{ log.resource }} <span class="av-id" v-if="log.resourceId">{{ log.resourceId.slice(0,8) }}...</span></td>
          <td class="av-mono">{{ log.userId?.slice(0,8) || '-' }}</td>
          <td class="av-mono">{{ formatDate(log.createdAt) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else class="av-empty">No audit logs.</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { AuditLogDTO } from '../types/index.js'

const props = defineProps<{
  logs: AuditLogDTO[]
}>()

defineEmits<{
  refresh: []
}>()

const filterAction = ref('')
const filterLimit = ref(50)

const filteredLogs = computed(() => {
  let result = props.logs
  if (filterAction.value) {
    result = result.filter(l => l.action.toLowerCase().includes(filterAction.value.toLowerCase()))
  }
  return result.slice(0, filterLimit.value)
})

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString()
}
</script>

<style scoped>
.audit-viewer { padding: 16px; }
.av-filters { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; }
.av-input { flex: 1; padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; }
.av-select { padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; }
.av-btn { padding: 6px 12px; background: #4fc3f7; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
.av-table { width: 100%; border-collapse: collapse; font-size: 0.85em; }
.av-table th, .av-table td { padding: 6px 10px; border-bottom: 1px solid #e0e0e0; text-align: left; }
.av-table th { background: #f5f5f5; }
.av-table code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; }
.av-id { color: #aaa; font-size: 0.85em; }
.av-mono { font-family: monospace; font-size: 0.9em; color: #888; }
.av-empty { color: #888; padding: 20px; text-align: center; }
</style>
