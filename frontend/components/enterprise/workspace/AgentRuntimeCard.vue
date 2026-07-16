<template>
  <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4 space-y-3">
    <div class="flex items-center justify-between">
      <h4 class="text-sm font-semibold text-white">运行环境</h4>
      <span
        :class="statusClass"
        class="text-[10px] px-2 py-0.5 rounded-full font-medium"
      >
        {{ statusLabel }}
      </span>
    </div>

    <div class="space-y-2 text-xs">
      <div class="flex justify-between">
        <span class="text-gray-500">Runtime</span>
        <span class="text-gray-300">{{ runtime?.runtime || 'OpenClaw' }}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-500">状态</span>
        <span :class="statusTextClass">{{ statusLabel }}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-500">Namespace</span>
        <span class="text-gray-400 font-mono text-[11px]">{{ runtime?.namespace || '—' }}</span>
      </div>
      <div v-if="runtime?.lastActiveAt" class="flex justify-between">
        <span class="text-gray-500">最后心跳</span>
        <span class="text-gray-400">{{ formatTime(runtime.lastActiveAt) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  runtime: { type: Object, default: null }
})

const statusLabel = computed(() => {
  const s = props.runtime?.runtimeStatus || 'stopped'
  if (s === 'active' || s === 'running') return '运行中'
  if (s === 'paused') return '已暂停'
  return '已停止'
})

const statusClass = computed(() => {
  const s = props.runtime?.runtimeStatus || 'stopped'
  if (s === 'active' || s === 'running') return 'bg-green-500/10 text-green-400'
  if (s === 'paused') return 'bg-yellow-500/10 text-yellow-400'
  return 'bg-gray-500/10 text-gray-400'
})

const statusTextClass = computed(() => {
  const s = props.runtime?.runtimeStatus || 'stopped'
  if (s === 'active' || s === 'running') return 'text-green-400'
  if (s === 'paused') return 'text-yellow-400'
  return 'text-gray-400'
})

function formatTime(date) {
  if (!date) return '—'
  const d = new Date(date)
  const now = new Date()
  const diffMs = now - d
  if (diffMs < 60000) return '刚刚'
  if (diffMs < 3600000) return Math.floor(diffMs / 60000) + ' 分钟前'
  if (diffMs < 86400000) return Math.floor(diffMs / 3600000) + ' 小时前'
  return d.toLocaleDateString('zh-CN')
}
</script>
