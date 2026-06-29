<template>
  <div class="p0-page">
    <!-- 背景 -->
    <div class="p0-bg-grid" />
    <div class="p0-bg-glow p0-bg-glow--tl" />
    <div class="p0-bg-glow p0-bg-glow--br" />

    <!-- 导航 -->
    <nav class="p0-nav">
      <div class="p0-nav-inner">
        <div class="p0-nav-left">
          <span class="p0-logo-icon">🪞</span>
          <span class="p0-logo-text">生活助手</span>
          <span class="p0-status-badge" :class="online ? 'badge-on' : 'badge-off'">
            {{ online ? '在线' : '离线' }}
          </span>
        </div>
        <div class="p0-nav-right">
          <NuxtLink to="/p0/coverage" class="p0-nav-link">📊 覆盖率</NuxtLink>
          <NuxtLink to="/p0/seeds" class="p0-nav-link">🌱 种子</NuxtLink>
          <NuxtLink to="/p0/fallbacks" class="p0-nav-link">🧩 Fallback</NuxtLink>
          <NuxtLink to="/" class="p0-nav-link">首页</NuxtLink>
          <NuxtLink to="/studio/v2" class="p0-nav-link">📽 工作台</NuxtLink>
          <button v-if="messages.length > 0" class="p0-clear-btn" @click="clearChat">清空</button>
        </div>
      </div>
    </nav>

    <!-- 对话区 -->
    <main ref="chatContainer" class="p0-chat" @click="focused = true">
      <!-- 空状态 -->
      <div v-if="messages.length === 0" class="p0-empty">
        <div class="p0-empty-icon">🪞</div>
        <h2 class="p0-empty-title">生活助手</h2>
        <p class="p0-empty-desc">基于确定性语义推理的智能问答</p>
        <div class="p0-empty-tips">
          <span>💬 随便聊聊生活问题</span>
          <span>🔍 查询产品口碑</span>
          <span>🏢 了解企业信息</span>
        </div>
      </div>

      <!-- 消息列表 -->
      <div v-else class="p0-messages">
        <div
          v-for="(msg, i) in messages"
          :key="i"
          class="p0-msg"
          :class="'p0-msg--' + msg.role"
          :style="{ animationDelay: (i === messages.length - 1 && !loading) ? '0s' : '0s' }"
        >
          <!-- 用户消息 -->
          <div v-if="msg.role === 'user'" class="p0-msg-user">
            <div class="p0-msg-bubble p0-msg-bubble--user">
              {{ msg.content }}
            </div>
          </div>

          <!-- 助手消息 -->
          <div v-else class="p0-msg-assistant">
            <div class="p0-msg-avatar">🪞</div>
            <div class="p0-msg-body">
              <div class="p0-msg-bubble p0-msg-bubble--assistant">
                <p class="p0-msg-text">{{ msg.decision }}</p>
                <div v-if="msg.degraded" class="p0-msg-note p0-msg-note--degraded">⚠ 退化模式 — 主路径未找到匹配证明</div>
                <div v-else-if="msg.verified" class="p0-msg-note p0-msg-note--verified">✔ P-0 已验证</div>
              </div>
              <!-- 指标 -->
              <div v-if="msg.metrics" class="p0-msg-metrics">
                <span v-if="msg.metrics.trustRate > 0" class="p0-metric-pill">{{ (msg.metrics.trustRate * 100).toFixed(0) }}% 可信</span>
                <span v-if="msg.confidence > 0" class="p0-metric-pill">{{ (msg.confidence * 100).toFixed(0) }}% 置信</span>
                <span v-if="msg.degraded" class="p0-metric-pill pill-degraded">退化</span>
                <span v-else class="p0-metric-pill pill-verified">已验证</span>
                <span v-if="msg.matchedSeed" class="p0-metric-pill pill-seed">{{ msg.matchedSeed.slice(0, 20) }}</span>
              </div>
              <span v-if="msg.traceId" class="p0-msg-trace">#{{ msg.traceId.slice(0, 12) }}</span>
            </div>
          </div>
        </div>

        <!-- 加载中 -->
        <div v-if="loading" class="p0-msg p0-msg--assistant">
          <div class="p0-msg-avatar">🪞</div>
          <div class="p0-msg-body">
            <div class="p0-msg-bubble p0-msg-bubble--assistant p0-msg-loading">
              <span class="p0-dot" />
              <span class="p0-dot" />
              <span class="p0-dot" />
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 输入栏（固定在底部） -->
    <div class="p0-input-bar" :class="{ 'p0-input-bar--focused': focused }">
      <div class="p0-input-inner">
        <textarea
          ref="inputRef"
          v-model="inputText"
          class="p0-input"
          placeholder="输入问题..."
          rows="1"
          @keydown.enter.prevent="send"
          @input="autoResize"
          @focus="focused = true"
          @blur="focused = false"
        />
        <button
          class="p0-send-btn"
          :disabled="!inputText.trim() || loading"
          @click="send"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  title: '生活助手',
  middleware: ['deprecated-module'],
  moduleName: 'customer-service',
})

// ===== 状态 =====
const inputText = ref('')
const messages = ref<ChatMessage[]>([])
const loading = ref(false)
const online = ref(true)
const focused = ref(true)

const chatContainer = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)

// ===== 持久化：退出不丢聊天 =====
const STORAGE_KEY = 'p0-chat-history'
function persistMessages() {
  try {
    const data = messages.value.map(m => ({
      role: m.role,
      content: m.content,
      confidence: m.confidence,
      traceId: m.traceId,
      degraded: m.degraded,
      matchedSeed: m.matchedSeed,
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.slice(-50))) // 最多保留 50 条
  } catch {}
}
function restoreMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    if (Array.isArray(data)) {
      messages.value = data.map((m: any) => ({
        ...m,
        role: m.role,
        content: m.content,
        verified: true,
      }))
    }
  } catch {}
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  decision?: string
  confidence?: number
  traceId?: string
  degraded?: boolean
  verified?: boolean
  matchedSeed?: string | null
  metrics?: {
    trustRate: number
    stability: number
    fidelity: number
    consistency: number
  }
}

interface ApiResponse {
  decision: string
  explanation?: string
  confidence: number
  traceId: string
  success: boolean
  degraded?: boolean
  matchedSeed?: string | null
  metrics: {
    trustRate: number
    stability: number
    fidelity: number
    consistency: number
  }
  error?: string
}

// ===== 方法 =====

async function send() {
  const text = inputText.value.trim()
  if (!text || loading.value) return

  // 加用户消息
  messages.value.push({ role: 'user', content: text })
  persistMessages()
  inputText.value = ''
  loading.value = true
  scrollToBottom()

  try {
    const res = await fetch('/api/p0/gateway', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: text }),
    })
    const data: ApiResponse = await res.json()
    online.value = true

    messages.value.push({
      role: 'assistant',
      content: data.decision || '暂无回答',
      decision: data.decision || data.explanation || '暂无回答',
      confidence: data.confidence,
      traceId: data.traceId,
      degraded: data.degraded ?? false,
      verified: !data.degraded && data.success,
      matchedSeed: data.matchedSeed,
      metrics: data.metrics,
    })
    persistMessages()
  } catch (e) {
    online.value = false
    messages.value.push({
      role: 'assistant',
      content: '网络连接失败，请稍后重试',
      decision: '网络连接失败，请稍后重试',
    })
    persistMessages()
  } finally {
    loading.value = false
    scrollToBottom()
    focusInput()
  }
}

function clearChat() {
  messages.value = []
  localStorage.removeItem(STORAGE_KEY)
}

async function scrollToBottom() {
  await nextTick()
  await new Promise(r => setTimeout(r, 50)) // 等 Vue render + 图片加载
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

function focusInput() {
  setTimeout(() => inputRef.value?.focus(), 100)
}

function autoResize(e: Event) {
  const el = e.target as HTMLTextAreaElement
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}

// 开机检测
onMounted(async () => {
  restoreMessages()
  // 恢复后滚动到底部
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
  try {
    const res = await fetch('/api/p0/status')
    online.value = res.ok
  } catch {
    online.value = false
  }
  focusInput()
})
</script>

<style scoped>
/* ===== 全局 ===== */
.p0-page {
  min-height: 100vh;
  background: #0A0E17;
  color: #E8E5DD;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.p0-bg-grid {
  position: fixed; inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
  background-size: 60px 60px;
  pointer-events: none;
}

.p0-bg-glow {
  position: fixed; width: 400px; height: 400px;
  border-radius: 50%; pointer-events: none;
  filter: blur(120px); opacity: 0.06;
}
.p0-bg-glow--tl { top: -200px; left: -100px; background: #C9A86C; }
.p0-bg-glow--br { bottom: -200px; right: -100px; background: #6C8CC9; }

/* ===== 导航 ===== */
.p0-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  background: rgba(10,14,23,0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(232,229,221,0.06);
}
.p0-nav-inner {
  max-width: 800px; margin: 0 auto;
  padding: 10px 20px;
  display: flex; align-items: center; justify-content: space-between;
}
.p0-nav-left { display: flex; align-items: center; gap: 10px; }
.p0-nav-right { display: flex; align-items: center; gap: 16px; }
.p0-logo-icon { font-size: 1.2rem; }
.p0-logo-text { font-size: 0.92rem; font-weight: 600; }
.p0-status-badge {
  font-size: 0.65rem; padding: 2px 8px; border-radius: 20px;
  font-weight: 500;
}
.badge-on { background: rgba(52,211,153,0.12); color: #34D399; border: 1px solid rgba(52,211,153,0.2); }
.badge-off { background: rgba(239,68,68,0.12); color: #EF4444; border: 1px solid rgba(239,68,68,0.2); }
.p0-nav-link {
  font-size: 0.8rem; color: rgba(232,229,221,0.45);
  text-decoration: none; transition: color 0.2s;
}
.p0-nav-link:hover { color: rgba(232,229,221,0.8); }
.p0-clear-btn {
  background: none; border: 1px solid rgba(232,229,221,0.1);
  color: rgba(232,229,221,0.35); font-size: 0.7rem;
  padding: 4px 12px; border-radius: 6px; cursor: pointer;
  transition: all 0.2s;
}
.p0-clear-btn:hover { color: #EF4444; border-color: rgba(239,68,68,0.3); }

/* ===== 对话区 ===== */
.p0-chat {
  flex: 1;
  margin-top: 52px;
  margin-bottom: 72px;
  overflow-y: auto;
  padding: 20px 16px;
  scroll-behavior: smooth;
}
.p0-chat::-webkit-scrollbar { width: 4px; }
.p0-chat::-webkit-scrollbar-thumb { background: rgba(232,229,221,0.08); border-radius: 2px; }

/* 空状态 */
.p0-empty {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  min-height: 60vh;
  text-align: center;
}
.p0-empty-icon { font-size: 3rem; margin-bottom: 16px; opacity: 0.4; }
.p0-empty-title {
  font-size: 1.6rem; font-weight: 700;
  background: linear-gradient(135deg, #E8E5DD, #C9A86C);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text; margin: 0 0 8px;
}
.p0-empty-desc { font-size: 0.82rem; color: rgba(232,229,221,0.3); margin: 0 0 32px; }
.p0-empty-tips {
  display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;
}
.p0-empty-tips span {
  font-size: 0.78rem; color: rgba(232,229,221,0.25);
  background: rgba(232,229,221,0.03);
  border: 1px solid rgba(232,229,221,0.06);
  padding: 6px 14px; border-radius: 20px;
}

/* 消息 */
.p0-messages { max-width: 680px; margin: 0 auto; }
.p0-msg { margin-bottom: 16px; animation: msgFadeIn 0.25s ease both; }
@keyframes msgFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 用户消息 */
.p0-msg-user { display: flex; justify-content: flex-end; }
.p0-msg-bubble--user {
  background: linear-gradient(135deg, #C9A86C, #E2C88A);
  color: #0A0E17;
  border-radius: 16px 16px 4px 16px;
  padding: 10px 16px;
  max-width: 75%;
  font-size: 0.88rem;
  line-height: 1.5;
  word-break: break-word;
}

/* 助手消息 */
.p0-msg-assistant { display: flex; gap: 10px; align-items: flex-start; }
.p0-msg-avatar {
  width: 32px; height: 32px; border-radius: 8px;
  background: rgba(201,168,108,0.1);
  display: flex; align-items: center; justify-content: center;
  font-size: 1rem; flex-shrink: 0;
}
.p0-msg-body { flex: 1; min-width: 0; }
.p0-msg-bubble--assistant {
  background: rgba(232,229,221,0.04);
  border: 1px solid rgba(232,229,221,0.08);
  border-radius: 16px 16px 16px 4px;
  padding: 12px 16px;
  font-size: 0.88rem;
  line-height: 1.6;
  word-break: break-word;
}
.p0-msg-text { margin: 0; }
.p0-msg-note {
  margin: 8px 0 0;
  font-size: 0.72rem;
  font-style: italic;
}
.p0-msg-note--degraded { color: rgba(245,158,11,0.5); }
.p0-msg-note--verified { color: rgba(52,211,153,0.4); }

/* 加载 */
.p0-msg-loading {
  display: flex; gap: 4px; padding: 16px 20px !important;
}
.p0-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: rgba(232,229,221,0.25);
  animation: dotPulse 1.2s ease-in-out infinite;
}
.p0-dot:nth-child(2) { animation-delay: 0.2s; }
.p0-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes dotPulse {
  0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}

/* 指标 */
.p0-msg-metrics { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
.p0-metric-pill {
  font-size: 0.65rem; padding: 2px 8px; border-radius: 10px;
  background: rgba(232,229,221,0.04); color: rgba(232,229,221,0.35);
  border: 1px solid rgba(232,229,221,0.06);
}
.pill-degraded { color: #F59E0B; border-color: rgba(245,158,11,0.2); }
.pill-verified { color: #34D399; border-color: rgba(52,211,153,0.2); }
.pill-seed { color: #818CF8; border-color: rgba(129,140,248,0.2); font-size: 0.6rem; }

/* Trace */
.p0-msg-trace {
  display: block; font-size: 0.6rem; font-family: monospace;
  color: rgba(232,229,221,0.12); margin-top: 4px;
}

/* ===== 输入栏 ===== */
.p0-input-bar {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
  background: linear-gradient(transparent, #0A0E17 30%);
  padding: 12px 16px 16px;
}
.p0-input-inner {
  max-width: 680px; margin: 0 auto;
  display: flex; gap: 8px; align-items: flex-end;
  background: rgba(232,229,221,0.04);
  border: 1px solid rgba(232,229,221,0.08);
  border-radius: 14px;
  padding: 4px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.p0-input-bar--focused .p0-input-inner {
  border-color: rgba(201,168,108,0.25);
  box-shadow: 0 0 0 3px rgba(201,168,108,0.04);
}
.p0-input {
  flex: 1; background: none; border: none; outline: none;
  padding: 10px 14px; font-size: 0.88rem;
  color: #E8E5DD; resize: none; font-family: inherit;
  line-height: 1.5; max-height: 120px;
}
.p0-input::placeholder { color: rgba(232,229,221,0.15); }
.p0-send-btn {
  background: linear-gradient(135deg, #C9A86C, #E2C88A);
  border: none; border-radius: 10px;
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: #0A0E17;
  margin: 2px; flex-shrink: 0;
  transition: all 0.2s;
}
.p0-send-btn:hover:not(:disabled) {
  box-shadow: 0 2px 12px rgba(201,168,108,0.3);
  transform: scale(1.05);
}
.p0-send-btn:disabled { opacity: 0.2; cursor: not-allowed; }

/* ===== 移动端 ===== */
@media (max-width: 640px) {
  .p0-nav-inner { padding: 10px 14px; }
  .p0-chat { padding: 16px 12px; margin-bottom: 68px; }
  .p0-input-bar { padding: 10px 12px 14px; }
  .p0-nav-link:not(:first-child) { display: none; }
  .p0-empty-tips { flex-direction: column; align-items: center; }
}
</style>
