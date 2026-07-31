<!-- Admin: 岗位池管理 -->
<!-- 位置：/admin/recruitment/jobs.vue -->
<!-- 职责：全平台岗位列表 — 搜索/筛选/详情/状态操作 -->
<template>
  <RecruitmentPageShell>
    <template #title>岗位池</template>
    <template #subtitle>平台岗位池 · 各企业岗位状态与 AI 匹配覆盖率</template>
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
          placeholder="搜索岗位名称、部门、地点..."
          class="rec-input"
        />
      </div>
      <select v-model="filterStatus" @change="page = 1; fetchData()" class="rec-select">
        <option value="">全部状态</option>
        <option value="published">已发布</option>
        <option value="draft">草稿</option>
        <option value="paused">已暂停</option>
        <option value="closed">已关闭</option>
      </select>
      <select v-model="filterEnterprise" @change="page = 1; fetchData()" class="rec-select">
        <option value="">全部企业</option>
        <option v-for="ent in enterprises" :key="ent.id" :value="ent.id">{{ ent.name }}</option>
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
      <!-- Table -->
      <div class="rec-table-wrap">
        <table class="rec-table">
          <thead>
            <tr>
              <th class="text-left">岗位名称</th>
              <th class="text-left">所属企业</th>
              <th class="text-left">部门</th>
              <th class="text-left">地点</th>
              <th class="text-center">状态</th>
              <th class="text-center">候选人</th>
              <th class="text-center">匹配率</th>
              <th class="text-left">创建时间</th>
              <th class="text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="list.length === 0">
              <td colspan="9" class="rec-empty-row">
                <div class="rec-empty">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                  <div>暂无岗位数据</div>
                </div>
              </td>
            </tr>
            <tr v-for="job in list" :key="job.id" class="rec-table-row">
              <td class="rec-td">
                <div class="rec-td-title">{{ job.title }}</div>
                <div v-if="job.requiredSkills?.length" class="rec-td-sub">
                  {{ job.requiredSkills.slice(0, 3).join(', ') }}
                </div>
              </td>
              <td class="rec-td rec-td-muted">{{ job.enterprise?.name || '—' }}</td>
              <td class="rec-td rec-td-muted">{{ job.department || '—' }}</td>
              <td class="rec-td rec-td-muted">{{ job.location || '—' }}</td>
              <td class="rec-td text-center">
                <RecruitmentBadge :variant="statusBadgeVariant(job.status)">{{ statusLabel(job.status) }}</RecruitmentBadge>
              </td>
              <td class="rec-td text-center rec-td-muted">{{ job._count?.candidates || 0 }}</td>
              <td class="rec-td text-center">
                <span :class="scoreClass(job.matchRate)">{{ job.matchRate || 0 }}%</span>
              </td>
              <td class="rec-td rec-td-muted">{{ formatTime(job.createdAt) }}</td>
              <td class="rec-td text-center">
                <div class="rec-action-group">
                  <button @click="openDetail(job)" class="rec-btn-sm rec-btn-primary" title="查看详情">详情</button>
                  <button v-if="job.status === 'published'" @click="updateStatus(job, 'paused')" class="rec-btn-sm rec-btn-warning" title="暂停">暂停</button>
                  <button v-if="job.status === 'paused'" @click="updateStatus(job, 'published')" class="rec-btn-sm rec-btn-success" title="恢复">恢复</button>
                  <button v-if="job.status !== 'closed'" @click="updateStatus(job, 'closed')" class="rec-btn-sm rec-btn-danger" title="关闭">关闭</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
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
      <div v-if="detailJob" class="rec-modal-overlay" @click.self="detailJob = null">
        <div class="rec-modal">
          <div class="rec-modal-header">
            <h2 class="rec-modal-title">岗位详情</h2>
            <button @click="detailJob = null" class="rec-modal-close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <template v-if="detailJob">
            <div class="rec-modal-body">
              <div class="rec-detail-grid">
                <div class="rec-detail-field">
                  <span class="rec-detail-label">岗位名称</span>
                  <span class="rec-detail-value">{{ detailJob.title }}</span>
                </div>
                <div class="rec-detail-field">
                  <span class="rec-detail-label">所属企业</span>
                  <span class="rec-detail-value">{{ detailJob.enterprise?.name || '—' }}</span>
                </div>
                <div class="rec-detail-field">
                  <span class="rec-detail-label">部门</span>
                  <span class="rec-detail-value">{{ detailJob.department || '—' }}</span>
                </div>
                <div class="rec-detail-field">
                  <span class="rec-detail-label">工作地点</span>
                  <span class="rec-detail-value">{{ detailJob.location || '—' }}</span>
                </div>
                <div class="rec-detail-field">
                  <span class="rec-detail-label">状态</span>
                  <RecruitmentBadge :variant="statusBadgeVariant(detailJob.status)">{{ statusLabel(detailJob.status) }}</RecruitmentBadge>
                </div>
                <div class="rec-detail-field">
                  <span class="rec-detail-label">匹配率</span>
                  <span :class="scoreClass(detailJob.matchRate)">{{ detailJob.matchRate || 0 }}%</span>
                </div>
              </div>
              <div v-if="detailJob.description" class="rec-detail-section">
                <span class="rec-detail-label">岗位描述</span>
                <div class="rec-detail-block">{{ detailJob.description }}</div>
              </div>
              <div v-if="detailJob.requiredSkills?.length" class="rec-detail-section">
                <span class="rec-detail-label">技能要求</span>
                <div class="rec-tag-group">
                  <span v-for="s in detailJob.requiredSkills" :key="s" class="rec-tag rec-tag-blue">{{ s }}</span>
                </div>
              </div>
              <div class="rec-detail-stats">
                <div class="rec-detail-field">
                  <span class="rec-detail-label">候选人</span>
                  <span class="rec-detail-value">{{ detailJob._count?.candidates || 0 }}</span>
                </div>
                <div class="rec-detail-field">
                  <span class="rec-detail-label">面试数</span>
                  <span class="rec-detail-value">{{ detailJob._count?.interviews || 0 }}</span>
                </div>
                <div class="rec-detail-field">
                  <span class="rec-detail-label">创建时间</span>
                  <span class="rec-detail-value">{{ formatTime(detailJob.createdAt) }}</span>
                </div>
              </div>
            </div>
          </template>
          <div class="rec-modal-footer">
            <button v-if="detailJob?.status === 'published'" @click="updateStatus(detailJob, 'paused'); detailJob = null" class="rec-btn-sm rec-btn-warning">暂停招聘</button>
            <button v-if="detailJob?.status === 'paused'" @click="updateStatus(detailJob, 'published'); detailJob = null" class="rec-btn-sm rec-btn-success">恢复招聘</button>
            <button @click="detailJob = null" class="rec-btn-ghost">关闭</button>
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
import { ref, onMounted } from 'vue'

const loading = ref(false)
const error = ref('')
const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const totalPages = ref(0)
const filterStatus = ref('')
const filterEnterprise = ref('')
const searchKey = ref('')
const enterprises = ref<Array<{ id: string; name: string }>>([])
const detailJob = ref<any>(null)

function statusLabel(status: string) {
  const map: Record<string, string> = { published: '已发布', draft: '草稿', paused: '已暂停', closed: '已关闭' }
  return map[status] || status
}

function statusBadgeVariant(status: string) {
  const map: Record<string, string> = { published: 'success', draft: 'neutral', paused: 'warning', closed: 'danger' }
  return map[status] || 'neutral'
}

function scoreClass(rate: number) {
  if (rate >= 70) return 'rec-score-high'
  if (rate >= 40) return 'rec-score-mid'
  return 'rec-score-low'
}

function formatTime(t: string) {
  return new Date(t).toLocaleDateString('zh-CN')
}

async function fetchEnterprises() {
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch('/api/admin/recruitment/enterprises?pageSize=100', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const json = await res.json()
      enterprises.value = json.list || []
    }
  } catch { /* ignore */ }
}

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize) })
    if (filterStatus.value) params.set('status', filterStatus.value)
    if (filterEnterprise.value) params.set('enterpriseId', filterEnterprise.value)
    if (searchKey.value) params.set('keyword', searchKey.value)
    const res = await fetch(`/api/admin/recruitment/jobs?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    list.value = json.list
    total.value = json.total
    totalPages.value = Math.ceil(json.total / pageSize)
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function openDetail(job: any) {
  detailJob.value = job
}

async function updateStatus(job: any, status: string) {
  if (!confirm(`确认将此岗位「${statusLabel(status)}」？`)) return
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`/api/admin/recruitment/jobs/${job.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    fetchData()
  } catch (e: any) {
    error.value = '操作失败：' + (e.message || '未知错误')
  }
}

onMounted(() => {
  fetchEnterprises()
  fetchData()
})
</script>

<style scoped>
/* ── Shared Button ── */
.rec-btn {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: var(--radius-md, 10px);
  border: 1px solid var(--color-border-primary, #1E293B);
  background: var(--color-bg-elevated, #111827);
  color: var(--color-text-secondary, #94A3B8);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.rec-btn:hover { background: var(--color-bg-hover, #1A2240); color: var(--color-text-primary, #F1F5F9); border-color: var(--color-border-secondary, #334155); }

/* ── Filter Inputs ── */
.rec-search-wrap { position: relative; flex: 1; min-width: 200px; }
.rec-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted, #64748B); }
.rec-input {
  width: 100%;
  background: var(--color-bg-secondary, #0D1328);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: var(--radius-sm, 6px);
  font-size: 13px;
  color: var(--color-text-secondary, #94A3B8);
  padding: 8px 12px 8px 36px;
  outline: none;
  transition: border-color 0.15s;
}
.rec-input:focus { border-color: var(--color-decision, #3B82F6); }
.rec-input::placeholder { color: var(--color-text-disabled, #475569); }

.rec-select {
  background: var(--color-bg-secondary, #0D1328);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: var(--radius-sm, 6px);
  font-size: 13px;
  color: var(--color-text-secondary, #94A3B8);
  padding: 8px 12px;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s;
}
.rec-select:focus { border-color: var(--color-decision, #3B82F6); }

/* ── Loading ── */
.rec-loading { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 48px; color: var(--color-text-muted, #64748B); font-size: 14px; }
.rec-spinner { width: 20px; height: 20px; border: 2px solid var(--color-border-primary); border-top-color: var(--color-decision); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Error ── */
.rec-error-banner { display: flex; align-items: center; gap: 8px; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.2); border-radius: var(--radius-md); padding: 12px 16px; color: var(--color-danger); font-size: 13px; }
.rec-btn-link { background: none; border: none; color: inherit; text-decoration: underline; cursor: pointer; margin-left: 8px; font-size: inherit; padding: 0; }

/* ── Table ── */
.rec-table-wrap { overflow-x: auto; border: 1px solid var(--color-border-primary, #1E293B); border-radius: var(--radius-lg, 12px); }
.rec-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.rec-table thead { background: var(--color-bg-secondary, #0D1328); }
.rec-table th { padding: 12px 16px; font-weight: 500; color: var(--color-text-muted, #64748B); font-size: 12px; white-space: nowrap; }
.rec-table th.text-center { text-align: center; }
.rec-table th.text-left { text-align: left; }
.rec-table-row { border-top: 1px solid var(--color-border-primary, #1E293B); transition: background 0.1s; }
.rec-table-row:hover { background: var(--color-bg-hover, #1A2240); }
.rec-td { padding: 12px 16px; vertical-align: middle; }
.rec-td-title { font-weight: 500; color: var(--color-text-primary, #F1F5F9); }
.rec-td-sub { color: var(--color-text-muted, #64748B); font-size: 11px; margin-top: 2px; }
.rec-td-muted { color: var(--color-text-secondary, #94A3B8); }
.text-center { text-align: center; }
.text-left { text-align: left; }

/* ── Score colors ── */
.rec-score-high { color: var(--color-execution, #10B981); font-weight: 500; }
.rec-score-mid { color: var(--color-warning, #F59E0B); font-weight: 500; }
.rec-score-low { color: var(--color-danger, #EF4444); font-weight: 500; }

/* ── Action buttons ── */
.rec-action-group { display: flex; justify-content: center; gap: 4px; }
.rec-btn-sm { padding: 4px 10px; border-radius: var(--radius-sm, 6px); font-size: 11px; cursor: pointer; border: none; transition: all 0.1s; font-weight: 500; }
.rec-btn-primary { background: var(--color-decision-glow, rgba(59,130,246,0.15)); color: var(--color-decision, #3B82F6); }
.rec-btn-primary:hover { background: var(--color-decision-glow); }
.rec-btn-warning { background: rgba(245,158,11,0.12); color: var(--color-warning, #F59E0B); }
.rec-btn-warning:hover { background: rgba(245,158,11,0.2); }
.rec-btn-success { background: var(--color-execution-glow, rgba(16,185,129,0.15)); color: var(--color-execution, #10B981); }
.rec-btn-success:hover { background: var(--color-execution-glow); }
.rec-btn-danger { background: rgba(239,68,68,0.12); color: var(--color-danger, #EF4444); }
.rec-btn-danger:hover { background: rgba(239,68,68,0.2); }

/* ── Pagination ── */
.rec-pagination { display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: var(--color-text-muted, #64748B); }
.rec-page-info { font-size: 12px; }
.rec-page-actions { display: flex; gap: 8px; }
.rec-btn-page { padding: 8px 16px; background: var(--color-bg-elevated, #111827); border: 1px solid var(--color-border-primary, #1E293B); border-radius: var(--radius-sm, 6px); color: var(--color-text-secondary, #94A3B8); font-size: 12px; cursor: pointer; transition: all 0.1s; }
.rec-btn-page:hover:not(:disabled) { background: var(--color-bg-hover, #1A2240); color: var(--color-text-primary); }
.rec-btn-page:disabled { opacity: 0.3; cursor: not-allowed; }

/* ── Empty state ── */
.rec-empty-row { padding: 48px 0; }
.rec-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--color-text-muted, #64748B); font-size: 14px; padding: 48px; }

/* ── Modal ── */
.rec-modal-overlay { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); }
.rec-modal { background: var(--color-bg-secondary, #0D1328); border: 1px solid var(--color-border-primary, #1E293B); border-radius: var(--radius-xl, 16px); width: 100%; max-width: 640px; max-height: 80vh; overflow-y: auto; padding: 24px; margin: 16px; }
.rec-modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.rec-modal-title { font-size: 16px; font-weight: 600; color: var(--color-text-primary, #F1F5F9); margin: 0; }
.rec-modal-close { background: none; border: none; color: var(--color-text-muted, #64748B); cursor: pointer; padding: 4px; border-radius: 4px; }
.rec-modal-close:hover { color: var(--color-text-primary); background: var(--color-bg-hover); }

.rec-modal-body { display: flex; flex-direction: column; gap: 16px; }
.rec-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.rec-detail-field { display: flex; flex-direction: column; gap: 4px; }
.rec-detail-label { font-size: 12px; color: var(--color-text-muted, #64748B); }
.rec-detail-value { font-size: 14px; color: var(--color-text-primary, #F1F5F9); font-weight: 500; }

.rec-detail-section { display: flex; flex-direction: column; gap: 8px; }
.rec-detail-block { color: var(--color-text-secondary, #94A3B8); font-size: 13px; line-height: 1.6; background: rgba(0,0,0,0.2); border-radius: var(--radius-md); padding: 12px; }

.rec-tag-group { display: flex; flex-wrap: wrap; gap: 6px; }
.rec-tag { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; }
.rec-tag-blue { background: var(--color-decision-glow, rgba(59,130,246,0.15)); color: var(--color-decision, #3B82F6); }

.rec-detail-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding-top: 12px; border-top: 1px solid var(--color-border-primary, #1E293B); }

.rec-modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }
.rec-btn-ghost { padding: 8px 16px; border-radius: var(--radius-sm); border: none; background: rgba(255,255,255,0.05); color: var(--color-text-secondary, #94A3B8); font-size: 12px; cursor: pointer; }
.rec-btn-ghost:hover { background: rgba(255,255,255,0.1); color: var(--color-text-primary); }

@media (max-width: 768px) {
  .rec-detail-grid { grid-template-columns: 1fr; }
  .rec-detail-stats { grid-template-columns: 1fr; }
}
</style>
