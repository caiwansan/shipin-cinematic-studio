<template>
  <NuxtLayout name="workbench">
    <div class="space-y-6 max-w-6xl">
      <div class="p-4 bg-gray-900 rounded-lg border border-gray-800">
        <h3 class="text-sm font-medium text-gray-300 mb-4">📊 用量概览 (Usage Dashboard)</h3>
        <div class="grid grid-cols-4 gap-4">
          <div class="p-3 bg-gray-950 rounded-lg">
            <div class="text-xs text-gray-500">本月执行次数</div>
            <div class="text-xl font-bold text-cyan-400 mt-1">{{ monthlyExecutions }}</div>
          </div>
          <div class="p-3 bg-gray-950 rounded-lg">
            <div class="text-xs text-gray-500">本月 AI 调用</div>
            <div class="text-xl font-bold text-purple-400 mt-1">{{ monthlyAICalls }}</div>
          </div>
          <div class="p-3 bg-gray-950 rounded-lg">
            <div class="text-xs text-gray-500">本月存储用量</div>
            <div class="text-xl font-bold text-green-400 mt-1">{{ monthlyStorage }}</div>
          </div>
          <div class="p-3 bg-gray-950 rounded-lg">
            <div class="text-xs text-gray-500">预估费用</div>
            <div class="text-xl font-bold text-yellow-400 mt-1">{{ estimatedCost }}</div>
          </div>
        </div>
      </div>

      <div class="p-4 bg-gray-900 rounded-lg border border-gray-800">
        <h3 class="text-sm font-medium text-gray-300 mb-4">📋 最近用量记录</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-gray-500 uppercase text-xs">
                <th class="text-left pb-2">时间</th>
                <th class="text-left pb-2">类型</th>
                <th class="text-left pb-2">项目</th>
                <th class="text-right pb-2">费用</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in usageLogs" :key="log.id" class="border-t border-gray-800">
                <td class="py-2 text-gray-400">{{ new Date(log.createdAt).toLocaleString() }}</td>
                <td class="py-2">
                  <span class="px-2 py-0.5 rounded text-xs" :class="typeColor(log.taskType)">{{ log.taskType }}</span>
                </td>
                <td class="py-2 text-gray-300">{{ log.projectId || '-' }}</td>
                <td class="py-2 text-right text-gray-300">{{ log.cost.toFixed(2) }}</td>
              </tr>
              <tr v-if="usageLogs.length === 0">
                <td colspan="4" class="py-4 text-center text-gray-600">暂无用量记录</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="p-4 bg-gray-900 rounded-lg border border-gray-800">
        <h3 class="text-sm font-medium text-gray-300 mb-4">💳 当前套餐</h3>
        <div class="flex items-center justify-between">
          <div>
            <span class="text-lg font-bold text-white capitalize">{{ currentPlan }}</span>
            <span class="text-xs text-gray-500 ml-2">SLA: {{ slaTier }}</span>
          </div>
          <button class="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm text-white transition-colors">
            升级套餐 →
          </button>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
const monthlyExecutions = ref(0)
const monthlyAICalls = ref(0)
const monthlyStorage = ref('0 MB')
const estimatedCost = ref('¥0.00')
const usageLogs = ref<any[]>([])
const currentPlan = ref('free')
const slaTier = ref('SLA_C')

onMounted(async () => {
  try {
    const res = await fetch('/api/usage')
    const data = await res.json()
    monthlyExecutions.value = data.monthlyExecutions || 0
    monthlyAICalls.value = data.monthlyAICalls || 0
    monthlyStorage.value = data.monthlyStorage || '0 MB'
    estimatedCost.value = data.estimatedCost || '¥0.00'
    usageLogs.value = data.logs || []
    currentPlan.value = data.plan || 'free'
    slaTier.value = data.slaTier || 'SLA_C'
  } catch {}
})

function typeColor(type: string) {
  switch (type) {
    case 'dag_execution': return 'bg-cyan-900 text-cyan-300'
    case 'ai_call': return 'bg-purple-900 text-purple-300'
    case 'storage': return 'bg-green-900 text-green-300'
    default: return 'bg-gray-800 text-gray-400'
  }
}
</script>
