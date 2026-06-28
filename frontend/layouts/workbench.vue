<template>
  <div class="flex h-screen bg-gray-950 text-gray-100">
    <!-- 左侧导航 -->
    <aside class="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div class="p-4 border-b border-gray-800">
        <h1 class="text-lg font-bold text-cyan-400">⚔️ 盘古斧</h1>
        <p class="text-xs text-gray-500 mt-1">AI Execution OS · Workbench</p>
      </div>

      <nav class="flex-1 p-2 space-y-1">
        <NuxtLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
          :class="isActive(item.path) ? 'bg-cyan-900/40 text-cyan-300 border border-cyan-800/50' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'"
        >
          <span class="text-lg">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <!-- 系统状态 (实时) -->
      <div class="p-3 border-t border-gray-800 text-xs space-y-1">
        <div class="flex justify-between">
          <span class="text-gray-500">负载等级</span>
          <span class="font-mono" :class="loadTierColor(store.loadTier)">{{ store.loadTier }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">健康度</span>
          <span class="text-cyan-400 font-mono">{{ store.healthScore.toFixed(1) }}%</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">漂移率</span>
          <span class="text-yellow-400 font-mono">{{ (store.driftRate * 100).toFixed(2) }}%</span>
        </div>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="flex-1 flex flex-col overflow-hidden">
      <header class="h-12 bg-gray-900/50 border-b border-gray-800 flex items-center justify-between px-6">
        <div class="text-sm text-gray-400">
          {{ currentTitle }}
        </div>
        <div class="flex items-center gap-3">
          <span class="px-2 py-0.5 text-xs rounded bg-gray-800 text-gray-400 font-mono">v6.0.0</span>
          <span class="w-2 h-2 rounded-full bg-green-500" title="Runtime Online"></span>
        </div>
      </header>

      <div class="flex-1 overflow-auto p-6">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useWorkbenchStore } from '~/stores/workbench'

const route = useRoute()
const store = useWorkbenchStore()

const navItems = [
  { path: '/workbench/console', icon: '🎮', label: '控制台' },
  { path: '/workbench/dag', icon: '🔀', label: 'DAG Studio' },
  { path: '/workbench/health', icon: '📊', label: '系统健康' },
  { path: '/workbench/repair', icon: '🔧', label: '修复系统' },
  { path: '/workbench/trace', icon: '🔍', label: 'Trace 查看器' },
]

const titles: Record<string, string> = {
  '/workbench/console': 'Runtime 控制台',
  '/workbench/dag': 'DAG Studio — 执行图编辑器',
  '/workbench/health': '系统健康中心',
  '/workbench/repair': '修复系统',
  '/workbench/trace': 'Trace 查看器',
}

const currentTitle = computed(() => titles[route.path] || '盘古斧 Workbench')

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + '/')
}

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

<style scoped>
/* 滚动条样式 */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #374151; border-radius: 3px; }
</style>
