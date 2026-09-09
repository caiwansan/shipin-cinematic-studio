/**
 * MAiSecretary.vue — AI 秘书面板组件
 * 
 * 显示在会议右侧面板：
 * - 实时转录（按发言人分组）
 * - 录音管理
 * - AI 纪要
 */

<template>
  <div class="ai-sec">
    <!-- 头部 -->
    <div class="ai-sec-head">
      <span class="ai-sec-title">🤖 AI 秘书</span>
      <span v-if="secretary.active.value" class="ai-sec-badge on">● 录制中</span>
      <span v-else-if="secretary.connecting.value" class="ai-sec-badge loading">连接中…</span>
      <span v-else class="ai-sec-badge off">○ 未启动</span>
      <span class="ai-sec-close" @click="$emit('close')">✕</span>
    </div>

    <!-- VIP 升级提示 -->
    <div v-if="secretary.needUpgrade.value" class="ai-sec-upgrade">
      <div class="ai-sec-upgrade-icon">💎</div>
      <div class="ai-sec-upgrade-text">AI 秘书为 VIP 专属功能</div>
      <div class="ai-sec-upgrade-sub">实时转录 · 智能纪要 · 发言人归属</div>
      <button class="ai-sec-upgrade-btn" @click="goUpgrade">升级 VIP</button>
    </div>

    <!-- 控制面板 -->
    <div v-else class="ai-sec-body">
      <!-- 启动/停止 -->
      <div class="ai-sec-ctl">
        <div class="ai-sec-ctl-row">
          <span class="ai-sec-dur">{{ secretary.formattedDuration.value }}</span>
          <span class="ai-sec-stats">{{ secretary.transcripts.value.length }} 条转写</span>
        </div>
        <!-- LLM 未配置提示 -->
        <div v-if="!secretary.llmConfigured.value" class="ai-sec-llm-warn">
          ⚠️ 未配置 AI 模型，纪将为简单摘要。<n-button size="tiny" @click="goLlmConfig">去配置</n-button>
        </div>
        <div class="ai-sec-ctl-btns">
          <button
            v-if="!secretary.active.value"
            class="ai-sec-btn primary"
            :disabled="secretary.connecting.value"
            @click="handleStart"
          >
            {{ secretary.connecting.value ? '启动中…' : '▶ 启动 AI 秘书' }}
          </button>
          <button v-else class="ai-sec-btn stop" @click="handleStop">⏹ 停止并生成纪要</button>
        </div>
        <!-- 语言选择 -->
        <div v-if="!secretary.active.value" class="ai-sec-lang">
          <label>语言：</label>
          <select v-model="selectedLang" class="ai-sec-select">
            <option value="auto">自动检测</option>
            <option value="zh">中文</option>
            <option value="en">English</option>
            <option value="yue">粤语</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
          </select>
        </div>
      </div>

      <!-- Tab 切换 -->
      <div class="ai-sec-tabs">
        <button
          class="ai-sec-tab"
          :class="{ on: tab === 'transcript' }"
          @click="tab = 'transcript'"
        >
          📝 实时转录
        </button>
        <button
          class="ai-sec-tab"
          :class="{ on: tab === 'minutes' }"
          @click="tab = 'minutes'"
        >
          📋 纪要
        </button>
        <button
          class="ai-sec-tab"
          :class="{ on: tab === 'recordings' }"
          @click="tab = 'recordings'"
        >
          🎙️ 录音
        </button>
      </div>

      <!-- 实时转录 -->
      <div v-if="tab === 'transcript'" class="ai-sec-transcript">
        <div v-if="!secretary.transcripts.value.length" class="ai-sec-empty">
          <div class="ai-sec-empty-icon">🎤</div>
          <div>启动 AI 秘书后，这里会实时显示语音转文字</div>
        </div>
        <div
          v-for="t in groupedTranscripts"
          :key="t.userUid"
          class="ai-sec-speaker"
        >
          <div class="ai-sec-speaker-head">
            <span class="ai-sec-speaker-av">{{ t.speakerName.slice(0, 1) }}</span>
            <span class="ai-sec-speaker-name">{{ t.speakerName }}</span>
            <span class="ai-sec-speaker-count">{{ t.items.length }} 条</span>
          </div>
          <div class="ai-sec-segments">
            <div v-for="(s, i) in t.items" :key="i" class="ai-sec-seg">
              <span class="ai-sec-seg-time">{{ formatTime(s.createdAt) }}</span>
              <span class="ai-sec-seg-text">{{ s.content }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 纪要 -->
      <div v-if="tab === 'minutes'" class="ai-sec-minutes">
        <div v-if="!secretary.minutes.value && !generatingMinutes" class="ai-sec-empty">
          <div class="ai-sec-empty-icon">📋</div>
          <div>会议结束后点击「生成纪要」</div>
          <button
            class="ai-sec-btn primary small"
            :disabled="!secretary.transcripts.value.length"
            @click="handleGenerateMinutes"
          >
            📝 生成纪要
          </button>
        </div>
        <div v-else-if="generatingMinutes" class="ai-sec-empty">
          <div class="ai-sec-loading"></div>
          <div>AI 正在整理纪要…</div>
        </div>
        <div v-else-if="secretary.minutes.value" class="ai-sec-minutes-content">
          <div class="ai-sec-minutes-raw" v-html="renderMarkdown(secretary.minutes.value.summary || secretary.minutes.value.content?.fullText || '')"></div>
          <button class="ai-sec-btn small" @click="copyMinutes">📋 复制纪要</button>
        </div>
      </div>

      <!-- 录音 -->
      <div v-if="tab === 'recordings'" class="ai-sec-recordings">
        <div v-if="!secretary.recordings.value.length" class="ai-sec-empty">
          <div class="ai-sec-empty-icon">🎙️</div>
          <div>共享屏幕或播放视频时会自动录音</div>
        </div>
        <div v-for="r in secretary.recordings.value" :key="r.id" class="ai-sec-rec">
          <div class="ai-sec-rec-info">
            <span class="ai-sec-rec-type">{{ recTypeLabel(r.recording_type) }}</span>
            <span class="ai-sec-rec-status" :class="r.status">{{ recStatusLabel(r.status) }}</span>
            <span class="ai-sec-rec-dur">{{ formatDuration(r.audio_duration_ms) }}</span>
          </div>
          <audio v-if="r.audio_url" :src="r.audio_url" controls class="ai-sec-rec-audio"></audio>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAiSecretary } from '~/composables/useAiSecretary'

const props = defineProps<{
  meetingId: string
  userUid: string
}>()

defineEmits<{ (e: 'close'): void }>()

const secretary = useAiSecretary(props.meetingId, props.userUid)
const tab = ref<'transcript' | 'minutes' | 'recordings'>('transcript')
const selectedLang = ref('auto')
const generatingMinutes = ref(false)

// 按发言人分组的转录
const groupedTranscripts = computed(() => {
  const map = new Map<string, { userUid: string; speakerName: string; items: any[] }>()
  for (const t of secretary.transcripts.value) {
    let g = map.get(t.userUid)
    if (!g) {
      g = { userUid: t.userUid, speakerName: t.speakerName, items: [] }
      map.set(t.userUid, g)
    }
    g.items.push(t)
  }
  return Array.from(map.values())
})

async function handleStart() {
  await secretary.start(selectedLang.value)
}

async function handleStop() {
  await secretary.stop()
  tab.value = 'minutes'
}

async function handleGenerateMinutes() {
  generatingMinutes.value = true
  await secretary.generateMinutes()
  generatingMinutes.value = false
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch { return '' }
}

function formatDuration(ms: number) {
  if (!ms) return '0:00'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function recTypeLabel(type: string) {
  const map: Record<string, string> = { mic: '🎤 麦克风', screen: '🖥️ 屏幕', video: '🎬 视频' }
  return map[type] || type
}

function recStatusLabel(status: string) {
  const map: Record<string, string> = { recording: '录制中', processing: '处理中', done: '完成', error: '错误' }
  return map[status] || status
}

function renderMarkdown(text: string) {
  if (!text) return ''
  // 简单 Markdown 渲染
  return text
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n/g, '<br>')
}

async function copyMinutes() {
  const text = secretary.minutes.value?.summary || secretary.minutes.value?.content?.fullText || ''
  try {
    await navigator.clipboard.writeText(text)
    alert('✅ 纪要已复制到剪贴板')
  } catch {
    alert('复制失败')
  }
}

function goUpgrade() {
  window.location.href = '/mobile-app?tab=profile&upgrade=vip'
}

function goLlmConfig() {
  window.location.href = '/mobile-app?tab=settings&section=llm'
}

onMounted(async () => {
  await secretary.checkVip()
  await secretary.loadMinutes()
  await secretary.loadRecordings()
})
</script>

<style scoped>
.ai-sec {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #151a23;
  color: #e8eaed;
  border-left: 1px solid #232a35;
}

.ai-sec-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid #232a35;
}

.ai-sec-title {
  font-size: 15px;
  font-weight: 700;
  flex: 1;
}

.ai-sec-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
}

.ai-sec-badge.on {
  background: rgba(35, 199, 67, 0.15);
  color: #23c743;
}

.ai-sec-badge.loading {
  background: rgba(240, 160, 48, 0.15);
  color: #f0a030;
}

.ai-sec-badge.off {
  background: rgba(139, 148, 163, 0.15);
  color: #8b94a3;
}

.ai-sec-close {
  cursor: pointer;
  color: #8b94a3;
  font-size: 16px;
}

/* VIP 升级 */
.ai-sec-upgrade {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px 20px;
  text-align: center;
}

.ai-sec-upgrade-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.ai-sec-upgrade-text {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 6px;
}

.ai-sec-upgrade-sub {
  font-size: 12px;
  color: #8b94a3;
  margin-bottom: 20px;
}

.ai-sec-upgrade-btn {
  padding: 10px 24px;
  border: none;
  border-radius: 20px;
  background: linear-gradient(135deg, #f0a030, #e04545);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

/* 控制面板 */
.ai-sec-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ai-sec-ctl {
  padding: 12px 14px;
  border-bottom: 1px solid #232a35;
}

.ai-sec-ctl-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.ai-sec-dur {
  font-size: 24px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #2bd576;
}

.ai-sec-stats {
  font-size: 12px;
  color: #8b94a3;
}

.ai-sec-llm-warn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  margin-bottom: 8px;
  background: rgba(240, 160, 48, 0.1);
  border: 1px solid rgba(240, 160, 48, 0.3);
  border-radius: 8px;
  font-size: 12px;
  color: #f0a030;
}

.ai-sec-llm-warn .n-button {
  margin-left: auto;
  flex-shrink: 0;
}

.ai-sec-ctl-btns {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.ai-sec-btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: #232a35;
  color: #e8eaed;
}

.ai-sec-btn.primary {
  background: #2b7cf0;
}

.ai-sec-btn.stop {
  background: #e04545;
}

.ai-sec-btn.small {
  padding: 6px 12px;
  font-size: 12px;
}

.ai-sec-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-sec-lang {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #8b94a3;
}

.ai-sec-select {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid #2f3743;
  background: #12161e;
  color: #e8eaed;
  font-size: 12px;
}

/* Tabs */
.ai-sec-tabs {
  display: flex;
  border-bottom: 1px solid #232a35;
}

.ai-sec-tab {
  flex: 1;
  padding: 10px 8px;
  border: none;
  background: none;
  color: #8b94a3;
  font-size: 13px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.ai-sec-tab.on {
  color: #e8eaed;
  border-bottom-color: #2b7cf0;
}

/* 转录 */
.ai-sec-transcript {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.ai-sec-speaker {
  margin-bottom: 12px;
  background: #1a1f28;
  border-radius: 10px;
  padding: 10px;
}

.ai-sec-speaker-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.ai-sec-speaker-av {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #2b7cf0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
}

.ai-sec-speaker-name {
  font-size: 13px;
  font-weight: 600;
}

.ai-sec-speaker-count {
  font-size: 11px;
  color: #8b94a3;
  margin-left: auto;
}

.ai-sec-segments {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-sec-seg {
  display: flex;
  gap: 8px;
  font-size: 13px;
}

.ai-sec-seg-time {
  color: #8b94a3;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.ai-sec-seg-text {
  color: #c9d2e0;
  word-break: break-word;
}

/* 纪要 */
.ai-sec-minutes {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
}

.ai-sec-minutes-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-sec-minutes-raw {
  font-size: 13px;
  line-height: 1.6;
  color: #c9d2e0;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 录音 */
.ai-sec-recordings {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.ai-sec-rec {
  background: #1a1f28;
  border-radius: 10px;
  padding: 10px;
  margin-bottom: 8px;
}

.ai-sec-rec-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
}

.ai-sec-rec-type {
  font-weight: 600;
}

.ai-sec-rec-status {
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 10px;
}

.ai-sec-rec-status.recording { background: rgba(35, 199, 67, 0.15); color: #23c743; }
.ai-sec-rec-status.processing { background: rgba(240, 160, 48, 0.15); color: #f0a030; }
.ai-sec-rec-status.done { background: rgba(43, 124, 240, 0.15); color: #2b7cf0; }
.ai-sec-rec-status.error { background: rgba(224, 69, 69, 0.15); color: #e04545; }

.ai-sec-rec-dur {
  margin-left: auto;
  color: #8b94a3;
}

.ai-sec-rec-audio {
  width: 100%;
  height: 32px;
  border-radius: 6px;
}

/* 空状态 */
.ai-sec-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #5a6372;
  font-size: 13px;
  padding: 30px 20px;
}

.ai-sec-empty-icon {
  font-size: 36px;
  margin-bottom: 10px;
  opacity: 0.5;
}

.ai-sec-loading {
  width: 24px;
  height: 24px;
  border: 2px solid #232a35;
  border-top-color: #2b7cf0;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
