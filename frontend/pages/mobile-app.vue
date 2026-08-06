<template>
  <div class="tea-app">
    <!-- 全局 Toast -->
    <div v-if="toast" class="tea-app-toast">{{ toast }}</div>

    <!-- ══════════ 顶部标题栏（随 Tab 变化） ══════════ -->
    <header class="app-header">
      <template v-if="activeTab === 'chat'">
        <div class="header-left">
          <span class="header-logo">🍵</span>
          <div class="header-titles">
            <div class="header-title">昆仑茶馆</div>
            <div class="header-sub" :class="connClass">{{ connLabel }}</div>
          </div>
        </div>
        <div class="header-actions">
          <span class="header-icon" @click="chatPanel = 'friends'">✚</span>
        </div>
      </template>
      <template v-else-if="activeTab === 'contacts'">
        <div class="header-left">
          <span class="header-title">通讯录</span>
        </div>
        <div class="header-actions">
          <span class="header-icon" @click="openCreateGroup">✚</span>
        </div>
      </template>
      <template v-else-if="activeTab === 'community'">
        <div class="header-left"><span class="header-title">社区</span></div>
        <div class="header-actions">
          <span class="header-icon" @click="goCommunityNew">✎</span>
        </div>
      </template>
      <template v-else>
        <div class="header-left"><span class="header-title">我的</span></div>
      </template>
    </header>

    <!-- ══════════ 主体视图 ══════════ -->
    <main class="app-body">
      <!-- ── Tab1 茶馆：会话列表 / 好友选择 / 聊天窗 ── -->
      <section v-if="activeTab === 'chat'" class="tab-pane chat-pane">
        <!-- 会话列表 -->
        <template v-if="!currentChannel">
          <div class="chat-search">
            <span class="search-ic">🔍</span>
            <input v-model="chatSearch" class="chat-search-input" placeholder="搜索频道 / 群 / 好友" />
          </div>
          <div class="conv-list">
            <!-- 公共大堂 -->
            <div v-for="ch in filteredConvs" :key="'conv-' + ch.id + '-' + ch.type" class="conv-item" @click="openChannel(ch)">
              <div class="conv-avatar" :class="ch.kind === 'group' ? 'is-group' : ch.kind === 'public' ? 'is-public' : 'is-dm'">
                {{ ch.kind === 'public' ? '🏮' : ch.kind === 'group' ? '👥' : (ch.name || '?').slice(0, 1) }}
              </div>
              <div class="conv-info">
                <div class="conv-name">{{ ch.name }}</div>
                <div class="conv-preview">{{ convPreview(ch) }}</div>
              </div>
              <div v-if="ch.unread" class="conv-unread">{{ ch.unread > 99 ? '99+' : ch.unread }}</div>
            </div>
            <div v-if="!filteredConvs.length" class="conv-empty">
              <p>暂无会话</p>
              <p class="conv-empty-sub">点右上角 ✚ 添加好友 / 创建群聊</p>
            </div>
          </div>
        </template>

        <!-- 好友选择浮层（✚ 发起私聊） -->
        <div v-else-if="chatPanel === 'friends'" class="picker-pane">
          <div class="picker-head">
            <span class="picker-back" @click="chatPanel = ''">‹ 返回</span>
            <span class="picker-title">发起聊天</span>
          </div>
          <div class="picker-search">
            <input v-model="friendSearch" class="chat-search-input" placeholder="搜索好友" />
          </div>
          <div class="picker-list">
            <div v-for="u in filteredFriends" :key="u.id" class="picker-item" @click="startDm(u)">
              <div class="picker-avatar">{{ (u.name || '?').slice(0, 1) }}</div>
              <div class="picker-name">
                {{ u.name }}
                <span class="picker-online" :class="{ on: u.online }">{{ u.online ? '在线' : '离线' }}</span>
              </div>
            </div>
            <div v-if="!filteredFriends.length" class="conv-empty"><p>暂无好友</p></div>
          </div>
        </div>

        <!-- 聊天窗（全屏） -->
        <template v-else>
          <div class="chat-window">
            <div class="chat-head">
              <span class="chat-back" @click="closeChannel">‹</span>
              <div class="chat-head-info">
                <div class="chat-head-name">{{ currentChannel.name }}</div>
                <div class="chat-head-sub">{{ chatHeadSub }}</div>
              </div>
              <span v-if="currentChannel.kind === 'group'" class="chat-head-opt" @click="openGroupDetail">⋯</span>
            </div>
            <div ref="msgListEl" class="chat-msgs">
              <div v-for="m in messages" :key="msgKey(m)" class="msg-row" :class="{ mine: m.fromUID === tea.userId.value }">
                <div v-if="!m.isSystem" class="msg-avatar">{{ msgName(m) === '我' ? (myName || '我').slice(0,1) : msgName(m).slice(0,1) }}</div>
                <div class="msg-main">
                  <div v-if="!m.isSystem" class="msg-author">{{ msgName(m) }}</div>
                  <div class="msg-bubble" :class="{ system: m.isSystem }">
                    <img v-if="isImage(m.content)" :src="imgUrl(m.content)" class="msg-img" @click="previewImg(imgUrl(m.content))" />
                    <template v-else>{{ msgText(m) }}</template>
                  </div>
                  <div class="msg-time">{{ msgTime(m) }}</div>
                </div>
              </div>
              <div v-if="!messages.length" class="conv-empty"><p>说点什么吧～</p></div>
            </div>
            <div class="chat-input-bar">
              <input
                v-model="draft"
                class="chat-input"
                placeholder="输入消息…"
                @keyup.enter="sendDraft"
              />
              <button class="chat-send" :disabled="!draft.trim()" @click="sendDraft">发送</button>
            </div>
          </div>
        </template>
      </section>

      <!-- ── Tab2 好友：通讯录（群聊分组 + 好友列表） ── -->
      <section v-else-if="activeTab === 'contacts'" class="tab-pane contacts-pane">
        <div class="chat-search">
          <span class="search-ic">🔍</span>
          <input v-model="friendSearch" class="chat-search-input" placeholder="搜索好友 / 群" />
        </div>

        <!-- 群聊分组 -->
        <div class="contact-group">
          <div class="contact-group-title">
            👥 群聊
            <span class="contact-group-count">{{ groups.length }}</span>
          </div>
          <div v-for="g in filteredGroups" :key="'g-' + g.id" class="contact-item" @click="openChannel(g)">
            <div class="conv-avatar is-group">👥</div>
            <div class="contact-info">
              <div class="contact-name">{{ g.name }}</div>
              <div class="contact-sub">{{ g.memberCount ? `共 ${g.memberCount} 位群友` : '群聊' }}</div>
            </div>
            <span class="contact-arrow">›</span>
          </div>
          <div v-if="!filteredGroups.length" class="contact-empty">暂无群聊 · 右上角 ✚ 创建</div>
        </div>

        <!-- 好友列表 -->
        <div class="contact-group">
          <div class="contact-group-title">
            👤 好友
            <span class="contact-group-count">{{ friends.length }}</span>
          </div>
          <div v-for="u in filteredFriends" :key="'u-' + u.id" class="contact-item" @click="startDm(u)">
            <div class="picker-avatar">{{ (u.name || '?').slice(0, 1) }}</div>
            <div class="contact-info">
              <div class="contact-name">
                {{ u.name }}
                <span class="picker-online" :class="{ on: u.online }">{{ u.online ? '在线' : '离线' }}</span>
              </div>
              <div class="contact-sub">发消息</div>
            </div>
            <span class="contact-arrow">›</span>
          </div>
          <div v-if="!filteredFriends.length" class="contact-empty">暂无好友</div>
        </div>
      </section>

      <!-- ── Tab3 社区：分类 + 帖子流 ── -->
      <section v-else-if="activeTab === 'community'" class="tab-pane community-pane">
        <div class="community-tabs">
          <span
            v-for="c in categories"
            :key="c.slug || c.id || c.name"
            class="community-tab"
            :class="{ active: communityCat === (c.slug || c.id || '') }"
            @click="switchCommunityCat(c.slug || c.id || '')"
          >{{ c.name }}</span>
        </div>
        <div class="post-list">
          <div v-for="p in posts" :key="p.id" class="post-item" @click="openPost(p)">
            <div class="post-title">{{ p.title }}</div>
            <div v-if="p.summary || p.content" class="post-summary">{{ (p.summary || p.content || '').slice(0, 60) }}</div>
            <div class="post-meta">
              <span class="post-author">{{ p.authorName || p.author?.name || '茶友' }}</span>
              <span class="post-stats">👍 {{ p.likeCount ?? p.likes ?? 0 }} · 💬 {{ p.replyCount ?? p.comments ?? 0 }}</span>
              <span v-if="p.createdAt" class="post-time">{{ timeAgo(p.createdAt) }}</span>
            </div>
          </div>
          <div v-if="!posts.length" class="conv-empty"><p>{{ postsLoading ? '加载中…' : '暂无帖子' }}</p></div>
        </div>
        <button class="community-fab" @click="goCommunityNew">✎ 发布</button>
      </section>

      <!-- ── Tab4 我的：会员卡 + 资产 + 功能入口 ── -->
      <section v-else class="tab-pane mine-pane">
        <div class="mine-hero" @click="go('/user/center')">
          <div class="mine-avatar">{{ myName.slice(0, 1) || '👤' }}</div>
          <div class="mine-info">
            <div class="mine-name">{{ myName || '未登录' }}</div>
            <div class="mine-tier">{{ tierLabel }}</div>
          </div>
          <span class="mine-arrow">›</span>
        </div>

        <div class="mine-assets">
          <div class="asset-cell" @click="go('/user/wallet')">
            <div class="asset-num">{{ walletBalance }}</div>
            <div class="asset-label">余额</div>
          </div>
          <div class="asset-cell" @click="go('/user/credits')">
            <div class="asset-num">{{ credits }}</div>
            <div class="asset-label">积分</div>
          </div>
          <div class="asset-cell" @click="go('/user/diamonds')">
            <div class="asset-num">{{ diamonds }}</div>
            <div class="asset-label">钻石</div>
          </div>
        </div>

        <div class="mine-grid">
          <div v-for="it in mineEntries" :key="it.label" class="mine-entry" @click="go(it.to)">
            <div class="mine-entry-icon">{{ it.icon }}</div>
            <div class="mine-entry-label">{{ it.label }}</div>
          </div>
        </div>

        <button v-if="isLoggedIn" class="mine-logout" @click="doLogout">退出登录</button>
      </section>
    </main>

    <!-- ══════════ 底部 TabBar ══════════ -->
    <nav class="tab-bar">
      <div v-for="t in tabs" :key="t.key" class="tab-item" :class="{ active: activeTab === t.key }" @click="switchTab(t.key)">
        <div class="tab-icon">{{ t.icon }}</div>
        <div class="tab-label">{{ t.label }}</div>
      </div>
    </nav>

    <!-- 建群弹窗 -->
    <div v-if="createGroupOpen" class="tea-app-mask" @click.self="createGroupOpen = false">
      <div class="tea-app-modal">
        <div class="modal-title">创建群聊</div>
        <input v-model="createGroupName" class="modal-input" maxlength="30" placeholder="群名称（30 字内）" />
        <input v-model="createGroupIntro" class="modal-input" maxlength="200" placeholder="群介绍（选填）" />
        <div v-if="createGroupError" class="modal-error">{{ createGroupError }}</div>
        <div class="modal-actions">
          <button class="modal-btn cancel" @click="createGroupOpen = false">取消</button>
          <button class="modal-btn ok" :disabled="createGroupBusy" @click="createGroup">{{ createGroupBusy ? '创建中…' : '创建' }}</button>
        </div>
      </div>
    </div>

    <!-- 群详情弹窗（简版：成员列表） -->
    <div v-if="groupDetailOpen" class="tea-app-mask" @click.self="groupDetailOpen = false">
      <div class="tea-app-modal grp-detail-modal">
        <div class="modal-title">群成员（{{ groupDetail?.members?.length || 0 }}）</div>
        <div class="grp-members">
          <div v-for="gm in groupDetail?.members || []" :key="gm.uid" class="grp-member">
            <span class="grp-member-avatar">{{ (gm.name || '?').slice(0, 1) }}</span>
            <span class="grp-member-name">{{ gm.name }}</span>
            <span v-if="gm.role >= 2" class="grp-member-tag">群主</span>
            <span v-else-if="gm.role === 1" class="grp-member-tag">管理员</span>
          </div>
        </div>
        <div class="modal-actions">
          <button class="modal-btn ok" @click="groupDetailOpen = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 图片预览 -->
    <div v-if="previewUrl" class="tea-app-mask img-mask" @click="previewUrl = ''">
      <img :src="previewUrl" class="preview-img" />
    </div>
  </div>
</template>

<script setup lang="ts">
// 昆仑茶馆手机版 — 微信式四 Tab 聚合壳（茶馆 / 好友 / 社区 / 我的）
// 复用 useKunlunTea 全部 IM 能力；社区/会员中心调原生 API；桌面版页面零改动
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

// 登录保护：中间件拦截（SSR cookie 检查 + 客户端 token 校验），未登录跳手机版登录页
// /mobile-login 为公开页，由页面自身处理登录后回跳
definePageMeta({ middleware: 'auth' })

const tea = useKunlunTea()
const router = useRouter()
const route = useRoute()

// ── 基础状态 ──
const tabs = [
  { key: 'chat', icon: '🍵', label: '茶馆' },
  { key: 'contacts', icon: '👥', label: '好友' },
  { key: 'community', icon: '🏘️', label: '社区' },
  { key: 'mine', icon: '👤', label: '我的' },
]
const activeTab = ref('chat')
const toast = ref('')
let toastTimer: any = null
function showToast(msg: string) {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2200)
}
function go(path: string) {
  window.location.href = path
}

// ── 登录态 ──
const isLoggedIn = computed(() => {
  try { return !!(window.localStorage?.getItem('auth_token') || document.cookie.includes('auth_token=')) } catch { return false }
})
const myName = ref('')
const myAvatar = ref('')
const myEmail = ref('')
const tierLabel = ref('普通会员')
const walletBalance = ref('0')
const credits = ref('0')
const diamonds = ref('0')
function readMyProfile(): any {
  try {
    const m = document.cookie.match(/(?:^|;\s*)auth_user=([^;]+)/)
    if (m) return JSON.parse(decodeURIComponent(m[1]))
  } catch { /* ignore */ }
  try {
    const raw = localStorage.getItem('auth_user') || localStorage.getItem('user')
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return null
}
function authToken() {
  try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' }
}
function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...((init?.headers as Record<string, string>) || {}) }
  const t = authToken()
  if (t) headers['Authorization'] = `Bearer ${t}`
  return fetch(input, { ...init, headers, credentials: 'include' })
}

// ═══════════════ Tab1 茶馆 ═══════════════
const chatSearch = ref('')
const chatPanel = ref('') // '' 会话列表 | 'friends' 好友选择
const channels = ref<any[]>([]) // 公共
const groups = ref<any[]>([])
const dms = ref<any[]>([])
const friends = ref<any[]>([])
const currentChannel = ref<any>(null)
const messages = ref<any[]>([])
const draft = ref('')
const msgListEl = ref<any>(null)
const connLabel = computed(() => tea.statusLabel.value || '连接中…')
const connClass = computed(() => tea.connected.value ? 'is-on' : tea.connecting.value ? 'is-connecting' : 'is-off')
const unreadMap = ref<Record<string, number>>({})

const filteredConvs = computed(() => {
  const all = [...channels.value, ...groups.value, ...dms.value]
  const q = chatSearch.value.trim()
  const list = q ? all.filter((c) => (c.name || '').includes(q)) : all
  return list.map((c) => ({ ...c, unread: unreadMap.value[c.id + ':' + c.type] || 0 }))
})

function convPreview(ch: any) {
  return ch.lastMsg || (ch.kind === 'group' ? (ch.memberCount ? `共 ${ch.memberCount} 位群友` : '群聊') : ch.desc || '')
}

async function loadChannels() {
  const data = await tea.loadChannels()
  if (!data) return
  channels.value = data.public || []
  groups.value = data.groups || []
  dms.value = data.dms || []
  for (const ch of [...channels.value, ...groups.value, ...dms.value]) {
    tea.subscribeChannel(ch.id, ch.type)
  }
  // 微信式：进 App 停在会话列表，不自动打开聊天窗
}

async function loadFriends() {
  friends.value = await tea.loadUsers()
}

const filteredFriends = computed(() => {
  const q = friendSearch.value.trim()
  return q ? friends.value.filter((u) => (u.name || '').includes(q) || (u.email || '').includes(q)) : friends.value
})

async function openChannel(ch: any, silent = false) {
  currentChannel.value = ch
  chatPanel.value = ''
  unreadMap.value[ch.id + ':' + ch.type] = 0
  await tea.subscribeChannel(ch.id, ch.type)
  await loadHistory()
  if (ch.kind === 'group' && ch.groupId) loadGroupDetail()
  if (!silent) scrollToBottom()
}
function closeChannel() {
  currentChannel.value = null
  messages.value = []
  draft.value = ''
}
async function loadHistory() {
  if (!currentChannel.value) return
  const msgs = await tea.loadHistory(currentChannel.value.id, currentChannel.value.type, 0, 50)
  messages.value = msgs || []
  scrollToBottom()
}
function scrollToBottom() {
  nextTick(() => {
    const el = msgListEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}
const chatHeadSub = computed(() => {
  if (!currentChannel.value) return ''
  if (currentChannel.value.kind === 'group') return `共 ${groupDetail.value?.members?.length || currentChannel.value.memberCount || 0} 位群友`
  if (currentChannel.value.kind === 'dm') return '私聊'
  return '公共频道'
})

async function startDm(u: any) {
  const data = await tea.ensurePrivate(u.id)
  if (!data) { showToast('发起私聊失败'); return }
  await loadChannels()
  const ch = dms.value.find((d) => d.peerUid === u.id) || {
    id: data.channel.id,
    type: data.channel.type,
    name: u.name,
    kind: 'dm',
    peerUid: u.id,
    avatar: u.avatar || '',
  }
  activeTab.value = 'chat'
  chatPanel.value = ''
  await openChannel(ch)
}

function sendDraft() {
  const text = draft.value.trim()
  if (!text || !currentChannel.value) return
  tea.sendText(text, currentChannel.value.id, currentChannel.value.type)
  draft.value = ''
  // 自己消息由 SDK 回显触发 onMessage 渲染（不乐观追加，避免重复）
}

// 消息渲染（对齐 chat/index.vue parseContentObj：contentType/type/string/payload 全形态）
function parseContent(msg: any): { type: number; content: any } | null {
  if (msg.content) {
    const c = msg.content
    if (typeof c === 'object' && typeof c.contentType === 'number' && c.contentType > 0) {
      const t = c.contentType
      if (t === 1) return { type: 1, content: typeof c.text === 'string' ? c.text : (c.content ?? '') }
      return { type: t, content: c }
    }
    if (typeof c === 'string') return { type: 1, content: c }
    if (typeof c.type === 'number' && c.content !== undefined) return { type: c.type, content: c.content }
    if (typeof c.text === 'string') return { type: 1, content: c.text }
    if (c.url) return { type: 2, content: c }
    if (c.kind === 'image') return { type: 2, content: c }
    if (c.kind === 'voice') return { type: 5, content: c }
  }
  if (msg.payload) {
    try {
      const bin = atob(msg.payload)
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
      const decoded = JSON.parse(new TextDecoder().decode(bytes))
      if (decoded && typeof decoded === 'object') {
        return { type: decoded.type || 1, content: decoded.content ?? decoded }
      }
    } catch { /* 非致命 */ }
  }
  return null
}
function absUrl(url: string) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return 'https://aigc.fushtn.com' + (url.startsWith('/') ? url : '/' + url)
}
function isSystem(m: any) { return !!m.isSystem || (m.content && typeof m.content === 'object' && m.content.kind === 'system') }
function msgText(m: any) {
  if (m.isSystem) return m.content || ''
  const parsed = parseContent(m)
  if (!parsed) return ''
  const { type, content } = parsed
  if (type === 1) {
    if (typeof content === 'string') return content
    if (content?.text) return content.text
    if (content?.content) return content.content
    return ''
  }
  if (type === 2) return '[图片]'
  if (type === 3) return '[文件] ' + (content?.name || '')
  if (type === 4) return '[视频]'
  if (type === 5) return '[语音] ' + (content?.duration ? `${Math.round(Number(content.duration))}"` : '')
  return '[消息]'
}
function isImage(m: any) {
  const parsed = parseContent(m)
  if (!parsed) return false
  if (parsed.type === 2) return true
  const c = parsed.content
  return !!(c?.url && /\.(png|jpe?g|gif|webp)(\?|$)/i.test(c.url))
}
function imgUrl(m: any) {
  const parsed = parseContent(m)
  return parsed?.content?.url ? absUrl(parsed.content.url) : ''
}
function msgName(m: any) {
  if (m.fromUID === tea.userId.value) return '我'
  if (m.authorName) return m.authorName
  const mem = groupMembers.value.find((x: any) => x.uid === m.fromUID)
  if (mem?.name) return mem.name
  const fr = friends.value.find((x) => x.id === m.fromUID)
  if (fr?.name) return fr.name
  return (m.fromUID || '?').slice(0, 6)
}
function msgTime(m: any) {
  if (!m.timestamp) return ''
  const d = new Date(m.timestamp)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function msgKey(m: any) {
  return `${m.clientMsgNo || ''}-${m.messageSeq || ''}-${m.timestamp || ''}-${Math.random().toString(36).slice(2, 5)}`
}
const previewUrl = ref('')
function previewImg(url: string) { previewUrl.value = url }

// ── 群详情 ──
const groupDetailOpen = ref(false)
const groupDetail = ref<any>(null)
const groupMembers = ref<any[]>([])
async function loadGroupDetail() {
  const ch = currentChannel.value
  if (!ch?.groupId) return
  try {
    const r = await fetch(`/api/im/groups/${ch.groupId}`, { headers: { Authorization: 'Bearer ' + authToken() } })
    const j = await r.json()
    if (j.success) {
      groupDetail.value = j.data.group
      groupMembers.value = j.data.members || []
    }
  } catch { /* ignore */ }
}
function openGroupDetail() { loadGroupDetail(); groupDetailOpen.value = true }

// ═══════════════ Tab2 好友 ═══════════════
const friendSearch = ref('')
const filteredGroups = computed(() => {
  const q = friendSearch.value.trim()
  return q ? groups.value.filter((g) => (g.name || '').includes(q)) : groups.value
})

// 建群
const createGroupOpen = ref(false)
const createGroupName = ref('')
const createGroupIntro = ref('')
const createGroupError = ref('')
const createGroupBusy = ref(false)
function openCreateGroup() { createGroupOpen.value = true; createGroupError.value = '' }
async function createGroup() {
  const name = createGroupName.value.trim()
  if (!name) { createGroupError.value = '群名称必填'; return }
  createGroupBusy.value = true
  createGroupError.value = ''
  try {
    const r = await fetch('/api/im/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken() },
      body: JSON.stringify({ name, intro: createGroupIntro.value.trim() }),
    })
    const j = await r.json()
    if (!j.success) { createGroupError.value = j.error || '创建失败'; return }
    createGroupOpen.value = false
    createGroupName.value = ''
    createGroupIntro.value = ''
    await loadChannels()
    const g = j.data.group
    const ch = { id: g.channelId, groupId: g.id, type: 4, name: g.name, desc: `共 ${g.memberCount} 位群友`, kind: 'group', groupRole: 2, ownerUid: g.ownerUid, memberCount: g.memberCount }
    activeTab.value = 'chat'
    await openChannel(ch)
  } catch (e) {
    createGroupError.value = (e as Error).message
  } finally {
    createGroupBusy.value = false
  }
}

// ═══════════════ Tab3 社区 ═══════════════
const categories = ref<any[]>([])
const posts = ref<any[]>([])
const communityCat = ref('')
const postsLoading = ref(false)
async function loadCategories() {
  try {
    const r = await authFetch('/api/community/categories')
    const j = await r.json()
    categories.value = [{ name: '全部', slug: '' }, ...(j.categories || [])]
  } catch { categories.value = [{ name: '全部', slug: '' }] }
}
async function loadPosts() {
  postsLoading.value = true
  try {
    const params = new URLSearchParams()
    params.set('page', '1')
    params.set('pageSize', '20')
    if (communityCat.value) params.set('categorySlug', communityCat.value)
    const r = await authFetch(`/api/community/posts?${params.toString()}`)
    const j = await r.json()
    posts.value = j.posts || []
  } catch { posts.value = [] } finally { postsLoading.value = false }
}
function switchCommunityCat(slug: string) { communityCat.value = slug; loadPosts() }
function openPost(p: any) { window.location.href = `/community/post/${p.id}` }
function goCommunityNew() { window.location.href = '/community/new' }
function timeAgo(iso: string) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  const diff = Date.now() - t
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  return `${d} 天前`
}

// ═══════════════ Tab4 我的 ═══════════════
const mineEntries = [
  { icon: '📦', label: '我的订单', to: '/user/orders' },
  { icon: '👥', label: '我的团队', to: '/user/team' },
  { icon: '💬', label: '我的消息', to: '/user/messages' },
  { icon: '🎁', label: '邀请有礼', to: '/user/referral' },
  { icon: '🖼️', label: '我的作品', to: '/user/gallery' },
  { icon: '⚙️', label: '设置', to: '/user/settings' },
]
async function loadMine() {
  try {
    const r = await authFetch('/api/auth/me')
    const j = await r.json()
    const u = j.user || j.data?.user || j
    if (u?.nickname) myName.value = u.nickname
    else if (u?.username) myName.value = u.username
    if (u?.avatarUrl) myAvatar.value = u.avatarUrl
    if (u?.email) myEmail.value = u.email
    if (u?.membership?.tier || j.membership?.tier) {
      const t = u?.membership?.tier || j.membership?.tier
      tierLabel.value = t === 'vip' ? 'VIP 会员' : t === 'svip' ? 'SVIP 会员' : '普通会员'
    }
  } catch { /* 未登录 */ }
  const p = readMyProfile()
  if (p) { if (p.nickname) myName.value = p.nickname; else if (p.username) myName.value = p.username }
  try {
    const r = await authFetch('/api/wallet')
    const j = await r.json()
    if (j.walletBalance !== undefined) walletBalance.value = String(j.walletBalance)
    else if (j.data?.walletBalance !== undefined) walletBalance.value = String(j.data.walletBalance)
  } catch { /* ignore */ }
  // 积分/钻石：从 auth_user 或 me 兜底
  try {
    const r = await authFetch('/api/auth/me')
    const j = await r.json()
    const u = j.user || j.data?.user || j
    if (u?.credits !== undefined) credits.value = String(u.credits)
    if (u?.diamonds !== undefined) diamonds.value = String(u.diamonds)
  } catch { /* ignore */ }
}
function doLogout() {
  try {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('accessToken')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('user')
    document.cookie = 'auth_token=; path=/; max-age=0'
    document.cookie = 'auth_user=; path=/; max-age=0'
  } catch { /* ignore */ }
  showToast('已退出登录')
  setTimeout(() => { window.location.href = '/' }, 600)
}

// ═══════════════ Tab 切换 & 实时消息 ═══════════════
function switchTab(key: string) {
  if (activeTab.value === key) return
  activeTab.value = key
  if (key === 'contacts' && !friends.value.length) loadFriends()
  if (key === 'community' && !posts.value.length) { loadCategories(); loadPosts() }
  if (key === 'mine') loadMine()
  // 离开茶馆 tab 时关闭聊天窗
  if (key !== 'chat' && currentChannel.value) closeChannel()
}

// 实时消息：当前频道追加，其他频道累计未读
watch(() => tea.connected.value, (v) => { if (v) { loadChannels(); loadFriends() } })
onMounted(() => {
  const p = readMyProfile()
  if (p) { myName.value = p.nickname || p.username || '' }
  loadMine()
  if (!isLoggedIn.value) {
    // 中间件已拦截；此处兜底：跳手机版登录页
    tea.disconnect?.()
    router.replace('/mobile-login?redirect=' + encodeURIComponent(route.fullPath))
    return
  }
  tea.connect()
  tea.onMessage((msg: any) => {
    const msgChannel = msg.channel
    const chId = msgChannel?.channelID
    const chType = msgChannel?.channelType ?? 4
    if (currentChannel.value && chId === currentChannel.value.id && chType === currentChannel.value.type) {
      messages.value.push(msg)
      scrollToBottom()
    } else {
      const key = chId + ':' + chType
      unreadMap.value[key] = (unreadMap.value[key] || 0) + 1
    }
  })
  // 定时刷新会话/好友
  const iv = setInterval(() => { if (tea.connected.value) loadChannels() }, 30000)
  onBeforeUnmount(() => clearInterval(iv))
})

// 全局消息事件（chat 页同款桥接：CLIENT_MSG 等）
if (typeof window !== 'undefined') {
  const onGlobal = (e: any) => {
    const d = e.detail
    if (d?.type === 'CLIENT_MSG' && d.msg) {
      const chId = d.msg.channelID || d.msg.channel_id
      const chType = d.msg.channelType ?? d.msg.channel_type ?? 4
      if (currentChannel.value && chId === currentChannel.value.id && chType === currentChannel.value.type) {
        messages.value.push(d.msg)
        scrollToBottom()
      }
    }
  }
  window.addEventListener('tea:client-msg', onGlobal)
  onBeforeUnmount(() => window.removeEventListener('tea:client-msg', onGlobal))
}
</script>

<style scoped>
/* ═══ 手机壳 ═══ */
.tea-app {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  max-width: 640px;
  margin: 0 auto;
  background: #f5f6f7;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
  color: #1a1a1a;
  overflow: hidden;
}
.tea-app-toast {
  position: fixed;
  top: 12%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.78);
  color: #fff;
  padding: 9px 18px;
  border-radius: 20px;
  font-size: 13px;
  z-index: 999;
  max-width: 78vw;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ═══ 顶栏 ═══ */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 10px;
  background: #fff;
  border-bottom: 1px solid #ececec;
  flex-shrink: 0;
  min-height: 52px;
}
.header-left { display: flex; align-items: center; gap: 10px; }
.header-logo { font-size: 22px; }
.header-titles { display: flex; flex-direction: column; }
.header-title { font-size: 17px; font-weight: 700; }
.header-sub { font-size: 11px; color: #999; }
.header-sub.is-on { color: #07c160; }
.header-sub.is-connecting { color: #f5a623; }
.header-sub.is-off { color: #999; }
.header-actions { display: flex; gap: 12px; }
.header-icon {
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  background: #f2f2f2; border-radius: 50%;
  font-size: 16px; cursor: pointer;
  color: #576b95;
}

/* ═══ 主体 ═══ */
.app-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.tab-pane { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }

/* ═══ 茶馆-会话列表 ═══ */
.chat-search {
  display: flex; align-items: center; gap: 8px;
  margin: 10px 12px; padding: 8px 12px;
  background: #fff; border-radius: 8px;
  flex-shrink: 0;
}
.search-ic { font-size: 14px; opacity: 0.5; }
.chat-search-input { flex: 1; border: none; outline: none; font-size: 14px; background: transparent; }
.conv-list { flex: 1; overflow-y: auto; }
.conv-item {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px; background: #fff;
  border-bottom: 1px solid #f2f2f2;
  cursor: pointer;
}
.conv-item:active { background: #f7f7f7; }
.conv-avatar {
  width: 44px; height: 44px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; color: #fff; flex-shrink: 0;
}
.conv-avatar.is-public { background: linear-gradient(135deg, #b8860b, #d4a017); }
.conv-avatar.is-group { background: linear-gradient(135deg, #07c160, #06ad56); }
.conv-avatar.is-dm { background: linear-gradient(135deg, #576b95, #4a5b85); }
.conv-info { flex: 1; min-width: 0; }
.conv-name { font-size: 15px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.conv-preview { font-size: 12px; color: #999; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.conv-unread {
  min-width: 18px; height: 18px; padding: 0 5px;
  background: #fa5151; color: #fff; border-radius: 9px;
  font-size: 11px; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.conv-empty { text-align: center; color: #999; padding: 60px 20px; font-size: 14px; }
.conv-empty-sub { font-size: 12px; margin-top: 8px; }

/* ═══ 茶馆-好友选择 ═══ */
.picker-pane { display: flex; flex-direction: column; height: 100%; }
.picker-head { display: flex; align-items: center; gap: 12px; padding: 14px; background: #fff; border-bottom: 1px solid #ececec; }
.picker-back { font-size: 16px; color: #576b95; cursor: pointer; }
.picker-title { font-size: 16px; font-weight: 600; }
.picker-list { flex: 1; overflow-y: auto; background: #fff; }
.picker-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-bottom: 1px solid #f2f2f2; cursor: pointer; }
.picker-item:active { background: #f7f7f7; }
.picker-avatar {
  width: 40px; height: 40px; border-radius: 50%;
  background: linear-gradient(135deg, #576b95, #4a5b85); color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0;
}
.picker-name { flex: 1; font-size: 15px; }
.picker-online { font-size: 11px; color: #bbb; margin-left: 8px; }
.picker-online.on { color: #07c160; }

/* ═══ 茶馆-聊天窗 ═══ */
.chat-window { display: flex; flex-direction: column; height: 100%; }
.chat-head { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: #fff; border-bottom: 1px solid #ececec; flex-shrink: 0; }
.chat-back { font-size: 22px; color: #576b95; cursor: pointer; padding-right: 4px; }
.chat-head-info { flex: 1; min-width: 0; }
.chat-head-name { font-size: 16px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chat-head-sub { font-size: 11px; color: #999; margin-top: 1px; }
.chat-head-opt { font-size: 20px; color: #576b95; cursor: pointer; }
.chat-msgs {
  flex: 1; overflow-y: auto; padding: 14px 12px;
  background: #ededed;
  -webkit-overflow-scrolling: touch;
}
.msg-row { display: flex; gap: 10px; margin-bottom: 14px; }
.msg-row.mine { flex-direction: row-reverse; }
.msg-avatar {
  width: 36px; height: 36px; border-radius: 6px; flex-shrink: 0;
  background: linear-gradient(135deg, #07c160, #06ad56); color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 15px;
}
.msg-row.mine .msg-avatar { background: linear-gradient(135deg, #576b95, #4a5b85); }
.msg-main { max-width: 72%; display: flex; flex-direction: column; }
.msg-row.mine .msg-main { align-items: flex-end; }
.msg-author { font-size: 11px; color: #999; margin: 0 4px 3px; }
.msg-bubble {
  background: #fff; border-radius: 8px; padding: 9px 12px;
  font-size: 15px; line-height: 1.45; word-break: break-word;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.msg-row.mine .msg-bubble { background: #95ec69; }
.msg-bubble.system { background: transparent; box-shadow: none; color: #999; font-size: 12px; text-align: center; }
.msg-img { max-width: 180px; max-height: 220px; border-radius: 8px; display: block; }
.msg-time { font-size: 10px; color: #bbb; margin: 3px 4px 0; }
.chat-input-bar {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; background: #f7f7f7; border-top: 1px solid #e5e5e5;
  flex-shrink: 0;
}
.chat-input {
  flex: 1; padding: 9px 12px; border: none; border-radius: 8px;
  font-size: 15px; background: #fff; outline: none;
}
.chat-send {
  padding: 8px 16px; border: none; border-radius: 8px;
  background: #07c160; color: #fff; font-size: 14px; cursor: pointer;
  flex-shrink: 0;
}
.chat-send:disabled { opacity: 0.4; }

/* ═══ 好友 tab ═══ */
.contacts-pane { padding-bottom: 12px; }
.contact-group { background: #fff; margin: 10px 12px 0; border-radius: 10px; overflow: hidden; }
.contact-group-title {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 14px 6px; font-size: 13px; color: #999;
}
.contact-group-count { font-size: 11px; color: #ccc; }
.contact-item { display: flex; align-items: center; gap: 12px; padding: 11px 14px; cursor: pointer; border-bottom: 1px solid #f6f6f6; }
.contact-item:active { background: #f7f7f7; }
.contact-info { flex: 1; min-width: 0; }
.contact-name { font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.contact-sub { font-size: 12px; color: #999; margin-top: 2px; }
.contact-arrow { color: #ccc; font-size: 18px; }
.contact-empty { padding: 14px; font-size: 13px; color: #999; text-align: center; }

/* ═══ 社区 tab ═══ */
.community-pane { padding-bottom: 70px; }
.community-tabs {
  display: flex; gap: 8px; overflow-x: auto; padding: 10px 12px;
  background: #fff; border-bottom: 1px solid #ececec;
  -webkit-overflow-scrolling: touch;
  position: sticky; top: 0; z-index: 5;
}
.community-tab {
  flex-shrink: 0; padding: 5px 14px; border-radius: 14px;
  font-size: 13px; background: #f2f2f2; color: #666; cursor: pointer;
}
.community-tab.active { background: #07c160; color: #fff; }
.post-list { padding: 8px 12px; }
.post-item {
  background: #fff; border-radius: 10px; padding: 12px 14px; margin-bottom: 10px;
  cursor: pointer;
}
.post-item:active { background: #f9f9f9; }
.post-title { font-size: 15px; font-weight: 600; line-height: 1.4; }
.post-summary { font-size: 13px; color: #666; margin-top: 5px; line-height: 1.5; }
.post-meta { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 12px; color: #999; }
.post-author { color: #576b95; }
.post-stats { margin-left: auto; }
.community-fab {
  position: fixed; right: 20px; bottom: 84px;
  background: #07c160; color: #fff; border: none; border-radius: 24px;
  padding: 11px 18px; font-size: 14px; cursor: pointer;
  box-shadow: 0 4px 12px rgba(7, 193, 96, 0.35);
  z-index: 20;
}

/* ═══ 我的 tab ═══ */
.mine-pane { padding: 12px; }
.mine-hero {
  display: flex; align-items: center; gap: 12px;
  background: linear-gradient(135deg, #1f2d3d, #2c3e50);
  color: #fff; border-radius: 12px; padding: 18px 16px; cursor: pointer;
}
.mine-avatar {
  width: 52px; height: 52px; border-radius: 50%;
  background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center;
  font-size: 22px; flex-shrink: 0;
}
.mine-info { flex: 1; min-width: 0; }
.mine-name { font-size: 17px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mine-tier { font-size: 12px; opacity: 0.8; margin-top: 3px; }
.mine-arrow { font-size: 20px; opacity: 0.6; }
.mine-assets {
  display: flex; background: #fff; border-radius: 12px; margin-top: 10px;
  padding: 14px 0;
}
.asset-cell { flex: 1; text-align: center; cursor: pointer; }
.asset-num { font-size: 17px; font-weight: 700; color: #1a1a1a; }
.asset-label { font-size: 12px; color: #999; margin-top: 3px; }
.mine-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
  background: #fff; border-radius: 12px; margin-top: 10px; padding: 14px 8px;
}
.mine-entry { text-align: center; padding: 8px 0; cursor: pointer; border-radius: 8px; }
.mine-entry:active { background: #f5f5f5; }
.mine-entry-icon { font-size: 22px; }
.mine-entry-label { font-size: 12px; color: #555; margin-top: 6px; }
.mine-logout {
  width: 100%; margin-top: 16px; padding: 12px;
  border: none; border-radius: 10px; background: #fff; color: #fa5151;
  font-size: 15px; cursor: pointer;
}

/* ═══ 底部 TabBar ═══ */
.tab-bar {
  display: flex; background: #fff; border-top: 1px solid #e5e5e5;
  padding-bottom: env(safe-area-inset-bottom);
  flex-shrink: 0; z-index: 30;
}
.tab-item {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  padding: 7px 0 6px; cursor: pointer; color: #999;
}
.tab-item.active { color: #07c160; }
.tab-icon { font-size: 21px; line-height: 1.1; }
.tab-label { font-size: 10px; margin-top: 2px; }

/* ═══ 弹窗 ═══ */
.tea-app-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.tea-app-modal {
  width: 82%; max-width: 340px; background: #fff; border-radius: 14px;
  padding: 18px 16px;
}
.modal-title { font-size: 16px; font-weight: 700; text-align: center; margin-bottom: 14px; }
.modal-input {
  width: 100%; box-sizing: border-box; padding: 10px 12px; margin-bottom: 10px;
  border: 1px solid #e5e5e5; border-radius: 8px; font-size: 14px; outline: none;
}
.modal-error { color: #fa5151; font-size: 12px; margin-bottom: 8px; }
.modal-actions { display: flex; gap: 10px; margin-top: 6px; }
.modal-btn {
  flex: 1; padding: 10px; border: none; border-radius: 8px; font-size: 14px; cursor: pointer;
}
.modal-btn.cancel { background: #f2f2f2; color: #666; }
.modal-btn.ok { background: #07c160; color: #fff; }
.modal-btn.ok:disabled { opacity: 0.4; }
.grp-detail-modal { max-height: 70vh; overflow: hidden; display: flex; flex-direction: column; }
.grp-members { flex: 1; overflow-y: auto; max-height: 45vh; }
.grp-member { display: flex; align-items: center; gap: 10px; padding: 9px 4px; border-bottom: 1px solid #f6f6f6; }
.grp-member-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: linear-gradient(135deg, #07c160, #06ad56); color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 14px;
}
.grp-member-name { flex: 1; font-size: 14px; }
.grp-member-tag { font-size: 10px; color: #b8860b; background: #fdf6e3; border-radius: 4px; padding: 2px 6px; }
.img-mask { background: rgba(0,0,0,0.85); }
.preview-img { max-width: 90vw; max-height: 80vh; border-radius: 8px; }
</style>
