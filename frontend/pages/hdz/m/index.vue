<template>
  <div class="hdzm-app">
    <!-- 顶部栏 -->
    <nav class="hdzm-topbar">
      <div class="hdzm-topbar-left">
        <router-link to="/" class="hdzm-back">← 首页</router-link>
        <span class="hdzm-sep">|</span>
        <span class="hdzm-title">📚 小说工作台</span>
      </div>
      <div class="hdzm-topbar-right">
        <span class="hdzm-stat">{{ projects.length }} 部作品</span>
      </div>
    </nav>

    <!-- 列表 -->
    <div class="hdzm-content">
      <!-- 新建作品按钮 -->
      <button class="hdzm-new-btn" @click="showNewDialog = true">＋ 新建作品</button>

      <div v-if="loading" class="hdzm-loading">加载中...</div>
      <div v-else-if="projects.length === 0" class="hdzm-empty">
        <div class="hdzm-empty-icon">📖</div>
        <p>还没有小说项目</p>
        <p class="hdzm-empty-hint">点击上方按钮或先在电脑版新建</p>
      </div>
      <div v-else class="hdzm-list">
        <div v-for="p in projects" :key="p.id" class="hdzm-card" @click="goWorkspace(p.id)">
          <div class="hdzm-card-top">
            <span class="hdzm-tag">{{ genreIcon(p.genre) }} {{ p.genre || '未分类' }}</span>
            <span class="hdzm-status" :class="'hdzm-st--' + p.status">{{ statusLabel(p.status) }}</span>
          </div>
          <h3 class="hdzm-card-title">{{ p.title }}</h3>
          <div class="hdzm-card-meta">
            <span>📝 {{ p._count?.chapters || 0 }} 章</span>
            <span>👤 {{ p._count?.characters || 0 }} 角色</span>
            <span v-if="p.wordTarget">🎯 {{ formatNum(p.wordTarget) }}</span>
          </div>
          <div class="hdzm-progress-bar">
            <div class="hdzm-progress-fill" :style="{ width: progressPct(p) + '%' }"></div>
          </div>
          <div class="hdzm-progress-text">
            <span>{{ formatNum(p.wordCount || 0) }} 字</span>
            <span v-if="p.wordTarget">/ {{ formatNum(p.wordTarget) }} ({{ progressPct(p) }}%)</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部 Tab -->
    <nav class="hdzm-bottombar">
      <router-link to="/hdz/m" class="hdzm-tab hdzm-tab--active">
        <span class="hdzm-tab-icon">📖</span>
        <span class="hdzm-tab-label">书架</span>
      </router-link>
      <router-link to="/hdz/m" class="hdzm-tab">
        <span class="hdzm-tab-icon">✍️</span>
        <span class="hdzm-tab-label">写作</span>
      </router-link>
      <router-link to="/hdz/m" class="hdzm-tab">
        <span class="hdzm-tab-icon">👤</span>
        <span class="hdzm-tab-label">角色</span>
      </router-link>
      <router-link to="/hdz/m" class="hdzm-tab">
        <span class="hdzm-tab-icon">⚙️</span>
        <span class="hdzm-tab-label">设置</span>
      </router-link>
    </nav>

    <!-- 新建作品对话框 -->
    <div v-if="showNewDialog" class="hdzm-overlay" @click.self="showNewDialog = false">
      <div class="hdzm-dialog">
        <h3>新建作品</h3>
        <input v-model="newTitle" placeholder="作品名称" class="hdzm-input" maxlength="50" ref="titleInput" />
        <select v-model="newGenre" class="hdzm-input hdzm-select">
          <option value="">选择分类</option>
          <option value="武侠">武侠</option>
          <option value="仙侠">仙侠</option>
          <option value="都市">都市</option>
          <option value="科幻">科幻</option>
          <option value="悬疑">悬疑</option>
          <option value="言情">言情</option>
          <option value="历史">历史</option>
          <option value="奇幻">奇幻</option>
        </select>
        <div class="hdzm-dialog-actions">
          <button class="hdzm-btn hdzm-btn-cancel" @click="showNewDialog = false">取消</button>
          <button class="hdzm-btn hdzm-btn-primary" :disabled="!newTitle.trim() || creating" @click="doCreate">
            {{ creating ? '创建中...' : '创建' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const $api = (url: string, opts?: any) => fetch(url, {
  credentials: 'include',
  headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) },
  ...opts,
}).then(r => r.json())

const projects = ref<any[]>([])
const loading = ref(true)

// 新建作品
const showNewDialog = ref(false)
const newTitle = ref('')
const newGenre = ref('')
const creating = ref(false)
const titleInput = ref<HTMLInputElement>()

onMounted(async () => {
  try {
    const data: any = await $api('/api/hdz/projects')
    projects.value = (data.data || data.projects || data || []).map((p: any) => ({
      ...p,
      wordCount: p.wordCount || p._sum?.wordCount || 0,
    }))
  } catch (e) {
    console.warn('[HDZ] 加载失败', e)
  } finally {
    loading.value = false
  }
})

function goWorkspace(id: string) {
  router.push(`/hdz/m/workspace/${id}`)
}

async function doCreate() {
  if (!newTitle.value.trim() || creating.value) return
  creating.value = true
  try {
    const data: any = await $api('/api/hdz/projects', {
      method: 'POST',
      body: JSON.stringify({ title: newTitle.value.trim(), genre: newGenre.value }),
    })
    const project = data.data || data.project || data
    if (project?.id) {
      projects.value.unshift({ ...project, _count: { chapters: 0, characters: 0 } })
      showNewDialog.value = false
      newTitle.value = ''
      newGenre.value = ''
    }
  } catch (e) {
    console.warn('[HDZ] 创建失败', e)
  } finally {
    creating.value = false
  }
}

function statusLabel(s: string) {
  const map: Record<string, string> = { draft: '草稿', active: '连载中', completed: '已完结', abandoned: '已搁置' }
  return map[s] || s
}

function genreIcon(genre: string) {
  const map: Record<string, string> = { '武侠': '🗡️', '仙侠': '✨', '都市': '🌃', '科幻': '🚀', '悬疑': '🔍', '言情': '💕', '历史': '🏛️', '奇幻': '🦄' }
  return map[genre] || '📖'
}

function formatNum(n: number) {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

function progressPct(p: any) {
  if (!p.wordTarget || !p.wordCount) return 0
  return Math.min(100, Math.round((p.wordCount / p.wordTarget) * 100))
}
</script>

<style scoped>
.hdzm-app { min-height: 100vh; background: #f5f0e8; color: #333; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding-bottom: 56px; }
.hdzm-topbar { position: fixed; top: 0; left: 0; right: 0; z-index: 100; height: 44px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; background: rgba(245,240,232,0.92); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(0,0,0,0.06); }
.hdzm-topbar-left { display: flex; align-items: center; gap: 8px; }
.hdzm-back { font-size: 0.8rem; color: #8b7355; text-decoration: none; }
.hdzm-sep { color: rgba(0,0,0,0.12); }
.hdzm-title { font-size: 0.85rem; font-weight: 600; }
.hdzm-stat { font-size: 0.7rem; color: #999; }
.hdzm-content { margin-top: 44px; padding: 12px; }
.hdzm-loading { text-align: center; padding: 40px; color: #999; }
.hdzm-empty { text-align: center; padding: 60px 20px; }
.hdzm-empty-icon { font-size: 3rem; margin-bottom: 12px; }
.hdzm-empty p { font-size: 1rem; color: #999; margin: 4px 0; }
.hdzm-empty-hint { font-size: 0.8rem; color: #bbb; }
.hdzm-list { display: flex; flex-direction: column; gap: 10px; }

/* New project button */
.hdzm-new-btn { display: block; width: 100%; padding: 12px; margin-bottom: 12px; border: 2px dashed #ccc; border-radius: 10px; background: transparent; color: #8b7355; font-size: 0.85rem; cursor: pointer; transition: all 0.15s; }
.hdzm-new-btn:active { background: rgba(139,115,85,0.05); border-color: #8b7355; }

.hdzm-card { background: #faf7f0; border-radius: 10px; padding: 14px; border: 1px solid rgba(0,0,0,0.06); cursor: pointer; transition: all 0.15s; }
.hdzm-card:active { transform: scale(0.98); background: #f0ebe0; }
.hdzm-card-top { display: flex; justify-content: space-between; margin-bottom: 6px; }
.hdzm-tag { font-size: 0.6rem; padding: 1px 6px; border-radius: 3px; background: rgba(168,130,255,0.1); color: #7a5f9a; }
.hdzm-st--active { color: #4a9f6a; }
.hdzm-st--completed { color: #6b5a9f; }
.hdzm-st--draft { color: #999; }
.hdzm-status { font-size: 0.6rem; }
.hdzm-card-title { font-size: 0.9rem; font-weight: 600; margin: 0 0 6px; }
.hdzm-card-meta { display: flex; gap: 12px; font-size: 0.7rem; color: #999; margin-bottom: 6px; }

/* Progress bar */
.hdzm-progress-bar { height: 3px; background: rgba(0,0,0,0.06); border-radius: 2px; overflow: hidden; margin-bottom: 4px; }
.hdzm-progress-fill { height: 100%; background: linear-gradient(90deg, #8b7355, #a08b6e); border-radius: 2px; transition: width 0.3s; }
.hdzm-progress-text { display: flex; gap: 4px; font-size: 0.6rem; color: #aaa; }

/* Bottom tab bar */
.hdzm-bottombar { position: fixed; bottom: 0; left: 0; right: 0; z-index: 100; height: 48px; display: flex; background: rgba(250,247,240,0.95); backdrop-filter: blur(12px); border-top: 1px solid rgba(0,0,0,0.06); }
.hdzm-tab { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-decoration: none; color: #aaa; font-size: 0.6rem; gap: 1px; }
.hdzm-tab--active { color: #8b7355; }
.hdzm-tab-icon { font-size: 1.1rem; }
.hdzm-tab-label { font-size: 0.55rem; }

/* Dialog */
.hdzm-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; padding: 24px; }
.hdzm-dialog { background: #faf7f0; border-radius: 12px; padding: 20px; width: 100%; max-width: 320px; }
.hdzm-dialog h3 { margin: 0 0 12px; font-size: 1rem; }
.hdzm-input { width: 100%; padding: 10px 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 6px; font-size: 0.85rem; background: #fff; margin-bottom: 10px; box-sizing: border-box; }
.hdzm-select { appearance: auto; }
.hdzm-dialog-actions { display: flex; gap: 8px; margin-top: 8px; }
.hdzm-btn { flex: 1; padding: 10px; border-radius: 6px; font-size: 0.85rem; border: none; cursor: pointer; }
.hdzm-btn-cancel { background: rgba(0,0,0,0.05); color: #666; }
.hdzm-btn-primary { background: #8b7355; color: #fff; }
.hdzm-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
