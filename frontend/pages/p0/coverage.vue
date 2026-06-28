<template>
  <div class="c-page">
    <div class="c-bg" />

    <!-- 导航 -->
    <nav class="c-nav">
      <div class="c-nav-inner">
        <div class="c-nav-left">
          <span class="c-logo">📊</span>
          <span class="c-title">Coverage 仪表盘</span>
          <span class="c-tag" :class="loading ? 'tag-loading' : 'tag-ok'">
            {{ loading ? '加载中...' : '实时' }}
          </span>
        </div>
        <div class="c-nav-right">
          <NuxtLink to="/p0/life-assistant" class="c-link">对话</NuxtLink>
          <NuxtLink to="/p0/fallbacks" class="c-link">Fallback 池</NuxtLink>
          <NuxtLink to="/p0/seeds" class="c-link">种子详情</NuxtLink>
          <NuxtLink to="/" class="c-link">首页</NuxtLink>
          <button class="c-refresh" @click="fetchData" :disabled="loading">🔄 刷新</button>
        </div>
      </div>
    </nav>

    <main class="c-main" v-if="metrics">
      <!-- 核心指标行 -->
      <section class="c-metrics-row">
        <div class="c-metric-card card-primary">
          <div class="metric-value">{{ metrics.coverageRate }}<small>%</small></div>
          <div class="metric-label">Coverage Rate</div>
          <div class="metric-desc">命中 Seed 的查询占比</div>
        </div>
        <div class="c-metric-card card-warn" v-if="metrics.fallbackRate >= 30">
          <div class="metric-value">{{ metrics.fallbackRate }}<small>%</small></div>
          <div class="metric-label">Fallback Rate <span class="warn-badge">⚠️ &gt;30%</span></div>
          <div class="metric-desc">退化——该进入 U-3 了</div>
        </div>
        <div class="c-metric-card" v-else>
          <div class="metric-value">{{ metrics.fallbackRate }}<small>%</small></div>
          <div class="metric-label">Fallback Rate</div>
          <div class="metric-desc">退化查询占比</div>
        </div>
        <div class="c-metric-card card-blue">
          <div class="metric-value">{{ metrics.strongMatchRate }}<small>%</small></div>
          <div class="metric-label">Strong Match</div>
          <div class="metric-desc">强匹配（&ge;0.60）占比</div>
        </div>
        <div class="c-metric-card card-gray">
          <div class="metric-value">{{ metrics.totalQueries }}</div>
          <div class="metric-label">总查询量</div>
          <div class="metric-desc">{{ itemsDesc }}</div>
        </div>
      </section>

      <!-- 趋势图占位 -->
      <section class="c-section">
        <div class="c-section-header">
          <h3>趋势</h3>
          <span class="c-hint">（等真实数据积累后自动展示 24h/7d/30d）</span>
        </div>
        <div class="c-chart-placeholder">
          <div class="placeholder-text">📈 趋势图将在数据量 &gt; 100 条后激活</div>
          <div class="placeholder-bar">
            <div class="bar-fill" :style="{ width: metrics.coverageRate + '%' }" />
          </div>
          <div class="bar-label">当前 coverage {{ metrics.coverageRate }}%</div>
        </div>
      </section>

      <!-- Seed 排行榜 -->
      <section class="c-section">
        <div class="c-section-header">
          <h3>Seed 排行榜</h3>
          <span class="c-hint">按命中量降序</span>
        </div>
        <div class="c-seed-table" v-if="seedCoverage.length > 0">
          <div class="c-table-row c-table-header">
            <span class="col-rank">#</span>
            <span class="col-name">Seed</span>
            <span class="col-count">Hits</span>
            <span class="col-share">Strong</span>
            <span class="col-total">Avg</span>
            <span class="col-total">Near Miss</span>
            <span class="col-bar">分布</span>
          </div>
          <div v-for="(s, i) in seedCoverage" :key="s.seedId" class="c-table-row c-table-body">
            <span class="col-rank">{{ i + 1 }}</span>
            <span class="col-name">
              <code>{{ s.seedId }}</code>
            </span>
            <span class="col-count">{{ s.hitCount }}</span>
            <span class="col-share">{{ s.strongRate }}</span>
            <span class="col-total">{{ s.avgScore }}</span>
            <span class="col-total" :class="s.nearMissCount > 0 ? 'c-near-miss' : ''">{{ s.nearMissCount }}</span>
            <span class="col-bar">
              <div class="bar-mini">
                <div class="bar-mini-fill" :style="{ width: s.shareOfMatched }" />
              </div>
            </span>
          </div>
        </div>
        <div v-else class="c-empty">暂无数据</div>
      </section>

      <!-- 系统信息 -->
      <section class="c-section c-info-section">
        <div class="c-info-line">
          <span class="info-key">数据采集时间</span>
          <span class="info-val">{{ formatTime(timestamp) }}</span>
        </div>
        <div class="c-info-line">
          <span class="info-key">匹配占比</span>
          <span class="info-val">{{ metrics.matchedQueries }} / {{ metrics.totalQueries }}</span>
        </div>
        <div class="c-info-line c-note">
          注：样本数 {{ metrics.totalQueries }}，在样本 &lt; 1000 时所有统计结论仅供参考
        </div>
      </section>
    </main>

    <main class="c-main c-main-empty" v-else-if="!loading">
      <div class="c-empty-state">
        <div class="empty-icon">📊</div>
        <div class="empty-title">暂无数据</div>
        <div class="empty-desc">去 <NuxtLink to="/p0/life-assistant" class="c-link-inline">对话页面</NuxtLink> 发几条消息后回来查看</div>
      </div>
    </main>

    <main class="c-main c-main-empty" v-else>
      <div class="c-empty-state">
        <div class="empty-icon">⏳</div>
        <div class="empty-title">加载中...</div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const loading = ref(false)
const metrics = ref<any>(null)
const seedCoverage = ref<any[]>([])
const timestamp = ref(0)
const itemsDesc = computed(() => {
  const n = metrics.value?.totalQueries ?? 0
  if (n < 50) return '样本过少，仅供参考'
  if (n < 500) return '小样本'
  return '数据充足'
})

async function fetchData() {
  loading.value = true
  try {
    const res = await fetch('/api/p0/coverage')
    const data = await res.json()
    metrics.value = data.metrics
    seedCoverage.value = data.seedCoverage || []
    timestamp.value = data.timestamp || Date.now()
  } catch (e) {
    console.error('Failed to fetch coverage:', e)
  } finally {
    loading.value = false
  }
}

function formatTime(ts: number) {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
}

onMounted(fetchData)
</script>

<style scoped>
/* ===== 页面 ===== */
.c-page {
  min-height: 100vh;
  background: #0b0d14;
  color: #e0e2e8;
  font-family: system-ui, -apple-system, sans-serif;
  position: relative;
}
.c-bg {
  position: fixed; inset: 0;
  background:
    radial-gradient(ellipse 600px 400px at 20% 20%, rgba(59,130,246,0.06), transparent),
    radial-gradient(ellipse 500px 500px at 80% 80%, rgba(139,92,246,0.05), transparent);
  pointer-events: none;
}

/* ===== 导航 ===== */
.c-nav {
  position: sticky; top: 0; z-index: 50;
  backdrop-filter: blur(12px);
  background: rgba(11,13,20,0.8);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.c-nav-inner {
  max-width: 1200px; margin: 0 auto;
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 24px;
}
.c-nav-left { display: flex; align-items: center; gap: 10px; }
.c-logo { font-size: 22px; }
.c-title { font-weight: 600; font-size: 16px; }
.c-tag {
  font-size: 11px; padding: 2px 8px; border-radius: 6px; background: rgba(255,255,255,0.05);
}
.tag-loading { color: #f59e0b; }
.tag-ok { color: #10b981; }
.c-nav-right { display: flex; align-items: center; gap: 12px; }
.c-link {
  color: #8892b0; font-size: 13px; text-decoration: none; transition: color 0.2s;
  &:hover { color: #e0e2e8; }
}
.c-refresh {
  padding: 6px 14px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;
  background: transparent; color: #e0e2e8; font-size: 12px; cursor: pointer;
  transition: all 0.2s;
  &:hover:not(:disabled) { border-color: #3b82f6; color: #3b82f6; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
}

/* ===== Main ===== */
.c-main {
  max-width: 1200px; margin: 0 auto; padding: 24px;
}
.c-main-empty {
  display: flex; align-items: center; justify-content: center; min-height: 60vh;
}

/* ===== 指标行 ===== */
.c-metrics-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px; margin-bottom: 28px;
}
.c-metric-card {
  padding: 20px; border-radius: 12px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
}
.card-primary { border-color: rgba(59,130,246,0.3); }
.card-warn { border-color: rgba(245,158,11,0.4); }
.card-blue { border-color: rgba(99,102,241,0.3); }
.card-gray { border-color: rgba(255,255,255,0.06); }
.metric-value {
  font-size: 32px; font-weight: 700; margin-bottom: 4px;
  & small { font-size: 16px; font-weight: 400; color: #8892b0; }
}
.metric-label { font-size: 13px; font-weight: 500; color: #8892b0; margin-bottom: 2px; }
.metric-desc { font-size: 11px; color: #555d73; }
.warn-badge {
  display: inline-block; padding: 0 6px; border-radius: 4px;
  background: rgba(245,158,11,0.15); color: #f59e0b; font-size: 11px; margin-left: 4px;
}

/* ===== Section ===== */
.c-section {
  margin-bottom: 28px;
}
.c-section-header {
  display: flex; align-items: baseline; gap: 12px;
  margin-bottom: 14px;
  & h3 { font-size: 15px; font-weight: 600; margin: 0; }
}
.c-hint { font-size: 12px; color: #555d73; }

/* ===== 趋势图 ===== */
.c-chart-placeholder {
  padding: 32px 24px; border-radius: 10px;
  background: rgba(255,255,255,0.02);
  border: 1px dashed rgba(255,255,255,0.08);
  text-align: center;
}
.placeholder-text { font-size: 13px; color: #555d73; margin-bottom: 16px; }
.placeholder-bar {
  width: 100%; height: 8px; border-radius: 4px;
  background: rgba(255,255,255,0.06); overflow: hidden;
  margin-bottom: 8px;
}
.bar-fill {
  height: 100%; border-radius: 4px;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  transition: width 0.5s;
}
.bar-label { font-size: 11px; color: #555d73; }

/* ===== Seed 表 ===== */
.c-seed-table {
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.06);
  overflow: hidden;
}
.c-table-row {
  display: grid;
  grid-template-columns: 40px 1fr 60px 80px 80px 1fr;
  align-items: center;
  padding: 10px 16px;
  font-size: 13px;
}
.c-table-header {
  background: rgba(255,255,255,0.03);
  color: #555d73; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;
}
.c-table-body:not(:last-child) { border-bottom: 1px solid rgba(255,255,255,0.03); }
.c-table-body:hover { background: rgba(255,255,255,0.015); }
.col-rank { color: #555d73; }
.col-name code {
  padding: 2px 8px; border-radius: 4px; background: rgba(255,255,255,0.04);
  font-size: 12px; color: #e0e2e8;
}
.col-count { font-weight: 500; }
.col-share { color: #8892b0; }
.col-total { color: #555d73; }
.c-near-miss { color: #f97316; font-weight: 600; }
.bar-mini { height: 4px; border-radius: 2px; background: rgba(255,255,255,0.06); overflow: hidden; }
.bar-mini-fill {
  height: 100%; border-radius: 2px;
  background: linear-gradient(90deg, #3b82f6, #6366f1);
  transition: width 0.4s;
}

/* ===== 信息 ===== */
.c-info-section { padding: 16px; border-radius: 10px; background: rgba(255,255,255,0.015); }
.c-info-line { display: flex; gap: 12px; font-size: 12px; margin-bottom: 6px; }
.info-key { color: #555d73; min-width: 100px; }
.info-val { color: #8892b0; }
.c-note { font-style: italic; color: #555d73; margin-top: 8px; }

/* ===== 空状态 ===== */
.c-empty-state { text-align: center; }
.empty-icon { font-size: 48px; margin-bottom: 12px; }
.empty-title { font-size: 18px; font-weight: 600; margin-bottom: 6px; }
.empty-desc { font-size: 13px; color: #555d73; }
.c-link-inline { color: #3b82f6; text-decoration: none; }

.c-empty { padding: 24px; text-align: center; color: #555d73; font-size: 13px; }
</style>
