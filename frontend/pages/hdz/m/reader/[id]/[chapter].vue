<template>
  <div class="hdzm-reader">
    <!-- 工具栏 -->
    <div v-if="showToolbar" class="hdzm-reader-toolbar">
      <button class="hdzm-reader-back" @click="router.back()">← 返回</button>
      <div class="hdzm-reader-title">{{ chapter?.title || '加载中...' }}</div>
      <button class="hdzm-reader-menu-btn" @click="showSettings = !showSettings">Aa</button>
    </div>

    <!-- 阅读内容 -->
    <div class="hdzm-reader-body" :style="readerStyle" @click="toggleToolbar">
      <div class="hdzm-reader-chapter-title">{{ chapter?.title || `第${chapterNo}章` }}</div>
      <div class="hdzm-reader-content" v-html="renderedContent"></div>
    </div>

    <!-- 底部章节导航 -->
    <div v-if="showToolbar" class="hdzm-reader-nav">
      <button class="hdzm-reader-nav-btn" :disabled="!prevChapter" @click="goChapter(prevChapter)">◀ 上一章</button>
      <button class="hdzm-reader-nav-btn" :disabled="!nextChapter" @click="goChapter(nextChapter)">下一章 ▶</button>
    </div>

    <!-- 设置面板 -->
    <div v-if="showSettings" class="hdzm-settings-panel" @click.self="showSettings = false">
      <div class="hdzm-settings-inner">
        <div class="hdzm-setting-row">
          <span>字号</span>
          <div class="hdzm-setting-controls">
            <button @click="fontSize = Math.max(14, fontSize - 2)">A-</button>
            <span>{{ fontSize }}</span>
            <button @click="fontSize = Math.min(28, fontSize + 2)">A+</button>
          </div>
        </div>
        <div class="hdzm-setting-row">
          <span>主题</span>
          <div class="hdzm-theme-picker">
            <button :class="{ active: theme === 'sepia' }" @click="theme = 'sepia'">📖</button>
            <button :class="{ active: theme === 'dark' }" @click="theme = 'dark'">🌙</button>
            <button :class="{ active: theme === 'light' }" @click="theme = 'light'">☀️</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)
const chapterId = computed(() => route.params.chapter as string)

const $api = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json())

const chapter = ref<any>(null)
const chapters = ref<any[]>([])
const showToolbar = ref(true)
const showSettings = ref(false)
const fontSize = ref(18)
const theme = ref<'sepia' | 'dark' | 'light'>('sepia')

const chapterNo = computed(() => chapter.value?.chapterNo || route.query.no || '—')
const currentIndex = computed(() => chapters.value.findIndex((c: any) => c.id === chapterId.value || c.chapterNo === chapter.value?.chapterNo))
const prevChapter = computed(() => currentIndex.value > 0 ? chapters.value[currentIndex.value - 1] : null)
const nextChapter = computed(() => currentIndex.value < chapters.value.length - 1 ? chapters.value[currentIndex.value + 1] : null)

const readerStyle = computed(() => {
  const themes: Record<string, any> = {
    sepia: { background: '#f5f0e8', color: '#5c4b37' },
    dark: { background: '#1a1a1a', color: '#ccc' },
    light: { background: '#fff', color: '#333' },
  }
  return { fontSize: fontSize.value + 'px', ...themes[theme.value] }
})

const renderedContent = computed(() => {
  const text = chapter.value?.content || ''
  return text
    .split('\n')
    .map(p => p.trim() ? `<p>${p}</p>` : '<br>')
    .join('')
})

onMounted(async () => {
  try {
    const c: any = await $api(`/api/hdz/manuscript/${projectId.value}`)
    chapters.value = c?.data || (Array.isArray(c) ? c : [])
  } catch {}
  try {
    const ch: any = await $api(`/api/hdz/manuscript/${projectId.value}/${chapterId.value}`)
    chapter.value = ch?.data || ch
  } catch {}
})

watch(() => chapterId.value, async (id) => {
  if (id) {
    try {
      const ch: any = await $api(`/api/hdz/manuscript/${projectId.value}/${id}`)
      chapter.value = ch?.data || ch
    } catch {}
  }
})

let toolbarTimer: any = null
function toggleToolbar() {
  showToolbar.value = !showToolbar.value
  if (showToolbar.value) {
    clearTimeout(toolbarTimer)
    toolbarTimer = setTimeout(() => { showToolbar.value = false }, 3000)
  }
}

function goChapter(ch: any) {
  if (ch) {
    router.push(`/hdz/m/reader/${projectId.value}/${ch.id}`)
  }
}
</script>

<style scoped>
.hdzm-reader { min-height: 100vh; display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Serif SC", serif; }

/* Toolbar */
.hdzm-reader-toolbar { position: fixed; top: 0; left: 0; right: 0; z-index: 100; height: 44px; display: flex; align-items: center; padding: 0 12px; background: inherit; border-bottom: 1px solid rgba(0,0,0,0.06); backdrop-filter: blur(12px); }
.hdzm-reader-back { font-size: 0.85rem; color: #8b7355; background: none; border: none; cursor: pointer; }
.hdzm-reader-title { flex: 1; font-size: 0.8rem; font-weight: 500; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: inherit; }
.hdzm-reader-menu-btn { background: none; border: 1px solid rgba(0,0,0,0.1); border-radius: 4px; padding: 2px 8px; font-size: 0.75rem; cursor: pointer; color: inherit; }

/* Reader body */
.hdzm-reader-body { flex: 1; padding: 60px 20px 80px; overflow-y: auto; line-height: 2; cursor: pointer; }
.hdzm-reader-chapter-title { text-align: center; font-size: 1.1em; font-weight: 600; margin-bottom: 24px; }
.hdzm-reader-content p { text-indent: 2em; margin: 0.4em 0; }
.hdzm-reader-content br { content: ''; display: block; height: 1em; }

/* Bottom nav */
.hdzm-reader-nav { position: fixed; bottom: 0; left: 0; right: 0; z-index: 100; height: 48px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; border-top: 1px solid rgba(0,0,0,0.06); backdrop-filter: blur(12px); }
.hdzm-reader-nav-btn { padding: 6px 14px; border: 1px solid rgba(0,0,0,0.1); border-radius: 6px; background: none; font-size: 0.75rem; cursor: pointer; color: inherit; }
.hdzm-reader-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* Settings panel */
.hdzm-settings-panel { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.3); display: flex; align-items: flex-end; }
.hdzm-settings-inner { width: 100%; background: #faf7f0; border-radius: 12px 12px 0 0; padding: 16px 20px; }
.hdzm-setting-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 0.85rem; }
.hdzm-setting-controls { display: flex; align-items: center; gap: 8px; }
.hdzm-setting-controls button { padding: 4px 10px; border: 1px solid rgba(0,0,0,0.1); border-radius: 4px; background: #fff; cursor: pointer; font-size: 0.8rem; }
.hdzm-setting-controls span { min-width: 24px; text-align: center; font-size: 0.8rem; }
.hdzm-theme-picker { display: flex; gap: 6px; }
.hdzm-theme-picker button { font-size: 1.1rem; padding: 4px 8px; border: 1px solid transparent; border-radius: 6px; background: none; cursor: pointer; }
.hdzm-theme-picker button.active { border-color: #8b7355; background: rgba(139,115,85,0.1); }
</style>
