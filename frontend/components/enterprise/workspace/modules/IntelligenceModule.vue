<template>
  <div class="intelligence-module">
    <!-- KPI -->
    <section class="kpi-section">
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-value">{{ signalStats.total }}</span>
          <span class="kpi-label">今日信号</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-value" style="color: var(--color-danger)">{{ signalStats.high }}</span>
          <span class="kpi-label">高风险信号</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-value" style="color: var(--color-warning)">{{ signalStats.medium }}</span>
          <span class="kpi-label">注意信号</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-value" style="color: var(--color-execution)">{{ signalStats.opportunity }}</span>
          <span class="kpi-label">机会信号</span>
        </div>
      </div>
    </section>

    <!-- Signal Stream -->
    <section class="section">
      <h2 class="section-title">今日企业信号</h2>
      <div v-if="signals.length > 0" class="signal-stream">
        <SignalCard
          v-for="signal in signals"
          :key="signal.id"
          :signal-type="signal.signalType"
          :severity="signal.severity"
          :description="signal.description"
          :detected-at="signal.detectedAt"
          :source-events="signal.sourceEvents"
          @view="handleViewSignal(signal.id)"
          @generate-decision="handleGenerateDecision(signal.id)"
        />
      </div>
      <EmptyState
        v-else
        icon="🔍"
        title="暂无企业信号"
        description="AI 引擎正在持续监控企业经营数据，发现风险和机会将立即通知您。"
        helper-text="已接入 WeCom 渠道数据源"
      />
    </section>

    <!-- AI 洞察分析 -->
    <section class="section">
      <h2 class="section-title">AI 洞察分析</h2>
      <div class="insight-cards">
        <div class="insight-card">
          <span class="insight-icon">📊</span>
          <h3 class="insight-title">数据趋势</h3>
          <p class="insight-desc">基于近 30 天企业经营数据分析</p>
        </div>
        <div class="insight-card">
          <span class="insight-icon">🔮</span>
          <h3 class="insight-title">预测预警</h3>
          <p class="insight-desc">AI 提前识别潜在经营风险</p>
        </div>
        <div class="insight-card">
          <span class="insight-icon">✨</span>
          <h3 class="insight-title">机会发现</h3>
          <p class="insight-desc">从数据中发现业务增长机会</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import SignalCard from '~/components/enterprise-ui/cards/SignalCard.vue'
import EmptyState from '~/components/enterprise-ui/feedback/EmptyState.vue'

interface Signal {
  id: string
  signalType: string
  severity: string
  description: string
  detectedAt: string
  sourceEvents: string[]
}

const signals = ref<Signal[]>([])

const signalStats = computed(() => ({
  total: signals.value.length,
  high: signals.value.filter(s => s.severity === 'critical').length,
  medium: signals.value.filter(s => s.severity === 'warning').length,
  opportunity: signals.value.filter(s => s.severity === 'opportunity').length,
}))

function handleViewSignal(id: string) {
  console.log('查看信号:', id)
}

function handleGenerateDecision(id: string) {
  console.log('从信号生成建议:', id)
}

async function loadData() {
  // TODO: Connect to intelligence API
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.intelligence-module {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.kpi-section {
  margin-bottom: var(--space-sm);
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
}

.kpi-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.kpi-value {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-intelligence);
}

.kpi-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-top: var(--space-xs);
}

.section {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-xl);
  padding: var(--space-xl);
}

.section-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin-bottom: var(--space-lg);
  color: var(--color-text-primary);
}

.signal-stream {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-md);
}

.insight-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-md);
}

.insight-card {
  padding: var(--space-lg);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-primary);
  text-align: center;
}

.insight-icon {
  font-size: 24px;
  margin-bottom: var(--space-sm);
}

.insight-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--space-xs);
}

.insight-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

@media (max-width: 768px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .signal-stream { grid-template-columns: 1fr; }
  .insight-cards { grid-template-columns: 1fr; }
}
</style>
