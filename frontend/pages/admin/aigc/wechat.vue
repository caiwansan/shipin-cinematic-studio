<template>
  <div>
    <div class="mb-6">
      <h1 class="text-lg font-semibold text-white">微信扫码登录配置</h1>
      <p class="text-xs text-gray-500 mt-1">配置微信开放平台的扫码登录，用户可在登录页使用微信扫码登录</p>
    </div>

    <div class="bg-[#0D1328] rounded-xl border border-[#1A2240] p-6 max-w-2xl">
      <div class="space-y-5">
        <div class="form-group">
          <label class="block text-xs text-gray-400 mb-1.5">AppID</label>
          <input v-model="form.appId" type="text" placeholder="微信开放平台 AppID" class="form-input" />
        </div>

        <div class="form-group">
          <label class="block text-xs text-gray-400 mb-1.5">AppSecret</label>
          <div class="flex gap-2">
            <input v-model="appSecretDisplay" type="password" placeholder="微信开放平台 AppSecret" class="form-input flex-1" />
            <button @click="toggleAppSecretEdit" class="px-3 py-1.5 text-[10px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-lg hover:bg-indigo-500/20 transition-all whitespace-nowrap cursor-pointer">
              {{ appSecretEditing ? '取消' : '编辑' }}
            </button>
          </div>
          <p class="text-[10px] text-gray-600 mt-1" v-if="!appSecretEditing && form.appSecret">当前值以掩码显示，点击「编辑」可修改</p>
        </div>

        <div class="form-group">
          <label class="block text-xs text-gray-400 mb-1.5">回调地址</label>
          <input v-model="form.redirectUri" type="text" placeholder="https://aigc.fushtn.com/api/auth/wechat/callback" class="form-input" />
          <p class="text-[10px] text-gray-600 mt-1">在微信开放平台配置的回调地址，默认 https://aigc.fushtn.com/api/auth/wechat/callback</p>
        </div>

        <div class="form-group flex items-center gap-3">
          <label class="text-xs text-gray-400">启用微信登录</label>
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
        <li>1. 前往 <a href="https://open.weixin.qq.com/" target="_blank" class="text-blue-400 underline">微信开放平台</a> 注册成为开发者</li>
        <li>2. 创建"网站应用"获取 AppID 和 AppSecret</li>
        <li>3. 在开放平台配置授权回调域为：<code class="text-amber-400 bg-[#1a1a28] px-1.5 py-0.5 rounded">aigc.fushtn.com</code></li>
        <li>4. 将 AppID 和 AppSecret 填入上方表单保存</li>
      </ol>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getToken, setToken, clearAuth } from '~/utils/token-cache'
definePageMeta({ layout: 'admin-aigc' })
import { ref, onMounted, watch } from 'vue'

const form = ref({
  appId: '',
  appSecret: '',
  redirectUri: 'https://aigc.fushtn.com/api/auth/wechat/callback',
  enabled: true,
})

// 掩码显示变量
const appSecretDisplay = ref('')
const appSecretEditing = ref(false)

function maskValue(val: string): string {
  if (!val) return ''
  if (val.length <= 4) return '****' + val
  return '****' + val.slice(-4)
}

function toggleAppSecretEdit() {
  appSecretEditing.value = !appSecretEditing.value
  if (appSecretEditing.value) {
    appSecretDisplay.value = form.value.appSecret
  } else {
    appSecretDisplay.value = form.value.appSecret ? maskValue(form.value.appSecret) : ''
  }
}

watch(appSecretDisplay, (val) => {
  if (appSecretEditing.value) {
    form.value.appSecret = val
  }
})

const saving = ref(false)
const saved = ref(false)
const error = ref('')

async function loadConfig() {
  try {
    const res = await fetch('/api/admin/wechat-oauth/config', {
      headers: { Authorization: 'Bearer ' + (getToken() || '') },
    })
    if (!res.ok) throw new Error('加载失败')
    const data = await res.json()
    if (data.data?.config) {
      form.value.appId = data.data.config.appId || ''
      form.value.appSecret = data.data.config.appSecret || ''
      form.value.redirectUri = data.data.config.redirectUri || 'https://aigc.fushtn.com/api/auth/wechat/callback'
      form.value.enabled = data.data.enabled !== false
    } else if (data.config) {
      form.value.appId = data.config.appId || ''
      form.value.appSecret = data.config.appSecret || ''
      form.value.redirectUri = data.config.redirectUri || 'https://aigc.fushtn.com/api/auth/wechat/callback'
      form.value.enabled = data.enabled !== false
    }
    // 设置掩码
    appSecretDisplay.value = form.value.appSecret ? maskValue(form.value.appSecret) : ''
  } catch (e: any) {
    error.value = e.message || '加载配置失败'
  }
}

async function saveConfig() {
  saving.value = true
  saved.value = false
  error.value = ''
  try {
    const res = await fetch('/api/admin/wechat-oauth/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (getToken() || ''),
      },
      body: JSON.stringify(form.value),
    })
    if (!res.ok) throw new Error(await res.text())
    saved.value = true
    // 保存后恢复掩码
    appSecretEditing.value = false
    appSecretDisplay.value = form.value.appSecret ? maskValue(form.value.appSecret) : ''
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
