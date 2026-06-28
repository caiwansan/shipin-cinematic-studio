<template>
  <div class="geo-brand-profile">
    <div class="geo-panel-header">
      <h3 class="geo-panel-title">🏷️ 品牌档案</h3>
      <p class="geo-panel-subtitle">
        填写品牌基本信息，这些信息将用于后续的网站分析和知识图谱构建。
      </p>
    </div>

    <div v-if="error" class="geo-error-message">{{ error }}</div>

    <form class="geo-form" @submit.prevent="handleSubmit">
      <div class="geo-form-row">
        <div class="geo-form-group">
          <label class="geo-form-label">品牌名称</label>
          <input v-model="form.brandName" type="text" class="geo-form-input" placeholder="品牌名称" />
        </div>
        <div class="geo-form-group">
          <label class="geo-form-label">网站</label>
          <input v-model="form.website" type="url" class="geo-form-input" placeholder="https://" />
        </div>
      </div>

      <div class="geo-form-row">
        <div class="geo-form-group">
          <label class="geo-form-label">公司名称</label>
          <input v-model="form.company" type="text" class="geo-form-input" placeholder="公司全称" />
        </div>
        <div class="geo-form-group">
          <label class="geo-form-label">行业</label>
          <input v-model="form.industry" type="text" class="geo-form-input" placeholder="所属行业" />
        </div>
      </div>

      <div class="geo-form-row">
        <div class="geo-form-group">
          <label class="geo-form-label">主要产品</label>
          <input v-model="form.primaryProducts" type="text" class="geo-form-input" placeholder="产品1, 产品2" />
        </div>
        <div class="geo-form-group">
          <label class="geo-form-label">核心服务</label>
          <input v-model="form.coreServices" type="text" class="geo-form-input" placeholder="服务1, 服务2" />
        </div>
      </div>

      <div class="geo-form-row">
        <div class="geo-form-group">
          <label class="geo-form-label">目标受众</label>
          <input v-model="form.targetAudience" type="text" class="geo-form-input" placeholder="如：中小企业主" />
        </div>
        <div class="geo-form-group">
          <label class="geo-form-label">目标区域</label>
          <input v-model="form.targetRegions" type="text" class="geo-form-input" placeholder="如：中国大陆、东南亚" />
        </div>
      </div>

      <div class="geo-form-row">
        <div class="geo-form-group">
          <label class="geo-form-label">主要语言</label>
          <input v-model="form.primaryLanguage" type="text" class="geo-form-input" placeholder="zh-CN" />
        </div>
        <div class="geo-form-group">
          <label class="geo-form-label">关键词（逗号分隔）</label>
          <input v-model="form.keywords" type="text" class="geo-form-input" placeholder="关键词1, 关键词2" />
        </div>
      </div>

      <div class="geo-form-group">
        <label class="geo-form-label">竞品（逗号分隔）</label>
        <input v-model="form.competitors" type="text" class="geo-form-input" placeholder="竞品A, 竞品B" />
      </div>

      <div class="geo-form-group">
        <label class="geo-form-label">品牌描述</label>
        <textarea v-model="form.brandDesc" class="geo-form-textarea" rows="3" placeholder="品牌简介..."></textarea>
      </div>

      <div class="geo-form-group">
        <label class="geo-form-label">社交媒体链接（逗号分隔）</label>
        <input v-model="form.socialLinks" type="text" class="geo-form-input" placeholder="https://weibo.com/xxx, https://twitter.com/xxx" />
      </div>

      <div class="geo-form-actions">
        <button type="submit" class="geo-btn geo-btn-primary" :disabled="submitting">
          {{ submitting ? '保存中...' : '保存品牌档案' }}
        </button>
        <button type="button" class="geo-btn geo-btn-secondary" @click="handleSkip">
          跳过此步
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useBrandGeoStore } from '~/studio-v2/workspace/brand-geo/stores/useBrandGeoStore'

const props = defineProps<{
  projectId: string
}>()

const emit = defineEmits<{
  saved: []
  skipped: []
}>()

const store = useBrandGeoStore()
const submitting = ref(false)
const error = ref('')

const form = reactive({
  brandName: '',
  website: '',
  company: '',
  industry: '',
  primaryProducts: '',
  coreServices: '',
  targetAudience: '',
  targetRegions: '',
  primaryLanguage: '',
  competitors: '',
  keywords: '',
  brandDesc: '',
  socialLinks: '',
})

// Load existing profile
watch(() => props.projectId, async (id) => {
  if (!id) return
  const profile = await store.fetchBrandProfile(id)
  if (profile) {
    form.brandName = profile.brandName || ''
    form.website = profile.website || ''
    form.company = profile.company || ''
    form.industry = profile.industry || ''
    form.primaryProducts = profile.primaryProducts || ''
    form.coreServices = profile.coreServices || ''
    form.targetAudience = profile.targetAudience || ''
    form.targetRegions = profile.targetRegions || ''
    form.primaryLanguage = profile.primaryLanguage || ''
    form.competitors = profile.competitors || ''
    form.keywords = profile.keywords || ''
    form.brandDesc = profile.brandDesc || ''
    form.socialLinks = profile.socialLinks || ''
  }
}, { immediate: true })

async function handleSubmit() {
  submitting.value = true
  error.value = ''
  try {
    const result = await store.saveBrandProfile(props.projectId, {
      brandName: form.brandName || undefined,
      website: form.website || undefined,
      company: form.company || undefined,
      industry: form.industry || undefined,
      primaryProducts: form.primaryProducts || undefined,
      coreServices: form.coreServices || undefined,
      targetAudience: form.targetAudience || undefined,
      targetRegions: form.targetRegions || undefined,
      primaryLanguage: form.primaryLanguage || undefined,
      competitors: form.competitors || undefined,
      keywords: form.keywords || undefined,
      brandDesc: form.brandDesc || undefined,
      socialLinks: form.socialLinks || undefined,
    })
    if (result) {
      store.setStageStatus('edit_brand_profile', 'completed')
      store.setCurrentStage('website_scan')
      emit('saved')
    } else {
      error.value = store.error.value || '保存失败'
    }
  } catch (err: any) {
    error.value = err.message
  } finally {
    submitting.value = false
  }
}

function handleSkip() {
  store.setStageStatus('edit_brand_profile', 'skipped')
  store.setCurrentStage('website_scan')
  emit('skipped')
}
</script>

<style scoped>
.geo-brand-profile { padding: 24px; max-width: 720px; margin: 0 auto; }
.geo-panel-header { margin-bottom: 24px; }
.geo-panel-title { font-size: 22px; font-weight: 700; color: #e2e8f0; margin: 0 0 8px; }
.geo-panel-subtitle { font-size: 14px; color: #6b7280; margin: 0; }
.geo-error-message {
  background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5; padding: 10px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 16px;
}
.geo-form { display: flex; flex-direction: column; gap: 14px; }
.geo-form-group { display: flex; flex-direction: column; gap: 6px; }
.geo-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.geo-form-label { font-size: 13px; font-weight: 600; color: #9ca3af; }
.geo-form-input, .geo-form-textarea {
  background: #11151c; border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px; padding: 10px 14px; color: #e2e8f0; font-size: 14px;
  outline: none; transition: border-color 0.15s;
}
.geo-form-textarea { resize: vertical; font-family: inherit; }
.geo-form-input:focus, .geo-form-textarea:focus { border-color: #6366f1; }
.geo-form-input::placeholder, .geo-form-textarea::placeholder { color: #4b5563; }
.geo-form-actions { display: flex; gap: 12px; margin-top: 8px; }
.geo-btn {
  padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;
  cursor: pointer; border: none; transition: all 0.15s;
}
.geo-btn-primary { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; }
.geo-btn-primary:hover { opacity: 0.9; }
.geo-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.geo-btn-secondary {
  background: rgba(255, 255, 255, 0.05); color: #9ca3af; border: 1px solid rgba(255, 255, 255, 0.08);
}
.geo-btn-secondary:hover { background: rgba(255, 255, 255, 0.1); }
</style>
