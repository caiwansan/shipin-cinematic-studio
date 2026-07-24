<template>
  <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4 space-y-3">
    <div class="flex items-center justify-between">
      <h4 class="text-sm font-semibold text-white">模型配置</h4>
      <span class="text-[10px] bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full font-medium">
        BYOK
      </span>
    </div>

    <!-- Active Model -->
    <div v-if="activeBinding" class="bg-[#060A18] rounded-lg p-3 space-y-2">
      <div class="flex items-center gap-2">
        <span class="text-lg">{{ providerEmoji[activeBinding.provider] || '🔮' }}</span>
        <div>
          <div class="text-sm font-medium text-white">{{ activeBinding.modelName }}</div>
          <div class="text-[11px] text-gray-500">来源: 企业 API Key（加密存储）</div>
        </div>
      </div>
      <div class="flex items-center gap-4 text-[11px] text-gray-500">
        <span>温度: {{ activeBinding.temperature || 0.7 }}</span>
        <span>最大 Token: {{ activeBinding.maxTokens || 16384 }}</span>
      </div>
    </div>

    <div v-else class="bg-[#060A18] rounded-lg p-3 text-center">
      <div class="text-xs text-gray-500">尚未绑定模型</div>
      <div class="text-[10px] text-yellow-400 mt-1">请在企业 AI 模型中心接入 API Key</div>
    </div>

    <!-- Model Selection (P0-2: 切换模型) -->
    <div v-if="bindings.length > 0" class="space-y-2">
      <div class="text-[11px] text-gray-500 font-medium">选择默认模型</div>
      <div class="space-y-1">
        <label
          v-for="b in bindings"
          :key="b.id"
          class="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition"
          :class="b.enabled ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-[#060A18] border border-transparent hover:border-gray-700'"
        >
          <input
            type="radio"
            :checked="b.enabled"
            :name="`model-${employeeId}`"
            class="accent-blue-500"
            @change="setDefaultModel(b.id)"
          />
          <span class="text-sm">{{ providerEmoji[b.provider] || '🔮' }}</span>
          <div class="flex-1">
            <div class="text-xs font-medium text-white">{{ b.modelName }}</div>
            <div class="text-[10px] text-gray-500">{{ b.provider }}</div>
          </div>
          <span v-if="b.enabled" class="text-[10px] text-blue-400 font-medium">当前默认</span>
        </label>
      </div>
    </div>

    <!-- Empty State: No Bindings -->
    <div v-if="bindings.length === 0" class="bg-[#060A18] rounded-lg p-4 text-center space-y-2">
      <div class="text-xs text-gray-500">还没有绑定任何模型</div>
      <button
        class="text-xs text-blue-400 hover:text-blue-300 py-1 px-3 border border-blue-500/20 rounded-lg hover:bg-blue-500/5 transition"
        @click="$emit('add-binding')"
      >
        + 绑定第一个模型
      </button>
    </div>

    <!-- Switching indicator -->
    <div v-if="switching" class="text-center">
      <span class="text-[10px] text-blue-400 animate-pulse">正在切换模型...</span>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  bindings: { type: Array, default: () => [] },
  activeBinding: { type: Object, default: null },
  employeeId: { type: String, default: '' }
})

defineEmits(['add-binding'])

const switching = ref(false)

const providerEmoji = {
  deepseek: '🐋',
  openai: '🟢',
  claude: '🟠',
  qwen: '🌐',
  zhipu: '🧠',
  kimi: '🌙'
}

async function setDefaultModel(bindingId) {
  if (switching.value) return
  switching.value = true
  try {
    const res = await fetch(`/api/enterprise/agent-identity/model-bindings/${bindingId}/enable`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      // 更新本地状态
      props.bindings.forEach(b => { b.enabled = b.id === bindingId })
      // 触发父组件刷新
      window.dispatchEvent(new CustomEvent('model-binding-changed', { detail: { bindingId } }))
    }
  } catch (e) {
    console.error('[AgentModelCard] Switch model failed:', e)
  } finally {
    switching.value = false
  }
}
</script>
