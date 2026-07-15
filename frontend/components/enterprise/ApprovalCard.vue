<template>
  <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-5 hover:border-[#2A3560] transition">
    <!-- 头部 -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-3">
        <span class="text-xs bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded">
          {{ item.agentName || 'AI Agent' }}
        </span>
        <span class="text-xs text-gray-500">{{ platformLabels[item.platform] || item.platform }}</span>
        <span v-if="item.revisionCount > 0" class="text-xs bg-orange-500/10 text-orange-300 px-2 py-0.5 rounded">
          修改{{ item.revisionCount }}次
        </span>
      </div>
      <span :class="statusClass" class="text-xs px-2 py-1 rounded">
        {{ statusLabels[item.status] || item.status }}
      </span>
    </div>

    <!-- 标题 -->
    <h3 class="text-sm font-semibold text-white mb-2">{{ item.title }}</h3>

    <!-- 内容预览 -->
    <p class="text-xs text-gray-400 line-clamp-2 mb-3">{{ item.body }}</p>

    <!-- AI审核结果（修正3: 显示Agent身份） -->
    <div class="flex items-center gap-4 text-xs text-gray-500 mb-3">
      <span>
        🛡️ Content Safety: 
        <span :class="scoreClass">{{ item.aiReviewScore }}分</span>
      </span>
      <span v-if="item.aiReviewNote" class="text-gray-600 italic">{{ item.aiReviewNote }}</span>
    </div>

    <!-- 审批人信息 -->
    <div v-if="item.approverId" class="text-xs text-gray-600 mb-3">
      审批人: CEO | 时间: {{ formatTime(item.approvalAt) }}
      <span v-if="item.approvalNote" class="ml-2 text-gray-500">"{{ item.approvalNote }}"</span>
    </div>

    <!-- 操作按钮（仅待审批状态显示） -->
    <div v-if="item.status === 'wait_approval' || item.status === 'ai_review'" class="flex items-center gap-2 pt-2 border-t border-[#1A2240]">
      <button
        @click="$emit('approve', item.id)"
        class="bg-green-600/20 hover:bg-green-600/30 text-green-400 px-3 py-1.5 rounded-lg text-xs font-medium transition"
      >
        ✓ 批准发布
      </button>
      <button
        @click="$emit('revision', item.id)"
        class="bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 px-3 py-1.5 rounded-lg text-xs font-medium transition"
      >
        ↻ 要求修改
      </button>
      <button
        @click="$emit('reject', item.id)"
        class="bg-red-600/20 hover:bg-red-600/30 text-red-400 px-3 py-1.5 rounded-lg text-xs font-medium transition"
      >
        ✗ 拒绝
      </button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  item: { type: Object, required: true }
})

defineEmits(['approve', 'reject', 'revision'])

const platformLabels = {
  wechat_official: '公众号',
  wechat_work: '企微',
  douyin: '抖音',
  xiaohongshu: '小红书',
  kuaishou: '快手'
}

const statusLabels = {
  draft: '草稿',
  ai_review: 'AI复核中',
  wait_approval: '⏳ 待CEO审批',
  approved: '✅ 已批准',
  published: '🚀 已发布',
  rejected: '❌ 已拒绝',
  revision_required: '📝 需修改'
}

const statusClass = computed(() => {
  const map = {
    'wait_approval': 'bg-yellow-500/10 text-yellow-400',
    'ai_review': 'bg-blue-500/10 text-blue-400',
    'approved': 'bg-green-500/10 text-green-400',
    'rejected': 'bg-red-500/10 text-red-400',
    'revision_required': 'bg-orange-500/10 text-orange-400'
  }
  return map[props.item.status] || 'bg-gray-500/10 text-gray-400'
})

const scoreClass = computed(() => {
  const s = props.item.aiReviewScore
  if (s >= 80) return 'text-green-400'
  if (s >= 60) return 'text-yellow-400'
  return 'text-red-400'
})

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>
