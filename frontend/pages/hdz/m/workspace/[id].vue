<template>
  <div class="hdzm-app">
    <!-- 顶部栏 -->
    <nav class="hdzm-topbar">
      <button class="hdzm-back" @click="router.back()">←</button>
      <h1 class="hdzm-title">{{ project?.title || '加载中...' }}</h1>
      <button class="hdzm-menu-btn" @click="showMenu = !showMenu">···</button>
      <div v-if="showMenu" class="hdzm-dropdown" @click="showMenu = false">
        <button @click="generateSummary">📚 生成章节总结</button>
        <button @click="exportProject">📥 导出作品</button>
      </div>
    </nav>

    <!-- Tab 切换 -->
    <div class="hdzm-tabs">
      <button v-for="(t, i) in tabs" :key="i" :class="['hdzm-tab', { 'hdzm-tab--active': tab === i }]" @click="tab = i">
        {{ t.icon }} {{ t.label }}
      </button>
    </div>

    <!-- ====== Tab 0: 手稿 ====== -->
    <div v-show="tab === 0" class="hdzm-content">
      <!-- 章节列表 -->
      <div class="hdzm-section-header">
        <span>📝 共 {{ chapters.length }} 章</span>
        <button class="hdzm-sm-btn" @click="showNewChapter = true">+ 新建</button>
      </div>
      <div v-if="chapters.length === 0" class="hdzm-empty">暂无章节</div>
      <div v-else class="hdzm-ch-list">
        <div v-for="ch in chapters" :key="ch.chapterNo || ch.id" class="hdzm-ch-item" @click="openChapter(ch)">
          <div class="hdzm-ch-info">
            <span class="hdzm-ch-no">第{{ ch.chapterNo || ch.sortOrder || '-' }}章</span>
            <span class="hdzm-ch-title">{{ ch.title || '无标题' }}</span>
          </div>
          <div class="hdzm-ch-meta">
            <span>{{ ch.wordCount || 0 }} 字</span>
            <span v-if="ch.status === 'draft'" class="hdzm-badge-draft">草稿</span>
            <span v-else class="hdzm-badge-done">✅</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ====== Tab 1: AI 写作 ====== -->
    <div v-show="tab === 1" class="hdzm-content hdzm-chat-layout">
      <div class="hdzm-chat-msgs" ref="chatRef">
        <!-- 快捷指令 -->
        <div class="hdzm-quick-row" v-if="messages.length === 0">
          <button class="hdzm-qbtn" @click="quickChat('帮我写下一章的内容')">✍️ 续写</button>
          <button class="hdzm-qbtn" @click="quickChat('帮我设计一个新角色')">👤 新角色</button>
          <button class="hdzm-qbtn" @click="quickChat('帮我生成章节大纲')">📋 大纲</button>
          <button class="hdzm-qbtn" @click="quickChat('帮我检查剧情逻辑')">🔍 逻辑</button>
        </div>
        <div v-for="(m, i) in messages" :key="i" class="hdzm-msg" :class="'hdzm-msg--' + m.role">
          <div class="hdzm-msg-avatar">{{ m.role === 'user' ? '🧑' : '🤖' }}</div>
          <div class="hdzm-msg-bubble">
            <div class="hdzm-msg-text" style="white-space:pre-wrap">{{ m.content }}</div>
            <div v-if="m.role === 'assistant' && m.content" class="hdzm-msg-actions">
              <button @click="appendToChapter(m.content)">📥 追加到当前章</button>
              <button @click="copyText(m.content)">📋 复制</button>
            </div>
          </div>
        </div>
        <div v-if="chatLoading" class="hdzm-msg hdzm-msg--assistant">
          <div class="hdzm-msg-avatar">🤖</div>
          <div class="hdzm-msg-bubble"><span class="hdzm-typing">思考中...</span></div>
        </div>
      </div>
      <div class="hdzm-input-bar">
        <input v-model="chatInput" placeholder="输入写作要求..." @keydown.enter="sendChat" :disabled="chatLoading" />
        <button @click="sendChat" :disabled="!chatInput.trim() || chatLoading">发送</button>
      </div>
    </div>

    <!-- ====== Tab 2: 设定 ====== -->
    <div v-show="tab === 2" class="hdzm-content">
      <!-- 角色 -->
      <div class="hdzm-section-card" @click="router.push(`/hdz/m/characters/${projectId}`)">
        <div class="hdzm-section-card-left">
          <span class="hdzm-section-icon">👤</span>
          <div>
            <div class="hdzm-section-label">角色</div>
            <div class="hdzm-section-count">{{ chars.length }} 个角色</div>
          </div>
        </div>
        <span class="hdzm-arrow">›</span>
      </div>
      <!-- 世界观 -->
      <div class="hdzm-section-card">
        <div class="hdzm-section-card-left">
          <span class="hdzm-section-icon">🏛️</span>
          <div>
            <div class="hdzm-section-label">世界观</div>
            <div class="hdzm-section-count">{{ project?.genre || '未设置' }} · {{ memories.length }} 条记忆</div>
          </div>
        </div>
        <span class="hdzm-arrow">›</span>
      </div>
      <!-- 写作设定 -->
      <div class="hdzm-section-card">
        <div class="hdzm-section-card-left">
          <span class="hdzm-section-icon">🎨</span>
          <div>
            <div class="hdzm-section-label">文风设定</div>
            <div class="hdzm-section-count">{{ styleDna ? styleDna.slice(0, 30) + '...' : '未设定' }}</div>
          </div>
        </div>
        <span class="hdzm-arrow">›</span>
      </div>
      <!-- 写作进度 -->
      <div class="hdzm-stats-card">
        <div class="hdzm-stat-item">
          <div class="hdzm-stat-val">{{ chapters.length }}</div>
          <div class="hdzm-stat-lbl">章节</div>
        </div>
        <div class="hdzm-stat-item">
          <div class="hdzm-stat-val">{{ totalWords }}</div>
          <div class="hdzm-stat-lbl">总字数</div>
        </div>
        <div class="hdzm-stat-item">
          <div class="hdzm-stat-val">{{ chars.length }}</div>
          <div class="hdzm-stat-lbl">角色</div>
        </div>
        <div class="hdzm-stat-item">
          <div class="hdzm-stat-val">{{ tasks.filter(t => t.status === 'completed').length }}</div>
          <div class="hdzm-stat-lbl">AI 任务</div>
        </div>
      </div>
    </div>

    <!-- 新建章节对话框 -->
    <div v-if="showNewChapter" class="hdzm-overlay" @click.self="showNewChapter = false">
      <div class="hdzm-dialog">
        <h3>新建章节</h3>
        <input v-model="newChapterTitle" placeholder="章节标题（可选）" class="hdzm-input" maxlength="50" />
        <div class="hdzm-dialog-actions">
          <button class="hdzm-btn hdzm-btn-cancel" @click="showNewChapter = false">取消</button>
          <button class="hdzm-btn hdzm-btn-primary" :disabled="creatingChapter" @click="doCreateChapter">
            {{ creatingChapter ? '创建中...' : '创建' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 章节编辑/阅读器 -->
    <div v-if="editingChapter" class="hdzm-editor-overlay" @click.self="editingChapter = null">
      <div class="hdzm-editor">
        <div class="hdzm-editor-top">
          <button class="hdzm-back" @click="editingChapter = null">← 返回</button>
          <span class="hdzm-editor-title">第{{ editingChapter.chapterNo }}章 · {{ editingChapter.title || '无标题' }}</span>
          <button class="hdzm-sm-btn" :disabled="savingChapter" @click="saveChapter">{{ savingChapter ? '保存中...' : '💾' }}</button>
        </div>
        <textarea v-model="chapterContent" class="hdzm-editor-body" placeholder="在此输入章节内容..." @input="autoSave"></textarea>
        <div class="hdzm-editor-footer">
          <span>{{ chapterContent.length }} 字</span>
          <span v-if="savedAt" class="hdzm-saved-at">已保存 {{ savedAt }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)

const $api = (url: string, opts?: any) => fetch(url, {
  credentials: 'include',
  headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) },
  ...opts,
}).then(r => r.json())

// --- Data ---
const tab = ref(0)
const tabs = [
  { icon: '📝', label: '手稿' },
  { icon: '🤖', label: 'AI写作' },
  { icon: '📊', label: '设定' },
]
const project = ref<any>(null)
const chapters = ref<any[]>([])
const chars = ref<any[]>([])
const memories = ref<any[]>([])
const styleDna = ref('')
const tasks = ref<any[]>([])
const showMenu = ref(false)
const showNewChapter = ref(false)
const newChapterTitle = ref('')
const creatingChapter = ref(false)

// Chat
const chatInput = ref('')
const chatLoading = ref(false)
const messages = ref<any[]>([])
const currentSession = ref('')
const chatRef = ref<HTMLDivElement>()

// Chapter editor
const editingChapter = ref<any>(null)
const chapterContent = ref('')
const savingChapter = ref(false)
const savedAt = ref('')

const totalWords = computed(() => chapters.value.reduce((s, c) => s + (c.wordCount || 0), 0))

// --- Load ---
onMounted(async () => {
  try {
    const p: any = await $api(`/api/hdz/projects/${projectId.value}`)
    project.value = p
  } catch {}
  try {
    const c: any = await $api(`/api/hdz/manuscript/${projectId.value}`)
    chapters.value = Array.isArray(c) ? c : (c?.data || [])
  } catch {}
  try {
    const c: any = await $api(`/api/hdz/character/${projectId.value}`)
    chars.value = Array.isArray(c) ? c : []
  } catch {}
  try {
    const m: any = await $api(`/api/hdz/memory/${projectId.value}`)
    memories.value = Array.isArray(m) ? m : []
  } catch {}
  try {
    const s: any = await $api(`/api/hdz/style-dna/${projectId.value}`)
    styleDna.value = typeof s === 'string' ? s : s?.styleDna || ''
  } catch {}
  try {
    const t: any = await $api(`/api/hdz/agent/tasks/${projectId.value}`)
    tasks.value = Array.isArray(t) ? t : []
  } catch {}
  try {
    const s: any = await $api(`/api/hdz/chat/sessions?projectId=${projectId.value}`)
    if (Array.isArray(s) && s.length > 0) {
      currentSession.value = s[0].sessionId || s[0].id
    }
  } catch {}
})

// --- Chapter operations ---
async function doCreateChapter() {
  if (creatingChapter.value) return
  creatingChapter.value = true
  try {
    const data: any = await $api(`/api/hdz/manuscript/${projectId.value}`, {
    method: 'POST',
    body: JSON.stringify({
        title: newChapterTitle.value.trim() || `第${chapters.value.length + 1}章`,
        chapterNo: chapters.value.length + 1,
      }),
    })
    const ch = data.data || data.chapter || data
    if (ch?.id) {
      chapters.value.push({ ...ch, wordCount: 0, status: 'draft' })
      showNewChapter.value = false
      newChapterTitle.value = ''
    }
  } catch (e) {
    console.warn('[HDZ] 创建章节失败', e)
  } finally {
    creatingChapter.value = false
  }
}

function openChapter(ch: any) {
  router.push(`/hdz/m/reader/${projectId.value}/${ch.id}`)
}

async function saveChapter() {
  if (!editingChapter.value?.id) return
  savingChapter.value = true
  try {
    await $api(`/api/hdz/manuscript/${projectId.value}/${editingChapter.value.id}`, {
      method: 'PUT',
      body: JSON.stringify({ content: chapterContent.value }),
    })
    editingChapter.value.content = chapterContent.value
    editingChapter.value.wordCount = chapterContent.value.length
    savedAt.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } catch (e) {
    console.warn('[HDZ] 保存失败', e)
  } finally {
    savingChapter.value = false
  }
}

let autoSaveTimer: any = null
function autoSave() {
  clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(saveChapter, 3000)
}

// --- Chat ---
async function newSession() {
  try {
    const r: any = await $api(`/api/hdz/chat/sessions?projectId=${projectId.value}`, { method: 'POST' })
    currentSession.value = r?.sessionId || r?.id || ''
    messages.value = []
  } catch {}
}

async function sendChat() {
  if (!chatInput.value.trim() || chatLoading.value) return
  const msg = chatInput.value.trim()
  chatInput.value = ''
  messages.value.push({ role: 'user', content: msg })
  chatLoading.value = true
  if (!currentSession.value) await newSession()
  try {
    const res = await fetch('/api/hdz/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: projectId.value, sessionId: currentSession.value, message: msg }),
    })
    if (res.body) {
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let acc = ''
      messages.value.push({ role: 'assistant', content: '' })
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += dec.decode(value, { stream: true })
        messages.value[messages.value.length - 1].content = acc
        scrollChat()
      }
    } else {
      const d = await res.json()
      messages.value.push({ role: 'assistant', content: d?.text || d?.message || '完成' })
    }
  } catch {
    messages.value.push({ role: 'assistant', content: '发送失败' })
  } finally {
    chatLoading.value = false
    scrollChat()
  }
}

function scrollChat() {
  nextTick(() => { if (chatRef.value) chatRef.value.scrollTop = chatRef.value.scrollHeight })
}

function quickChat(text: string) {
  chatInput.value = text
  sendChat()
}

function appendToChapter(content: string) {
  if (chapters.value.length > 0) {
    openChapter(chapters.value[chapters.value.length - 1])
    chapterContent.value += '\n\n' + content
    saveChapter()
  }
}

function copyText(text: string) {
  navigator.clipboard?.writeText(text)
}

// --- Menu actions ---
function generateSummary() {
  quickChat('请为当前作品生成一份章节总结')
}

async function exportProject() {
  try {
    const data: any = await $api(`/api/hdz/projects/${projectId.value}/export`, { method: 'POST' })
    if (data?.url) window.open(data.url)
  } catch {}
}

onUnmounted(() => clearTimeout(autoSaveTimer))
</script>

<style scoped>
.hdzm-app { min-height: 100vh; background: #f5f0e8; color: #333; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
.hdzm-topbar { position: sticky; top: 0; z-index: 100; height: 44px; display: flex; align-items: center; padding: 0 12px; background: rgba(245,240,232,0.95); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(0,0,0,0.06); gap: 8px; }
.hdzm-back { font-size: 0.85rem; color: #8b7355; background: none; border: none; cursor: pointer; }
.hdzm-title { flex: 1; font-size: 0.85rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; }
.hdzm-menu-btn { background: none; border: none; font-size: 1.1rem; color: #666; cursor: pointer; padding: 4px 8px; position: relative; }
.hdzm-dropdown { position: absolute; top: 44px; right: 8px; background: #fff; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); overflow: hidden; z-index: 200; }
.hdzm-dropdown button { display: block; width: 100%; padding: 10px 16px; border: none; background: none; font-size: 0.8rem; text-align: left; cursor: pointer; }
.hdzm-dropdown button:active { background: rgba(0,0,0,0.05); }

/* Tabs */
.hdzm-tabs { display: flex; background: rgba(250,247,240,0.95); border-bottom: 1px solid rgba(0,0,0,0.06); position: sticky; top: 44px; z-index: 99; }
.hdzm-tab { flex: 1; padding: 10px 4px; border: none; background: none; font-size: 0.75rem; color: #999; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; }
.hdzm-tab--active { color: #8b7355; border-bottom-color: #8b7355; font-weight: 600; }

.hdzm-content { padding: 12px; }
.hdzm-empty { text-align: center; padding: 40px; color: #999; font-size: 0.85rem; }
.hdzm-section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 0.8rem; color: #666; }

/* Chapter list */
.hdzm-ch-list { display: flex; flex-direction: column; gap: 6px; }
.hdzm-ch-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #faf7f0; border-radius: 8px; border: 1px solid rgba(0,0,0,0.04); cursor: pointer; }
.hdzm-ch-item:active { background: #f0ebe0; }
.hdzm-ch-info { display: flex; flex-direction: column; gap: 2px; }
.hdzm-ch-no { font-size: 0.6rem; color: #999; }
.hdzm-ch-title { font-size: 0.85rem; font-weight: 500; }
.hdzm-ch-meta { display: flex; align-items: center; gap: 6px; font-size: 0.65rem; color: #999; }
.hdzm-badge-draft { font-size: 0.55rem; color: #cc9966; }
.hdzm-badge-done { font-size: 0.7rem; }
.hdzm-sm-btn { padding: 4px 10px; border: 1px solid rgba(0,0,0,0.1); border-radius: 4px; background: #fff; font-size: 0.7rem; color: #666; cursor: pointer; }

/* Chat */
.hdzm-chat-layout { display: flex; flex-direction: column; height: calc(100vh - 100px); padding-bottom: 60px; }
.hdzm-chat-msgs { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-bottom: 8px; }
.hdzm-quick-row { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 0; }
.hdzm-qbtn { padding: 6px 12px; border: 1px solid rgba(139,115,85,0.2); border-radius: 14px; background: rgba(139,115,85,0.06); font-size: 0.7rem; color: #8b7355; cursor: pointer; white-space: nowrap; }
.hdzm-msg { display: flex; gap: 8px; max-width: 85%; }
.hdzm-msg--user { align-self: flex-end; flex-direction: row-reverse; }
.hdzm-msg--assistant { align-self: flex-start; }
.hdzm-msg-avatar { font-size: 1.2rem; flex-shrink: 0; }
.hdzm-msg-bubble { padding: 8px 12px; border-radius: 10px; font-size: 0.8rem; line-height: 1.5; }
.hdzm-msg--user .hdzm-msg-bubble { background: #8b7355; color: #fff; border-bottom-right-radius: 2px; }
.hdzm-msg--assistant .hdzm-msg-bubble { background: #fff; border: 1px solid rgba(0,0,0,0.06); border-bottom-left-radius: 2px; }
.hdzm-msg-text { white-space: pre-wrap; }
.hdzm-msg-actions { display: flex; gap: 6px; margin-top: 6px; }
.hdzm-msg-actions button { font-size: 0.6rem; padding: 2px 6px; border: none; border-radius: 3px; background: rgba(0,0,0,0.05); color: #666; cursor: pointer; }
.hdzm-typing { color: #aaa; }
.hdzm-input-bar { display: flex; gap: 6px; padding: 8px 0; background: #f5f0e8; }
.hdzm-input-bar input { flex: 1; padding: 10px 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 18px; font-size: 0.85rem; background: #fff; outline: none; }
.hdzm-input-bar button { padding: 8px 16px; border: none; border-radius: 18px; background: #8b7355; color: #fff; font-size: 0.8rem; cursor: pointer; white-space: nowrap; }
.hdzm-input-bar button:disabled { opacity: 0.4; cursor: not-allowed; }

/* Settings cards */
.hdzm-section-card { display: flex; justify-content: space-between; align-items: center; padding: 14px; background: #faf7f0; border-radius: 8px; border: 1px solid rgba(0,0,0,0.04); margin-bottom: 8px; cursor: pointer; }
.hdzm-section-card-left { display: flex; align-items: center; gap: 12px; }
.hdzm-section-icon { font-size: 1.5rem; }
.hdzm-section-label { font-size: 0.85rem; font-weight: 500; }
.hdzm-section-count { font-size: 0.7rem; color: #999; margin-top: 2px; }
.hdzm-arrow { font-size: 1.2rem; color: #ccc; }

/* Stats */
.hdzm-stats-card { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; }
.hdzm-stat-item { background: #faf7f0; border-radius: 8px; padding: 12px; text-align: center; border: 1px solid rgba(0,0,0,0.04); }
.hdzm-stat-val { font-size: 1.2rem; font-weight: 700; color: #8b7355; }
.hdzm-stat-lbl { font-size: 0.6rem; color: #999; margin-top: 2px; }

/* Editor overlay */
.hdzm-editor-overlay { position: fixed; inset: 0; z-index: 300; background: #faf7f0; display: flex; flex-direction: column; }
.hdzm-editor { display: flex; flex-direction: column; height: 100%; }
.hdzm-editor-top { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid rgba(0,0,0,0.06); background: #faf7f0; }
.hdzm-editor-title { flex: 1; font-size: 0.8rem; font-weight: 500; color: #666; }
.hdzm-editor-body { flex: 1; padding: 16px; border: none; outline: none; font-size: 0.9rem; line-height: 1.8; resize: none; background: #faf7f0; color: #333; font-family: inherit; }
.hdzm-editor-footer { display: flex; justify-content: space-between; padding: 8px 16px; font-size: 0.65rem; color: #999; border-top: 1px solid rgba(0,0,0,0.04); }

/* Dialogs */
.hdzm-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; padding: 24px; }
.hdzm-dialog { background: #faf7f0; border-radius: 12px; padding: 20px; width: 100%; max-width: 320px; }
.hdzm-dialog h3 { margin: 0 0 12px; font-size: 1rem; }
.hdzm-input { width: 100%; padding: 10px 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 6px; font-size: 0.85rem; background: #fff; margin-bottom: 10px; box-sizing: border-box; }
.hdzm-dialog-actions { display: flex; gap: 8px; margin-top: 8px; }
.hdzm-btn { flex: 1; padding: 10px; border-radius: 6px; font-size: 0.85rem; border: none; cursor: pointer; }
.hdzm-btn-cancel { background: rgba(0,0,0,0.05); color: #666; }
.hdzm-btn-primary { background: #8b7355; color: #fff; }
.hdzm-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
