<template>
  <div class="member-page">
    <nav class="top-nav">
      <NuxtLink to="/" class="nav-brand">🏮 昆仑镜</NuxtLink>
      <NuxtLink to="/community" class="nav-link">社区</NuxtLink>
      <NuxtLink to="/user/center" class="nav-link nav-link-active">会员中心</NuxtLink>
    </nav>

    <div class="page-inner">
      <div class="page-header">
        <h1>↗️ 我的转发</h1>
        <p class="sub">转发过的社区文章</p>
        <NuxtLink to="/community" class="write-btn">去社区逛逛 →</NuxtLink>
      </div>

      <div v-if="loading" class="state-box">加载中...</div>
      <div v-else-if="items.length === 0" class="state-box">
        <p>还没有转发过文章</p>
        <p class="hint">看到好文章点 ↗️ 即可转发分享</p>
      </div>
      <div v-else class="post-list">
        <div v-for="p in items" :key="p.id" class="post-item">
          <NuxtLink :to="`/community/post/${p.id}`" class="post-main">
            <div class="post-title-row">
              <span class="category-tag">{{ p.category }}</span>
              <span class="post-title">{{ p.title }}</span>
            </div>
            <div class="post-stats">
              <span>👤 {{ p.user?.username || '匿名' }}</span>
              <span>👍 {{ p.likeCount }}</span>
              <span>💬 {{ p.commentCount }}</span>
              <span>🔖 {{ p.favoriteCount }}</span>
              <span class="post-time">{{ timeStr(p.createdAt) }}</span>
            </div>
          </NuxtLink>
          <a class="del-btn" title="复制链接" @click="copyLink(p.id)">🔗</a>
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
const items = ref<any[]>([])
const loading = ref(true)
const pagination = ref({ page: 1, totalPages: 1 })

function timeStr(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

async function load(page = 1) {
  loading.value = true
  try {
    const res = await $fetch(`/api/community/my/shares?page=${page}&pageSize=20`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    })
    items.value = res.shares || []
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

async function copyLink(postId: string) {
  const url = `${window.location.origin}/community/post/${postId}`
  try {
    await navigator.clipboard.writeText(url)
    alert('链接已复制：' + url)
  } catch {
    alert('链接：' + url)
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
.hint { font-size: 0.8rem; color: #b5ad9c; margin-top: 8px; }
.post-list { display: flex; flex-direction: column; gap: 12px; }
.post-item {
  display: flex; align-items: flex-start; gap: 10px; padding: 16px 18px;
  background: #fff; border: 1px solid #e5ddca; border-radius: 8px;
  transition: box-shadow 0.2s;
}
.post-item:hover { box-shadow: 0 3px 12px rgba(58, 47, 29, 0.08); }
.post-main { flex: 1; text-decoration: none; color: inherit; }
.post-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
.post-title { font-size: 1rem; font-weight: 600; color: #3a2f1d; }
.category-tag { font-size: 0.7rem; padding: 2px 8px; border-radius: 3px; background: rgba(95, 168, 190, 0.14); color: #2c5f73; }
.post-stats { display: flex; gap: 14px; font-size: 0.78rem; color: #8a8373; flex-wrap: wrap; }
.post-time { margin-left: auto; }
.del-btn {
  border: none; background: transparent; cursor: pointer; font-size: 1rem;
  opacity: 0.55; transition: opacity 0.2s; padding: 4px; text-decoration: none;
}
.del-btn:hover { opacity: 1; }
.pagination { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 28px; }
.pagination button {
  padding: 6px 14px; border: 1px solid #e5ddca; background: #fff; border-radius: 6px;
  cursor: pointer; font-size: 0.82rem;
}
.pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
