<template>
  <Teleport to="body">
    <div class="brand-modal__overlay" @click.self="handleOverlayClick">
      <div class="brand-modal__dialog" role="dialog" aria-modal="true">
        <div class="brand-modal__header">
          <h3 class="brand-modal__title">{{ isEdit ? '完善品牌资料' : '创建品牌项目' }}</h3>
          <button class="brand-modal__close-btn" @click="handleCancel" aria-label="关闭">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <p class="brand-modal__desc">
          {{ isEdit ? '更新品牌信息以完善您的 Brand Profile' : '建立品牌的数字身份，开启 GEO 优化之旅' }}
        </p>

        <form class="brand-modal__form" @submit.prevent="handleSubmit">
          <!-- 品牌名称 -->
          <div class="brand-modal__field">
            <label class="brand-modal__label">
              品牌名称 <span class="brand-modal__required">*</span>
            </label>
            <input
              v-model="form.name"
              type="text"
              class="brand-modal__input"
              :class="{ 'brand-modal__input--error': errors.name }"
              placeholder="例如：昆仑镜AI"
              @input="errors.name = ''"
            />
            <span v-if="errors.name" class="brand-modal__error-text">{{ errors.name }}</span>
          </div>

          <!-- 官网 URL -->
          <div class="brand-modal__field">
            <label class="brand-modal__label">
              官网 URL <span class="brand-modal__required">*</span>
            </label>
            <input
              v-model="form.website"
              type="url"
              class="brand-modal__input"
              :class="{ 'brand-modal__input--error': errors.website }"
              placeholder="https://example.com"
              @input="errors.website = ''"
            />
            <span v-if="errors.website" class="brand-modal__error-text">{{ errors.website }}</span>
          </div>

          <!-- 行业 -->
          <div class="brand-modal__field">
            <label class="brand-modal__label">
              行业 <span class="brand-modal__required">*</span>
            </label>
            <select
              v-model="form.industry"
              class="brand-modal__input brand-modal__select"
              :class="{ 'brand-modal__input--error': errors.industry }"
              @change="errors.industry = ''"
            >
              <option value="" disabled>请选择行业</option>
              <option v-for="option in industryOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <span v-if="errors.industry" class="brand-modal__error-text">{{ errors.industry }}</span>
          </div>

          <!-- 品牌描述 -->
          <div class="brand-modal__field">
            <label class="brand-modal__label">
              品牌描述 <span class="brand-modal__optional">（可选）</span>
            </label>
            <textarea
              v-model="form.description"
              class="brand-modal__input brand-modal__textarea"
              placeholder="简要描述品牌定位、核心产品或服务..."
              rows="3"
            />
          </div>

          <div class="brand-modal__actions">
            <button
              type="button"
              class="brand-modal__btn brand-modal__btn--secondary"
              :disabled="submitting"
              @click="handleCancel"
            >
              取消
            </button>
            <button
              type="submit"
              class="brand-modal__btn brand-modal__btn--primary"
              :disabled="submitting"
            >
              <span v-if="submitting" class="brand-modal__spinner" />
              {{ submitting ? '创建中...' : (isEdit ? '保存' : '创建品牌') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useGeoProjectStore } from '../stores/useGeoProjectStore'

interface Props {
  project?: {
    id: string
    name: string
    website?: string
    industry?: string
    description?: string
  } | null
}

const props = withDefaults(defineProps<Props>(), {
  project: null,
})

const emit = defineEmits<{
  created: [projectId: string]
  cancelled: []
}>()

const projectStore = useGeoProjectStore()

const isEdit = computed(() => !!props.project)

const form = reactive({
  name: '',
  website: '',
  industry: '',
  description: '',
})

const errors = reactive({
  name: '',
  website: '',
  industry: '',
})

const submitting = ref(false)

const industryOptions = [
  { value: 'technology', label: '科技 / 互联网' },
  { value: 'finance', label: '金融 / 保险' },
  { value: 'healthcare', label: '医疗 / 健康' },
  { value: 'education', label: '教育 / 培训' },
  { value: 'ecommerce', label: '电商 / 零售' },
  { value: 'media', label: '媒体 / 娱乐' },
  { value: 'manufacturing', label: '制造业' },
  { value: 'energy', label: '能源 / 环保' },
  { value: 'realestate', label: '房地产 / 建筑' },
  { value: 'transportation', label: '交通 / 物流' },
  { value: 'legal', label: '法律 / 咨询' },
  { value: 'other', label: '其他' },
]

function validateURL(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function validate(): boolean {
  let valid = true

  if (!form.name.trim()) {
    errors.name = '请输入品牌名称'
    valid = false
  }

  if (!form.website.trim()) {
    errors.website = '请输入官网 URL'
    valid = false
  } else if (!validateURL(form.website.trim())) {
    errors.website = '请输入有效的 URL（以 http:// 或 https:// 开头）'
    valid = false
  }

  if (!form.industry) {
    errors.industry = '请选择行业'
    valid = false
  }

  return valid
}

async function handleSubmit() {
  if (!validate()) return

  submitting.value = true

  try {
    if (isEdit.value && props.project) {
      // 编辑模式：更新已有项目
      await projectStore.updateProject(
        props.project.id,
        form.name.trim(),
        form.industry,
        {
          website: form.website.trim(),
          description: form.description.trim(),
          region: '',
          companyType: '',
          primaryLanguage: 'zh',
        }
      )
      emit('created', props.project.id)
    } else {
      // 创建模式：新建项目
      const project = await projectStore.createProject(
        form.name.trim(),
        form.industry,
        {
          website: form.website.trim(),
          description: form.description.trim(),
          region: '',
          companyType: '',
          primaryLanguage: 'zh',
        }
      )

      if (project) {
        emit('created', project.id)
      }
    }
  } catch (err: any) {
    errors.name = err?.message || (isEdit.value ? '更新失败，请重试' : '创建失败，请重试')
  } finally {
    submitting.value = false
  }
}

// Expose handleSubmit for parent components to call programmatically
defineExpose({ handleSubmit })

function handleCancel() {
  emit('cancelled')
}

function handleOverlayClick() {
  // Allow clicking overlay to close only if not submitting
  if (!submitting.value) {
    handleCancel()
  }
}

// Initialize form with project data if editing
onMounted(() => {
  if (props.project) {
    form.name = props.project.name || ''
    form.website = props.project.website || ''
    form.industry = props.project.industry || ''
    form.description = props.project.description || ''
  }
})
</script>

<style scoped>
.brand-modal__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(2px);
}

.brand-modal__dialog {
  background: #fff;
  border-radius: 16px;
  padding: 28px 32px 24px;
  width: 480px;
  max-width: 92vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  animation: modalSlideIn 0.2s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.brand-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.brand-modal__title {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.brand-modal__close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #9ca3af;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.brand-modal__close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.brand-modal__desc {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 24px;
}

.brand-modal__form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.brand-modal__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.brand-modal__label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.brand-modal__required {
  color: #ef4444;
}

.brand-modal__optional {
  color: #9ca3af;
  font-weight: 400;
}

.brand-modal__input {
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 15px;
  color: #111827;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  font-family: inherit;
}

.brand-modal__input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.brand-modal__input--error {
  border-color: #ef4444;
}

.brand-modal__input--error:focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.brand-modal__select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M2 4l4 4 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
  cursor: pointer;
}

.brand-modal__textarea {
  resize: vertical;
  min-height: 72px;
}

.brand-modal__error-text {
  font-size: 12px;
  color: #ef4444;
}

.brand-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.brand-modal__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
  font-family: inherit;
}

.brand-modal__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.brand-modal__btn--primary {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}

.brand-modal__btn--primary:hover:not(:disabled) {
  background: #2563eb;
}

.brand-modal__btn--secondary {
  background: #fff;
  color: #6b7280;
  border-color: #d1d5db;
}

.brand-modal__btn--secondary:hover:not(:disabled) {
  background: #f9fafb;
  color: #374151;
}

.brand-modal__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: brandSpin 0.6s linear infinite;
}

@keyframes brandSpin {
  to { transform: rotate(360deg); }
}
</style>
