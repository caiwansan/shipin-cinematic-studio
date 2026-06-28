<template>
  <div>
    <div class="gt-header">
      <h2>🧪 Ground Truth — Dataset Health</h2>
      <div class="gt-subtitle">R1 · 等待样本积累中 · 纯只读观测</div>
    </div>

    <!-- 进度卡片 -->
    <div class="gt-progress-grid">
      <div class="gt-card" :class="{ 'gt-ok': data.rank?.image >= 1000 }">
        <div class="gt-card-icon">🖼️</div>
        <div class="gt-card-body">
          <div class="gt-card-label">图片样本</div>
          <div class="gt-card-value">{{ stats.byType.find(t => t.type === 'image')?.count || 0 }}</div>
          <div class="gt-card-target">目标: 1,000</div>
          <div class="gt-bar"><div class="gt-bar-fill" :style="{ width: barWidth(stats.byType.find(t => t.type === 'image')?.count || 0, 1000) }"></div></div>
        </div>
      </div>
      <div class="gt-card" :class="{ 'gt-ok': data.rank?.video >= 300 }">
        <div class="gt-card-icon">🎬</div>
        <div class="gt-card-body">
          <div class="gt-card-label">视频样本</div>
          <div class="gt-card-value">{{ stats.byType.find(t => t.type === 'video')?.count || 0 }}</div>
          <div class="gt-card-target">目标: 300</div>
          <div class="gt-bar"><div class="gt-bar-fill" :style="{ width: barWidth(stats.byType.find(t => t.type === 'video')?.count || 0, 300) }"></div></div>
        </div>
      </div>
      <div class="gt-card" :class="{ 'gt-ok': (data.rank?.user || 0) >= 500 }">
        <div class="gt-card-icon">💬</div>
        <div class="gt-card-body">
          <div class="gt-card-label">用户反馈</div>
          <div class="gt-card-value">{{ feedbackTotal }}</div>
          <div class="gt-card-target">目标: 500</div>
          <div class="gt-bar"><div class="gt-bar-fill" :style="{ width: barWidth(feedbackTotal, 500) }"></div></div>
        </div>
      </div>
    </div>

    <!-- 行为分布 -->
    <div class="gt-section">
      <div class="gt-section-title">行为信号分布</div>
      <div v-if="stats.byAction.length === 0" class="gt-empty">暂无数据</div>
      <div v-else class="gt-action-list">
        <div v-for="a in sortedActions" :key="a.action" class="gt-action-item">
          <div class="gt-action-label">
            <span class="gt-action-name">{{ actionLabel(a.action) }}</span>
            <span class="gt-action-count">{{ a.count }}</span>
          </div>
          <div class="gt-action-pct">{{ pct(a.count) }}</div>
          <div class="gt-bar"><div class="gt-bar-fill" :style="{ width: pct(a.count), background: actionColor(a.action) }"></div></div>
        </div>
      </div>
    </div>

    <!-- 正负分布 -->
    <div class="gt-section">
      <div class="gt-section-title">信号极性分布</div>
      <div v-if="stats.distribution" class="gt-dist-grid">
        <div class="gt-dist-card gt-positive">
          <div class="gt-dist-num">{{ stats.distribution.positive }}</div>
          <div class="gt-dist-label">正信号</div>
        </div>
        <div class="gt-dist-card gt-neutral">
          <div class="gt-dist-num">{{ stats.distribution.neutral }}</div>
          <div class="gt-dist-label">中性</div>
        </div>
        <div class="gt-dist-card gt-negative">
          <div class="gt-dist-num">{{ stats.distribution.negative }}</div>
          <div class="gt-dist-label">负信号</div>
        </div>
      </div>
    </div>

    <!-- 增长率 -->
    <div class="gt-section">
      <div class="gt-section-title">样本增长速度</div>
      <div v-if="growthData.length === 0" class="gt-empty">暂无数据</div>
      <div v-else class="gt-growth">
        <div v-for="g in growthData" :key="g.label" class="gt-growth-item">
          <div class="gt-growth-label">{{ g.label }}</div>
          <div class="gt-growth-value">+{{ g.count }}</div>
        </div>
      </div>
    </div>

    <div class="gt-footer">🔄 自动刷新每 30 秒 · 上次更新: {{ lastUpdate }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface ActionStat { action: string; count: number }
interface TypeStat { type: string; count: number }
interface Distribution { positive: number; negative: number; neutral: number }
interface Stats {
  total: number
  byType: TypeStat[]
  byAction: ActionStat[]
  distribution: Distribution | null
}

interface Rank {
  image: number
  video: number
  user: number
}

interface Data {
  rank: Rank | null
}

const stats = ref<Stats>({ total: 0, byType: [], byAction: [], distribution: null })
const growthData = ref<{ label: string; count: number }[]>([])
const data = ref<Data>({ rank: null })
const lastUpdate = ref('')

const feedbackTotal = computed(() => {
  const a = stats.value.byAction
  return a.filter(x => x.action === 'like' || x.action === 'dislike' || x.action === 'favorite').reduce((s, x) => s + x.count, 0)
})

const sortedActions = computed(() => {
  return [...stats.value.byAction].sort((a, b) => b.count - a.count)
})

function pct(n: number) {
  const total = stats.value.total
  if (!total) return '0%'
  return ((n / total) * 100).toFixed(1) + '%'
}

function barWidth(n: number, target: number) {
  const p = Math.min((n / target) * 100, 100)
  return p + '%'
}

const actionLabels: Record<string, string> = {
  download: '下载', favorite: '收藏', like: '点赞',
  dislike: '不满意', continue: '继续下一步', edit: '编辑修改',
  regenerate: '重生成', regenerate_loop: '连续重生成',
}

function actionLabel(a: string) {
  return actionLabels[a] || a
}

const actionColors: Record<string, string> = {
  download: '#4caf50', favorite: '#ff9800', like: '#2196f3',
  dislike: '#f44336', continue: '#9c27b0', edit: '#607d8b',
  regenerate: '#ff5722', regenerate_loop: '#d32f2f',
}

function actionColor(a: string) {
  return actionColors[a] || '#888'
}

let timer: ReturnType<typeof setInterval> | null = null

async function fetchStats() {
  try {
    const res = await fetch('/api/evaluation/samples/stats', { signal: AbortSignal.timeout(3000) })
    const json = await res.json()
    if (json.success) {
      stats.value = json.data
      lastUpdate.value = new Date().toLocaleTimeString()
    }
  } catch {
    // 静默
  }
}

onMounted(() => {
  fetchStats()
  timer = setInterval(fetchStats, 30000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.gt-header {
  margin-bottom: 16px;
}
.gt-header h2 {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 2px;
  color: #fff;
}
.gt-subtitle {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
}

.gt-progress-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.gt-card {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.gt-card.gt-ok {
  border-color: #4caf50;
  box-shadow: 0 0 12px rgba(76,175,80,0.15);
}
.gt-card-icon {
  font-size: 22px;
  line-height: 1;
}
.gt-card-body {
  flex: 1;
}
.gt-card-label {
  font-size: 13px;
  color: rgba(255,255,255,0.5);
  margin-bottom: 4px;
}
.gt-card-value {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  line-height: 1.2;
}
.gt-card-target {
  font-size: 11px;
  color: rgba(255,255,255,0.3);
  margin: 4px 0 8px;
}
.gt-bar {
  height: 4px;
  background: rgba(255,255,255,0.08);
  border-radius: 2px;
  overflow: hidden;
}
.gt-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  border-radius: 2px;
  transition: width 0.5s ease;
}

.gt-section {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 16px;
}
.gt-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 16px;
}
.gt-empty {
  text-align: center;
  padding: 16px;
  color: rgba(255,255,255,0.25);
  font-size: 13px;
}

.gt-action-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.gt-action-item {
  display: grid;
  grid-template-columns: 1fr 60px 1fr;
  align-items: center;
  gap: 12px;
}
.gt-action-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.gt-action-name {
  font-size: 13px;
}
.gt-action-count {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  margin-left: 8px;
}
.gt-action-pct {
  font-size: 12px;
  color: rgba(255,255,255,0.4);
  text-align: right;
}

.gt-dist-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.gt-dist-card {
  padding: 16px;
  border-radius: 8px;
  text-align: center;
}
.gt-dist-num {
  font-size: 28px;
  font-weight: 700;
}
.gt-dist-label {
  font-size: 12px;
  margin-top: 4px;
}
.gt-positive {
  background: rgba(76,175,80,0.12);
  color: #81c784;
}
.gt-neutral {
  background: rgba(96,125,139,0.12);
  color: #90a4ae;
}
.gt-negative {
  background: rgba(244,67,54,0.12);
  color: #ef9a9a;
}

.gt-growth {
  display: flex;
  gap: 24px;
}
.gt-growth-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.gt-growth-label {
  font-size: 12px;
  color: rgba(255,255,255,0.4);
}
.gt-growth-value {
  font-size: 20px;
  font-weight: 700;
  color: #4caf50;
}

.gt-footer {
  margin-top: 32px;
  text-align: center;
  font-size: 11px;
  color: rgba(255,255,255,0.2);
}
</style>
