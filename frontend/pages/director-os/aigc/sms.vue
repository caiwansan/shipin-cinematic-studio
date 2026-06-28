<template>
  <div>
    <div class="mb-6">
      <h1 class="text-lg font-semibold text-white">短信配置</h1>
      <p class="text-xs text-gray-500 mt-1">配置腾讯云短信服务，用户可在登录页使用手机短信验证码登录</p>
    </div>

    <div class="bg-[#0D1328] rounded-xl border border-[#1A2240] p-6 max-w-2xl">
      <div class="space-y-5">
        <div class="form-group">
          <label class="block text-xs text-gray-400 mb-1.5">SecretId</label>
          <div class="flex gap-2">
            <input v-model="secretIdDisplay" type="password" placeholder="腾讯云 API 密钥 SecretId" class="form-input flex-1" @focus="onSecretIdFocus" @blur="onSecretIdBlur" />
            <button @click="toggleSecretIdEdit" class="px-3 py-1.5 text-[10px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-lg hover:bg-indigo-500/20 transition-all whitespace-nowrap cursor-pointer">
              {{ secretIdEditing ? '取消' : '编辑' }}
            </button>
          </div>
          <p class="text-[10px] text-gray-600 mt-1" v-if="!secretIdEditing && form.SecretId">当前值以掩码显示，点击「编辑」可修改</p>
        </div>

        <div class="form-group">
          <label class="block text-xs text-gray-400 mb-1.5">SecretKey</label>
          <div class="flex gap-2">
            <input v-model="secretKeyDisplay" type="password" placeholder="腾讯云 API 密钥 SecretKey" class="form-input flex-1" @focus="onSecretKeyFocus" @blur="onSecretKeyBlur" />
            <button @click="toggleSecretKeyEdit" class="px-3 py-1.5 text-[10px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-lg hover:bg-indigo-500/20 transition-all whitespace-nowrap cursor-pointer">
              {{ secretKeyEditing ? '取消' : '编辑' }}
            </button>
          </div>
          <p class="text-[10px] text-gray-600 mt-1" v-if="!secretKeyEditing && form.SecretKey">当前值以掩码显示，点击「编辑」可修改</p>
        </div>

        <div class="form-group">
          <label class="block text-xs text-gray-400 mb-1.5">短信应用 SDK AppID</label>
          <input v-model="form.SmsSdkAppId" type="text" placeholder="1400xxxxxx" class="form-input" />
        </div>

        <div class="form-group">
          <label class="block text-xs text-gray-400 mb-1.5">短信模板 ID</label>
          <input v-model="form.TemplateId" type="text" placeholder="短信模板 ID（如 1234567）" class="form-input" />
        </div>

        <div class="form-group">
          <label class="block text-xs text-gray-400 mb-1.5">短信签名</label>
          <input v-model="form.SignName" type="text" placeholder="短信签名（如 昆仑镜）" class="form-input" />
          <p class="text-[10px] text-gray-600 mt-1">短信模板变量：{1}=验证码，{2}=有效分钟数（固定5分钟）</p>
        </div>

        <div class="form-group flex items-center gap-3">
          <label class="text-xs text-gray-400">启用短信登录</label>
          <label class="toggle">
            <input type="checkbox" v-model="form.enabled" />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="flex items-center gap-3 pt-2">
          <button @click="saveConfig" :disabled="saving" class="btn-primary text-xs px-5 py-2 rounded-lg">
            {{ saving ? '保存中...' : '保存配置' }}
          </button>
          <span v-if="saved" class="text-green-500 text-xs">✅ 已保存</span>
          <span v-if="error" class="text-red-500 text-xs">{{ error }}</span>
        </div>
      </div>
    </div>

    <!-- 使用说明 -->
    <div class="bg-[#0D1328] rounded-xl border border-[#1A2240] p-6 max-w-2xl mt-6">
      <h2 class="text-sm font-semibold text-white mb-3">📖 配置步骤</h2>
      <ol class="space-y-2 text-xs text-gray-400 leading-relaxed">
        <li>1. 前往 <a href="https://console.cloud.tencent.com/smsv2" target="_blank" class="text-blue-400 underline">腾讯云短信控制台</a></li>
        <li>2. 创建短信应用，获取 SDK AppID</li>
        <li>3. 申请短信签名和模板，模板变量 {1}=验证码 {2}=有效分钟数</li>
        <li>4. 在 <a href="https://console.cloud.tencent.com/cam/capi" target="_blank" class="text-blue-400 underline">API 密钥管理</a> 获取 SecretId 和 SecretKey</li>
        <li>5. 将以上信息填入上方表单保存</li>
      </ol>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getToken, setToken, clearAuth } from '~/utils/token-cache'
definePageMeta({ layout: 'admin-aigc' })
import { ref, onMounted, watch } from 'vue'

const form = ref({
  SecretId: '',
  SecretKey: '',
  SmsSdkAppId: '',
  TemplateId: '',
  SignName: '',
  enabled: true,
})

// 掩码显示的变量
const secretIdDisplay = ref('')
const secretKeyDisplay = ref('')
const secretIdEditing = ref(false)
const secretKeyEditing = ref(false)

// 生成掩码：**** + 最后4位
function maskValue(val: string): string {
  if (!val) return ''
  if (val.length <= 4) return '****' + val
  return '****' + val.slice(-4)
}

// 切换编辑状态
function toggleSecretIdEdit() {
  secretIdEditing.value = !secretIdEditing.value
  if (secretIdEditing.value) {
    secretIdDisplay.value = form.value.SecretId
  } else {
    // 取消编辑，恢复掩码
    if (form.value.SecretId) {
      secretIdDisplay.value = maskValue(form.value.SecretId)
    } else {
      secretIdDisplay.value = ''
    }
  }
}

function toggleSecretKeyEdit() {
  secretKeyEditing.value = !secretKeyEditing.value
  if (secretKeyEditing.value) {
    secretKeyDisplay.value = form.value.SecretKey
  } else {
    if (form.value.SecretKey) {
      secretKeyDisplay.value = maskValue(form.value.SecretKey)
    } else {
      secretKeyDisplay.value = ''
    }
  }
}

function onSecretIdFocus() {
  if (!secretIdEditing.value && form.value.SecretId) {
    secretIdDisplay.value = maskValue(form.value.SecretId)
  }
}

function onSecretIdBlur() {
  if (!secretIdEditing.value && form.value.SecretId) {
    secretIdDisplay.value = maskValue(form.value.SecretId)
  }
}

function onSecretKeyFocus() {
  if (!secretKeyEditing.value && form.value.SecretKey) {
    secretKeyDisplay.value = maskValue(form.value.SecretKey)
  }
}

function onSecretKeyBlur() {
  if (!secretKeyEditing.value && form.value.SecretKey) {
    secretKeyDisplay.value = maskValue(form.value.SecretKey)
  }
}

// 监听 display 字段的变化，同步回 form
watch(secretIdDisplay, (val) => {
  if (secretIdEditing.value) {
    form.value.SecretId = val
  }
})

watch(secretKeyDisplay, (val) => {
  if (secretKeyEditing.value) {
    form.value.SecretKey = val
  }
})

const saving = ref(false)
const saved = ref(false)
const error = ref('')

async function loadConfig() {
  try {
    const res = await fetch('/api/admin/sms-auth/config', {
      headers: { Authorization: 'Bearer ' + (getToken() || '') },
    })
    if (!res.ok) throw new Error('加载失败')
    const data = await res.json()
    const d = data.data || data
    if (d?.config) {
      form.value.SecretId = d.config.SecretId || ''
      form.value.SecretKey = d.config.SecretKey || ''
      form.value.SmsSdkAppId = d.config.SmsSdkAppId || ''
      form.value.TemplateId = d.config.TemplateId || ''
      form.value.SignName = d.config.SignName || ''
      form.value.enabled = d.enabled !== false
    }
    // 加载完成后设置掩码显示值
    secretIdDisplay.value = form.value.SecretId ? maskValue(form.value.SecretId) : ''
    secretKeyDisplay.value = form.value.SecretKey ? maskValue(form.value.SecretKey) : ''
  } catch (e: any) {
    error.value = e.message || '加载配置失败'
  }
}

async function saveConfig() {
  saving.value = true
  saved.value = false
  error.value = ''
  try {
    // 同步输入框的当前值到 form，确保「编辑」开关不影响保存内容
    form.value.SecretId = secretIdDisplay.value
    form.value.SecretKey = secretKeyDisplay.value

    const res = await fetch('/api/admin/sms-auth/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (getToken() || ''),
      },
      body: JSON.stringify(form.value),
    })
    if (!res.ok) throw new Error(await res.text())
    saved.value = true
    // 保存成功后恢复掩码
    secretIdEditing.value = false
    secretKeyEditing.value = false
    secretIdDisplay.value = form.value.SecretId ? maskValue(form.value.SecretId) : ''
    secretKeyDisplay.value = form.value.SecretKey ? maskValue(form.value.SecretKey) : ''
    setTimeout(() => { saved.value = false }, 3000)
  } catch (e: any) {
    error.value = e.message || '保存失败'
  } finally {
    saving.value = false
  }
}

onMounted(loadConfig)
</script>

<style scoped>
.form-group { margin-bottom: 0; }
.form-input {
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.8);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}
.form-input:focus { border-color: rgba(59,130,246,0.4); }
.btn-primary {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border: none;
  color: white;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.toggle {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  cursor: pointer;
}
.toggle input { display: none; }
.toggle-slider {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #1a1a28;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.1);
  transition: 0.3s;
}
.toggle-slider::before {
  content: '';
  position: absolute;
  width: 14px; height: 14px;
  left: 2px; bottom: 2px;
  background: #555;
  border-radius: 50%;
  transition: 0.3s;
}
.toggle input:checked + .toggle-slider { background: #2563eb; }
.toggle input:checked + .toggle-slider::before { transform: translateX(16px); background: white; }
</style>
