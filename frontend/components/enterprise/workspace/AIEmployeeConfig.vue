<template>
  <div class="ai-employee-config">
    <div class="config-header">
      <h2>AI 员工中心</h2>
      <button class="btn-add" @click="showAddForm = true">+ 添加员工</button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state py-8 text-center">
      <div class="text-gray-500 text-sm">加载中...</div>
    </div>

    <!-- Agent List -->
    <div v-else-if="agents.length > 0" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <AgentCard
        v-for="agent in agents"
        :key="agent.id"
        :agent="agent"
        @select="handleSelect(agent)"
        @toggle="handleToggle(agent)"
      />
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else
      icon="🤖"
      title="暂无 AI 员工"
      description="AI 员工将协助您处理销售、运营、客服等工作。"
      :action="'创建第一个 AI 员工'"
      @action="showAddForm = true"
    />

    <!-- Detail Panel (Slide-over) -->
    <div v-if="selectedAgent" class="fixed inset-0 z-40 flex justify-end" @click.self="selectedAgent = null">
      <div class="w-full max-w-md bg-[#060A18] border-l border-[#1A2240] p-4 overflow-y-auto shadow-2xl">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold text-white">员工详情</h3>
          <button @click="selectedAgent = null" class="text-gray-500 hover:text-white text-lg">✕</button>
        </div>
        <AgentDetailPanel :detail="agentDetail" />
      </div>
    </div>

    <!-- Add/Edit Form Modal -->
    <div v-if="showAddForm" class="modal-overlay" @click.self="showAddForm = false">
      <!-- keep modal content unchanged -->
      <div class="modal-content">
        <h3>{{ editingId ? '配置 AI 员工' : '添加 AI 员工' }}</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>名称 *</label>
            <input v-model="form.name" placeholder="例如: 销售顾问小北" />
          </div>
          <div class="form-group">
            <label>角色 *</label>
            <select v-model="form.role">
              <option value="">选择角色</option>
              <option value="sales">销售 AI</option>
              <option value="marketing">营销 AI</option>
              <option value="support">客服 AI</option>
              <option value="analyst">分析 AI</option>
              <option value="custom">自定义</option>
            </select>
          </div>
          <div class="form-group full-width">
            <label>职责描述</label>
            <textarea v-model="form.responsibilities" placeholder="描述该 AI 员工的工作职责..." rows="3" />
          </div>
          <div class="form-group full-width">
            <label>系统提示词 (Prompt)</label>
            <textarea v-model="form.systemPrompt" placeholder="定义该 AI 员工的行为准则和专业知识..." rows="4" />
          </div>
          <div class="form-group">
            <label>绑定模型</label>
            <select v-model="form.model">
              <option value="">选择模型</option>
              <option v-for="p in availableModels" :key="p.id" :value="p.model">{{ p.provider }} - {{ p.model }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>温度</label>
            <input v-model.number="form.temperature" type="number" min="0" max="2" step="0.1" />
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showAddForm = false">取消</button>
          <button class="btn-save" @click="handleSave">{{ editingId ? '保存' : '创建' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import EmptyState from '~/components/enterprise-ui/feedback/EmptyState.vue'
import AgentCard from './AgentCard.vue'
import AgentDetailPanel from './AgentDetailPanel.vue'
import { useEnterpriseAgents } from '~/composables/useEnterpriseAgents'

const { loading, fetchAgentList, fetchAgentDetail, toggleAgent } = useEnterpriseAgents()

interface Agent {
  id: string
  name: string
  role: string
  agentType: string
  status: string
  runtimeStatus?: string
  agentId?: string
  namespace?: string
  healthScore?: number
  todayTasks?: number
  totalTasks?: number
  totalErrors?: number
  modelName?: string
  requireOwnLLMKey?: boolean
  lastActiveAt?: string
}

const agents = ref<Agent[]>([])
const selectedAgent = ref<Agent | null>(null)
const agentDetail = ref<any>(null)
const showAddForm = ref(false)
const editingId = ref<string | null>(null)
const availableModels = ref<any[]>([])

const form = ref({
  name: '',
  role: '',
  responsibilities: '',
  systemPrompt: '',
  model: '',
  temperature: 0.7,
})

async function loadAgents() {
  const tenantId = '' // will be derived from auth context
  agents.value = await fetchAgentList(tenantId)
}

async function handleSelect(agent: Agent) {
  selectedAgent.value = agent
  agentDetail.value = await fetchAgentDetail(agent.id)
}

async function handleToggle(agent: Agent) {
  if (!agent.agentId) return
  const newStatus = agent.runtimeStatus === 'active' ? 'paused' : 'active'
  // Note: toggle requires instanceId (agentId from backend perspective), not employeeId
  // We'd need to map this correctly in a real implementation
  // await toggleAgent(agent.agentId, newStatus)
}

function handleSave() {
  // TODO: wire to real API
  showAddForm.value = false
  editingId.value = null
  loadAgents()
}

onMounted(() => {
  loadAgents()
})
</script>

<style scoped>
.ai-employee-config {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.config-header h2 {
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.btn-add {
  padding: var(--space-sm) var(--space-md);
  background: var(--color-intelligence);
  color: #000;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
}

.btn-add:hover { opacity: 0.85; }

.employee-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.employee-card-config {
  padding: var(--space-md);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
}

.emp-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.emp-avatar {
  font-size: 28px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
}

.emp-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.emp-name { font-weight: 600; }
.emp-role { font-size: var(--font-size-xs); color: var(--color-text-muted); }

.emp-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.emp-detail-item {
  display: flex;
  gap: var(--space-sm);
  font-size: var(--font-size-sm);
}

.detail-label { color: var(--color-text-muted); flex-shrink: 0; }
.detail-value { color: var(--color-text-secondary); }

.emp-actions {
  display: flex;
  gap: var(--space-sm);
}

.btn-edit, .btn-toggle {
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-primary);
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.btn-edit:hover, .btn-toggle:hover {
  background: var(--color-bg-hover);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
}

.modal-content {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-xl);
  padding: var(--space-xl);
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content h3 {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin-bottom: var(--space-lg);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.form-group.full-width { grid-column: 1 / -1; }

.form-group label { font-size: var(--font-size-sm); font-weight: 500; }

.form-group input,
.form-group select,
.form-group textarea {
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  outline: none;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus { border-color: var(--color-intelligence); }

.form-group textarea { resize: vertical; }

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}

.btn-cancel {
  padding: var(--space-sm) var(--space-lg);
  border: 1px solid var(--color-border-primary);
  background: transparent;
  color: var(--color-text-muted);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.btn-save {
  padding: var(--space-sm) var(--space-lg);
  background: var(--color-intelligence);
  color: #000;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
}

@media (max-width: 768px) {
  .form-grid { grid-template-columns: 1fr; }
  .emp-details { grid-template-columns: 1fr; }
}
</style>
