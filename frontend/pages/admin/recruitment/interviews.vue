<!-- Admin: 面试管理 -->
<!-- 位置：/admin/recruitment/interviews.vue -->
<!-- 职责：全平台面试列表 — 搜索/筛选/详情/评分 -->
<template>
  <RecruitmentPageShell>
    <template #title>面试管理</template>
    <template #subtitle>全平台 AI 面试 · 状态与评分总览</template>
    <template #actions>
      <button @click="fetchData" class="rec-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:middle"><path d="M21 12a9 9 0 1 1-9-9"/><path d="M21 3v6h-6"/></svg>
        刷新
      </button>
    </template>

    <template #filters>
      <div class="rec-search-wrap">
        <svg class="rec-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input v-model="searchKey" @keyup.enter="page = 1; fetchData()" placeholder="搜索候选人、岗位..." class="rec-input" />
      </div>
      <select v-model="filterStatus" @change="page = 1; fetchData()" class="rec-select">
        <option value="">全部状态</option>
        <option value="preparing">准备中</option>
        <option value="question_ready">题目就绪</option>
        <option value="in_progress">进行中</option>
        <option value="evaluating">评估中</option>
        <option value="completed">已完成</option>
        <option value="decision_made">已决策</option>
      </select>
      <select v-model="filterScore" @change="page = 1; fetchData()" class="rec-select">
        <option value="">全部评分</option>
        <option value="excellent">优秀 (≥80)</option>
        <option value="pass">合格 (60-79)</option>
        <option value="fail">不合格 (&lt;60)</option>
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
              <th class="text-left">候选人</th>
              <th class="text-left">应聘岗位</th>
              <th class="text-center">状态</th>
              <th class="text-center">总分</th>
              <th class="text-center">题目数</th>
              <th class="text-left">面试时间</th>
              <th class="text-left">更新时间</th>
              <th class="text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="list.length === 0">
              <td colspan="8" class="rec-empty-row">
                <div class="rec-empty">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  <div>暂无面试记录</div>
                </div>
              </td>
            </tr>
            <tr v-for="i in list" :key="i.id" class="rec-table-row">
              <td class="rec-td">
                <div class="rec-td-title">{{ i.candidate?.name || '—' }}</div>
                <div v-if="i.candidate?.city" class="rec-td-sub">{{ i.candidate.city }}</div>
              </td>
              <td class="rec-td rec-td-muted">{{ i.job?.title || '—' }}</td>
              <td class="rec-td text-center">
                <RecruitmentBadge :variant="statusBadgeVariant(i.status)">{{ statusLabel(i.status) }}</RecruitmentBadge>
              </td>
              <td class="rec-td text-center">
                <div class="rec-score-bar-wrap">
                  <div class="rec-score-bar-bg">
                    <div class="rec-score-bar-fill" :class="scoreBarClass(i.totalScore)" :style="{ width: (i.totalScore || 0) + '%' }"></div>
                  </div>
                  <span :class="scoreTextClass(i.totalScore)" class="rec-score-num">{{ i.totalScore != null ? i.totalScore : '—' }}</span>
                </div>
              </td>
              <td class="rec-td text-center rec-td-muted">{{ i._count?.questions || 0 }}</td>
              <td class="rec-td rec-td-muted">{{ i.scheduledAt ? formatTime(i.scheduledAt) : '—' }}</td>
              <td class="rec-td rec-td-muted">{{ formatTime(i.updatedAt) }}</td>
              <td class="rec-td text-center">
                <button @click="openDetail(i)" class="rec-btn-sm rec-btn-primary">详情</button>
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
      <div v-if="detailItem" class="rec-modal-overlay" @click.self="detailItem = null">
        <div class="rec-modal">
          <div class="rec-modal-header">
            <h2 class="rec-modal-title">面试详情</h2>
            <button @click="detailItem = null" class="rec-modal-close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <template v-if="detailItem">
            <div class="rec-modal-body">
              <div class="rec-detail-profile">
                <div class="rec-detail-avatar">{{ detailItem.candidate?.name?.charAt(0) || '?' }}</div>
                <div class="rec-detail-profile-info">
                  <div class="rec-detail-value">{{ detailItem.candidate?.name || '未知候选人' }}</div>
                  <div class="rec-detail-meta">应聘：{{ detailItem.job?.title || '未知岗位' }}</div>
                  <div class="rec-detail-meta">
                    <RecruitmentBadge :variant="statusBadgeVariant(detailItem.status)">{{ statusLabel(detailItem.status) }}</RecruitmentBadge>
                  </div>
                </div>
                <div class="rec-detail-profile-score">
                  <div :class="scoreTextClass(detailItem.totalScore)" class="rec-detail-score-num">{{ detailItem.totalScore ?? '—' }}</div>
                  <div class="rec-detail-meta">总分</div>
                </div>
              </div>

              <div class="rec-detail-grid">
                <div class="rec-detail-field">
                  <span class="rec-detail-label">题目数</span>
                  <span class="rec-detail-value">{{ detailItem._count?.questions || 0 }}</span>
                </div>
                <div class="rec-detail-field">
                  <span class="rec-detail-label">面试时间</span>
                  <span class="rec-detail-value">{{ detailItem.scheduledAt ? formatTime(detailItem.scheduledAt) : '—' }}</span>
                </div>
                <div class="rec-detail-field">
                  <span class="rec-detail-label">创建时间</span>
                  <span class="rec-detail-value">{{ formatTime(detailItem.createdAt) }}</span>
                </div>
              </div>

              <!-- Evaluations -->
              <div v-if="detailItem.evaluations?.length" class="rec-detail-section">
                <span class="rec-detail-label">评估维度</span>
                <div class="rec-eval-list">
                  <div v-for="ev in detailItem.evaluations" :key="ev.id" class="rec-eval-item">
                    <div class="rec-eval-info">
                      <div class="rec-eval-dim">{{ ev.dimension || '综合评估' }}</div>
                      <div v-if="ev.feedback" class="rec-eval-feedback">{{ ev.feedback }}</div>
                    </div>
                    <div :class="scoreTextClass(ev.score)" class="rec-eval-score">{{ ev.score ?? '—' }}</div>
                  </div>
                </div>
              </div>

              <div v-if="detailItem.decision" class="rec-detail-section">
                <span class="rec-detail-label">最终决策</span>
                <div class="rec-decision-block">
                  <span class="rec-decision-badge" :class="detailItem.decision === 'pass' ? 'rec-decision-pass' : 'rec-decision-fail'">
                    {{ detailItem.decision === 'pass' ? '通过' : '不通过' }}
                  </span>
                  <span v-if="detailItem.decisionNote" class="rec-decision-note">{{ detailItem.decisionNote }}</span>
                </div>
              </div>
            </div>
          </template>
          <div class="rec-modal-footer">
            <button @click="detailItem = null" class="rec-btn-ghost">关闭</button>
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
const filterScore = ref('')
const searchKey = ref('')
const detailItem = ref<any>(null)

function statusLabel(s: string) {
  return ({ preparing: '准备中', question_ready: '题目就绪', in_progress: '进行中', evaluating: '评估中', completed: '已完成', decision_made: '已决策' } as Record<string, string>)[s] || s
}
function statusBadgeVariant(s: string) {
  return ({ preparing: 'neutral', question_ready: 'info', in_progress: 'success', evaluating: 'default', completed: 'success', decision_made: 'success' } as Record<string, string>)[s] || 'neutral'
}
function scoreTextClass(score: number | null) {
  if (score == null) return 'rec-score-null'
  if (score >= 80) return 'rec-score-high'
  if (score >= 60) return 'rec-score-mid'
  return 'rec-score-low'
}
function scoreBarClass(score: number | null) {
  if (score == null) return 'rec-bar-gray'
  if (score >= 80) return 'rec-bar-green'
  if (score >= 60) return 'rec-bar-yellow'
  return 'rec-bar-red'
}
function formatTime(t: string) {
  return new Date(t).toLocaleDateString('zh-CN')
}

function openDetail(i: any) {
  detailItem.value = i
}

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize) })
    if (filterStatus.value) params.set('status', filterStatus.value)
    if (filterScore.value) params.set('score', filterScore.value)
    if (searchKey.value) params.set('keyword', searchKey.value)
    const res = await fetch(`/api/admin/recruitment/interviews?${params}`, {
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

onMounted(() => { fetchData() })
</script>

<style scoped>
/* ── Reuse shared styles from jobs page ── */
.rec-btn { display: inline-flex; align-items: center; padding: 8px 16px; border-radius: var(--radius-md, 10px); border: 1px solid var(--color-border-primary, #1E293B); background: var(--color-bg-elevated, #111827); color: var(--color-text-secondary, #94A3B8); font-size: 13px; cursor: pointer; transition: all 0.15s; }
.rec-btn:hover { background: var(--color-bg-hover, #1A2240); color: var(--color-text-primary, #F1F5F9); border-color: var(--color-border-secondary, #334155); }

.rec-search-wrap { position: relative; flex: 1; min-width: 200px; }
.rec-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted, #64748B); }
.rec-input { width: 100%; background: var(--color-bg-secondary, #0D1328); border: 1px solid var(--color-border-primary, #1E293B); border-radius: var(--radius-sm, 6px); font-size: 13px; color: var(--color-text-secondary, #94A3B8); padding: 8px 12px 8px 36px; outline: none; transition: border-color 0.15s; }
.rec-input:focus { border-color: var(--color-decision, #3B82F6); }
.rec-input::placeholder { color: var(--color-text-disabled, #475569); }

.rec-select { background: var(--color-bg-secondary, #0D1328); border: 1px solid var(--color-border-primary, #1E293B); border-radius: var(--radius-sm, 6px); font-size: 13px; color: var(--color-text-secondary, #94A3B8); padding: 8px 12px; outline: none; cursor: pointer; }
.rec-select:focus { border-color: var(--color-decision, #3B82F6); }

.rec-loading { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 48px; color: var(--color-text-muted, #64748B); font-size: 14px; }
.rec-spinner { width: 20px; height: 20px; border: 2px solid var(--color-border-primary); border-top-color: var(--color-decision); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.rec-error-banner { display: flex; align-items: center; gap: 8px; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.2); border-radius: var(--radius-md); padding: 12px 16px; color: var(--color-danger); font-size: 13px; }
.rec-btn-link { background: none; border: none; color: inherit; text-decoration: underline; cursor: pointer; margin-left: 8px; font-size: inherit; padding: 0; }

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

.rec-score-high { color: var(--color-execution, #10B981); font-weight: 500; }
.rec-score-mid { color: var(--color-warning, #F59E0B); font-weight: 500; }
.rec-score-low { color: var(--color-danger, #EF4444); font-weight: 500; }
.rec-score-null { color: var(--color-text-muted); font-weight: 500; }
.rec-bar-green { background: var(--color-execution, #10B981); }
.rec-bar-yellow { background: var(--color-warning, #F59E0B); }
.rec-bar-red { background: var(--color-danger, #EF4444); }
.rec-bar-gray { background: var(--color-text-disabled, #475569); }

.rec-score-bar-wrap { display: flex; align-items: center; justify-content: center; gap: 6px; }
.rec-score-bar-bg { width: 32px; height: 6px; border-radius: 3px; background: var(--color-border-primary, #1E293B); overflow: hidden; }
.rec-score-bar-fill { height: 100%; border-radius: 3px; transition: width 0.2s; }
.rec-score-num { font-weight: 500; font-size: 13px; }

.rec-btn-sm { padding: 4px 10px; border-radius: var(--radius-sm, 6px); font-size: 11px; cursor: pointer; border: none; font-weight: 500; }
.rec-btn-primary { background: var(--color-decision-glow, rgba(59,130,246,0.15)); color: var(--color-decision, #3B82F6); }
.rec-btn-primary:hover { background: var(--color-decision-glow); }

.rec-pagination { display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: var(--color-text-muted, #64748B); }
.rec-page-info { font-size: 12px; }
.rec-page-actions { display: flex; gap: 8px; }
.rec-btn-page { padding: 8px 16px; background: var(--color-bg-elevated, #111827); border: 1px solid var(--color-border-primary, #1E293B); border-radius: var(--radius-sm, 6px); color: var(--color-text-secondary, #94A3B8); font-size: 12px; cursor: pointer; }
.rec-btn-page:hover:not(:disabled) { background: var(--color-bg-hover, #1A2240); color: var(--color-text-primary); }
.rec-btn-page:disabled { opacity: 0.3; cursor: not-allowed; }

.rec-empty-row { padding: 48px 0; }
.rec-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--color-text-muted, #64748B); font-size: 14px; padding: 48px; }

/* ── Modal ── */
.rec-modal-overlay { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); }
.rec-modal { background: var(--color-bg-secondary, #0D1328); border: 1px solid var(--color-border-primary, #1E293B); border-radius: var(--radius-xl, 16px); width: 100%; max-width: 640px; max-height: 80vh; overflow-y: auto; padding: 24px; margin: 16px; }
.rec-modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.rec-modal-title { font-size: 16px; font-weight: 600; color: var(--color-text-primary, #F1F5F9); margin: 0; }
.rec-modal-close { background: none; border: none; color: var(--color-text-muted); cursor: pointer; padding: 4px; border-radius: 4px; }
.rec-modal-close:hover { color: var(--color-text-primary); background: var(--color-bg-hover); }

.rec-modal-body { display: flex; flex-direction: column; gap: 16px; }

/* Detail profile header */
.rec-detail-profile { display: flex; align-items: center; gap: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--color-border-primary, #1E293B); }
.rec-detail-avatar { width: 52px; height: 52px; border-radius: 50%; background: var(--color-intelligence-glow, rgba(139,92,246,0.15)); color: var(--color-intelligence); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; flex-shrink: 0; }
.rec-detail-profile-info { flex: 1; min-width: 0; }
.rec-detail-profile-score { text-align: right; flex-shrink: 0; }
.rec-detail-score-num { font-size: 28px; font-weight: 700; line-height: 1; }
.rec-detail-value { font-size: 15px; font-weight: 500; color: var(--color-text-primary, #F1F5F9); }
.rec-detail-meta { font-size: 12px; color: var(--color-text-muted, #64748B); margin-top: 4px; }

.rec-detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.rec-detail-field { display: flex; flex-direction: column; gap: 4px; }
.rec-detail-label { font-size: 12px; color: var(--color-text-muted, #64748B); }
.rec-detail-section { display: flex; flex-direction: column; gap: 8px; }

.rec-eval-list { display: flex; flex-direction: column; gap: 8px; }
.rec-eval-item { display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.2); border-radius: var(--radius-md); padding: 12px; }
.rec-eval-dim { font-size: 13px; color: var(--color-text-primary); font-weight: 500; }
.rec-eval-feedback { font-size: 11px; color: var(--color-text-muted, #64748B); margin-top: 2px; }
.rec-eval-score { font-size: 18px; font-weight: 700; }

.rec-decision-block { background: rgba(0,0,0,0.2); border-radius: var(--radius-md); padding: 12px; }
.rec-decision-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
.rec-decision-pass { background: var(--color-execution-glow, rgba(16,185,129,0.15)); color: var(--color-execution, #10B981); }
.rec-decision-fail { background: rgba(239,68,68,0.12); color: var(--color-danger, #EF4444); }
.rec-decision-note { color: var(--color-text-secondary, #94A3B8); font-size: 12px; margin-left: 8px; }

.rec-modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }
.rec-btn-ghost { padding: 8px 16px; border-radius: var(--radius-sm); border: none; background: rgba(255,255,255,0.05); color: var(--color-text-secondary, #94A3B8); font-size: 12px; cursor: pointer; }
.rec-btn-ghost:hover { background: rgba(255,255,255,0.1); color: var(--color-text-primary); }

@media (max-width: 768px) {
  .rec-detail-grid { grid-template-columns: 1fr; }
  .rec-detail-profile { flex-wrap: wrap; }
}
</style>
