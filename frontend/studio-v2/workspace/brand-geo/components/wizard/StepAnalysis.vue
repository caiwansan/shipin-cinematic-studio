<template>
  <div class="geo-wizard-step">
    <div class="geo-wizard-summary">
      <div class="geo-wizard-summary-item">
        <span class="geo-summary-label">品牌</span>
        <span class="geo-summary-value">{{ summary.name || '未设置' }}</span>
      </div>
      <div class="geo-wizard-summary-item">
        <span class="geo-summary-label">官网</span>
        <span class="geo-summary-value">{{ summary.websiteUrl || '未设置' }}</span>
      </div>
      <div class="geo-wizard-summary-item">
        <span class="geo-summary-label">关键词</span>
        <span class="geo-summary-value">{{ summary.keywordCount }} 个</span>
      </div>
      <div class="geo-wizard-summary-item">
        <span class="geo-summary-label">扫描深度</span>
        <span class="geo-summary-value">{{ summary.deepScan ? '深度扫描' : '标准' }}</span>
      </div>
      <div class="geo-wizard-summary-item">
        <span class="geo-summary-label">AI Provider</span>
        <span class="geo-summary-value" :class="summary.providerConfigured ? 'text-green' : 'text-warning'">
          {{ summary.providerConfigured ? '已配置 ✅' : '未配置 ⚠️' }}
        </span>
      </div>
    </div>
    <button
      class="geo-btn geo-btn-primary geo-btn-lg"
      style="width:100%;margin-top:12px"
      :disabled="!summary.providerConfigured || !summary.name"
      @click="emit('start')"
    >
      🚀 开始 GEO 分析
    </button>
  </div>
</template>

<script setup>
defineProps({
  summary: {
    type: Object,
    default: () => ({
      name: '',
      websiteUrl: '',
      keywordCount: 0,
      deepScan: false,
      providerConfigured: false
    })
  }
})

const emit = defineEmits(['start'])
</script>
