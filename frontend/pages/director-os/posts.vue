<template>
  <NuxtLayout name="workbench">
    <div class="max-w-6xl">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-semibold text-gray-200">📝 帖子审核</h2>
        <div class="flex gap-2">
          <select v-model="filterStatus" @change="fetchPosts(1)" class="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">全部状态</option>
            <option value="pending">待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已拒绝</option>
          </select>
          <input v-model="searchText" type="text" placeholder="搜索标题/内容..." class="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm w-48" @keyup.enter="fetchPosts(1)" />
          <button class="btn btn-sm btn-secondary" @click="fetchPosts(1)">搜索</button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-12 text-gray-500">
        <div class="spinner mx-auto mb-3"></div>
        <span>加载中...</span>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-center py-12 text-red-400">{{ error }}</div>

      <!-- Empty -->
      <div v-else-if="posts.length === 0" class="text-center py-12 text-gray-500">暂无帖子</div>

      <!-- Post List -->
      <div v-else class="space-y-3">
        <div v-for="post in posts" :key="post.id" class="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
          <div class="flex items-start gap-4">
            <!-- Status Badge -->
            <div class="flex-shrink-0">
              <span v-if="post.status === 'pending'" class="status-badge status-pending">待审核</span>
              <span v-else-if="post.status === 'approved'" class="status-badge status-approved">已通过</span>
              <span v-else class="status-badge status-rejected">已拒绝</span>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3 mb-1">
                <h3 class="text-base font-medium text-gray-200 truncate">{{ post.title }}</h3>
                <span v-if="post.isPinned" class="badge badge-pin">置顶</span>
                <span v-if="post.isEssence" class="badge badge-essence">精华</span>
              </div>
              <p class="text-sm text-gray-500 line-clamp-2">{{ post.content?.substring(0, 150) }}</p>
              <div class="flex items-center gap-4 mt-2 text-xs text-gray-600">
                <span>👤 {{ post.user?.username || '匿名' }}</span>
                <span>👁️ {{ post.viewCount }}</span>
                <span>👍 {{ post.likeCount }}</span>
                <span>💬 {{ post.commentCount }}</span>
                <span>📅 {{ formatTime(post.createdAt) }}</span>
                <span v-if="post.reviewedBy" class="text-gray-500">审核人: {{ post.reviewedBy }}</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex-shrink-0 flex gap-2">
              <button class="btn btn-sm btn-outline" @click="previewPost(post)">查看</button>
              <button v-if="post.status === 'pending'" class="btn btn-sm btn-approve" @click="approvePost(post)">通过</button>
              <button v-if="post.status === 'pending'" class="btn btn-sm btn-reject" @click="rejectPost(post)">拒绝</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex justify-center gap-2 mt-6">
        <button :disabled="page <= 1" class="btn btn-sm btn-outline" @click="fetchPosts(page - 1)">← 上一页</button>
        <span class="text-sm text-gray-500 self-center">第 {{ page }} / {{ totalPages }} 页</span>
        <button :disabled="page >= totalPages" class="btn btn-sm btn-outline" @click="fetchPosts(page + 1)">下一页 →</button>
      </div>

      <!-- Preview Modal -->
      <div v-if="previewPostData" class="modal-overlay" @click.self="previewPostData = null">
        <div class="modal-content max-w-2xl">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-200">📄 帖子预览</h3>
            <button class="text-gray-500 hover:text-gray-300 text-xl" @click="previewPostData = null">&times;</button>
          </div>

          <div class="mb-4">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm text-gray-500">作者: {{ previewPostData.user?.username || '匿名' }}</span>
              <span class="text-xs text-gray-600">{{ formatTime(previewPostData.createdAt) }}</span>
            </div>
            <h2 class="text-xl font-bold text-white mb-3">{{ previewPostData.title }}</h2>
            <div class="post-content-view" v-html="renderContent(previewPostData.content)"></div>
          </div>

          <div class="flex gap-3 pt-4 border-t border-gray-800">
            <button v-if="previewPostData.status === 'pending'" class="btn btn-approve px-6 py-2.5" @click="approvePost(previewPostData)">✅ 审核通过</button>
            <button v-if="previewPostData.status === 'pending'" class="btn btn-reject px-6 py-2.5" @click="rejectPost(previewPostData)">❌ 拒绝</button>
            <button class="btn btn-outline px-6 py-2.5" @click="previewPostData = null">关闭</button>
          </div>
        </div>
      </div>

      <!-- Reject Reason Modal -->
      <div v-if="rejectModal" class="modal-overlay" @click.self="rejectModal = false">
        <div class="modal-content max-w-md">
          <h3 class="text-lg font-semibold text-gray-200 mb-4">拒绝原因</h3>
          <textarea v-model="rejectReason" placeholder="请填写拒绝原因..." rows="4" class="w-full bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm resize-none mb-4"></textarea>
          <div class="flex gap-3 justify-end">
            <button class="btn btn-outline px-4 py-2" @click="rejectModal = false">取消</button>
            <button class="btn btn-reject px-4 py-2" :disabled="!rejectReason.trim()" @click="confirmReject">确认拒绝</button>
          </div>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const posts = ref<any[]>([])
const loading = ref(true)
const error = ref('')
const page = ref(1)
const totalPages = ref(1)
const filterStatus = ref('pending')
const searchText = ref('')
const previewPostData = ref<any>(null)
const rejectModal = ref(false)
const rejectReason = ref('')
const rejectTarget = ref<any>(null)

function getToken(): string {
  try { return localStorage.getItem('auth_token') || '' } catch { return '' }
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function sanitizeUrl(url: string): string {
  const u = url.trim()
  if (u.startsWith('http://') || u.startsWith('https://')) return u
  if (u.startsWith('/')) return u
  return '#'
}

function renderContent(text: string): string {
  if (!text) return ''
  const placeholders: string[] = []
  let processed = text

  processed = processed.replace(/\[img:([^\]]+)\]/g, (_m, url) => {
    const idx = placeholders.length
    placeholders.push(`<div class="inline-media"><a href="${sanitizeUrl(url)}" target="_blank" rel="noopener"><img src="${sanitizeUrl(url)}" class="inline-img-preview" loading="lazy" /></a></div>`)
    return `%%PLACEHOLDER_${idx}%%`
  })

  processed = processed.replace(/\[video:([^\]]+)\]/g, (_m, url) => {
    const idx = placeholders.length
    placeholders.push(`<div class="inline-media"><video src="${sanitizeUrl(url)}" class="inline-video-preview" controls preload="metadata"></video></div>`)
    return `%%PLACEHOLDER_${idx}%%`
  })

  processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, linkText, url) => {
    const idx = placeholders.length
    placeholders.push(`<a href="${sanitizeUrl(url)}" target="_blank" rel="noopener" class="post-link">${escapeHtml(linkText)}</a>`)
    return `%%PLACEHOLDER_${idx}%%`
  })

  processed = processed.replace(/(https?:\/\/[^\s<%%]+)/g, (_m, url) => {
    const idx = placeholders.length
    placeholders.push(`<a href="${sanitizeUrl(url)}" target="_blank" rel="noopener" class="post-link">${escapeHtml(url)}</a>`)
    return `%%PLACEHOLDER_${idx}%%`
  })

  let html = escapeHtml(processed)
  html = html.replace(/\n/g, '<br />')
  html = html.replace(/%%PLACEHOLDER_(\d+)%%/g, (_m, idx) => placeholders[parseInt(idx)] || '')
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/<iframe\b[^>]*>/gi, '')
    .replace(/<\/iframe>/gi, '')
}

async function fetchPosts(p: number) {
  page.value = p
  loading.value = true
  error.value = ''
  try {
    const token = getToken()
    const params = new URLSearchParams()
    if (filterStatus.value) params.set('status', filterStatus.value)
    if (searchText.value) params.set('search', searchText.value)
    params.set('page', String(page.value))
    params.set('pageSize', '20')

    const res = await fetch(`/api/admin/posts?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('加载失败')
    const data = await res.json()
    posts.value = data.posts || []
    totalPages.value = data.pagination?.totalPages || 1
  } catch (err: any) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function previewPost(post: any) {
  previewPostData.value = { ...post }
}

async function approvePost(post: any) {
  const token = getToken()
  try {
    const res = await fetch(`/api/admin/posts/${post.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('操作失败')
    previewPostData.value = null
    fetchPosts(page.value)
  } catch (err: any) {
    alert('审核通过失败: ' + err.message)
  }
}

function rejectPost(post: any) {
  rejectTarget.value = post
  rejectReason.value = ''
  rejectModal.value = true
  previewPostData.value = null
}

async function confirmReject() {
  const post = rejectTarget.value
  if (!post || !rejectReason.value.trim()) return
  const token = getToken()
  try {
    const res = await fetch(`/api/admin/posts/${post.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reasonDescription: rejectReason.value.trim() }),
    })
    if (!res.ok) throw new Error('操作失败')
    rejectModal.value = false
    rejectTarget.value = null
    fetchPosts(page.value)
  } catch (err: any) {
    alert('拒绝失败: ' + err.message)
  }
}

onMounted(() => {
  fetchPosts(1)
})
</script>

<style scoped>
.spinner { width: 32px; height: 32px; border: 2px solid rgba(255,255,255,0.05); border-top-color: #f97316; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.status-badge { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: 600; white-space: nowrap; }
.status-pending { background: rgba(250,204,21,0.1); color: #eab308; }
.status-approved { background: rgba(34,197,94,0.1); color: #22c55e; }
.status-rejected { background: rgba(239,68,68,0.1); color: #ef4444; }
.badge { font-size: 0.65rem; padding: 2px 10px; border-radius: 6px; font-weight: 600; }
.badge-pin { background: rgba(249,115,22,0.1); color: #f97316; }
.badge-essence { background: rgba(250,204,21,0.1); color: #eab308; }
.btn { border: none; border-radius: 8px; font-size: 0.8rem; font-weight: 500; cursor: pointer; transition: all 0.2s; }
.btn-sm { padding: 6px 14px; }
.btn-outline { background: transparent; border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); }
.btn-outline:hover { border-color: rgba(255,255,255,0.2); color: #fff; }
.btn-secondary { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.6); border: 1px solid rgba(255,255,255,0.08); }
.btn-secondary:hover { background: rgba(255,255,255,0.08); }
.btn-approve { background: rgba(34,197,94,0.1); color: #22c55e; border: 1px solid rgba(34,197,94,0.2); }
.btn-approve:hover { background: rgba(34,197,94,0.15); }
.btn-reject { background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); }
.btn-reject:hover { background: rgba(239,68,68,0.15); }
.line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.65); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
.modal-content { background: #1a1a24; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px; width: 100%; max-height: 85vh; overflow-y: auto; }
.post-content-view { font-size: 0.95rem; line-height: 1.8; color: rgba(255,255,255,0.7); }
.post-link { color: #fbbf24; text-decoration: underline; text-decoration-color: rgba(251,191,36,0.4); text-underline-offset: 2px; font-weight: 600; transition: color 0.2s; padding: 1px 3px; border-radius: 4px; background: rgba(251,191,36,0.08); }
.post-link:hover { color: #fde68a; }
.inline-media { margin: 8px 0; max-width: 100%; border-radius: 8px; overflow: hidden; }
.inline-img-preview { width: 100%; max-width: 400px; display: block; }
.inline-video-preview { width: 100%; max-width: 400px; display: block; }
</style>
