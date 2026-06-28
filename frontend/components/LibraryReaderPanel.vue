<template>
  <div class="library-reader-panel">
    <!-- ══ 机器人读书显示器 ══ -->
    <div class="lr-display">
      <!-- 机器人动画区域 -->
      <div class="lr-robot-zone" :class="{ 'lr-robot-active': lrPhase === 'reading' || lrPhase === 'summarizing' }">
        <div class="lr-robot">
          <!-- 头部 -->
          <div class="lr-robot-head">
            <div class="lr-robot-antenna"></div>
            <div class="lr-robot-face">
              <div class="lr-robot-eye lr-robot-eye-left">
                <div class="lr-robot-pupil"></div>
              </div>
              <div class="lr-robot-eye lr-robot-eye-right">
                <div class="lr-robot-pupil"></div>
              </div>
              <div class="lr-robot-mouth">
                <div class="lr-mouth-line"></div>
              </div>
            </div>
          </div>
          <!-- 身体 -->
          <div class="lr-robot-body">
            <div class="lr-robot-screen">
              <div class="lr-screen-text">
                <template v-if="lrPhase === 'idle'">
                  <span class="lr-screen-glitch">WAITING</span>
                </template>
                <template v-else-if="lrPhase === 'preparing'">
                  <span class="lr-screen-glitch">INITIALIZING...</span>
                </template>
                <template v-else-if="lrPhase === 'reading'">
                  <span>CH.{{ lrCurrentChapterNo }}</span>
                </template>
                <template v-else-if="lrPhase === 'summarizing'">
                  <span class="lr-screen-write">WRITING...</span>
                </template>
                <template v-else-if="lrPhase === 'done'">
                  <span>COMPLETE!</span>
                </template>
                <template v-else-if="lrPhase === 'error'">
                  <span class="lr-screen-error">ERROR</span>
                </template>
              </div>
            </div>
            <div class="lr-robot-arm lr-robot-arm-left">
              <div class="lr-arm-hand"></div>
            </div>
            <div class="lr-robot-arm lr-robot-arm-right">
              <div class="lr-arm-hand"></div>
            </div>
          </div>
          <!-- 翻书动画 -->
          <div class="lr-book-zone">
            <div class="lr-book lr-book-1">
              <div class="lr-book-cover"></div>
              <div class="lr-book-page"></div>
              <div class="lr-book-page lr-book-page-back"></div>
            </div>
            <div class="lr-book lr-book-2">
              <div class="lr-book-cover"></div>
              <div class="lr-book-page"></div>
              <div class="lr-book-page lr-book-page-back"></div>
            </div>
            <div class="lr-book-stack" v-if="lrDoneChapters > 0">
              <div class="lr-stack-label">已读 {{ lrDoneChapters }} 章</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 状态信息面板 -->
      <div class="lr-info-panel">
        <div class="lr-info-header">
          <span class="lr-info-title">📚 图书馆管理员</span>
          <span class="lr-info-badge" :class="'badge-' + lrPhase">{{ lrPhaseLabel }}</span>
        </div>

        <!-- 阅读进度主信息 -->
        <div class="lr-info-grid">
          <div class="lr-info-card">
            <div class="lr-info-card-icon">📖</div>
            <div class="lr-info-card-body">
              <div class="lr-info-card-label">正在阅读</div>
              <div class="lr-info-card-value" v-if="lrPhase === 'reading' || lrPhase === 'summarizing'">
                第{{ lrCurrentChapterNo }}章「{{ lrCurrentChapterTitle }}」
              </div>
              <div class="lr-info-card-value" v-else-if="lrPhase === 'done'">
                全部完成 ✓
              </div>
              <div class="lr-info-card-value" v-else>
                —
              </div>
            </div>
          </div>

          <div class="lr-info-card">
            <div class="lr-info-card-icon">📊</div>
            <div class="lr-info-card-body">
              <div class="lr-info-card-label">已读进度</div>
              <div class="lr-info-card-value">{{ lrDoneChapters }} / {{ lrTotalChapters }} 章 ({{ lrProgressPercent.toFixed(1) }}%)</div>
              <div class="lr-progress-bar-mini">
                <div class="lr-progress-fill-mini" :style="{ width: lrProgressPercent + '%' }"></div>
              </div>
            </div>
          </div>

          <div class="lr-info-card">
            <div class="lr-info-card-icon">📝</div>
            <div class="lr-info-card-body">
              <div class="lr-info-card-label">阅读笔记</div>
              <div class="lr-info-card-value">
                章节总结 {{ lrChapterSummaries.length }} 条
                <template v-for="lvl in [5,50,100]" :key="lvl">
                  <span v-if="batchLevelCounts[String(lvl)] > 0"> · {{ levelLabel(lvl) }} ×{{ batchLevelCounts[String(lvl)] }}</span>
                </template>
              </div>
            </div>
          </div>

          <div class="lr-info-card">
            <div class="lr-info-card-icon">⏳</div>
            <div class="lr-info-card-body">
              <div class="lr-info-card-label">待读章节</div>
              <div class="lr-info-card-value">{{ lrPendingChapters }} 章</div>
            </div>
          </div>
        </div>

        <!-- 实时流式输出 -->
        <div class="lr-stream-box" v-if="lrBatchTokens">
          <div class="lr-stream-box-header">
            <span class="lr-stream-dot"></span>
            正在记录...
          </div>
          <div class="lr-stream-box-content">{{ lrBatchTokens }}</div>
        </div>

        <!-- 操作按钮 -->
        <div class="lr-actions-row">
          <template v-if="!lrEnabled">
            <button class="lr-action-btn lr-action-primary" @click="$emit('toggle')">
              🟢 启用图书馆
            </button>
          </template>
          <template v-else-if="lrPhase === 'idle'">
            <button class="lr-action-btn lr-action-start" @click="$emit('activate')">
              📖 开始阅读
            </button>
          </template>
          <template v-else-if="lrPhase === 'error'">
            <button class="lr-action-btn lr-action-retry" @click="$emit('activate')">
              🔄 重试
            </button>
            <button class="lr-action-btn lr-action-warn" @click="$emit('reset')">
              🗑 重新阅读
            </button>
          </template>
          <template v-else-if="lrPhase === 'reading' || lrPhase === 'summarizing'">
            <span class="lr-action-btn lr-action-disabled">⟳ 运行中...</span>
          </template>
          <template v-else-if="lrPhase === 'done'">
            <button class="lr-action-btn lr-action-warn" @click="$emit('reset')">
              🗑 重新阅读
            </button>
          </template>
          <button v-if="lrPhase === 'idle' && lrEnabled && lrHasCache" class="lr-action-btn lr-action-start" @click="$emit('activate')">
            📖 继续阅读
          </button>
        </div>

        <!-- 笔记列表 -->
        <div class="lr-notes-area" v-if="lrChapterSummaries.length > 0 || lrBatchSummaries.length > 0">
          <div class="lr-notes-tabs">
            <button class="lr-notes-tab" :class="{ active: notesTab === 'chapters' }" @click="notesTab = 'chapters'">
              📄 章节笔记 ({{ lrChapterSummaries.length }})
            </button>
            <button class="lr-notes-tab" :class="{ active: notesTab === 'batches' }" @click="notesTab = 'batches'">
              📊 批注小结 ({{ lrBatchSummaries.length }})
            </button>
          </div>

          <!-- 章节笔记列表 -->
          <div class="lr-notes-list" v-if="notesTab === 'chapters' && lrChapterSummaries.length > 0">
            <div
              v-for="item in lrChapterSummaries"
              :key="'c'+item.chapterNo"
              class="lr-note-item"
              :class="{ 'lr-note-active': isSelectedChapter(item) }"
              @click="handleOpenSummary(item)"
            >
              <div class="lr-note-no">#{{ item.chapterNo }}</div>
              <div class="lr-note-body">
                <div class="lr-note-title">{{ item.title }}</div>
                <div class="lr-note-preview">{{ item.preview }}</div>
              </div>
            </div>
          </div>

          <!-- 批次笔记列表 -->
          <div class="lr-notes-list" v-if="notesTab === 'batches' && lrBatchSummaries.length > 0">
            <div
              v-for="item in lrBatchSummaries"
              :key="'b'+item.level+'-'+item.batchIndex"
              class="lr-note-item"
              :class="{ 'lr-note-active': isSelectedBatch(item) }"
              @click="handleOpenSummary(item)"
            >
              <div class="lr-note-no lr-note-level" :style="{ color: levelColor(item.level) }">{{ levelEmoji(item.level) }}</div>
              <div class="lr-note-body">
                <div class="lr-note-title">{{ levelLabel(item.level) }} <span class="lr-note-chap">第{{ item.chapterStart }}-{{ item.chapterEnd }}章</span></div>
                <div class="lr-note-preview">{{ item.preview }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 详情弹出层 -->
      <div class="lr-detail-overlay" v-if="lrSelectedSummary" @click.self="$emit('closeDetail')">
        <div class="lr-detail-card">
          <div class="lr-detail-card-header">
            <span class="lr-detail-card-title">
              <template v-if="lrSelectedSummary.type === 'chapter'">
                📄 第{{ lrSelectedSummary.chapterNo }}章「{{ lrSelectedSummary.title }}」
              </template>
              <template v-else>
                {{ levelEmoji(lrSelectedSummary.level) }} {{ levelLabel(lrSelectedSummary.level) }}
                <span class="lr-detail-card-chap">第{{ lrSelectedSummary.chapterStart }}-{{ lrSelectedSummary.chapterEnd }}章</span>
              </template>
            </span>
            <button class="lr-detail-card-close" @click="$emit('closeDetail')">✕</button>
          </div>
          <div class="lr-detail-card-body">
            <div v-if="summaryDetailLoading" class="lr-detail-loading">
              <span class="lr-detail-loading-dot"></span>
              <span class="lr-detail-loading-dot"></span>
              <span class="lr-detail-loading-dot"></span>
            </div>
            <div v-else class="lr-detail-card-text">{{ summaryDetailText || '（空的摘要）' }}</div>
          </div>
        </div>
      </div>

      <!-- 错误提示 -->
      <div class="lr-error-bar" v-if="lrPhase === 'error' && lrError">
        ⚠️ {{ lrError }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { LrPhase, SummaryItem, BatchSummaryItem, ChapterSummaryItem } from '~/composables/useLibraryReader'

const props = defineProps<{
  lrPhase: LrPhase
  lrPhaseLabel: string
  lrCurrentChapterLabel: string
  lrCurrentChapterNo: number
  lrCurrentChapterTitle: string
  lrProgressPercent: number
  lrDoneChapters: number
  lrTotalChapters: number
  lrPendingChapters: number
  lrEnabled: boolean
  lrHasCache: boolean
  lrError: string
  lrChapterSummaries: ChapterSummaryItem[]
  lrBatchSummaries: BatchSummaryItem[]
  lrSelectedSummary: SummaryItem | null
  summaryDetailText: string
  summaryDetailLoading: boolean
  lrBatchTokens: string
  batchLevelCounts: Record<string, number>
  formatNumber: (n: number) => string
  levelLabel: (level: number) => string
  levelEmoji: (level: number) => string
  levelColor: (level: number) => string
}>()

const emit = defineEmits<{
  toggle: []
  activate: []
  openSummary: [item: SummaryItem]
  closeDetail: []
  reset: []
}>()

const notesTab = ref<'chapters' | 'batches'>('chapters')

function isSelectedChapter(item: ChapterSummaryItem): boolean {
  if (!props.lrSelectedSummary || props.lrSelectedSummary.type !== 'chapter') return false
  return props.lrSelectedSummary.chapterNo === item.chapterNo
}

function isSelectedBatch(item: BatchSummaryItem): boolean {
  if (!props.lrSelectedSummary || props.lrSelectedSummary.type !== 'batch') return false
  return props.lrSelectedSummary.batchIndex === item.batchIndex && props.lrSelectedSummary.level === item.level
}

function handleOpenSummary(item: SummaryItem) {
  emit('openSummary', item)
}
</script>

<style scoped>
/* ══ 面板容器 ══ */
.library-reader-panel {
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.lr-display {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  position: relative;
}

/* ══ 机器人区域 ══ */
.lr-robot-zone {
  min-height: 140px;
  background: linear-gradient(180deg, #0d1628 0%, #111d35 40%, #0d1117 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 0 12px;
  position: relative;
  overflow: hidden;
}

/* 扫描线背景 */
.lr-robot-zone::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(88, 166, 255, 0.02) 2px,
    rgba(88, 166, 255, 0.02) 4px
  );
  pointer-events: none;
}

.lr-robot-zone::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 60%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(88,166,255,0.05), transparent);
  animation: robot-scanline 4s ease-in-out infinite;
}

.lr-robot {
  display: flex;
  align-items: flex-end;
  gap: 18px;
  position: relative;
  z-index: 1;
}

/* ── 机器人头部 ── */
.lr-robot-head {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.lr-robot-antenna {
  width: 4px;
  height: 20px;
  background: linear-gradient(180deg, #58a6ff, #1f6feb);
  border-radius: 2px;
  position: relative;
  margin-bottom: 2px;
}
.lr-robot-antenna::after {
  content: '';
  position: absolute;
  top: -4px;
  left: -3px;
  width: 10px;
  height: 10px;
  background: #58a6ff;
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(88,166,255,0.6);
  animation: antenna-blink 2s ease-in-out infinite;
}

.lr-robot-face {
  width: 80px;
  height: 60px;
  background: linear-gradient(135deg, #1a2a4a, #223a5a);
  border: 2px solid #2a4a6a;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  position: relative;
}

.lr-robot-eye {
  width: 20px;
  height: 22px;
  background: #0a1628;
  border: 1px solid #3a6a9a;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.lr-robot-active .lr-robot-eye {
  animation: eye-glow 1.5s ease-in-out infinite;
}

.lr-robot-pupil {
  width: 8px;
  height: 10px;
  background: #58a6ff;
  border-radius: 3px;
  box-shadow: 0 0 6px rgba(88,166,255,0.4);
  transition: transform 0.3s;
}

.lr-robot-active .lr-robot-pupil {
  animation: pupil-scan 2s ease-in-out infinite;
}

.lr-robot-mouth {
  position: absolute;
  bottom: 8px;
  display: flex;
  gap: 3px;
}

.lr-mouth-line {
  width: 24px;
  height: 2px;
  background: #58a6ff;
  border-radius: 1px;
  opacity: 0.4;
}

/* ── 机器人身体 ── */
.lr-robot-body {
  width: 60px;
  height: 48px;
  background: linear-gradient(135deg, #1a2a4a, #162040);
  border: 2px solid #2a4a6a;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.lr-robot-screen {
  background: #0a1420;
  border: 1px solid #1a3a5a;
  border-radius: 4px;
  padding: 3px 6px;
}

.lr-screen-text {
  font-size: 10px;
  font-family: 'Courier New', monospace;
  font-weight: bold;
  color: #3fb950;
  white-space: nowrap;
}

.lr-screen-glitch { animation: glitch 3s infinite; }
.lr-screen-write { animation: pulse-text 0.8s infinite; }
.lr-screen-error { color: #f85149; animation: pulse-text 0.5s infinite; }

/* ── 手臂 ── */
.lr-robot-arm {
  position: absolute;
  width: 26px;
  height: 8px;
  background: #1a2a4a;
  border: 2px solid #2a4a6a;
  border-radius: 4px;
  bottom: -4px;
}
.lr-robot-arm-left {
  right: 62px;
  transform-origin: right center;
  animation: arm-wave-left 3s ease-in-out infinite;
}
.lr-robot-arm-right {
  left: 62px;
  transform-origin: left center;
  animation: arm-wave-right 3s ease-in-out infinite;
}
.lr-arm-hand {
  position: absolute;
  width: 8px;
  height: 8px;
  background: #2a4a6a;
  border-radius: 50%;
  top: -2px;
}
.lr-robot-arm-left .lr-arm-hand { left: -6px; }
.lr-robot-arm-right .lr-arm-hand { right: -6px; }

/* ── 书本区域 ── */
.lr-book-zone {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  position: relative;
}

.lr-book {
  width: 20px;
  height: 28px;
  position: relative;
  perspective: 60px;
}

.lr-book-cover {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #1f6feb, #58a6ff);
  border-radius: 2px;
  opacity: 0.6;
}

.lr-book-page {
  position: absolute;
  inset: 3px 2px 2px 2px;
  background: #e8e0d0;
  border-radius: 1px;
  transform-origin: left center;
  animation: page-flip 4s ease-in-out infinite;
}

.lr-book-page-back {
  animation-delay: 2s;
  animation-direction: reverse;
}

.lr-book-2 .lr-book-cover {
  background: linear-gradient(135deg, #3fb950, #56d364);
  opacity: 0.5;
}

.lr-book-stack {
  position: absolute;
  bottom: -20px;
  text-align: center;
  width: 100%;
}
.lr-stack-label {
  font-size: 10px;
  color: #484f58;
  white-space: nowrap;
}

/* ══ 信息面板 ══ */
.lr-info-panel {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lr-info-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.lr-info-title {
  font-size: 15px;
  font-weight: 700;
  color: #e6edf3;
}

.lr-info-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 8px;
  background: #21262d;
  color: #8b949e;
}
.badge-idle { background: #21262d; color: #8b949e; }
.badge-reading, .badge-summarizing, .badge-preparing { background: #0d2a3a; color: #58a6ff; }
.badge-done { background: #1a3a2a; color: #3fb950; }
.badge-error { background: #3a1a1a; color: #f85149; }

/* 信息卡片网格 */
.lr-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.lr-info-card {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #161b22;
  border: 1px solid #21262d;
  border-radius: 8px;
  padding: 8px 10px;
  min-height: 52px;
}

.lr-info-card-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.lr-info-card-body {
  flex: 1;
  min-width: 0;
}

.lr-info-card-label {
  font-size: 10px;
  color: #484f58;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.lr-info-card-value {
  font-size: 12px;
  color: #c9d1d9;
  font-weight: 500;
  line-height: 1.4;
}

/* 进度条 */
.lr-progress-bar-mini {
  height: 3px;
  background: #21262d;
  border-radius: 2px;
  overflow: hidden;
  margin-top: 4px;
}

.lr-progress-fill-mini {
  height: 100%;
  background: linear-gradient(90deg, #1f6feb, #58a6ff);
  border-radius: 2px;
  transition: width 0.5s ease;
}

/* ── 流式输出 ── */
.lr-stream-box {
  background: #0a1420;
  border: 1px solid #1a2a4a;
  border-radius: 8px;
  max-height: 120px;
  overflow-y: auto;
}

.lr-stream-box-header {
  font-size: 10px;
  color: #58a6ff;
  padding: 6px 10px;
  border-bottom: 1px solid #1a2a4a;
  display: flex;
  align-items: center;
  gap: 6px;
}

.lr-stream-dot {
  width: 6px;
  height: 6px;
  background: #3fb950;
  border-radius: 50%;
  animation: pulse-dot 1s infinite;
}

.lr-stream-box-content {
  font-size: 11px;
  color: #7a8a9a;
  padding: 6px 10px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* ── 操作按钮 ── */
.lr-actions-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.lr-action-btn {
  padding: 8px 18px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid #30363d;
  background: #21262d;
  color: #c9d1d9;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.lr-action-btn:hover { background: #30363d; border-color: #58a6ff; }
.lr-action-primary { background: #1a3a2a; border-color: #238636; color: #3fb950; }
.lr-action-primary:hover { background: #1f4a32; border-color: #3fb950; }
.lr-action-start { background: #0d2a3a; border-color: #1f6feb; color: #58a6ff; }
.lr-action-start:hover { background: #123a4a; border-color: #58a6ff; }
.lr-action-retry { background: #2a1a1a; border-color: #da3633; color: #f85149; }
.lr-action-warn { background: #2a1a0a; border-color: #d29922; color: #d29922; }
.lr-action-warn:hover { background: #3a2a0a; border-color: #e3b341; color: #e3b341; }
.lr-action-retry:hover { background: #3a1a1a; border-color: #f85149; }
.lr-action-disabled { opacity: 0.5; cursor: not-allowed; }

/* ── 笔记列表 ── */
.lr-notes-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 120px;
}

.lr-notes-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid #21262d;
  margin-bottom: 6px;
}

.lr-notes-tab {
  padding: 6px 14px;
  font-size: 11px;
  cursor: pointer;
  border: none;
  background: transparent;
  color: #484f58;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}
.lr-notes-tab:hover { color: #8b949e; }
.lr-notes-tab.active { color: #58a6ff; border-bottom-color: #58a6ff; }

.lr-notes-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 260px;
}

.lr-note-item {
  display: flex;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  border-left: 3px solid transparent;
}
.lr-note-item:hover { background: rgba(88,166,255,0.04); }
.lr-note-active { background: rgba(88,166,255,0.08); border-left-color: #58a6ff; }

.lr-note-no {
  font-size: 11px;
  color: #484f58;
  font-weight: 600;
  flex-shrink: 0;
  min-width: 24px;
  text-align: center;
  margin-top: 1px;
}
.lr-note-level { font-size: 16px; }

.lr-note-body {
  flex: 1;
  min-width: 0;
}

.lr-note-title {
  font-size: 12px;
  color: #c9d1d9;
  font-weight: 500;
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.lr-note-chap {
  font-size: 10px;
  color: #484f58;
  font-weight: 400;
}

.lr-note-preview {
  font-size: 10px;
  color: #484f58;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ══ 详情弹出层 ══ */
.lr-detail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.lr-detail-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  width: 580px;
  max-width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 48px rgba(0,0,0,0.5);
}

.lr-detail-card-header {
  display: flex;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid #21262d;
  gap: 8px;
}

.lr-detail-card-title {
  font-size: 15px;
  color: #e6edf3;
  font-weight: 600;
}

.lr-detail-card-chap { font-size: 12px; color: #484f58; font-weight: 400; }

.lr-detail-card-close {
  margin-left: auto;
  background: none;
  border: none;
  color: #484f58;
  cursor: pointer;
  font-size: 18px;
  padding: 2px 8px;
  border-radius: 6px;
  transition: all 0.15s;
}
.lr-detail-card-close:hover { color: #f85149; background: rgba(248,81,73,0.1); }

.lr-detail-card-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
}

.lr-detail-card-text {
  font-size: 13px;
  color: #b0b8c4;
  line-height: 1.8;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.lr-detail-loading {
  display: flex;
  justify-content: center;
  gap: 6px;
  padding: 40px 0;
}

.lr-detail-loading-dot {
  width: 8px;
  height: 8px;
  background: #58a6ff;
  border-radius: 50%;
  animation: dot-bounce 1.4s ease-in-out infinite both;
}
.lr-detail-loading-dot:nth-child(1) { animation-delay: -0.32s; }
.lr-detail-loading-dot:nth-child(2) { animation-delay: -0.16s; }
.lr-detail-loading-dot:nth-child(3) { animation-delay: 0s; }

/* ══ 错误条 ══ */
.lr-error-bar {
  margin: 0 16px 12px;
  padding: 8px 12px;
  background: #2a1a1a;
  border: 1px solid #da3633;
  border-radius: 6px;
  color: #f85149;
  font-size: 12px;
}

/* ══ 动画关键帧 ══ */
@keyframes pupil-scan {
  0%, 100% { transform: translateX(-3px); }
  50% { transform: translateX(3px); }
}
@keyframes eye-glow {
  0%, 100% { box-shadow: inset 0 0 4px rgba(88,166,255,0.3); }
  50% { box-shadow: inset 0 0 8px rgba(88,166,255,0.6); }
}
@keyframes antenna-blink {
  0%, 90%, 100% { opacity: 0.8; }
  95% { opacity: 0.3; }
}
@keyframes page-flip {
  0%, 40% { transform: rotateY(0deg); }
  60%, 100% { transform: rotateY(-180deg); }
}
@keyframes arm-wave-left {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(-8deg); }
}
@keyframes arm-wave-right {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(8deg); }
}
@keyframes robot-scanline {
  0% { left: -60%; }
  100% { left: 160%; }
}
@keyframes glitch {
  0%, 90%, 100% { opacity: 1; }
  92% { opacity: 0.7; }
  94% { opacity: 0.9; }
  96% { opacity: 0.6; }
}
@keyframes pulse-text {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
@keyframes dot-bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}
</style>
