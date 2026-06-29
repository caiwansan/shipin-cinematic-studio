<template>
  <div class="geo-wizard-step" style="text-align:center;padding-top:24px">
    <div style="font-size:48px;margin-bottom:12px">🎉</div>
    <h3 style="color:#e0e0e0;margin:0 0 20px">GEO 分析完成</h3>
    <div class="geo-wizard-summary">
      <div class="geo-wizard-summary-item">
        <span class="geo-summary-label">KOs</span>
        <span class="geo-summary-value">{{ resultSummary.koCount }}</span>
      </div>
      <div class="geo-wizard-summary-item">
        <span class="geo-summary-label">实体</span>
        <span class="geo-summary-value">{{ resultSummary.entityCount }}</span>
      </div>
      <div class="geo-wizard-summary-item">
        <span class="geo-summary-label">关系</span>
        <span class="geo-summary-value">{{ resultSummary.relationCount }}</span>
      </div>
      <div class="geo-wizard-summary-item">
        <span class="geo-summary-label">关键词</span>
        <span class="geo-summary-value">{{ resultSummary.keywordCount }}</span>
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:16px;flex-wrap:wrap">
      <button class="geo-btn geo-btn-primary" @click="emit('navigate', 'knowledge-graph')">查看知识图谱</button>
      <button class="geo-btn geo-btn-secondary" @click="emit('navigate', 'knowledge')">查看 Knowledge</button>
      <button class="geo-btn geo-btn-secondary" @click="emit('navigate', 'brand-detail')">查看品牌详情</button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  resultSummary: {
    type: Object,
    default: () => ({
      koCount: 0,
      entityCount: 0,
      relationCount: 0,
      keywordCount: 0
    })
  },
  brandName: { type: String, default: '' }
})

const emit = defineEmits(['navigate'])
</script>
