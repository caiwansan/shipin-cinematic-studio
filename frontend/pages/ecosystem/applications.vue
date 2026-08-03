<!-- SPRINT-ECO-01 — 应用中心（只读） -->
<!-- 生态身份证展示：9 内置应用身份 + 能力声明 + 组织安装状态 -->
<!-- 纪律：只读展示，不做商城、不改工作台 -->
<template>
  <div class="eco-apps-page">
    <div class="page-header">
      <div class="page-header-top">
        <EcosystemEcoBackHome />
      </div>
      <h1>🧩 应用中心</h1>
      <p class="page-subtitle">昆仑镜 AI 应用生态 — 9 大应用，点击进入对应工作台（ECO-09 Application Center Navigation）</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="state-box">
      <div class="spinner"></div>
      <p>加载应用目录...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="state-box error">
      <p>{{ error }}</p>
      <button class="btn-retry" @click="load">重试</button>
    </div>

    <!-- Catalog -->
    <div v-else class="catalog">
      <div class="summary-bar">
        <span>共 <strong>{{ apps.length }}</strong> 个内置应用</span>
        <span class="pill builtin">BUILT_IN</span>
        <span class="pill lifecycle">ACTIVE</span>
      </div>

      <div class="app-grid">
        <div v-for="app in apps" :key="app.slug" class="app-card" @click="enter(app)">
          <div class="app-head">
            <div class="app-icon">{{ iconFor(app.category) }}</div>
            <div class="app-title">
              <h3>{{ app.name }}</h3>
              <span class="app-slug">{{ app.slug }}</span>
            </div>
            <span v-if="app.installed" class="install-badge">已安装</span>
          </div>

          <p class="app-desc">{{ app.description }}</p>

          <div class="app-meta">
            <span class="meta-item">v{{ app.latestVersion || '—' }}</span>
            <span class="meta-item">{{ categoryLabel(app.category) }}</span>
            <span class="meta-item">{{ app.lifecycleState }}</span>
          </div>

          <div class="app-section">
            <div class="section-title">能力声明</div>
            <div class="cap-list">
              <span v-for="cap in app.capabilities" :key="cap.code" class="cap-chip" :title="cap.description">
                {{ cap.name }}
              </span>
              <span v-if="!app.capabilities?.length" class="empty-tag">无</span>
            </div>
          </div>

          <div class="app-section">
            <div class="section-title">权限清单</div>
            <div class="perm-list">
              <span v-for="p in app.permissions" :key="p.permission" class="perm-chip">
                {{ p.permission }}
              </span>
              <span v-if="!app.permissions?.length" class="empty-tag">无</span>
            </div>
          </div>

          <div class="app-foot">
            <button class="btn-enter" @click.stop="enter(app)">进入工作台 →</button>
            <button v-if="!app.installed" class="btn-install" @click.stop="install(app.slug)">安装到组织</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const apps = ref<any[]>([])
const loading = ref(true)
const error = ref('')

const CATEGORY_ICONS: Record<string, string> = {
  media: '📱', drama: '🎬', novel: '📖', recruit: '💼', legal: '⚖️',
  mall: '🛒', music: '🎵', ad: '📣', geo: '🌐',
}
const CATEGORY_LABELS: Record<string, string> = {
  media: '新媒体', drama: '短剧', novel: '小说', recruit: '招聘', legal: '法律',
  mall: '商城', music: '音乐', ad: '广告', geo: 'GEO',
}

function iconFor(category: string): string {
  return CATEGORY_ICONS[category] || '📦'
}
function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/ecosystem/applications')
    const body = await res.json()
    if (body.code !== 0) throw new Error(body.message || '加载失败')
    apps.value = body.data.applications
  } catch (e: any) {
    error.value = `应用目录加载失败：${e.message}`
  } finally {
    loading.value = false
  }
}

async function install(slug: string) {
  try {
    const res = await fetch(`/api/ecosystem/applications/${slug}/install`, { method: 'POST' })
    const body = await res.json()
    if (body.code !== 0) throw new Error(body.message || '安装失败')
    await load()
  } catch (e: any) {
    error.value = `安装失败：${e.message}`
  }
}

function enter(app: any) {
  if (app.workspaceEntry) {
    window.location.href = app.workspaceEntry
  }
}

onMounted(load)
</script>

<style scoped>
.eco-apps-page {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.page-header h1 { font-size: 24px; margin: 0 0 4px; }
.page-header-top { margin-bottom: 12px; }
.page-subtitle { color: #666; margin: 0 0 16px; font-size: 14px; }
.state-box { text-align: center; padding: 60px 0; color: #666; }
.state-box.error { color: #c0392b; }
.spinner {
  width: 32px; height: 32px; margin: 0 auto 12px;
  border: 3px solid #e0e0e0; border-top-color: #3b82f6; border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.btn-retry { padding: 6px 16px; border: 1px solid #ccc; border-radius: 6px; cursor: pointer; background: #fff; }
.summary-bar { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; color: #555; font-size: 13px; }
.pill { padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
.pill.builtin { background: #dbeafe; color: #1d4ed8; }
.pill.lifecycle { background: #dcfce7; color: #15803d; }
.app-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
.app-card {
  border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px;
  background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  display: flex; flex-direction: column; gap: 10px;
  cursor: pointer; transition: box-shadow .15s, transform .15s;
}
.app-card:hover { box-shadow: 0 4px 14px rgba(37,99,235,0.14); transform: translateY(-2px); }
.app-head { display: flex; align-items: center; gap: 10px; }
.app-icon { font-size: 28px; }
.app-title { flex: 1; }
.app-title h3 { margin: 0; font-size: 16px; }
.app-slug { color: #9ca3af; font-size: 12px; font-family: monospace; }
.install-badge { background: #dcfce7; color: #15803d; font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
.app-desc { color: #4b5563; font-size: 13px; line-height: 1.5; margin: 0; min-height: 38px; }
.app-meta { display: flex; gap: 8px; flex-wrap: wrap; }
.meta-item { background: #f3f4f6; padding: 2px 8px; border-radius: 6px; font-size: 12px; color: #374151; }
.app-section .section-title { font-size: 12px; color: #6b7280; font-weight: 600; margin-bottom: 6px; }
.cap-list, .perm-list { display: flex; flex-wrap: wrap; gap: 6px; }
.cap-chip { background: #eff6ff; color: #1d4ed8; font-size: 12px; padding: 2px 8px; border-radius: 6px; }
.perm-chip { background: #f5f3ff; color: #6d28d9; font-size: 11px; padding: 2px 8px; border-radius: 6px; font-family: monospace; }
.empty-tag { color: #9ca3af; font-size: 12px; }
.app-foot { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f3f4f6; padding-top: 10px; }
.btn-enter {
  background: #2563eb; color: #fff; border: none; border-radius: 6px;
  padding: 6px 14px; font-size: 13px; cursor: pointer; transition: background .15s;
}
.btn-enter:hover { background: #1d4ed8; }
.entry { font-size: 12px; color: #9ca3af; font-family: monospace; }
.btn-install {
  padding: 5px 14px; background: #3b82f6; color: #fff; border: none;
  border-radius: 6px; font-size: 12px; cursor: pointer;
}
.btn-install:hover { background: #2563eb; }
</style>
