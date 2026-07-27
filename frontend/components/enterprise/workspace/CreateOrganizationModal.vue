<!-- CreateOrganizationModal — 创建企业弹窗 -->
<!-- BETA-06.1.3: 引导用户填写真正的企业信息 -->
<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
        <div class="modal-card">
          <button class="modal-close" @click="$emit('close')">✕</button>

          <div class="modal-header">
            <div class="modal-icon">🏢</div>
            <h2>创建企业信息</h2>
            <p>填写真实的企业信息，开始使用昆仑镜 AI 新媒体运营部门</p>
          </div>

          <form @submit.prevent="handleSubmit" class="modal-form">
            <div class="form-group">
              <label>企业名称 <span class="required">*</span></label>
              <input
                v-model="form.name"
                type="text"
                placeholder="例：杭州XX科技有限公司"
                class="form-input"
                maxlength="50"
                required
              />
              <span class="form-hint">至少 2 个字符</span>
            </div>

            <div class="form-group">
              <label>所属行业</label>
              <select v-model="form.industry" class="form-input">
                <option value="">请选择</option>
                <option value="科技/互联网">科技 / 互联网</option>
                <option value="电商/零售">电商 / 零售</option>
                <option value="教育/培训">教育 / 培训</option>
                <option value="金融/保险">金融 / 保险</option>
                <option value="医疗/健康">医疗 / 健康</option>
                <option value="制造/工业">制造 / 工业</option>
                <option value="文化/传媒">文化 / 传媒</option>
                <option value="其他">其他</option>
              </select>
            </div>

            <div class="form-group">
              <label>企业规模</label>
              <select v-model="form.size" class="form-input">
                <option value="">请选择</option>
                <option value="1-10人">1-10 人</option>
                <option value="11-50人">11-50 人</option>
                <option value="51-200人">51-200 人</option>
                <option value="201-500人">201-500 人</option>
                <option value="500人以上">500 人以上</option>
              </select>
            </div>

            <div class="form-group">
              <label>企业简介</label>
              <textarea
                v-model="form.description"
                placeholder="一句话介绍您的企业（可选）"
                class="form-input form-textarea"
                maxlength="200"
                rows="3"
              ></textarea>
            </div>

            <p v-if="error" class="form-error">{{ error }}</p>

            <button
              type="submit"
              class="btn btn-primary btn-full"
              :disabled="loading || !form.name || form.name.trim().length < 2"
            >
              {{ loading ? '创建中...' : '创建企业' }}
            </button>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  created: [data: { name: string; industry: string; size: string; description: string }]
}>()

const loading = ref(false)
const error = ref('')

const form = reactive({
  name: '',
  industry: '',
  size: '',
  description: '',
})

async function handleSubmit() {
  if (!form.name || form.name.trim().length < 2) {
    error.value = '企业名称至少需要 2 个字符'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('accessToken') || ''
    const res = await fetch('/api/identity/organization', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        name: form.name.trim(),
        industry: form.industry,
        size: form.size,
        description: form.description.trim(),
      }),
    })

    const json = await res.json()
    if (json.success && json.data) {
      emit('created', {
        name: json.data.organizationName,
        industry: form.industry,
        size: form.size,
        description: form.description.trim(),
      })
      // Reset form
      form.name = ''
      form.industry = ''
      form.size = ''
      form.description = ''
    } else {
      error.value = json.message || '创建失败，请重试'
    }
  } catch (e: any) {
    error.value = '网络错误，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-card {
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 32px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.modal-close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.modal-header {
  text-align: center;
  margin-bottom: 24px;
}

.modal-icon {
  font-size: 2.5rem;
  margin-bottom: 8px;
}

.modal-header h2 {
  font-size: 1.3rem;
  font-weight: 600;
  color: #fff;
  margin: 0 0 8px;
}

.modal-header p {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
}

.required {
  color: #ef4444;
}

.form-input {
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
}

.form-input:focus {
  border-color: rgba(201, 168, 108, 0.5);
}

.form-textarea {
  resize: none;
  font-family: inherit;
}

.form-hint {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.3);
}

.form-error {
  font-size: 0.8rem;
  color: #ef4444;
  margin: 0;
  text-align: center;
}

.btn {
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 20px;
  font-family: inherit;
}

.btn-primary {
  background: linear-gradient(135deg, #C9A86C, #E2C88A);
  color: #08131F;
  font-weight: 600;
}

.btn-primary:hover {
  box-shadow: 0 4px 16px rgba(201, 168, 108, 0.25);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-full {
  width: 100%;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
