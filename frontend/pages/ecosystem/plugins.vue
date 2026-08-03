<!-- SPRINT-ECO-10 — 插件发现中心（Plugin Marketplace Discovery MVP） -->
<!-- 范围：插件目录 + 搜索 + 分类 + 详情 + 安装 + License + 运行检查 -->
<!-- 禁止：支付页面 / 提现 / 推广入口 / 排行榜 / 推荐算法 / 评分造假 -->
<template>
  <div class="eco-plugins-page">
    <div class="page-header">
      <h1>🧩 插件中心</h1>
      <p class="page-subtitle">插件发现中心 — 官方 AI 员工插件，安装后由 License 授权运行（ECO-10 Discovery MVP）</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="state-box">
      <div class="spinner"></div>
      <p>加载插件目录...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="state-box error">
      <p>{{ error }}</p>
      <button class="btn-retry" @click="load">重试</button>
    </div>

    <div v-else class="discovery">
      <!-- 工具条：搜索 + 分类 -->
      <div class="toolbar">
        <input
          v-model="query"
          class="search-input"
          type="text"
          placeholder="搜索插件名称 / 描述..."
          @input="onSearch"
        />
        <div class="cat-tabs">
          <button
            v-for="t in CAT_TABS"
            :key="t.value"
            class="cat-tab"
            :class="{ active: typeFilter === t.value }"
            @click="setType(t.value)"
          >
            {{ t.label }}
          </button>
        </div>
      </div>

      <div class="summary-bar">
        <span>共 <strong>{{ items.length }}</strong> 个插件</span>
        <span class="pill official">官方</span>
        <span class="pill note">订阅价格登记 · 支付接入中</span>
      </div>

      <div class="plugin-grid">
        <div
          v-for="item in items"
          :key="item.pluginId"
          class="plugin-card"
          :class="{ selected: selected?.pluginId === item.pluginId }"
          @click="select(item.pluginId)"
        >
          <div class="plugin-head">
            <div class="plugin-icon">{{ iconFor(item.type) }}</div>
            <div class="plugin-title">
              <h3>{{ item.displayName }}</h3>
              <span class="plugin-author">{{ item.developer?.developerName }}</span>
            </div>
            <span v-if="installState(item)" class="install-badge" :class="installState(item).cls">
              {{ installState(item).label }}
            </span>
          </div>

          <p class="plugin-desc">{{ item.description }}</p>

          <div class="plugin-meta">
            <span class="meta-item type-tag">{{ typeLabel(item.type) }}</span>
            <span class="meta-item price">{{ priceLabel(item) }}</span>
            <span class="meta-item">v{{ item.latestVersion || '—' }}</span>
            <span class="meta-item rating">暂无评分</span>
          </div>

          <div class="plugin-foot">
            <button class="btn-detail" @click.stop="select(item.pluginId)">查看详情</button>
            <button
              v-if="!isInstalled(item)"
              class="btn-install"
              @click.stop="install(item.pluginId)"
              :disabled="installing === item.pluginId"
            >
              {{ installing === item.pluginId ? '安装中...' : '安装' }}
            </button>
            <span v-else class="installed-label">✓ 已安装</span>
          </div>
        </div>
      </div>

      <!-- 详情面板 -->
      <div v-if="detail" class="detail-panel">
        <div class="detail-head">
          <div class="plugin-icon large">{{ iconFor(detail.type) }}</div>
          <div class="detail-title">
            <h2>{{ detail.displayName }}</h2>
            <span class="plugin-author">{{ detail.developer?.developerName }} · v{{ detail.latestVersion }}</span>
          </div>
          <button class="btn-close" @click="detail = null">✕</button>
        </div>

        <p class="detail-desc">{{ detail.description }}</p>

        <div class="detail-grid">
          <div class="detail-block">
            <div class="block-title">订阅价格</div>
            <div class="price-big">{{ priceLabel(detail) }}</div>
            <div class="price-note">登记展示价，支付接入后生效（当前安装为免费授权登记）</div>
          </div>
          <div class="detail-block">
            <div class="block-title">需要应用</div>
            <div v-if="detail.application" class="app-need" @click="enterApp(detail.application)">
              {{ detail.application.name }}
              <span class="app-entry">{{ detail.application.workspaceEntry }} →</span>
            </div>
            <div v-else class="empty-tag">无（独立运行）</div>
          </div>
          <div class="detail-block">
            <div class="block-title">能力</div>
            <div class="cap-list">
              <span v-for="p in detail.manifest?.permissions || []" :key="p" class="cap-chip">
                {{ permLabel(p) }}
              </span>
              <span v-if="!detail.manifest?.permissions?.length" class="empty-tag">无</span>
            </div>
          </div>
          <div class="detail-block">
            <div class="block-title">权限清单</div>
            <div class="perm-list">
              <span v-for="p in detail.manifest?.permissions || []" :key="p" class="perm-chip">{{ p }}</span>
              <span v-if="!detail.manifest?.permissions?.length" class="empty-tag">无</span>
            </div>
          </div>
          <div class="detail-block">
            <div class="block-title">运行环境</div>
            <div class="cap-list">
              <span class="cap-chip">KAOR Runtime</span>
              <span class="cap-chip">{{ typeLabel(detail.type) }}</span>
            </div>
          </div>
        </div>

        <!-- 操作区：安装 / 卸载 / 运行检查 / License -->
        <div class="detail-actions">
          <button
            v-if="!isInstalled(detail)"
            class="btn-install big"
            @click="install(detail.pluginId)"
            :disabled="installing === detail.pluginId"
          >
            {{ installing === detail.pluginId ? '安装中...' : '申请安装（License 联动）' }}
          </button>
          <template v-else>
            <span class="license-info" :class="licenseBadge(detail).cls">{{ licenseBadge(detail).label }}</span>
            <button class="btn-check" @click="launchCheck(detail.pluginId)" :disabled="checking">
              {{ checking ? '检查中...' : '运行检查' }}
            </button>
            <button class="btn-uninstall" @click="uninstall(detail.pluginId)" :disabled="installing === detail.pluginId">
              卸载
            </button>
          </template>
        </div>

        <div v-if="checkResult" class="check-result" :class="checkResult.allowed ? 'ok' : 'deny'">
          {{ checkResult.allowed ? '✅ 可运行' : '⛔ ' + checkReasonLabel(checkResult.reason) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const items = ref<any[]>([])
const detail = ref<any>(null)
const loading = ref(true)
const error = ref('')
const query = ref('')
const typeFilter = ref('')
const installing = ref('')
const checking = ref(false)
const checkResult = ref<any>(null)
let searchTimer: any = null

const CAT_TABS = [
  { value: '', label: '全部' },
  { value: 'agent', label: 'AI员工' },
  { value: 'tool', label: '工具' },
  { value: 'workflow', label: 'Workflow' },
]

const TYPE_ICONS: Record<string, string> = { agent: '🤖', tool: '🔧', workflow: '🔀' }
const TYPE_LABELS: Record<string, string> = { agent: 'AI员工', tool: '工具', workflow: 'Workflow' }
const PERM_LABELS: Record<string, string> = {
  browser: '浏览器控制', content: '内容读写', analytics: '数据分析',
  storage: '存储', network: '网络', automation: '自动化',
}

function iconFor(type: string): string { return TYPE_ICONS[type] || '📦' }
function typeLabel(type: string): string { return TYPE_LABELS[type] || type }
function permLabel(p: string): string { return PERM_LABELS[p] || p }

function priceLabel(item: any): string {
  if (item.pricingModel === 'FREE' || !item.price) return '免费'
  return `¥${item.price}/月`
}

function isInstalled(item: any): boolean {
  const s = item.install?.status
  return s === 'INSTALLED' || s === 'DISABLED'
}
function installState(item: any): { label: string; cls: string } | null {
  const s = item.install?.status
  if (!s) return null
  if (s === 'INSTALLED') return { label: '已安装', cls: 'ok' }
  if (s === 'DISABLED') return { label: '已禁用', cls: 'warn' }
  if (s === 'INSTALL_REQUEST') return { label: '安装中', cls: 'warn' }
  if (s === 'REMOVED') return null
  return { label: s, cls: 'warn' }
}
function licenseBadge(item: any): { label: string; cls: string } {
  const l = item.install?.licenseId
  return l ? { label: `License ACTIVE · 订阅授权`, cls: 'ok' } : { label: '无 License', cls: 'warn' }
}
function checkReasonLabel(reason: string): string {
  return { NOT_INSTALLED: '未安装，不可运行', NO_LICENSE: '无 License，不可运行', EXPIRED: 'License 已过期', SUSPENDED: 'License 已挂起' }[reason] || reason
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams()
    if (query.value.trim()) params.set('q', query.value.trim())
    if (typeFilter.value) params.set('type', typeFilter.value)
    const res = await fetch(`/api/ecosystem/marketplace/items?${params.toString()}`)
    const body = await res.json()
    if (body.code !== 0) throw new Error(body.message || '加载失败')
    items.value = body.data.items
    // 详情同步刷新（保持当前选中插件一致）
    if (detail.value) {
      const cur = items.value.find(i => i.pluginId === detail.value.pluginId)
      if (cur) detail.value = { ...detail.value, install: cur.install }
    }
  } catch (e: any) {
    error.value = `插件目录加载失败：${e.message}`
  } finally {
    loading.value = false
  }
}

function onSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 300)
}
function setType(t: string) {
  typeFilter.value = t
  load()
}

async function select(pluginId: string) {
  checkResult.value = null
  try {
    const res = await fetch(`/api/ecosystem/marketplace/items/${pluginId}`)
    const body = await res.json()
    if (body.code !== 0) throw new Error(body.message || '详情加载失败')
    detail.value = body.data.item
  } catch (e: any) {
    error.value = `详情加载失败：${e.message}`
  }
}

async function install(pluginId: string) {
  installing.value = pluginId
  checkResult.value = null
  try {
    const res = await fetch('/api/ecosystem/marketplace/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pluginId }),
    })
    const body = await res.json()
    if (body.code !== 0) throw new Error(body.message || '安装失败')
    await load()
    if (detail.value?.pluginId === pluginId) {
      detail.value = { ...detail.value, install: body.data.install }
    }
  } catch (e: any) {
    error.value = `安装失败：${e.message}`
  } finally {
    installing.value = ''
  }
}

async function uninstall(pluginId: string) {
  installing.value = pluginId
  checkResult.value = null
  try {
    const res = await fetch('/api/ecosystem/marketplace/uninstall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pluginId }),
    })
    const body = await res.json()
    if (body.code !== 0) throw new Error(body.message || '卸载失败')
    await load()
    if (detail.value?.pluginId === pluginId) {
      detail.value = { ...detail.value, install: body.data.install }
    }
  } catch (e: any) {
    error.value = `卸载失败：${e.message}`
  } finally {
    installing.value = ''
  }
}

async function launchCheck(pluginId: string) {
  checking.value = true
  checkResult.value = null
  try {
    const res = await fetch('/api/ecosystem/marketplace/launch-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pluginId }),
    })
    const body = await res.json()
    if (body.code !== 0) throw new Error(body.message || '检查失败')
    checkResult.value = body.data
  } catch (e: any) {
    error.value = `运行检查失败：${e.message}`
  } finally {
    checking.value = false
  }
}

function enterApp(app: any) {
  if (app.workspaceEntry) window.location.href = app.workspaceEntry
}

onMounted(load)
</script>

<style scoped>
.eco-plugins-page {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.page-header h1 { font-size: 24px; margin: 0 0 4px; }
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

.toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
.search-input {
  flex: 1; min-width: 220px; padding: 8px 12px; border: 1px solid #d1d5db;
  border-radius: 8px; font-size: 14px; outline: none;
}
.search-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
.cat-tabs { display: flex; gap: 6px; }
.cat-tab {
  padding: 6px 14px; border: 1px solid #d1d5db; border-radius: 8px;
  background: #fff; font-size: 13px; cursor: pointer; color: #374151;
}
.cat-tab.active { background: #2563eb; color: #fff; border-color: #2563eb; }

.summary-bar { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; color: #555; font-size: 13px; flex-wrap: wrap; }
.pill { padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
.pill.official { background: #dbeafe; color: #1d4ed8; }
.pill.note { background: #fef3c7; color: #92400e; font-weight: 500; }

.plugin-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
.plugin-card {
  border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px;
  background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  display: flex; flex-direction: column; gap: 10px;
  cursor: pointer; transition: box-shadow .15s, transform .15s;
}
.plugin-card:hover { box-shadow: 0 4px 14px rgba(37,99,235,0.14); transform: translateY(-2px); }
.plugin-card.selected { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.25); }
.plugin-head { display: flex; align-items: center; gap: 10px; }
.plugin-icon { font-size: 28px; }
.plugin-title { flex: 1; }
.plugin-title h3 { margin: 0; font-size: 16px; }
.plugin-author { color: #9ca3af; font-size: 12px; }
.install-badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
.install-badge.ok { background: #dcfce7; color: #15803d; }
.install-badge.warn { background: #fef3c7; color: #92400e; }
.plugin-desc { color: #4b5563; font-size: 13px; line-height: 1.5; margin: 0; min-height: 38px; }
.plugin-meta { display: flex; gap: 8px; flex-wrap: wrap; }
.meta-item { background: #f3f4f6; padding: 2px 8px; border-radius: 6px; font-size: 12px; color: #374151; }
.meta-item.price { background: #eff6ff; color: #1d4ed8; font-weight: 600; }
.meta-item.rating { color: #9ca3af; background: #f9fafb; }
.type-tag { font-weight: 600; }
.plugin-foot { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f3f4f6; padding-top: 10px; }
.btn-detail {
  padding: 5px 14px; background: #fff; color: #2563eb; border: 1px solid #bfdbfe;
  border-radius: 6px; font-size: 12px; cursor: pointer;
}
.btn-detail:hover { background: #eff6ff; }
.btn-install {
  padding: 5px 14px; background: #2563eb; color: #fff; border: none;
  border-radius: 6px; font-size: 12px; cursor: pointer;
}
.btn-install:hover:not(:disabled) { background: #1d4ed8; }
.btn-install:disabled { opacity: 0.6; cursor: wait; }
.btn-install.big { padding: 8px 20px; font-size: 14px; }
.installed-label { color: #15803d; font-size: 12px; font-weight: 600; }

.detail-panel {
  margin-top: 20px; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 20px; background: #fafbfc;
}
.detail-head { display: flex; align-items: center; gap: 12px; }
.plugin-icon.large { font-size: 40px; }
.detail-title { flex: 1; }
.detail-title h2 { margin: 0; font-size: 20px; }
.btn-close {
  border: none; background: transparent; font-size: 16px; cursor: pointer; color: #6b7280;
}
.btn-close:hover { color: #111827; }
.detail-desc { color: #4b5563; font-size: 14px; line-height: 1.6; margin: 12px 0; }
.detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
.detail-block { background: #fff; border: 1px solid #eef0f2; border-radius: 10px; padding: 12px; }
.block-title { font-size: 12px; color: #6b7280; font-weight: 600; margin-bottom: 8px; }
.price-big { font-size: 22px; font-weight: 700; color: #1d4ed8; }
.price-note { font-size: 11px; color: #9ca3af; margin-top: 4px; }
.app-need { cursor: pointer; color: #2563eb; font-size: 14px; font-weight: 500; }
.app-need:hover { text-decoration: underline; }
.app-entry { color: #9ca3af; font-size: 12px; font-family: monospace; }
.cap-list, .perm-list { display: flex; flex-wrap: wrap; gap: 6px; }
.cap-chip { background: #eff6ff; color: #1d4ed8; font-size: 12px; padding: 2px 8px; border-radius: 6px; }
.perm-chip { background: #f5f3ff; color: #6d28d9; font-size: 11px; padding: 2px 8px; border-radius: 6px; font-family: monospace; }
.empty-tag { color: #9ca3af; font-size: 12px; }
.detail-actions { display: flex; gap: 10px; align-items: center; margin-top: 16px; flex-wrap: wrap; }
.license-info { font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 8px; }
.license-info.ok { background: #dcfce7; color: #15803d; }
.license-info.warn { background: #fef3c7; color: #92400e; }
.btn-check {
  padding: 7px 16px; background: #fff; color: #374151; border: 1px solid #d1d5db;
  border-radius: 6px; font-size: 13px; cursor: pointer;
}
.btn-check:hover:not(:disabled) { background: #f3f4f6; }
.btn-check:disabled { opacity: 0.6; }
.btn-uninstall {
  padding: 7px 16px; background: #fff; color: #dc2626; border: 1px solid #fecaca;
  border-radius: 6px; font-size: 13px; cursor: pointer;
}
.btn-uninstall:hover:not(:disabled) { background: #fef2f2; }
.btn-uninstall:disabled { opacity: 0.6; }
.check-result { margin-top: 12px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; }
.check-result.ok { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
.check-result.deny { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
</style>
