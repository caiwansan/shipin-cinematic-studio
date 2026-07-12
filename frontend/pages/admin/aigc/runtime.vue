<!-- ============================================================
Runtime Console — AI Runtime Readiness Dashboard
============================================================
Admin 首页：展示 AI Runtime 健康度、Provider 状态、Credential 分布、
Recovery Queue、Runtime Events 预留。纯前端组件，只消费 Summary API。
============================================================ -->

<template>
  <div class="space-y-6">
    <!-- ===== Recovery 成功提示横幅 ===== -->
    <div
      v-if="recoveryBanner.visible"
      class="px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-500 border"
      :class="recoveryBanner.success
        ? 'bg-emerald-900/30 border-emerald-700/40 text-emerald-300'
        : 'bg-red-900/30 border-red-700/40 text-red-300'"
    >
      <span class="text-lg">{{ recoveryBanner.success ? '✅' : '❌' }}</span>
      <div>
        <p class="text-sm font-medium">{{ recoveryBanner.message }}</p>
        <p v-if="recoveryBanner.subMessage" class="text-xs opacity-70 mt-0.5">{{ recoveryBanner.subMessage }}</p>
      </div>
    </div>

    <!-- ===== 页面标题 ===== -->
    <div class="flex items-center justify-between">
      <h2 class="text-sm text-white/70 font-medium">AI Runtime Console</h2>
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-gray-500">最后更新: {{ lastUpdated || '—' }}</span>
        <button
          @click="refreshAll"
          class="px-3 py-1.5 rounded-lg text-[11px] bg-blue-600/20 border border-blue-600/30 text-blue-400 hover:bg-blue-600/30 transition cursor-pointer"
          :disabled="loading"
        >
          {{ loading ? '刷新中...' : '🔄 刷新' }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16 text-gray-500 text-sm">加载中...</div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
      {{ error }}
      <button @click="refreshAll" class="ml-2 underline">重试</button>
    </div>

    <!-- Content -->
    <template v-else>
      <!-- ① Hero: AI Runtime Readiness -->
      <div
        class="rounded-xl p-6 border"
        :class="heroBgClass"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <span class="text-2xl">🤖</span>
              <span class="text-xs font-medium uppercase tracking-wider" :class="heroLabelClass">AI Runtime Readiness</span>
            </div>
            <div class="text-5xl font-bold mb-3" :class="heroTextClass">
              {{ readinessScore }}<span class="text-2xl">%</span>
            </div>
            <!-- Progress bar -->
            <div class="w-full max-w-md h-3 bg-[#1A2240]/60 rounded-full overflow-hidden mb-3">
              <div
                class="h-full rounded-full transition-all duration-700 ease-out"
                :class="progressBarClass"
                :style="{ width: readinessScore + '%' }"
              ></div>
            </div>
            <div class="flex items-center gap-4 text-xs" :class="heroSubtextClass">
              <span class="font-medium">{{ categoryLabel }}</span>
              <span class="opacity-60">·</span>
              <span>{{ summary.totalCredentials }} 个凭据</span>
              <span class="opacity-60">·</span>
              <span>{{ summary.providers }} 个 Provider</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Grid: ② + ③ -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- ② Provider Health -->
        <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-4">
          <div class="flex items-center justify-between mb-3">
            <span class="text-[10px] text-gray-500 uppercase tracking-wider">Provider Health</span>
            <span class="text-[11px] text-gray-400">All {{ summary.providers }}</span>
          </div>
          <div class="space-y-1">
            <div
              v-for="p in providerStatuses"
              :key="p.provider"
              class="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition"
              :class="{ 'cursor-pointer': p.needsAction }"
              @click="p.needsAction ? goToRecovery(p) : null"
            >
              <div class="flex items-center gap-2.5">
                <span
                  class="w-2 h-2 rounded-full shrink-0"
                  :class="statusDotClass(p.status)"
                ></span>
                <span class="text-xs text-white/80">{{ p.provider }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span
                  class="text-[10px]"
                  :class="statusLabelClass(p.status)"
                >{{ p.statusLabel }}</span>
                <span v-if="p.needsAction" class="text-[10px] text-blue-400 hover:text-blue-300 underline">配置</span>
              </div>
            </div>
            <div v-if="providerStatuses.length === 0" class="text-[11px] text-gray-600 text-center py-4">
              暂无 Provider 数据
            </div>
          </div>
        </div>

        <!-- ③ Credential Lifecycle 分布 -->
        <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-4">
          <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Credential Lifecycle</div>
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-[#0A0F1E]/60 rounded-lg p-3 border border-[#1A2240]/50">
              <div class="text-[10px] text-gray-500 mb-1">Active</div>
              <div class="text-2xl font-bold text-emerald-400">{{ lifecycle.active }}</div>
            </div>
            <div class="bg-[#0A0F1E]/60 rounded-lg p-3 border border-[#1A2240]/50">
              <div class="text-[10px] text-gray-500 mb-1">需重新配置</div>
              <div class="text-2xl font-bold text-amber-400">{{ lifecycle.requiresReconfiguration }}</div>
            </div>
            <div class="bg-[#0A0F1E]/60 rounded-lg p-3 border border-[#1A2240]/50">
              <div class="text-[10px] text-gray-500 mb-1">Invalid</div>
              <div class="text-2xl font-bold text-red-400">{{ lifecycle.invalid }}</div>
            </div>
            <div class="bg-[#0A0F1E]/60 rounded-lg p-3 border border-[#1A2240]/50">
              <div class="text-[10px] text-gray-500 mb-1">Disabled</div>
              <div class="text-2xl font-bold text-gray-500">{{ lifecycle.disabled }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ④ Recovery Queue -->
      <div
        class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-4"
        :class="{ 'border-amber-700/30': recoveryCount > 0 }"
      >
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-gray-500 uppercase tracking-wider">Providers Requiring Action</span>
            <span
              v-if="recoveryCount > 0"
              class="text-[11px] font-bold"
              :class="recoveryCount > 0 ? 'text-amber-400' : 'text-gray-500'"
            >{{ recoveryCount }}</span>
          </div>
        </div>
        <div v-if="recoveryCount > 0" class="flex items-center justify-between">
          <p class="text-xs text-gray-400">
            {{ recoveryCount }} 个 Provider 需要重新配置 API Key 以恢复 AI 功能
          </p>
          <button
            @click="goToRecoveryQueue"
            class="px-4 py-2 rounded-lg text-[11px] font-medium bg-amber-600/20 border border-amber-600/30 text-amber-400 hover:bg-amber-600/30 transition cursor-pointer whitespace-nowrap"
          >
            Configure Now →
          </button>
        </div>
        <div v-else class="text-[11px] text-gray-600 py-2">
          ✅ 所有 Provider 状态正常，无需操作
        </div>
      </div>

      <!-- ⑤ Runtime Events (预留) -->
      <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-4">
        <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Runtime Events</div>
        <div class="text-[11px] text-gray-600 py-4 text-center">
          — No events yet —
        </div>
        <div class="text-[10px] text-gray-600">
          <span class="opacity-60">记录近期的 Recovery、Health Check 失败等事件</span>
        </div>
      </div>

      <!-- ⑥ Platform Runtime (Hybrid AI) — 平台 Provider 管理 -->
      <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-gray-500 uppercase tracking-wider">⚙️ AI 平台 Provider 管理</span>
            <span v-if="platformProviders.length > 0" class="text-[10px] bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded">{{ platformProviders.length }} / {{ presetProviders.length }}</span>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="refreshPlatformProviders"
              class="px-2 py-1 rounded text-[10px] bg-white/5 border border-white/10 hover:bg-white/10 transition cursor-pointer"
            >🔄 刷新</button>
          </div>
        </div>

        <div class="text-[10px] text-gray-500 mb-3">
          平台 AI 扫描使用的 LLM 配置。此处配置后，所有用户进行品牌可见度扫描时统一使用这些 Key。
        </div>

        <!-- 预定义 Provider 列表 -->
        <div v-for="preset in presetProviders" :key="preset.provider"
          class="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition mb-1 border border-[#1A2240]/30">

          <div class="flex items-center gap-2.5">
            <span
              class="w-2 h-2 rounded-full shrink-0"
              :class="getProviderHealthDot(preset.provider)"
            ></span>
            <div>
              <div class="text-xs text-white/80 min-w-[90px]">{{ preset.displayName }}</div>
              <!-- 模型输入框：可选预设或自由输入 -->
              <div class="relative">
                <input
                  v-model="preset.model"
                  :list="'model-suggestions-' + preset.provider"
                  placeholder="输入或选择模型"
                  @input="onModelChange(preset)"
                  class="max-w-[140px] px-1.5 py-0.5 rounded bg-[#0A0F1E] border border-[#1A2240] text-white/80 text-[9px] outline-none focus:border-blue-500/50 placeholder-gray-600 w-full"
                />
                <datalist :id="'model-suggestions-' + preset.provider">
                  <option v-for="m in preset.modelOptions" :key="m" :value="m" />
                </datalist>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <!-- xinghuo 需要 appid + apisecret + apiKey 三字段 -->
            <template v-if="preset.provider === 'xinghuo'">
              <input
                v-model="preset.xinghuoAppid"
                type="text"
                class="w-20 px-2 py-1 rounded bg-[#0A0F1E] border border-[#1A2240] text-white text-[10px] outline-none focus:border-blue-500/50 placeholder-gray-600"
                placeholder="APPID"
                @input="onApiKeyChange(preset)"
              />
              <input
                v-model="preset.xinghuoApisecret"
                type="password"
                class="w-24 px-2 py-1 rounded bg-[#0A0F1E] border border-[#1A2240] text-white text-[10px] outline-none focus:border-blue-500/50 placeholder-gray-600"
                placeholder="APISecret"
                @input="onApiKeyChange(preset)"
              />
              <input
                v-model="preset.apiKey"
                type="password"
                class="w-24 px-2 py-1 rounded bg-[#0A0F1E] border border-[#1A2240] text-white text-[10px] outline-none focus:border-blue-500/50 placeholder-gray-600"
                :placeholder="preset.hasKey ? 'Key已设' : 'APIKey'"
                @input="onApiKeyChange(preset)"
              />
            </template>
            <template v-else>
              <input
                v-model="preset.apiKey"
                type="password"
                class="w-28 px-2 py-1 rounded bg-[#0A0F1E] border border-[#1A2240] text-white text-[10px] outline-none focus:border-blue-500/50 placeholder-gray-600"
                :placeholder="getKeyPlaceholder(preset.provider)"
                @input="onApiKeyChange(preset)"
              />
            </template>
            <!-- 保存 Key 按钮 -->
            <button
              v-if="preset.dirty"
              @click="savePresetProvider(preset)"
              class="px-2 py-1 rounded text-[10px] bg-green-600/20 border border-green-600/30 text-green-400 hover:bg-green-600/30 transition cursor-pointer whitespace-nowrap"
            >保存Key</button>
            <!-- 保存模型按钮 -->
            <button
              v-if="preset.modelDirty"
              @click="savePresetModel(preset)"
              class="px-2 py-1 rounded text-[10px] bg-amber-600/20 border border-amber-600/30 text-amber-400 hover:bg-amber-600/30 transition cursor-pointer whitespace-nowrap"
            >保存模型</button>
            <!-- 测试按钮 -->
            <button
              v-if="preset.hasKey"
              @click="testPlatformProvider(preset.id)"
              class="px-2 py-1 rounded text-[10px] bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition cursor-pointer"
              :disabled="preset.testing"
            >{{ preset.testing ? '...' : '测试' }}</button>
            <!-- 状态 -->
            <span v-if="preset.testResult" class="text-[9px] whitespace-nowrap" :class="preset.testResult.ok ? 'text-green-400' : 'text-red-400'">{{ preset.testResult.msg }}</span>
          </div>
        </div>

        <!-- Usage -->
        <div v-if="platformUsage.totalCalls > 0" class="mt-3 pt-3 border-t border-[#1A2240]/50">
          <div class="text-[10px] text-gray-500 mb-1">用量统计（近 7 天）</div>
          <div class="grid grid-cols-3 gap-3">
            <div class="bg-[#0A0F1E]/40 rounded p-2">
              <div class="text-[9px] text-gray-600">调用次数</div>
              <div class="text-sm text-white/80">{{ platformUsage.totalCalls }}</div>
            </div>
            <div class="bg-[#0A0F1E]/40 rounded p-2">
              <div class="text-[9px] text-gray-600">预估成本</div>
              <div class="text-sm text-white/80">¥{{ platformUsage.totalCost?.toFixed(4) || '0' }}</div>
            </div>
            <div class="bg-[#0A0F1E]/40 rounded p-2">
              <div class="text-[9px] text-gray-600">健康 Provider</div>
              <div class="text-sm text-white/80">{{ healthyCount }}</div>
            </div>
          </div>
        </div>
      </div>    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// ─── State ───
const loading = ref(false)
const error = ref<string | null>(null)
const summary = ref<any>({ totalCredentials: 0, providers: 0, readinessScore: 0, credentialLifecycle: { active: 0, invalid: 0, requiresReconfiguration: 0, disabled: 0 } })
const lastUpdated = ref<string | null>(null)

interface RecoveryBanner {
  visible: boolean
  success: boolean
  message: string
  subMessage: string | null
}

const recoveryBanner = ref<RecoveryBanner>({
  visible: false,
  success: true,
  message: '',
  subMessage: null,
})

// ─── Platform Runtime state ───
const platformProviders = ref<any[]>([])
const platformLoading = ref(false)
const platformUsage = ref({ totalCalls: 0, totalCost: 0 })

const HEALTHY_MAP = ref<Record<string,string>>({})

// 预定义所有 Presence 用到的 Provider — 在 setup 阶段初始化（SSR safe）
const presetProviders = ref<any[]>(
  [
    { provider: 'deepseek',    displayName: 'DeepSeek',      model: 'deepseek-chat',      baseUrl: 'https://api.deepseek.com/v1',                       dailyQuota: 5000, modelOptions: ['deepseek-chat', 'deepseek-reasoner'] },
    { provider: 'chatgpt',     displayName: 'ChatGPT',       model: 'gpt-4o-mini',        baseUrl: 'https://api.openai.com/v1',                        dailyQuota: 1000, modelOptions: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
    { provider: 'claude',      displayName: 'Claude',        model: 'claude-sonnet-4-20250514', baseUrl: 'https://api.anthropic.com',                   dailyQuota: 1000, modelOptions: ['claude-sonnet-4-20250514', 'claude-sonnet-4-20241022', 'claude-3-5-haiku'] },
    { provider: 'gemini',      displayName: 'Gemini',        model: 'gemini-2.5-pro-0325',  baseUrl: 'https://generativelanguage.googleapis.com',        dailyQuota: 1000, modelOptions: ['gemini-2.5-pro-0325', 'gemini-2.0-flash', 'gemini-1.5-pro'] },
    { provider: 'kimi',        displayName: 'Kimi (Moonshot)', model: 'moonshot-v1-8k',    baseUrl: 'https://api.moonshot.cn/v1',                      dailyQuota: 1000, modelOptions: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'] },
    { provider: 'perplexity',  displayName: 'Perplexity',    model: 'sonar-pro',          baseUrl: 'https://api.perplexity.ai',                       dailyQuota: 1000, modelOptions: ['sonar-pro', 'sonar', 'llama-3.1-sonar-large-32k'] },
    { provider: 'doubao',      displayName: '豆包(火山引擎)',  model: 'doubao-seed-2-1-pro-260628', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', dailyQuota: 1000, modelOptions: ['doubao-seed-2-1-pro-260628', 'doubao-seed-2-1-plus-260628', 'doubao-lite-128k', 'deepseek-r1-250120', 'doubao-1.5-pro-256k'] },
    { provider: 'tongyi',      displayName: '通义千问',        model: 'qwen-plus',          baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', dailyQuota: 1000, modelOptions: ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-long', 'qwq-plus'] },
    { provider: 'wenxin',      displayName: '文心一言',        model: 'ernie-4.0',          baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom',       dailyQuota: 1000, modelOptions: ['ernie-4.0', 'ernie-3.5', 'ernie-speed', 'ernie-lite'] },
    { provider: 'xinghuo',     displayName: '讯飞星火',        model: 'generalv3.5',          baseUrl: 'https://spark-api.xf-yun.com/v3.5/chat',           dailyQuota: 1000, modelOptions: ['generalv3.5', 'generalv3', 'generalv2', 'lite'], xinghuoAppid: '', xinghuoApisecret: '' },
    { provider: 'yuanbao',     displayName: '元宝(腾讯混元)',   model: 'hunyuan-pro',        baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',          dailyQuota: 1000, modelOptions: ['hunyuan-pro', 'hunyuan-standard', 'hunyuan-lite', 'hunyuan-turbo'] },
    { provider: 'copilot',     displayName: 'Copilot',        model: 'gpt-4o',             baseUrl: 'https://api.copilot.microsoft.com',                dailyQuota: 1000, modelOptions: ['gpt-4o', 'gpt-4o-mini'] },
    { provider: 'meituan',     displayName: '美团大模型',       model: 'LongCat-2.0', baseUrl: 'https://api.longcat.chat/openai',                               dailyQuota: 1000, modelOptions: ['LongCat-2.0'] },
  ].map(p => ({ ...p, apiKey: '', id: null, hasKey: false, dirty: false, testing: false, testResult: null, modelDirty: false }))
)

// ─── Computed from summary ───
const readinessScore = computed(() => summary.value?.readinessScore ?? 0)
const lifecycle = computed(() => summary.value?.credentialLifecycle ?? { active: 0, invalid: 0, requiresReconfiguration: 0, disabled: 0 })
const recoveryCount = computed(() => lifecycle.value.requiresReconfiguration)
const categoryLabel = computed(() => {
  const s = readinessScore.value
  if (s < 50) return 'Critical'
  if (s < 75) return 'Warning'
  if (s < 90) return 'Healthy'
  return 'Excellent'
})

const categoryKey = computed(() => {
  const s = readinessScore.value
  if (s < 50) return 'critical'
  if (s < 75) return 'warning'
  if (s < 90) return 'healthy'
  return 'excellent'
})

// ─── Hero styling ───
const heroBgClass = computed(() => {
  const map: Record<string, string> = {
    critical: 'bg-red-900/20 border-red-800/30',
    warning: 'bg-amber-900/20 border-amber-800/30',
    healthy: 'bg-emerald-900/15 border-emerald-800/25',
    excellent: 'bg-green-900/15 border-green-800/25',
  }
  return map[categoryKey.value] || 'bg-[#0D1328]/80 border-[#1A2240]'
})

const heroTextClass = computed(() => {
  const map: Record<string, string> = {
    critical: 'text-red-400',
    warning: 'text-amber-400',
    healthy: 'text-emerald-400',
    excellent: 'text-green-400',
  }
  return map[categoryKey.value] || 'text-white'
})

const heroLabelClass = computed(() => {
  const map: Record<string, string> = {
    critical: 'text-red-400/70',
    warning: 'text-amber-400/70',
    healthy: 'text-emerald-400/70',
    excellent: 'text-green-400/70',
  }
  return map[categoryKey.value] || 'text-white/70'
})

const heroSubtextClass = computed(() => {
  const map: Record<string, string> = {
    critical: 'text-red-300/70',
    warning: 'text-amber-300/70',
    healthy: 'text-emerald-300/70',
    excellent: 'text-green-300/70',
  }
  return map[categoryKey.value] || 'text-white/70'
})

const progressBarClass = computed(() => {
  const map: Record<string, string> = {
    critical: 'bg-gradient-to-r from-red-500 to-red-400',
    warning: 'bg-gradient-to-r from-amber-500 to-amber-400',
    healthy: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
    excellent: 'bg-gradient-to-r from-green-500 to-green-400',
  }
  return map[categoryKey.value] || 'bg-blue-500'
})

// ─── Provider statuses from summary ───
interface ProviderStatus {
  provider: string
  status: string
  statusLabel: string
  needsAction: boolean
}

const providerStatuses = computed<ProviderStatus[]>(() => {
  // If we have provider-specific data from the errors endpoint, use it
  if (providerDetails.value.length > 0) {
    return providerDetails.value
  }

  // Check if summary has provider breakdown
  const providerBreakdown = summary.value?.providerBreakdown
  if (providerBreakdown && Array.isArray(providerBreakdown)) {
    return providerBreakdown.map((p: any) => ({
      provider: p.provider,
      status: p.status,
      statusLabel: formatStatusLabel(p.status),
      needsAction: p.status === 'REQUIRES_RECONFIGURATION' || p.status === 'INVALID',
    }))
  }

  // Fallback: no provider-level data available
  return []
})

// Provider details loaded from recovery errors API
const providerDetails = ref<ProviderStatus[]>([])

function formatStatusLabel(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'Active',
    VALIDATING: 'Validating',
    NEW: 'New',
    INVALID: 'Invalid',
    REQUIRES_RECONFIGURATION: 'Requires Reconf',
    DISABLED: 'Disabled',
  }
  return map[status] || status
}

function statusDotClass(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]',
    VALIDATING: 'bg-blue-400 animate-pulse',
    NEW: 'bg-gray-500',
    INVALID: 'bg-red-400',
    REQUIRES_RECONFIGURATION: 'bg-amber-400',
    DISABLED: 'bg-gray-600',
  }
  return map[status] || 'bg-gray-500'
}

function statusLabelClass(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'text-emerald-400',
    VALIDATING: 'text-blue-400',
    NEW: 'text-gray-500',
    INVALID: 'text-red-400',
    REQUIRES_RECONFIGURATION: 'text-amber-400',
    DISABLED: 'text-gray-500',
  }
  return map[status] || 'text-gray-500'
}

// ─── Actions ───
async function fetchSummary() {
  try {
    const res = await fetch('/api/runtime/summary')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    // The inline route wraps in { success, data }
    summary.value = json.data ?? json
    lastUpdated.value = new Date().toLocaleString('zh-CN')
  } catch (e: any) {
    // silent: summary 非必需，不阻塞页面其余内容显示
    console.warn('[fetchSummary]', e.message || '无法加载 Runtime 数据')
  }
}

async function fetchProviderDetails() {
  try {
    const res = await fetch('/api/runtime/recovery/errors')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const errors = json.data ?? []
    providerDetails.value = errors.map((e: any) => ({
      provider: e.provider,
      status: 'REQUIRES_RECONFIGURATION',
      statusLabel: 'Requires Reconf',
      needsAction: true,
      reason: e.reason,
    }))
  } catch {
    // Non-critical
  }
}

async function refreshAll() {
  loading.value = true
  error.value = null
  await Promise.all([
    fetchSummary(),
    fetchProviderDetails(),
  ])
  loading.value = false
}

function goToRecovery(provider: ProviderStatus) {
  // Show recovery prompt
  recoveryBanner.value = {
    visible: true,
    success: false,
    message: `${provider.provider} 需要重新配置 API Key`,
    subMessage: 'Provider 凭据无法读取，请前往大模型列表页面更新对应凭据',
  }
  setTimeout(() => {
    recoveryBanner.value.visible = false
  }, 5000)
}

async function goToRecoveryQueue() {
  window.location.href = '/admin/aigc/models'
}

// ─── Platform Runtime ───
async function refreshPlatformProviders() {
  platformLoading.value = true
  try {
    const [provRes, usageRes] = await Promise.all([
      fetch('/api/admin/platform-runtime/providers'),
      fetch('/api/admin/platform-runtime/usage?days=7'),
    ])
    if (provRes.ok) {
      const json = await provRes.json()
      platformProviders.value = (json.data || []).map((p: any) => ({ ...p, testing: false }))
    }
    if (usageRes.ok) {
      const json = await usageRes.json()
      const d = json.data || {}
      platformUsage.value = {
        totalCalls: Number(d.totalCalls) || 0,
        totalCost: Number(d.totalCost) || 0,
        byProvider: d.byProvider || {},
        days: d.days || 7,
      }
    }
  } catch { /* non-critical */ }
  // 同步预设列表与后端数据
  syncPresetsWithBackend()
  platformLoading.value = false
}

async function createPlatformProvider(data: any) {
  try {
    const res = await fetch('/api/admin/platform-runtime/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return res.ok
  } catch { return false }
}

async function updateProvider(id: string, data: any) {
  try {
    await fetch(`/api/admin/platform-runtime/providers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  } catch { /* non-critical */ }
}

async function testPlatformProvider(id: string) {
  const p = platformProviders.value.find((x: any) => x.id === id)
  if (!p) return
  p.testing = true
  try {
    const res = await fetch(`/api/admin/platform-runtime/providers/${id}/test`, { method: 'POST' })
    if (res.ok) {
      p.testResult = { ok: true, msg: '✅ 连接正常' }
    } else {
      const err = await res.json()
      p.testResult = { ok: false, msg: '❌ ' + (err.error || '失败') }
    }
    await refreshPlatformProviders()
  } catch (e: any) {
    p.testResult = { ok: false, msg: '❌ ' + e.message }
  }
  finally { p.testing = false }
}

async function removePlatformProvider(id: string) {
  try {
    await fetch(`/api/admin/platform-runtime/providers/${id}`, { method: 'DELETE' })
  } catch { /* non-critical */ }
}

// ─── Preset Provider helpers ───
function getProviderHealthDot(provider: string): string {
  const h = HEALTHY_MAP.value[provider]
  if (h === 'healthy') return 'bg-green-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]'
  if (h === 'unhealthy') return 'bg-red-400'
  return 'bg-gray-500'
}

function getKeyPlaceholder(provider: string): string {
  const p = presetProviders.value.find((x: any) => x.provider === provider)
  return p?.hasKey ? '**** (已设置)' : '填入 API Key'
}

function onApiKeyChange(preset: any) {
  preset.dirty = true
}

async function savePresetProvider(preset: any) {
  if (preset.provider === 'xinghuo') {
    if (!preset.apiKey || !preset.xinghuoAppid || !preset.xinghuoApisecret) {
      alert('讯飞星火需要填写 APIKey、APPID 和 APISecret 三项')
      return
    }
  } else if (!preset.apiKey) {
    return
  }
  const existing = platformProviders.value.find((p: any) => p.provider === preset.provider)
  const payload: any = { baseUrl: preset.baseUrl, model: preset.model }
  if (preset.provider === 'xinghuo') {
    payload.apiKey = preset.apiKey
    payload.appid = preset.xinghuoAppid
    payload.apisecret = preset.xinghuoApisecret
  } else {
    payload.apiKey = preset.apiKey
  }
  if (existing) {
    await updateProvider(existing.id, payload)
  } else {
    payload.provider = preset.provider
    payload.dailyQuota = preset.dailyQuota
    await createPlatformProvider(payload)
  }
  preset.dirty = false
  preset.hasKey = true
  await refreshPlatformProviders()
}

function onModelChange(preset: any) {
  preset.modelDirty = true
}

async function savePresetModel(preset: any) {
  const existing = platformProviders.value.find((p: any) => p.provider === preset.provider)
  if (existing) {
    const userModel = preset.model  // 保留用户输入
    await updateProvider(existing.id, { model: userModel })
    preset.modelDirty = false
    await refreshPlatformProviders()
    // 刷新后恢复用户输入的模型（防止后端返回空值覆盖）
    const backendPreset = presetProviders.value.find((p: any) => p.provider === preset.provider)
    if (backendPreset) backendPreset.model = userModel
  }
}

const healthyCount = computed(() => Object.values(HEALTHY_MAP.value).filter(v => v === 'healthy').length)

function syncPresetsWithBackend() {
  const backends = platformProviders.value
  for (const preset of presetProviders.value) {
    const backend = backends.find((b: any) => b.provider === preset.provider)
    if (backend) {
      preset.id = backend.id
      preset.hasKey = true
      preset.dirty = false
      preset.model = backend.model
      preset.baseUrl = backend.baseUrl
      if (backend.dailyQuota) preset.dailyQuota = backend.dailyQuota
      preset.healthStatus = backend.healthStatus
      HEALTHY_MAP.value[preset.provider] = backend.healthStatus
    } else {
      preset.id = null
      preset.hasKey = false
      preset.dirty = false
      preset.healthStatus = 'unknown'
      HEALTHY_MAP.value[preset.provider] = 'unknown'
    }
  }
}

// ─── Lifecycle ───
onMounted(async () => {
  await refreshAll()
  await refreshPlatformProviders()

  // Check URL params for recovery success message (passed from recovery flow)
  if (process.client) {
    const params = new URLSearchParams(window.location.search)
    const recoverySuccess = params.get('recovery')
    const recoveryProvider = params.get('provider')
    if (recoverySuccess === 'success' && recoveryProvider) {
      recoveryBanner.value = {
        visible: true,
        success: true,
        message: `✅ ${recoveryProvider} 已恢复`,
        subMessage: `AI Runtime Ready ${readinessScore.value}%`,
      }
      setTimeout(() => {
        recoveryBanner.value.visible = false
        window.history.replaceState({}, '', window.location.pathname)
      }, 5000)
    }
  }
})

definePageMeta({ layout: 'admin-aigc' })
</script>

<style scoped>
.rounded-full {
  transition: width 0.7s ease-out;
}
</style>
