<template>
  <div class="agent-center">
    <div class="page-header">
      <h1>Agent Center</h1>
      <p class="subtitle">平台可调度 Agent 内核 — 管理、分发、调度你的 AI Agent</p>
    </div>

    <!-- Health Overview -->
    <div class="health-cards" v-if="store.health">
      <div class="health-card">
        <div class="health-value">{{ store.health.registeredAgents }}</div>
        <div class="health-label">已注册 Agent</div>
      </div>
      <div class="health-card">
        <div class="health-value">{{ store.activeSessions.length }}</div>
        <div class="health-label">活跃 Session</div>
      </div>
      <div class="health-card">
        <div class="health-value">{{ store.health.availableTools?.length || 0 }}</div>
        <div class="health-label">可用工具</div>
      </div>
      <div class="health-card">
        <div class="health-value status-ok">{{ store.health.status }}</div>
        <div class="health-label">运行时状态</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
        <span v-if="tab.count" class="tab-count">{{ tab.count }}</span>
      </button>
    </div>

    <!-- Agents Tab -->
    <div v-if="activeTab === 'agents'" class="tab-content">
      <div class="section-header">
        <h2>Registered Agents</h2>
        <div class="header-actions">
          <input
            v-model="agentSearch"
            type="text"
            placeholder="搜索 Agent..."
            class="search-input"
          />
        </div>
      </div>

      <div v-if="store.loading" class="loading">加载中...</div>

      <div v-else-if="!filteredAgents.length" class="empty">
        暂无注册的 Agent
      </div>

      <div v-else class="agents-grid">
        <AgentCard
          v-for="agent in filteredAgents"
          :key="agent.code"
          :agent="agent"
          :selected="selectedAgent?.code === agent.code"
          @select="selectAgent"
        />
      </div>

      <!-- Agent Detail Panel -->
      <div v-if="selectedAgent" class="detail-panel">
        <div class="detail-header">
          <h3>{{ selectedAgent.name }} 详情</h3>
          <button class="close-btn" @click="selectedAgent = null">✕</button>
        </div>

        <div class="detail-section">
          <div class="detail-row">
            <span class="detail-label">代码</span>
            <code>{{ selectedAgent.code }}</code>
          </div>
          <div class="detail-row">
            <span class="detail-label">版本</span>
            <span>v{{ selectedAgent.version }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">执行模式</span>
            <span>{{ selectedAgent.executionMode }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">能力</span>
            <div class="capability-list">
              <span v-for="cap in selectedAgent.capabilities" :key="cap" class="cap-tag">
                {{ cap }}
              </span>
            </div>
          </div>
        </div>

        <div class="detail-actions">
          <button class="action-btn primary" @click="openDispatcher = true">
            分发执行
          </button>
          <button class="action-btn danger" @click="handleUnregister">
            注销
          </button>
        </div>
      </div>
    </div>

    <!-- Sessions Tab -->
    <div v-if="activeTab === 'sessions'" class="tab-content">
      <div class="section-header">
        <h2>Sessions ({{ store.sessions.length }})</h2>
        <select v-model="sessionFilter" class="filter-select">
          <option value="">全部</option>
          <option value="executing">执行中</option>
          <option value="completed">已完成</option>
          <option value="failed">失败</option>
          <option value="pending">等待中</option>
        </select>
      </div>

      <AgentSessionTimeline :sessions="filteredSessions" />
    </div>

    <!-- Dispatch Tab -->
    <div v-if="activeTab === 'dispatch'" class="tab-content">
      <AgentDispatcher
        :agents="store.agents"
        @dispatch="handleDispatchComplete"
      />
    </div>

    <!-- Tools Tab -->
    <div v-if="activeTab === 'tools'" class="tab-content">
      <div class="section-header">
        <h2>Tool Adapter 状态</h2>
      </div>
      <div class="tools-grid">
        <div v-for="tool in availableToolTypes" :key="tool" class="tool-card">
          <div class="tool-icon">{{ getToolIcon(tool) }}</div>
          <div class="tool-name">{{ tool }}</div>
          <div class="tool-status not-installed">Not Installed</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAgentStore } from '../store/useAgentStore'
import AgentCard from '../components/AgentCard.vue'
import AgentSessionTimeline from '../components/AgentSessionTimeline.vue'
import AgentDispatcher from '../components/AgentDispatcher.vue'
import type { AgentDefinition } from '../types/index'

const store = useAgentStore()
const activeTab = ref('agents')
const agentSearch = ref('')
const sessionFilter = ref('')
const selectedAgent = ref<AgentDefinition | null>(null)
const openDispatcher = ref(false)

const tabs = computed(() => [
  { key: 'agents', label: 'Agents', count: store.agents.length },
  { key: 'sessions', label: 'Sessions', count: store.activeSessions.length },
  { key: 'dispatch', label: 'Dispatch' },
  { key: 'tools', label: 'Tools' },
])

const filteredAgents = computed(() => {
  if (!agentSearch.value) return store.agents
  const q = agentSearch.value.toLowerCase()
  return store.agents.filter(a =>
    a.name.toLowerCase().includes(q) ||
    a.code.toLowerCase().includes(q) ||
    a.capabilities.some(c => c.toLowerCase().includes(q))
  )
})

const filteredSessions = computed(() => {
  if (!sessionFilter.value) return store.sessions
  return store.sessions.filter(s => s.status === sessionFilter.value)
})

const availableToolTypes = ['mcp', 'browser', 'search', 'python', 'database', 'http', 'filesystem']

function getToolIcon(type: string): string {
  const icons: Record<string, string> = {
    mcp: '🔌',
    browser: '🌐',
    search: '🔍',
    python: '🐍',
    database: '🗄️',
    http: '📡',
    filesystem: '📁',
  }
  return icons[type] || '🔧'
}

function selectAgent(agent: AgentDefinition) {
  selectedAgent.value = agent
}

async function handleUnregister() {
  if (!selectedAgent.value) return
  if (!confirm(`确定注销 Agent "${selectedAgent.value.name}"？`)) return
  await store.unregisterAgent(selectedAgent.value.code)
  selectedAgent.value = null
}

function handleDispatchComplete() {
  // Refresh sessions after dispatch
  store.fetchSessions()
}

onMounted(async () => {
  await Promise.all([
    store.fetchAgents(),
    store.fetchSessions(),
  ])
})
</script>

<style scoped>
.agent-center {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary, #e2e8f0);
  margin: 0 0 4px;
}

.subtitle {
  font-size: 14px;
  color: var(--text-secondary, #94a3b8);
  margin: 0;
}

/* Health Cards */
.health-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.health-card {
  background: var(--surface-color, #1a1a2e);
  border: 1px solid var(--border-color, #2a2a4a);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}

.health-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary, #e2e8f0);
}

.health-value.status-ok {
  color: #22c55e;
  font-size: 18px;
}

.health-label {
  font-size: 12px;
  color: var(--text-muted, #64748b);
  margin-top: 4px;
}

/* Tabs */
.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  background: var(--surface-color, #1a1a2e);
  border-radius: 10px;
  padding: 4px;
  border: 1px solid var(--border-color, #2a2a4a);
}

.tab-btn {
  flex: 1;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary, #94a3b8);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.tab-btn.active {
  background: #6366f1;
  color: white;
}

.tab-count {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(255,255,255,0.15);
}

/* Sections */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-header h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #e2e8f0);
  margin: 0;
}

.search-input, .filter-select {
  padding: 6px 12px;
  border: 1px solid var(--border-color, #2a2a4a);
  border-radius: 8px;
  background: var(--surface-color, #1a1a2e);
  color: var(--text-primary, #e2e8f0);
  font-size: 13px;
}

.search-input:focus, .filter-select:focus {
  outline: none;
  border-color: #6366f1;
}

/* Agents Grid */
.agents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}

/* Loading / Empty */
.loading, .empty {
  text-align: center;
  padding: 48px;
  color: var(--text-muted, #64748b);
  font-size: 14px;
}

/* Detail Panel */
.detail-panel {
  margin-top: 20px;
  background: var(--surface-color, #1a1a2e);
  border: 1px solid var(--border-color, #2a2a4a);
  border-radius: 12px;
  padding: 20px;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.detail-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary, #e2e8f0);
}

.close-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted, #64748b);
  cursor: pointer;
  font-size: 14px;
}

.close-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.detail-section {
  margin-bottom: 16px;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0;
  font-size: 13px;
}

.detail-label {
  color: var(--text-muted, #64748b);
  min-width: 80px;
  flex-shrink: 0;
}

.capability-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.cap-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #6366f120;
  color: #6366f1;
}

.detail-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
}

.action-btn.danger {
  background: #ef444420;
  color: #ef4444;
}

.action-btn:hover {
  transform: translateY(-1px);
}

/* Tools Grid */
.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.tool-card {
  background: var(--surface-color, #1a1a2e);
  border: 1px solid var(--border-color, #2a2a4a);
  border-radius: 12px;
  padding: 20px 16px;
  text-align: center;
}

.tool-icon {
  font-size: 28px;
  margin-bottom: 8px;
}

.tool-name {
  font-size: 13px;
  color: var(--text-primary, #e2e8f0);
  margin-bottom: 6px;
  font-family: monospace;
  text-transform: uppercase;
}

.tool-status {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  display: inline-block;
}

.tool-status.not-installed {
  background: #64748b20;
  color: #64748b;
}
</style>
