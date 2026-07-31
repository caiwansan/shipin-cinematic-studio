<!-- ⛔ DEPRECATED · 已退出后台导航（SPRINT-ADMIN-IA-RECRUITMENT-CLEANUP-01）· 页面保留仅供 URL 直链/归档，业务数据归企业招聘工作台，运营数据归数据罗盘 -->
<!-- Admin: 候选人池管理 -->
<!-- 位置：/admin/recruitment/candidates.vue -->
<!-- 职责：全平台候选人列表 — 搜索/筛选/详情/只读管理 + 运营统计面板（P5-ADMIN-02） -->
<template>
  <RecruitmentPageShell>
    <template #title>候选人池</template>
    <template #subtitle>平台候选人池（只读）· 保持平台中立</template>
    <template #actions>
      <button @click="fetchData" class="rec-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:middle"><path d="M21 12a9 9 0 1 1-9-9"/><path d="M21 3v6h-6"/></svg>
        刷新
      </button>
    </template>

    <template #stats>
      <!-- Stats panel -->
      <div class="rec-stats-grid">
        <div class="rec-stat-item">
          <span class="rec-stat-val" :style="{ color: 'var(--color-text-primary)' }">{{ stats.total ?? '—' }}</span>
          <span class="rec-stat-label">候选人总数</span>
        </div>
        <div class="rec-stat-item" style="border-color: rgba(139,92,246,0.3);">
          <span class="rec-stat-val" :style="{ color: 'var(--color-intelligence)' }">{{ stats.withProfile ?? '—' }}</span>
          <span class="rec-stat-label">已建 Talent Profile</span>
        </div>
        <div class="rec-stat-item" style="border-color: rgba(16,185,129,0.3);">
          <span class="rec-stat-val" :style="{ color: 'var(--color-execution)' }">{{ stats.withMatches ?? '—' }}</span>
          <span class="rec-stat-label">有匹配记录</span>
        </div>
        <div class="rec-stat-item" style="border-color: rgba(59,130,246,0.3);">
          <span class="rec-stat-val" :style="{ color: 'var(--color-decision)' }">{{ total }}</span>
          <span class="rec-stat-label">当前筛选结果</span>
        </div>
      </div>

      <!-- Top Skills -->
      <div v-if="stats.topSkills?.length" class="rec-skills-bar">
        <div class="rec-skills-label">热门技能</div>
        <div class="rec-tag-group">
          <span v-for="s in stats.topSkills" :key="s.skill" class="rec-tag rec-tag-blue">
            {{ s.skill }} <span class="rec-tag-count">×{{ s.count }}</span>
          </span>
        </div>
      </div>
    </template>

    <template #filters>
      <div class="rec-search-wrap">
        <svg class="rec-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input v-model="searchKey" @keyup.enter="page = 1; fetchData()" placeholder="搜索姓名、城市、技能..." class="rec-input" />
      </div>
      <select v-model="filterQuality" @change="page = 1; fetchData()" class="rec-select">
        <option value="">全部质量</option>
        <option value="high">高质量 (≥70)</option>
        <option value="medium">中等 (50-69)</option>
        <option value="low">待提升 (&lt;50)</option>
      </select>
      <select v-model="sortBy" @change="page = 1; fetchData()" class="rec-select">
        <option value="createdAt">最新创建</option>
        <option value="qualityScore">质量分排序</option>
        <option value="experienceYears">经验排序</option>
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
              <th class="text-left">姓名</th>
              <th class="text-left">城市</th>
              <th class="text-center">经验</th>
              <th class="text-left">期望薪资</th>
              <th class="text-center">质量分</th>
              <th class="text-center">匹配</th>
              <th class="text-left">技能标签</th>
              <th class="text-left">创建时间</th>
              <th class="text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="list.length === 0">
              <td colspan="9" class="rec-empty-row">
                <div class="rec-empty">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  <div>暂无候选人</div>
                </div>
              </td>
            </tr>
            <tr v-for="c in list" :key="c.id" class="rec-table-row">
              <td class="rec-td">
                <div class="rec-td-title">{{ c.name || '—' }}</div>
                <div v-if="c.email" class="rec-td-sub">{{ c.email }}</div>
              </td>
              <td class="rec-td rec-td-muted">{{ c.city || '—' }}</td>
              <td class="rec-td text-center rec-td-muted">{{ c.experienceYears != null ? c.experienceYears + ' 年' : '—' }}</td>
              <td class="rec-td rec-td-muted">{{ c.expectedSalary || '—' }}</td>
              <td class="rec-td text-center">
                <div class="rec-score-bar-wrap">
                  <div class="rec-score-bar-bg">
                    <div class="rec-score-bar-fill" :class="qualityBarClass(c.qualityScore)" :style="{ width: (c.qualityScore || 0) + '%' }"></div>
                  </div>
                  <span :class="qualityTextClass(c.qualityScore)" class="rec-score-num">{{ c.qualityScore != null ? c.qualityScore : '—' }}</span>
                </div>
              </td>
              <td class="rec-td text-center">
                <span v-if="c.matchCount > 0" class="rec-match-badge">{{ c.matchCount }} 匹配</span>
                <span v-else class="rec-td-muted">—</span>
              </td>
              <td class="rec-td">
                <div class="rec-tag-group">
                  <span v-for="s in (c.skills || []).slice(0, 3)" :key="s" class="rec-tag rec-tag-blue">{{ s }}</span>
                  <span v-if="(c.skills || []).length > 3" class="rec-tag-more">+{{ c.skills.length - 3 }}</span>
                </div>
              </td>
              <td class="rec-td rec-td-muted">{{ formatTime(c.createdAt) }}</td>
              <td class="rec-td text-center">
                <button @click="navigateTo(`/admin/recruitment/candidates/${c.id}`)" class="rec-btn-sm rec-btn-primary">详情</button>
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
            <h2 class="rec-modal-title">候选人详情</h2>
            <button @click="detailItem = null" class="rec-modal-close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <div v-if="detailLoading" class="rec-loading" style="padding: 32px;">
            <div class="rec-spinner"></div>
            <span>加载详情...</span>
          </div>

          <template v-else-if="detailItem">
            <div class="rec-modal-body">
              <!-- Profile header -->
              <div class="rec-detail-profile">
                <div class="rec-detail-avatar" :style="{ background: 'var(--color-decision-glow)', color: 'var(--color-decision)' }">{{ detailItem.name?.charAt(0) || '?' }}</div>
                <div class="rec-detail-profile-info">
                  <div class="rec-detail-value">{{ detailItem.name || '—' }}</div>
                  <div class="rec-detail-meta">{{ detailItem.city || '未知城市' }} · {{ detailItem.experienceYears != null ? detailItem.experienceYears + ' 年经验' : '经验未知' }}</div>
                  <div v-if="detailItem.completeness != null" class="rec-detail-meta">
                    档案完整度
                    <span class="rec-completeness" :class="detailItem.completeness >= 80 ? 'rec-score-high' : detailItem.completeness >= 50 ? 'rec-score-mid' : 'rec-score-low'">{{ detailItem.completeness }}%</span>
                  </div>
                </div>
                <div class="rec-detail-profile-score">
                  <div :class="qualityTextClass(detailItem.qualityScore)" class="rec-detail-score-num">{{ detailItem.qualityScore ?? '—' }}</div>
                  <div class="rec-detail-meta">质量分</div>
                </div>
              </div>

              <!-- Basic info -->
              <div class="rec-detail-grid">
                <div class="rec-detail-field"><span class="rec-detail-label">邮箱</span><span class="rec-detail-value">{{ detailItem.email || '—' }}</span></div>
                <div class="rec-detail-field"><span class="rec-detail-label">电话</span><span class="rec-detail-value">{{ detailItem.phone || '—' }}</span></div>
                <div class="rec-detail-field"><span class="rec-detail-label">期望薪资</span><span class="rec-detail-value">{{ detailItem.expectedSalary || detailItem.salaryExpectation || '—' }}</span></div>
                <div class="rec-detail-field"><span class="rec-detail-label">学历</span><span class="rec-detail-value">{{ detailItem.education || '—' }}</span></div>
                <div class="rec-detail-field"><span class="rec-detail-label">职业目标</span><span class="rec-detail-value">{{ detailItem.careerGoal || '—' }}</span></div>
                <div class="rec-detail-field"><span class="rec-detail-label">创建时间</span><span class="rec-detail-value">{{ formatTime(detailItem.createdAt) }}</span></div>
              </div>

              <!-- Skills -->
              <div v-if="detailItem.skills?.length" class="rec-detail-section">
                <span class="rec-detail-label">技能标签</span>
                <div class="rec-tag-group">
                  <span v-for="s in detailItem.skills" :key="s" class="rec-tag rec-tag-blue">{{ s }}</span>
                </div>
              </div>

              <!-- Summary -->
              <div v-if="detailItem.summary" class="rec-detail-section">
                <span class="rec-detail-label">个人总结</span>
                <div class="rec-detail-block">{{ detailItem.summary }}</div>
              </div>

              <!-- Talent Profile -->
              <div v-if="detailItem.talentProfile" class="rec-detail-section" style="border-top: 1px solid var(--color-border-primary); padding-top: 12px;">
                <span class="rec-detail-label">Talent Profile</span>
                <div class="rec-profile-grid">
                  <div class="rec-detail-field"><span class="rec-detail-label">职级</span><span class="rec-detail-value">{{ detailItem.talentProfile.careerLevel || '—' }}</span></div>
                  <div class="rec-detail-field"><span class="rec-detail-label">匹配次数</span><span class="rec-detail-value">{{ detailItem.talentProfile.matchCount || 0 }}</span></div>
                  <div class="rec-detail-field"><span class="rec-detail-label">最后匹配</span><span class="rec-detail-value">{{ detailItem.talentProfile.lastMatchedAt ? formatTime(detailItem.talentProfile.lastMatchedAt) : '—' }}</span></div>
                  <div class="rec-detail-field"><span class="rec-detail-label">薪资范围</span><span class="rec-detail-value">{{ detailItem.talentProfile.salaryMin != null || detailItem.talentProfile.salaryMax != null ? `${detailItem.talentProfile.salaryMin ?? '?'}-${detailItem.talentProfile.salaryMax ?? '?'}K` : '—' }}</span></div>
                </div>
                <div v-if="detailItem.talentProfile.strengths?.length" class="rec-detail-meta" style="margin-top: 8px;">
                  <span class="rec-detail-label">优势：</span>
                  <span v-for="s in detailItem.talentProfile.strengths" :key="s" class="rec-tag" style="background: var(--color-execution-glow); color: var(--color-execution); margin-left: 4px;">{{ s }}</span>
                </div>
                <div v-if="detailItem.talentProfile.risks?.length" class="rec-detail-meta" style="margin-top: 4px;">
                  <span class="rec-detail-label">风险：</span>
                  <span v-for="r in detailItem.talentProfile.risks" :key="r" class="rec-tag" style="background: rgba(239,68,68,0.12); color: var(--color-danger); margin-left: 4px;">{{ r }}</span>
                </div>
                <div v-if="detailItem.talentProfile.projects" class="rec-detail-section">
                  <span class="rec-detail-label">项目经历</span>
                  <div class="rec-detail-block" style="font-size: 12px;">{{ detailItem.talentProfile.projects }}</div>
                </div>
              </div>

              <!-- Match records -->
              <div v-if="detailItem.matches?.length" class="rec-detail-section" style="border-top: 1px solid var(--color-border-primary); padding-top: 12px;">
                <span class="rec-detail-label">匹配记录 ({{ detailItem.matchCount }})</span>
                <div class="rec-match-list">
                  <div v-for="m in detailItem.matches" :key="m.id" class="rec-match-item">
                    <div class="rec-match-info">
                      <div class="rec-match-job">{{ m.job?.title || '—' }}</div>
                      <div class="rec-detail-meta">{{ formatTime(m.createdAt) }}</div>
                    </div>
                    <div class="rec-match-scores">
                      <span :class="m.matchScore >= 70 ? 'rec-score-high' : m.matchScore >= 50 ? 'rec-score-mid' : 'rec-score-low'">{{ m.matchScore }}分</span>
                      <span class="rec-match-status" :class="matchStatusClass(m.status)">{{ m.status }}</span>
                    </div>
                  </div>
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
definePageMeta({ layout: 'admin-aigc' })
import { ref, onMounted } from 'vue'

const loading = ref(false)
const error = ref('')
const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const totalPages = ref(0)
const searchKey = ref('')
const filterQuality = ref('')
const sortBy = ref('createdAt')
const detailItem = ref<any>(null)
const detailLoading = ref(false)
const stats = ref<any>({})

function qualityTextClass(score: number | null) {
  if (score == null) return 'rec-score-null'
  if (score >= 70) return 'rec-score-high'
  if (score >= 50) return 'rec-score-mid'
  return 'rec-score-low'
}
function qualityBarClass(score: number | null) {
  if (score == null) return 'rec-bar-gray'
  if (score >= 70) return 'rec-bar-green'
  if (score >= 50) return 'rec-bar-yellow'
  return 'rec-bar-red'
}
function matchStatusClass(s: string) {
  return ({ matched: 'rec-status-matched', pending: 'rec-status-pending', rejected: 'rec-status-rejected' } as Record<string, string>)[s] || 'rec-status-default'
}
function formatTime(t: string) {
  if (!t) return '—'
  const d = new Date(t)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return d.toLocaleDateString('zh-CN')
}

async function openDetail(c: any) {
  detailItem.value = c
  detailLoading.value = true
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`/api/admin/recruitment/candidates/${c.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const json = await res.json()
      detailItem.value = json
    }
  } catch (e: any) {
    error.value = '加载详情失败：' + e.message
  } finally {
    detailLoading.value = false
  }
}

async function fetchStats() {
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch('/api/admin/recruitment/candidates/stats', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      stats.value = await res.json()
    }
  } catch (e: any) {
    // stats 非阻塞
  }
}

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize), sortBy: sortBy.value })
    if (searchKey.value) params.set('keyword', searchKey.value)
    if (filterQuality.value) params.set('quality', filterQuality.value)
    const res = await fetch(`/api/admin/recruitment/candidates?${params}`, {
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

onMounted(() => { fetchData(); fetchStats() })
</script>

<style scoped>
/* ── Shared styles ── */
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

/* ── Stats Bar ── */
.rec-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; width: 100%; }
.rec-stat-item { background: var(--color-bg-elevated, #111827); border: 1px solid var(--color-border-primary, #1E293B); border-radius: var(--radius-lg, 12px); padding: 16px; text-align: center; }
.rec-stat-val { font-size: 24px; font-weight: 700; display: block; line-height: 1.2; }
.rec-stat-label { font-size: 11px; color: var(--color-text-muted, #64748B); margin-top: 4px; display: block; }

.rec-skills-bar { background: var(--color-bg-elevated, #111827); border: 1px solid var(--color-border-primary, #1E293B); border-radius: var(--radius-md, 10px); padding: 12px 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.rec-skills-label { font-size: 11px; color: var(--color-text-muted, #64748B); white-space: nowrap; }
.rec-tag-group { display: flex; flex-wrap: wrap; gap: 6px; }
.rec-tag { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; }
.rec-tag-blue { background: var(--color-decision-glow, rgba(59,130,246,0.15)); color: var(--color-decision, #3B82F6); }
.rec-tag-count { color: var(--color-text-muted, #64748B); }
.rec-tag-more { font-size: 11px; color: var(--color-text-muted, #64748B); }

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

.rec-match-badge { padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 500; background: var(--color-execution-glow, rgba(16,185,129,0.15)); color: var(--color-execution, #10B981); }

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
.rec-modal { background: var(--color-bg-secondary, #0D1328); border: 1px solid var(--color-border-primary, #1E293B); border-radius: var(--radius-xl, 16px); width: 100%; max-width: 640px; max-height: 85vh; overflow-y: auto; padding: 24px; margin: 16px; }
.rec-modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.rec-modal-title { font-size: 16px; font-weight: 600; color: var(--color-text-primary, #F1F5F9); margin: 0; }
.rec-modal-close { background: none; border: none; color: var(--color-text-muted); cursor: pointer; padding: 4px; border-radius: 4px; }
.rec-modal-close:hover { color: var(--color-text-primary); background: var(--color-bg-hover); }

.rec-modal-body { display: flex; flex-direction: column; gap: 16px; }

.rec-detail-profile { display: flex; align-items: center; gap: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--color-border-primary, #1E293B); }
.rec-detail-avatar { width: 52px; height: 52px; border-radius: 50%; background: var(--color-decision-glow); color: var(--color-decision); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; flex-shrink: 0; }
.rec-detail-profile-info { flex: 1; min-width: 0; }
.rec-detail-profile-score { text-align: right; flex-shrink: 0; }
.rec-detail-score-num { font-size: 28px; font-weight: 700; line-height: 1; }
.rec-detail-value { font-size: 15px; font-weight: 500; color: var(--color-text-primary, #F1F5F9); }
.rec-detail-meta { font-size: 12px; color: var(--color-text-muted, #64748B); margin-top: 4px; }
.rec-completeness { margin-left: 4px; font-weight: 500; }

.rec-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.rec-detail-field { display: flex; flex-direction: column; gap: 4px; }
.rec-detail-label { font-size: 12px; color: var(--color-text-muted, #64748B); }
.rec-detail-section { display: flex; flex-direction: column; gap: 8px; }
.rec-detail-block { color: var(--color-text-secondary, #94A3B8); font-size: 13px; line-height: 1.6; background: rgba(0,0,0,0.2); border-radius: var(--radius-md); padding: 12px; }

.rec-profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: rgba(0,0,0,0.2); border-radius: var(--radius-md); padding: 16px; }

.rec-match-list { display: flex; flex-direction: column; gap: 6px; }
.rec-match-item { display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.2); border-radius: var(--radius-md, 10px); padding: 10px 16px; }
.rec-match-job { font-size: 13px; color: var(--color-text-primary); }
.rec-match-scores { display: flex; align-items: center; gap: 8px; }
.rec-match-status { padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 500; }
.rec-status-matched { background: var(--color-execution-glow); color: var(--color-execution); }
.rec-status-pending { background: rgba(245,158,11,0.12); color: var(--color-warning); }
.rec-status-rejected { background: rgba(239,68,68,0.12); color: var(--color-danger); }
.rec-status-default { background: rgba(100,116,139,0.12); color: var(--color-text-muted); }

.rec-modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }
.rec-btn-ghost { padding: 8px 16px; border-radius: var(--radius-sm); border: none; background: rgba(255,255,255,0.05); color: var(--color-text-secondary, #94A3B8); font-size: 12px; cursor: pointer; }
.rec-btn-ghost:hover { background: rgba(255,255,255,0.1); color: var(--color-text-primary); }

@media (max-width: 768px) {
  .rec-stats-grid { grid-template-columns: repeat(2, 1fr); }
  .rec-detail-grid { grid-template-columns: 1fr; }
  .rec-profile-grid { grid-template-columns: 1fr; }
}
</style>
