<!-- /admin/recruitment/enterprises.vue — 企业用户管理（Sprint-ADMIN-IA-RECRUITMENT-CLEANUP-01 T02） -->
<!-- 职责：哪些企业使用招聘 Workspace — 企业列表 + 详情（基本信息/订阅状态/已部署Agent/使用情况） -->
<!-- 数据源：/api/admin/enterprises + /api/admin/enterprises/stats（企业客户视角） -->
<template>
  <RecruitmentPageShell>
    <template #title>🏢 企业用户管理</template>
    <template #subtitle>使用招聘 Workspace 的企业客户 · 订阅 / AI 员工 / 使用情况</template>
    <template #actions>
      <button class="rec-btn" @click="loadStats(); loadEnterprises()">🔄 刷新</button>
    </template>

    <!-- Stats -->
    <template #stats>
      <div class="ent-stats">
        <div class="ent-stat"><span class="ent-stat-val">{{ stats.totalEnterprises ?? 0 }}</span><span class="ent-stat-lbl">企业总数</span></div>
        <div class="ent-stat"><span class="ent-stat-val text-blue">{{ stats.activeAgents ?? 0 }}</span><span class="ent-stat-lbl">启用中 AI 员工</span></div>
        <div class="ent-stat"><span class="ent-stat-val">{{ stats.totalAgents ?? 0 }}</span><span class="ent-stat-lbl">AI 员工总数</span></div>
        <div class="ent-stat"><span class="ent-stat-val text-green">{{ stats.totalTasks ?? 0 }}</span><span class="ent-stat-lbl">累计任务</span></div>
      </div>
    </template>

    <!-- Filters -->
    <template #filters>
      <div class="rec-search-wrap">
        <svg class="rec-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input v-model="searchQuery" @keyup.enter="page = 1; loadEnterprises()" placeholder="搜索企业名称..." class="rec-input" />
      </div>
      <select v-model="currentFilter" @change="page = 1; loadEnterprises()" class="rec-select">
        <option value="all">全部状态</option>
        <option value="active">订阅活跃</option>
        <option value="inactive">待激活</option>
        <option value="no_agent">无 AI 员工</option>
      </select>
    </template>

    <!-- Loading -->
    <div v-if="loading" class="rec-loading">
      <div class="rec-spinner"></div>
      <span>加载企业数据中...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="rec-error-banner">
      <span>⚠️ {{ error }}</span>
      <button @click="loadEnterprises" class="rec-btn-link">重试</button>
    </div>

    <template v-else>
      <div v-if="enterprises.length === 0" class="rec-empty">暂无企业数据</div>

      <div v-else class="ent-table-wrap">
        <table class="ent-table">
          <thead>
            <tr>
              <th>企业名称</th>
              <th>联系人</th>
              <th>注册时间</th>
              <th>当前套餐</th>
              <th>AI 员工</th>
              <th>任务</th>
              <th>最近活跃</th>
              <th>状态</th>
              <th style="width:80px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in enterprises" :key="e.id" class="ent-row">
              <td>
                <div class="ent-name">{{ e.name }}</div>
                <div class="ent-id">{{ e.id.slice(0, 8) }}</div>
              </td>
              <td class="ent-muted">{{ e.contactName || '—' }}</td>
              <td class="ent-muted">{{ formatDate(e.createdAt) }}</td>
              <td>
                <span class="ent-plan">{{ e.plan || '未订阅' }}</span>
              </td>
              <td><span class="ent-badge">{{ e.aiEmployeeCount ?? 0 }}</span></td>
              <td class="ent-muted">{{ e.totalTasks ?? 0 }}</td>
              <td class="ent-muted">{{ e.lastActiveAt ? formatRelative(e.lastActiveAt) : '—' }}</td>
              <td>
                <span class="ent-status" :class="statusClass(e.planStatus)">{{ statusLabel(e.planStatus) }}</span>
                <span v-for="r in e.risks" :key="r" class="ent-risk" :title="riskLabels[r] || r">{{ riskLabels[r] || r }}</span>
              </td>
              <td>
                <button class="ent-btn" @click="goDetail(e)">详情</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="pagination.totalPages > 1" class="rec-pagination">
        <span class="rec-page-info">共 {{ pagination.total }} 家 · 第 {{ pagination.page }}/{{ pagination.totalPages }} 页</span>
        <div class="rec-page-actions">
          <button @click="page--; loadEnterprises()" :disabled="page <= 1" class="rec-btn-page">上一页</button>
          <button @click="page++; loadEnterprises()" :disabled="page >= pagination.totalPages" class="rec-btn-page">下一页</button>
        </div>
      </div>
    </template>
  </RecruitmentPageShell>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getAuthToken } from '~/utils/auth/token'
import RecruitmentPageShell from '~/components/enterprise/recruitment/ui/RecruitmentPageShell.vue'
definePageMeta({ layout: 'admin-aigc' })

const router = useRouter()
const loading = ref(true)
const error = ref('')
const searchQuery = ref('')
const currentFilter = ref('all')
const enterprises = ref<any[]>([])
const stats = ref<any>({})
const page = ref(1)
const pagination = reactive({ page: 1, pageSize: 20, total: 0, totalPages: 0 })

const riskLabels: Record<string, string> = {
  no_agent: '无AI员工',
  no_model: '缺模型',
  no_channel: '缺渠道',
  inactive: '未活跃',
}

function statusLabel(s: string): string {
  return ({ active: '订阅活跃', expired: '订阅过期', none: '未订阅', cancelled: '已取消', paused: '已暂停' } as Record<string, string>)[s] || s
}
function statusClass(s: string): string {
  return ({ active: 'st-active', expired: 'st-expired', none: 'st-none', cancelled: 'st-cancelled', paused: 'st-paused' } as Record<string, string>)[s] || 'st-none'
}
function formatDate(d: string): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('zh-CN')
}
function formatRelative(d: string): string {
  const diff = Date.now() - new Date(d).getTime()
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${Math.floor(diff / 86400000)} 天前`
}
function goDetail(e: any) {
  router.push(`/admin/enterprises/${e.id}`)
}

async function loadEnterprises() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({ page: page.value.toString(), pageSize: '20' })
    if (searchQuery.value) params.set('search', searchQuery.value)
    if (currentFilter.value !== 'all') params.set('status', currentFilter.value)
    const res = await fetch(`/api/admin/enterprises?${params}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    })
    const json = await res.json()
    if (json.code === 0) {
      enterprises.value = json.data.list
      Object.assign(pagination, json.data.pagination)
      page.value = pagination.page
    } else {
      error.value = json.message || '加载失败'
    }
  } catch (e: any) {
    error.value = e.message || '网络错误'
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const res = await fetch('/api/admin/enterprises/stats', {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    })
    const json = await res.json()
    if (json.code === 0) stats.value = json.data
  } catch { /* 静默 */ }
}

onMounted(() => {
  loadStats()
  loadEnterprises()
})
</script>

<style scoped>
.rec-btn { display: inline-flex; align-items: center; padding: 8px 16px; border-radius: var(--radius-md, 10px); border: 1px solid var(--color-border-primary, #1E293B); background: var(--color-bg-elevated, #111827); color: var(--color-text-secondary, #94A3B8); font-size: 13px; cursor: pointer; transition: all 0.15s; }
.rec-btn:hover { background: var(--color-bg-hover, #1A2240); color: var(--color-text-primary, #F1F5F9); }

.rec-search-wrap { position: relative; flex: 1; min-width: 200px; }
.rec-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted, #64748B); }
.rec-input { width: 100%; background: var(--color-bg-secondary, #0D1328); border: 1px solid var(--color-border-primary, #1E293B); border-radius: var(--radius-sm, 6px); font-size: 13px; color: var(--color-text-secondary, #94A3B8); padding: 8px 12px 8px 36px; outline: none; transition: border-color 0.15s; box-sizing: border-box; }
.rec-select { background: var(--color-bg-secondary, #0D1328); border: 1px solid var(--color-border-primary, #1E293B); border-radius: var(--radius-sm, 6px); font-size: 13px; color: var(--color-text-secondary, #94A3B8); padding: 8px 12px; outline: none; cursor: pointer; box-sizing: border-box; }

.rec-loading { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 48px; color: var(--color-text-muted, #64748B); font-size: 14px; }
.rec-spinner { width: 20px; height: 20px; border: 2px solid var(--color-border-primary); border-top-color: var(--color-decision); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.rec-error-banner { display: flex; align-items: center; gap: 8px; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.2); border-radius: var(--radius-md); padding: 12px 16px; color: var(--color-danger); font-size: 13px; }
.rec-btn-link { background: none; border: none; color: inherit; text-decoration: underline; cursor: pointer; margin-left: 8px; font-size: inherit; padding: 0; }
.rec-empty { text-align: center; padding: 64px 24px; color: var(--color-text-muted, #64748B); font-size: 14px; }

/* Stats */
.ent-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.ent-stat { background: var(--color-bg-elevated, #111827); border: 1px solid var(--color-border-primary, #1E293B); border-radius: var(--radius-lg, 12px); padding: 16px; text-align: center; }
.ent-stat-val { display: block; font-size: 22px; font-weight: 700; color: var(--color-text-primary, #F1F5F9); line-height: 1.2; }
.ent-stat-lbl { display: block; font-size: 11px; color: var(--color-text-muted, #64748B); margin-top: 4px; }
.text-blue { color: #3B82F6 !important; }
.text-green { color: #10B981 !important; }

/* Table */
.ent-table-wrap { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden; }
.ent-table { width: 100%; border-collapse: collapse; }
.ent-table th, .ent-table td { padding: 12px 14px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13px; }
.ent-table th { background: rgba(0,0,0,0.2); color: rgba(255,255,255,0.5); font-weight: 600; font-size: 12px; }
.ent-row:hover { background: rgba(255,255,255,0.02); }
.ent-name { font-weight: 600; color: rgba(255,255,255,0.9); }
.ent-id { font-size: 11px; color: rgba(255,255,255,0.3); font-family: monospace; margin-top: 2px; }
.ent-muted { color: rgba(255,255,255,0.45); font-size: 12px; }
.ent-plan { padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 500; background: rgba(59,130,246,0.1); color: #60a5fa; }
.ent-badge { display: inline-block; padding: 2px 8px; background: rgba(139,92,246,0.12); color: #a78bfa; border-radius: 10px; font-size: 12px; font-weight: 500; }
.ent-status { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 500; }
.st-active { background: rgba(34,197,94,0.1); color: #22c55e; }
.st-expired { background: rgba(148,163,184,0.1); color: #94a3b8; }
.st-none { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); }
.st-cancelled { background: rgba(239,68,68,0.1); color: #ef4444; }
.st-paused { background: rgba(245,158,11,0.1); color: #f59e0b; }
.ent-risk { display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 4px; font-size: 10px; background: rgba(239,68,68,0.12); color: #ef4444; }
.ent-btn { padding: 4px 12px; border: none; border-radius: 6px; background: rgba(59,130,246,0.15); color: #60a5fa; cursor: pointer; font-size: 12px; }
.ent-btn:hover { background: rgba(59,130,246,0.25); }

.rec-pagination { display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: var(--color-text-muted, #64748B); margin-top: 16px; }
.rec-page-info { font-size: 12px; }
.rec-page-actions { display: flex; gap: 8px; }
.rec-btn-page { padding: 8px 16px; background: var(--color-bg-elevated, #111827); border: 1px solid var(--color-border-primary, #1E293B); border-radius: var(--radius-sm, 6px); color: var(--color-text-secondary, #94A3B8); font-size: 12px; cursor: pointer; }
.rec-btn-page:hover:not(:disabled) { background: var(--color-bg-hover, #1A2240); color: var(--color-text-primary); }
.rec-btn-page:disabled { opacity: 0.3; cursor: not-allowed; }
</style>
