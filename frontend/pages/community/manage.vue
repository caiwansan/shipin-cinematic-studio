<template>
  <div class="community-page cn-page">
    <!-- 导航栏（中式浅色） -->
    <nav class="nav-bar">
      <div class="nav-inner">
        <div class="nav-logo">
          <span class="logo-icon"><img src="/logo.png" alt="昆仑镜" class="nav-logo-img" /></span>
          <span class="logo-text">昆仑镜</span>
        </div>
        <div class="nav-links">
          <a href="/" class="nav-link">首页</a>
          <a href="/community" class="nav-link">社区</a>
          <a href="/community/manage" class="nav-link nav-link-active">社区管理</a>
        </div>
        <div class="nav-actions">
          <template v-if="isLoggedIn">
            <NuxtLink to="/community" class="cn-ink-btn">← 返回社区</NuxtLink>
            <span v-if="isModerator" class="cn-stamp" :class="moderatorRole === 'co_moderator' ? 'cn-stamp--blue' : 'cn-stamp--gold'">
              {{ moderatorRole === 'co_moderator' ? '副版主' : '版主' }}
            </span>
          </template>
          <button v-else class="cn-seal-btn" @click="$router.push('/community')">回社区登录</button>
        </div>
      </div>
    </nav>

    <div class="page-content">
      <div class="cn-huiwen page-huiwen" aria-hidden="true" />

      <!-- 版主身份/申请状态（顶部） -->
      <div v-if="isLoggedIn" class="mod-banner cn-card">
        <template v-if="isModerator">
          <div>
            <div class="cn-plaque mod-title">版 主 工 作 台</div>
            <p class="mod-desc">身为{{ moderatorRole === 'co_moderator' ? '副版主' : '版主' }}，你可审核帖子、加精、置顶、删除违规内容。</p>
          </div>
          <div class="mod-stats">
            <div class="mod-stat"><b>{{ stats.pending }}</b><span>待审核</span></div>
            <div class="mod-stat"><b>{{ stats.pinned }}</b><span>置顶中</span></div>
            <div class="mod-stat"><b>{{ stats.essence }}</b><span>精华中</span></div>
          </div>
        </template>
        <template v-else>
          <div>
            <div class="cn-plaque mod-title">申 请 版 主</div>
            <p class="mod-desc">
              <template v-if="modStatus === 'pending'">你的申请正在审核中，请耐心等待站长审批。</template>
              <template v-else-if="modStatus === 'rejected'">你的申请未通过，可以附上更详细的自荐说明后重新申请。</template>
              <template v-else-if="modStatus === 'removed'">你已被卸任，暂不能重新申请。</template>
              <template v-else>社区版主负责帖子审核、加精、置顶与删帖，维护社区秩序。欢迎申请！</template>
            </p>
          </div>
          <div class="mod-actions">
            <input v-if="modStatus !== 'pending' && modStatus !== 'removed'" v-model="applyNote" type="text"
              placeholder="自荐说明（选填，200字内）" class="form-input mod-note" />
            <button v-if="modStatus !== 'pending' && modStatus !== 'removed'" class="cn-seal-btn" :disabled="applying" @click="submitApply">
              {{ applying ? '提交中...' : (modStatus === 'rejected' ? '重新申请' : '申请成为版主') }}
            </button>
          </div>
        </template>
      </div>

      <p v-else class="mod-login-tip">请先登录后使用社区管理功能。 <a href="/community">去登录</a></p>

      <!-- Tab 切换 -->
      <nav v-if="isModerator" class="category-tabs mod-tabs" aria-label="帖子状态">
        <div class="tabs-scroll">
          <button v-for="t in tabs" :key="t.value" :class="['tab-btn', activeTab === t.value && 'tab-active']" @click="switchTab(t.value)">
            {{ t.label }}<span v-if="t.value === 'pending' && stats.pending > 0" class="tab-count">{{ stats.pending }}</span>
          </button>
        </div>
      </nav>

      <!-- 帖子表格 -->
      <div v-if="isModerator" class="mod-table-wrap cn-card">
        <div v-if="loading" class="loading-state"><div class="spinner" /><p>加载中...</p></div>
        <div v-else-if="modPosts.length === 0" class="empty-state">
          <p class="empty-icon">📭</p>
          <p>{{ activeTab === 'pending' ? '暂无待审核帖子' : '暂无帖子' }}</p>
        </div>
        <table v-else class="mod-table">
          <thead>
            <tr>
              <th>标题</th>
              <th class="th-author">作者</th>
              <th class="th-status">状态</th>
              <th class="th-time">发布时间</th>
              <th class="th-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in modPosts" :key="p.id">
              <td class="td-title">
                <a :href="`/community/post/${p.id}`" target="_blank" rel="noopener" class="post-link">
                  <span v-if="p.isPinned" title="置顶">📌</span>
                  <span v-if="p.isEssence" title="精华">⭐</span>
                  {{ p.title }}
                </a>
                <span v-if="p.rejectReason" class="reject-reason" :title="p.rejectReason">（{{ p.rejectReason }}）</span>
              </td>
              <td class="td-author">{{ p.author?.nickname || '—' }}</td>
              <td class="td-status"><span class="status-pill" :class="`status-pill--${p.status}`">{{ statusLabel(p.status) }}</span></td>
              <td class="td-time">{{ formatTime(p.createdAt) }}</td>
              <td class="td-actions">
                <button v-if="p.status === 'pending'" class="act-btn act-ok" @click="doApprove(p)">通过</button>
                <button v-if="p.status === 'pending'" class="act-btn act-no" @click="doReject(p)">驳回</button>
                <button class="act-btn" :class="p.isPinned ? 'act-on' : 'act-off'" @click="togglePin(p)">
                  {{ p.isPinned ? '取消置顶' : '置顶' }}
                </button>
                <button class="act-btn" :class="p.isEssence ? 'act-on' : 'act-off'" @click="toggleEssence(p)">
                  {{ p.isEssence ? '取消精华' : '加精' }}
                </button>
                <button class="act-btn act-del" @click="doDelete(p)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- 分页 -->
        <div v-if="pagination.totalPages > 1" class="pagination">
          <button :disabled="pagination.page <= 1" class="cn-ink-btn page-btn" @click="changePage(pagination.page - 1)">上一页</button>
          <span class="page-info">{{ pagination.page }} / {{ pagination.totalPages }}</span>
          <button :disabled="pagination.page >= pagination.totalPages" class="cn-ink-btn page-btn" @click="changePage(pagination.page + 1)">下一页</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getToken } from '~/utils/token-cache'

definePageMeta({ layout: 'default' })
const apiBase = import.meta.server ? (process.env.BACKEND_URL || 'http://127.0.0.1:4002') : ''

const isLoggedIn = ref(false)
const isModerator = ref(false)
const moderatorRole = ref('')
const modStatus = ref('')
const applyNote = ref('')
const applying = ref(false)
const applyMsg = ref('')

const tabs = [
  { label: '待审核', value: 'pending' },
  { label: '已通过', value: 'approved' },
  { label: '已驳回', value: 'rejected' },
  { label: '已删除', value: 'deleted' },
]
const activeTab = ref('pending')
const modPosts = ref<any[]>([])
const pagination = ref({ page: 1, pageSize: 20, total: 0, totalPages: 1 })
const loading = ref(false)
const stats = ref({ pending: 0, pinned: 0, essence: 0 })

async function api(path: string, method = 'GET', body?: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${apiBase}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

async function loadMe() {
  const { ok, data } = await api('/api/community/moderator/me')
  if (!ok) return
  isModerator.value = data.isModerator
  moderatorRole.value = data.role
  modStatus.value = data.status
}

async function submitApply() {
  applying.value = true
  try {
    const { ok, data } = await api('/api/community/moderator/apply', 'POST', { note: applyNote.value })
    if (ok) {
      applyMsg.value = '申请已提交，请等待站长审批'
      modStatus.value = 'pending'
    } else {
      applyMsg.value = data.error || '提交失败'
    }
  } finally {
    applying.value = false
  }
}

async function loadPosts() {
  loading.value = true
  try {
    const { ok, data } = await api(`/api/community/moderator/posts?status=${activeTab.value}&page=${pagination.value.page}&pageSize=20`)
    if (ok) {
      modPosts.value = data.posts || []
      pagination.value = data.pagination || { page: 1, pageSize: 20, total: 0, totalPages: 1 }
    }
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  const { ok, data } = await api('/api/community/moderator/posts?status=pending&pageSize=1')
  if (ok) stats.value.pending = data.pagination?.total || 0
  const { data: all } = await api('/api/community/moderator/posts?status=approved&pageSize=50')
  if (all?.posts) {
    stats.value.pinned = all.posts.filter((p: any) => p.isPinned).length
    stats.value.essence = all.posts.filter((p: any) => p.isEssence).length
  }
}

function switchTab(t: string) { activeTab.value = t; pagination.value.page = 1; loadPosts() }
function changePage(p: number) { pagination.value.page = p; loadPosts() }

async function doApprove(p: any) {
  const { ok, data } = await api(`/api/community/moderator/posts/${p.id}/approve`, 'PATCH')
  if (ok) { p.status = 'approved'; loadPosts(); loadStats() }
  else alert(data.error || '操作失败')
}
async function doReject(p: any) {
  const reason = prompt('请输入驳回原因（选填）：')
  if (reason === null) return
  const { ok, data } = await api(`/api/community/moderator/posts/${p.id}/reject`, 'PATCH', { reason })
  if (ok) { p.status = 'rejected'; loadPosts(); loadStats() }
  else alert(data.error || '操作失败')
}
async function togglePin(p: any) {
  const { ok, data } = await api(`/api/community/moderator/posts/${p.id}/pin`, 'PATCH')
  if (ok) { p.isPinned = data.isPinned; loadStats() }
}
async function toggleEssence(p: any) {
  const { ok, data } = await api(`/api/community/moderator/posts/${p.id}/essence`, 'PATCH')
  if (ok) { p.isEssence = data.isEssence; loadStats() }
}
async function doDelete(p: any) {
  if (!confirm(`确定删除帖子「${p.title}」？删除后帖子不再展示（数据保留可追溯）。`)) return
  const { ok, data } = await api(`/api/community/moderator/posts/${p.id}`, 'DELETE')
  if (ok) { loadPosts(); loadStats() }
  else alert(data.error || '操作失败')
}

function statusLabel(s: string) {
  return { pending: '待审核', approved: '已通过', rejected: '已驳回', deleted: '已删除' }[s] || s
}
function formatTime(t: string) {
  if (!t) return '—'
  return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  const token = getToken()
  isLoggedIn.value = !!token
  if (!token) return
  loadMe().then(() => {
    if (isModerator.value) { loadPosts(); loadStats() }
  })
})
</script>

<style scoped>
.page-content { max-width: 1080px; margin: 0 auto; padding: 24px 20px 48px; }
.page-huiwen { margin: -8px 0 20px; }
.mod-banner { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 18px 22px; margin-bottom: 18px; flex-wrap: wrap; }
.mod-title { font-size: 15px; }
.mod-desc { color: var(--cn-ink-soft); font-size: 13px; margin: 8px 0 0; }
.mod-stats { display: flex; gap: 26px; }
.mod-stat { text-align: center; }
.mod-stat b { display: block; font-size: 20px; color: var(--cn-cobalt); }
.mod-stat span { font-size: 11px; color: var(--cn-ink-soft); }
.mod-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.mod-note { width: 220px; }
.mod-login-tip { text-align: center; padding: 40px 0; color: var(--cn-ink-soft); }
.mod-tabs { margin-bottom: 16px; }
.tab-count { background: var(--cn-cinnabar); color: #fff; border-radius: 999px; font-size: 10px; padding: 1px 6px; margin-left: 4px; }
.mod-table-wrap { padding: 6px 0; overflow-x: auto; }
.mod-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.mod-table th { text-align: left; padding: 10px 14px; color: var(--cn-ink-soft); font-weight: 500; border-bottom: 1px solid var(--cn-line); font-size: 12px; }
.mod-table td { padding: 10px 14px; border-bottom: 1px dashed var(--cn-line); vertical-align: middle; }
.mod-table tbody tr:last-child td { border-bottom: none; }
.td-title { max-width: 380px; }
.post-link { color: var(--cn-ink); text-decoration: none; font-weight: 500; }
.post-link:hover { color: var(--cn-cobalt); }
.reject-reason { color: var(--cn-cinnabar); font-size: 12px; }
.th-author, .td-author { width: 90px; }
.th-status, .td-status { width: 70px; }
.th-time, .td-time { width: 130px; color: var(--cn-ink-soft); font-size: 12px; }
.th-actions, .td-actions { width: 250px; }
.status-pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; }
.status-pill--pending { background: rgba(200, 160, 40, 0.15); color: #9a7b1a; }
.status-pill--approved { background: rgba(46, 139, 87, 0.15); color: #1e7a4a; }
.status-pill--rejected { background: rgba(200, 60, 60, 0.12); color: #b03a3a; }
.status-pill--deleted { background: rgba(120, 120, 120, 0.15); color: #777; }
.act-btn { border: 1px solid var(--cn-line); background: transparent; color: var(--cn-ink-soft); border-radius: 6px; padding: 3px 10px; font-size: 12px; cursor: pointer; margin-right: 6px; }
.act-btn:hover { border-color: var(--cn-cobalt); color: var(--cn-cobalt); }
.act-ok { color: #1e7a4a; border-color: rgba(46, 139, 87, 0.4); }
.act-ok:hover { background: rgba(46, 139, 87, 0.08); border-color: #1e7a4a; }
.act-no { color: #b03a3a; border-color: rgba(200, 60, 60, 0.4); }
.act-no:hover { background: rgba(200, 60, 60, 0.08); border-color: #b03a3a; }
.act-on { color: var(--cn-cobalt); border-color: var(--cn-cobalt); background: rgba(95, 168, 190, 0.08); }
.act-del { color: #b03a3a; border-color: rgba(200, 60, 60, 0.4); }
.act-del:hover { background: rgba(200, 60, 60, 0.1); border-color: #b03a3a; }
.loading-state, .empty-state { padding: 40px 0; text-align: center; color: var(--cn-ink-soft); }
.spinner { width: 28px; height: 28px; border: 3px solid rgba(95, 168, 190, 0.2); border-top-color: var(--cn-cobalt); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 10px; }
@keyframes spin { to { transform: rotate(360deg); } }
.pagination { display: flex; justify-content: center; align-items: center; gap: 12px; padding: 16px 0; }
.page-info { color: var(--cn-ink-soft); font-size: 13px; }
</style>
