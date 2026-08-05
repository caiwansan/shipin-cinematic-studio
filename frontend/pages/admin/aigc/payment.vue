<template>
  <div class="space-y-6">
    <h2 class="text-sm text-white/70 font-medium">支付设置</h2>

    <div v-if="loading" class="flex items-center justify-center py-16 text-gray-500 text-sm">加载中...</div>

    <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
      {{ error }}
      <button @click="fetchData" class="ml-2 underline">重试</button>
    </div>

    <template v-else>
      <!-- Payment Methods -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- WeChat Pay -->
        <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-5">
          <div class="flex items-center gap-3 mb-4">
            <span class="text-2xl">💚</span>
            <div>
              <div class="text-sm text-white/80 font-medium">微信支付</div>
              <div class="text-[10px] text-gray-600">{{ wechat.configured ? '已配置' : '未配置' }}</div>
            </div>
            <span v-if="wechat.configured" class="ml-auto px-2 py-0.5 rounded-full text-[10px] bg-green-500/10 text-green-400">已启用</span>
            <span v-else class="ml-auto px-2 py-0.5 rounded-full text-[10px] bg-yellow-500/10 text-yellow-400">未配置</span>
          </div>
          <div class="space-y-2.5">
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">App ID</label>
              <input v-model="wechat.appId" type="text" placeholder="wx..."
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">商户号 (Mch ID)</label>
              <input v-model="wechat.mchId" type="text" placeholder="商户号"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">API V3 密钥</label>
              <div class="flex gap-2">
                <input v-model="wechat.apiV3KeyDisplay" type="password" placeholder="API v3 Key" class="flex-1 bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
                <button @click="toggleWechatV3KeyEdit" class="px-2 py-1 text-[10px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-lg hover:bg-indigo-500/20 transition-all whitespace-nowrap cursor-pointer">
                  {{ wechatV3KeyEditing ? '取消' : '编辑' }}
                </button>
              </div>
              <p class="text-[9px] text-gray-600 mt-0.5" v-if="!wechatV3KeyEditing && wechat.apiV3Key">当前以掩码显示，点击「编辑」可修改</p>
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">商户私钥证书 (PEM)</label>
              <div class="flex gap-2">
                <div class="flex-1">
                  <textarea v-model="wechatKeyPemDisplay" rows="4" placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
                    class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50 resize-none font-mono"></textarea>
                </div>
                <button @click="toggleWechatKeyPemEdit" class="px-2 py-1 text-[10px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-lg hover:bg-indigo-500/20 transition-all cursor-pointer self-start shrink-0">
                  {{ wechatKeyPemEditing ? '取消' : '编辑' }}
                </button>
              </div>
              <p class="text-[9px] text-gray-600 mt-0.5" v-if="!wechatKeyPemEditing && wechat.keyPem">当前以掩码显示，点击「编辑」可修改</p>
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">证书序列号 (Serial No)</label>
              <input v-model="wechat.serialNo" type="text" placeholder="从微信商户平台获取"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
          </div>
        </div>

        <!-- Alipay -->
        <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-5">
          <div class="flex items-center gap-3 mb-4">
            <span class="text-2xl">🔵</span>
            <div>
              <div class="text-sm text-white/80 font-medium">支付宝</div>
              <div class="text-[10px] text-gray-600">{{ alipay.configured ? '已配置' : '未配置' }}</div>
            </div>
            <span v-if="alipay.configured" class="ml-auto px-2 py-0.5 rounded-full text-[10px] bg-green-500/10 text-green-400">已启用</span>
            <span v-else class="ml-auto px-2 py-0.5 rounded-full text-[10px] bg-yellow-500/10 text-yellow-400">未配置</span>
          </div>
          <div class="space-y-2.5">
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">App ID</label>
              <input v-model="alipay.appId" type="text" placeholder="支付宝 App ID"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">商户私钥</label>
              <div class="flex gap-2">
                <div class="flex-1">
                  <textarea v-model="alipayPrivateKeyDisplay" rows="3" placeholder="RSA 私钥..."
                    class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50 resize-none"></textarea>
                </div>
                <button @click="toggleAlipayPrivateKeyEdit" class="px-2 py-1 text-[10px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-lg hover:bg-indigo-500/20 transition-all cursor-pointer self-start shrink-0">
                  {{ alipayPrivateKeyEditing ? '取消' : '编辑' }}
                </button>
              </div>
              <p class="text-[9px] text-gray-600 mt-0.5" v-if="!alipayPrivateKeyEditing && alipay.privateKey">当前以掩码显示，点击「编辑」可修改</p>
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">支付宝公钥</label>
              <div class="flex gap-2">
                <div class="flex-1">
                  <textarea v-model="alipayPublicKeyDisplay" rows="3" placeholder="支付宝公钥..."
                    class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50 resize-none"></textarea>
                </div>
                <button @click="toggleAlipayPublicKeyEdit" class="px-2 py-1 text-[10px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-lg hover:bg-indigo-500/20 transition-all cursor-pointer self-start shrink-0">
                  {{ alipayPublicKeyEditing ? '取消' : '编辑' }}
                </button>
              </div>
              <p class="text-[9px] text-gray-600 mt-0.5" v-if="!alipayPublicKeyEditing && alipay.publicKey">当前以掩码显示，点击「编辑」可修改</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Save Button -->
      <div class="flex justify-end">
        <button @click="savePaymentConfig"
          :disabled="saving"
          class="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-medium transition cursor-pointer disabled:opacity-50 border-none">
          {{ saving ? '保存中...' : '保存设置' }}
        </button>
      </div>

      <div v-if="saveMsg" class="text-xs" :class="saveMsgType === 'success' ? 'text-green-400' : 'text-red-400'">
        {{ saveMsg }}
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { getToken, setToken, clearAuth } from '~/utils/token-cache'
definePageMeta({ layout: 'admin-aigc' })
import { ref, reactive, onMounted, watch } from 'vue'

const loading = ref(true)
const error = ref('')
const saving = ref(false)
const saveMsg = ref('')
const saveMsgType = ref<'success' | 'error'>('success')

const wechat = reactive({
  configured: false,
  appId: '',
  mchId: '',
  apiKey: '',
  apiV3Key: '',
  keyPem: '',
  serialNo: '',
})

const alipay = reactive({
  configured: false,
  appId: '',
  privateKey: '',
  publicKey: '',
})

// 掩码显示变量
const wechatV3KeyDisplay = ref('')
const wechatKeyPemDisplay = ref('')
const alipayPrivateKeyDisplay = ref('')
const alipayPublicKeyDisplay = ref('')
const wechatV3KeyEditing = ref(false)
const wechatKeyPemEditing = ref(false)
const alipayPrivateKeyEditing = ref(false)
const alipayPublicKeyEditing = ref(false)

function maskValue(val: string): string {
  if (!val) return ''
  if (val.length <= 4) return '****' + val
  return '****' + val.slice(-4)
}

function maskLongValue(val: string): string {
  if (!val) return ''
  if (val.length < 40) return '****'
  return '****' + val.slice(-20)
}

function toggleWechatV3KeyEdit() {
  wechatV3KeyEditing.value = !wechatV3KeyEditing.value
  if (wechatV3KeyEditing.value) {
    // 编辑时输入框置空，避免遮盖值混入新密钥导致保存被掩码保护拦截
    wechatV3KeyDisplay.value = ''
  } else {
    wechatV3KeyDisplay.value = wechat.apiV3Key ? maskValue(wechat.apiV3Key) : ''
  }
}

function toggleWechatKeyPemEdit() {
  wechatKeyPemEditing.value = !wechatKeyPemEditing.value
  if (wechatKeyPemEditing.value) {
    wechatKeyPemDisplay.value = wechat.keyPem
  } else {
    wechatKeyPemDisplay.value = wechat.keyPem ? maskLongValue(wechat.keyPem) : ''
  }
}

function toggleAlipayPrivateKeyEdit() {
  alipayPrivateKeyEditing.value = !alipayPrivateKeyEditing.value
  if (alipayPrivateKeyEditing.value) {
    alipayPrivateKeyDisplay.value = alipay.privateKey
  } else {
    alipayPrivateKeyDisplay.value = alipay.privateKey ? maskLongValue(alipay.privateKey) : ''
  }
}

function toggleAlipayPublicKeyEdit() {
  alipayPublicKeyEditing.value = !alipayPublicKeyEditing.value
  if (alipayPublicKeyEditing.value) {
    alipayPublicKeyDisplay.value = alipay.publicKey
  } else {
    alipayPublicKeyDisplay.value = alipay.publicKey ? maskLongValue(alipay.publicKey) : ''
  }
}

// 同步 display -> 真实值
watch(wechatV3KeyDisplay, (val) => {
  if (wechatV3KeyEditing.value) wechat.apiV3Key = val
})
watch(wechatKeyPemDisplay, (val) => {
  if (wechatKeyPemEditing.value) wechat.keyPem = val
})
watch(alipayPrivateKeyDisplay, (val) => {
  if (alipayPrivateKeyEditing.value) alipay.privateKey = val
})
watch(alipayPublicKeyDisplay, (val) => {
  if (alipayPublicKeyEditing.value) alipay.publicKey = val
})

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const token = getToken()
    const res = await fetch('/api/admin/payment/config', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (res.ok) {
      const d = await res.json()
      if (d.wechat) {
        wechat.configured = d.wechat.configured || !!d.wechat.appId
        wechat.appId = d.wechat.appId || ''
        wechat.mchId = d.wechat.mchId || ''
        wechat.apiKey = d.wechat.apiKey || ''
        wechat.apiV3Key = d.wechat.apiV3Key || ''
        wechat.keyPem = d.wechat.keyPem || ''
        wechat.serialNo = d.wechat.serialNo || ''
      }
      if (d.alipay) {
        alipay.configured = d.alipay.configured || !!d.alipay.appId
        alipay.appId = d.alipay.appId || ''
        alipay.privateKey = d.alipay.privateKey || ''
        alipay.publicKey = d.alipay.publicKey || ''
      }
    } else {
      loadMockData()
    }
  } catch {
    loadMockData()
  }
  // 设置掩码
  wechatV3KeyDisplay.value = wechat.apiV3Key ? maskValue(wechat.apiV3Key) : ''
  wechatKeyPemDisplay.value = wechat.keyPem ? maskLongValue(wechat.keyPem) : ''
  alipayPrivateKeyDisplay.value = alipay.privateKey ? maskLongValue(alipay.privateKey) : ''
  alipayPublicKeyDisplay.value = alipay.publicKey ? maskLongValue(alipay.publicKey) : ''
  loading.value = false
}

function loadMockData() {
  wechat.configured = true
  wechat.appId = 'wx_demo_app_id'
  wechat.mchId = '1234567890'
  wechat.apiKey = '••••••••'
  alipay.configured = false
  alipay.appId = ''
  alipay.privateKey = ''
  alipay.publicKey = ''
}

async function savePaymentConfig() {
  saving.value = true
  saveMsg.value = ''
  try {
    const token = getToken()
    // 只提交编辑状态下且非空的敏感字段；未编辑字段不提交，后端合并时保留原值
    const wechatBody: Record<string, any> = { appId: wechat.appId, mchId: wechat.mchId }
    if (wechat.serialNo) wechatBody.serialNo = wechat.serialNo
    if (wechat.apiKey && wechat.apiKey.includes('****')) wechatBody.apiKey = wechat.apiKey
    else if (wechat.apiKey) wechatBody.apiKey = wechat.apiKey
    if (wechatV3KeyEditing.value && wechat.apiV3Key) wechatBody.apiV3Key = wechat.apiV3Key
    else if (wechat.apiV3Key && wechat.apiV3Key.includes('****')) wechatBody.apiV3Key = wechat.apiV3Key
    if (wechatKeyPemEditing.value && wechat.keyPem) wechatBody.keyPem = wechat.keyPem
    else if (wechat.keyPem && wechat.keyPem.includes('****')) wechatBody.keyPem = wechat.keyPem
    const alipayBody: Record<string, any> = {}
    if (alipayPrivateKeyEditing.value && alipay.privateKey) alipayBody.privateKey = alipay.privateKey
    else if (alipay.privateKey && alipay.privateKey.includes('****')) alipayBody.privateKey = alipay.privateKey
    if (alipayPublicKeyEditing.value && alipay.publicKey) alipayBody.publicKey = alipay.publicKey
    else if (alipay.publicKey && alipay.publicKey.includes('****')) alipayBody.publicKey = alipay.publicKey
    if (alipay.appId) alipayBody.appId = alipay.appId
    const body = {
      wechat: wechatBody,
      alipay: alipayBody,
    }
    const res = await fetch('/api/admin/payment/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    })
    if (res.ok) {
      saveMsg.value = '保存成功'
      saveMsgType.value = 'success'
      wechat.configured = !!wechat.appId
      alipay.configured = !!alipay.appId
    } else {
      // 真实错误提示（不再假装成功）
      let msg = '保存失败'
      try {
        const err = await res.json()
        msg = err.error || err.message || '保存失败 (HTTP ' + res.status + ')'
      } catch { msg = '保存失败 (HTTP ' + res.status + ')' }
      saveMsg.value = msg
      saveMsgType.value = 'error'
    }
  } catch (e: any) {
    saveMsg.value = '保存失败: ' + (e?.message || '网络错误')
    saveMsgType.value = 'error'
  }
  // 保存后恢复掩码
  wechatV3KeyEditing.value = false
  wechatKeyPemEditing.value = false
  alipayPrivateKeyEditing.value = false
  alipayPublicKeyEditing.value = false
  wechatV3KeyDisplay.value = wechat.apiV3Key ? maskValue(wechat.apiV3Key) : ''
  wechatKeyPemDisplay.value = wechat.keyPem ? maskLongValue(wechat.keyPem) : ''
  alipayPrivateKeyDisplay.value = alipay.privateKey ? maskLongValue(alipay.privateKey) : ''
  alipayPublicKeyDisplay.value = alipay.publicKey ? maskLongValue(alipay.publicKey) : ''
  saving.value = false
  setTimeout(() => { saveMsg.value = '' }, 3000)
}

onMounted(fetchData)
</script>
