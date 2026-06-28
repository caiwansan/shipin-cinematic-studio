<!--
  广告创作 & 音乐创作 — 手机版合并工作台
  底部 TabBar：广告脚本 → 视频生成 → 音乐创作
  /studio-v2/m/creative.vue
-->
<template>
  <div class="creative-mobile">
    <!-- 顶部栏 -->
    <header class="crm-header">
      <button class="crm-back" @click="goBack">‹ 返回</button>
      <h1 class="crm-title">{{ tab === 'ad-script' ? '广告脚本' : tab === 'ad-video' ? '视频生成' : '音乐创作' }}</h1>
      <div style="width:40px;"></div>
    </header>

    <!-- 主内容区 -->
    <div class="crm-body">
      <!-- ===== Tab 1: 广告脚本 ===== -->
      <div v-show="tab === 'ad-script'" class="crm-panel">
        <div class="crm-section">
          <div class="crm-section-header">📝 广告脚本</div>
          <textarea v-model="adScript" class="crm-textarea" rows="6" placeholder="输入产品卖点、目标受众、广告风格…"></textarea>
          <button class="crm-btn crm-btn-primary crm-btn-full" :disabled="optimizingScript" @click="optimizeAdScript">
            {{ optimizingScript ? '⏳ 优化中…' : '🤖 AI 优化脚本' }}
          </button>
        </div>

        <!-- 优化结果 -->
        <div v-if="optimizedScript" class="crm-section">
          <div class="crm-section-header">
            ✨ 优化结果
            <button class="crm-btn-sm" @click="applyOptimizedScript">📋 应用到视频</button>
          </div>

          <template v-if="shots.length > 0">
            <div class="crm-subtitle">🎬 分镜时间轴（{{ shots.length }}镜）</div>
            <div class="crm-shot-list">
              <div v-for="(shot, si) in shots" :key="si" class="crm-shot-card">
                <div class="crm-shot-num">#{{ shot.shot || si+1 }}</div>
                <div class="crm-shot-info">
                  <div class="crm-shot-scene">{{ shot.scene }}</div>
                  <div class="crm-shot-meta">⏱ {{ shot.time }}s · {{ shot.camera || '—' }}</div>
                  <div v-if="shot.dialogue" class="crm-shot-dialogue">💬 {{ shot.dialogue }}</div>
                </div>
              </div>
            </div>
          </template>

          <div class="crm-field">
            <label class="crm-label">💬 对话/旁白</label>
            <textarea v-model="shotDialogue" class="crm-textarea" rows="2"></textarea>
          </div>
          <div class="crm-field">
            <label class="crm-label">🔊 音效</label>
            <textarea v-model="shotEffects" class="crm-textarea" rows="2"></textarea>
          </div>
          <div class="crm-field">
            <label class="crm-label">✨ 特效</label>
            <textarea v-model="shotVfx" class="crm-textarea" rows="2"></textarea>
          </div>
        </div>

        <!-- 图片生成区 -->
        <div class="crm-section">
          <div class="crm-section-header">🎨 广告图生成</div>
          <textarea v-model="imagePrompt" class="crm-textarea" rows="3" placeholder="输入图片提示词…"></textarea>
          <div class="crm-row">
            <button class="crm-btn crm-btn-secondary" @click="optimizeImagePrompt">🤖 优化提示词</button>
            <button class="crm-btn crm-btn-primary" :disabled="generatingImage" @click="generateImage">🎨 生成</button>
          </div>
          <div v-if="generatedImages.length" class="crm-image-grid">
            <img v-for="(img, i) in generatedImages" :key="i" :src="img" class="crm-image-thumb" @click="previewImg = img" />
          </div>
        </div>
      </div>

      <!-- ===== Tab 2: 视频生成 ===== -->
      <div v-show="tab === 'ad-video'" class="crm-panel">
        <div class="crm-section">
          <div class="crm-section-header">🎬 视频设置</div>
          <div class="crm-field">
            <label class="crm-label">📝 视频描述</label>
            <textarea v-model="videoDescription" class="crm-textarea" rows="4" placeholder="脚本优化后自动填充…"></textarea>
          </div>
          <div class="crm-field">
            <label class="crm-label">🚫 负面提示词</label>
            <textarea v-model="negativePrompt" class="crm-textarea" rows="2"></textarea>
          </div>
          <div class="crm-row crm-row-3">
            <div class="crm-field" style="flex:1;">
              <label class="crm-label">⏱ 时长</label>
              <select v-model.number="videoDuration" class="crm-select">
                <option :value="5">5s</option><option :value="8">8s</option><option :value="10">10s</option><option :value="15">15s</option>
              </select>
            </div>
            <div class="crm-field" style="flex:1;">
              <label class="crm-label">🎬 风格</label>
              <select v-model="adStyle" class="crm-select">
                <option value="realistic">写实</option><option value="anime">动漫</option><option value="cyberpunk">赛博</option><option value="ink">水墨</option>
              </select>
            </div>
            <div class="crm-field" style="flex:1;">
              <label class="crm-label">📐 比例</label>
              <select v-model="aspectRatio" class="crm-select">
                <option value="9:16">9:16</option><option value="16:9">16:9</option><option value="1:1">1:1</option>
              </select>
            </div>
          </div>
          <button class="crm-btn crm-btn-primary crm-btn-full" :disabled="generatingVideo" @click="generateVideo">
            {{ generatingVideo ? '⏳ 生成中…' : '🎬 生成视频' }}
          </button>
          <div v-if="generatedVideoUrl" style="margin-top:12px;">
            <video :src="generatedVideoUrl" controls style="width:100%;border-radius:8px;"></video>
          </div>
        </div>
      </div>

      <!-- ===== Tab 3: 音乐创作 ===== -->
      <div v-show="tab === 'music'" class="crm-panel">
        <div class="crm-section">
          <div class="crm-section-header">🎼 音乐风格</div>
          <div class="crm-chip-grid">
            <button v-for="s in musicStyles" :key="s.id" class="crm-chip" :class="{ active: selectedStyle === s.id }" @click="selectedStyle = s.id">
              {{ s.icon }} {{ s.name }}
            </button>
          </div>
        </div>

        <div class="crm-section">
          <div class="crm-section-header">💫 情绪氛围</div>
          <div class="crm-chip-grid">
            <button v-for="m in moods" :key="m.id" class="crm-chip" :class="{ active: selectedMood === m.id }" @click="selectedMood = m.id">
              {{ m.emoji }} {{ m.name }}
            </button>
          </div>
        </div>

        <div class="crm-section">
          <div class="crm-section-header">⚙️ 高级</div>
          <div class="crm-row crm-row-2">
            <div class="crm-field">
              <label class="crm-label">⏱ 时长</label>
              <div class="crm-stepper">
                <button class="crm-step-btn" @click="duration = Math.max(15, duration-15)">−</button>
                <span class="crm-step-val">{{ duration }}s</span>
                <button class="crm-step-btn" @click="duration = Math.min(300, duration+15)">+</button>
              </div>
            </div>
            <div class="crm-field">
              <label class="crm-label">BPM</label>
              <div class="crm-stepper">
                <button class="crm-step-btn" @click="bpm = Math.max(40, bpm-5)">−</button>
                <span class="crm-step-val">{{ bpm }}</span>
                <button class="crm-step-btn" @click="bpm = Math.min(200, bpm+5)">+</button>
              </div>
            </div>
          </div>
          <div class="crm-field">
            <label class="crm-label">乐器偏好</label>
            <div class="crm-inline-chips">
              <span v-for="inst in instruments" :key="inst" class="crm-inst-tag" :class="{ active: selectedInstruments.includes(inst) }" @click="toggleInstrument(inst)">{{ inst }}</span>
            </div>
          </div>
        </div>

        <div class="crm-section">
          <div class="crm-section-header">📝 主题描述</div>
          <textarea v-model="musicPrompt" class="crm-textarea" rows="3" placeholder="描述歌曲主题和创作方向…"></textarea>
          <button class="crm-btn crm-btn-secondary crm-btn-full" :disabled="lyricGenerating" @click="generateLyrics">
            {{ lyricGenerating ? '✍️ 创作中…' : '✍️ AI 创作歌词' }}
          </button>
        </div>

        <!-- 歌词展示 -->
        <div v-if="currentLyrics" class="crm-section">
          <div class="crm-section-header">📜 歌词</div>
          <pre class="crm-lyrics-text">{{ currentLyrics }}</pre>
        </div>

        <!-- 生成音乐 -->
        <div class="crm-section">
          <button class="crm-btn crm-btn-primary crm-btn-full" :disabled="musicGenerating || !currentLyrics" @click="generateMusic">
            {{ musicGenerating ? '🎵 合成中…' : '🎵 生成音乐' }}
          </button>

          <!-- 播放器 -->
          <div v-if="currentSong?.url" class="crm-player">
            <div class="crm-disc" :class="{ spinning: isPlaying }">
              <div class="crm-disc-label">{{ currentSong.name }}</div>
            </div>
            <div class="crm-player-controls">
              <button class="crm-play-btn" @click="togglePlay">{{ isPlaying ? '⏸' : '▶️' }}</button>
              <div class="crm-progress" ref="progressBar" @click="seekAudio">
                <div class="crm-progress-fill" :style="{ width: progressPercent + '%' }"></div>
              </div>
              <span class="crm-time">{{ formatTime(currentTime) }}/{{ formatTime(duration_s) }}</span>
            </div>
            <div class="crm-player-actions">
              <button class="crm-btn-sm" @click="downloadMusic">⬇ 下载</button>
              <button class="crm-btn-sm" @click="copyLyrics">📋 歌词</button>
            </div>
          </div>

          <!-- 历史记录 -->
          <div v-if="history.length" style="margin-top:12px;">
            <div class="crm-subtitle">📋 生成记录</div>
            <div v-for="item in history" :key="item.id" class="crm-history-item">
              <span class="crm-history-info">{{ item.style }} · {{ item.duration }}s</span>
              <button class="crm-btn-sm" @click="playHistory(item)">▶</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部 TabBar -->
    <nav class="crm-tabbar">
      <button class="crm-tab" :class="{ active: tab === 'ad-script' }" @click="tab = 'ad-script'">
        <span class="crm-tab-icon">📝</span>
        <span class="crm-tab-label">广告</span>
      </button>
      <button class="crm-tab" :class="{ active: tab === 'ad-video' }" @click="tab = 'ad-video'">
        <span class="crm-tab-icon">🎬</span>
        <span class="crm-tab-label">视频</span>
      </button>
      <button class="crm-tab" :class="{ active: tab === 'music' }" @click="tab = 'music'">
        <span class="crm-tab-icon">🎵</span>
        <span class="crm-tab-label">音乐</span>
      </button>
    </nav>

    <!-- 大图预览 -->
    <div v-if="previewImg" class="crm-overlay" @click.self="previewImg = ''">
      <img :src="previewImg" style="max-width:90vw;max-height:80vh;border-radius:8px;" @click.stop />
      <span style="position:fixed;top:20px;right:20px;color:#fff;font-size:28px;cursor:pointer;padding:12px;" @click="previewImg = ''">✕</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const router = useRouter()
const tab = ref('ad-script')

// ===== 广告 =====
const adScript = ref('')
const optimizingScript = ref(false)
const optimizedScript = ref<any>(null)
const shots = ref<any[]>([])
const shotDialogue = ref('')
const shotEffects = ref('')
const shotVfx = ref('')

const imagePrompt = ref('')
const imageNegativePrompt = ref('')
const optimizingImagePrompt = ref(false)
const generatingImage = ref(false)
const generatedImages = ref<string[]>([])
const previewImg = ref('')

const videoDescription = ref('')
const negativePrompt = ref('')
const videoDuration = ref(8)
const adStyle = ref('realistic')
const aspectRatio = ref('9:16')
const generatingVideo = ref(false)
const generatedVideoUrl = ref('')

// ===== 音乐 =====
const musicPrompt = ref('')
const selectedStyle = ref('epic')
const selectedMood = ref('cinematic')
const duration = ref(30)
const bpm = ref(120)
const selectedInstruments = ref<string[]>([])
const lyricGenerating = ref(false)
const musicGenerating = ref(false)
const currentLyrics = ref('')
const currentSong = ref<any>(null)
const history = ref<any[]>([])
const isPlaying = ref(false)
const currentTime = ref(0)
const duration_s = ref(0)
const progressPercent = ref(0)
const progressBar = ref<HTMLElement | null>(null)
const audioPlayer = ref<HTMLAudioElement | null>(null)
let animFrame = 0

const musicStyles = [
  { id: 'epic', name: '史诗', icon: '🏛️' },
  { id: 'pop', name: '流行', icon: '🎤' },
  { id: 'rock', name: '摇滚', icon: '🎸' },
  { id: 'jazz', name: '爵士', icon: '🎷' },
  { id: 'classical', name: '古典', icon: '🎻' },
  { id: 'folk', name: '民谣', icon: '🪕' },
  { id: 'electronic', name: '电子', icon: '🎛️' },
  { id: 'hiphop', name: '嘻哈', icon: '🎧' },
]
const moods = [
  { id: 'cinematic', name: '电影感', emoji: '🎬' },
  { id: 'happy', name: '欢快', emoji: '😊' },
  { id: 'sad', name: '悲伤', emoji: '😢' },
  { id: 'romantic', name: '浪漫', emoji: '💕' },
  { id: 'epic', name: '宏大', emoji: '⚔️' },
  { id: 'calm', name: '宁静', emoji: '🧘' },
]
const instruments = ['钢琴','吉他','古筝','二胡','鼓','贝斯','小提琴','笛子','电子合成器']

function goBack() { router.back() }
function toggleInstrument(inst: string) {
  const idx = selectedInstruments.value.indexOf(inst)
  if (idx >= 0) selectedInstruments.value.splice(idx, 1)
  else selectedInstruments.value.push(inst)
}

// ===== 广告方法 =====
async function optimizeAdScript() {
  if (!adScript.value.trim()) return
  optimizingScript.value = true
  try {
    const res = await fetch('/api/ai/optimize-ad-script', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script: adScript.value }),
    })
    const json = await res.json()
    if (json.success) {
      optimizedScript.value = json.data
      shots.value = json.data.shots || []
      shotDialogue.value = json.data.dialogue || ''
      shotEffects.value = json.data.effects || ''
      shotVfx.value = json.data.vfx || ''
      if (json.data.narrative) videoDescription.value = json.data.narrative
    }
  } catch (e) { console.warn(e) }
  finally { optimizingScript.value = false }
}

function applyOptimizedScript() {
  // 切换到视频 tab 并填充描述
  videoDescription.value = optimizedScript.value?.narrative || videoDescription.value
  tab.value = 'ad-video'
}

async function optimizeImagePrompt() {
  optimizingImagePrompt.value = true
  try {
    const res = await fetch('/api/ai/optimize-image-prompt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: imagePrompt.value }),
    })
    const json = await res.json()
    if (json.success && json.data?.prompt) imagePrompt.value = json.data.prompt
  } catch (e) { console.warn(e) }
  finally { optimizingImagePrompt.value = false }
}

async function generateImage() {
  generatingImage.value = true
  try {
    const res = await fetch('/api/tasks/ai-generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'temp-ad', taskType: 'image', input: { prompt: imagePrompt.value, negativePrompt: imageNegativePrompt.value } }),
    })
    const json = await res.json()
    if (json.success) {
      // 轮询
      const taskId = json.data?.taskId || json.data?.id
      if (taskId) {
        const result = await pollTask(taskId)
        if (result?.imageUrl) generatedImages.value.push(result.imageUrl)
      } else if (json.data?.imageUrl) {
        generatedImages.value.push(json.data.imageUrl)
      }
    }
  } catch (e) { console.warn(e) }
  finally { generatingImage.value = false }
}

async function generateVideo() {
  generatingVideo.value = true
  try {
    const res = await fetch('/api/tasks/ai-generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'temp-ad', taskType: 'video',
        input: {
          narrative: videoDescription.value,
          negativePrompt: negativePrompt.value,
          duration: videoDuration.value,
          ratio: aspectRatio.value,
          videoStyle: adStyle.value,
        },
      }),
    })
    const json = await res.json()
    if (json.success) {
      const taskId = json.data?.taskId || json.data?.id
      if (taskId) {
        const result = await pollTask(taskId)
        if (result?.videoUrl) generatedVideoUrl.value = result.videoUrl
      } else if (json.data?.videoUrl) {
        generatedVideoUrl.value = json.data.videoUrl
      }
    }
  } catch (e) { console.warn(e) }
  finally { generatingVideo.value = false }
}

async function pollTask(taskId: string, maxWait = 180): Promise<any> {
  for (let i = 0; i < maxWait; i++) {
    await new Promise(r => setTimeout(r, 2000))
    try {
      const res = await fetch(`/api/tasks/${taskId}/status`)
      const json = await res.json()
      if (json.data?.status === 'completed') return json.data?.result || json.data
      if (json.data?.status === 'failed') throw new Error(json.data?.error || '任务失败')
    } catch (e) { throw e }
  }
  return null
}

// ===== 音乐方法 =====
async function generateLyrics() {
  lyricGenerating.value = true
  try {
    const res = await fetch('/api/ai/generate-lyrics', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: musicPrompt.value,
        style: selectedStyle.value,
        mood: selectedMood.value,
      }),
    })
    const json = await res.json()
    if (json.success) currentLyrics.value = json.data?.lyrics || json.data?.text || ''
  } catch (e) { console.warn(e) }
  finally { lyricGenerating.value = false }
}

async function generateMusic() {
  musicGenerating.value = true
  try {
    const res = await fetch('/api/ai/generate-music', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lyrics: currentLyrics.value,
        style: selectedStyle.value,
        duration: duration.value,
        bpm: bpm.value,
        instruments: selectedInstruments.value,
      }),
    })
    const json = await res.json()
    if (json.success) {
      currentSong.value = json.data
      history.value.unshift(json.data)
      currentLyrics.value = json.data.lyrics || currentLyrics.value
      setupAudio()
    }
  } catch (e) { console.warn(e) }
  finally { musicGenerating.value = false }
}

function setupAudio() {
  if (audioPlayer.value) {
    audioPlayer.value.pause()
    audioPlayer.value = null
  }
  cancelAnimationFrame(animFrame)
  if (currentSong.value?.url) {
    audioPlayer.value = new Audio(currentSong.value.url)
    audioPlayer.value.volume = 0.7
    audioPlayer.value.addEventListener('timeupdate', updateProgress)
    audioPlayer.value.addEventListener('loadedmetadata', () => {
      duration_s.value = audioPlayer.value?.duration || 0
    })
    audioPlayer.value.addEventListener('ended', () => { isPlaying.value = false })
    audioPlayer.value.play()
    isPlaying.value = true
  }
}

function updateProgress() {
  if (!audioPlayer.value) return
  currentTime.value = audioPlayer.value.currentTime
  duration_s.value = audioPlayer.value.duration || 0
  progressPercent.value = duration_s.value > 0 ? (currentTime.value / duration_s.value) * 100 : 0
}

function togglePlay() {
  if (!audioPlayer.value) return
  if (isPlaying.value) { audioPlayer.value.pause(); isPlaying.value = false }
  else { audioPlayer.value.play(); isPlaying.value = true }
}

function seekAudio(e: MouseEvent) {
  if (!progressBar.value || !audioPlayer.value) return
  const rect = progressBar.value.getBoundingClientRect()
  const pct = (e.clientX - rect.left) / rect.width
  audioPlayer.value.currentTime = pct * duration_s.value
}

function formatTime(t: number) {
  if (!t) return '0:00'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function playHistory(item: any) {
  currentSong.value = item
  setupAudio()
}

function downloadMusic() {
  if (currentSong.value?.url) {
    const a = document.createElement('a')
    a.href = currentSong.value.url
    a.download = (currentSong.value.name || 'music') + '.mp3'
    a.click()
  }
}

function copyLyrics() {
  navigator.clipboard.writeText(currentLyrics.value || '').catch(() => {})
}
</script>

<style scoped>
.creative-mobile {
  --bg: #0f0f13;
  --bg-card: #1a1a22;
  --bg-input: #22222d;
  --text: #e0e0e8;
  --text-muted: #88889a;
  --text-dim: #666678;
  --primary: #8b5cf6;
  --primary-dim: #6d44c4;
  --border: rgba(255,255,255,0.06);
  --radius: 8px;
  --tabbar-h: 56px;
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  display: flex; flex-direction: column;
  -webkit-font-smoothing: antialiased;
}

/* Header */
.crm-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 12px; height: 48px;
  background: rgba(15,15,19,0.95);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  z-index: 10;
}
.crm-back { background: none; border: none; color: var(--primary); font-size: 18px; cursor: pointer; padding: 8px 4px; }
.crm-title { font-size: 16px; font-weight: 600; margin: 0; }

/* Body */
.crm-body {
  flex: 1; overflow-y: auto;
  padding: 12px 16px;
  padding-bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 16px);
}
.crm-panel { display: flex; flex-direction: column; gap: 12px; }

/* Sections */
.crm-section {
  background: var(--bg-card);
  border-radius: 10px;
  padding: 14px;
  border: 1px solid var(--border);
}
.crm-section-header {
  font-size: 15px; font-weight: 600; margin-bottom: 10px;
  display: flex; align-items: center; justify-content: space-between;
}
.crm-subtitle { font-size: 13px; color: var(--text-muted); margin-bottom: 8px; }

/* Form */
.crm-field { margin-bottom: 8px; }
.crm-label { display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 4px; }
.crm-textarea, .crm-select, .crm-input {
  width: 100%; padding: 10px 12px; border-radius: var(--radius);
  background: var(--bg-input); border: 1px solid var(--border);
  color: var(--text); font-size: 14px; outline: none; box-sizing: border-box;
  font-family: inherit;
}
.crm-textarea { resize: vertical; line-height: 1.6; }
.crm-select { appearance: auto; }

/* Buttons */
.crm-btn {
  padding: 10px 18px; border-radius: var(--radius); border: none;
  font-size: 14px; cursor: pointer; transition: all 0.15s;
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
}
.crm-btn-primary { background: var(--primary); color: #fff; }
.crm-btn-primary:disabled { opacity: 0.4; }
.crm-btn-secondary { background: var(--bg-input); color: var(--text); border: 1px solid var(--border); }
.crm-btn-full { width: 100%; }
.crm-btn-sm { padding: 5px 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-input); color: var(--text); font-size: 12px; cursor: pointer; }
.crm-row { display: flex; gap: 8px; margin-top: 8px; }
.crm-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.crm-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }

/* Chips */
.crm-chip-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.crm-chip {
  padding: 6px 12px; border-radius: 20px;
  background: var(--bg-input); border: 1px solid var(--border);
  color: var(--text-muted); font-size: 12px; cursor: pointer; transition: all 0.15s;
}
.crm-chip.active { background: rgba(139,92,246,0.12); border-color: var(--primary); color: var(--primary); }
.crm-inline-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.crm-inst-tag {
  padding: 4px 10px; border-radius: 14px;
  background: var(--bg-input); border: 1px solid var(--border);
  color: var(--text-dim); font-size: 11px; cursor: pointer;
}
.crm-inst-tag.active { background: rgba(139,92,246,0.1); border-color: var(--primary); color: var(--primary); }

/* Stepper */
.crm-stepper { display: flex; align-items: center; gap: 8px; }
.crm-step-btn { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border); background: var(--bg-input); color: var(--text); font-size: 16px; cursor: pointer; }
.crm-step-val { font-size: 15px; font-weight: 600; min-width: 40px; text-align: center; }

/* Shots */
.crm-shot-list { display: flex; flex-direction: column; gap: 8px; }
.crm-shot-card {
  display: flex; gap: 10px; padding: 10px;
  background: rgba(0,0,0,0.15); border-radius: 8px;
  border-left: 3px solid var(--primary);
}
.crm-shot-num { font-size: 11px; color: var(--primary); font-weight: 700; min-width: 24px; }
.crm-shot-info { flex: 1; }
.crm-shot-scene { font-size: 13px; color: var(--text); margin-bottom: 2px; }
.crm-shot-meta { font-size: 11px; color: var(--text-dim); }
.crm-shot-dialogue { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

/* Images */
.crm-image-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 8px; }
.crm-image-thumb { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; cursor: pointer; }

/* Player */
.crm-player { margin-top: 12px; }
.crm-disc {
  width: 100px; height: 100px; border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), #6366f1);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 12px;
}
.crm-disc.spinning { animation: spin 4s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.crm-disc-label { font-size: 11px; color: #fff; text-align: center; padding: 4px; }
.crm-player-controls { display: flex; align-items: center; gap: 10px; }
.crm-play-btn { font-size: 24px; background: none; border: none; cursor: pointer; }
.crm-progress { flex: 1; height: 4px; background: var(--bg-input); border-radius: 2px; overflow: hidden; cursor: pointer; }
.crm-progress-fill { height: 100%; background: var(--primary); border-radius: 2px; }
.crm-time { font-size: 11px; color: var(--text-dim); }
.crm-player-actions { display: flex; gap: 8px; margin-top: 8px; justify-content: center; }

/* Lyrics */
.crm-lyrics-text { font-size: 13px; line-height: 1.8; color: var(--text-muted); white-space: pre-wrap; }

/* History */
.crm-history-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); }
.crm-history-info { font-size: 12px; color: var(--text-dim); }

/* Tabbar */
.crm-tabbar {
  position: fixed; bottom: 0; left: 0; right: 0;
  height: calc(var(--tabbar-h) + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  display: flex; background: rgba(15,15,19,0.95);
  backdrop-filter: blur(12px); border-top: 1px solid var(--border);
  z-index: 100;
}
.crm-tab {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer; padding: 4px 0;
  color: var(--text-dim); transition: all 0.15s;
}
.crm-tab.active { color: var(--primary); }
.crm-tab-icon { font-size: 20px; line-height: 1; }
.crm-tab-label { font-size: 10px; margin-top: 2px; }

/* Overlay */
.crm-overlay { position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; }
</style>
