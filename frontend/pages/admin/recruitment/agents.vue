<!-- Admin: AI Agent 管理 -->
<!-- 位置：/admin/recruitment/agents.vue -->
<!-- 职责：企业已部署哪些 AI 员工 — 查看 / 启用 / 停用 / 重新部署 -->
<!--
  Sprint-ADMIN-IA-RECRUITMENT-CLEANUP-01 T02/T03：
  - 重构前：Runtime 监控 + 模型池 + 模型绑定（模型配置，错误方向）
  - 重构后：企业 | Agent | 状态 管理视图。
    ❌ Runtime 日志 / Token 统计 / 成本排行（进数据罗盘）
    ❌ 模型池 / 模型绑定 / API Key（模型由用户模型设置 → Runtime Resolver 映射）
-->
<template>
  <RecruitmentPageShell>
    <template #title>🤖 AI Agent 管理</template>
    <template #subtitle>企业已部署的招聘 AI 员工 · 查看 / 启用 / 停用 / 重新部署</template>
    <template #actions>
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
          placeholder="搜索 AI 员工名称、企业..."
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
        <option value="recruiter">招聘顾问</option>
        <option value="interview">面试官</option>
        <option value="talent_analyst">人才分析师</option>
        <option value="talent_agent">人才专员</option>
        <option value="career_advisor">职业顾问</option>
        <option value="resume_analyzer">简历分析师</option>
        <option value="talent_hunter">人才猎头</option>
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
      <!-- Stats Bar -->
      <div class="rec-agent-stats">
        <div class="rec-agent-stat">
          <span class="rec-agent-stat-val">{{ total }}</span>
          <span class="rec-agent-stat-lbl">已部署员工</span>
        </div>
        <div class="rec-agent-stat rec-stat-running">
          <span class="rec-agent-stat-val">{{ stateStats.ACTIVE || 0 }}</span>
          <span class="rec-agent-stat-lbl">启用中</span>
        </div>
        <div class="rec-agent-stat rec-stat-paused">
          <span class="rec-agent-stat-val">{{ stateStats.PAUSED || 0 }}</span>
          <span class="rec-agent-stat-lbl">已停用</span>
        </div>
        <div class="rec-agent-stat rec-stat-recovering">
          <span class="rec-agent-stat-val">{{ stateStats.RECOVERING || 0 }}</span>
          <span class="rec-agent-stat-lbl">恢复中</span>
        </div>
        <div class="rec-agent-stat rec-stat-stopped">
          <span class="rec-agent-stat-val">{{ (stateStats.EMERGENCY_STOP || 0) + (stateStats.STOPPED || 0) }}</span>
          <span class="rec-agent-stat-lbl">已停止</span>
        </div>
      </div>

      <!-- Agent Cards Grid -->
      <div v-if="list.length === 0" class="rec-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M2 12a10 10 0 0 0 10 10"/><path d="M2 12h20"/></svg>
        <div>暂无已部署 AI 员工</div>
      </div>

      <div v-else class="rec-agent-grid">
        <div v-for="agent in list" :key="agent.id" class="rec-agent-card">
          <!-- Card Header -->
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

          <!-- Enterprise -->
          <div class="rec-agent-enterprise">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M15 9h4a2 2 0 0 1 2 2v10"/></svg>
            <span>{{ agent.enterprise?.name || '—' }}</span>
          </div>

          <!-- Description -->
          <div v-if="agent.description" class="rec-agent-card-desc">{{ agent.description }}</div>

          <!-- Metrics Row -->
          <div class="rec-agent-card-metrics">
            <div class="rec-agent-metric">
              <span class="rec-agent-metric-label">企业 ID</span>
              <span class="rec-agent-metric-value rec-agent-metric-time">{{ agent.tenantId?.slice(0, 8) || '—' }}</span>
            </div>
            <div class="rec-agent-metric">
              <span class="rec-agent-metric-label">最近更新</span>
              <span class="rec-agent-metric-value rec-agent-metric-time">{{ formatRelativeTime(agent.updatedAt) }}</span>
            </div>
            <div class="rec-agent-metric">
              <span class="rec-agent-metric-label">最后恢复</span>
              <span class="rec-agent-metric-value rec-agent-metric-time">{{ agent.lastRecoveredAt ? formatRelativeTime(agent.lastRecoveredAt) : '—' }}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="rec-agent-card-actions">
            <button @click="openDetail(agent)" class="rec-agent-btn rec-agent-btn-primary">查看详情</button>
            <button v-if="agent.lifecycleState === 'ACTIVE'" @click="updateAgentState(agent, 'PAUSED')" class="rec-agent-btn rec-agent-btn-warning">停用</button>
            <button v-else-if="agent.lifecycleState === 'PAUSED'" @click="updateAgentState(agent, 'ACTIVE')" class="rec-agent-btn rec-agent-btn-success">启用</button>
            <button v-else @click="updateAgentState(agent, 'ACTIVE')" class="rec-agent-btn rec-agent-btn-success">重新部署</button>
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
              </div>

              <!-- Info Grid -->
              <div class="rec-detail-grid">
                <div class="rec-detail-field"><span class="rec-detail-label">所属企业</span><span class="rec-detail-value">{{ detailItem.enterprise?.name || '—' }}</span></div>
                <div class="rec-detail-field"><span class="rec-detail-label">企业 ID</span><span class="rec-detail-value rec-detail-mono">{{ detailItem.tenantId || '—' }}</span></div>
                <div class="rec-detail-field"><span class="rec-detail-label">最后恢复</span><span class="rec-detail-value">{{ detailItem.lastRecoveredAt ? formatTime(detailItem.lastRecoveredAt) : '—' }}</span></div>
                <div class="rec-detail-field"><span class="rec-detail-label">最近更新</span><span class="rec-detail-value">{{ formatRelativeTime(detailItem.updatedAt) }}</span></div>
              </div>

              <!-- Description -->
              <div v-if="detailItem.description" class="rec-detail-section">
                <span class="rec-detail-label">描述</span>
                <div class="rec-detail-block">{{ detailItem.description }}</div>
              </div>

              <!-- Model note -->
              <div class="rec-model-note">
                💡 该员工使用的大模型由企业用户模型设置映射（UserModelConfigV2 → Runtime Resolver），不在后台配置。
              </div>
            </div>
          </template>
          <div class="rec-modal-footer">
            <button v-if="detailItem?.lifecycleState === 'ACTIVE'" @click="updateAgentState(detailItem, 'PAUSED'); detailItem = null" class="rec-agent-btn rec-agent-btn-warning">停用</button>
            <button v-else @click="updateAgentState(detailItem, 'ACTIVE'); detailItem = null" class="rec-agent-btn rec-agent-btn-success">
              {{ detailItem?.lifecycleState === 'PAUSED' ? '启用' : '重新部署' }}
            </button>
            <button @click="detailItem = null" class="rec-btn-ghost">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>
  </RecruitmentPageShell>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getAuthToken } from '~/utils/auth/token'
import RecruitmentPageShell from '~/components/enterprise/recruitment/ui/RecruitmentPageShell.vue'
import RecruitmentBadge from '~/components/enterprise/recruitment/ui/RecruitmentBadge.vue'
definePageMeta({ layout: 'admin-aigc' })

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

function typeLabel(t: string) {
  return ({ recruiter: '招聘顾问', marketing: '营销专员', interview: '面试官', career_advisor: '职业顾问', resume_analyzer: '简历分析师', talent_hunter: '人才猎头', talent_analyst: '人才分析师', talent_agent: '人才专员' } as Record<string, string>)[t] || t
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
    talent_analyst: 'linear-gradient(135deg, #EC4899, #DB2777)',
    talent_agent: 'linear-gradient(135deg, #6366F1, #4F46E5)',
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
}

async function updateAgentState(agent: any, state: string) {
  const label = stateLabel(state)
  const action = state === 'ACTIVE' ? (agent.lifecycleState === 'PAUSED' ? '启用' : '重新部署') : '停用'
  if (!confirm(`确认${action}「${agent.name}」？`)) return
  try {
    const token = getAuthToken()
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
    const token = getAuthToken()
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

.rec-loading { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 48px; color: var(--color-text-muted, #64748B); font-size: 14px; }
.rec-spinner { width: 20px; height: 20px; border: 2px solid var(--color-border-primary); border-top-color: var(--color-decision); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.rec-error-banner { display: flex; align-items: center; gap: 8px; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.2); border-radius: var(--radius-md); padding: 12px 16px; color: var(--color-danger); font-size: 13px; }
.rec-btn-link { background: none; border: none; color: inherit; text-decoration: underline; cursor: pointer; margin-left: 8px; font-size: inherit; padding: 0; }

.rec-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; color: var(--color-text-muted, #64748B); font-size: 14px; padding: 64px 24px; }

/* ── Stats Bar ── */
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

/* ── Cards ── */
.rec-agent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 16px; }
.rec-agent-card { background: var(--color-bg-elevated, #111827); border: 1px solid var(--color-border-primary, #1E293B); border-radius: var(--radius-lg, 12px); padding: 20px; display: flex; flex-direction: column; gap: 14px; transition: all 0.15s; }
.rec-agent-card:hover { border-color: var(--color-border-secondary, #334155); box-shadow: var(--shadow-md, 0 4px 6px rgba(0,0,0,0.4)); }

.rec-agent-card-header { display: flex; align-items: center; gap: 12px; }
.rec-agent-avatar { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: #fff; flex-shrink: 0; }
.rec-agent-avatar-lg { width: 56px; height: 56px; border-radius: 14px; font-size: 22px; }
.rec-agent-card-info { flex: 1; min-width: 0; }
.rec-agent-card-name { font-size: 15px; font-weight: 600; color: var(--color-text-primary, #F1F5F9); }
.rec-agent-card-role { font-size: 12px; color: var(--color-text-muted, #64748B); margin-top: 2px; }

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

.rec-agent-enterprise { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-text-secondary, #94A3B8); }
.rec-agent-enterprise svg { flex-shrink: 0; color: var(--color-decision); }

.rec-agent-card-desc { font-size: 12px; color: var(--color-text-secondary, #94A3B8); line-height: 1.5; }

.rec-agent-card-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 10px 0; border-top: 1px solid var(--color-border-primary, #1E293B); border-bottom: 1px solid var(--color-border-primary, #1E293B); }
.rec-agent-metric { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.rec-agent-metric-label { font-size: 10px; color: var(--color-text-muted, #64748B); text-transform: uppercase; }
.rec-agent-metric-value { font-size: 13px; font-weight: 600; color: var(--color-text-primary, #F1F5F9); text-align: center; }
.rec-agent-metric-time { font-size: 11px; color: var(--color-text-secondary, #94A3B8); font-weight: 400; }

.rec-agent-card-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.rec-agent-btn { padding: 6px 14px; border-radius: var(--radius-sm, 6px); font-size: 12px; font-weight: 500; cursor: pointer; border: none; transition: all 0.1s; }
.rec-agent-btn-primary { background: var(--color-decision-glow, rgba(59,130,246,0.15)); color: var(--color-decision, #3B82F6); }
.rec-agent-btn-primary:hover { background: rgba(59,130,246,0.25); }
.rec-agent-btn-warning { background: rgba(245,158,11,0.12); color: var(--color-warning, #F59E0B); }
.rec-agent-btn-warning:hover { background: rgba(245,158,11,0.2); }
.rec-agent-btn-success { background: var(--color-execution-glow, rgba(16,185,129,0.15)); color: var(--color-execution, #10B981); }
.rec-agent-btn-success:hover { background: rgba(16,185,129,0.25); }

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

.rec-detail-profile { display: flex; align-items: center; gap: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--color-border-primary, #1E293B); }
.rec-detail-profile-info { flex: 1; min-width: 0; }
.rec-detail-value { font-size: 15px; font-weight: 500; color: var(--color-text-primary, #F1F5F9); }
.rec-detail-meta { font-size: 12px; color: var(--color-text-muted, #64748B); margin-top: 2px; }
.rec-detail-mono { font-family: monospace; font-size: 12px; }

.rec-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.rec-detail-field { display: flex; flex-direction: column; gap: 4px; }
.rec-detail-label { font-size: 12px; color: var(--color-text-muted, #64748B); }
.rec-detail-section { display: flex; flex-direction: column; gap: 8px; }
.rec-detail-block { color: var(--color-text-secondary, #94A3B8); font-size: 13px; line-height: 1.6; background: rgba(0,0,0,0.2); border-radius: var(--radius-md); padding: 12px; }

.rec-model-note { font-size: 12px; color: #94A3B8; background: rgba(56,189,248,0.06); border: 1px solid rgba(56,189,248,0.15); border-radius: var(--radius-md); padding: 12px; line-height: 1.6; }

.rec-modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }
.rec-btn-ghost { padding: 8px 16px; border-radius: var(--radius-sm); border: none; background: rgba(255,255,255,0.05); color: var(--color-text-secondary, #94A3B8); font-size: 12px; cursor: pointer; }
.rec-btn-ghost:hover { background: rgba(255,255,255,0.1); color: var(--color-text-primary); }

@media (max-width: 1024px) {
  .rec-agent-grid { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
}
@media (max-width: 768px) {
  .rec-agent-grid { grid-template-columns: 1fr; }
  .rec-agent-stats { grid-template-columns: repeat(3, 1fr); }
  .rec-detail-grid { grid-template-columns: 1fr; }
}
</style>
