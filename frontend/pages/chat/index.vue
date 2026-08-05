<template>
  <div class="tea-page">
    <div v-if="toastMsg" class="tea-toast">{{ toastMsg }}</div>
    <!-- 顶栏 -->
    <header class="tea-header">
      <div class="tea-brand">
        <span class="tea-logo">🍵</span>
        <div class="tea-title-wrap">
          <h1 class="tea-title">昆仑茶馆</h1>
          <p class="tea-sub">昆仑镜 · 三栏控制台</p>
        </div>
      </div>
      <div class="tea-status" :class="tea.connected.value ? 'is-on' : tea.connecting.value ? 'is-connecting' : 'is-off'">
        <span class="status-dot"></span>
        {{ tea.statusLabel.value }}
      </div>
      <button v-if="tea.connected.value" class="tea-btn ghost" @click="handleDisconnect">断开</button>
      <button class="tea-btn ghost member-toggle" @click="rightPanelOpen = !rightPanelOpen">
        {{ rightPanelOpen ? '收起面板' : '成员/好友' }}
      </button>
    </header>

    <div class="tea-body">
      <!-- ══ 左栏：会话导航 ══ -->
      <aside class="tea-sidebar">
        <div class="sidebar-search">
          <span class="search-icon">🔍</span>
          <input v-model="search" class="search-input" placeholder="搜频道 / 搜好友" />
        </div>

        <!-- 公共频道 -->
        <div class="side-group">
          <div class="side-group-title">🏮 公共频道</div>
          <div
            v-for="ch in filteredPublic"
            :key="ch.id"
            class="channel-item"
            :class="{ active: isActive(ch) }"
            @click="switchChannel(ch)"
          >
            <span class="channel-icon">🏮</span>
            <div class="channel-meta">
              <span class="channel-name">{{ ch.name }}</span>
              <span class="channel-desc">{{ ch.desc }}</span>
            </div>
          </div>
        </div>

        <!-- 我的频道（P1 预留） -->
        <div class="side-group">
          <div class="side-group-title">📁 我的频道</div>
          <div v-if="!filteredGroups.length" class="side-empty">暂无频道 · 敬请期待</div>
          <div
            v-for="ch in filteredGroups"
            :key="ch.id"
            class="channel-item"
            :class="{ active: isActive(ch) }"
            @click="switchChannel(ch)"
          >
            <span class="channel-icon">👥</span>
            <div class="channel-meta">
              <span class="channel-name">{{ ch.name }}</span>
              <span class="channel-desc">{{ ch.desc }}</span>
            </div>
          </div>
        </div>

        <!-- 最近私聊 -->
        <div class="side-group">
          <div class="side-group-title">💬 最近私聊</div>
          <div v-if="!filteredDms.length" class="side-empty">暂无私聊 · 右边好友点一下就能开聊</div>
          <div
            v-for="ch in filteredDms"
            :key="ch.id"
            class="channel-item"
            :class="{ active: isActive(ch) }"
            @click="switchChannel(ch)"
          >
            <span class="channel-icon">👤</span>
            <div class="channel-meta">
              <span class="channel-name">{{ ch.name }}</span>
              <span class="channel-desc">{{ ch.desc }}</span>
            </div>
          </div>
        </div>

        <div class="sidebar-foot">
          <span class="foot-hint">图片/短视频/文件 · 红包礼物 · 语音视频（陆续上桌）</span>
        </div>
      </aside>

      <!-- ══ 中栏：聊天窗口 ══ -->
      <section class="tea-chat">
        <div v-if="authFailed" class="chat-empty">
          <span class="empty-emoji">🔐</span>
          <p>请先登录昆仑镜，再进茶馆喝茶</p>
          <NuxtLink to="/" class="tea-btn primary go-login">去登录</NuxtLink>
        </div>
        <div v-else-if="!currentChannel" class="chat-empty">
          <span class="empty-emoji">🍵</span>
          <p>选一个频道，开始摆龙门阵</p>
        </div>
        <template v-else>
          <div class="chat-head">
            <div class="chat-head-main">
              <span class="chat-head-icon">{{ currentChannel.kind === 'dm' ? '👤' : '🏮' }}</span>
              <div>
                <div class="chat-head-name">{{ currentChannel.name }}</div>
                <div class="chat-head-sub">{{ members.length ? `共 ${members.length} 位茶客` : (currentChannel.kind === 'dm' ? '私聊' : '公共频道') }}</div>
              </div>
            </div>
          </div>
          <div ref="msgListRef" class="msg-list">
            <div v-for="msg in displayMessages" :key="msg.key" class="msg-row" :class="{ mine: msg.fromUID === tea.userId.value }">
              <div class="msg-bubble">
                <div class="msg-meta">
                  <span class="msg-author">{{ msg.authorName || (msg.fromUID === tea.userId.value ? '我' : memberName(msg.fromUID)) }}</span>
                  <span class="msg-time">{{ fmtTime(msg.timestamp) }}</span>
                </div>
                <div class="msg-content" v-html="renderMsg(msg)"></div>
              </div>
            </div>
            <div v-if="loadingHistory" class="msg-loading">正在烫茶…</div>
          </div>

          <div class="msg-input-bar">
            <textarea
              v-model="draft"
              class="msg-input"
              placeholder="和茶客们聊聊…（Enter 发送，Shift+Enter 换行）"
              rows="2"
              @keydown.enter.exact.prevent="handleSend"
            ></textarea>
            <button class="tea-btn primary" :disabled="!draft.trim() || !tea.connected.value" @click="handleSend">发送</button>
          </div>
        </template>
      </section>

      <!-- ══ 右栏：成员 / 好友 ══ -->
      <aside class="tea-panel" :class="{ open: rightPanelOpen }">
        <div class="panel-tabs">
          <button class="panel-tab" :class="{ active: rightTab === 'members' }" @click="rightTab = 'members'">成员</button>
          <button class="panel-tab" :class="{ active: friendPanel }" @click.stop="toggleFriendPanel">好友</button>
        </div>

        <!-- 成员 tab：资料卡（好友菜单查看资料） > 私聊资料卡 > 频道成员列表 -->
        <div v-if="rightTab === 'members'" class="panel-body">
          <template v-if="profileUser">
            <div class="peer-card">
              <div class="peer-avatar">{{ profileUser.name.slice(0, 1) }}</div>
              <div class="peer-name">{{ profileUser.name }}</div>
              <div class="peer-sub">{{ profileUser.email || '平台茶客 · 茶馆名录' }}</div>
              <div class="peer-badge" :class="{ online: profileUser.online }">
                <span class="status-dot"></span>{{ profileUser.online ? '在线' : '离线' }}
              </div>
            </div>
          </template>
          <template v-else-if="currentChannel && currentChannel.kind === 'dm'">
            <div class="peer-card">
              <div class="peer-avatar">{{ (peerInfo?.name || currentChannel.name || '?').slice(0, 1) }}</div>
              <div class="peer-name">{{ peerInfo?.name || currentChannel.name }}</div>
              <div class="peer-sub">{{ peerInfo?.email || '私聊 · 一对一说悄悄话' }}</div>
              <div class="peer-badge" :class="{ online: peerOnline }">
                <span class="status-dot"></span>{{ peerOnline ? '在线' : '离线' }}
              </div>
            </div>
          </template>
          <template v-else>
            <div class="panel-section-title">在线 ({{ onlineMembers.length }})</div>
            <div v-if="!onlineMembers.length" class="panel-empty">暂时没有在线茶客</div>
            <div v-for="m in onlineMembers" :key="m.uid" class="member-item">
              <div class="member-avatar">{{ (m.name || '?').slice(0, 1) }}</div>
              <div class="member-meta">
                <span class="member-name">{{ m.name || shortUid(m.uid) }} <span v-if="m.role === 2" class="bot-badge">🤖</span></span>
                <span class="member-sub">在线</span>
              </div>
            </div>
            <div class="panel-section-title">全部 ({{ members.length }})</div>
            <div v-if="!members.length" class="panel-empty">暂无成员</div>
            <div v-for="m in members" :key="m.uid" class="member-item">
              <div class="member-avatar">{{ (m.name || '?').slice(0, 1) }}</div>
              <div class="member-meta">
                <span class="member-name">{{ m.name || shortUid(m.uid) }} <span v-if="m.role === 2" class="bot-badge">🤖</span></span>
                <span class="member-sub">{{ m.status === 1 ? '在线' : '离线' }}</span>
              </div>
            </div>
          </template>
        </div>
      </aside>

      <!-- ══ 好友独立下拉框：Teleport 到 body + fixed，列表在框内滚动，绝不影响聊天页面 ══ -->
      <Teleport to="body">
        <div v-if="friendPanel" class="friend-panel" @click.stop>
          <div class="friend-panel-head">
            <span class="friend-panel-title">👥 茶客名录 ({{ users.length }})</span>
            <button class="friend-panel-close" @click="toggleFriendPanel">✕</button>
          </div>
          <input v-model="friendSearch" class="friend-panel-search" placeholder="搜好友…" />
          <div class="friend-panel-list" @wheel.stop>
            <div v-if="!filteredUsers.length" class="panel-empty">没有匹配的茶客</div>
            <div
              v-for="u in filteredUsers"
              :key="u.id"
              class="member-item clickable"
              :class="{ active: currentChannel?.kind === 'dm' && currentChannel.peerUid === u.id }"
              @click="openFriendMenu(u, $event)"
            >
              <div class="member-avatar">{{ u.name.slice(0, 1) }}</div>
              <div class="member-meta">
                <span class="member-name">{{ u.name }}</span>
                <span class="member-sub">
                  <span class="mini-dot" :class="{ on: u.online }"></span>{{ u.online ? '在线' : (u.email || '离线') }}
                </span>
              </div>
            </div>
          </div>
          <div class="friend-panel-foot">点茶客弹出菜单 · Esc 关闭</div>
        </div>
      </Teleport>

      <!-- 好友悬浮下拉菜单：独立弹层（fixed），不撑页面 / 不触发整页滚动 -->
      <Teleport to="body">
        <div
          v-if="friendMenu"
          class="friend-menu"
          :style="{ left: friendMenu.x + 'px', top: friendMenu.y + 'px' }"
          @click.stop
        >
          <div class="friend-menu-head">
            <div class="friend-menu-avatar">{{ friendMenu.user.name.slice(0, 1) }}</div>
            <div class="friend-menu-meta">
              <div class="friend-menu-name">{{ friendMenu.user.name }}</div>
              <div class="friend-menu-sub">
                <span class="mini-dot" :class="{ on: friendMenu.user.online }"></span>
                {{ friendMenu.user.online ? '在线' : (friendMenu.user.email || '离线') }}
              </div>
            </div>
          </div>
          <button class="friend-menu-item" @click="menuSend(friendMenu.user)">💬 发消息</button>
          <button class="friend-menu-item" @click="menuProfile(friendMenu.user)">👤 查看资料</button>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<script setup lang="ts">
// 昆仑茶馆 — 三栏控制台（SPRINT-IM-CHA-02）
// 左栏：会话导航（公共频道 / 我的频道 / 最近私聊）｜中栏：聊天｜右栏：成员 / 好友
// SDK 仅浏览器可用，SSR 阶段不渲染逻辑
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useKunlunTea } from '~/composables/useKunlunTea'

const tea = useKunlunTea()
const channels = ref<any[]>([])
const groups = ref<any[]>([])
const dms = ref<any[]>([])
const currentChannel = ref<any>(null)
const messages = ref<any[]>([])
const members = ref<any[]>([])
const users = ref<any[]>([])
const draft = ref('')
const loadingHistory = ref(false)
const authFailed = ref(false)
const msgListRef = ref<HTMLElement | null>(null)
const search = ref('')
const rightTab = ref<'members' | 'friends'>('members')
const rightPanelOpen = ref(true)
const friendMenu = ref<{ user: any; x: number; y: number } | null>(null)
const friendPanel = ref(false)
const friendSearch = ref('')
const profileUser = ref<any>(null)

const displayMessages = computed(() => messages.value)
const onlineMembers = computed(() => members.value.filter((m) => m.status === 1))
const peerUid = computed(() => (currentChannel.value?.kind === 'dm' ? currentChannel.value.peerUid : ''))
const peerInfo = computed(() => users.value.find((u) => u.id === peerUid.value) || null)
const peerOnline = computed(() => peerInfo.value?.online ?? false)

const filteredPublic = computed(() => channels.value.filter((c) => !search.value || c.name.includes(search.value)))
const filteredGroups = computed(() => groups.value.filter((c) => !search.value || c.name.includes(search.value)))
const filteredDms = computed(() => dms.value.filter((c) => !search.value || c.name.includes(search.value)))
const filteredUsers = computed(() => users.value.filter((u) => !friendSearch.value || u.name.includes(friendSearch.value)))

function isActive(ch: any) {
  return currentChannel.value && currentChannel.value.id === ch.id && currentChannel.value.type === ch.type
}

function shortUid(uid: string) {
  return uid ? uid.slice(0, 8) : '未知茶客'
}

function memberName(uid: string) {
  const m = members.value.find((x) => x.uid === uid)
  return m?.name || shortUid(uid)
}

function fmtTime(ts: number) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function renderMsg(msg: any) {
  let text = ''
  if (msg.content) {
    if (typeof msg.content === 'string') text = msg.content
    else if (msg.content.text) text = msg.content.text
    else if (msg.content.content) text = msg.content.content
  } else if (msg.payload) {
    try {
      // 正确 UTF-8 解码（atob 返回 latin1 字符串会导致中文乱码 →「刷新后消息不见」）
      const bin = atob(msg.payload)
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
      const decoded = JSON.parse(new TextDecoder().decode(bytes))
      text = decoded.content || ''
    } catch {
      text = ''
    }
  }
  return escapeHtml(text).replace(/\n/g, '<br/>')
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function msgKey(msg: any) {
  return `${msg.clientMsgNo || ''}-${msg.messageSeq || ''}-${msg.timestamp || ''}-${Math.random().toString(36).slice(2, 6)}`
}

async function loadChannels() {
  const data = await tea.loadChannels()
  if (!data) {
    authFailed.value = true
    return
  }
  channels.value = data.public || []
  groups.value = data.groups || []
  dms.value = data.dms || []
  // 默认进入公共频道
  if (!currentChannel.value && channels.value.length) {
    switchChannel(channels.value[0])
  }
}

async function loadMembersFor(ch: any) {
  if (!ch || ch.kind === 'dm') return
  const ms = await tea.loadMembers(ch.id, ch.type)
  members.value = ms
}

async function loadUsers() {
  users.value = await tea.loadUsers()
}

async function loadHistory() {
  if (!currentChannel.value) return
  loadingHistory.value = true
  const msgs = await tea.loadHistory(currentChannel.value.id, currentChannel.value.type, 0, 50)
  messages.value = msgs
    .map((m: any) => ({ ...m, key: msgKey(m) }))
    .sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0))
  loadingHistory.value = false
  scrollBottom()
}

async function switchChannel(ch: any) {
  profileUser.value = null
  currentChannel.value = ch
  messages.value = []
  members.value = []
  await Promise.all([loadHistory(), loadMembersFor(ch)])
  scrollBottom()
}

/** 点好友 → 创建/复用私聊频道 → 切到中栏（资料卡保留同人） */
async function openPrivate(u: any) {
  const data = await tea.ensurePrivate(u.id)
  if (!data) return
  const ch = {
    id: data.channel.id,
    type: data.channel.type,
    name: data.channel.name,
    desc: data.peer.email,
    kind: 'dm',
    peerUid: data.peer.id,
  }
  // 左栏最近私聊去重 + 置顶；关闭好友下拉框，右栏切「成员」tab 显示对方资料卡
  dms.value = [ch, ...dms.value.filter((d) => d.id !== ch.id)]
  currentChannel.value = ch
  friendPanel.value = false
  rightTab.value = 'members'
  syncBodyLock()
  messages.value = []
  members.value = []
  await loadHistory()
  scrollBottom()
}

/** 好友独立下拉框：打开/关闭（打开时锁定页面滚动，滚动只发生在框内） */
function toggleFriendPanel() {
  friendPanel.value = !friendPanel.value
  if (friendPanel.value) {
    rightTab.value = 'friends'
    closeFriendMenu()
  }
  syncBodyLock()
}

/** 统一页面滚动锁：面板或菜单任一打开 → 锁死 body，聊天页面纹丝不动 */
function syncBodyLock() {
  document.body.style.overflow = friendPanel.value || friendMenu.value ? 'hidden' : ''
}

/** 好友下拉菜单：定位（右侧/底部空间不足自动反弹）+ 锁定页面滚动 */
function openFriendMenu(u: any, e: MouseEvent) {
  // 关键：阻止本次 click 继续冒泡到 window 关闭监听器（否则菜单刚打开就被自己关掉）
  e.stopPropagation()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const MENU_W = 190
  const MENU_H = 138
  let x = Math.min(rect.left, window.innerWidth - MENU_W - 8)
  let y = rect.bottom + 6
  if (y + MENU_H > window.innerHeight) y = Math.max(8, rect.top - MENU_H - 6)
  // 兜底：任何情况下菜单都在视口内（防滚动后的项 rect 异常）
  x = Math.max(8, x)
  y = Math.max(8, y)
  friendMenu.value = { user: u, x, y }
  syncBodyLock()
}

function closeFriendMenu() {
  friendMenu.value = null
  syncBodyLock()
}

async function menuSend(u: any) {
  closeFriendMenu()
  await openPrivate(u)
}

function menuProfile(u: any) {
  closeFriendMenu()
  friendPanel.value = false
  syncBodyLock()
  profileUser.value = u
  rightTab.value = 'members'
}

// 发送送达追踪：SDK send 返回本地消息（messageSeq=0），服务端 Sendack 回执（clientSeq + reasonCode）
// 才是真正送达确认；超时未收到回执 = 连接异常静默丢消息 → toast 提示
const pendingSends = new Map<number, { clientSeq: number; clientMsgNo: string; warnTimer: ReturnType<typeof setTimeout> }>()
const toastMsg = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(text: string) {
  toastMsg.value = text
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMsg.value = ''
  }, 4000)
}

function trackSend(clientSeq: number, clientMsgNo: string, text: string) {
  const warnTimer = setTimeout(() => {
    if (pendingSends.has(clientSeq)) {
      pendingSends.delete(clientSeq)
      // 静默丢失：恢复草稿方便重试 + toast 提示（不再假装已发出）
      if (!draft.value) draft.value = text
      showToast('⚠ 消息可能未送达（网络不稳定），草稿已保留，请重试')
    }
  }, 4000)
  pendingSends.set(clientSeq, { clientSeq, clientMsgNo, warnTimer })
}

function markDelivered(clientSeq: number) {
  const p = pendingSends.get(clientSeq)
  if (p) {
    clearTimeout(p.warnTimer)
    pendingSends.delete(clientSeq)
  }
}

async function handleSend() {
  const text = draft.value.trim()
  if (!text || !tea.connected.value || !currentChannel.value) return
  draft.value = ''
  try {
    const msg = await tea.sendText(text, currentChannel.value.id, currentChannel.value.type)
    messages.value.push({ ...msg, key: msgKey(msg) })
    // clientSeq 在 SDK 本地消息对象上（send 返回的 message），Sendack 用它配对
    const clientSeq = msg.clientSeq ?? (msg as any).clientSeq
    if (typeof clientSeq === 'number') trackSend(clientSeq, msg.clientMsgNo || '', text)
    scrollBottom()
  } catch (e) {
    console.error('[昆仑茶馆] 发送失败', e)
    draft.value = text
    showToast('⚠ 发送失败，草稿已保留')
  }
}

function handleDisconnect() {
  tea.disconnect()
}

function scrollBottom() {
  nextTick(() => {
    if (msgListRef.value) msgListRef.value.scrollTop = msgListRef.value.scrollHeight
  })
}

// 窄屏自动折叠右栏
function handleResize() {
  if (typeof window !== 'undefined') {
    rightPanelOpen.value = window.innerWidth >= 1100
  }
}

// 外部点击 / Esc 关闭：菜单 + 好友下拉框
function onWindowClick() {
  closeFriendMenu()
  if (friendPanel.value) toggleFriendPanel()
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeFriendMenu()
    if (friendPanel.value) toggleFriendPanel()
  }
}

onMounted(async () => {
  tea.onMessage((msg: any) => {
    const ch = currentChannel.value
    if (!ch) return
    const msgChannel = msg.channel
    if (msgChannel && (msgChannel.channelID !== ch.id || msgChannel.channelType !== ch.type)) return
    if (msg.fromUID === tea.userId.value) return
    messages.value.push({ ...msg, key: msgKey(msg) })
    scrollBottom()
  })
  // 发送回执：reasonCode=0 送达；非 0 或超时 → 提示
  tea.onSendStatus((p: any) => {
    const clientSeq = p?.clientSeq
    if (typeof clientSeq !== 'number') return
    const pend = pendingSends.get(clientSeq)
    if (!pend) return
    if (p.reasonCode === 0 || p.reasonCode === undefined || p.reasonCode === null) {
      markDelivered(clientSeq)
    } else {
      pendingSends.delete(clientSeq)
      showToast('⚠ 消息发送失败（' + (p.reason || '连接异常') + '）')
    }
  })

  await Promise.all([loadChannels(), loadUsers()])
  try {
    await tea.connect()
  } catch (e) {
    console.error('[昆仑茶馆] 连接失败', e)
  }
  handleResize()
  window.addEventListener('resize', handleResize)
  // 点好友弹独立菜单：外部点击 / Esc 关闭
  window.addEventListener('click', onWindowClick)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('click', onWindowClick)
  window.removeEventListener('keydown', onKeydown)
  closeFriendMenu()
  friendPanel.value = false
  syncBodyLock()
})
</script>

<style scoped>
.tea-toast {
  position: fixed;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  padding: 10px 18px;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.92);
  color: #fff;
  font-size: 13px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
  pointer-events: none;
  animation: teaToastIn 0.25s ease;
}
@keyframes teaToastIn {
  from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
.tea-page {
  /* 微信群模式：页面锁死在视口高度，消息再多也不撑高页面、不挤走输入框 */
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background:
    radial-gradient(1200px 500px at 20% -10%, rgba(59, 130, 246, 0.12), transparent 60%),
    radial-gradient(900px 400px at 90% 0%, rgba(139, 92, 246, 0.08), transparent 55%),
    var(--color-bg-primary, #070b16);
  color: var(--color-text-primary, #f1f5f9);
  display: flex;
  flex-direction: column;
}

/* ── 顶栏 ─────────────────────────── */
.tea-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-border-primary, #1e293b);
  background: rgba(13, 19, 40, 0.85);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 10;
}
.tea-brand { display: flex; align-items: center; gap: 12px; }
.tea-logo {
  font-size: 26px;
  width: 46px; height: 46px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #1e5aa8, #3b82f6);
  border-radius: 14px;
  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.35);
}
.tea-title { font-size: 20px; font-weight: 700; letter-spacing: 2px; margin: 0; }
.tea-sub { font-size: 12px; color: var(--color-text-muted, #64748b); margin: 2px 0 0; }

.tea-status {
  margin-left: auto;
  display: flex; align-items: center; gap: 6px;
  font-size: 13px;
  padding: 5px 12px;
  border-radius: 20px;
  border: 1px solid var(--color-border-primary, #1e293b);
  color: var(--color-text-secondary, #94a3b8);
}
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: #64748b; display: inline-block; }
.tea-status.is-on { color: #10b981; border-color: rgba(16, 185, 129, 0.4); }
.tea-status.is-on .status-dot { background: #10b981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.7); }
.tea-status.is-connecting { color: #f59e0b; }
.tea-status.is-connecting .status-dot { background: #f59e0b; animation: blink 1s infinite; }
@keyframes blink { 50% { opacity: 0.3; } }
.member-toggle { display: none; }

/* ── 主体三栏 ─────────────────────── */
.tea-body {
  flex: 1;
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr) 260px;
  /* 行高锁死为剩余高度：中栏消息区内部滚动，输入框永不被挤出视口 */
  grid-template-rows: minmax(0, 1fr);
  min-height: 0;
}

/* 左栏 */
.tea-sidebar {
  border-right: 1px solid var(--color-border-primary, #1e293b);
  background: rgba(13, 19, 40, 0.6);
  padding: 12px 10px;
  display: flex; flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}
.sidebar-search {
  display: flex; align-items: center; gap: 8px;
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1e293b);
  border-radius: 10px;
  padding: 7px 10px;
}
.search-icon { font-size: 13px; opacity: 0.7; }
.search-input {
  flex: 1; background: transparent; border: none; outline: none;
  color: var(--color-text-primary, #f1f5f9); font-size: 13px;
}
.side-group { display: flex; flex-direction: column; gap: 3px; }
.side-group-title {
  font-size: 12px; color: var(--color-text-muted, #64748b);
  padding: 2px 8px 6px; letter-spacing: 1px; font-weight: 600;
}
.side-empty { font-size: 12px; color: var(--color-text-disabled, #475569); padding: 6px 10px; }
.channel-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s;
  border: 1px solid transparent;
}
.channel-item:hover { background: var(--color-bg-hover, #1a2240); }
.channel-item.active { background: rgba(59, 130, 246, 0.15); border-color: rgba(59, 130, 246, 0.3); }
.channel-icon { font-size: 18px; }
.channel-meta { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.channel-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.channel-desc { font-size: 11px; color: var(--color-text-muted, #64748b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sidebar-foot { margin-top: auto; padding: 8px 8px 0; font-size: 11px; color: var(--color-text-disabled, #475569); }

/* 中栏 */
.tea-chat { display: flex; flex-direction: column; min-height: 0; min-width: 0; }
.chat-head {
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-border-primary, #1e293b);
  background: rgba(13, 19, 40, 0.5);
  display: flex; align-items: center;
}
.chat-head-main { display: flex; align-items: center; gap: 10px; }
.chat-head-icon { font-size: 22px; }
.chat-head-name { font-size: 15px; font-weight: 700; }
.chat-head-sub { font-size: 11px; color: var(--color-text-muted, #64748b); }

.chat-empty {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; color: var(--color-text-muted, #64748b);
}
.empty-emoji { font-size: 48px; opacity: 0.6; }
.go-login { text-decoration: none; margin-top: 6px; }

.msg-list {
  flex: 1;
  min-height: 0; /* 允许收缩：消息多时在框内滚动，不撑高页面 */
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.msg-row { display: flex; }
.msg-row.mine { justify-content: flex-end; }
.msg-bubble {
  max-width: 62%;
  padding: 10px 14px;
  border-radius: 14px;
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1e293b);
}
.msg-row.mine .msg-bubble {
  background: linear-gradient(135deg, rgba(30, 90, 168, 0.35), rgba(59, 130, 246, 0.25));
  border-color: rgba(59, 130, 246, 0.35);
}
.msg-meta { display: flex; gap: 8px; align-items: baseline; margin-bottom: 4px; }
.msg-author { font-size: 12px; font-weight: 600; color: var(--color-decision, #3b82f6); }
.msg-row.mine .msg-author { color: var(--color-execution, #10b981); }
.msg-time { font-size: 11px; color: var(--color-text-disabled, #475569); }
.msg-content { font-size: 14px; line-height: 1.6; word-break: break-word; }
.msg-loading { text-align: center; font-size: 12px; color: var(--color-text-disabled, #475569); }

.msg-input-bar {
  display: flex; gap: 10px; align-items: flex-end;
  padding: 14px 20px 18px;
  border-top: 1px solid var(--color-border-primary, #1e293b);
  background: rgba(13, 19, 40, 0.8);
}
.msg-input {
  flex: 1;
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1e293b);
  border-radius: 12px;
  color: var(--color-text-primary, #f1f5f9);
  padding: 10px 14px;
  font-size: 14px;
  resize: none;
  outline: none;
  transition: border-color 0.2s;
}
.msg-input:focus { border-color: rgba(59, 130, 246, 0.6); }

/* 右栏 */
.tea-panel {
  border-left: 1px solid var(--color-border-primary, #1e293b);
  background: rgba(13, 19, 40, 0.6);
  display: flex; flex-direction: column;
  min-height: 0;
}
.panel-tabs {
  display: flex; gap: 4px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border-primary, #1e293b);
}
.panel-tab {
  flex: 1;
  background: transparent; border: 1px solid transparent;
  border-radius: 8px; padding: 6px 0;
  color: var(--color-text-muted, #64748b);
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: all 0.2s;
}
.panel-tab.active {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.3);
  color: var(--color-text-primary, #f1f5f9);
}
.panel-body { flex: 1; overflow-y: auto; padding: 12px; }
.panel-section-title {
  font-size: 12px; color: var(--color-text-muted, #64748b);
  padding: 8px 4px 6px; font-weight: 600;
}
.panel-empty { font-size: 12px; color: var(--color-text-disabled, #475569); padding: 8px 4px; }

.member-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
}
.member-item.clickable { cursor: pointer; transition: background 0.2s; }
.member-item.clickable:hover { background: var(--color-bg-hover, #1a2240); }
.member-item.active { background: rgba(59, 130, 246, 0.15); }
.member-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: linear-gradient(135deg, #1e5aa8, #3b82f6);
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.member-meta { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.member-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.member-sub { font-size: 11px; color: var(--color-text-muted, #64748b); }
.bot-badge { font-size: 11px; }
.mini-dot { width: 6px; height: 6px; border-radius: 50%; background: #64748b; display: inline-block; margin-right: 4px; }
.mini-dot.on { background: #10b981; box-shadow: 0 0 6px rgba(16, 185, 129, 0.7); }

/* ══ 好友独立下拉框：fixed 悬浮层，列表在框内滚动，聊天页面零影响 ══ */
.friend-panel {
  position: fixed;
  z-index: 9998;
  top: 64px;
  right: 12px;
  width: 300px;
  max-height: calc(100vh - 84px);
  display: flex;
  flex-direction: column;
  background: var(--color-bg-panel, #141a2e);
  border: 1px solid var(--color-border, #26304d);
  border-radius: 14px;
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.55);
  overflow: hidden;
  animation: panel-pop 0.18s ease-out;
}
@keyframes panel-pop {
  from { opacity: 0; transform: translateY(-8px) scale(0.98); }
  to { opacity: 1; transform: none; }
}
.friend-panel-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px 8px;
}
.friend-panel-title {
  font-size: 13px; font-weight: 700; color: var(--color-text, #e2e8f0);
  letter-spacing: 0.02em;
}
.friend-panel-close {
  width: 24px; height: 24px; border-radius: 50%;
  border: 0; background: transparent;
  color: var(--color-text-muted, #64748b);
  font-size: 13px; line-height: 1; cursor: pointer;
  transition: all 0.2s;
}
.friend-panel-close:hover { background: rgba(239, 68, 68, 0.15); color: #f87171; }
.friend-panel-search {
  margin: 0 12px 8px;
  background: rgba(7, 11, 22, 0.6);
  border: 1px solid var(--color-border-primary, #1e293b);
  border-radius: 8px;
  padding: 7px 10px;
  color: var(--color-text-primary, #f1f5f9);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}
.friend-panel-search:focus { border-color: rgba(59, 130, 246, 0.6); }
/* 核心：列表固定区域 + 框内独立滚动（overscroll 不穿透到页面） */
.friend-panel-list {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 8px 8px;
  min-height: 60px;
}
.friend-panel-foot {
  padding: 8px 12px;
  border-top: 1px solid var(--color-border-primary, #1e293b);
  font-size: 11px; color: var(--color-text-disabled, #475569);
  text-align: center;
}

/* 好友悬浮下拉菜单：独立弹层（fixed），不撑页面 / 不触发整页滚动 */
.friend-menu {
  position: fixed;
  z-index: 9999;
  width: 190px;
  background: var(--color-bg-panel, #141a2e);
  border: 1px solid var(--color-border, #26304d);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  padding: 8px;
  animation: menu-pop 0.15s ease-out;
}
@keyframes menu-pop {
  from { opacity: 0; transform: translateY(-4px) scale(0.98); }
  to { opacity: 1; transform: none; }
}
.friend-menu-head {
  display: flex; gap: 9px; align-items: center;
  padding: 4px 8px 9px;
  border-bottom: 1px solid var(--color-border, #26304d);
  margin-bottom: 6px;
}
.friend-menu-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: linear-gradient(135deg, #f59e0b, #b45309);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 700; flex-shrink: 0;
}
.friend-menu-meta { min-width: 0; }
.friend-menu-name { font-size: 13px; font-weight: 600; color: var(--color-text, #e2e8f0); }
.friend-menu-sub { font-size: 11px; color: var(--color-text-muted, #64748b); margin-top: 2px; }
.friend-menu-item {
  display: flex; align-items: center; gap: 8px;
  width: 100%; text-align: left;
  padding: 8px 10px; border: 0; border-radius: 8px;
  background: transparent; color: var(--color-text, #e2e8f0);
  font-size: 13px; cursor: pointer;
}
.friend-menu-item:hover { background: rgba(59, 130, 246, 0.15); }

/* 私聊资料卡 */
.peer-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 28px 12px 20px;
}
.peer-avatar {
  width: 72px; height: 72px; border-radius: 50%;
  background: linear-gradient(135deg, #1e5aa8, #3b82f6);
  display: flex; align-items: center; justify-content: center;
  font-size: 30px; font-weight: 700; color: #fff;
  box-shadow: 0 8px 30px rgba(59, 130, 246, 0.35);
}
.peer-name { font-size: 16px; font-weight: 700; margin-top: 6px; }
.peer-sub { font-size: 12px; color: var(--color-text-muted, #64748b); }
.peer-badge {
  display: flex; align-items: center; gap: 5px;
  font-size: 12px; color: #64748b;
  padding: 3px 10px; border-radius: 20px;
  border: 1px solid var(--color-border-primary, #1e293b);
  margin-top: 4px;
}
.peer-badge.online { color: #10b981; border-color: rgba(16, 185, 129, 0.4); }
.peer-badge.online .status-dot { background: #10b981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.7); }

/* 按钮 */
.tea-btn {
  border: none; border-radius: 10px;
  padding: 9px 18px;
  font-size: 14px; font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}
.tea-btn.primary {
  background: linear-gradient(135deg, #1e5aa8, #3b82f6);
  color: #fff;
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3);
}
.tea-btn.primary:disabled { opacity: 0.4; cursor: not-allowed; }
.tea-btn.primary:not(:disabled):hover { transform: translateY(-1px); }
.tea-btn.ghost {
  background: transparent;
  border: 1px solid var(--color-border-primary, #1e293b);
  color: var(--color-text-secondary, #94a3b8);
  padding: 6px 12px; font-size: 12px;
}
.tea-btn.ghost:hover { color: #f87171; border-color: rgba(248, 113, 113, 0.4); }

/* 响应式：<1100px 右栏收成抽屉 */
@media (max-width: 1100px) {
  .tea-body { grid-template-columns: 250px minmax(0, 1fr); }
  .tea-panel {
    position: fixed; right: 0; top: 64px; bottom: 0; width: 280px;
    transform: translateX(105%);
    transition: transform 0.25s ease;
    z-index: 20;
    box-shadow: -12px 0 40px rgba(0, 0, 0, 0.4);
    border-left: 1px solid var(--color-border-primary, #1e293b);
  }
  .tea-panel.open { transform: translateX(0); }
  .member-toggle { display: inline-block; }
}
@media (max-width: 768px) {
  .tea-body { grid-template-columns: 1fr; }
  .tea-sidebar { display: none; }
  .tea-panel { top: 56px; width: 260px; }
}
</style>
