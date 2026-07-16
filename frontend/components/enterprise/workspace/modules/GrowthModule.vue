<template>
  <div class="growth-module">
    <section class="stats-row">
      <div class="stat-item"><span class="stat-value">{{ revenue }}</span><span class="stat-label">本月收入</span></div>
      <div class="stat-item"><span class="stat-value text-green">{{ customerGrowth }}%</span><span class="stat-label">客户增长</span></div>
      <div class="stat-item"><span class="stat-value">{{ conversion }}%</span><span class="stat-label">转化率</span></div>
      <div class="stat-item"><span class="stat-value">{{ roi }}x</span><span class="stat-label">ROI</span></div>
    </section>
    <section class="section">
      <h2 class="section-title">增长趋势</h2>
      <EmptyState icon="📈" title="数据积累中" description="连接渠道后，收入、客户、转化数据将在此呈现。" helper-text="支持 WeCom 渠道、官网、私域数据"
      :action="'连接数据源'" />
    </section>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import EmptyState from '~/components/enterprise-ui/feedback/EmptyState.vue'
const revenue = ref('¥0')
const customerGrowth = ref(0)
const conversion = ref(0)
const roi = ref(0)
onMounted(() => { /* TODO: 接入 Growth Analytics API */ })
</script>
<style scoped>
.growth-module { display: flex; flex-direction: column; gap: var(--space-lg); }
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-md); }
.stat-item { background: var(--color-bg-secondary); border: 1px solid var(--color-border-primary); border-radius: var(--radius-lg); padding: var(--space-lg); display: flex; flex-direction: column; align-items: center; }
.stat-value { font-size: var(--font-size-xl); font-weight: 700; color: var(--color-intelligence); }
.stat-value.text-green { color: #10b981; }
.stat-label { font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: var(--space-xs); }
.section { background: var(--color-bg-secondary); border: 1px solid var(--color-border-primary); border-radius: var(--radius-xl); padding: var(--space-xl); }
.section-title { font-size: var(--font-size-lg); font-weight: 600; margin-bottom: var(--space-lg); color: var(--color-text-primary); }
@media (max-width: 768px) { .stats-row { grid-template-columns: repeat(2, 1fr); } }
</style>
