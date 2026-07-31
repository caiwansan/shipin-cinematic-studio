<!-- Admin: AI 员工管理 -->
<!-- 位置：/admin/recruitment/agents.vue -->
<!-- 职责：全平台 AI 员工 Runtime — 搜索/筛选/详情/启停控制 + 模型配置（P5-ADMIN-01） -->
<template>
  <RecruitmentPageShell>
    <template #title>AI 员工管理</template>
    <template #subtitle>全平台 AI 员工 Runtime 状态 · 模型配置</template>
    <template #actions>
      <button @click="openModelConfigPool" class="rec-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:middle"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M2 12a10 10 0 0 0 10 10"/><path d="M2 12h20"/></svg>
        模型池
      </button>
      <button @click="fetchData" class="rec-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:middle"><path d="M21 12a9 9 0 1 1-9-9"/><path d="M21 3v6h-6"/></svg>
        刷新
      </button>
    </template>

    <template #filters>
      <div class="rec-search-wrap">
        <svg class="rec-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input
          v-model="searchKey"
          @keyup.enter="page = 1; fetchData()"
          placeholder="搜索 AI 员工名称、类型..."
          class="rec-input"
        />
      </div>
      <select v-model="filterState" @change="page = 1; fetchData()" class="rec-select">
        <option value="">全部状态</option>
        <option value="ACTIVE">Running</option>
        <option value="PAUSED">Paused</option>
        <option value="STOPPED">Stopped</option>
        <option value="RECOVERING">Recovering</option>
        <option value="EMERGENCY_STOP">Emergency</option>
      </select>
      <select v-model="filterType" @change="page = 1; fetchData()" class="rec-select">
        <option value="">全部类型</option>
        <option value="recruiter">Recruiter</option>
        <option value="marketing">Marketing</option>
        <option value="interview">Interview</option>
        <option value="career_advisor">Career Advisor</option>
        <option value="resume_analyzer">Resume Analyzer</option>
        <option value="talent_hunter">Talent Hunter</option>
      </select>
    </template>

    <!-- Loading -->
    <div v-if="loading" class="rec-loading">
      <div class="rec-spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="rec-error-banner">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      <span>{{ error }}</span>
      <button @click="fetchData" class="rec-btn-link">重试</button>
    </div>

    <template v-else>
      <!-- Stats Bar: compact summary -->
      <div class="rec-agent-stats">
        <div class="rec-agent-stat">
          <span class="rec-agent-stat-val">{{ total }}</span>
          <span class="rec-agent-stat-lbl">总数</span>
        </div>
        <div class="rec-agent-stat rec-stat-running">
          <span class="rec-agent-stat-val">{{ stateStats.ACTIVE || 0 }}</span>
          <span class="rec-agent-stat-lbl">Running</span>
        </div>
        <div class="rec-agent-stat rec-stat-paused">
          <span class="rec-agent-stat-val">{{ stateStats.PAUSED || 0 }}</span>
          <span class="rec-agent-stat-lbl">Paused</span>
        </div>
        <div class="rec-agent-stat rec-stat-recovering">
          <span class="rec-agent-stat-val">{{ stateStats.RECOVERING || 0 }}</span>
          <span class="rec-agent-stat-lbl">Recovering</span>
        </div>
        <div class="rec-agent-stat rec-stat-stopped">
          <span class="rec-agent-stat-val">{{ (stateStats.EMERGENCY_STOP || 0) + (stateStats.STOPPED || 0) }}</span>
          <span class="rec-agent-stat-lbl">Stopped</span>
        </div>
      </div>

      <!-- Agent Cards Grid -->
      <div v-if="list.length === 0" class="rec-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M2 12a10 10 0 0 0 10 10"/><path d="M2 12h20"/></svg>
        <div>暂无 AI 员工</div>
      </div>

      <div v-else class="rec-agent-grid">
        <div
          v-for="agent in list"
          :key="agent.id"
          class="rec-agent-card"
        >
          <!-- Card Header: Avatar + Name + Status -->
          <div class="rec-agent-card-header">
            <div class="rec-agent-avatar" :style="{ background: typeGradient(agent.agentType) }">
              {{ agent.name?.charAt(0) || '?' }}
            </div>
            <div class="rec-agent-card-info">
              <div class="rec-agent-card-name">{{ agent.name }}</div>
              <div class="rec-agent-card-role">{{ typeLabel(agent.agentType) }}</div>
            </div>
            <div class="rec-agent-status-indicator">
              <span class="rec-status-dot" :class="statusDotClass(agent.lifecycleState)"></span>
              <span class="rec-status-text" :class="statusTextClass(agent.lifecycleState)">{{ stateLabel(agent.lifecycleState) }}</span>
            </div>
          </div>

          <!-- Description -->
          <div v-if="agent.description" class="rec-agent-card-desc">{{ agent.description }}</div>

          <!-- Capabilities -->
          <div v-if="agent.capabilities?.length" class="rec-agent-card-section">
            <div class="rec-agent-section-label">负责</div>
            <div class="rec-agent-cap-list">
              <div v-for="cap in agent.capabilities" :key="cap" class="rec-agent-cap-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-execution)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {{ cap }}
              </div>
            </div>
          </div>

          <!-- Metrics Row -->
          <div class="rec-agent-card-metrics">
            <div class="rec-agent-metric">
              <span class="rec-agent-metric-label">今日任务</span>
              <span class="rec-agent-metric-value">{{ agent.todayTasks ?? agent.taskCountToday ?? '—' }}</span>
            </div>
            <div class="rec-agent-metric">
              <span class="rec-agent-metric-label">模型</span>
              <span class="rec-agent-metric-value rec-agent-model">{{ agent.modelLabel || '未配置' }}</span>
            </div>
            <div v-if="agent.lastExecutedAt || agent.updatedAt" class="rec-agent-metric">
              <span class="rec-agent-metric-label">最近执行</span>
              <span class="rec-agent-metric-value rec-agent-metric-time">{{ formatRelativeTime(agent.lastExecutedAt || agent.updatedAt) }}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="rec-agent-card-actions">
            <button @click="openDetail(agent)" class="rec-agent-btn rec-agent-btn-primary">查看详情</button>
            <button v-if="agent.lifecycleState === 'ACTIVE'" @click="updateAgentState(agent, 'PAUSED')" class="rec-agent-btn rec-agent-btn-warning">暂停</button>
            <button v-if="agent.lifecycleState === 'PAUSED'" @click="updateAgentState(agent, 'ACTIVE')" class="rec-agent-btn rec-agent-btn-success">恢复</button>
            <button v-if="agent.lifecycleState !== 'EMERGENCY_STOP'" @click="updateAgentState(agent, 'EMERGENCY_STOP')" class="rec-agent-btn rec-agent-btn-danger">急停</button>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="rec-pagination">
        <span class="rec-page-info">共 {{ total }} 条 · 第 {{ page }}/{{ totalPages }} 页</span>
        <div class="rec-page-actions">
          <button @click="page--; fetchData()" :disabled="page <= 1" class="rec-btn-page">上一页</button>
          <button @click="page++; fetchData()" :disabled="page >= totalPages" class="rec-btn-page">下一页</button>
        </div>
      </div>
    </template>

    <!-- Detail Modal -->
    <Teleport to="body">
      <div v-if="detailItem" class="rec-modal-overlay" @click.self="detailItem = null">
        <div class="rec-modal rec-modal-lg">
          <div class="rec-modal-header">
            <h2 class="rec-modal-title">AI 员工详情</h2>
            <button @click="detailItem = null" class="rec-modal-close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <template v-if="detailItem">
            <div class="rec-modal-body">
              <!-- Profile -->
              <div class="rec-detail-profile">
                <div class="rec-agent-avatar rec-agent-avatar-lg" :style="{ background: typeGradient(detailItem.agentType) }">
                  {{ detailItem.name?.charAt(0) || '?' }}
                </div>
                <div class="rec-detail-profile-info">
                  <div class="rec-detail-value">{{ detailItem.name }}</div>
                  <div class="rec-detail-meta">{{ typeLabel(detailItem.agentType) }}</div>
                  <div class="rec-detail-meta" style="margin-top: 6px;">
                    <RecruitmentBadge :variant="stateBadgeVariant(detailItem.lifecycleState)">{{ stateLabel(detailItem.lifecycleState) }}</RecruitmentBadge>
                  </div>
                </div>
                <div class="rec-detail-profile-metrics">
                  <div class="rec-profile-stat">
                    <span class="rec-profile-stat-val">{{ detailItem.todayTasks ?? detailItem.taskCountToday ?? '—' }}</span>
                    <span class="rec-detail-meta">今日任务</span>
                  </div>
                </div>
              </div>

              <!-- Info Grid -->
              <div class="rec-detail-grid">
                <div class="rec-detail-field"><span class="rec-detail-label">所属企业</span><span class="rec-detail-value">{{ detailItem.enterprise?.name || '—' }}</span></div>
                <div class="rec-detail-field"><span class="rec-detail-label">使用模型</span><span class="rec-detail-value">{{ detailItem.modelLabel || '未配置' }}</span></div>
                <div class="rec-detail-field"><span class="rec-detail-label">最后恢复</span><span class="rec-detail-value">{{ detailItem.lastRecoveredAt ? formatTime(detailItem.lastRecoveredAt) : '—' }}</span></div>
                <div class="rec-detail-field"><span class="rec-detail-label">最近执行</span><span class="rec-detail-value">{{ formatRelativeTime(detailItem.lastExecutedAt || detailItem.updatedAt) }}</span></div>
                <div class="rec-detail-field"><span class="rec-detail-label">创建时间</span><span class="rec-detail-value">{{ formatTime(detailItem.createdAt) }}</span></div>
                <div class="rec-detail-field"><span class="rec-detail-label">更新时间</span><span class="rec-detail-value">{{ formatTime(detailItem.updatedAt) }}</span></div>
              </div>

              <!-- Description -->
              <div v-if="detailItem.description" class="rec-detail-section">
                <span class="rec-detail-label">描述</span>
                <div class="rec-detail-block">{{ detailItem.description }}</div>
              </div>

              <!-- Capabilities -->
              <div v-if="detailItem.capabilities?.length" class="rec-detail-section">
                <span class="rec-detail-label">能力标签</span>
                <div class="rec-tag-group">
                  <span v-for="c in detailItem.capabilities" :key="c" class="rec-tag rec-tag-purple">{{ c }}</span>
                </div>
              </div>

              <!-- Execution Records -->
              <div v-if="detailItem.executionRecords?.length || detailItem.recentExecutions?.length" class="rec-detail-section" style="border-top:1px solid var(--color-border-primary);padding-top:12px;">
                <span class="rec-detail-label">执行记录</span>
                <div class="rec-exec-list">
                  <div v-for="rec in (detailItem.executionRecords || detailItem.recentExecutions || []).slice(0, 5)" :key="rec.id || rec._key" class="rec-exec-item">
                    <div class="rec-exec-info">
                      <span class="rec-exec-action">{{ rec.action || rec.task || '—' }}</span>
                      <span class="rec-exec-time">{{ formatRelativeTime(rec.createdAt || rec.timestamp) }}</span>
                    </div>
                    <span v-if="rec.status" class="rec-exec-status" :class="rec.status === 'completed' || rec.status === 'success' ? 'rec-status-green' : rec.status === 'failed' ? 'rec-status-red' : 'rec-status-amber'">{{ rec.status }}</span>
                  </div>
                </div>
              </div>

              <!-- Model Bindings -->
              <div class="rec-detail-section" style="border-top:1px solid var(--color-border-primary);padding-top:12px;">
                <div class="rec-section-header">
                  <span class="rec-detail-label">模型配置</span>
                  <button @click="showBindModel = !showBindModel" class="rec-btn-xs rec-btn-purple">{{ showBindModel ? '取消' : '+ 绑定模型' }}</button>
                </div>

                <!-- Bind form -->
                <div v-if="showBindModel" class="rec-bind-form">
                  <div class="rec-bind-grid">
                    <div><label class="rec-form-label">模型</label><select v-model="bindForm.llmConfigId" class="rec-select"><option value="">选择模型</option><option v-for="c in modelConfigList" :key="c.id" :value="c.id">{{ c.provider }}/{{ c.modelName }}</option></select></div>
                    <div><label class="rec-form-label">任务类型</label><select v-model="bindForm.taskType" class="rec-select"><option value="default">默认</option><option value="chat">对话</option><option value="analysis">分析</option><option value="generation">生成</option><option value="screening">筛选</option></select></div>
                    <div><label class="rec-form-label">Temperature</label><input v-model.number="bindForm.temperature" type="number" step="0.1" min="0" max="2" class="rec-input" /></div>
                    <div><label class="rec-form-label">Max Tokens</label><input v-model.number="bindForm.maxTokens" type="number" step="1024" min="256" max="128000" class="rec-input" /></div>
                  </div>
                  <div class="rec-bind-options">
                    <label class="rec-checkbox"><input v-model="bindForm.fallbackEnabled" type="checkbox" /> 启用 Fallback</label>
                    <select v-model="bindForm.failureStrategy" class="rec-select rec-select-sm"><option value="fallback">Fallback</option><option value="retry">Retry</option><option value="fail">Fail</option></select>
                  </div>
                  <div class="rec-bind-actions">
                    <button @click="bindModel" :disabled="!bindForm.llmConfigId || bindSaving" class="rec-agent-btn rec-agent-btn-purple">{{ bindSaving ? '保存中...' : '确认绑定' }}</button>
                  </div>
                </div>

                <!-- Existing bindings -->
                <div v-if="modelBindings.length === 0 && !showBindModel" class="rec-empty-sm">暂未绑定模型</div>
                <div v-else class="rec-bind-list">
                  <div v-for="b in modelBindings" :key="b.id" class="rec-bind-item">
                    <div class="rec-bind-info">
                      <span class="rec-tag rec-tag-purple">{{ b.provider }}</span>
                      <span class="rec-bind-name">{{ b.modelName }}</span>
                      <span class="rec-bind-task">/{{ b.taskType }}</span>
                      <span v-if="!b.enabled" class="rec-bind-disabled">已禁用</span>
                    </div>
                    <div class="rec-bind-controls">
                      <span class="rec-bind-params">t={{ b.temperature }} max={{ b.maxTokens }}</span>
                      <button @click="toggleBinding(b)" class="rec-btn-xs" :class="b.enabled ? 'rec-btn-amber' : 'rec-btn-green'">{{ b.enabled ? '禁用' : '启用' }}</button>
                      <button @click="removeBinding(b)" class="rec-btn-xs rec-btn-red">移除</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <div class="rec-modal-footer">
            <button v-if="detailItem?.lifecycleState === 'ACTIVE'" @click="updateAgentState(detailItem, 'PAUSED'); detailItem = null" class="rec-agent-btn rec-agent-btn-warning">暂停</button>
            <button v-if="detailItem?.lifecycleState === 'PAUSED'" @click="updateAgentState(detailItem, 'ACTIVE'); detailItem = null" class="rec-agent-btn rec-agent-btn-success">恢复</button>
            <button v-if="detailItem?.lifecycleState !== 'EMERGENCY_STOP'" @click="updateAgentState(detailItem, 'EMERGENCY_STOP'); detailItem = null" class="rec-agent-btn rec-agent-btn-danger">急停</button>
            <button @click="detailItem = null" class="rec-btn-ghost">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Model Config Pool Modal -->
    <Teleport to="body">
      <div v-if="showModelPool" class="rec-modal-overlay" @click.self="showModelPool = false">
        <div class="rec-modal rec-modal-lg">
          <div class="rec-modal-header">
            <h2 class="rec-modal-title">模型池管理</h2>
            <button @click="showModelPool = false" class="rec-modal-close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <!-- Add new model form -->
          <div class="rec-pool-add-form">
            <div class="rec-pool-form-title">添加模型配置</div>
            <div class="rec-bind-grid">
              <div><label class="rec-form-label">Provider</label><select v-model="configForm.provider" class="rec-select"><option value="openai">OpenAI</option><option value="deepseek">DeepSeek</option><option value="qwen">通义千问</option><option value="claude">Claude</option><option value="zhipu">智谱</option><option value="moonshot">月之暗面</option><option value="volcengine">火山引擎</option><option value="custom">自定义</option></select></div>
              <div><label class="rec-form-label">Model Name</label><input v-model="configForm.modelName" placeholder="e.g. gpt-4o" class="rec-input" /></div>
              <div><label class="rec-form-label">Base URL (可选)</label><input v-model="configForm.baseUrl" placeholder="https://..." class="rec-input" /></div>
            </div>
            <div class="rec-bind-grid">
              <div class="col-span-2"><label class="rec-form-label">API Key</label><input v-model="configForm.apiKey" type="password" placeholder="sk-..." class="rec-input" /></div>
              <div><label class="rec-form-label">Max Tokens/Day</label><input v-model.number="configForm.maxTokensPerDay" type="number" min="0" placeholder="0=不限" class="rec-input" /></div>
            </div>
            <div class="rec-pool-actions">
              <button @click="testConfig" :disabled="configSaving" class="rec-agent-btn">{{ configSaving ? '测试中...' : '测试连通性' }}</button>
              <button @click="saveConfig" :disabled="configSaving || !configForm.provider || !configForm.modelName || !configForm.apiKey" class="rec-agent-btn rec-agent-btn-purple">{{ configSaving ? '保存中...' : '保存' }}</button>
            </div>
            <div v-if="configTestResult" class="rec-pool-test-result" :class="configTestResult.success ? 'rec-test-ok' : 'rec-test-fail'">
              {{ configTestResult.success ? '连通 (' + configTestResult.latencyMs + 'ms)' : configTestResult.error }}
            </div>
          </div>

          <!-- Model pool list -->
          <div v-if="modelConfigList.length === 0" class="rec-empty-sm">暂无模型配置</div>
          <div v-else class="rec-bind-list">
            <div v-for="c in modelConfigList" :key="c.id" class="rec-bind-item">
              <div class="rec-bind-info">
                <span class="rec-tag rec-tag-purple">{{ c.provider }}</span>
                <span class="rec-bind-name">{{ c.modelName }}</span>
                <span v-if="!c.enabled" class="rec-bind-disabled">已禁用</span>
              </div>
              <div class="rec-bind-controls">
                <button @click="testConfigById(c.id)" class="rec-btn-xs rec-btn-primary-sm">测试</button>
                <button @click="toggleConfig(c)" class="rec-btn-xs" :class="c.enabled ? 'rec-btn-amber' : 'rec-btn-green'">{{ c.enabled ? '禁用' : '启用' }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </RecruitmentPageShell>
</template>

<script setup lang="ts">
import RecruitmentPageShell from '~/components/enterprise/recruitment/ui/RecruitmentPageShell.vue'
import RecruitmentBadge from '~/components/enterprise/recruitment/ui/RecruitmentBadge.vue'
definePageMeta({ layout: 'admin-aigc' })
import { ref, onMounted, reactive } from 'vue'

// ─── 原有状态 ───
const loading = ref(false)
const error = ref('')
const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const totalPages = ref(0)
const filterState = ref('')
const filterType = ref('')
const searchKey = ref('')
const detailItem = ref<any>(null)
const stateStats = ref<Record<string, number>>({})

// ─── P5-ADMIN-01: 模型配置状态 ───
const showBindModel = ref(false)
const showModelPool = ref(false)
const modelConfigList = ref<any[]>([])
const modelBindings = ref<any[]>([])
const bindSaving = ref(false)
const configSaving = ref(false)
const configTestResult = ref<any>(null)

const bindForm = reactive({
  llmConfigId: '',
  taskType: 'default',
  temperature: 0.7,
  maxTokens: 16384,
  fallbackEnabled: true,
  failureStrategy: 'fallback',
  enabled: true,
})

const configForm = reactive({
  provider: 'openai',
  modelName: '',
  apiKey: '',
  baseUrl: '',
  maxTokensPerDay: 0,
})

// ─── Type helpers ───
function typeLabel(t: string) {
  return ({ recruiter: '招聘顾问', marketing: '营销专员', interview: '面试官', career_advisor: '职业顾问', resume_analyzer: '简历分析师', talent_hunter: '人才猎头' } as Record<string, string>)[t] || t
}
function stateLabel(s: string) {
  return ({ ACTIVE: 'Running', PAUSED: 'Paused', STOPPED: 'Stopped', RECOVERING: 'Recovering', EMERGENCY_STOP: 'Emergency' } as Record<string, string>)[s] || s
}
function stateBadgeVariant(s: string) {
  return ({ ACTIVE: 'success', PAUSED: 'warning', STOPPED: 'neutral', RECOVERING: 'info', EMERGENCY_STOP: 'danger' } as Record<string, string>)[s] || 'neutral'
}
function statusDotClass(s: string) {
  return ({ ACTIVE: 'dot-running', PAUSED: 'dot-paused', STOPPED: 'dot-stopped', RECOVERING: 'dot-recovering', EMERGENCY_STOP: 'dot-emergency' } as Record<string, string>)[s] || 'dot-stopped'
}
function statusTextClass(s: string) {
  return ({ ACTIVE: 'text-running', PAUSED: 'text-paused', STOPPED: 'text-stopped', RECOVERING: 'text-recovering', EMERGENCY_STOP: 'text-emergency' } as Record<string, string>)[s] || 'text-stopped'
}
function typeGradient(t: string) {
  const gradients: Record<string, string> = {
    recruiter: 'linear-gradient(135deg, #3B82F6, #2563EB)',
    marketing: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
    interview: 'linear-gradient(135deg, #10B981, #059669)',
    career_advisor: 'linear-gradient(135deg, #F59E0B, #D97706)',
    resume_analyzer: 'linear-gradient(135deg, #06B6D4, #0891B2)',
    talent_hunter: 'linear-gradient(135deg, #F97316, #EA580C)',
  }
  return gradients[t] || 'linear-gradient(135deg, #6366F1, #4F46E5)'
}
function formatTime(t: string) {
  if (!t) return '—'
  return new Date(t).toLocaleDateString('zh-CN')
}
function formatRelativeTime(t: string) {
  if (!t) return '—'
  const d = new Date(t)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return d.toLocaleDateString('zh-CN')
}

function openDetail(agent: any) {
  detailItem.value = agent
  showBindModel.value = false
  loadModelBindings(agent.id)
}

async function updateAgentState(agent: any, state: string) {
  const label = stateLabel(state)
  if (!confirm(`确认将「${agent.name}」状态设为「${label}」？`)) return
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`/api/admin/recruitment/agents/${agent.id}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ state }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    fetchData()
  } catch (e: any) {
    error.value = '操作失败：' + (e.message || '未知错误')
  }
}

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize) })
    if (filterState.value) params.set('state', filterState.value)
    if (filterType.value) params.set('type', filterType.value)
    if (searchKey.value) params.set('keyword', searchKey.value)
    const res = await fetch(`/api/admin/recruitment/agents?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    list.value = json.list
    total.value = json.total
    totalPages.value = Math.ceil(json.total / pageSize)
    stateStats.value = json.stateStats || {}
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

// ─── P5-ADMIN-01: 模型配置函数 ──-

async function openModelConfigPool() {
  showModelPool.value = true
  loadModelConfigList()
}

async function loadModelConfigList() {
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch('/api/admin/recruitment/agent-model-config', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    modelConfigList.value = json.list || []
  } catch (e: any) {
    error.value = '加载模型池失败：' + e.message
  }
}

async function loadModelBindings(agentId: string) {
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`/api/admin/recruitment/agents/${agentId}/model-binding`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    modelBindings.value = json.bindings || []
  } catch (e: any) {
    modelBindings.value = []
  }
}

async function bindModel() {
  if (!bindForm.llmConfigId || !detailItem.value) return
  bindSaving.value = true
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`/api/admin/recruitment/agents/${detailItem.value.id}/model-binding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(bindForm),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    showBindModel.value = false
    loadModelBindings(detailItem.value.id)
  } catch (e: any) {
    error.value = '绑定失败：' + e.message
  } finally {
    bindSaving.value = false
  }
}

async function removeBinding(b: any) {
  if (!confirm(`确认移除模型绑定「${b.provider}/${b.modelName}」？`)) return
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`/api/admin/recruitment/agents/${detailItem.value.id}/model-binding/${b.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    loadModelBindings(detailItem.value.id)
  } catch (e: any) {
    error.value = '移除失败：' + e.message
  }
}

async function toggleBinding(b: any) {
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`/api/admin/recruitment/agents/${detailItem.value.id}/model-binding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        llmConfigId: b.llmConfigId,
        taskType: b.taskType,
        temperature: b.temperature,
        maxTokens: b.maxTokens,
        fallbackEnabled: b.fallbackEnabled,
        failureStrategy: b.failureStrategy,
        enabled: !b.enabled,
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    loadModelBindings(detailItem.value.id)
  } catch (e: any) {
    error.value = '操作失败：' + e.message
  }
}

async function saveConfig() {
  configSaving.value = true
  configTestResult.value = null
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch('/api/admin/recruitment/agent-model-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(configForm),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    configForm.modelName = ''
    configForm.apiKey = ''
    configForm.baseUrl = ''
    configForm.maxTokensPerDay = 0
    loadModelConfigList()
  } catch (e: any) {
    error.value = '保存失败：' + e.message
  } finally {
    configSaving.value = false
  }
}

async function testConfig() {
  configSaving.value = true
  configTestResult.value = null
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const saveRes = await fetch('/api/admin/recruitment/agent-model-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(configForm),
    })
    if (!saveRes.ok) {
      const err = await saveRes.json().catch(() => ({}))
      configTestResult.value = { success: false, error: err.error || `HTTP ${saveRes.status}` }
      return
    }
    const saved = await saveRes.json()
    const testRes = await fetch(`/api/admin/recruitment/agent-model-config/${saved.id}/test`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    configTestResult.value = await testRes.json()
    loadModelConfigList()
  } catch (e: any) {
    configTestResult.value = { success: false, error: e.message }
  } finally {
    configSaving.value = false
  }
}

async function testConfigById(id: string) {
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`/api/admin/recruitment/agent-model-config/${id}/test`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = await res.json()
    alert(result.success ? `✅ 连通 (${result.latencyMs}ms)` : `❌ ${result.error}`)
  } catch (e: any) {
    alert('测试失败：' + e.message)
  }
}

async function toggleConfig(c: any) {
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`/api/admin/recruitment/agent-model-config/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ enabled: !c.enabled }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    loadModelConfigList()
  } catch (e: any) {
    error.value = '操作失败：' + e.message
  }
}

onMounted(() => { fetchData() })
</script>

<style scoped>
/* ── Shared ── */
.rec-btn { display: inline-flex; align-items: center; padding: 8px 16px; border-radius: var(--radius-md, 10px); border: 1px solid var(--color-border-primary, #1E293B); background: var(--color-bg-elevated, #111827); color: var(--color-text-secondary, #94A3B8); font-size: 13px; cursor: pointer; transition: all 0.15s; }
.rec-btn:hover { background: var(--color-bg-hover, #1A2240); color: var(--color-text-primary, #F1F5F9); border-color: var(--color-border-secondary, #334155); }

.rec-search-wrap { position: relative; flex: 1; min-width: 200px; }
.rec-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted, #64748B); }
.rec-input { width: 100%; background: var(--color-bg-secondary, #0D1328); border: 1px solid var(--color-border-primary, #1E293B); border-radius: var(--radius-sm, 6px); font-size: 13px; color: var(--color-text-secondary, #94A3B8); padding: 8px 12px 8px 36px; outline: none; transition: border-color 0.15s; box-sizing: border-box; }
.rec-input:focus { border-color: var(--color-decision, #3B82F6); }
.rec-input::placeholder { color: var(--color-text-disabled, #475569); }

.rec-select { background: var(--color-bg-secondary, #0D1328); border: 1px solid var(--color-border-primary, #1E293B); border-radius: var(--radius-sm, 6px); font-size: 13px; color: var(--color-text-secondary, #94A3B8); padding: 8px 12px; outline: none; cursor: pointer; box-sizing: border-box; }
.rec-select:focus { border-color: var(--color-decision, #3B82F6); }
.rec-select-sm { padding: 4px 8px; font-size: 11px; }

.rec-loading { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 48px; color: var(--color-text-muted, #64748B); font-size: 14px; }
.rec-spinner { width: 20px; height: 20px; border: 2px solid var(--color-border-primary); border-top-color: var(--color-decision); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.rec-error-banner { display: flex; align-items: center; gap: 8px; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.2); border-radius: var(--radius-md); padding: 12px 16px; color: var(--color-danger); font-size: 13px; }
.rec-btn-link { background: none; border: none; color: inherit; text-decoration: underline; cursor: pointer; margin-left: 8px; font-size: inherit; padding: 0; }

.rec-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; color: var(--color-text-muted, #64748B); font-size: 14px; padding: 64px 24px; }
.rec-empty-sm { text-align: center; padding: 16px; color: var(--color-text-muted, #64748B); font-size: 12px; }

/* ── Agent Stats Bar ── */
.rec-agent-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
.rec-agent-stat { background: var(--color-bg-elevated, #111827); border: 1px solid var(--color-border-primary, #1E293B); border-radius: var(--radius-lg, 12px); padding: 16px; text-align: center; }
.rec-agent-stat-val { display: block; font-size: 22px; font-weight: 700; color: var(--color-text-primary, #F1F5F9); line-height: 1.2; }
.rec-agent-stat-lbl { display: block; font-size: 11px; color: var(--color-text-muted, #64748B); margin-top: 4px; }
.rec-stat-running { border-color: rgba(16,185,129,0.3); }
.rec-stat-running .rec-agent-stat-val { color: var(--color-execution, #10B981); }
.rec-stat-paused { border-color: rgba(245,158,11,0.3); }
.rec-stat-paused .rec-agent-stat-val { color: var(--color-warning, #F59E0B); }
.rec-stat-recovering { border-color: rgba(59,130,246,0.3); }
.rec-stat-recovering .rec-agent-stat-val { color: var(--color-decision, #3B82F6); }
.rec-stat-stopped { border-color: rgba(239,68,68,0.3); }
.rec-stat-stopped .rec-agent-stat-val { color: var(--color-danger, #EF4444); }

/* ── Agent Cards Grid ── */
.rec-agent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 16px; }

.rec-agent-card {
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: var(--radius-lg, 12px);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: all 0.15s;
}
.rec-agent-card:hover {
  border-color: var(--color-border-secondary, #334155);
  box-shadow: var(--shadow-md, 0 4px 6px rgba(0,0,0,0.4));
}

/* Card Header */
.rec-agent-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.rec-agent-avatar {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.rec-agent-avatar-lg {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  font-size: 22px;
}
.rec-agent-card-info { flex: 1; min-width: 0; }
.rec-agent-card-name { font-size: 15px; font-weight: 600; color: var(--color-text-primary, #F1F5F9); }
.rec-agent-card-role { font-size: 12px; color: var(--color-text-muted, #64748B); margin-top: 2px; }

/* Status Indicator */
.rec-agent-status-indicator { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.rec-status-dot { width: 8px; height: 8px; border-radius: 50%; }
.dot-running { background: var(--color-execution, #10B981); box-shadow: 0 0 6px rgba(16,185,129,0.5); }
.dot-paused { background: var(--color-warning, #F59E0B); }
.dot-stopped { background: var(--color-text-disabled, #475569); }
.dot-recovering { background: var(--color-decision, #3B82F6); animation: pulse-dot 1.5s infinite; }
.dot-emergency { background: var(--color-danger, #EF4444); animation: pulse-dot 1s infinite; }
@keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

.rec-status-text { font-size: 11px; font-weight: 500; }
.text-running { color: var(--color-execution, #10B981); }
.text-paused { color: var(--color-warning, #F59E0B); }
.text-stopped { color: var(--color-text-disabled, #475569); }
.text-recovering { color: var(--color-decision, #3B82F6); }
.text-emergency { color: var(--color-danger, #EF4444); }

/* Description */
.rec-agent-card-desc { font-size: 12px; color: var(--color-text-secondary, #94A3B8); line-height: 1.5; }

/* Capabilities */
.rec-agent-card-section { display: flex; flex-direction: column; gap: 6px; }
.rec-agent-section-label { font-size: 11px; font-weight: 500; color: var(--color-text-muted, #64748B); text-transform: uppercase; letter-spacing: 0.03em; }
.rec-agent-cap-list { display: flex; flex-wrap: wrap; gap: 6px; }
.rec-agent-cap-item { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--color-text-secondary, #94A3B8); padding: 4px 10px 4px 6px; background: rgba(0,0,0,0.15); border-radius: 6px; }
.rec-agent-cap-item svg { flex-shrink: 0; }

/* Metrics */
.rec-agent-card-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 10px 0; border-top: 1px solid var(--color-border-primary, #1E293B); border-bottom: 1px solid var(--color-border-primary, #1E293B); }
.rec-agent-metric { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.rec-agent-metric-label { font-size: 10px; color: var(--color-text-muted, #64748B); text-transform: uppercase; }
.rec-agent-metric-value { font-size: 13px; font-weight: 600; color: var(--color-text-primary, #F1F5F9); text-align: center; }
.rec-agent-model { font-size: 11px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rec-agent-metric-time { font-size: 11px; color: var(--color-text-secondary, #94A3B8); font-weight: 400; }

/* Card Actions */
.rec-agent-card-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.rec-agent-btn { padding: 6px 14px; border-radius: var(--radius-sm, 6px); font-size: 12px; font-weight: 500; cursor: pointer; border: none; transition: all 0.1s; }
.rec-agent-btn-primary { background: var(--color-decision-glow, rgba(59,130,246,0.15)); color: var(--color-decision, #3B82F6); }
.rec-agent-btn-primary:hover { background: rgba(59,130,246,0.25); }
.rec-agent-btn-warning { background: rgba(245,158,11,0.12); color: var(--color-warning, #F59E0B); }
.rec-agent-btn-warning:hover { background: rgba(245,158,11,0.2); }
.rec-agent-btn-success { background: var(--color-execution-glow, rgba(16,185,129,0.15)); color: var(--color-execution, #10B981); }
.rec-agent-btn-success:hover { background: rgba(16,185,129,0.25); }
.rec-agent-btn-danger { background: rgba(239,68,68,0.12); color: var(--color-danger, #EF4444); }
.rec-agent-btn-danger:hover { background: rgba(239,68,68,0.2); }
.rec-agent-btn-purple { background: var(--color-intelligence-glow, rgba(139,92,246,0.15)); color: var(--color-intelligence, #8B5CF6); }
.rec-agent-btn-purple:hover { background: rgba(139,92,246,0.25); }

/* ── Pagination ── */
.rec-pagination { display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: var(--color-text-muted, #64748B); }
.rec-page-info { font-size: 12px; }
.rec-page-actions { display: flex; gap: 8px; }
.rec-btn-page { padding: 8px 16px; background: var(--color-bg-elevated, #111827); border: 1px solid var(--color-border-primary, #1E293B); border-radius: var(--radius-sm, 6px); color: var(--color-text-secondary, #94A3B8); font-size: 12px; cursor: pointer; }
.rec-btn-page:hover:not(:disabled) { background: var(--color-bg-hover, #1A2240); color: var(--color-text-primary); }
.rec-btn-page:disabled { opacity: 0.3; cursor: not-allowed; }

/* ── Modal ── */
.rec-modal-overlay { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); }
.rec-modal { background: var(--color-bg-secondary, #0D1328); border: 1px solid var(--color-border-primary, #1E293B); border-radius: var(--radius-xl, 16px); width: 100%; max-width: 640px; max-height: 85vh; overflow-y: auto; padding: 24px; margin: 16px; }
.rec-modal-lg { max-width: 720px; }
.rec-modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.rec-modal-title { font-size: 16px; font-weight: 600; color: var(--color-text-primary, #F1F5F9); margin: 0; }
.rec-modal-close { background: none; border: none; color: var(--color-text-muted); cursor: pointer; padding: 4px; border-radius: 4px; }
.rec-modal-close:hover { color: var(--color-text-primary); background: var(--color-bg-hover); }
.rec-modal-body { display: flex; flex-direction: column; gap: 16px; }

/* ── Detail Profile ── */
.rec-detail-profile { display: flex; align-items: center; gap: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--color-border-primary, #1E293B); }
.rec-detail-profile-info { flex: 1; min-width: 0; }
.rec-detail-profile-metrics { text-align: right; flex-shrink: 0; }
.rec-profile-stat { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.rec-profile-stat-val { font-size: 24px; font-weight: 700; color: var(--color-text-primary); line-height: 1; }
.rec-detail-value { font-size: 15px; font-weight: 500; color: var(--color-text-primary, #F1F5F9); }
.rec-detail-meta { font-size: 12px; color: var(--color-text-muted, #64748B); margin-top: 2px; }

/* ── Detail Grid ── */
.rec-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.rec-detail-field { display: flex; flex-direction: column; gap: 4px; }
.rec-detail-label { font-size: 12px; color: var(--color-text-muted, #64748B); }
.rec-detail-section { display: flex; flex-direction: column; gap: 8px; }
.rec-detail-block { color: var(--color-text-secondary, #94A3B8); font-size: 13px; line-height: 1.6; background: rgba(0,0,0,0.2); border-radius: var(--radius-md); padding: 12px; }

.rec-section-header { display: flex; align-items: center; justify-content: space-between; }
.rec-btn-xs { padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; cursor: pointer; border: none; }
.rec-btn-purple { background: var(--color-intelligence-glow); color: var(--color-intelligence); }
.rec-btn-green { background: var(--color-execution-glow); color: var(--color-execution); }
.rec-btn-amber { background: rgba(245,158,11,0.12); color: var(--color-warning); }
.rec-btn-red { background: rgba(239,68,68,0.12); color: var(--color-danger); }
.rec-btn-primary-sm { background: var(--color-decision-glow); color: var(--color-decision); }

.rec-tag-group { display: flex; flex-wrap: wrap; gap: 6px; }
.rec-tag { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; }
.rec-tag-purple { background: var(--color-intelligence-glow, rgba(139,92,246,0.15)); color: var(--color-intelligence, #8B5CF6); }

/* ── Execution Records ── */
.rec-exec-list { display: flex; flex-direction: column; gap: 6px; }
.rec-exec-item { display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.2); border-radius: var(--radius-sm); padding: 10px 14px; }
.rec-exec-info { display: flex; flex-direction: column; gap: 2px; }
.rec-exec-action { font-size: 13px; color: var(--color-text-primary); }
.rec-exec-time { font-size: 11px; color: var(--color-text-muted); }
.rec-exec-status { padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 500; }
.rec-status-green { background: var(--color-execution-glow); color: var(--color-execution); }
.rec-status-red { background: rgba(239,68,68,0.12); color: var(--color-danger); }
.rec-status-amber { background: rgba(245,158,11,0.12); color: var(--color-warning); }

/* ── Model Bindings Form ── */
.rec-bind-form { background: rgba(0,0,0,0.2); border-radius: var(--radius-md); padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.rec-bind-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.rec-bind-grid .col-span-2 { grid-column: span 2; }
.rec-form-label { display: block; font-size: 11px; color: var(--color-text-muted, #64748B); margin-bottom: 4px; }
.rec-bind-options { display: flex; align-items: center; gap: 12px; }
.rec-checkbox { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-text-secondary); cursor: pointer; }
.rec-bind-actions { display: flex; justify-content: flex-end; }
.rec-bind-list { display: flex; flex-direction: column; gap: 8px; }
.rec-bind-item { display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.2); border-radius: var(--radius-sm); padding: 10px 14px; flex-wrap: wrap; gap: 8px; }
.rec-bind-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rec-bind-name { font-size: 12px; color: var(--color-text-secondary); }
.rec-bind-task { font-size: 11px; color: var(--color-text-muted); }
.rec-bind-disabled { padding: 1px 6px; border-radius: 4px; font-size: 9px; background: rgba(239,68,68,0.12); color: var(--color-danger); }
.rec-bind-controls { display: flex; align-items: center; gap: 8px; }
.rec-bind-params { font-size: 10px; color: var(--color-text-muted); }

/* ── Pool Form ── */
.rec-pool-add-form { background: rgba(0,0,0,0.2); border-radius: var(--radius-md); padding: 16px; display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
.rec-pool-form-title { font-size: 13px; font-weight: 500; color: var(--color-text-secondary); }
.rec-pool-actions { display: flex; gap: 8px; justify-content: flex-end; }
.rec-pool-test-result { font-size: 11px; padding: 4px 8px; border-radius: 4px; }
.rec-test-ok { color: var(--color-execution); }
.rec-test-fail { color: var(--color-danger); }

.rec-modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }
.rec-btn-ghost { padding: 8px 16px; border-radius: var(--radius-sm); border: none; background: rgba(255,255,255,0.05); color: var(--color-text-secondary, #94A3B8); font-size: 12px; cursor: pointer; }
.rec-btn-ghost:hover { background: rgba(255,255,255,0.1); color: var(--color-text-primary); }

@media (max-width: 1024px) {
  .rec-agent-grid { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
}
@media (max-width: 768px) {
  .rec-agent-grid { grid-template-columns: 1fr; }
  .rec-agent-stats { grid-template-columns: repeat(3, 1fr); }
  .rec-detail-grid, .rec-bind-grid { grid-template-columns: 1fr; }
  .rec-bind-grid .col-span-2 { grid-column: span 1; }
}
</style>
