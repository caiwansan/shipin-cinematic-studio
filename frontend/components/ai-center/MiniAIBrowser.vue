<!--
  components/ai-center/MiniAIBrowser.vue — 昆仑镜 AI迷你浏览器
  掌柜指令 2026-08-01：AI中心核心模块。在昆仑镜内打开第三方 AI 官方服务：
   - 不跳出昆仑镜、不打开外部浏览器、保持昆仑镜导航
   - 用户使用自己的 AI 厂商账号（登录态存于用户本地浏览器，不经过昆仑镜服务器）
  安全边界（冻结）：
   - 不保存第三方账号密码 / 不保存第三方 Cookie 到服务器 / 不代理用户聊天内容 / 不托管第三方账号
   - iframe 预检：目标站 X-Frame-Options / CSP frame-ancestors 禁止内嵌时，诚实显示兜底页 + 新标签打开
-->
<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[100] flex flex-col bg-[#070B16] text-white">
      <!-- ═══ 工具栏 ═══ -->
      <div class="flex items-center gap-2 px-3 py-2 bg-[#0B1120]/95 border-b border-white/[0.07] backdrop-blur-xl shrink-0">
        <div class="flex items-center gap-1.5">
          <button @click="goBack" :disabled="!canGoBack" title="返回"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/[0.06] transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <button @click="goForward" :disabled="!canGoForward" title="前进"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/[0.06] transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
          <button @click="refresh" title="刷新"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/[0.06] transition cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h5M20 20v-5h-5M5.5 9a7.5 7.5 0 0112.6-3.1L20 8M4 16l1.9 2.1A7.5 7.5 0 0018.5 15"/></svg>
          </button>
        </div>

        <!-- 站点标识 -->
        <div class="flex items-center gap-2 ml-1 shrink-0">
          <div class="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold"
            :style="{ background: `linear-gradient(135deg, ${brandColors[0]}, ${brandColors[1]})` }">
            {{ initial }}
          </div>
          <span class="text-xs font-medium text-white/85 hidden sm:block">{{ providerName }}</span>
        </div>

        <!-- 地址栏 -->
        <div class="flex-1 flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-1.5 mx-2">
          <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 shrink-0">AI浏览器</span>
          <input v-model="addressInput" @keyup.enter="navigateToAddress"
            class="flex-1 bg-transparent text-xs text-gray-300 placeholder-gray-600 outline-none font-mono" spellcheck="false" />
          <span v-if="loading" class="w-3.5 h-3.5 shrink-0">
            <svg class="animate-spin text-indigo-400" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
          </span>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <button @click="openInNewTab" title="在新标签页打开"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/[0.06] transition cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
          </button>
          <button @click="$emit('close')" title="关闭"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-500/20 hover:text-red-300 transition cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      <!-- ═══ 第三方服务安全提示条 ═══ -->
      <div class="flex items-center gap-2 px-4 py-1.5 bg-amber-500/[0.06] border-b border-amber-500/15 shrink-0">
        <span class="text-[10px]">🛡️</span>
        <p class="text-[10px] text-amber-200/70 leading-relaxed">
          您正在访问第三方 AI 服务。账号、密码、余额和聊天数据由对应 AI 服务商管理，昆仑镜不会保存您的第三方账号信息。
        </p>
      </div>

      <!-- ═══ 内容区 ═══ -->
      <div class="flex-1 relative bg-white">
        <!-- 预检中 -->
        <div v-if="checking" class="absolute inset-0 bg-[#070B16] flex flex-col items-center justify-center gap-4 z-10">
          <div class="w-10 h-10 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin"></div>
          <p class="text-xs text-gray-400">正在加载 {{ providerName }} 官方页面…</p>
          <p class="text-[10px] text-gray-600">加载过程不经过昆仑镜服务器，页面与登录态由浏览器直连第三方</p>
        </div>

        <!-- 站点安全策略禁止内嵌 → 诚实兜底 -->
        <div v-else-if="verdict === 'deny'" class="absolute inset-0 bg-[#070B16] flex items-center justify-center z-10">
          <div class="max-w-md mx-auto text-center px-6">
            <div class="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-2xl font-bold mb-5"
              :style="{ background: `linear-gradient(135deg, ${brandColors[0]}, ${brandColors[1]})` }">{{ initial }}</div>
            <h3 class="text-lg font-semibold">{{ providerName }} 官方服务</h3>
            <p class="text-xs text-gray-400 mt-3 leading-relaxed">
              {{ providerName }} 的安全策略（{{ denyReason }}）禁止在第三方页面内嵌显示。
              这是厂商的浏览器安全限制，昆仑镜无法绕过（也不应绕过——绕过即违反安全边界）。
            </p>
            <div class="flex items-center gap-2 justify-center mt-4">
              <a :href="currentUrl" target="_blank" rel="noopener noreferrer"
                class="text-xs font-medium px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white transition no-underline">
                ↗ 在新标签页打开
              </a>
              <button @click="$emit('close')"
                class="text-xs px-5 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-gray-300 hover:text-white transition cursor-pointer">
                返回 AI中心
              </button>
            </div>
            <p class="text-[10px] text-gray-600 mt-4">新标签页打开后，昆仑镜页面保持不变，你仍可随时返回继续操作。</p>
          </div>
        </div>

        <!-- iframe 内嵌 -->
        <iframe v-else :key="iframeKey" :src="currentUrl"
          class="absolute inset-0 w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
          allow="clipboard-read; clipboard-write; fullscreen; microphone; camera; autoplay"
          referrerpolicy="strict-origin-when-cross-origin"
          @load="onFrameLoad"></iframe>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'

const props = defineProps<{
  visible: boolean
  url: string
  providerName: string
  brandColors: [string, string]
  initial: string
}>()
const emit = defineEmits<{ (e: 'close'): void }>()

const currentUrl = ref(props.url)
const addressInput = ref(props.url)
const verdict = ref<'allow' | 'deny' | 'unknown'>('unknown')
const denyReason = ref('')
const checking = ref(true)
const loading = ref(true)
const iframeKey = ref(0)

/** 历史栈（用户主动导航），iframe 内部跳转因跨域不可见，地址栏展示初始地址 */
const stack = ref<string[]>([])
const stackIndex = ref(-1)
const canGoBack = computed(() => stackIndex.value > 0)
const canGoForward = computed(() => stackIndex.value < stack.value.length - 1)

function pushHistory(url: string) {
  stack.value = stack.value.slice(0, stackIndex.value + 1)
  stack.value.push(url)
  stackIndex.value = stack.value.length - 1
  currentUrl.value = url
  addressInput.value = url
  loading.value = true
  iframeKey.value++
}

function goBack() {
  if (!canGoBack.value) return
  stackIndex.value--
  currentUrl.value = stack.value[stackIndex.value]
  addressInput.value = currentUrl.value
  loading.value = true
  iframeKey.value++
}
function goForward() {
  if (!canGoForward.value) return
  stackIndex.value++
  currentUrl.value = stack.value[stackIndex.value]
  addressInput.value = currentUrl.value
  loading.value = true
  iframeKey.value++
}
function refresh() {
  loading.value = true
  iframeKey.value++
}
function onFrameLoad() { loading.value = false }

/** 预检：目标站是否允许 iframe 内嵌（服务器探测响应头，SSRF 白名单防护） */
async function checkFrame(url: string) {
  checking.value = true
  verdict.value = 'unknown'
  try {
    const res: any = await $fetch('/api/ai-center/iframe-check', { query: { url } }).catch(() => null)
    if (res?.code === 0 && res.data) {
      verdict.value = res.data.verdict === 'deny' ? 'deny' : (res.data.verdict === 'allow' ? 'allow' : 'unknown')
      denyReason.value = res.data.reason || ''
    }
  } catch { /* 预检失败按未知处理：iframe 尝试加载 */ }
  checking.value = false
}

async function navigateToAddress() {
  let target = addressInput.value.trim()
  if (!target) return
  if (!/^https?:\/\//i.test(target)) target = `https://${target}`
  // 预检（同时校验供应商白名单）
  try {
    const res: any = await $fetch('/api/ai-center/iframe-check', { query: { url: target } }).catch(() => null)
    if (res?.code !== 0) {
      alert('仅支持昆仑镜已收录的 AI 供应商域名')
      addressInput.value = currentUrl.value
      return
    }
    verdict.value = res.data.verdict === 'deny' ? 'deny' : (res.data.verdict === 'allow' ? 'allow' : 'unknown')
    denyReason.value = res.data.reason || ''
  } catch {
    return
  }
  pushHistory(target)
}

function openInNewTab() {
  window.open(currentUrl.value, '_blank', 'noopener')
}

watch(() => props.url, (u) => {
  if (u) {
    stack.value = [u]
    stackIndex.value = 0
    currentUrl.value = u
    addressInput.value = u
    loading.value = true
    iframeKey.value++
    checkFrame(u)
  }
})
watch(() => props.visible, (v) => {
  if (v && props.url && stack.value.length === 0) {
    stack.value = [props.url]
    stackIndex.value = 0
    currentUrl.value = props.url
    addressInput.value = props.url
    checkFrame(props.url)
  }
})

onBeforeUnmount(() => {
  stack.value = []
  stackIndex.value = -1
})
</script>
