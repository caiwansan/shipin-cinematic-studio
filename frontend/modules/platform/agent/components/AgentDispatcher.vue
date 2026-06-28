<template>
  <div class="agent-dispatcher">
    <div class="dispatcher-header">
      <h3>Agent 分发</h3>
      <span class="badge">手动模式</span>
    </div>

    <div class="form-group">
      <label>Agent 代码</label>
      <select v-model="selectedAgent" class="form-select">
        <option value="">选择 Agent...</option>
        <option v-for="agent in agents" :key="agent.code" :value="agent.code">
          {{ agent.name }} ({{ agent.code }})
        </option>
      </select>
    </div>

    <div class="form-group">
      <label>输入 (JSON)</label>
      <textarea
        v-model="inputJson"
        class="form-textarea"
        rows="5"
        placeholder='{ "key": "value" }'
      />
    </div>

    <button
      class="dispatch-btn"
      :disabled="!selectedAgent || !inputJson || loading"
      @click="handleDispatch"
    >
      <span v-if="loading">执行中...</span>
      <span v-else>🚀 分发执行</span>
    </button>

    <div v-if="result" class="result-panel">
      <h4>执行结果</h4>
      <div class="result-status" :class="result.status">
        {{ result.status }}
      </div>
      <pre v-if="result.result" class="result-json">{{ JSON.stringify(result.result, null, 2) }}</pre>
      <div v-if="result.error" class="result-error">{{ result.error }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { AgentDefinition, DispatchResult } from '../types/index'
import { agentProvider } from '../services/agent-provider'

defineProps<{
  agents: AgentDefinition[]
}>()

const selectedAgent = ref('')
const inputJson = ref('')
const loading = ref(false)
const result = ref<DispatchResult | null>(null)

async function handleDispatch() {
  if (!selectedAgent.value || !inputJson.value) return

  loading.value = true
  result.value = null

  try {
    const input = JSON.parse(inputJson.value)
    result.value = await agentProvider.dispatchAgents(selectedAgent.value, input)
  } catch (err: any) {
    result.value = {
      sessionId: '',
      agentCode: selectedAgent.value,
      status: 'failed',
      error: err.message,
      startedAt: new Date().toISOString(),
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.agent-dispatcher {
  padding: 16px;
}

.dispatcher-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}

.dispatcher-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary, #e2e8f0);
}

.badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #6366f120;
  color: #6366f1;
  text-transform: uppercase;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
  margin-bottom: 6px;
  font-weight: 500;
}

.form-select, .form-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color, #2a2a4a);
  border-radius: 8px;
  background: var(--surface-color, #1a1a2e);
  color: var(--text-primary, #e2e8f0);
  font-size: 13px;
  transition: border-color 0.2s;
}

.form-select:focus, .form-textarea:focus {
  outline: none;
  border-color: #6366f1;
}

.form-textarea {
  font-family: monospace;
  resize: vertical;
}

.dispatch-btn {
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.dispatch-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.dispatch-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.result-panel {
  margin-top: 20px;
  padding: 16px;
  background: var(--surface-color, #1a1a2e);
  border: 1px solid var(--border-color, #2a2a4a);
  border-radius: 8px;
}

.result-panel h4 {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--text-primary, #e2e8f0);
}

.result-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  display: inline-block;
  margin-bottom: 8px;
  text-transform: uppercase;
}

.result-status.completed { background: #22c55e20; color: #22c55e; }
.result-status.failed { background: #ef444420; color: #ef4444; }
.result-status.executing { background: #6366f120; color: #6366f1; }

.result-json {
  font-size: 12px;
  background: #0a0a1a;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  max-height: 300px;
  overflow-y: auto;
}

.result-error {
  font-size: 13px;
  color: #ef4444;
  padding: 8px;
  background: #ef444410;
  border-radius: 6px;
}
</style>
