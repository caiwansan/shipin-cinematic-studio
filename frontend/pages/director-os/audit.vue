<template><NuxtLayout name="workbench"><div class="max-w-6xl space-y-4">
  <h2 class="text-lg font-medium text-gray-200">📋 审计日志</h2>
  <div class="bg-gray-900 rounded-lg border border-gray-800 p-4">
    <table class="w-full text-sm">
      <thead><tr class="text-left text-gray-500 border-b border-gray-800"><th class="pb-2 font-medium">时间</th><th class="pb-2 font-medium">动作</th><th class="pb-2 font-medium">操作者</th><th class="pb-2 font-medium">详情</th></tr></thead>
      <tbody>
        <tr v-for="l in logs" :key="l.id" class="border-b border-gray-800/50">
          <td class="py-2 text-gray-400 font-mono text-xs">{{ l.time }}</td>
          <td class="py-2"><span class="px-2 py-0.5 rounded text-xs" :class="logColor(l.action)">{{ l.action }}</span></td>
          <td class="py-2 text-gray-400 text-xs font-mono">{{ l.user }}</td>
          <td class="py-2 text-gray-500 text-xs">{{ l.detail }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</div></NuxtLayout></template>
<script setup lang="ts">
const logs = [
  { id: 1, time: '10:23:15', action: 'governance.rule_update', user: 'admin', detail: '速率限制从 50→100 req/s' },
  { id: 2, time: '10:18:42', action: 'sla.threshold_change', user: 'admin', detail: 'LIGHT 漂移阈值调整为 0.5%' },
  { id: 3, time: '10:12:07', action: 'repair.approve', user: 'ops-01', detail: '批准快照链修复 plan_0x3F2A' },
  { id: 4, time: '09:55:30', action: 'system.mode_change', user: 'admin', detail: '切换至 production 模式' },
]
function logColor(action: string) {
  if (action.includes('rule') || action.includes('threshold')) return 'bg-yellow-900/50 text-yellow-400'
  if (action.includes('repair')) return 'bg-green-900/50 text-green-400'
  if (action.includes('mode')) return 'bg-blue-900/50 text-blue-400'
  return 'bg-gray-800 text-gray-400'
}
</script>
