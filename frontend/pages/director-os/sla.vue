<template><NuxtLayout name="workbench"><div class="max-w-6xl space-y-4">
  <h2 class="text-lg font-medium text-gray-200">📜 SLA 配置</h2>
  <div class="grid grid-cols-4 gap-4">
    <div v-for="(sla, tier) in slaConfig" :key="tier" class="p-4 bg-gray-900 rounded-lg border border-gray-800">
      <h4 class="text-sm font-bold mb-2" :class="sla.color">{{ tier }}</h4>
      <div class="space-y-2 text-xs">
        <div><span class="text-gray-500">漂移阈值:</span><span class="text-gray-200 ml-2">{{ sla.drift }}</span></div>
        <div><span class="text-gray-500">恢复阈值:</span><span class="text-gray-200 ml-2">{{ sla.recovery }}</span></div>
        <div><span class="text-gray-500">健康区间:</span><span class="text-gray-200 ml-2">{{ sla.healthRange }}</span></div>
      </div>
    </div>
  </div>
</div></NuxtLayout></template>
<script setup lang="ts">
const slaConfig = {
  LIGHT: { color: 'text-green-400', drift: '< 1%', recovery: '≥ 95%', healthRange: '74–100%' },
  MODERATE: { color: 'text-yellow-400', drift: '< 2%', recovery: '≥ 70%', healthRange: '40–73%' },
  HEAVY: { color: 'text-red-400', drift: '不保证', recovery: '不保证', healthRange: '< 39%' },
  SATURATION: { color: 'text-gray-600', drift: '7.5%+', recovery: '0%', healthRange: '0%' },
}
</script>
