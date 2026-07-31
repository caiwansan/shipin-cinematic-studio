<!--
  @deprecated
  Reality Recovery Phase5
  Production path unused — 依赖 /api/repair、/api/trace/:id、/api/replay（后端 gateway 层未注册，404）。
  保留：旧调试台，勿删除。
-->
<template>
  <NuxtLayout name="workbench">
    <div class="space-y-6 max-w-6xl">
      <div class="grid grid-cols-2 gap-6">
        <!-- 漂移曲线 (实时数据) -->
        <div class="p-4 bg-gray-900 rounded-lg border border-gray-800">
          <h3 class="text-sm font-medium text-gray-300 mb-3">
            📈 漂移曲线 (Drift Curve)
            <span class="text-xs text-gray-600 ml-2">实时: {{ (store.driftRate * 100).toFixed(2) }}%</span>
          </h3>
          <div class="h-48 bg-gray-950 rounded relative overflow-hidden">
            <svg class="w-full h-full" viewBox="0 0 300 150" preserveAspectRatio="none">
              <!-- 网格 -->
              <line x1="0" y1="0" x2="0" y2="150" stroke="#1f2937" stroke-width="1"/>
              <line x1="0" y1="150" x2="300" y2="150" stroke="#1f2937" stroke-width="1"/>
              <!-- 安全阈值线 -->
              <line x1="0" y1="15" x2="300" y2="15" stroke="#22c55e" stroke-width="1" stroke-dasharray="4,4" opacity="0.3"/>
              <line x1="0" y1="45" x2="300" y2="45" stroke="#eab308" stroke-width="1" stroke-dasharray="4,4" opacity="0.3"/>
              <line x1="0" y1="120" x2="300" y2="120" stroke="#ef4444" stroke-width="1" stroke-dasharray="4,4" opacity="0.3"/>
              <!-- 漂移曲线 (动态) -->
              <polyline
                :points="driftPathPoints"
                fill="none"
                stroke="#22d3ee"
                stroke-width="2"
              />
              <!-- 当前漂移点 -->
              <circle
                :cx="driftCurrentX"
                :cy="driftCurrentY"
                r="4"
                fill="#22d3ee"
                stroke="#0f172a"
                stroke-width="2"
              />
            </svg>
          </div>
          <div class="flex justify-between mt-2 text-xs text-gray-500">
            <span>🟢 LIGHT {{ '< 1%' }}</span>
            <span>🟡 MODERATE {{ '< 2%' }}</span>
            <span>🔴 HEAVY</span>
          </div>
        </div>

        <!-- SLA 合规仪表 (实时) -->
        <div class="p-4 bg-gray-900 rounded-lg border border-gray-800">
          <h3 class="text-sm font-medium text-gray-300 mb-3">✅ SLA 合规度 (实时)</h3>
          <div class="space-y-4">
            <div v-for="sla in slaMetrics" :key="sla.name" class="space-y-1">
              <div class="flex justify-between text-xs">
                <span class="text-gray-400">{{ sla.name }}</span>
                <span :class="sla.passing ? 'text-green-400' : 'text-red-400'">{{ sla.currentValue }}</span>
              </div>
              <div class="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="sla.passing ? 'bg-green-600' : 'bg-red-600'"
                  :style="{ width: sla.barPercent + '%' }"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 系统状态摘要 -->
        <div class="p-4 bg-gray-900 rounded-lg border border-gray-800 col-span-2">
          <h3 class="text-sm font-medium text-gray-300 mb-3">📋 系统状态摘要</h3>
          <div class="grid grid-cols-4 gap-4 text-sm">
            <div class="p-3 bg-gray-950 rounded-lg">
              <div class="text-gray-500 text-xs">当前负载</div>
              <div class="font-bold mt-1" :class="loadTierColor(store.loadTier)">{{ store.loadTier }}</div>
            </div>
            <div class="p-3 bg-gray-950 rounded-lg">
              <div class="text-gray-500 text-xs">认证状态</div>
              <div class="font-bold mt-1 text-yellow-400 text-xs">{{ store.certStatus.replace(/_/g, ' ') }}</div>
            </div>
            <div class="p-3 bg-gray-950 rounded-lg">
              <div class="text-gray-500 text-xs">健康等级</div>
              <div class="font-bold mt-1 text-cyan-400">{{ store.healthGrade }}</div>
            </div>
            <div class="p-3 bg-gray-950 rounded-lg">
              <div class="text-gray-500 text-xs">SSE 连接</div>
              <div class="font-bold mt-1" :class="sse.connected.value ? 'text-green-400' : 'text-red-400'">
                {{ sse.connected.value ? '已连接' : '断开' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { useWorkbenchStore } from '~/stores/workbench'
import { useSSEStream } from '~/composables/useSSEStream'
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'

const store = useWorkbenchStore()
const sse = useSSEStream(false)

onMounted(() => {
  store.startHealthPolling(5000)
})

onUnmounted(() => {
  store.stopHealthPolling()
})

// 漂移曲线点集（随时间滑动）
const driftHistory = ref<number[]>(Array(20).fill(0.004))

watch(() => store.driftRate, (val) => {
  driftHistory.value.push(val)
  if (driftHistory.value.length > 30) driftHistory.value.shift()
})

const driftPathPoints = computed(() => {
  return driftHistory.value.map((d, i) => {
    const x = (i / (driftHistory.value.length - 1)) * 290 + 5
    const y = 145 - (d / 0.075) * 130
    return `${x},${Math.max(5, Math.min(145, y))}`
  }).join(' ')
})

const driftCurrentX = computed(() => 295)
const driftCurrentY = computed(() => {
  const d = store.driftRate
  return Math.max(5, Math.min(145, 145 - (d / 0.075) * 130))
})

// 实时 SLA 指标
const slaMetrics = computed(() => [
  {
    name: 'Drift ≤ 1%',
    currentValue: `${(store.driftRate * 100).toFixed(2)}%`,
    barPercent: Math.min(100, (1 - store.driftRate) * 100),
    passing: store.driftRate < 0.01
  },
  {
    name: 'Recovery ≥ 90%',
    currentValue: `${(store.recoveryRate * 100).toFixed(1)}%`,
    barPercent: Math.min(100, store.recoveryRate * 100),
    passing: store.recoveryRate >= 0.9
  },
  {
    name: 'Health ≥ 74%',
    currentValue: `${store.healthScore.toFixed(1)}%`,
    barPercent: Math.min(100, store.healthScore),
    passing: store.healthScore >= 74
  }
])

function loadTierColor(tier: string) {
  switch (tier) {
    case 'LIGHT': return 'text-green-400'
    case 'MODERATE': return 'text-yellow-400'
    case 'HEAVY': return 'text-red-400'
    case 'SATURATION': return 'text-gray-600'
    default: return 'text-gray-400'
  }
}
</script>
