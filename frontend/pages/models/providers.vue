<!--
  pages/models/providers.vue — 昆仑镜 AI模型中心（AI Provider Center）
  掌柜指令 2026-08-01：全球主流 AI 模型官方注册/充值/API Key 获取/接入配置一站式引导
  风格：世界级 AI 产品（OpenAI Platform / AWS Marketplace 灵感）— 深色科技 + AI 光效 + 玻璃拟态卡片
  BYOK：本页只聚合官方入口，不保存用户 Key、不代理充值；连接状态 = 用户个人模型配置（UserModelConfigV2）
  预留扩展：模型评分（成本/速度/质量/场景）与 Workspace AI 推荐（第九节）
-->
<template>
  <div class="min-h-screen bg-[#04060F] text-white relative overflow-x-hidden">
    <!-- ═══ AI 光效背景 ═══ -->
    <div class="pointer-events-none fixed inset-0 z-0">
      <div class="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-blue-600/15 blur-[120px]"></div>
      <div class="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-indigo-600/12 blur-[120px]"></div>
      <div class="absolute bottom-0 left-1/3 w-[500px] h-[400px] rounded-full bg-cyan-500/8 blur-[120px]"></div>
      <div class="absolute inset-0 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><path d=%22M30 0v60M0 30h60%22 stroke=%22white%22 stroke-opacity=%220.03%22/></svg>')]"></div>
    </div>

    <!-- ═══ 顶部条 ═══ -->
    <header class="relative z-10 border-b border-white/5 bg-[#05070F]/80 backdrop-blur-xl sticky top-0">
      <div class="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <NuxtLink to="/" class="w-8 h-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center justify-center transition shrink-0">
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
          </NuxtLink>
          <NuxtLink to="/" class="flex items-center gap-2 no-underline">
            <img src="/logo.png" alt="昆仑镜" class="h-6 w-auto" />
            <span class="text-sm font-semibold text-white/90">昆仑镜</span>
          </NuxtLink>
          <span class="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">AI模型中心</span>
        </div>
        <div class="flex items-center gap-2">
          <template v-if="!isLoggedIn">
            <NuxtLink to="/login" class="text-xs text-gray-400 hover:text-white px-3 py-1.5 border border-[#1A2D4A] rounded-lg transition no-underline">登录</NuxtLink>
            <NuxtLink to="/register" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition no-underline">注册</NuxtLink>
          </template>
          <template v-else>
            <NuxtLink to="/settings/ai-models" class="text-xs bg-indigo-600/90 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg transition no-underline">⚙️ 我的模型配置</NuxtLink>
          </template>
        </div>
      </div>
    </header>

    <div class="relative z-10">
      <!-- ═══ Hero ═══ -->
      <section class="max-w-7xl mx-auto px-4 pt-14 pb-10 text-center">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-400/20 bg-indigo-500/5 text-indigo-300 text-xs mb-5">
          <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
          已收录 {{ total }} 家全球主流 AI 模型供应商
        </div>
        <h1 class="text-4xl md:text-5xl font-bold tracking-tight">
          <span class="bg-gradient-to-r from-indigo-300 via-blue-200 to-cyan-300 bg-clip-text text-transparent">昆仑镜 AI模型中心</span>
        </h1>
        <p class="text-gray-400 mt-4 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
          连接全球主流 AI 模型，<br class="md:hidden" />
          官方注册、充值、配置，一站完成。
        </p>

        <!-- 搜索框 -->
        <div class="max-w-xl mx-auto mt-8 relative">
          <svg class="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"/></svg>
          <input v-model="keyword" type="text" placeholder="搜索 AI 模型..."
            class="w-full bg-[#0A0F1E]/80 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/40 backdrop-blur-xl transition" />
        </div>

        <!-- 分类 Tab -->
        <div class="flex items-center justify-center gap-2 mt-8 flex-wrap">
          <button v-for="t in tabs" :key="t.key" @click="activeTab = t.key"
            class="px-4 py-2 rounded-xl text-sm transition cursor-pointer border"
            :class="activeTab === t.key
              ? 'bg-indigo-600/90 border-indigo-500/40 text-white shadow-lg shadow-indigo-900/40'
              : 'bg-white/[0.03] border-white/10 text-gray-400 hover:text-white hover:bg-white/[0.06]'">
            {{ t.label }}
            <span class="ml-1.5 text-[10px] opacity-70">{{ filtered.length === 0 && activeTab !== t.key ? counts[t.key] : (activeTab === t.key ? filtered.length : counts[t.key]) }}</span>
          </button>
        </div>
      </section>

      <!-- ═══ Provider 卡片网格 ═══ -->
      <section class="max-w-7xl mx-auto px-4 pb-14">
        <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          <div v-for="i in 8" :key="i" class="h-64 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse"></div>
        </div>

        <div v-else-if="filtered.length === 0" class="text-center py-20">
          <div class="text-5xl mb-4">🔍</div>
          <p class="text-gray-400 text-sm">没有找到匹配「{{ keyword }}」的模型</p>
          <button @click="keyword = ''" class="mt-4 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer bg-transparent border-none">清除搜索</button>
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          <div v-for="p in filtered" :key="p.id"
            class="group relative rounded-2xl bg-white/[0.03] border border-white/[0.07] backdrop-blur-xl p-5 hover:bg-white/[0.05] hover:border-indigo-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-950/40 overflow-hidden">
            <!-- 顶部品牌光晕 -->
            <div class="absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-3xl" :style="{ background: brandGradient(p.code) }"></div>

            <!-- Logo + 名称 + 地区 -->
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white shadow-lg shrink-0 border border-white/10"
                  :style="{ background: `linear-gradient(135deg, ${brandColors(p.code)[0]}, ${brandColors(p.code)[1]})` }">
                  <img v-if="p.logo" :src="p.logo" :alt="p.name" class="w-full h-full object-cover rounded-xl" />
                  <span v-else>{{ brandInitial(p.name) }}</span>
                </div>
                <div>
                  <h3 class="font-semibold text-[15px] leading-tight">{{ p.name }}</h3>
                  <div class="flex items-center gap-1.5 mt-1">
                    <span class="text-[10px] px-1.5 py-0.5 rounded-md border"
                      :class="p.category === 'domestic' ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-blue-500/10 border-blue-500/20 text-blue-300'">
                      {{ p.category === 'domestic' ? '国产' : '海外' }}
                    </span>
                    <span class="text-[10px] text-gray-500">{{ p.country }}</span>
                  </div>
                </div>
              </div>
              <!-- 连接状态 -->
              <div class="shrink-0">
                <span v-if="p.connected" class="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>已配置
                </span>
                <span v-else class="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-white/[0.04] border border-white/10 text-gray-500">
                  <span class="w-1.5 h-1.5 rounded-full bg-gray-600"></span>未连接
                </span>
              </div>
            </div>

            <!-- 简介 -->
            <p class="text-xs text-gray-400 leading-relaxed mt-4 line-clamp-3 min-h-[48px]">{{ p.description }}</p>

            <!-- 推荐星级 -->
            <div class="flex items-center gap-1 mt-3">
              <span v-for="s in 5" :key="s" class="text-[11px]" :class="s <= p.recommended ? 'text-amber-400' : 'text-white/10'">★</span>
              <span class="text-[10px] text-gray-600 ml-1.5">{{ p.recommended >= 4 ? '推荐' : p.recommended === 3 ? '主流' : '可选' }}</span>
            </div>

            <!-- 能力标签 -->
            <div class="flex flex-wrap gap-1.5 mt-3">
              <span v-for="tag in (p.tags || []).slice(0, 4)" :key="tag" class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/8 border border-indigo-500/15 text-indigo-300/90">{{ tag }}</span>
            </div>

            <!-- 操作按钮 -->
            <div class="grid grid-cols-2 gap-2 mt-4">
              <a :href="p.registerUrl || '#'" target="_blank" rel="noopener noreferrer"
                class="col-span-2 text-center text-xs font-medium py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white transition shadow-lg shadow-indigo-950/50 no-underline">
                🚀 立即注册
                <span v-if="p.registerViaAffiliate" class="ml-1 text-[9px] text-indigo-200">推广</span>
              </a>
              <a v-if="p.billingUrl" :href="p.billingUrl" target="_blank" rel="noopener noreferrer"
                class="text-center text-[11px] py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-gray-300 hover:text-white hover:bg-white/[0.08] transition no-underline">
                💳 充值入口
              </a>
              <a v-if="p.documentationUrl" :href="p.documentationUrl" target="_blank" rel="noopener noreferrer"
                class="text-center text-[11px] py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-gray-300 hover:text-white hover:bg-white/[0.08] transition no-underline">
                📖 接入教程
              </a>
            </div>

            <!-- 配置模型 -->
            <button @click="goConfigure(p)"
              class="w-full mt-2 text-[11px] py-1.5 rounded-lg border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 transition cursor-pointer bg-transparent">
              ⚙️ 配置模型
            </button>
          </div>
        </div>
      </section>

      <!-- ═══ BYOK 原则说明 ═══ -->
      <section class="max-w-7xl mx-auto px-4 pb-6">
        <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 flex flex-col md:flex-row items-start md:items-center gap-4">
          <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg shrink-0">🔐</div>
          <div class="flex-1">
            <h4 class="text-sm font-medium text-white/90">BYOK · 模型由你掌控</h4>
            <p class="text-xs text-gray-500 mt-1 leading-relaxed">
              昆仑镜不保存你的 API Key、不代理充值、不代付模型费用。注册与充值均跳转官方渠道，Key 仅存于你的模型配置中，用于连接测试与运行时调用。
            </p>
          </div>
          <NuxtLink to="/settings/ai-models" class="text-xs px-4 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-gray-300 hover:text-white hover:bg-white/[0.1] transition no-underline whitespace-nowrap">去配置模型 →</NuxtLink>
        </div>
      </section>

      <!-- ═══ 预留扩展：模型评分 + AI 推荐 ═══ -->
      <section class="max-w-7xl mx-auto px-4 pb-16">
        <div class="rounded-2xl border border-dashed border-white/10 bg-white/[0.015] p-5">
          <div class="flex items-center gap-2 text-[11px] text-gray-500 mb-3">
            <span class="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/10">即将上线</span>
            <span>模型评分（成本 / 速度 / 质量 / 适合场景）· Workspace AI 推荐</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div v-for="rec in recommendations" :key="rec.workspace" class="rounded-xl bg-white/[0.02] border border-white/[0.05] p-3.5">
              <div class="text-xs text-gray-300 font-medium">{{ rec.workspace }}</div>
              <div class="text-[11px] text-gray-500 mt-1.5 leading-relaxed">{{ rec.tip }}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getAuthToken } from '~/utils/auth/token'

interface DirectoryProvider {
  id: string
  code: string
  name: string
  logo: string
  description: string | null
  category: string
  country: string
  tags: string[]
  officialWebsite: string
  registerUrl: string
  billingUrl: string
  documentationUrl: string
  registerViaAffiliate: boolean
  connected: boolean
  recommended: number
}

const keyword = ref('')
const activeTab = ref('all')
const loading = ref(true)
const providers = ref<DirectoryProvider[]>([])
const isLoggedIn = ref(false)

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'domestic', label: '🇨🇳 国产' },
  { key: 'overseas', label: '🌍 海外' },
]

const counts = computed(() => ({
  all: providers.value.length,
  domestic: providers.value.filter((p) => p.category === 'domestic').length,
  overseas: providers.value.filter((p) => p.category === 'overseas').length,
}))

const total = computed(() => providers.value.length)

const filtered = computed(() => {
  let list = providers.value
  if (activeTab.value !== 'all') list = list.filter((p) => p.category === activeTab.value)
  const kw = keyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter((p) =>
      p.name.toLowerCase().includes(kw) ||
      (p.description || '').toLowerCase().includes(kw) ||
      (p.tags || []).some((t) => t.toLowerCase().includes(kw)) ||
      p.country.includes(kw)
    )
  }
  return list
})

/** 品牌色（渐变双色） */
function brandColors(code: string): [string, string] {
  const map: Record<string, [string, string]> = {
    deepseek: ['#4D6BFE', '#1E3A8A'],
    zhipu: ['#3859FF', '#6D28D9'],
    volcengine: ['#3370FF', '#00B4D8'],
    aliyun: ['#FF6A00', '#FF8E53'],
    moonshot: ['#7C3AED', '#312E81'],
    tencent: ['#0052D9', '#00C8FF'],
    baidu: ['#2932E1', '#4B5BFF'],
    iflytek: ['#1B7EFF', '#00A3FF'],
    meituan: ['#FFC300', '#FF8C00'],
    openai: ['#10A37F', '#0D5C46'],
    google: ['#4285F4', '#EA4335'],
    anthropic: ['#D97757', '#7C2D12'],
    meta: ['#0866FF', '#0047B3'],
  }
  return map[code] || ['#4F46E5', '#1E40AF']
}
function brandGradient(code: string) { return `linear-gradient(135deg, ${brandColors(code)[0]}33, ${brandColors(code)[1]}22)` }
function brandInitial(name: string) { return name.replace('OpenAI ', '').charAt(0).toUpperCase() }

/** 预留扩展第九节：Workspace AI 推荐（掌柜蓝图） */
const recommendations = [
  { workspace: '🎬 短剧', tip: '推荐 GPT + DeepSeek（创意生成 + 成本优化）' },
  { workspace: '🏢 招聘', tip: '推荐 DeepSeek + Claude（简历解析 + 深度推理）' },
  { workspace: '💻 代码', tip: '推荐 GPT（代码生成与重构）' },
]

function goConfigure(p: DirectoryProvider) {
  if (!isLoggedIn.value) {
    window.location.href = '/login?redirect=/models/providers'
    return
  }
  window.location.href = '/settings/ai-models'
}

onMounted(async () => {
  isLoggedIn.value = !!getAuthToken()
  try {
    const headers: Record<string, string> = {}
    const token = getAuthToken()
    if (token) headers.Authorization = `Bearer ${token}`
    const res: any = await $fetch('/api/ai-provider-directory', { headers }).catch(() => null)
    if (res?.code === 0 && Array.isArray(res.data)) providers.value = res.data
  } finally {
    loading.value = false
  }
})
</script>
