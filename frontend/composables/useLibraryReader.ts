import { getAuthToken } from '~/utils/auth/token'
/**
 * composables/useLibraryReader.ts — 图书馆管理员逻辑（多级金字塔版）
 *
 * 适配后端新策略：
 * - 每章 300 字总结（chapter 级）
 * - 每 5 章 1000 字小结（level: 5）
 * - 每 10 章 1000 字小结（level: 10）
 * - 每 50 章 2000 字总结（level: 50）
 * - 每 100 章 2000 字总结（level: 100）
 *
 * SSE 事件：progress / chapter-token / chapter-done / batch-token / batch-done / complete / error
 */

import { ref, computed } from 'vue'

export type LrPhase = 'idle' | 'preparing' | 'reading' | 'summarizing' | 'done' | 'error'
export type SummaryLevel = 'chapter' | 5 | 10 | 50 | 100

export interface ChapterSummaryItem {
  type: 'chapter'
  chapterNo: number
  title: string
  summary: string
  preview: string
}

export interface BatchSummaryItem {
  type: 'batch'
  level: number
  batchIndex: number
  chapterStart: number
  chapterEnd: number
  summary: string
  preview: string
}

export type SummaryItem = ChapterSummaryItem | BatchSummaryItem

export function useLibraryReader(projectId: () => string | undefined) {
  // ========== 状态 ==========
  const lrPhase = ref<LrPhase>('idle')
  const lrEnabled = ref(false)
  const lrError = ref('')
  const lrCurrentChapter = ref(0)
  const lrCurrentChapterTitle = ref('')
  const lrDoneChapters = ref(0)
  const lrTotalChapters = ref(0)
  const lrPendingChapters = ref(0)

  // 章节摘要
  const lrChapterSummaries = ref<ChapterSummaryItem[]>([])
  // 批次小结
  const lrBatchSummaries = ref<BatchSummaryItem[]>([])

  // 选中查看详情
  const lrSelectedSummary = ref<SummaryItem | null>(null)
  const summaryDetailText = ref('')
  const summaryDetailLoading = ref(false)

  // 当前批次 token（流式追加）
  const lrBatchTokens = ref('')

  const lrPhaseLabel = computed(() => {
    const map: Record<string, string> = {
      idle: '● 待命中',
      preparing: '⟳ 整理作品中',
      reading: '⟳ 阅读中',
      summarizing: '⟳ 撰写摘要中',
      done: '● 阅读完成',
      error: '✕ 出错',
    }
    return map[lrPhase.value] || ''
  })

  const lrCurrentChapterLabel = computed(() => {
    if (lrPhase.value === 'preparing') return '📖 正在整理作品结构与大纲...'
    if (lrPhase.value === 'summarizing') return '📝 正在撰写摘要...'
    return `📖 正在阅读 第${lrCurrentChapter.value}章「${lrCurrentChapterTitle.value}」`
  })

  /** 批次层级计数 */
  const batchLevelCounts = computed(() => {
    const counts: Record<string, number> = { '5': 0, '10': 0, '50': 0, '100': 0 }
    for (const b of lrBatchSummaries.value) {
      counts[String(b.level)] = (counts[String(b.level)] || 0) + 1
    }
    return counts
  })

  const lrHasCache = computed(() => lrChapterSummaries.value.length > 0)
  const lrProgressPercent = computed(() => {
    if (!lrTotalChapters.value) return 0
    return Math.min((lrDoneChapters.value / lrTotalChapters.value) * 100, 100)
  })

  // ========== 辅助函数 ==========
  function formatNumber(n: number): string {
    return n.toLocaleString('zh-CN')
  }

  function getToken(): string {
    try { return getAuthToken() || '' } catch { return '' }
  }

  function levelLabel(level: number): string {
    if (level === 5) return '5章小结'
    if (level === 10) return '10章小结'
    if (level === 50) return '50章总结'
    if (level === 100) return '100章总结'
    return ''
  }

  function levelIcon(level: number): string {
    if (level === 5) return '📘'
    if (level === 10) return '📚'
    if (level === 50) return '🏆'
    if (level === 100) return '👑'
    return '📄'
  }

  function isChapterItem(item: SummaryItem): item is ChapterSummaryItem {
    return item.type === 'chapter'
  }

  function isBatchItem(item: SummaryItem): item is BatchSummaryItem {
    return item.type === 'batch'
  }

  // ========== API 调用 ==========
  async function loadLibraryReaderStatus() {
    const pid = projectId()
    if (!pid) return
    try {
      const token = getToken()
      const resp = await fetch(`/api/hdz/library-reader/status?projectId=${pid}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then(r => r.json())

      const d = resp?.data
      if (!d) return

      lrEnabled.value = d.enabled || false

      // 章节摘要
      if (Array.isArray(d.chapters)) {
        lrChapterSummaries.value = d.chapters.map((c: any) => ({
          type: 'chapter' as const,
          chapterNo: c.chapterNo,
          title: c.title,
          summary: c.summary || '',
          preview: c.preview || '',
        }))
      }

      // 批次小结
      if (Array.isArray(d.batches)) {
        lrBatchSummaries.value = d.batches.map((b: any) => ({
          type: 'batch' as const,
          level: b.level,
          batchIndex: b.batchIndex,
          chapterStart: b.chapterStart,
          chapterEnd: b.chapterEnd,
          summary: '',
          preview: b.preview || '',
        }))
      }

      // 旧格式兼容（summaries 数组）
      if (Array.isArray(d.summaries) && d.summaries.length > 0 && lrBatchSummaries.value.length === 0) {
        lrBatchSummaries.value = d.summaries.map((s: any) => ({
          type: 'batch' as const,
          level: s.level === 'long-term' ? 10 : 5,
          batchIndex: s.batchIndex || 0,
          chapterStart: s.chapterStart || 1,
          chapterEnd: s.chapterEnd || 10,
          summary: '',
          preview: s.preview || '',
        }))
      }
    } catch {
      // 静默
    }
  }

  async function toggleLibraryReader() {
    const pid = projectId()
    if (!pid) return
    try {
      const token = getToken()
      await fetch('/api/hdz/library-reader/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ projectId: pid, enabled: true }),
      })
      lrEnabled.value = true
    } catch {
      lrError.value = '启用失败，请稍后重试'
    }
  }

  async function openSummary(item: SummaryItem) {
    lrSelectedSummary.value = item
    summaryDetailText.value = ''
    summaryDetailLoading.value = true

    if (isChapterItem(item)) {
      // 章节摘要：直接从已有数据拿
      summaryDetailText.value = item.summary || '（空的章节总结）'
      summaryDetailLoading.value = false
      return
    }

    // 批次摘要：从已有数据或从后端拉
    if (item.summary && item.summary.length > 20) {
      summaryDetailText.value = item.summary
      summaryDetailLoading.value = false
      return
    }

    try {
      const token = getToken()
      const pid = projectId()
      const resp = await fetch(`/api/hdz/library-reader/batch/${item.batchIndex}?projectId=${pid}&level=${item.level}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then(r => r.json())

      const content = resp?.data?.summary
      if (content) {
        summaryDetailText.value = content
        item.summary = content
      } else {
        summaryDetailText.value = '（摘要内容为空）'
      }
    } catch {
      summaryDetailText.value = '加载失败'
    } finally {
      summaryDetailLoading.value = false
    }
  }

  /** 清空阅读缓存，重新开始阅读 */
  async function resetReaderData() {
    const pid = projectId()
    if (!pid) return
    try {
      const token = getToken()
      const resp = await fetch('/api/hdz/library-reader/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ projectId: pid }),
      })
      if (!resp.ok) return
      // 清空前端状态
      lrPhase.value = 'idle'
      lrError.value = ''
      lrChapterSummaries.value = []
      lrBatchSummaries.value = []
      // 自动重新阅读
      activateLibraryReader()
    } catch {
      console.warn('[LibraryReader] reset failed')
    }
  }

  async function activateLibraryReader() {
    // 重置状态
    lrPhase.value = 'preparing'
    lrError.value = ''
    lrCurrentChapter.value = 0
    lrCurrentChapterTitle.value = ''
    lrDoneChapters.value = 0
    lrTotalChapters.value = 0
    lrPendingChapters.value = 0
    lrBatchTokens.value = ''
    lrSelectedSummary.value = null
    summaryDetailText.value = ''

    const pid = projectId()
    if (!pid) {
      lrPhase.value = 'error'
      lrError.value = '项目数据尚未加载'
      return
    }

    // health 检查
    try {
      const healthResp = await fetch('/api/hdz/library-reader/health').then(r => r.json())
      if (healthResp?.data?.healthy !== true) {
        lrPhase.value = 'error'
        lrError.value = '图书馆管理员健康检查失败，请确认大模型 API Key 已配置'
        return
      }
    } catch {
      console.warn('[LibraryReader] health check failed, proceeding anyway')
    }

    // SSE 连接
    try {
      const token = getToken()
      const resp = await fetch('/api/hdz/library-reader', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ projectId: pid }),
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }))
        lrPhase.value = 'error'
        lrError.value = err?.error || err?.message || `请求失败 (${resp.status})`
        return
      }

      const reader = resp.body?.getReader()
      if (!reader) {
        lrPhase.value = 'error'
        lrError.value = '无法读取响应流'
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let currentEvent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith(':')) continue

          if (trimmed.startsWith('event: ')) {
            currentEvent = trimmed.slice(7).trim()
            continue
          }

          if (trimmed.startsWith('data: ')) {
            try {
              handleSSEEvent(currentEvent, JSON.parse(trimmed.slice(6).trim()))
            } catch {}
          }
        }
      }
    } catch (err: any) {
      lrPhase.value = 'error'
      lrError.value = err?.message || '连接失败'
    }
  }

  function handleSSEEvent(event: string, data: any) {
    switch (event) {
      case 'progress': {
        const phase = data.phase
        if (phase === 'preparing' || phase === 'reading' || phase === 'summarizing-batch') {
          lrPhase.value = phase === 'summarizing-batch' ? 'summarizing' : (phase as LrPhase)
        }
        if (data.totalChapters) lrTotalChapters.value = data.totalChapters
        if (data.doneChapters !== undefined) lrDoneChapters.value = data.doneChapters
        if (data.pendingChapters !== undefined) lrPendingChapters.value = data.pendingChapters
        if (data.currentChapter !== undefined) lrCurrentChapter.value = data.currentChapter
        if (data.chapterTitle) lrCurrentChapterTitle.value = data.chapterTitle
        break
      }

      case 'chapter-token': {
        lrPhase.value = 'reading'
        // 构建实时摘要显示
        if (lrBatchTokens.value === '') {
          lrBatchTokens.value = `📖 第${data.chapterNo}章总结：\n`
        }
        lrBatchTokens.value += data.text
        // 更新当前章节
        if (data.chapterNo) lrCurrentChapter.value = data.chapterNo
        break
      }

      case 'chapter-done': {
        // 加入章节摘要列表
        const newChapter: ChapterSummaryItem = {
          type: 'chapter',
          chapterNo: data.chapterNo,
          title: data.title || `第${data.chapterNo}章`,
          summary: data.summary || '',
          preview: (data.summary || '').slice(0, 80) + ((data.summary?.length || 0) > 80 ? '...' : ''),
        }
        // 替换或追加
        const idx = lrChapterSummaries.value.findIndex(c => c.chapterNo === data.chapterNo)
        if (idx >= 0) {
          lrChapterSummaries.value[idx] = newChapter
        } else {
          lrChapterSummaries.value.push(newChapter)
        }
        if (data.doneChapters !== undefined) lrDoneChapters.value = data.doneChapters
        // 清除流式 token
        lrBatchTokens.value = ''
        break
      }

      case 'batch-token': {
        lrPhase.value = 'summarizing'
        const prefix = `📚 ${data.level}章小结：\n`
        if (lrBatchTokens.value === '' || lrBatchTokens.value.startsWith('📖')) {
          lrBatchTokens.value = prefix
        }
        lrBatchTokens.value += data.text
        break
      }

      case 'batch-done': {
        const newBatch: BatchSummaryItem = {
          type: 'batch',
          level: data.level,
          batchIndex: data.batchIndex,
          chapterStart: data.chapterStart,
          chapterEnd: data.chapterEnd,
          summary: data.summary || '',
          preview: (data.summary || '').slice(0, 100) + ((data.summary?.length || 0) > 100 ? '...' : ''),
        }
        // 替换或追加
        const idx = lrBatchSummaries.value.findIndex(
          b => b.level === data.level && b.batchIndex === data.batchIndex
        )
        if (idx >= 0) {
          lrBatchSummaries.value[idx] = newBatch
        } else {
          lrBatchSummaries.value.push(newBatch)
        }
        // 排序：优先按 level 从高到低，再按 batchIndex
        lrBatchSummaries.value.sort((a, b) => {
          if (a.level !== b.level) return b.level - a.level
          return a.batchIndex - b.batchIndex
        })
        if (data.chapterCount !== undefined) lrDoneChapters.value = data.chapterCount
        lrBatchTokens.value = ''
        lrPhase.value = 'reading'
        break
      }

      case 'complete': {
        lrPhase.value = 'done'
        lrEnabled.value = true

        // 从 complete 数据填入章节
        if (Array.isArray(data.chapters)) {
          for (const c of data.chapters) {
            const existing = lrChapterSummaries.value.find(ec => ec.chapterNo === c.chapterNo)
            if (!existing) {
              lrChapterSummaries.value.push({
                type: 'chapter',
                chapterNo: c.chapterNo,
                title: c.title || '',
                summary: '',
                preview: c.preview || '',
              })
            }
          }
        }

        // 从 complete 数据填入批次
        if (Array.isArray(data.batches)) {
          for (const b of data.batches) {
            const existing = lrBatchSummaries.value.find(
              eb => eb.level === b.level && eb.batchIndex === b.batchIndex
            )
            if (!existing) {
              lrBatchSummaries.value.push({
                type: 'batch',
                level: b.level,
                batchIndex: b.batchIndex,
                chapterStart: b.chapterStart,
                chapterEnd: b.chapterEnd,
                summary: '',
                preview: b.preview || '',
              })
            }
          }
        }

        if (data.totalChapters) lrDoneChapters.value = data.totalChapters
        lrBatchTokens.value = ''
        break
      }

      case 'error': {
        lrPhase.value = 'error'
        lrError.value = data.error || '未知错误'
        break
      }
    }
  }

  /** 估算已读字数（每章约 300 字总结 + 上下文） */
  const lrReadChars = computed(() => {
    const chapterChars = lrChapterSummaries.value.reduce((sum, c) => sum + (c.summary?.length || 0), 0)
    const batchChars = lrBatchSummaries.value.reduce((sum, b) => sum + (b.summary?.length || 0), 0)
    // 原始内容按每章约 1500 字估算（300 字总结代表约 5 倍原文）
    const originalChars = lrDoneChapters.value * 1500
    return originalChars + chapterChars + batchChars
  })

  /** 当前章节号（方便组件直接取） */
  const lrCurrentChapterNo = computed(() => lrCurrentChapter.value)

  /** 层级 emoji 映射 */
  function levelEmoji(level: number): string {
    if (level === 5) return '📘'
    if (level === 10) return '📚'
    if (level === 50) return '🏆'
    if (level === 100) return '👑'
    return '📄'
  }

  /** 层级颜色映射 */
  function levelColor(level: number): string {
    if (level === 5) return '#3fb950'
    if (level === 10) return '#58a6ff'
    if (level === 50) return '#d29922'
    if (level === 100) return '#f78166'
    return '#8b949e'
  }

  return {
    // 状态
    lrPhase,
    lrEnabled,
    lrError,
    lrCurrentChapter,
    lrCurrentChapterTitle,
    lrDoneChapters,
    lrTotalChapters,
    lrPendingChapters,
    lrChapterSummaries,
    lrBatchSummaries,
    lrSelectedSummary,
    summaryDetailText,
    summaryDetailLoading,
    lrBatchTokens,
    lrHasCache,
    batchLevelCounts,
    lrReadChars,
    lrCurrentChapterNo,

    // 计算属性
    lrPhaseLabel,
    lrCurrentChapterLabel,
    lrProgressPercent,
    formatNumber,
    levelLabel,
    levelIcon,
    levelEmoji,
    levelColor,
    isChapterItem,
    isBatchItem,

    // 方法
    loadLibraryReaderStatus,
    toggleLibraryReader,
    openSummary,
    activateLibraryReader,
    resetReaderData,
  }
}
