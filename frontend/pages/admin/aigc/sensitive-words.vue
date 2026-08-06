<!--
  pages/admin/aigc/sensitive-words.vue — 昆仑茶馆内容治理（SPRINT-IM-CHA-03 M3）
  敏感词库管理（领导人/政治/宗教/色情/毒品/赌博/性器官）+ 机器人管理员处置日志
-->
<template>
  <div class="sw-admin">
    <div class="admin-head">
      <div>
        <h1 class="admin-title">🛡️ 敏感词管理 · 昆仑茶馆</h1>
        <p class="admin-sub">敏感词即时替换（客户端+服务端双保险）· 昆仑镜小管家机器人自动复核处置</p>
      </div>
      <div class="head-actions">
        <button class="add-btn" @click="openEdit(null)">+ 新增敏感词</button>
        <button class="ghost-btn" @click="openImport">📥 批量导入</button>
        <button class="ghost-btn" @click="reseed" :disabled="reseedBusy">{{ reseedBusy ? '重置中...' : '♻️ 重置内置词库' }}</button>
      </div>
    </div>

    <!-- 统计卡 -->
    <div class="stats-row">
      <div class="stat-card"><span class="stat-num">{{ stats.totalWords }}</span><span class="stat-label">词库总数</span></div>
      <div class="stat-card"><span class="stat-num">{{ stats.activeWords }}</span><span class="stat-label">启用中</span></div>
      <div class="stat-card"><span class="stat-num">{{ stats.todayLogs }}</span><span class="stat-label">今日处置</span></div>
      <div class="stat-card"><span class="stat-num">{{ stats.kicks }}</span><span class="stat-label">累计踢出</span></div>
    </div>

    <!-- Tab 切换 -->
    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'words' }" @click="tab = 'words'">📖 敏感词库</button>
      <button class="tab" :class="{ active: tab === 'logs' }" @click="tab = 'logs'; loadLogs()">🧾 审核日志</button>
    </div>

    <!-- 词库 Tab -->
    <div v-if="tab === 'words'">
      <div class="toolbar">
        <input v-model="search" placeholder="搜索敏感词..." class="search-input" @input="debouncedLoad()" />
        <select v-model="category" class="cat-select" @change="load()">
          <option value="">全部分类</option>
          <option v-for="c in categories" :key="c.key" :value="c.key">{{ c.label }}</option>
        </select>
        <span class="total-tip">共 {{ total }} 词</span>
      </div>
      <div class="list-card">
        <div class="table-head">
          <span class="col-word">敏感词</span>
          <span class="col-cat">分类</span>
          <span class="col-level">等级</span>
          <span class="col-status">状态</span>
          <span class="col-ops">操作</span>
        </div>
        <div v-for="w in items" :key="w.id" class="table-row">
          <span class="col-word word-cell">{{ w.word }}</span>
          <span class="col-cat"><span class="cat-badge" :class="'cat-' + w.category">{{ catLabel(w.category) }}</span></span>
          <span class="col-level"><span class="level-badge" :class="'lv' + w.level">{{ levelLabel(w.level) }}</span></span>
          <span class="col-status">
            <button class="status-toggle" :class="w.isActive ? 'on' : 'off'" @click="toggleActive(w)">
              {{ w.isActive ? '启用' : '停用' }}
            </button>
          </span>
          <span class="col-ops">
            <button class="op-btn" @click="openEdit(w)">编辑</button>
            <button class="op-btn danger" @click="removeWord(w)">删除</button>
          </span>
        </div>
        <div v-if="!items.length" class="empty">暂无敏感词，点击右上角「新增敏感词」或「重置内置词库」</div>
        <div v-if="total > pageSize" class="pager">
          <button class="pg-btn" :disabled="page <= 1" @click="page--; load()">‹</button>
          <span>{{ page }} / {{ Math.ceil(total / pageSize) }}</span>
          <button class="pg-btn" :disabled="page >= Math.ceil(total / pageSize)" @click="page++; load()">›</button>
        </div>
      </div>
    </div>

    <!-- 审核日志 Tab -->
    <div v-else>
      <div class="toolbar">
        <select v-model="logAction" class="cat-select" @change="loadLogs()">
          <option value="">全部处置</option>
          <option value="kick">踢出（高敏）</option>
          <option value="notice">提醒（中敏）</option>
          <option value="replace">替换</option>
        </select>
        <span class="total-tip">共 {{ logTotal }} 条处置记录</span>
      </div>
      <div class="list-card">
        <div class="table-head logs-head">
          <span class="lg-time">时间</span>
          <span class="lg-user">用户</span>
          <span class="lg-matched">命中词</span>
          <span class="lg-level">等级</span>
          <span class="lg-action">处置</span>
          <span class="lg-content">消息内容</span>
        </div>
        <div v-for="l in logs" :key="l.id" class="table-row logs-row">
          <span class="lg-time">{{ fmtTime(l.createdAt) }}</span>
          <span class="lg-user">{{ l.userName || l.uid.slice(0, 8) }}</span>
          <span class="lg-matched"><span v-for="m in l.matched.split(',')" :key="m" class="match-tag">{{ m }}</span></span>
          <span class="lg-level"><span class="level-badge" :class="'lv' + l.level">{{ l.level }}</span></span>
          <span class="lg-action"><span class="action-tag" :class="l.action">{{ actionLabel(l.action) }}</span></span>
          <span class="lg-content content-cell" :title="l.content">{{ l.content }}</span>
        </div>
        <div v-if="!logs.length" class="empty">暂无审核记录（敏感词被客户端即时替换后通常不会到达此处）</div>
        <div v-if="logTotal > pageSize" class="pager">
          <button class="pg-btn" :disabled="logPage <= 1" @click="logPage--; loadLogs()">‹</button>
          <span>{{ logPage }} / {{ Math.ceil(logTotal / pageSize) }}</span>
          <button class="pg-btn" :disabled="logPage >= Math.ceil(logTotal / pageSize)" @click="logPage++; loadLogs()">›</button>
        </div>
      </div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <div v-if="editing" class="modal-mask" @click.self="editing = null">
      <div class="modal-card">
        <button class="modal-close" @click="editing = null">✕</button>
        <h3>{{ editing.id ? '编辑敏感词' : '新增敏感词' }}</h3>
        <div class="form-grid">
          <label class="form-field">
            <span>敏感词</span>
            <input v-model="form.word" placeholder="输入需要过滤的词" class="form-input" />
          </label>
          <label class="form-field">
            <span>分类</span>
            <select v-model="form.category" class="form-input">
              <option v-for="c in categories" :key="c.key" :value="c.key">{{ c.label }}</option>
            </select>
          </label>
          <label class="form-field">
            <span>等级</span>
            <select v-model.number="form.level" class="form-input">
              <option :value="2">2 · 替换+审计</option>
              <option :value="3">3 · 替换+审计+提醒</option>
              <option :value="4">4 · 替换+审计+踢出（高敏）</option>
            </select>
          </label>
          <label class="form-field check-field">
            <input v-model="form.isActive" type="checkbox" />
            <span>启用</span>
          </label>
        </div>
        <p class="form-tip">💡 高敏词（领导人/政治/宗教/毒品）建议等级 4：客户端即时替换 + 服务端复核命中自动踢出并审计</p>
        <div class="form-actions">
          <button class="btn-ghost" @click="editing = null">取消</button>
          <button class="btn-save" :disabled="saving" @click="saveWord">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 批量导入弹窗 -->
    <div v-if="importing" class="modal-mask" @click.self="importing = false">
      <div class="modal-card">
        <button class="modal-close" @click="importing = false">✕</button>
        <h3>📥 批量导入敏感词</h3>
        <p class="form-tip">每行一个词；支持「词|分类|等级」格式（分类：leader/politics/religion/porn/drug/gambling/body/other；等级 2/3/4），缺省用下方默认值</p>
        <label class="form-field">
          <span>默认分类</span>
          <select v-model="importForm.category" class="form-input">
            <option v-for="c in categories" :key="c.key" :value="c.key">{{ c.label }}</option>
          </select>
        </label>
        <label class="form-field">
          <span>默认等级</span>
          <select v-model.number="importForm.level" class="form-input">
            <option :value="2">2</option>
            <option :value="3">3</option>
            <option :value="4">4</option>
          </select>
        </label>
        <label class="form-field">
          <span>词列表（每行一个）</span>
          <textarea v-model="importForm.text" rows="8" placeholder="敏感词1&#10;敏感词2|porn|3" class="form-input textarea"></textarea>
        </label>
        <div class="form-actions">
          <button class="btn-ghost" @click="importing = false">取消</button>
          <button class="btn-save" :disabled="importingBusy" @click="doImport">{{ importingBusy ? '导入中...' : '导入' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
definePageMeta({ layout: 'admin-aigc' })

const tab = ref<'words' | 'logs'>('words')
const items = ref<any[]>([])
const categories = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const search = ref('')
const category = ref('')
const editing = ref<any>(null)
const saving = ref(false)
const form = ref<any>({ word: '', category: 'other', level: 2, isActive: true })
const stats = ref<any>({ totalWords: 0, activeWords: 0, todayLogs: 0, kicks: 0 })
const reseedBusy = ref(false)
const importing = ref(false)
const importingBusy = ref(false)
const importForm = ref<any>({ text: '', category: 'other', level: 2 })
// 日志
const logs = ref<any[]>([])
const logTotal = ref(0)
const logPage = ref(1)
const logAction = ref('')

function adminToken() {
  try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' }
}

function catLabel(key: string) {
  return categories.value.find((c) => c.key === key)?.label || key
}

function levelLabel(lv: number) {
  return lv >= 4 ? '4 高敏' : lv === 3 ? '3 中敏' : '2 常规'
}

function actionLabel(a: string) {
  return { kick: '踢出', notice: '提醒', replace: '替换' }[a] || a
}

function fmtTime(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

async function load() {
  try {
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize) })
    if (search.value) params.set('q', search.value)
    if (category.value) params.set('category', category.value)
    const r = await fetch('/api/admin/im/sensitive-words?' + params, { headers: { Authorization: 'Bearer ' + adminToken() } })
    const j = await r.json()
    items.value = j.data?.items || []
    total.value = j.data?.total || 0
    if (j.data?.categories) categories.value = j.data.categories
  } catch { items.value = [] }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
function debouncedLoad() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { page.value = 1; load() }, 300)
}

async function loadStats() {
  try {
    const r = await fetch('/api/admin/im/moderation/stats', { headers: { Authorization: 'Bearer ' + adminToken() } })
    const j = await r.json()
    stats.value = j.data || stats.value
  } catch { /* 非致命 */ }
}

async function loadLogs() {
  try {
    const params = new URLSearchParams({ page: String(logPage.value), pageSize: String(pageSize) })
    if (logAction.value) params.set('action', logAction.value)
    const r = await fetch('/api/admin/im/moderation-logs?' + params, { headers: { Authorization: 'Bearer ' + adminToken() } })
    const j = await r.json()
    logs.value = j.data?.items || []
    logTotal.value = j.data?.total || 0
  } catch { logs.value = [] }
}

function openEdit(w: any) {
  editing.value = w
  form.value = w ? { ...w } : { word: '', category: 'other', level: 2, isActive: true }
}

async function saveWord() {
  if (!form.value.word?.trim()) { alert('请输入敏感词'); return }
  saving.value = true
  try {
    const url = editing.value?.id ? '/api/admin/im/sensitive-words/' + editing.value.id : '/api/admin/im/sensitive-words'
    const method = editing.value?.id ? 'PUT' : 'POST'
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken() },
      body: JSON.stringify(form.value),
    })
    const j = await r.json()
    if (!j.success) throw new Error(j.error || '保存失败')
    editing.value = null
    load(); loadStats()
  } catch (e: any) {
    alert('⚠ ' + (e.message || '保存失败'))
  } finally { saving.value = false }
}

async function toggleActive(w: any) {
  try {
    await fetch('/api/admin/im/sensitive-words/' + w.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken() },
      body: JSON.stringify({ isActive: !w.isActive }),
    })
    load(); loadStats()
  } catch { /* 非致命 */ }
}

async function removeWord(w: any) {
  if (!confirm('确认删除「' + w.word + '」？')) return
  try {
    await fetch('/api/admin/im/sensitive-words/' + w.id, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + adminToken() },
    })
    load(); loadStats()
  } catch { /* 非致命 */ }
}

function openImport() {
  importForm.value = { text: '', category: 'other', level: 2 }
  importing.value = true
}

async function doImport() {
  if (!importForm.value.text?.trim()) { alert('请输入词列表'); return }
  importingBusy.value = true
  try {
    const r = await fetch('/api/admin/im/sensitive-words/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken() },
      body: JSON.stringify(importForm.value),
    })
    const j = await r.json()
    if (!j.success) throw new Error(j.error || '导入失败')
    alert(`✅ 导入完成：新增 ${j.data?.inserted || 0}，跳过重复 ${j.data?.skipped || 0}`)
    importing.value = false
    load(); loadStats()
  } catch (e: any) {
    alert('⚠ ' + (e.message || '导入失败'))
  } finally { importingBusy.value = false }
}

async function reseed() {
  if (!confirm('将清空当前词库并恢复为内置词库（约 300 词），确认继续？')) return
  reseedBusy.value = true
  try {
    const r = await fetch('/api/admin/im/sensitive-words/reseed', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + adminToken() },
    })
    const j = await r.json()
    if (!j.success) throw new Error(j.error || '重置失败')
    alert(`✅ 已重置为内置词库（${j.data?.inserted || 0} 词）`)
    page.value = 1
    load(); loadStats()
  } catch (e: any) {
    alert('⚠ ' + (e.message || '重置失败'))
  } finally { reseedBusy.value = false }
}

onMounted(() => { load(); loadStats() })
</script>

<style scoped>
.sw-admin { padding: 4px; color: #e2e8f0; }
.admin-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }
.admin-title { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
.admin-sub { font-size: 12px; color: #64748b; margin: 0; }
.head-actions { display: flex; gap: 8px; }
.add-btn { background: #3b82f6; color: #fff; border: none; border-radius: 8px; padding: 8px 14px; font-size: 13px; cursor: pointer; }
.ghost-btn { background: transparent; color: #94a3b8; border: 1px solid #2a3654; border-radius: 8px; padding: 8px 14px; font-size: 13px; cursor: pointer; }
.ghost-btn:hover { color: #e2e8f0; border-color: #3b82f6; }
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.stat-card { background: #111a30; border: 1px solid #1f2b4a; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 4px; }
.stat-num { font-size: 22px; font-weight: 700; color: #60a5fa; }
.stat-label { font-size: 12px; color: #64748b; }
.tabs { display: flex; gap: 8px; margin-bottom: 12px; }
.tab { background: transparent; border: 1px solid #2a3654; color: #94a3b8; padding: 7px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; }
.tab.active { background: #1e3a8a33; color: #60a5fa; border-color: #3b82f6; }
.toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
.search-input { background: #0d1526; border: 1px solid #2a3654; border-radius: 8px; padding: 7px 12px; color: #e2e8f0; font-size: 13px; width: 220px; }
.cat-select { background: #0d1526; border: 1px solid #2a3654; border-radius: 8px; padding: 7px 10px; color: #e2e8f0; font-size: 13px; }
.total-tip { font-size: 12px; color: #64748b; }
.list-card { background: #111a30; border: 1px solid #1f2b4a; border-radius: 10px; overflow: hidden; }
.table-head, .table-row { display: grid; grid-template-columns: 1.2fr 1fr 0.8fr 0.8fr 1.2fr; align-items: center; padding: 10px 14px; gap: 8px; }
.table-head { background: #0d1526; font-size: 12px; color: #64748b; font-weight: 600; }
.table-row { border-top: 1px solid #1a2542; font-size: 13px; }
.table-row:hover { background: #16213c; }
.word-cell { font-weight: 600; color: #f1f5f9; }
.cat-badge { background: #1e3a8a; color: #93c5fd; border-radius: 6px; padding: 2px 8px; font-size: 11px; }
.cat-politics { background: #7f1d1d; color: #fca5a5; }
.cat-religion { background: #581c87; color: #d8b4fe; }
.cat-drug { background: #14532d; color: #86efac; }
.cat-porn { background: #831843; color: #f9a8d4; }
.cat-gambling { background: #78350f; color: #fcd34d; }
.cat-body { background: #1e1b4b; color: #a5b4fc; }
.cat-leader { background: #7f1d1d; color: #fecaca; }
.level-badge { border-radius: 6px; padding: 2px 8px; font-size: 11px; background: #1e293b; color: #94a3b8; }
.lv4 { background: #7f1d1d; color: #fecaca; font-weight: 600; }
.lv3 { background: #78350f; color: #fcd34d; }
.status-toggle { border: none; border-radius: 6px; padding: 4px 10px; font-size: 12px; cursor: pointer; }
.status-toggle.on { background: #14532d; color: #86efac; }
.status-toggle.off { background: #1e293b; color: #64748b; }
.op-btn { background: transparent; border: 1px solid #2a3654; color: #94a3b8; border-radius: 6px; padding: 4px 10px; font-size: 12px; cursor: pointer; margin-right: 6px; }
.op-btn:hover { color: #60a5fa; border-color: #3b82f6; }
.op-btn.danger:hover { color: #f87171; border-color: #dc2626; }
.empty { padding: 30px; text-align: center; color: #475569; font-size: 13px; }
.pager { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 10px; color: #64748b; font-size: 12px; }
.pg-btn { background: transparent; border: 1px solid #2a3654; color: #94a3b8; border-radius: 6px; padding: 3px 10px; cursor: pointer; }
.pg-btn:disabled { opacity: 0.4; cursor: not-allowed; }
/* 日志表 */
.logs-head, .logs-row { grid-template-columns: 1.1fr 0.9fr 1.1fr 0.5fr 0.6fr 2fr; }
.lg-time { font-size: 12px; color: #64748b; }
.lg-user { color: #e2e8f0; }
.match-tag { display: inline-block; background: #7f1d1d55; color: #fca5a5; border-radius: 5px; padding: 1px 6px; font-size: 11px; margin-right: 4px; }
.action-tag { border-radius: 6px; padding: 2px 8px; font-size: 11px; }
.action-tag.kick { background: #7f1d1d; color: #fecaca; font-weight: 600; }
.action-tag.notice { background: #78350f; color: #fcd34d; }
.action-tag.replace { background: #1e293b; color: #94a3b8; }
.content-cell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #94a3b8; font-size: 12px; }
/* 弹窗 */
.modal-mask { position: fixed; inset: 0; background: rgba(2, 6, 23, 0.7); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-card { background: #0f1a33; border: 1px solid #2a3654; border-radius: 12px; padding: 22px; width: 480px; max-width: 92vw; max-height: 86vh; overflow-y: auto; position: relative; }
.modal-card h3 { margin: 0 0 14px; font-size: 16px; }
.modal-close { position: absolute; top: 12px; right: 14px; background: none; border: none; color: #64748b; font-size: 16px; cursor: pointer; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-field { display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: #94a3b8; }
.form-input { background: #0d1526; border: 1px solid #2a3654; border-radius: 8px; padding: 8px 10px; color: #e2e8f0; font-size: 13px; }
.form-input.textarea { resize: vertical; font-family: inherit; }
.check-field { flex-direction: row; align-items: center; gap: 8px; }
.form-tip { font-size: 12px; color: #64748b; margin: 10px 0; line-height: 1.6; }
.form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.btn-ghost { background: transparent; border: 1px solid #2a3654; color: #94a3b8; border-radius: 8px; padding: 8px 16px; cursor: pointer; font-size: 13px; }
.btn-save { background: #3b82f6; color: #fff; border: none; border-radius: 8px; padding: 8px 16px; cursor: pointer; font-size: 13px; }
.btn-save:disabled { opacity: 0.5; }
</style>
