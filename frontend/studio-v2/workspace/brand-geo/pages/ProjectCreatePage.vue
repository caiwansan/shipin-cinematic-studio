<template>
  <div class="geo-project-create">
    <div class="geo-panel-header">
      <h3 class="geo-panel-title">🚀 创建新项目</h3>
      <p class="geo-panel-subtitle">
        填写基本信息创建 Brand GEO 项目。项目是所有品牌数据和资源的根节点。
      </p>
    </div>

    <div v-if="error" class="geo-error-message">{{ error }}</div>

    <form class="geo-form" @submit.prevent="handleSubmit">
      <div class="geo-form-group">
        <label class="geo-form-label">项目名称 *</label>
        <input
          v-model="form.name"
          type="text"
          class="geo-form-input"
          placeholder="例如：某品牌 GEO 优化"
          required
        />
      </div>

      <div class="geo-form-group">
        <label class="geo-form-label">网站 URL</label>
        <input
          v-model="form.website"
          type="url"
          class="geo-form-input"
          placeholder="https://example.com"
        />
      </div>

      <div class="geo-form-row">
        <div class="geo-form-group">
          <label class="geo-form-label">行业</label>
          <input
            v-model="form.industry"
            type="text"
            class="geo-form-input"
            placeholder="如：科技、零售、教育"
          />
        </div>
        <div class="geo-form-group">
          <label class="geo-form-label">语言</label>
          <input
            v-model="form.language"
            type="text"
            class="geo-form-input"
            placeholder="如：zh-CN, en-US"
          />
        </div>
      </div>

      <div class="geo-form-group">
        <label class="geo-form-label">国家/地区</label>
        <input
          v-model="form.country"
          type="text"
          class="geo-form-input"
          placeholder="如：CN, US, JP"
        />
      </div>

      <div class="geo-form-actions">
        <button
          type="submit"
          class="geo-btn geo-btn-primary"
          :disabled="submitting"
        >
          {{ submitting ? '创建中...' : '创建项目' }}
        </button>
        <button
          type="button"
          class="geo-btn geo-btn-secondary"
          @click="$emit('cancel')"
        >
          取消
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useBrandGeoStore } from '~/studio-v2/workspace/brand-geo/stores/useBrandGeoStore'

const emit = defineEmits<{
  created: [projectId: string]
  cancel: []
}>()

const store = useBrandGeoStore()
const submitting = ref(false)
const error = ref('')

const form = reactive({
  name: '',
  website: '',
  industry: '',
  language: '',
  country: '',
})

async function handleSubmit() {
  if (!form.name.trim()) {
    error.value = '项目名称不能为空'
    return
  }
  submitting.value = true
  error.value = ''
  try {
    const id = await store.createV2Project({
      name: form.name.trim(),
      website: form.website.trim() || undefined,
      industry: form.industry.trim() || undefined,
      language: form.language.trim() || undefined,
      country: form.country.trim() || undefined,
    })
    if (id) {
      store.setSelectedV2ProjectId(id)
      store.setStageStatus('create_project', 'completed')
      store.setCurrentStage('edit_brand_profile')
      emit('created', id)
    } else {
      error.value = store.error.value || '创建失败'
    }
  } catch (err: any) {
    error.value = err.message
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.geo-project-create {
  padding: 24px;
  max-width: 640px;
  margin: 0 auto;
}

.geo-panel-header { margin-bottom: 24px; }
.geo-panel-title { font-size: 22px; font-weight: 700; color: #e2e8f0; margin: 0 0 8px; }
.geo-panel-subtitle { font-size: 14px; color: #6b7280; margin: 0; }

.geo-error-message {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 16px;
}

.geo-form { display: flex; flex-direction: column; gap: 16px; }
.geo-form-group { display: flex; flex-direction: column; gap: 6px; }
.geo-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.geo-form-label { font-size: 13px; font-weight: 600; color: #9ca3af; }
.geo-form-input {
  background: #11151c;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 10px 14px;
  color: #e2e8f0;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}
.geo-form-input:focus { border-color: #6366f1; }
.geo-form-input::placeholder { color: #4b5563; }

.geo-form-actions { display: flex; gap: 12px; margin-top: 8px; }
.geo-btn {
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
}
.geo-btn-primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
}
.geo-btn-primary:hover { opacity: 0.9; }
.geo-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.geo-btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  color: #9ca3af;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.geo-btn-secondary:hover { background: rgba(255, 255, 255, 0.1); }
</style>
