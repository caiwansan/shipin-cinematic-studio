<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const projectId = computed(() => route.params.id as string)
const project = ref<any>(null)
const loading = ref(true)
const activeNav = ref('upload')
const showModelSettingsModal = ref(false)

// ─── 左栏导航 ───
const navItems = [
  { key: 'upload', label: '上传产品图', icon: '📤' },
  { key: 'analysis', label: '产品分析', icon: '🔍' },
  { key: 'prompts', label: 'Prompt 预览', icon: '📝' },
  { key: 'gallery', label: '图片生成', icon: '🖼️' },
]

// ─── 上传面板 ───
const dragged = ref(false)
const uploading = ref(false)
const productImageUrl = ref('')
const productImages = ref<any[]>([])

function onDragOver(e: DragEvent) {
  e.preventDefault()
  dragged.value = true
}

function onDragLeave() {
  dragged.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dragged.value = false
  const files = e.dataTransfer?.files
  if (files?.length) uploadFile(files[0])
}

function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) uploadFile(input.files[0])
}

async function uploadFile(file: File) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) {
    alert('只支持 JPG/PNG/WebP/GIF 格式')
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    alert('文件大小不能超过 10MB')
    return
  }

  uploading.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`/api/ecom/projects/${projectId.value}/upload-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })

    if (res.ok) {
      const data = await res.json()
      productImageUrl.value = data.data.url
      await loadProjectImages()
    } else {
      const err = await res.json()
      alert(err.error || '上传失败')
    }
  } catch (e: any) {
    alert(`上传失败: ${e.message}`)
  } finally {
    uploading.value = false
  }
}

async function loadProjectImages() {
  try {
    const token = localStorage.getItem('auth_token')
    const res = await fetch(`/api/ecom/projects/${projectId.value}/images`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      productImages.value = data.data || []
      if (data.data?.length) {
        const latest = data.data[data.data.length - 1]
        productImageUrl.value = latest.url
      }
    }
  } catch (e) {
    console.error(e)
  }
}

// ─── 保存项目 ───
const saving = ref(false)
const saveSuccess = ref(false)

async function saveProject() {
  saving.value = true
  saveSuccess.value = false
  try {
    const token = localStorage.getItem('auth_token')
    const res = await fetch(`/api/ecom/projects/${projectId.value}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        skuName: project.value.skuName,
        category: project.value.category,
        style: project.value.style,
        language: project.value.language,
        modelAttrs: project.value.modelAttrs,
        modelScene: project.value.modelScene,
        shootingStyle: project.value.shootingStyle,
        faceVisible: project.value.faceVisible,
      }),
    })
    if (res.ok) {
      saveSuccess.value = true
      setTimeout(() => { saveSuccess.value = false }, 2000)
    }
  } catch (e) {
    console.error(e)
  } finally {
    saving.value = false
  }
}

function onAnalysisDone(data: any) {
  if (project.value) {
    project.value.promptJson = data
    project.value.status = 'prompts'
  }
}

function goToPrompts() {
  activeNav.value = 'prompts'
}

function goToGenerate() {
  activeNav.value = 'gallery'
}

function onImagesUpdated() {
  // refresh
}

// ─── 会员信息 ───
const planInfo = ref<any>(null)
const credits = ref(0)

const avatarChar = computed(() => {
  if (planInfo.value?.email) return planInfo.value.email.charAt(0).toUpperCase()
  return 'U'
})

const planClass = computed(() => {
  if (!planInfo.value) return 'free'
  return (planInfo.value.membership?.tier || planInfo.value.memberTier || 'free').toLowerCase()
})

const formattedExpiry = computed(() => {
  if (!planInfo.value?.expiresAt) return '永久'
  return new Date(planInfo.value.expiresAt).toLocaleDateString('zh-CN')
})

const vipInfo = computed(() => {
  const tier = planClass.value
  const map: Record<string, any> = {
    gold: { label: '黄金会员', icon: '🥇', color: '#FFD700', gradient: 'linear-gradient(135deg, #1a1f2e, #2a2030)', glowColor: 'rgba(255, 215, 0, 0.15)' },
    pro: { label: 'PRO 会员', icon: '💎', color: '#A78BFA', gradient: 'linear-gradient(135deg, #1a1f2e, #1a1f3e)', glowColor: 'rgba(167, 139, 250, 0.15)' },
    director: { label: '导演卡', icon: '🎬', color: '#60A5FA', gradient: 'linear-gradient(135deg, #1a1f2e, #101a2e)', glowColor: 'rgba(96, 165, 250, 0.15)' },
    enterprise: { label: '企业版', icon: '🏢', color: '#34D399', gradient: 'linear-gradient(135deg, #1a1f2e, #101f1e)', glowColor: 'rgba(52, 211, 153, 0.15)' },
  }
  return map[tier]
})

const vipCardStyle = computed(() => {
  if (planClass.value === 'free') {
    return { background: 'linear-gradient(135deg, #1a1f2e, #11151c)', border: '1px solid #1f2937' }
  }
  return { background: vipInfo.value?.gradient, borderColor: '#2a2f3e' }
})

async function loadProject() {
  loading.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const res = await fetch(`/api/ecom/projects/${projectId.value}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      project.value = data.data
      await loadProjectImages()
    } else {
      router.push('/workspace/ecom-image/projects')
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadPlanInfo() {
  try {
    const token = localStorage.getItem('auth_token')
    if (!token) return
    const res = await fetch('/api/member/profile', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      planInfo.value = data
      credits.value = data.membership?.credits ?? data.remainingCredits ?? 0
    }
  } catch (e) {
    console.error(e)
  }
}

function handleCardClick() {
  if (!planInfo.value) {
    window.location.href = '/login'
    return
  }
  if (planClass.value === 'free') {
    window.location.href = '/user/membership'
  } else {
    window.location.href = '/user/center'
  }
}

onMounted(() => {
  loadProject()
  loadPlanInfo()
})
</script>

<template>
  <div class="ecom-layout">
    <!-- 左栏 -->
    <aside class="ecom-sidebar">
      <!-- Logo + 返回首页 -->
      <div class="brand-top">
        <NuxtLink to="/" class="btn-back-home" title="返回首页">🏠</NuxtLink>
        <NuxtLink to="/workspace/ecom-image/projects" class="brand-link">
          <img src="/kunlun-mirror.svg" class="brand-icon" alt="" />
          <span class="brand-name">电商图片</span>
        </NuxtLink>
      </div>

      <!-- 导航 -->
      <div class="nav-list">
        <div
          v-for="item in navItems"
          :key="item.key"
          class="nav-item"
          :class="{ active: activeNav === item.key }"
          @click="activeNav = item.key"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
        </div>
      </div>

      <!-- 底部功能卡片 -->
      <div class="sidebar-footer">
        <!-- 会员卡片 -->
        <div v-if="planInfo" class="vip-card-wrapper" @click="handleCardClick">
          <div class="vip-card" :style="vipCardStyle">
            <div class="vip-card-content">
              <div class="vip-card-left">
                <div
                  class="vip-card-avatar"
                  :style="{ background: vipInfo?.gradient || 'linear-gradient(135deg, #2a2f3e, #1f2937)' }"
                >{{ avatarChar }}</div>
              </div>
              <div class="vip-card-right">
                <div class="vip-card-top">
                  <span class="vip-card-tier-icon">{{ vipInfo?.icon || '🆓' }}</span>
                  <span class="vip-card-tier-name" :style="{ color: vipInfo?.color || '#9ca3af' }">
                    {{ vipInfo?.label || '免费用户' }}
                  </span>
                </div>
                <div class="vip-card-coins">
                  <span class="vip-coins-icon">🪙</span>
                  <span class="vip-coins-num">{{ credits }}</span>
                  <span class="vip-coins-unit">积分</span>
                </div>
                <div class="vip-card-expiry">
                  <span class="vip-expiry-label">到期日:</span>
                  <span class="vip-expiry-date">{{ formattedExpiry }}</span>
                </div>
                <template v-if="planClass === 'free'">
                  <button class="vip-card-upgrade" @click.stop="handleCardClick">升级 VIP</button>
                </template>
                <template v-else>
                  <div class="vip-card-entrance" @click.stop="handleCardClick">
                    <span class="vip-entrance-text">进入个人中心 →</span>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="vip-card-wrapper" @click="window.location.href='/login'">
          <div class="vip-card guest">
            <div class="vip-card-content">
              <div class="vip-card-left">
                <div class="vip-card-avatar guest-avatar">👤</div>
              </div>
              <div class="vip-card-right">
                <div class="vip-card-top">
                  <span class="vip-card-tier-name">未登录</span>
                </div>
                <div class="vip-card-sub">点击登录 / 注册</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 大模型设置 -->
        <div class="model-config-card" @click="showModelSettingsModal = true">
          <div class="model-config-icon">🤖</div>
          <div class="model-config-text">
            <span class="model-config-title">大模型设置</span>
            <span class="model-config-desc">API Key &amp; 模型偏好</span>
          </div>
          <span class="model-config-arrow">⚙</span>
        </div>

        <!-- 桌面版 -->
        <a class="model-config-card" href="/user/download" target="_blank" style="text-decoration: none; display: flex;">
          <div class="model-config-icon">💻</div>
          <div class="model-config-text">
            <span class="model-config-title">桌面版</span>
            <span class="model-config-desc">高速更流畅</span>
          </div>
          <span class="model-config-arrow">📥</span>
        </a>
      </div>
    </aside>

    <!-- 右栏 -->
    <main class="ecom-main">
      <div v-if="loading" class="ecom-loading">加载项目中...</div>
      <div v-else-if="!project" class="ecom-loading">项目不存在</div>
      <template v-else>
        <!-- ═══════ 上传面板 ═══════ -->
        <div v-if="activeNav === 'upload'" class="ecom-panel">
          <div class="panel-header">
            <h2>📤 上传产品图</h2>
            <button class="btn-save" :disabled="saving" @click="saveProject">
              {{ saving ? '保存中...' : saveSuccess ? '✅ 已保存' : '💾 保存' }}
            </button>
          </div>
          <p class="panel-desc">上传产品主图，填写基础信息。提交后 AI 将自动分析产品视觉特征</p>

          <div
            class="upload-zone"
            :class="{ dragged, uploaded: !!productImageUrl }"
            @dragover="onDragOver"
            @dragleave="onDragLeave"
            @drop="onDrop"
            @click="!productImageUrl && $refs.fileInput?.click()"
          >
            <template v-if="uploading">
              <div class="upload-spinner"></div>
              <p>上传中...</p>
            </template>
            <template v-else-if="productImageUrl">
              <img :src="productImageUrl" class="upload-preview" alt="产品图" />
              <p class="upload-change" @click.stop="$refs.fileInput?.click()">点击更换图片</p>
            </template>
            <template v-else>
              <div class="upload-icon">📸</div>
              <p>拖拽图片到此处，或点击上传</p>
              <p class="upload-hint">支持 JPG / PNG / WebP，建议尺寸 1024×1024，最大 10MB</p>
            </template>
            <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" style="display: none" @change="onFileSelect" />
          </div>

          <div class="form-group">
            <label>SKU 名称 / 产品名</label>
            <input v-model="project.skuName" placeholder="例如：DDLYQ005 纯棉短袖T恤" class="form-input" />
          </div>

          <div class="form-grid">
            <div class="form-field">
              <label>类目</label>
              <select v-model="project.category" class="form-select">
                <option value="">选择类目</option>
                <optgroup label="女装"><option value="女装/连衣裙">连衣裙</option><option value="女装/上衣">上衣</option><option value="女装/裤装">裤装</option><option value="女装/外套">外套</option></optgroup>
                <optgroup label="男装"><option value="男装/上衣">上衣</option><option value="男装/裤装">裤装</option></optgroup>
                <optgroup label="鞋靴"><option value="鞋靴/运动鞋">运动鞋</option><option value="鞋靴/皮鞋">皮鞋</option></optgroup>
                <optgroup label="包袋配饰"><option value="包袋/手袋">手袋</option><option value="配饰/首饰">首饰</option></optgroup>
                <optgroup label="美妆"><option value="美妆/护肤">护肤</option><option value="美妆/彩妆">彩妆</option><option value="香水">香水</option></optgroup>
                <optgroup label="数码"><option value="数码/手机">手机</option><option value="数码/电脑">电脑</option></optgroup>
                <optgroup label="其他"><option value="食品/零食">零食</option><option value="家居/装饰">家居装饰</option><option value="运动/健身">运动健身</option><option value="母婴/用品">母婴</option></optgroup>
              </select>
            </div>
            <div class="form-field">
              <label>风格</label>
              <select v-model="project.style" class="form-select">
                <option value="">选择风格</option>
                <option value="简约 modern minimal">简约</option><option value="高级 premium luxury">高级</option><option value="清新 fresh natural">清新</option><option value="复古 vintage retro">复古</option><option value="科技 tech">科技</option><option value="温馨 cozy warm">温馨</option><option value="运动 athletic">运动</option><option value="街头 urban street">街头</option><option value="商务 business">商务</option><option value="奢华 luxury">奢华</option>
              </select>
            </div>
            <div class="form-field">
              <label>语言</label>
              <select v-model="project.language" class="form-select">
                <option value="">选择语言</option>
                <option value="中文">中文</option><option value="英文">英文</option><option value="日文">日文</option><option value="韩文">韩文</option><option value="法文">法文</option><option value="西班牙文">西班牙文</option><option value="德文">德文</option><option value="俄文">俄文</option><option value="阿拉伯文">阿拉伯文</option>
              </select>
            </div>
            <div class="form-field">
              <label>模特属性</label>
              <input v-model="project.modelAttrs" placeholder="女, 亚洲, 25-30岁, 白皙肤色" class="form-input" />
            </div>
            <div class="form-field">
              <label>模特场景</label>
              <input v-model="project.modelScene" placeholder="例如：咖啡厅 / 海滩 / 办公室" class="form-input" />
            </div>
            <div class="form-field">
              <label>拍摄风格</label>
              <select v-model="project.shootingStyle" class="form-select">
                <option value="">默认</option>
                <option value="自然光 outdoor natural">户外自然光</option>
                <option value="棚拍 studio">棚拍灯光</option>
                <option value="街拍 street snap">街拍</option>
                <option value="旅拍 travel">旅拍</option>
              </select>
            </div>
            <div class="form-field">
              <label>模特露脸</label>
              <select v-model="project.faceVisible" class="form-select">
                <option value="show">露脸</option><option value="hide">不露脸</option>
              </select>
            </div>
          </div>

          <div class="panel-actions">
            <button class="btn-primary" @click="saveProject">{{ saving ? '保存中...' : '💾 保存配置' }}</button>
            <button v-if="productImageUrl" class="btn-analyze-nav" @click="activeNav = 'analysis'">🔍 去分析产品 →</button>
          </div>
        </div>

        <!-- ═══════ 分析面板 ═══════ -->
        <AnalysisPanel v-if="activeNav === 'analysis'" :project="project" :project-id="projectId" @analysis-done="onAnalysisDone" @go-to-prompts="goToPrompts" />

        <!-- ═══════ Prompt 面板 ═══════ -->
        <PromptsPanel v-if="activeNav === 'prompts'" :project="project" :project-id="projectId" @go-to-generate="goToGenerate" />

        <!-- ═══════ 图片生成面板 ═══════ -->
        <GalleryPanel v-if="activeNav === 'gallery'" :project="project" :project-id="projectId" @images-updated="onImagesUpdated" />
      </template>
    </main>

    <DirectorModelSettingsModal v-if="showModelSettingsModal" :visible="showModelSettingsModal" @close="showModelSettingsModal = false" />
  </div>
</template>

<style scoped>
.ecom-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: #0b0f14;
  color: #f8f6f1;
}
.ecom-sidebar {
  width: 240px;
  flex-shrink: 0;
  background: #11151c;
  border-right: 1px solid #1f2937;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.brand-top {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px 16px 12px;
  border-bottom: 1px solid #1f2937;
}
.brand-link {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
}
.btn-back-home {
  text-decoration: none;
  font-size: 1.1rem;
  color: #9ca3af;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s;
  flex-shrink: 0;
}
.btn-back-home:hover {
  background: #1a1f2e;
  color: #f8f6f1;
}
.brand-icon { width: 24px; height: 24px; }
.brand-name { font-size: 0.95rem; font-weight: 600; color: #f8f6f1; }
.nav-list { flex: 1; padding: 12px 8px; }
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: #9ca3af;
  font-size: 0.85rem;
}
.nav-item:hover { background: #1a1f2e; color: #f8f6f1; }
.nav-item.active { background: rgba(201, 168, 108, 0.12); color: #C9A86C; }
.nav-icon { font-size: 1.1rem; }
.sidebar-footer { padding: 8px; border-top: 1px solid #1f2937; }
.vip-card-wrapper { cursor: pointer; margin-bottom: 8px; }
.vip-card {
  border-radius: 10px;
  padding: 12px;
  position: relative;
  overflow: hidden;
  border: 1px solid #1f2937;
}
.vip-card.guest { background: #11151c; }
.vip-card-content { display: flex; gap: 10px; align-items: flex-start; position: relative; z-index: 1; }
.vip-card-left { flex-shrink: 0; }
.vip-card-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.85rem; font-weight: 600; color: #f8f6f1;
}
.guest-avatar { background: #1f2937; font-size: 1.1rem; }
.vip-card-right { flex: 1; min-width: 0; }
.vip-card-top { display: flex; align-items: center; gap: 4px; margin-bottom: 2px; }
.vip-card-tier-name { font-size: 0.75rem; font-weight: 600; }
.vip-card-coins { display: flex; align-items: center; gap: 3px; font-size: 0.7rem; }
.vip-coins-num { font-weight: 600; color: #f8f6f1; }
.vip-coins-unit { color: #6b7280; }
.vip-card-expiry { font-size: 0.65rem; color: #6b7280; margin-top: 1px; }
.vip-card-upgrade {
  margin-top: 6px; background: linear-gradient(135deg, #C9A86C, #E2C88A);
  color: #08131F; border: none; border-radius: 6px;
  padding: 4px 12px; font-size: 0.7rem; font-weight: 600; cursor: pointer; width: 100%;
}
.vip-card-entrance { margin-top: 4px; font-size: 0.65rem; color: #C9A86C; }
.vip-card-sub { font-size: 0.7rem; color: #6b7280; margin-top: 2px; }
.model-config-card {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: 8px; cursor: pointer; transition: background 0.2s; margin-bottom: 4px;
}
.model-config-card:hover { background: #1a1f2e; }
.model-config-icon { font-size: 1rem; }
.model-config-text { flex: 1; min-width: 0; }
.model-config-title { display: block; font-size: 0.75rem; color: #d1d5db; }
.model-config-desc { display: block; font-size: 0.65rem; color: #6b7280; }
.model-config-arrow { font-size: 0.85rem; color: #6b7280; }
.ecom-main { flex: 1; overflow-y: auto; padding: 32px 40px; }
.ecom-loading {
  display: flex; align-items: center; justify-content: center;
  height: 100%; color: #6b7280; font-size: 0.9rem;
}
.panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.panel-header h2 { font-size: 1.3rem; }
.ecom-panel h2 { font-size: 1.3rem; margin-bottom: 8px; }
.panel-desc { color: #6b7280; font-size: 0.85rem; margin-bottom: 24px; }
.btn-save {
  background: transparent; border: 1px solid #2a2f3e; color: #9ca3af;
  border-radius: 8px; padding: 6px 16px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;
}
.btn-save:hover { border-color: #C9A86C; color: #C9A86C; }
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
.upload-zone {
  border: 2px dashed #2a2f3e; border-radius: 12px; padding: 40px 24px;
  text-align: center; cursor: pointer; transition: all 0.3s;
  margin-bottom: 24px; min-height: 200px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.upload-zone:hover { border-color: #C9A86C; background: rgba(201, 168, 108, 0.04); }
.upload-zone.dragged { border-color: #C9A86C; background: rgba(201, 168, 108, 0.08); }
.upload-zone.uploaded { border-style: solid; border-color: #2a2f3e; padding: 16px; }
.upload-icon { font-size: 2.5rem; margin-bottom: 12px; }
.upload-preview { max-width: 300px; max-height: 250px; border-radius: 8px; object-fit: contain; margin-bottom: 8px; }
.upload-change { font-size: 0.75rem; color: #C9A86C; text-decoration: underline; cursor: pointer; }
.upload-hint { font-size: 0.75rem; color: #4b5563; margin-top: 8px; }
.upload-spinner {
  width: 32px; height: 32px; border: 3px solid #1f2937; border-top-color: #C9A86C;
  border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 0.82rem; color: #9ca3af; margin-bottom: 6px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
.form-field { display: flex; flex-direction: column; gap: 6px; }
.form-field label { font-size: 0.8rem; color: #9ca3af; }
.form-select, .form-input {
  background: #11151c; border: 1px solid #2a2f3e; border-radius: 8px;
  padding: 10px 14px; color: #f8f6f1; font-size: 0.85rem; outline: none; width: 100%; box-sizing: border-box;
}
.form-select:focus, .form-input:focus { border-color: #C9A86C; }
.form-select option { background: #11151c; color: #f8f6f1; }
.panel-actions { display: flex; gap: 12px; align-items: center; margin-top: 8px; }
.btn-primary {
  background: linear-gradient(135deg, #C9A86C, #E2C88A); color: #08131F;
  border: none; border-radius: 8px; padding: 10px 24px;
  font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: box-shadow 0.3s;
}
.btn-primary:hover { box-shadow: 0 4px 16px rgba(201, 168, 108, 0.25); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-analyze-nav {
  background: transparent; border: 1px solid #C9A86C; color: #C9A86C;
  border-radius: 8px; padding: 10px 24px; font-size: 0.9rem; cursor: pointer; transition: all 0.3s;
}
.btn-analyze-nav:hover { background: rgba(201, 168, 108, 0.08); }
</style>
