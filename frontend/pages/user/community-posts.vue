<template>
  <div class="member-page">
    <!-- 顶部导航 -->
    <nav class="top-nav">
      <NuxtLink to="/" class="nav-brand">🏮 昆仑镜</NuxtLink>
      <NuxtLink to="/community" class="nav-link">社区</NuxtLink>
      <NuxtLink to="/user/center" class="nav-link nav-link-active">会员中心</NuxtLink>
    </nav>

    <div class="page-inner">
      <div class="page-header">
        <h1>📝 我的文章</h1>
        <p class="sub">社区发布的所有文章，含审核状态</p>
        <NuxtLink to="/community/new" class="write-btn">✒ 发布新文章</NuxtLink>
      </div>

      <div v-if="loading" class="state-box">加载中...</div>
      <div v-else-if="posts.length === 0" class="state-box">
        <p>还没有发布过文章</p>
        <NuxtLink to="/community/new" class="write-btn">✒ 去发布第一篇</NuxtLink>
      </div>
      <div v-else class="post-list">
        <div v-for="p in posts" :key="p.id" class="post-item" :class="{ 'post-item--rejected': p.status === 'rejected' }">
          <NuxtLink :to="`/community/post/${p.id}`" class="post-main">
            <div class="post-title-row">
              <span class="status-tag" :class="`status-tag--${p.status}`">{{ statusLabel(p.status) }}</span>
              <span class="post-title" :class="{ 'title-tipped': (p.giftCount || 0) > 0 }">{{ p.title }}</span>
            </div>
            <div v-if="p.status === 'rejected' && p.rejectReason" class="reject-reason">驳回原因：{{ p.rejectReason }}</div>
            <div class="post-stats">
              <span>👁️ {{ p.viewCount }}</span>
              <span>👍 {{ p.likeCount }}</span>
              <span>💬 {{ p.commentCount }}</span>
              <span>🔖 {{ p.favoriteCount }}</span>
              <span>↗️ {{ p.shareCount }}</span>
              <span v-if="(p.giftCount || 0) > 0" class="tip-num">🎁 {{ p.giftCount }}</span>
              <span class="post-time">{{ timeStr(p.createdAt) }}</span>
            </div>
          </NuxtLink>
          <button v-if="p.status === 'pending' || p.status === 'rejected'" class="del-btn" title="删除文章" @click="delPost(p.id)">🗑️</button>
        </div>
      </div>

      <div v-if="pagination.totalPages > 1" class="pagination">
        <button :disabled="pagination.page <= 1" @click="changePage(pagination.page - 1)">上一页</button>
        <span>{{ pagination.page }} / {{ pagination.totalPages }}</span>
        <button :disabled="pagination.page >= pagination.totalPages" @click="changePage(pagination.page + 1)">下一页</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { getAuthToken } from '~/utils/auth/token'

const router = useRouter()
const posts = ref<any[]>([])
const loading = ref(true)
const pagination = ref({ page: 1, totalPages: 1 })

function statusLabel(s: string) {
  return { approved: '✅ 已发布', pending: '⏳ 审核中', rejected: '❌ 未通过' }[s] || s
}
function timeStr(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

async function load(page = 1) {
  loading.value = true
  try {
    const res = await $fetch(`/api/community/my/posts?page=${page}&pageSize=20`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    })
    posts.value = res.posts || []
    pagination.value = res.pagination || { page: 1, totalPages: 1 }
  } catch (e: any) {
    if (e?.status === 401) {
      alert('登录已失效，请重新登录')
      router.push('/login')
    } else {
      alert('加载失败：' + (e?.data?.error || e?.message || '未知错误'))
    }
  } finally {
    loading.value = false
  }
}
function changePage(p: number) {
  if (p < 1 || p > pagination.value.totalPages) return
  load(p)
}

async function delPost(id: string) {
  if (!confirm('确定删除这篇文章吗？删除后不可恢复。')) return
  try {
    const res = await $fetch(`/api/community/posts/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    })
    if (res) load(pagination.value.page)
  } catch (e: any) {
    alert('删除失败：' + (e?.data?.error || e?.message || '未知错误'))
  }
}

load()
</script>

<style scoped>
.member-page { min-height: 100vh; background: #f7f4ec; }
.top-nav {
  display: flex; align-items: center; gap: 24px; padding: 14px 32px;
  background: #fbf8ef; border-bottom: 1px solid #e5ddca;
  font-family: "Noto Serif SC", "STSong", serif;
}
.nav-brand { font-weight: 700; color: #8b2f1d; text-decoration: none; font-size: 1.05rem; }
.nav-link { color: #5b5343; text-decoration: none; font-size: 0.92rem; }
.nav-link-active { color: #8b2f1d; font-weight: 600; }
.page-inner { max-width: 860px; margin: 0 auto; padding: 32px 20px 60px; }
.page-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
.page-header h1 { font-size: 1.4rem; color: #3a2f1d; font-family: "Noto Serif SC", "STSong", serif; margin: 0; }
.sub { color: #8a8373; font-size: 0.85rem; margin: 0; flex: 1; }
.write-btn {
  padding: 8px 18px; border-radius: 6px; background: #8b2f1d; color: #f6f1e3;
  text-decoration: none; font-size: 0.85rem; border: none; cursor: pointer;
}
.state-box { text-align: center; padding: 60px 0; color: #8a8373; }
.post-list { display: flex; flex-direction: column; gap: 12px; }
.post-item {
  display: flex; align-items: flex-start; gap: 10px; padding: 16px 18px;
  background: #fff; border: 1px solid #e5ddca; border-radius: 8px;
  transition: box-shadow 0.2s;
}
.post-item:hover { box-shadow: 0 3px 12px rgba(58, 47, 29, 0.08); }
.post-item--rejected { border-left: 3px solid #c0392b; }
.post-main { flex: 1; text-decoration: none; color: inherit; }
.post-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
.post-title { font-size: 1rem; font-weight: 600; color: #3a2f1d; }
.title-tipped { color: #8b2f1d; }
.status-tag { font-size: 0.7rem; padding: 2px 8px; border-radius: 4px; }
.status-tag--approved { background: rgba(46, 125, 50, 0.12); color: #2e7d32; }
.status-tag--pending { background: rgba(240, 173, 0, 0.15); color: #b8860b; }
.status-tag--rejected { background: rgba(192, 57, 43, 0.12); color: #c0392b; }
.reject-reason { font-size: 0.8rem; color: #c0392b; margin-bottom: 8px; }
.post-stats { display: flex; gap: 14px; font-size: 0.78rem; color: #8a8373; flex-wrap: wrap; }
.tip-num { color: #8b2f1d; }
.post-time { margin-left: auto; }
.del-btn {
  border: none; background: transparent; cursor: pointer; font-size: 1rem;
  opacity: 0.5; transition: opacity 0.2s; padding: 4px;
}
.del-btn:hover { opacity: 1; }
.pagination { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 28px; }
.pagination button {
  padding: 6px 14px; border: 1px solid #e5ddca; background: #fff; border-radius: 6px;
  cursor: pointer; font-size: 0.82rem;
}
.pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
