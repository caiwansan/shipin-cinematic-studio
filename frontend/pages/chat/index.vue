<template>
  <div class="tea-page">
    <!-- 顶栏 -->
    <header class="tea-header">
      <div class="tea-brand">
        <span class="tea-logo">🍵</span>
        <div class="tea-title-wrap">
          <h1 class="tea-title">昆仑茶馆</h1>
          <p class="tea-sub">昆仑镜 · 公共聊天频道</p>
        </div>
      </div>
      <div class="tea-status" :class="tea.connected.value ? 'is-on' : tea.connecting.value ? 'is-connecting' : 'is-off'">
        <span class="status-dot"></span>
        {{ tea.statusLabel.value }}
      </div>
      <button v-if="tea.connected.value" class="tea-btn ghost" @click="handleDisconnect">断开</button>
    </header>

    <div class="tea-body">
      <!-- 左栏：会话列表 -->
      <aside class="tea-sidebar">
        <div class="sidebar-title">频道</div>
        <div
          v-for="ch in channels"
          :key="ch.id"
          class="channel-item"
          :class="{ active: currentChannel?.id === ch.id }"
          @click="switchChannel(ch)"
        >
          <span class="channel-icon">{{ ch.kind === 'public' ? '🏮' : '👥' }}</span>
          <div class="channel-meta">
            <span class="channel-name">{{ ch.name }}</span>
            <span class="channel-desc">{{ ch.desc }}</span>
          </div>
        </div>
        <div class="sidebar-foot">
          <span class="foot-hint">图片/短视频/文件 · 红包礼物 · 语音视频</span>
        </div>
      </aside>

      <!-- 右栏：消息窗 -->
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
          <div ref="msgListRef" class="msg-list">
            <div v-for="msg in displayMessages" :key="msg.key" class="msg-row" :class="{ mine: msg.fromUID === tea.userId.value }">
              <div class="msg-bubble">
                <div class="msg-meta">
                  <span class="msg-author">{{ msg.authorName || (msg.fromUID === tea.userId.value ? '我' : shortUid(msg.fromUID)) }}</span>
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
    </div>
  </div>
</template>

<script setup lang="ts">
// 昆仑茶馆 — 聊天页面（SPRINT-IM-CHA-01 P1：文本即时聊天闭环）
// SDK 仅浏览器可用，SSR 阶段不渲染逻辑
import { ref, computed, onMounted, nextTick } from 'vue'
import { useKunlunTea } from '~/composables/useKunlunTea'

const tea = useKunlunTea()
const channels = ref<any[]>([])
const currentChannel = ref<any>(null)
const messages = ref<any[]>([])
const draft = ref('')
const loadingHistory = ref(false)
const authFailed = ref(false)
const msgListRef = ref<HTMLElement | null>(null)

// 公共频道（与后端 PUBLIC_CHANNEL_ID 对齐）
const PUBLIC_CHANNEL = { id: 'kl_public_tea', type: 4 }

const displayMessages = computed(() => messages.value)

function shortUid(uid: string) {
  return uid ? uid.slice(0, 8) : '未知茶客'
}

function fmtTime(ts: number) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function renderMsg(msg: any) {
  // SDK 实时消息：content 为字符串 / {type, content} / MessageText 实例（text 属性）
  // HTTP history 拉取：payload 为 base64 编码的 {type, content}
  let text = ''
  if (msg.content) {
    if (typeof msg.content === 'string') text = msg.content
    else if (msg.content.text) text = msg.content.text
    else if (msg.content.content) text = msg.content.content
  } else if (msg.payload) {
    try {
      const decoded = JSON.parse(atob(msg.payload))
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
  const res = await fetch('/api/im/channels')
  const json = await res.json()
  if (json.success) {
    channels.value = json.data.channels
    if (channels.value.length) switchChannel(channels.value[0])
  } else {
    authFailed.value = true
  }
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

function switchChannel(ch: any) {
  currentChannel.value = ch
  messages.value = []
  loadHistory()
}

async function handleSend() {
  const text = draft.value.trim()
  if (!text || !tea.connected.value || !currentChannel.value) return
  draft.value = ''
  try {
    const msg = await tea.sendText(text, currentChannel.value.id, currentChannel.value.type)
    // 本地乐观追加（SDK 不向发送者回推消息，需自己渲染）
    messages.value.push({ ...msg, key: msgKey(msg) })
    scrollBottom()
  } catch (e) {
    console.error('[昆仑茶馆] 发送失败', e)
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

onMounted(async () => {
  // 消息回调注册必须在 connect 之前（composable 里 connect 时会挂上）
  tea.onMessage((msg: any) => {
    const ch = currentChannel.value
    if (!ch) return
    const msgChannel = msg.channel
    if (msgChannel && (msgChannel.channelID !== ch.id || msgChannel.channelType !== ch.type)) return
    // 自己发的消息由本地乐观追加渲染（SDK 发送回执会回推，避免重复）
    if (msg.fromUID === tea.userId.value) return
    messages.value.push({ ...msg, key: msgKey(msg) })
    scrollBottom()
  })

  await loadChannels()
  try {
    await tea.connect()
  } catch (e) {
    console.error('[昆仑茶馆] 连接失败', e)
  }
})
</script>

<style scoped>
.tea-page {
  min-height: 100vh;
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
  padding: 14px 24px;
  border-bottom: 1px solid var(--color-border-primary, #1e293b);
  background: rgba(13, 19, 40, 0.85);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 10;
}
.tea-brand { display: flex; align-items: center; gap: 12px; }
.tea-logo {
  font-size: 28px;
  width: 48px; height: 48px;
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
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: #64748b; }
.tea-status.is-on { color: #10b981; border-color: rgba(16, 185, 129, 0.4); }
.tea-status.is-on .status-dot { background: #10b981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.7); }
.tea-status.is-connecting { color: #f59e0b; }
.tea-status.is-connecting .status-dot { background: #f59e0b; animation: blink 1s infinite; }
@keyframes blink { 50% { opacity: 0.3; } }

/* ── 主体 ─────────────────────────── */
.tea-body {
  flex: 1;
  display: grid;
  grid-template-columns: 260px 1fr;
  min-height: 0;
}

/* 左栏 */
.tea-sidebar {
  border-right: 1px solid var(--color-border-primary, #1e293b);
  background: rgba(13, 19, 40, 0.6);
  padding: 16px 12px;
  display: flex; flex-direction: column;
  gap: 6px;
}
.sidebar-title { font-size: 12px; color: var(--color-text-muted, #64748b); padding: 0 8px 8px; letter-spacing: 2px; }
.channel-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
}
.channel-item:hover { background: var(--color-bg-hover, #1a2240); }
.channel-item.active { background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); }
.channel-icon { font-size: 20px; }
.channel-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.channel-name { font-size: 14px; font-weight: 600; }
.channel-desc { font-size: 11px; color: var(--color-text-muted, #64748b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sidebar-foot { margin-top: auto; padding: 10px 8px 0; font-size: 11px; color: var(--color-text-disabled, #475569); }

/* 右栏 */
.tea-chat { display: flex; flex-direction: column; min-height: 0; }
.chat-empty {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; color: var(--color-text-muted, #64748b);
}
.empty-emoji { font-size: 48px; opacity: 0.6; }
.go-login { text-decoration: none; margin-top: 6px; }

.msg-list { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 12px; }
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

/* 输入区 */
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

@media (max-width: 768px) {
  .tea-body { grid-template-columns: 1fr; }
  .tea-sidebar { display: none; }
}
</style>
