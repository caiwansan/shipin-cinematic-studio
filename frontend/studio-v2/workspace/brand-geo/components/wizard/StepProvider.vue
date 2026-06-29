<template>
  <div class="geo-wizard-step">
    <div v-if="loading" class="geo-wizard-provider-status">
      <span>检测 AI Provider 状态...</span>
    </div>
    <div v-else-if="configured" class="geo-wizard-provider-status geo-provider-ok">
      <div class="geo-provider-icon">✅</div>
      <div class="geo-provider-info">
        <strong>AI Provider 已配置</strong>
        <p>{{ providerName }}</p>
      </div>
    </div>
    <div v-else class="geo-wizard-provider-status geo-provider-missing">
      <div class="geo-provider-icon">⚠️</div>
      <div class="geo-provider-info">
        <strong>AI Provider 未配置</strong>
        <p>请先配置 AI Provider 以使用 GEO 分析功能</p>
      </div>
      <button class="geo-btn geo-btn-primary" @click="$emit('navigate', 'settings')">前往设置</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const emit = defineEmits(['configured', 'navigate'])

const loading = ref(true)
const configured = ref(false)
const providerName = ref('')

onMounted(async () => {
  try {
    const res = await fetch('/api/geo/dashboard/provider-status')
    const data = await res.json()
    configured.value = data.configured
    providerName.value = data.provider || ''
  } catch {
    configured.value = false
  } finally {
    loading.value = false
    emit('configured', configured.value)
  }
})
</script>
