<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-xs font-semibold text-white/80 flex items-center gap-2">🩺 AI 基础设施健康中心</h3>
      <span class="text-[9px] text-gray-600">实时 · 近24h</span>
    </div>

    <!-- Model Provider -->
    <div class="mb-5">
      <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Model Provider · {{ providers.length }}</div>
      <div class="grid grid-cols-2 gap-2">
        <div v-for="p in providers.slice(0, 8)" :key="p.id"
          class="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full" :class="statusDot(p.status)"></span>
            <span class="text-[11px] text-white/70">{{ p.name }}</span>
          </div>
          <span class="text-[9px] text-gray-600">{{ statusLabel(p.status) }}</span>
        </div>
        <div v-if="providers.length === 0" class="col-span-2 text-center text-[10px] text-gray-600 py-4">暂无 Provider 数据</div>
      </div>
    </div>

    <!-- Runtime -->
    <div>
      <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Agent Runtime</div>
      <div class="grid grid-cols-4 gap-2 text-center">
        <div class="px-2 py-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <div class="text-lg font-bold text-emerald-400 font-mono">{{ runtime.active }}</div>
          <div class="text-[9px] text-gray-600 mt-0.5">活跃</div>
        </div>
        <div class="px-2 py-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <div class="text-lg font-bold text-amber-400 font-mono">{{ runtime.paused }}</div>
          <div class="text-[9px] text-gray-600 mt-0.5">暂停</div>
        </div>
        <div class="px-2 py-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <div class="text-lg font-bold text-gray-400 font-mono">{{ runtime.stopped }}</div>
          <div class="text-[9px] text-gray-600 mt-0.5">停止</div>
        </div>
        <div class="px-2 py-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <div class="text-lg font-bold text-blue-400 font-mono">{{ runtime.totalTasks }}</div>
          <div class="text-[9px] text-gray-600 mt-0.5">累计任务</div>
        </div>
      </div>
      <div v-if="dirtyData?.dagExecutionCount > 0" class="mt-3 px-3 py-2 rounded-lg bg-amber-500/[0.06] border border-amber-500/20 text-[9px] text-amber-400/80">
        ⚠️ 已排除 {{ dirtyData.dagExecutionCount.toLocaleString() }} 条盘古斧调试台脏数据（dag_execution）
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  providers: any[]
  runtime: { active: number; paused: number; stopped: number; totalTasks: number }
  dirtyData?: { dagExecutionCount: number }
}>()

const statusDot = (s: string) => ({
  ok: 'bg-emerald-400',
  healthy: 'bg-emerald-400',
  failed: 'bg-red-400',
  decrypt_error: 'bg-red-400',
  disabled: 'bg-gray-500',
  untested: 'bg-amber-400',
}[s] || 'bg-gray-500')

const statusLabel = (s: string) => ({
  ok: '正常',
  healthy: '正常',
  failed: '失败',
  decrypt_error: '解密失败',
  disabled: '禁用',
  untested: '未测',
}[s] || s || '—')
</script>
