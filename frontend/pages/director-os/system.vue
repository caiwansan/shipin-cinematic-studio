<template><NuxtLayout name="workbench"><div class="max-w-6xl space-y-4">
  <h2 class="text-lg font-medium text-gray-200">⚙️ 系统设置</h2>
  <div class="grid grid-cols-2 gap-4">
    <div v-for="setting in settings" :key="setting.key" class="p-4 bg-gray-900 rounded-lg border border-gray-800">
      <div class="flex items-center justify-between">
        <div>
          <h4 class="text-sm font-medium text-gray-200">{{ setting.name }}</h4>
          <p class="text-xs text-gray-500 mt-0.5">{{ setting.desc }}</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" :checked="setting.enabled" class="sr-only peer" @change="setting.enabled = !setting.enabled" />
          <div class="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-700"></div>
        </label>
      </div>
      <p class="text-xs font-mono text-gray-600 mt-2">{{ setting.value }}</p>
    </div>
  </div>
</div></NuxtLayout></template>
<script setup lang="ts">
const settings = [
  { key: 'strict_determinism', name: '严格确定性模式', desc: '禁止所有非确定性操作', enabled: true, value: 'flag=strict' },
  { key: 'auto_repair', name: '自动修复', desc: '检测到故障自动执行修复管道', enabled: true, value: 'interval=5000ms' },
  { key: 'saturation_lock', name: '饱和锁定', desc: 'SATURATION 负载自动拒绝请求', enabled: true, value: 'threshold=75%' },
  { key: 'audit_all', name: '全审计模式', desc: '记录所有系统操作到审计日志', enabled: false, value: 'audit_level=all' },
  { key: 'chaos_mode', name: '混沌测试模式', desc: '注入随机故障用于压力测试', enabled: false, value: 'injection_rate=0.01' },
  { key: 'debug_trace', name: '详细 Trace', desc: '记录每个节点的完整执行轨迹', enabled: true, value: 'depth=full' },
]
</script>
