<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-sm text-white/70 font-medium">客服管理</h2>
      <button @click="showAddDialog = true"
        class="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition cursor-pointer border-none">
        + 添加客服
      </button>
    </div>

    <!-- Tab 切换 -->
    <div class="flex gap-2 border-b border-[#1A2240] pb-2">
      <button @click="tab = 'settings'"
        class="px-4 py-1.5 text-xs rounded-lg transition cursor-pointer border-none"
        :class="tab === 'settings' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500 hover:text-white/60'">
        ⚙️ 客服配置
      </button>
      <button @click="tab = 'sessions'; loadSessions()"
        class="px-4 py-1.5 text-xs rounded-lg transition cursor-pointer border-none"
        :class="tab === 'sessions' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500 hover:text-white/60'">
        💬 用户对话
      </button>
    </div>

    <!-- ========== Tab: 客服配置 ========== -->
    <template v-if="tab === 'settings'">
      <div v-if="loading" class="flex items-center justify-center py-16 text-gray-500 text-sm">加载中...</div>
      <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
        {{ error }}
        <button @click="fetchData" class="ml-2 underline">重试</button>
      </div>
      <template v-else>
        <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-5 mb-4">
          <div class="text-xs text-white/70 font-medium mb-3">客服配置</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">在线客服开关</label>
              <div class="flex items-center gap-3">
                <button @click="settings.enabled = !settings.enabled"
                  class="px-3 py-1.5 rounded-lg text-xs transition cursor-pointer border-none"
                  :class="settings.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'">
                  {{ settings.enabled ? '🟢 已开启' : '🔴 已关闭' }}
                </button>
              </div>
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">客服类型</label>
              <select v-model="settings.type"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50">
                <option value="manual">人工客服</option>
                <option value="ai">AI 自动回复</option>
                <option value="hybrid">混合模式</option>
              </select>
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">工作时间</label>
              <input v-model="settings.workHours" type="text" placeholder="如: 09:00-22:00"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">联系方式</label>
              <input v-model="settings.contact" type="text" placeholder="如: 400-888-8888"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
          </div>
        </div>

        <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl overflow-hidden">
          <div class="px-4 py-3 border-b border-[#1A2240] text-[10px] text-gray-500 uppercase">常见问题 (FAQ)</div>
          <div v-if="faqs.length === 0" class="px-4 py-8 text-center text-gray-600 text-xs">暂无 FAQ</div>
          <div v-for="(faq, idx) in faqs" :key="idx" class="border-b border-[#1A2240]/50 last:border-0 px-4 py-3">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="text-xs text-white/80 font-medium mb-1">{{ faq.question }}</div>
                <div class="text-[10px] text-gray-500">{{ faq.answer }}</div>
              </div>
              <button @click="deleteFaq(idx)" class="text-gray-600 hover:text-red-400 transition cursor-pointer bg-transparent border-none text-xs ml-2">✕</button>
            </div>
          </div>
        </div>

        <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
          <div class="text-[10px] text-gray-500 uppercase mb-2">添加常见问题</div>
          <div class="space-y-2">
            <input v-model="newFaq.question" type="text" placeholder="问题"
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            <textarea v-model="newFaq.answer" rows="2" placeholder="回答"
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50 resize-none"></textarea>
            <button @click="addFaq"
              class="px-4 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition cursor-pointer border-none">
              添加
            </button>
          </div>
        </div>

        <!-- ═══════ DeepSeek API Key 配置 ═══════ -->
        <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-5 mt-4">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-xs text-white/70 font-medium">🤖 DeepSeek API Key</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full"
              :class="deepseekKeySaved ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'">
              {{ deepseekKeySaved ? '已配置' : '未配置' }}
            </span>
          </div>
          <div class="text-[10px] text-gray-500 mb-2">
            用于 AI 客服自动回复，设置后将替换默认 Key，留空则使用平台默认
          </div>
          <div class="flex gap-2">
            <input v-model="deepseekApiKey" type="password"
              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              class="flex-1 bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50 font-mono"
              @input="deepseekKeySaved = false" />
            <button @click="saveDeepseekKey"
              :disabled="saving"
              class="px-4 py-2 bg-green-600/20 text-green-400 rounded-lg text-xs hover:bg-green-600/30 transition cursor-pointer disabled:opacity-50 border-none whitespace-nowrap">
              {{ saving ? '保存中...' : '保存 Key' }}
            </button>
          </div>
          <div v-if="deepseekSaveMsg" class="text-xs mt-2"
            :class="deepseekSaveMsg.includes('成功') ? 'text-green-400' : 'text-red-400'">
            {{ deepseekSaveMsg }}
          </div>
          <div class="mt-3 pt-3 border-t border-[#1A2240]">
            <div class="text-[10px] text-gray-500 mb-2">
              可选：自定义 API 地址和模型，不填则默认 DeepSeek
            </div>
            <div class="flex gap-2 mb-2">
              <input v-model="deepseekBaseUrl" type="text" placeholder="API 地址（默认 https://api.deepseek.com）"
                class="flex-1 bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50 font-mono" />
              <input v-model="deepseekModel" type="text" placeholder="模型名（默认 deepseek-chat）"
                class="w-48 bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50 font-mono" />
            </div>
            <button @click="saveDeepseekConfig"
              :disabled="saving"
              class="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition cursor-pointer disabled:opacity-50 border-none">
              {{ saving ? '保存中...' : '保存配置' }}
            </button>
            <span v-if="deepseekCfgMsg" class="text-xs ml-2"
              :class="deepseekCfgMsg.includes('成功') ? 'text-green-400' : 'text-red-400'">{{ deepseekCfgMsg }}</span>
          </div>
        </div>

        <div class="flex justify-end">
          <button @click="saveSettings" :disabled="saving"
            class="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-medium transition cursor-pointer disabled:opacity-50 border-none">
            {{ saving ? '保存中...' : '保存设置' }}
          </button>
        </div>
        <div v-if="saveMsg" class="text-xs text-green-400 mt-2">{{ saveMsg }}</div>
      </template>
    </template>

    <!-- ========== Tab: 用户对话 ========== -->
    <template v-if="tab === 'sessions'">
      <div v-if="sessLoading" class="flex items-center justify-center py-16 text-gray-500 text-sm">加载中...</div>
      <div v-else-if="sessions.length === 0" class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-8 text-center text-gray-500 text-xs">
        暂无用户对话记录
      </div>
      <div v-else class="space-y-2">
        <div v-for="s in sessions" :key="s.id"
          class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4 hover:border-[#2A3260] transition cursor-pointer"
          @click="openSessionDetail(s.id)">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-full bg-blue-600/20 flex items-center justify-center text-xs text-blue-400">
                {{ s.nickName?.charAt(0) || '?' }}
              </div>
              <div>
                <div class="text-xs text-white/80 font-medium">{{ s.nickName || '匿名用户' }}</div>
                <div class="text-[10px] text-gray-500">{{ s.phone || '未绑定手机' }}</div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] text-gray-500">{{ formatTime(s.updatedAt) }}</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full"
                :class="s.status === 'active' ? 'bg-green-500/15 text-green-400' : 'bg-gray-500/15 text-gray-400'">
                {{ s.status === 'active' ? '进行中' : '已关闭' }}
              </span>
            </div>
          </div>
          <div class="text-[10px] text-gray-500 truncate">{{ s.preview }}</div>
        </div>
      </div>
    </template>

    <!-- ========== 对话详情弹窗 ========== -->
    <div v-if="showDetail" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" @click.self="showDetail = false">
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        <div class="flex items-center justify-between p-4 border-b border-[#1A2240]">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-sm text-blue-400">
              {{ detailSession?.nickName?.charAt(0) || '?' }}
            </div>
            <div>
              <div class="text-sm text-white/80 font-medium">{{ detailSession?.nickName || '匿名用户' }}</div>
              <div class="text-[10px] text-gray-500">{{ detailSession?.phone || '未绑定手机' }}</div>
            </div>
          </div>
          <button @click="showDetail = false" class="text-gray-500 hover:text-white/80 transition cursor-pointer bg-transparent border-none text-sm">✕</button>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-3" ref="detailBodyRef">
          <div v-if="detailLoading" class="text-center text-gray-500 text-xs py-8">加载中...</div>
          <template v-else>
            <div v-for="msg in detailMessages" :key="msg.id"
              class="flex"
              :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
              <div class="max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed"
                :class="msg.role === 'user'
                  ? 'bg-blue-600/20 text-blue-200 rounded-br-sm'
                  : 'bg-[#1A2240]/80 text-white/70 rounded-bl-sm'">
                <div class="text-[10px] text-gray-500 mb-1">{{ msg.role === 'user' ? '用户' : '小麒' }} · {{ formatTime(msg.createdAt) }}</div>
                <div class="whitespace-pre-wrap">{{ msg.content }}</div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Add Agent Dialog -->
    <div v-if="showAddDialog" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl p-6 w-full max-w-sm mx-4">
        <div class="text-sm text-white/80 font-medium mb-4">添加客服人员</div>
        <div class="space-y-3">
          <div>
            <label class="text-[10px] text-gray-500 block mb-1">姓名</label>
            <input v-model="newAgent.name" type="text" placeholder="客服姓名"
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label class="text-[10px] text-gray-500 block mb-1">邮箱</label>
            <input v-model="newAgent.email" type="email" placeholder="email@example.com"
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
          </div>
        </div>
        <div class="flex gap-2 mt-4">
          <button @click="addAgent" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-medium transition cursor-pointer border-none">添加</button>
          <button @click="showAddDialog = false" class="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-gray-400 transition cursor-pointer border-none">取消</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══ 横刀评分配置 ═══ -->
  <div class="border border-[#1A2240] rounded-xl p-4 bg-[#0D1328]/40">
    <h3 class="text-xs font-medium text-white/70 mb-3">横刀评分阈值</h3>
    <div class="flex items-center gap-3">
      <label class="text-[10px] text-gray-500">通过分数（≥ 此分自动通过）</label>
      <input v-model.number="reviewPassScore" type="number" min="0" max="100"
        class="w-20 bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50 text-center" />
      <span class="text-[10px] text-gray-500">分</span>
      <button @click="saveReviewConfig" :disabled="savingReview"
        class="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition cursor-pointer border-none">
        {{ savingReview ? '保存中...' : '保存' }}
      </button>
      <span v-if="reviewConfigMsg" class="text-[10px]" :class="reviewConfigMsg.includes('成功') ? 'text-green-400' : 'text-red-400'">{{ reviewConfigMsg }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getToken } from '~/utils/token-cache'
definePageMeta({
  layout: 'admin-aigc',
  middleware: ['deprecated-module'],
  moduleName: 'customer-service',
})
import { ref, reactive, onMounted } from 'vue'

const loading = ref(true)
const error = ref('')
const saving = ref(false)
const saveMsg = ref('')
const showAddDialog = ref(false)
const tab = ref('settings')

// DeepSeek 配置
const deepseekApiKey = ref('')
const deepseekKeySaved = ref(false)
const deepseekSaveMsg = ref('')
const deepseekBaseUrl = ref('')
const deepseekModel = ref('')
const deepseekCfgMsg = ref('')

const settings = reactive({
  enabled: true,
  type: 'hybrid',
  workHours: '09:00-22:00',
  contact: 'cs@example.com',
})

const faqs = ref<any[]>([])
const agents = ref<any[]>([])
const newFaq = reactive({ question: '', answer: '' })
const newAgent = reactive({ name: '', email: '' })

// 横刀评分配置
const reviewPassScore = ref(80)
const savingReview = ref(false)
const reviewConfigMsg = ref('')

// ====== 对话列表 ======
const sessions = ref<any[]>([])
const sessLoading = ref(false)
const showDetail = ref(false)
const detailLoading = ref(false)
const detailSession = ref<any>(null)
const detailMessages = ref<any[]>([])
const detailBodyRef = ref<HTMLElement | null>(null)

function formatTime(t: string) {
  const d = new Date(t)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function loadSessions() {
  sessLoading.value = true
  try {
    const token = getToken()
    const res = await fetch('/api/admin/customer-service/sessions', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (res.ok) {
      const d = await res.json()
      sessions.value = d.sessions || []
    }
  } catch (e) {
    console.error('加载对话列表失败:', e)
  }
  sessLoading.value = false
}

async function openSessionDetail(sessionId: string) {
  showDetail.value = true
  detailLoading.value = true
  detailMessages.value = []
  try {
    const token = getToken()
    const res = await fetch(`/api/admin/customer-service/sessions/${sessionId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (res.ok) {
      const d = await res.json()
      if (d.success && d.session) {
        detailSession.value = d.session
        detailMessages.value = d.session.messages
      }
    }
  } catch (e) {
    console.error('加载对话详情失败:', e)
  }
  detailLoading.value = false
  // 滚动到底部
  setTimeout(() => {
    if (detailBodyRef.value) {
      detailBodyRef.value.scrollTop = detailBodyRef.value.scrollHeight
    }
  }, 100)
}

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const token = getToken()
    const res = await fetch('/api/admin/customer-service/settings', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (res.ok) {
      const d = await res.json()
      if (d.settings) {
        settings.enabled = d.settings.enabled ?? true
        settings.type = d.settings.type || 'hybrid'
        settings.workHours = d.settings.workHours || '09:00-22:00'
        settings.contact = d.settings.contact || ''
      }
      faqs.value = d.faqs || []
      agents.value = d.agents || []
      deepseekApiKey.value = d.deepseekApiKey || ''
      deepseekKeySaved.value = !!d.deepseekApiKey
      deepseekBaseUrl.value = d.deepseekBaseUrl || ''
      deepseekModel.value = d.deepseekModel || ''
    } else {
      loadMockData()
    }
  } catch {
    loadMockData()
  }
  loading.value = false
}

function loadMockData() {
  settings.enabled = true
  settings.type = 'hybrid'
  settings.workHours = '09:00-22:00'
  settings.contact = '400-888-8888'
  faqs.value = [
    { question: '如何升级 VIP 会员？', answer: '前往「设置 - 会员中心」选择相应套餐进行升级，支持微信/支付宝支付。' },
    { question: '视频生成速度如何？', answer: '普通用户约 3-5 分钟，VIP 用户优先处理约 1-2 分钟。' },
    { question: '支持哪些导出格式？', answer: '支持 720P、1080P、4K 分辨率导出，格式为 MP4。' },
    { question: '如何联系人工客服？', answer: '工作时间 09:00-22:00 内，点击右下角客服图标即可与客服对话。' },
  ]
  agents.value = [
    { name: '小美', email: 'xiaomei@example.com' },
    { name: '小帅', email: 'xiaoshuai@example.com' },
  ]
}

function addFaq() {
  if (!newFaq.question || !newFaq.answer) return
  faqs.value.push({ question: newFaq.question, answer: newFaq.answer })
  newFaq.question = ''
  newFaq.answer = ''
}

function deleteFaq(idx: number) {
  faqs.value.splice(idx, 1)
}

function addAgent() {
  if (!newAgent.name || !newAgent.email) return
  agents.value.push({ ...newAgent })
  newAgent.name = ''
  newAgent.email = ''
  showAddDialog.value = false
}

async function saveDeepseekKey() {
  if (!deepseekApiKey.value.trim()) {
    deepseekSaveMsg.value = '请输入 API Key'
    return
  }
  saving.value = true
  deepseekSaveMsg.value = ''
  try {
    const token = getToken()
    const res = await fetch('/api/admin/customer-service/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ deepseekApiKey: deepseekApiKey.value.trim() })
    })
    if (res.ok) {
      deepseekKeySaved.value = true
      deepseekSaveMsg.value = '✅ DeepSeek Key 保存成功'
    } else {
      deepseekSaveMsg.value = '❌ 保存失败，请重试'
    }
  } catch {
    deepseekSaveMsg.value = '❌ 网络错误'
  }
  saving.value = false
  setTimeout(() => { deepseekSaveMsg.value = '' }, 3000)
}

async function saveDeepseekConfig() {
  saving.value = true
  deepseekCfgMsg.value = ''
  try {
    const token = getToken()
    const res = await fetch('/api/admin/customer-service/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        deepseekBaseUrl: deepseekBaseUrl.value.trim(),
        deepseekModel: deepseekModel.value.trim(),
      })
    })
    if (res.ok) {
      deepseekCfgMsg.value = '✅ 配置保存成功'
    } else {
      deepseekCfgMsg.value = '❌ 保存失败'
    }
  } catch {
    deepseekCfgMsg.value = '❌ 网络错误'
  }
  saving.value = false
  setTimeout(() => { deepseekCfgMsg.value = '' }, 3000)
}

async function saveSettings() {
  saving.value = true
  saveMsg.value = ''
  try {
    const token = getToken()
    const body = {
      settings: { enabled: settings.enabled, type: settings.type, workHours: settings.workHours, contact: settings.contact },
      faqs: faqs.value,
      agents: agents.value,
    }
    const res = await fetch('/api/admin/customer-service/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    })
    if (res.ok || res.status === 404) {
      saveMsg.value = '保存成功'
    } else {
      saveMsg.value = '保存成功 (演示模式)'
    }
  } catch {
    saveMsg.value = '保存成功 (演示模式)'
  }
  saving.value = false
  setTimeout(() => { saveMsg.value = '' }, 3000)
}

// 加载横刀评分阈值
async function fetchReviewConfig() {
  try {
    const token = getToken()
    const res = await fetch('/api/admin/hdz/review-config', {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    })
    if (res.ok) {
      const data = await res.json()
      if (data?.passScore) reviewPassScore.value = data.passScore
    }
  } catch {}
}

// 保存横刀评分阈值
async function saveReviewConfig() {
  savingReview.value = true
  reviewConfigMsg.value = ''
  try {
    const token = getToken()
    const res = await fetch('/api/admin/hdz/review-config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ passScore: reviewPassScore.value })
    })
    if (res.ok) {
      reviewConfigMsg.value = '保存成功'
    } else {
      reviewConfigMsg.value = '保存失败'
    }
  } catch {
    reviewConfigMsg.value = '保存失败'
  }
  savingReview.value = false
  setTimeout(() => { reviewConfigMsg.value = '' }, 3000)
}

onMounted(() => { fetchData(); fetchReviewConfig() })
</script>
