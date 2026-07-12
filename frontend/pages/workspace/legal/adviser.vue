<template>
  <LegalWorkspaceLayout>
    <div class="legal-adviser">
      <!-- Header -->
      <div class="legal-adviser__header">
        <h1 class="legal-adviser__title">AI 法律顾问</h1>
        <p class="legal-adviser__desc">基于法律法规的专业解答</p>
        <div v-if="currentSessionId" class="legal-adviser__header-actions">
          <button class="legal-adviser__summary-btn" @click="generateSummary" :disabled="summarizing">
            {{ summarizing ? '⏳ 生成中...' : '📋 生成对话总结' }}
          </button>
        </div>
      </div>

      <!-- Summary Panel -->
      <div v-if="summaryHtml" class="legal-adviser__summary-panel">
        <div class="legal-adviser__summary-header">
          <span>📋 案件总结</span>
          <button class="legal-adviser__summary-close" @click="summaryHtml = ''">✕</button>
        </div>
        <div class="legal-adviser__summary-content" v-html="summaryHtml"></div>
      </div>

      <!-- Messages -->
      <div class="legal-adviser__messages" ref="messagesRef">
        <div v-if="messages.length === 0" class="legal-adviser__empty">
          <div class="legal-adviser__empty-icon">⚖️</div>
          <h3>有什么法律问题需要帮助？</h3>
          <p>例如：公司拖欠三个月工资怎么办？<br/>租房押金不退怎么处理？<br/>离婚财产如何分割？</p>
          <div class="legal-adviser__suggestions">
            <button v-for="s in suggestions" :key="s" class="legal-adviser__suggestion" @click="sendMessage(s)">
              {{ s }}
            </button>
          </div>
        </div>

        <div class="legal-adviser__msg" v-for="(msg, i) in messages" :key="i" :class="['legal-adviser__msg', msg.role === 'user' ? 'legal-adviser__msg--user' : 'legal-adviser__msg--ai']">
          <div class="legal-adviser__msg-avatar">{{ msg.role === 'user' ? '👤' : '⚖️' }}</div>
          <div class="legal-adviser__msg-content">
            <div class="legal-adviser__msg-name">{{ msg.role === 'user' ? '你' : '法律顾问' }}</div>
            <!-- 图片消息 -->
            <div v-if="msg.images && msg.images.length" class="legal-adviser__msg-images">
              <img v-for="(img, ii) in msg.images" :key="ii" :src="img" class="legal-adviser__msg-image" @click="previewImage(img)" />
            </div>
            <div v-if="msg.files && msg.files.length" class="legal-adviser__msg-files">
              <div v-for="(f, fi) in msg.files" :key="fi" class="legal-adviser__msg-file">
                <span class="legal-adviser__msg-file-icon">{{ f.isImage ? '🖼️' : '📄' }}</span>
                <span class="legal-adviser__msg-file-name">{{ f.fileName }}</span>
                <span class="legal-adviser__msg-file-size">{{ formatSize(f.size) }}</span>
              </div>
            </div>
            <div class="legal-adviser__msg-text" v-html="renderMarkdown(msg.content)"></div>
            <div v-if="msg.ragSources && msg.ragSources.length" class="legal-adviser__msg-sources">
              <div class="legal-adviser__msg-sources-label">📚 法律依据</div>
              <div v-for="src in msg.ragSources" :key="src.citation" class="legal-adviser__msg-source">
                <span class="legal-adviser__msg-source-score" :style="{ color: scoreColor(src.score) }">{{ (src.score * 100).toFixed(0) }}%</span>
                <span>{{ src.citation }}</span>
              </div>
            </div>
            <div v-if="msg.role === 'ai' && i === lastAiIndex" class="legal-adviser__msg-actions">
              <button class="legal-adviser__action-btn" @click="handleAction(msg, 'copy')">📋 复制</button>
              <button class="legal-adviser__action-btn" @click="handleAction(msg, 'expand')">📄 展开分析</button>
            </div>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="legal-adviser__msg legal-adviser__msg--ai">
          <div class="legal-adviser__msg-avatar">⚖️</div>
          <div class="legal-adviser__msg-content">
            <div class="legal-adviser__msg-name">法律顾问</div>
            <div class="legal-adviser__msg-text"><span class="legal-adviser__typing">思考中<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></span></div>
          </div>
        </div>
      </div>

      <!-- Input -->
      <div class="legal-adviser__input-bar">
        <!-- 预览附件 -->
        <div v-if="pendingFiles.length" class="legal-adviser__pending-files">
          <div v-for="(f, i) in pendingFiles" :key="i" class="legal-adviser__pending-file">
            <span v-if="f.isImage" class="legal-adviser__pending-file-img">🖼️</span>
            <span v-else class="legal-adviser__pending-file-img">📄</span>
            <span class="legal-adviser__pending-file-name">{{ f.fileName }}</span>
            <span class="legal-adviser__pending-file-size">{{ formatSize(f.size) }}</span>
            <button class="legal-adviser__pending-file-remove" @click="pendingFiles.splice(i, 1)">✕</button>
          </div>
        </div>
        <div class="legal-adviser__input-wrap">
          <button class="legal-adviser__upload-btn" @click="$refs.fileInput.click()" :disabled="loading">📎</button>
          <input ref="fileInput" type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt" class="legal-adviser__file-input" @change="onFileSelect" />
          <textarea
            v-model="inputText"
            class="legal-adviser__input"
            placeholder="输入你的法律问题，或上传图片/文档…"
            rows="1"
            @keydown.enter.prevent="sendMessage(inputText)"
            @input="autoResize"
          ></textarea>
          <button class="legal-adviser__send-btn" @click="sendMessage(inputText)" :disabled="!inputText.trim() || loading">
            <span v-if="loading">⏳</span>
            <span v-else>发送</span>
          </button>
        </div>
      </div>
    </div>
  </LegalWorkspaceLayout>
</template>

<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import LegalWorkspaceLayout from 'workspaces/legal/layouts/LegalWorkspaceLayout.vue'

definePageMeta({ layout: false })

interface ChatMessage {
  role: 'user' | 'ai'
  content: string
  ragSources?: { citation: string; score: number; content: string }[]
  images?: string[]
  files?: { fileName: string; size: number; isImage: boolean }[]
  timestamp?: number
}

const inputText = ref('')
const messages = ref<ChatMessage[]>([])
const loading = ref(false)
const messagesRef = ref<HTMLDivElement | null>(null)
const sessionId = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const pendingFiles = ref<{ file: File; url: string; fileName: string; size: number; isImage: boolean }[]>([])
const summaryHtml = ref('')
const summarizing = ref(false)

const currentSessionId = computed(() => sessionId.value || null)

const suggestions = [
  '公司拖欠三个月工资，没有签劳动合同，怎么办？',
  '在网上买到假货，商家不退款，怎么维权？',
  '想离婚，对方不同意，怎么起诉？需要什么材料？',
]

const lastAiIndex = computed(() => {
  let idx = -1
  for (let i = messages.value.length - 1; i >= 0; i--) {
    if (messages.value[i].role === 'ai') { idx = i; break }
  }
  return idx
})

/** 选择文件后自动上传到服务端 */
async function onFileSelect(e: Event) {
  const el = e.target as HTMLInputElement
  if (!el.files?.length) return
  for (const file of Array.from(el.files)) {
    try {
      const formData = new FormData()
      formData.append('file', file, file.name)
      const res = await fetch('/api/legal/agent/upload', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (json.success) {
        pendingFiles.value.push({
          file,
          url: json.data.url,
          fileName: json.data.fileName,
          size: json.data.size,
          isImage: json.data.isImage,
        })
      } else {
        alert(`上传失败: ${json.error || '未知错误'}`)
      }
    } catch (err: any) {
      alert(`上传失败: ${err.message}`)
    }
  }
  el.value = ''
}

/** 格式化文件大小 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / 1024 / 1024).toFixed(1) + 'MB'
}

/** 预览图片 */
function previewImage(url: string) {
  window.open(url, '_blank')
}

async function sendMessage(text: string) {
  const msg = (text || '').trim()
  if (!msg && pendingFiles.value.length === 0) return
  if (loading.value) return
  inputText.value = ''

  // 收集附件信息
  const images = pendingFiles.value.filter(f => f.isImage).map(f => f.url)
  const files = pendingFiles.value.map(f => ({ fileName: f.fileName, size: f.size, isImage: f.isImage }))

  // 添加用户消息（含附件）
  messages.value.push({ role: 'user', content: msg, images, files, timestamp: Date.now() })
  pendingFiles.value = []
  scrollToBottom()
  loading.value = true

  try {
    // 如果用户上传了图片/文件但没有文字，自动生成一条描述
    let userMessage = msg
    if (!userMessage && files.length > 0) {
      userMessage = `我上传了以下材料，请帮我分析：${files.map(f => f.fileName).join('、')}`
    }
    // 如果有图片，在消息里附上图片信息
    if (images.length > 0) {
      userMessage += `\n\n[附有 ${images.length} 张图片]`
    }

    // 调用 AI 法律顾问（返回内容 + 法律依据）
    const aiReply = await fetchLegalChat(userMessage || msg)
    // 添加 AI 回复
    messages.value.push({
      role: 'ai',
      content: aiReply.content,
      ragSources: aiReply.ragSources?.slice(0, 5) || [],
      timestamp: Date.now(),
    })
  } catch (err: any) {
    messages.value.push({
      role: 'ai',
      content: `抱歉，咨询服务暂时不可用：${err.message}。\n\n建议您稍后再试，或直接拨打 12348 法律援助热线。`,
    })
  }

  loading.value = false
  scrollToBottom()
}

/** 从 RAG 搜索法律知识 */
/** 调用 AI 法律顾问（返回内容 + 法律依据列表） */
async function fetchLegalChat(userMessage: string): Promise<{ content: string; ragSources: any[] }> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch('/api/legal/agent/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sessionId: sessionId.value || undefined,
      message: userMessage,
    }),
  })

  const json = await res.json()
  if (!json.success) {
    throw new Error(json.error || 'AI 服务不可用')
  }

  // 保存 sessionId 以便后续对话保持上下文
  if (json.data?.sessionId && !sessionId.value) {
    sessionId.value = json.data.sessionId
  }

  return { content: json.data?.reply || json.data?.content || '（无回复）', ragSources: json.data?.ragSources || [] }
}

/** 生成对话总结 */
async function generateSummary() {
  if (!sessionId.value || summarizing.value) return
  summarizing.value = true
  summaryHtml.value = ''
  try {
    const res = await fetch(`/api/legal/agent/sessions/${sessionId.value}/summary`, { method: 'POST' })
    const json = await res.json()
    if (json.success && json.data?.summary) {
      summaryHtml.value = renderMarkdown(json.data.summary)
    } else {
      summaryHtml.value = `<p style="color:#ef4444;">生成失败：${json.error || '未知错误'}</p>`
    }
  } catch (err: any) {
    summaryHtml.value = `<p style="color:#ef4444;">请求失败：${err.message}</p>`
  }
  summarizing.value = false
}

function getToken(): string {
  try {
    return window.localStorage?.getItem('user_auth_token') || window.localStorage?.getItem('auth_token') || ''
  } catch { return '' }
}

/** 简单的 Markdown 渲染（加粗、换行、引用） */
function renderMarkdown(text: string): string {
  if (!text) return ''
  // 先转义 HTML
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // 加粗
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // 换行
  html = html.replace(/\n/g, '<br/>')
  // 引用（法律依据高亮）
  html = html.replace(/《(.+?)》/g, '<span class="legal-adviser__law-name">《$1》</span>')
  return html
}

function scoreColor(score: number): string {
  if (score >= 0.8) return '#22c55e'
  if (score >= 0.5) return '#FBBF24'
  return '#ef4444'
}

function handleAction(msg: ChatMessage, action: string) {
  if (action === 'copy') {
    navigator.clipboard.writeText(msg.content).then(() => {
      // 视觉反馈
    }).catch(() => {})
  }
}

function autoResize(e: Event) {
  const el = e.target as HTMLTextAreaElement
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}
</script>

<style scoped>
.legal-adviser {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 80px);
  max-width: 860px;
  margin: 0 auto;
  color: #F8F6F1;
}

/* Header */
.legal-adviser__header {
  padding: 0 0 12px;
  flex-shrink: 0;
}
.legal-adviser__title { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
.legal-adviser__desc { font-size: 13px; color: rgba(248,246,241,0.5); margin: 0; }
.legal-adviser__header-actions { margin-top: 8px; }
.legal-adviser__summary-btn {
  background: rgba(34,197,94,0.08);
  border: 1px solid rgba(34,197,94,0.15);
  border-radius: 8px;
  color: #22c55e;
  padding: 6px 16px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}
.legal-adviser__summary-btn:hover:not(:disabled) { background: rgba(34,197,94,0.15); }
.legal-adviser__summary-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Summary Panel */
.legal-adviser__summary-panel {
  background: rgba(34,197,94,0.03);
  border: 1px solid rgba(34,197,94,0.1);
  border-radius: 10px;
  margin-bottom: 12px;
  flex-shrink: 0;
}
.legal-adviser__summary-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px;
  font-size: 14px; font-weight: 600; color: #22c55e;
  border-bottom: 1px solid rgba(34,197,94,0.08);
}
.legal-adviser__summary-close {
  background: none; border: none; color: rgba(248,246,241,0.3);
  cursor: pointer; font-size: 14px; padding: 2px 6px; border-radius: 4px;
}
.legal-adviser__summary-close:hover { background: rgba(248,246,241,0.05); color: rgba(248,246,241,0.6); }
.legal-adviser__summary-content {
  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.7;
  max-height: 400px;
  overflow-y: auto;
  color: rgba(248,246,241,0.8);
}
.legal-adviser__summary-content :deep(strong) { color: #F8F6F1; }
.legal-adviser__summary-content :deep(h2) { font-size: 15px; color: #F8F6F1; margin: 12px 0 6px; }
.legal-adviser__summary-content :deep(h2:first-child) { margin-top: 0; }

/* Messages */
.legal-adviser__messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0 16px;
  scroll-behavior: smooth;
}
.legal-adviser__messages::-webkit-scrollbar { width: 4px; }
.legal-adviser__messages::-webkit-scrollbar-thumb { background: rgba(248,246,241,0.1); border-radius: 2px; }

/* Empty state */
.legal-adviser__empty {
  text-align: center;
  padding: 60px 20px;
  color: rgba(248,246,241,0.5);
}
.legal-adviser__empty-icon { font-size: 56px; margin-bottom: 16px; }
.legal-adviser__empty h3 { font-size: 18px; color: rgba(248,246,241,0.7); margin: 0 0 8px; }
.legal-adviser__empty p { font-size: 14px; color: rgba(248,246,241,0.4); margin: 0 0 24px; line-height: 1.8; }
.legal-adviser__suggestions { display: flex; flex-direction: column; gap: 8px; align-items: center; }
.legal-adviser__suggestion {
  background: rgba(248,246,241,0.05);
  border: 1px solid rgba(248,246,241,0.1);
  border-radius: 20px;
  color: rgba(248,246,241,0.6);
  padding: 8px 20px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
  max-width: 500px;
}
.legal-adviser__suggestion:hover {
  border-color: rgba(251,191,36,0.3);
  color: #FBBF24;
  background: rgba(251,191,36,0.05);
}

/* Message */
.legal-adviser__msg {
  display: flex;
  gap: 12px;
  max-width: 100%;
}
.legal-adviser__msg--user { flex-direction: row-reverse; }
.legal-adviser__msg-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  background: rgba(248,246,241,0.05);
}
.legal-adviser__msg--user .legal-adviser__msg-avatar { background: rgba(251,191,36,0.1); }
.legal-adviser__msg-content { max-width: 75%; }
.legal-adviser__msg-name { font-size: 11px; color: rgba(248,246,241,0.3); margin-bottom: 4px; }
.legal-adviser__msg--user .legal-adviser__msg-name { text-align: right; }
.legal-adviser__msg-text {
  background: rgba(248,246,241,0.04);
  border: 1px solid rgba(248,246,241,0.06);
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}
.legal-adviser__msg--user .legal-adviser__msg-text {
  background: rgba(251,191,36,0.06);
  border-color: rgba(251,191,36,0.1);
}

/* Law name highlight */
:deep(.legal-adviser__law-name) {
  color: #FBBF24;
  font-weight: 500;
}

/* Sources */
.legal-adviser__msg-sources {
  margin-top: 8px;
  padding: 10px 12px;
  background: rgba(34,197,94,0.04);
  border: 1px solid rgba(34,197,94,0.1);
  border-radius: 8px;
}
.legal-adviser__msg-sources-label { font-size: 11px; color: rgba(34,197,94,0.6); margin-bottom: 6px; }
.legal-adviser__msg-source {
  font-size: 12px;
  color: rgba(248,246,241,0.5);
  padding: 2px 0;
  display: flex;
  gap: 8px;
}
.legal-adviser__msg-source-score { font-weight: 600; font-size: 11px; min-width: 32px; }

/* Actions */
.legal-adviser__msg-actions { display: flex; gap: 4px; margin-top: 6px; opacity: 0; transition: opacity 0.15s; }
.legal-adviser__msg:hover .legal-adviser__msg-actions { opacity: 1; }
.legal-adviser__action-btn {
  background: transparent;
  border: none;
  color: rgba(248,246,241,0.3);
  font-size: 11px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}
.legal-adviser__action-btn:hover { background: rgba(248,246,241,0.05); color: rgba(248,246,241,0.6); }

/* Images */
.legal-adviser__msg-images { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.legal-adviser__msg-image {
  max-width: 200px; max-height: 160px; border-radius: 8px;
  cursor: pointer; border: 1px solid rgba(248,246,241,0.1);
  object-fit: cover;
  transition: transform 0.15s;
}
.legal-adviser__msg-image:hover { transform: scale(1.05); }

/* Files */
.legal-adviser__msg-files { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
.legal-adviser__msg-file {
  display: flex; align-items: center; gap: 8px;
  background: rgba(248,246,241,0.03); border: 1px solid rgba(248,246,241,0.06);
  border-radius: 6px; padding: 6px 10px; font-size: 12px;
}
.legal-adviser__msg-file-icon { font-size: 14px; }
.legal-adviser__msg-file-name { color: rgba(248,246,241,0.7); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.legal-adviser__msg-file-size { color: rgba(248,246,241,0.3); font-size: 11px; }

/* Typing */
.legal-adviser__typing { color: rgba(248,246,241,0.4); font-size: 14px; }
.dot { animation: blink 1.4s infinite; }
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes blink { 0%, 20% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; } }

/* Input */
.legal-adviser__input-bar {
  padding: 12px 0 0;
  flex-shrink: 0;
}
.legal-adviser__pending-files {
  display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;
}
.legal-adviser__pending-file {
  display: flex; align-items: center; gap: 6px;
  background: rgba(251,191,36,0.06); border: 1px solid rgba(251,191,36,0.1);
  border-radius: 6px; padding: 4px 8px; font-size: 12px;
}
.legal-adviser__pending-file-img { font-size: 12px; }
.legal-adviser__pending-file-name { color: rgba(248,246,241,0.6); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.legal-adviser__pending-file-size { color: rgba(248,246,241,0.3); font-size: 10px; }
.legal-adviser__pending-file-remove {
  background: none; border: none; color: rgba(248,246,241,0.3); cursor: pointer; font-size: 12px; padding: 0 2px;
}
.legal-adviser__pending-file-remove:hover { color: #ef4444; }
.legal-adviser__upload-btn {
  background: none; border: none; color: rgba(248,246,241,0.4); cursor: pointer;
  font-size: 18px; padding: 4px; line-height: 1;
  transition: color 0.15s;
}
.legal-adviser__upload-btn:hover { color: #FBBF24; }
.legal-adviser__upload-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.legal-adviser__file-input { display: none; }
.legal-adviser__input-wrap {
  display: flex;
  gap: 8px;
  background: rgba(248,246,241,0.03);
  border: 1px solid rgba(248,246,241,0.08);
  border-radius: 12px;
  padding: 8px 8px 8px 16px;
  align-items: flex-end;
}
.legal-adviser__input-wrap:focus-within {
  border-color: rgba(251,191,36,0.2);
}
.legal-adviser__input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #F8F6F1;
  font-size: 14px;
  font-family: inherit;
  resize: none;
  max-height: 120px;
  line-height: 1.5;
}
.legal-adviser__input::placeholder { color: rgba(248,246,241,0.2); }
.legal-adviser__send-btn {
  background: rgba(251,191,36,0.15);
  border: 1px solid rgba(251,191,36,0.2);
  border-radius: 8px;
  color: #FBBF24;
  padding: 8px 18px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s;
  white-space: nowrap;
}
.legal-adviser__send-btn:hover:not(:disabled) {
  background: rgba(251,191,36,0.25);
}
.legal-adviser__send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
