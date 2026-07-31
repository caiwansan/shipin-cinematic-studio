<template>
  <div class="min-h-screen" style="background: #070B16">
    <div class="max-w-[1600px] mx-auto px-4 py-3 space-y-3">
      <!-- ═══ 顶部控制栏（时间范围联动） ═══ -->
      <TimeRangeBar :model-value="range" :loading="loading" @change="onRangeChange" @refresh="loadAll" />

      <div v-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
        ⚠️ {{ error }}
        <button @click="loadAll" class="ml-2 underline cursor-pointer">重试</button>
      </div>

      <template v-else>
        <!-- ═══ Row 1：KPI 6 列（首屏） ═══ -->
        <KpiOverview :m="overview?.metrics" :w="overview?.window" :range-label="rangeLabel" :loading="loading" />

        <!-- ═══ Row 2：用户趋势 | 收入趋势 ═══ -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <UserTrendCard :data="users" :range-label="rangeLabel" @detail="openDrawer('user')" />
          <RevenueTrendCard :data="revenue" :range-label="rangeLabel" @detail="openDrawer('revenue')" />
        </div>

        <!-- ═══ Row 3：Workspace 生态 | Agent 运营 ═══ -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <WorkspaceMiniCard :data="workspace" @detail="openDrawer('workspace')" />
          <AgentMiniCard :agents="agents?.agents || []" :active-enterprises="agents?.activeEnterprises" @detail="openDrawer('agents')" />
        </div>

        <!-- ═══ Row 4：VIP 经营 | AI 健康 ═══ -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <VipMiniCard :data="vip" @detail="openDrawer('vip')" />
          <AiHealthMiniCard :providers="infra?.providers || []" :task-health="infra?.taskHealth" :model-count="infra?.modelCount"
            :dirty-data="infra?.dirtyData" :health="infra?.health" @detail="openDrawer('health')" />
        </div>

        <!-- ═══ Bottom：实时事件流（横向紧凑条） ═══ -->
        <ActivityStrip :events="events?.events || []" />

        <div class="text-center text-[8px] text-gray-700 pb-2">
          昆仑镜 v1.5 · ADMIN-IA-REALITY-04-C AI Operating Center · 时间范围联动 · Dashboard Reality Rule v1.1
        </div>
      </template>
    </div>

    <!-- ═══ 详情抽屉（完整分析，复用旧组件） ═══ -->
    <DetailDrawer :open="drawer !== null" :title="drawerTitle" :icon="drawerIcon" :subtitle="rangeLabel" @close="drawer = null">
      <!-- 用户详情 -->
      <template v-if="drawer === 'user'">
        <UserGrowthPanel :data="users" />
        <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5">
          <h4 class="text-xs font-semibold text-white/80 mb-3">🌍 用户区域分布</h4>
          <GeographyPanel :data="geography" />
        </div>
      </template>
      <!-- 收入详情 -->
      <template v-else-if="drawer === 'revenue'">
        <RevenueCockpit :data="revenue" />
      </template>
      <!-- Workspace 详情 -->
      <template v-else-if="drawer === 'workspace'">
        <WorkspaceChart :ranking="workspace?.ranking || []" :data="workspace" />
      </template>
      <!-- Agent 详情 -->
      <template v-else-if="drawer === 'agents'">
        <AgentRanking :agents="agents?.agents || []" :active-enterprises="agents?.activeEnterprises" />
      </template>
      <!-- VIP 详情 -->
      <template v-else-if="drawer === 'vip'">
        <VipPanel :data="vip" />
      </template>
      <!-- AI 健康详情 -->
      <template v-else-if="drawer === 'health'">
        <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5">
          <h4 class="text-xs font-semibold text-white/80 mb-3">⚡ AI 基础设施</h4>
          <AiHealthPanel :providers="infra?.providers || []" :runtime="infra?.runtime" :dirty-data="infra?.dirtyData" :data="infra" />
        </div>
        <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5">
          <h4 class="text-xs font-semibold text-white/80 mb-3">🖥️ 系统健康</h4>
          <SystemHealthPanel :data="infra" />
        </div>
      </template>
    </DetailDrawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getToken } from '~/utils/token-cache'

// 显式 import（Nuxt3 pathPrefix 命名，短名需显式导入）
import TimeRangeBar from '~/components/admin/dashboard/TimeRangeBar.vue'
import KpiOverview from '~/components/admin/dashboard/KpiOverview.vue'
import UserTrendCard from '~/components/admin/dashboard/UserTrendCard.vue'
import RevenueTrendCard from '~/components/admin/dashboard/RevenueTrendCard.vue'
import WorkspaceMiniCard from '~/components/admin/dashboard/WorkspaceMiniCard.vue'
import AgentMiniCard from '~/components/admin/dashboard/AgentMiniCard.vue'
import VipMiniCard from '~/components/admin/dashboard/VipMiniCard.vue'
import AiHealthMiniCard from '~/components/admin/dashboard/AiHealthMiniCard.vue'
import ActivityStrip from '~/components/admin/dashboard/ActivityStrip.vue'
import DetailDrawer from '~/components/admin/dashboard/DetailDrawer.vue'
// 详情抽屉复用（完整分析）
import UserGrowthPanel from '~/components/admin/dashboard/UserGrowthPanel.vue'
import GeographyPanel from '~/components/admin/dashboard/GeographyPanel.vue'
import RevenueCockpit from '~/components/admin/dashboard/RevenueCockpit.vue'
import WorkspaceChart from '~/components/admin/dashboard/WorkspaceChart.vue'
import AgentRanking from '~/components/admin/dashboard/AgentRanking.vue'
import VipPanel from '~/components/admin/dashboard/VipPanel.vue'
import AiHealthPanel from '~/components/admin/dashboard/AiHealthPanel.vue'
import SystemHealthPanel from '~/components/admin/dashboard/SystemHealthPanel.vue'

const range = ref('30d')
const loading = ref(false)
const error = ref('')

const overview = ref<any>(null)
const users = ref<any>(null)
const revenue = ref<any>(null)
const vip = ref<any>(null)
const workspace = ref<any>(null)
const geography = ref<any>(null)
const agents = ref<any>(null)
const infra = ref<any>(null)
const events = ref<any>(null)

const drawer = ref<string | null>(null)

const RANGE_LABELS: Record<string, string> = { today: '今天', '7d': '7天', '30d': '30天', '90d': '90天', year: '今年' }
const rangeLabel = computed(() => RANGE_LABELS[range.value] || range.value)

const drawerMeta: Record<string, { title: string; icon: string }> = {
  user: { title: '用户增长分析', icon: '📈' },
  revenue: { title: '收入经营分析', icon: '💰' },
  workspace: { title: 'Workspace 生态分析', icon: '🗺️' },
  agents: { title: 'Agent 运营分析', icon: '🤖' },
  vip: { title: 'VIP 经营分析', icon: '💎' },
  health: { title: 'AI 基础设施分析', icon: '🩺' },
}
const drawerTitle = computed(() => (drawer.value ? drawerMeta[drawer.value]?.title || '' : ''))
const drawerIcon = computed(() => (drawer.value ? drawerMeta[drawer.value]?.icon || '📊' : ''))

function openDrawer(key: string) { drawer.value = key }

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  const j = await res.json()
  if (j.code !== 0) throw new Error(`${url} → ${j.message || j.error || 'code != 0'}`)
  return j.data
}

async function loadAll() {
  loading.value = true
  error.value = ''
  const q = `?range=${range.value}`
  try {
    const [ov, us, rv, vp, ws, geo, ag, inf, ev] = await Promise.all([
      fetchJson(`/api/admin/dashboard/overview${q}`),
      fetchJson(`/api/admin/dashboard/users${q}`),
      fetchJson(`/api/admin/dashboard/revenue${q}`),
      fetchJson('/api/admin/dashboard/vip'),
      fetchJson('/api/admin/dashboard/workspace'),
      fetchJson('/api/admin/dashboard/geography'),
      fetchJson('/api/admin/dashboard/agents'),
      fetchJson('/api/admin/dashboard/infrastructure'),
      fetchJson('/api/admin/dashboard/events'),
    ])
    overview.value = ov; users.value = us; revenue.value = rv; vip.value = vp
    workspace.value = ws; geography.value = geo; agents.value = ag; infra.value = inf; events.value = ev
  } catch (e: any) {
    error.value = e.message || String(e)
  } finally {
    loading.value = false
  }
}

function onRangeChange(r: string) {
  range.value = r
  loadAll()
}

onMounted(loadAll)
</script>
