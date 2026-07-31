<template>
  <div class="min-h-full" style="background: #070B16">
    <div class="max-w-[1400px] mx-auto px-4 py-4 space-y-4">
      <!-- ═══ 头部：业务线身份 ═══ -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="text-2xl">{{ meta?.icon || '🏭' }}</span>
          <div>
            <h1 class="text-base font-semibold text-white/90">{{ meta?.label || 'Workspace' }} 工作台</h1>
            <div class="text-[10px] text-gray-500 mt-0.5">统一壳 · 配置 / Agent / 数据 / 用户 · SPRINT-ADMIN-CLEANUP-02 T03</div>
          </div>
        </div>
        <div class="flex items-center gap-2 text-[10px]">
          <span class="px-2 py-1 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">运营中</span>
          <span class="px-2 py-1 rounded-full bg-white/[0.04] text-gray-500 border border-white/[0.06]">30天窗口</span>
        </div>
      </div>

      <!-- ═══ Tab 导航 ═══ -->
      <div class="flex gap-1 border-b border-white/[0.06] pb-0">
        <button v-for="t in tabs" :key="t.key" @click="switchTab(t.key)"
          class="px-4 py-2 text-xs rounded-t-lg transition cursor-pointer border-b-2"
          :class="tab === t.key
            ? 'text-blue-400 border-blue-400 bg-blue-500/[0.06]'
            : 'text-gray-500 border-transparent hover:text-gray-300'">
          {{ t.icon }} {{ t.label }}
        </button>
      </div>

      <div v-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
        ⚠️ {{ error }} <button @click="load" class="ml-2 underline cursor-pointer">重试</button>
      </div>

      <template v-else>
        <!-- ═══ Tab: 数据 ═══ -->
        <div v-if="tab === 'data'" class="space-y-4">
          <!-- 4 指标 -->
          <div class="grid grid-cols-4 gap-3">
            <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4">
              <div class="text-[10px] text-gray-500">📁 项目</div>
              <div class="text-2xl font-bold text-white/90 font-mono mt-1">{{ stats.projects ?? 0 }}</div>
            </div>
            <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4">
              <div class="text-[10px] text-gray-500">⚡ 调用</div>
              <div class="text-2xl font-bold text-blue-400 font-mono mt-1">{{ stats.calls ?? 0 }}</div>
            </div>
            <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4">
              <div class="text-[10px] text-gray-500">👥 用户</div>
              <div class="text-2xl font-bold text-emerald-400 font-mono mt-1">{{ stats.users ?? 0 }}</div>
            </div>
            <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4">
              <div class="text-[10px] text-gray-500">💰 成本</div>
              <div class="text-2xl font-bold text-amber-400 font-mono mt-1">¥{{ (stats.cost ?? 0).toFixed(2) }}</div>
            </div>
          </div>

          <!-- 项目列表 -->
          <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5">
            <h3 class="text-xs font-semibold text-white/80 mb-3">📁 项目列表（{{ projects.length }}）</h3>
            <div v-if="projects.length" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              <div v-for="p in projects" :key="p.id"
                class="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05] flex items-center gap-2">
                <span class="text-[10px] text-white/70 truncate flex-1">{{ p.name || '未命名项目' }}</span>
                <span class="text-[8px] text-gray-600 font-mono shrink-0">{{ p.type || '—' }}</span>
                <span class="text-[8px] px-1.5 py-0.5 rounded-full shrink-0"
                  :class="p.status === 'completed' ? 'bg-emerald-400/10 text-emerald-400' : p.status === 'processing' ? 'bg-blue-400/10 text-blue-400' : 'bg-white/[0.04] text-gray-500'">
                  {{ p.status || '—' }}
                </span>
              </div>
            </div>
            <div v-else class="text-[10px] text-gray-600 py-6 text-center">暂无项目数据</div>
          </div>
        </div>

        <!-- ═══ Tab: Agent ═══ -->
        <div v-else-if="tab === 'agents'" class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5">
          <h3 class="text-xs font-semibold text-white/80 mb-3">🧠 AI 员工资产</h3>
          <div v-if="agents.length" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            <div v-for="a in agents" :key="a.id" class="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
              <div class="flex items-center gap-2">
                <span class="text-[11px] text-white/80 font-medium">{{ a.name }}</span>
                <span class="ml-auto text-[8px] px-1.5 py-0.5 rounded-full"
                  :class="a.runtimeStatus === 'active' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-white/[0.04] text-gray-500'">
                  {{ a.runtimeStatus }}
                </span>
              </div>
              <div class="text-[9px] text-gray-500 mt-1">{{ a.agentType }}</div>
            </div>
          </div>
          <div v-else class="text-[10px] text-gray-600 py-6 text-center">该业务线暂无独立 Agent 资产（AI 员工归 AI Agent 管理统一管理）</div>
        </div>

        <!-- ═══ Tab: 配置 ═══ -->
        <div v-else-if="tab === 'config'" class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5">
          <h3 class="text-xs font-semibold text-white/80 mb-3">⚙️ 业务线配置</h3>
          <div class="text-[10px] text-gray-600 py-6 text-center">
            该业务线暂无独立平台级配置项。
            <div class="mt-1 text-gray-700">平台级配置（模型/通道/Agent 模板）统一在「大模型管理」「AI Agent 管理」中维护，业务线不重复配置。</div>
          </div>
        </div>

        <!-- ═══ Tab: 用户 ═══ -->
        <div v-else-if="tab === 'users'" class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5">
          <h3 class="text-xs font-semibold text-white/80 mb-3">👥 调用用户</h3>
          <div class="text-[10px] text-gray-600 py-6 text-center">
            30 天内调用该业务线的去重用户：<span class="text-white/80 font-mono">{{ stats.users ?? 0 }}</span> 人。
            <div class="mt-1 text-gray-700">用户明细归「用户与权限 → 会员管理」，此处仅聚合概览。</div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { getToken } from '~/utils/token-cache'

definePageMeta({ layout: 'admin-aigc' })

const route = useRoute()
const router = useRouter()

const tabs = [
  { key: 'config', label: '配置', icon: '⚙️' },
  { key: 'agents', label: 'Agent', icon: '🧠' },
  { key: 'data', label: '数据', icon: '📊' },
  { key: 'users', label: '用户', icon: '👥' },
]

const code = computed(() => String(route.params.code || ''))
const tab = ref<string>('data')
const data = ref<any>(null)
const loading = ref(false)
const error = ref('')

// [[tab]].vue 可选段：/admin/workspace/:code 与 /admin/workspace/:code/:tab 都匹配
const rawTab = computed(() => Array.isArray(route.params.tab) ? route.params.tab[0] : route.params.tab)

const meta = computed(() => data.value?.meta || null)
const stats = computed(() => data.value?.stats || {})
const projects = computed(() => data.value?.projects || [])
const agents = computed(() => data.value?.agents || [])

function switchTab(key: string) {
  router.push(`/admin/workspace/${code.value}/${key}`)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`/api/admin/workspace/${code.value}`, { headers: { Authorization: `Bearer ${getToken()}` } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const j = await res.json()
    if (j.code !== 0) throw new Error(j.message || '加载失败')
    data.value = j.data
  } catch (e: any) {
    error.value = e.message || String(e)
  } finally {
    loading.value = false
  }
}

watch(() => rawTab.value, (t) => {
  tab.value = String(t || 'data')
  if (!data.value) load()
}, { immediate: true })

onMounted(load)
</script>
