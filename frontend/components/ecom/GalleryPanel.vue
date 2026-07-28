<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
// ─── 图片生成面板 ───
// 基于 Stage3 prompt 调 images.edit API 生成图片
// 展示生成的图片网格 + 下载 + 保存到图库

import { ref, watch } from 'vue'

const props = defineProps<{
  project: any
  projectId: string
}>()

const emit = defineEmits<{
  (e: 'images-updated'): void
}>()

const generating = ref(false)
const generatedImages = ref<any[]>([])
const projectStatus = ref('draft')
const promptJson = ref<any>(null)
const previewImage = ref<string | null>(null)
const progress = ref<string>('')

// 模块名称映射
const moduleNames: Record<string, string> = {
  H1: '白底主图', H2: '卖点副图', H3: '模特展示', H4: '场景主图', H5: '多规格卡',
  D1: '品牌故事', D2: '痛点场景', D3: '产品核心', D4: '材质细节',
  D5: '功能展示', D6: '使用步骤', D7: '场景套图', D8: '对比评测', D9: '信任背书',
  M1: '全身正面', M2: '侧面45°', M3: '背面', M4: '近景特写', M5: '场景化',
  product_ref: '产品参考图', lookbook_ref: '三面参考图',
}

// 已生成图按模块排序
const sortedImages = ref<any[]>([])

watch(() => props.project, async (p) => {
  if (p?.promptJson) {
    promptJson.value = p.promptJson
  }
  if (p?.id) {
    await loadGeneratedImages()
  }
  projectStatus.value = p?.status || 'draft'
}, { immediate: true })

async function loadGeneratedImages() {
  try {
    const token = getAuthToken()
    const res = await fetch(`/api/ecom/projects/${props.projectId}/generated-images`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      generatedImages.value = data.data.images || []
      projectStatus.value = data.data.status
      promptJson.value = data.data.promptJson || promptJson.value
      sortImages()
    }
  } catch (e) {
    console.error(e)
  }
}

function sortImages() {
  const moduleOrder = ['product_ref','lookbook_ref','H1','H2','H3','H4','H5','D1','D2','D3','D4','D5','D6','D7','D8','D9','M1','M2','M3','M4','M5']
  sortedImages.value = [...generatedImages.value].sort((a, b) => {
    const srcA = (a.source || a.title || '').replace('ecom:', '')
    const srcB = (b.source || b.title || '').replace('ecom:', '')
    const ai = moduleOrder.findIndex(m => srcA.includes(m))
    const bi = moduleOrder.findIndex(m => srcB.includes(m))
    if (ai !== -1 && bi !== -1) return ai - bi
    return 0
  })
}

function getModule(code: string): string {
  // Try to extract from URL filename
  const url = typeof code === 'string' ? code : ''
  for (const [key, name] of Object.entries(moduleNames)) {
    if (url.includes(`/${key}.png`) || url.includes(`_${key}.png`)) {
      return name
    }
  }
  return ''
}

function getGroup(code: string): string {
  if (code.includes('/H') || code.includes('_H')) return '主图'
  if (code.includes('/D') || code.includes('_D')) return '详情图'
  if (code.includes('/M') || code.includes('_M') || code.includes('ref')) return '模特套图'
  return ''
}

async function startGenerate() {
  generating.value = true
  progress.value = '正在调用 AI 生成图片...'
  projectStatus.value = 'generating'
  try {
    const token = getAuthToken()
    const res = await fetch(`/api/ecom/projects/${props.projectId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '生成失败')
    }
    progress.value = '生成完成！'
    await loadGeneratedImages()
  } catch (e: any) {
    progress.value = `❌ ${e.message}`
  } finally {
    generating.value = false
    projectStatus.value = 'done'
  }
}

function togglePreview(url: string) {
  if (previewImage.value === url) {
    previewImage.value = null
  } else {
    previewImage.value = url
  }
}

function downloadImage(url: string, name: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = name || 'ecom-image.png'
  a.click()
}
</script>

<template>
  <div class="gallery-panel">
    <div class="panel-header">
      <div>
        <h2>🖼️ 图片生成</h2>
        <p class="panel-desc">基于 Prompt 调用 images.edit API 生成电商图</p>
      </div>
      <button
        class="btn-generate"
        :disabled="generating || !promptJson"
        @click="startGenerate"
      >
        {{ generating ? '生成中...' : sortedImages.length ? '🔄 重新生成' : '🚀 一键生成全部' }}
      </button>
    </div>

    <!-- 进度 -->
    <div v-if="progress && generating" class="progress-bar">
      <div class="progress-spinner"></div>
      <span>{{ progress }}</span>
    </div>

    <div v-if="progress && !generating && progress.startsWith('❌')" class="error-bar">
      {{ progress }}
    </div>

    <!-- 无提示 -->
    <div v-if="!sortedImages.length && !generating" class="idle-placeholder">
      <div class="idle-icon">🖼️</div>
      <p v-if="!promptJson">请先完成产品分析</p>
      <p v-else>点击「一键生成全部」调用 images.edit API</p>
      <ul v-if="promptJson" class="gen-info">
        <li>14 张图（5 主图 + 9 详情图）+ 参考图</li>
        <li>基于 GPT-Image-2 模型的 images.edit 接口</li>
        <li>产品外观由原始底图自动保留</li>
      </ul>
    </div>

    <!-- 图片列表 -->
    <div v-else class="gallery-grid">
      <div v-for="img in sortedImages" :key="img.id" class="gallery-card" @click="togglePreview(img.url)">
        <div class="img-wrapper">
          <img :src="img.url" :alt="img.title || '电商图'" class="gallery-img" loading="lazy" />
          <div class="img-overlay">
            <button class="overlay-btn" @click.stop="downloadImage(img.url, `${img.title || 'image'}.png`)">⬇ 下载</button>
          </div>
        </div>
        <div class="img-footer">
          <span class="img-title">{{ img.title || '电商图' }}</span>
        </div>
      </div>
    </div>

    <!-- 大图预览 -->
    <div v-if="previewImage" class="preview-overlay" @click="previewImage = null">
      <div class="preview-modal" @click.stop>
        <img :src="previewImage" class="preview-img" />
        <button class="preview-close" @click="previewImage = null">✕</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gallery-panel h2 {
  font-size: 1.3rem;
  margin-bottom: 8px;
}

.panel-desc {
  color: #6b7280;
  font-size: 0.85rem;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.btn-generate {
  background: linear-gradient(135deg, #C9A86C, #E2C88A);
  color: #08131F;
  border: none;
  border-radius: 8px;
  padding: 8px 20px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.btn-generate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.progress-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(201, 168, 108, 0.1);
  border: 1px solid rgba(201, 168, 108, 0.2);
  border-radius: 8px;
  margin-bottom: 16px;
  color: #C9A86C;
  font-size: 0.85rem;
}

.progress-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(201, 168, 108, 0.3);
  border-top-color: #C9A86C;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.error-bar {
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  margin-bottom: 16px;
  color: #ef4444;
  font-size: 0.85rem;
}

.idle-placeholder {
  text-align: center;
  padding: 60px 24px;
  color: #6b7280;
}

.idle-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.gen-info {
  list-style: none;
  padding: 0;
  margin-top: 12px;
  font-size: 0.8rem;
  line-height: 2;
}

.gen-info li::before {
  content: '• ';
  color: #C9A86C;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.gallery-card {
  background: #11151c;
  border: 1px solid #1f2937;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s;
}

.gallery-card:hover {
  border-color: #C9A86C;
}

.img-wrapper {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
}

.gallery-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.gallery-card:hover .gallery-img {
  transform: scale(1.05);
}

.img-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.gallery-card:hover .img-overlay {
  opacity: 1;
}

.overlay-btn {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #f8f6f1;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
}

.overlay-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.img-footer {
  padding: 8px 12px;
}

.img-title {
  font-size: 0.75rem;
  color: #9ca3af;
}

.preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.preview-modal {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
}

.preview-img {
  max-width: 100%;
  max-height: 90vh;
  border-radius: 8px;
}

.preview-close {
  position: absolute;
  top: -40px;
  right: 0;
  background: transparent;
  border: none;
  color: #f8f6f1;
  font-size: 1.5rem;
  cursor: pointer;
}
</style>
