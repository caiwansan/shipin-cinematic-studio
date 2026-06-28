<template>
  <div class="final-render-workspace">
    <!-- 顶部 -->
    <div class="fr-header">
      <button class="fr-back" @click="goBack">← 返回视频生成</button>
      <h2 class="fr-title">✨ 合成输出</h2>
      <div class="fr-project-name" v-if="projectName">{{ projectName }}</div>
    </div>

    <!-- 主体 -->
    <div class="fr-body">
      <!-- 左栏：视频片段列表 -->
      <section class="fr-left">
        <div class="fr-section-title">🎬 视频片段（{{ videoSegments.length }} 段）</div>
        <div v-if="videoSegments.length === 0" class="fr-placeholder">
          暂无已生成的视频片段。请先在「视频生成」步骤生成视频。
        </div>
        <div v-else class="fr-segment-list">
          <div
            v-for="(seg, idx) in videoSegments"
            :key="seg.id || idx"
            class="fr-segment-card"
            :class="{ selected: selectedIndex === idx }"
            @click="selectedIndex = idx"
          >
            <div class="fr-seg-header">
              <span class="fr-seg-index">#{{ idx + 1 }}</span>
              <span class="fr-seg-title">{{ seg.title || `片段 ${idx + 1}` }}</span>
              <span class="fr-seg-duration">{{ seg.duration || 10 }}s</span>
            </div>
            <div v-if="seg.videoUrl" class="fr-seg-preview">
              <video :src="seg.videoUrl" controls :style="{ width: '100%', borderRadius: '6px', maxHeight: '120px' }"></video>
            </div>
            <div v-else class="fr-seg-empty">暂无视频</div>
          </div>
        </div>
      </section>

      <!-- 右栏：合成控制 -->
      <section class="fr-right">
        <!-- 合成设置 -->
        <div class="fr-params">
          <div class="fr-section-title">⚙️ 合成设置</div>
          <div class="fr-param-row">
            <label>选择片段</label>
            <div class="fr-chip-group">
              <button
                v-for="(seg, idx) in videoSegments"
                :key="idx"
                class="fr-chip"
                :class="{ active: selectedSegments.has(idx) }"
                @click="toggleSegment(idx)"
              >
                #{{ idx + 1 }}
              </button>
            </div>
          </div>
          <div class="fr-param-row">
            <label>输出帧率</label>
            <select v-model="exportFps" class="fr-select">
              <option value="24">24 fps</option>
              <option value="30">30 fps</option>
            </select>
          </div>
        </div>

        <!-- 合成按钮 -->
        <button
          class="fr-compose-btn"
          :disabled="composing || selectedSegments.size < 2"
          @click="startCompose"
        >
          {{ composing ? '⏳ 合成中...' : '🎞️ 合成完整视频' }}
        </button>

        <!-- 合成进度 -->
        <div v-if="composing" class="fr-progress">
          <div class="fr-progress-bar">
            <div class="fr-progress-fill" :style="{ width: composeProgress + '%' }"></div>
          </div>
          <span class="fr-progress-text">{{ composeStatus }}</span>
        </div>

        <!-- 合成结果 -->
        <div v-if="composeResult" class="fr-result">
          <div class="fr-section-title">✅ 合成完成</div>
          <video :src="composeResult.videoUrl" controls :style="{ width: '100%', borderRadius: '8px' }"></video>
          <div class="fr-result-meta">
            <span>时长：{{ composeResult.duration }}s</span>
            <span>帧数：{{ composeResult.totalFrames }}</span>
            <span>模式：{{ composeResult.mode }}</span>
          </div>
          <div class="fr-result-actions">
            <a :href="composeResult.videoUrl" download class="fr-download-btn" target="_blank">
              📥 下载视频
            </a>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useStudioStore } from '~/studio-v2/stores/useStudioStore'

const { state, goToStage, projectId } = useStudioStore()

const projectName = ref('')
const selectedIndex = ref(0)
const selectedSegments = ref<Set<number>>(new Set())
const exportFps = ref('24')
const composing = ref(false)
const composeProgress = ref(0)
const composeStatus = ref('')
const composeResult = ref<null | { videoUrl: string; duration: number; totalFrames: number; mode: string }>(null)

// 从 store 获取有 videoUrl 的 segment
const videoSegments = computed(() => {
  return (state.workspace as any)?.segments?.filter((s: any) => s.videoUrl) || []
})

function goBack() {
  goToStage('video-generation' as any)
}

function toggleSegment(idx: number) {
  const next = new Set(selectedSegments.value)
  if (next.has(idx)) {
    next.delete(idx)
  } else {
    next.add(idx)
  }
  selectedSegments.value = next
}

async function startCompose() {
  const pid = (projectId as any)?.value || ''
  if (!pid) return

  const segs = Array.from(selectedSegments.value).map(idx => {
    const s = videoSegments.value[idx]
    return { id: s.id, videoUrl: s.videoUrl, duration: s.duration || 10 }
  })

  composing.value = true
  composeProgress.value = 10
  composeStatus.value = '准备合成...'

  try {
    const token = (window as any).localStorage?.getItem('auth_token') || ''
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = 'Bearer ' + token

    composeProgress.value = 30
    composeStatus.value = '正在合成视频...'

    const res = await fetch('/api/export/compose-video', {
      method: 'POST',
      headers,
      body: JSON.stringify({ projectId: pid, segments: segs }),
    })

    const json = await res.json()
    if (!json.success) throw new Error(json.error?.message || '合成失败')

    composeProgress.value = 100
    composeStatus.value = '合成完成'
    composeResult.value = json.data
  } catch (err: any) {
    composeStatus.value = `❌ 合成失败: ${err.message}`
    composeProgress.value = 0
  } finally {
    composing.value = false
  }
}

onMounted(() => {
  const pid = (projectId as any)?.value || ''
  if (pid) projectName.value = `项目 ${pid.slice(0, 8)}`

  // 默认全选有 videoUrl 的片段
  const segs = videoSegments.value
  for (let i = 0; i < segs.length; i++) {
    selectedSegments.value.add(i)
  }
})
</script>

<style scoped>
.final-render-workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0a0a12;
  color: #e2e8f0;
  padding: 20px;
  overflow-y: auto;
}

/* 头部 */
.fr-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  flex-shrink: 0;
}
.fr-back {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 8px;
  padding: 6px 14px;
  color: #9ca3af;
  cursor: pointer;
  font-size: 13px;
}
.fr-back:hover { background: rgba(255,255,255,0.10); color: #fff; }
.fr-title { font-size: 18px; font-weight: 700; margin: 0; }
.fr-project-name { font-size: 13px; color: #6b7280; margin-left: auto; }

/* 主体 — 左右两栏 */
.fr-body { display: flex; gap: 20px; flex: 1; min-height: 0; }
.fr-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.fr-right {
  width: 400px;
  min-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 区块标题 */
.fr-section-title {
  font-size: 15px;
  font-weight: 600;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  margin-bottom: 12px;
}

/* 占位 */
.fr-placeholder {
  padding: 40px;
  text-align: center;
  color: #6b7280;
  font-size: 14px;
  background: rgba(255,255,255,0.02);
  border: 1px dashed rgba(255,255,255,0.08);
  border-radius: 10px;
}

/* 片段列表 */
.fr-segment-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  flex: 1;
}
.fr-segment-card {
  padding: 10px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.06);
  cursor: pointer;
  transition: all 0.15s;
  background: rgba(255,255,255,0.02);
}
.fr-segment-card:hover { border-color: rgba(255,255,255,0.12); }
.fr-segment-card.selected { border-color: #10b981; background: rgba(16,185,129,0.05); }
.fr-seg-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.fr-seg-index { font-size: 11px; color: #6b7280; font-weight: 600; }
.fr-seg-title { font-size: 13px; color: #d1d5db; flex: 1; }
.fr-seg-duration { font-size: 11px; color: #6b7280; }
.fr-seg-preview { margin-top: 6px; }
.fr-seg-empty {
  padding: 20px;
  text-align: center;
  color: #4b5563;
  font-size: 12px;
}

/* 参数设置 */
.fr-params {
  padding: 16px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
}
.fr-param-row {
  margin-bottom: 12px;
}
.fr-param-row label {
  display: block;
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 6px;
}
.fr-chip-group { display: flex; gap: 6px; flex-wrap: wrap; }
.fr-chip {
  padding: 4px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.10);
  background: transparent;
  color: #9ca3af;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.fr-chip:hover { border-color: rgba(255,255,255,0.20); }
.fr-chip.active { background: #10b981; color: #fff; border-color: #10b981; }
.fr-select {
  width: 100%;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.04);
  color: #e2e8f0;
  font-size: 13px;
}

/* 合成按钮 */
.fr-compose-btn {
  padding: 12px 20px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #059669, #10b981);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.fr-compose-btn:hover:not(:disabled) { opacity: 0.85; }
.fr-compose-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* 进度 */
.fr-progress { display: flex; flex-direction: column; gap: 6px; }
.fr-progress-bar {
  height: 4px;
  background: rgba(255,255,255,0.08);
  border-radius: 4px;
  overflow: hidden;
}
.fr-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #059669, #10b981);
  border-radius: 4px;
  transition: width 0.3s;
}
.fr-progress-text { font-size: 12px; color: #6b7280; }

/* 结果 */
.fr-result { padding: 16px; border: 1px solid rgba(16,185,129,0.2); border-radius: 10px; background: rgba(16,185,129,0.03); }
.fr-result-meta {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  font-size: 12px;
  color: #6b7280;
}
.fr-result-actions { margin-top: 12px; text-align: center; }
.fr-download-btn {
  display: inline-block;
  padding: 8px 20px;
  border-radius: 8px;
  background: #059669;
  color: #fff;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}
.fr-download-btn:hover { opacity: 0.85; }
</style>
