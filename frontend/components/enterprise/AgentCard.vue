<template>
  <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-5 space-y-4">
    <!-- 头部 -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="relative">
          <div class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl">
            {{ agentEmoji[agent.agentType] || '🤖' }}
          </div>
          <div
            :class="agent.status === 'active' ? 'bg-green-400' : 'bg-gray-500'"
            class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0D1328]"
          />
        </div>
        <div>
          <h3 class="text-sm font-semibold text-white">{{ agent.name }}</h3>
          <div class="text-xs text-gray-400">{{ agent.goal }}</div>
        </div>
      </div>
      <button
        @click="$emit('toggle')"
        :class="agent.status === 'active' ? 'text-red-400 hover:bg-red-500/10' : 'text-green-400 hover:bg-green-500/10'"
        class="text-xs px-3 py-1 rounded-lg border border-current transition"
      >
        {{ agent.status === 'active' ? '暂停' : '启用' }}
      </button>
    </div>

    <!-- 每日目标 -->
    <div class="space-y-1">
      <div class="flex justify-between text-xs text-gray-400">
        <span>每日目标</span>
        <span class="text-blue-400 font-medium">今日 {{ agent.todayCompleted || 0 }}/{{ agent.dailyTarget || 0 }}</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex-1 bg-[#060A18] rounded-full h-2 overflow-hidden">
          <div
            class="bg-gradient-to-r from-blue-500 to-cyan-400 h-2 rounded-full transition-all"
            :style="{ width: progressPercent + '%' }"
          />
        </div>
        <input
          type="number"
          :value="agent.dailyTarget"
          @change="$emit('update-target', parseInt($event.target.value) || 0)"
          class="w-14 bg-[#060A18] border border-[#1A2240] rounded px-2 py-1 text-xs text-center text-white focus:outline-none focus:border-blue-500"
          min="0"
          max="100"
        />
      </div>
    </div>

    <!-- 权限/工具标签 -->
    <div class="flex flex-wrap gap-1.5">
      <span
        v-for="perm in agent.permissions?.slice(0, 4)"
        :key="perm"
        class="text-[10px] bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded"
      >
        {{ permLabels[perm] || perm }}
      </span>
      <span v-if="agent.permissions?.length > 4" class="text-[10px] text-gray-500">
        +{{ agent.permissions.length - 4 }}
      </span>
    </div>

    <!-- 工作时间 + 模型 -->
    <div class="flex items-center gap-4 text-xs text-gray-500">
      <span>🕐 {{ agent.workingHours || '09:00-18:00' }}</span>
      <span>🧮 DeepSeek</span>
    </div>

    <!-- 老板备注 -->
    <div class="space-y-1">
      <div class="text-xs text-gray-500">老板备注:</div>
      <input
        type="text"
        :value="agent.managerNote"
        @change="$emit('update-note', $event.target.value)"
        placeholder="添加备注..."
        class="w-full bg-[#060A18] border border-[#1A2240] rounded px-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
      />
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  agent: { type: Object, required: true }
})

defineEmits(['toggle', 'update-target', 'update-note'])

const agentEmoji = {
  growth_director: '🧠',
  market_analyst: '📊',
  content_manager: '✍',
  customer_ops: '🤝',
  sales_assistant: '💼'
}

const permLabels = {
  market_analysis: '✓ 市场分析',
  content_planning: '✓ 内容规划',
  data_query: '✓ 数据查询',
  task_creation: '✓ 创建任务',
  content_creation: '✓ 内容创作',
  publish_approved_content: '✓ 内容发布',
  schedule_posts: '✓ 定时发布',
  customer_messaging: '✓ 客户沟通',
  response_automation: '✓ 自动回复',
  interaction_monitoring: '✓ 互动监控',
  lead_management: '✓ 线索管理',
  follow_up_scheduling: '✓ 跟进排期',
  data_analysis: '✓ 数据分析',
  report_generation: '✓ 报告生成',
  auto_pricing: '✗ 自动报价'
}

const progressPercent = computed(() => {
  const target = props.agent.dailyTarget || 1
  const completed = props.agent.todayCompleted || 0
  return Math.min(100, Math.round((completed / target) * 100))
})
</script>
