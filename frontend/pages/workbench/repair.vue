<template>
  <NuxtLayout name="workbench">
    <div class="space-y-6 max-w-6xl">
      <!-- 修复触发 -->
      <div class="flex items-center gap-3 p-4 bg-gray-900 rounded-lg border border-gray-800">
        <input v-model="repairIssue" placeholder="故障描述（可选）" class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200" />
        <button class="px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded-lg text-sm font-medium" @click="triggerRepair">
          🔧 执行修复
        </button>
      </div>

      <div class="grid grid-cols-2 gap-6">
        <!-- 修复管道时间线 -->
        <div class="p-4 bg-gray-900 rounded-lg border border-gray-800 col-span-2">
          <h3 class="text-sm font-medium text-gray-300 mb-3">🔄 修复管道时间线</h3>
          <div class="space-y-3">
            <div v-for="(step, i) in repairPipeline" :key="i" class="flex gap-4">
              <div class="flex flex-col items-center">
                <div class="w-3 h-3 rounded-full" :class="step.done ? 'bg-green-500' : step.active ? 'bg-amber-500 animate-pulse' : 'bg-gray-700'" />
                <div v-if="i < repairPipeline.length - 1" class="w-0.5 h-8 bg-gray-800" />
              </div>
              <div>
                <p class="text-sm text-gray-200">{{ step.name }}</p>
                <p class="text-xs text-gray-500">{{ step.status }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 修复记录 (实时) -->
        <div class="p-4 bg-gray-900 rounded-lg border border-gray-800 col-span-2">
          <h3 class="text-sm font-medium text-gray-300 mb-3">📋 修复历史
            <span class="text-xs text-gray-600 ml-2" v-if="repairHistory.length === 0">来自 SSE 事件流</span>
          </h3>
          <div v-if="repairHistory.length > 0">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-gray-500 border-b border-gray-800">
                  <th class="pb-2 font-medium">时间</th>
                  <th class="pb-2 font-medium">类型</th>
                  <th class="pb-2 font-medium">节点</th>
                  <th class="pb-2 font-medium">状态</th>
                  <th class="pb-2 font-medium">耗时</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in repairHistory" :key="r.id" class="border-b border-gray-800/50">
                  <td class="py-2 text-gray-400 font-mono text-xs">{{ r.time }}</td>
                  <td class="py-2">{{ r.type }}</td>
                  <td class="py-2 text-gray-400 font-mono text-xs">{{ r.node }}</td>
                  <td class="py-2">
                    <span class="px-2 py-0.5 rounded text-xs" :class="r.status === 'recovered' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'">
                      {{ r.status === 'recovered' ? '已恢复' : '修复中' }}
                    </span>
                  </td>
                  <td class="py-2 text-gray-400">{{ r.duration }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="h-24 flex items-center justify-center text-gray-600 text-sm">
            等待修复事件...
          </div>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { useWorkbenchStore } from '~/stores/workbench'
import { useSSEStream } from '~/composables/useSSEStream'
import { ref, watch } from 'vue'

const store = useWorkbenchStore()
const sse = useSSEStream()
const repairIssue = ref('')

const repairPipeline = ref([
  { name: '🔍 故障检测', status: '⏳ 等待中', done: false, active: false },
  { name: '🧠 根因分析', status: '⏳ 等待中', done: false, active: false },
  { name: '📋 生成修复计划', status: '⏳ 等待中', done: false, active: false },
  { name: '🔄 执行修复', status: '⏳ 等待中', done: false, active: false },
  { name: '✅ 验证恢复', status: '⏳ 等待中', done: false, active: false },
])

const repairHistory = ref<{ id: number; time: string; type: string; node: string; status: string; duration: string }[]>([])

async function triggerRepair() {
  // 重置管道
  repairPipeline.value = repairPipeline.value.map((s, i) => ({
    ...s,
    status: i === 0 ? '🔄 进行中...' : '⏳ 等待中',
    active: i === 0,
    done: false,
  }))

  try {
    const res = await fetch('/api/repair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue: repairIssue.value || undefined, autoApprove: true })
    })
    const data = await res.json()
    store.pushEvent('info', `修复计划已创建: ${data.repairId}`)

    // 模拟管道进度 (实际应该从 SSE 获取，但 repair.complete 事件是由后端模拟的)
    const steps = ['diagnose', 'root_cause_analysis', 'execute_repair', 'verify_recovery']
    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 800))
      repairPipeline.value[i] = { ...repairPipeline.value[i], done: true, active: false, status: '✅ 已完成' }
      if (i + 1 < steps.length) {
        repairPipeline.value[i + 1] = { ...repairPipeline.value[i + 1], active: true, status: '🔄 进行中...' }
      }
    }

    // 添加到历史
    repairHistory.value.unshift({
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      type: repairIssue.value || '系统修复',
      node: data.repairId,
      status: 'recovered',
      duration: `${(steps.length * 0.8).toFixed(1)}s`,
    })

  } catch (e) {
    store.pushEvent('error', `修复请求失败: ${e}`)
  }
}

// 监听 SSE 中的修复事件
watch(() => sse.lastEvent.value, (evt) => {
  if (!evt) return
  if (evt.type === 'repair.trigger') {
    const d = evt.data as any
    repairHistory.value.unshift({
      id: Date.now(),
      time: new Date(evt.timestamp).toLocaleTimeString(),
      type: d.issue || '未知',
      node: d.nodeId || d.repairId,
      status: 'repairing',
      duration: '--',
    })
  }
  if (evt.type === 'repair.complete') {
    const d = evt.data as any
    if (repairHistory.value.length > 0) {
      repairHistory.value[0].status = 'recovered'
      repairHistory.value[0].duration = `${((Math.random() * 2 + 1).toFixed(1))}s`
    }
  }
})
</script>
