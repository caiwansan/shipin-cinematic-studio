<template><NuxtLayout name="workbench"><div class="max-w-6xl space-y-4">
  <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-xs text-yellow-400">
    ⚖️ 当前模块读取冻结治理数据，后续将迁移至新治理体系。
  </div>
  <h2 class="text-lg font-medium text-gray-200">⚖️ 治理规则</h2>
  <div class="grid grid-cols-2 gap-4">
    <div v-for="rule in rules" :key="rule.id" class="p-4 bg-gray-900 rounded-lg border border-gray-800">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-medium text-gray-200">{{ rule.name }}</h4>
        <span class="w-2 h-2 rounded-full" :class="rule.enabled ? 'bg-green-500' : 'bg-gray-600'" />
      </div>
      <p class="text-xs text-gray-500 mt-2">{{ rule.desc }}</p>
      <p class="text-xs text-gray-600 font-mono mt-1">{{ rule.config }}</p>
    </div>
  </div>
</div></NuxtLayout></template>
<script setup lang="ts">
const rules = [
  { id: 1, name: '速率限制', desc: '每用户每秒最大请求数', config: '100 req/s', enabled: true },
  { id: 2, name: '负载准入', desc: 'SATURATION 负载自动拒绝', config: 'saturation_lock=true', enabled: true },
  { id: 3, name: '确定性强制', desc: '禁止未注册的随机源', config: 'strict_determinism=true', enabled: true },
  { id: 4, name: '审计追踪', desc: '所有治理决策记录审计日志', config: 'audit_level=all', enabled: true },
]
</script>
