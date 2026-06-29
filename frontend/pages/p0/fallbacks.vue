<template>
  <div class="f-page">
    <div class="f-bg"/>

    <!-- 导航 -->
    <nav class="f-nav">
      <div class="f-nav-inner">
        <div class="f-nav-left">
          <span class="f-logo">🧩</span>
          <span class="f-title">Fallback Explorer</span>
          <span class="f-tag" v-if="!loading">{{ clusters.length }} 个聚类</span>
        </div>
        <div class="f-nav-right">
          <!-- @deprecated 生活助手 — V4.2 业务废弃 -->
          <!-- <NuxtLink to="/p0/life-assistant" class="f-link">对话</NuxtLink> -->
          <NuxtLink to="/p0/coverage" class="f-link">Coverage</NuxtLink>
          <NuxtLink to="/p0/seeds" class="f-link">种子详情</NuxtLink>
          <NuxtLink to="/" class="f-link">首页</NuxtLink>
          <button class="f-refresh" @click="fetchData" :disabled="loading">🔄 刷新</button>
        </div>
      </div>
    </nav>

    <main class="f-main" v-if="loaded">
      <!-- 总览 -->
      <section class="f-summary">
        <div class="f-summary-card">
          <div class="f-summary-num">{{ totalFallback }}</div>
          <div class="f-summary-label">总退化查询</div>
        </div>
        <div class="f-summary-card">
          <div class="f-summary-num">{{ clusters.length }}</div>
          <div class="f-summary-label">聚类数</div>
        </div>
        <div class="f-summary-card f-summary-card--warn">
          <div class="f-summary-num">{{ highCountClusters }}</div>
          <div class="f-summary-label">≥10 次聚簇</div>
          <div class="f-summary-desc">可考虑进入 CANDIDATE</div>
        </div>
      </section>

      <!-- 按聚类排列 -->
      <section v-for="cluster in clusters" :key="cluster.clusterKey" class="f-cluster">
        <div class="f-cluster-header" @click="toggleCluster(cluster.clusterKey)">
          <div class="f-cluster-left">
            <span class="f-cluster-icon">{{ clusterExpanded[cluster.clusterKey] ? '▼' : '▶' }}</span>
            <span class="f-cluster-key">{{ cluster.clusterKey }}</span>
            <span class="f-cluster-badge">{{ cluster.count }} 条</span>
            <span class="f-cluster-candidate" v-if="cluster.candidateSeed">
              候选: <code>{{ cluster.candidateSeed }}</code>
            </span>
          </div>
          <div class="f-cluster-right">
            <button class="f-btn f-btn-approve" @click.stop="approveSeed(cluster)">✓ Approve</button>
            <button class="f-btn f-btn-ignore" @click.stop="ignoreCluster(cluster)">✕ Ignore</button>
            <button class="f-btn f-btn-ban" @click.stop="banCluster(cluster)">🔒 Perm Fallback</button>
          </div>
        </div>

        <!-- 展开——Query Replay 列表 -->
        <div v-if="clusterExpanded[cluster.clusterKey]" class="f-cluster-body">
          <div v-for="(q, qi) in cluster.examples" :key="qi" class="f-query-item" @click="replayQuery(q)">
            <div class="f-query-left">
              <span class="f-query-text">{{ q }}</span>
            </div>
            <div class="f-query-right">
              <span class="f-query-preview">点击查看匹配详情 →</span>
            </div>
          </div>
        </div>
      </section>

      <section v-if="clusters.length === 0" class="f-empty">
        <div class="empty-icon">🎉</div>
        <div class="empty-title">暂无 Fallback</div>
        <div class="empty-desc">所有查询都命中 Seed 了</div>
      </section>

      <!-- Top Fallback 列表（全部 flat） -->
      <section class="f-section" v-if="topFallbacks.length > 0">
        <div class="f-section-header">
          <h3>Top Fallback Queries</h3>
          <span class="f-hint">按出现次数降序</span>
        </div>
        <div class="f-top-list">
          <div v-for="(tf, ti) in topFallbacks" :key="ti" class="f-top-item" @click="replayQuery(tf.query)">
            <span class="f-top-rank">{{ ti + 1 }}</span>
            <span class="f-top-text">{{ tf.query }}</span>
            <span class="f-top-count">× {{ tf.count }}</span>
          </div>
        </div>
      </section>
    </main>

    <main class="f-main f-main-empty" v-else-if="!loaded && !loading">
      <div class="f-empty-state">
        <div class="empty-icon">🧩</div>
        <div class="empty-title">暂无数据</div>
        <!-- @deprecated 生活助手 — V4.2 业务废弃 -->
        <div class="empty-desc">生活助手功能已下线</div>
        <!-- <div class="empty-desc">去 <NuxtLink to="/p0/life-assistant" class="f-link-inline">对话页面</NuxtLink> 发几条消息后回来查看</div> -->
      </div>
    </main>

    <main class="f-main f-main-empty" v-else>
      <div class="f-empty-state"><div class="empty-icon">⏳</div><div class="empty-title">加载中...</div></div>
    </main>

    <!-- ===== Query Replay Modal ===== -->
    <div v-if="showReplay" class="f-overlay" @click.self="closeReplay">
      <div class="f-modal">
        <div class="f-modal-header">
          <h3>🔍 Query Replay</h3>
          <button class="f-modal-close" @click="closeReplay">✕</button>
        </div>
        <div class="f-modal-body">
          <!-- query -->
          <div class="replay-query">{{ replayData.query }}</div>

          <!-- 整体结果 -->
          <div class="replay-section">
            <div class="replay-label">匹配结果</div>
            <div class="replay-results">
              <div class="replay-result-item" v-if="replayData.topSeeds">
                <span class="rr-rank">🥇</span>
                <span><code>{{ replayData.topSeeds[0]?.seedId || 'none' }}</code></span>
                <span class="rr-score">{{ replayData.topSeeds[0]?.score?.toFixed(3) }}</span>
              </div>
              <div class="replay-result-item" v-for="(cand, ci) in (replayData.candidates || []).slice(1, 4)" :key="ci">
                <span class="rr-rank">{{ 'TOP' + (ci + 2) }}</span>
                <span><code>{{ cand.seedId }}</code></span>
                <span class="rr-score">{{ cand.score.toFixed(3) }}</span>
              </div>
            </div>
          </div>

          <!-- 分数维度 -->
          <div class="replay-section">
            <div class="replay-label">各维度得分（Top Seed）</div>
            <div class="replay-dims" v-if="replayData.topSeedComponents">
              <div v-for="(val, key) in replayData.topSeedComponents" :key="key" class="replay-dim">
                <span class="dim-name">{{ key }}</span>
                <div class="dim-bar-bg"><div class="dim-bar-fill" :style="{ width: (val * 100) + '%' }" /></div>
                <span class="dim-val">{{ (val * 100).toFixed(1) }}%</span>
              </div>
            </div>
            <div class="replay-total" v-if="replayData.topScore">
              <span>Final Score</span>
              <span class="total-val">{{ replayData.topScore.toFixed(3) }}</span>
            </div>
          </div>

          <!-- fallback 原因 -->
          <div class="replay-section" v-if="replayData.degraded">
            <div class="replay-label">退化原因</div>
            <div class="replay-degraded">
              ⚠️ 所有候选 Seed 均未达到 acceptable 阈值（0.42）
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const loading = ref(false)
const loaded = ref(false)
const clusters = ref<any[]>([])
const topFallbacks = ref<any[]>([])
const totalFallback = ref(0)
const clusterExpanded = ref<Record<string, boolean>>({})
const showReplay = ref(false)
const replayData = ref<any>({
  query: '', topSeeds: [], candidates: [], topSeedComponents: {},
  topScore: 0, degraded: false,
})

const highCountClusters = computed(() => clusters.value.filter(c => c.count >= 10).length)

async function fetchData() {
  loading.value = true
  try {
    const res = await fetch('/api/p0/fallback-pool')
    const data = await res.json()
    clusters.value = data.clusters || []
    topFallbacks.value = data.topFallbackQueries || []
    totalFallback.value = data.total || 0
    loaded.value = true
  } catch (e) {
    console.error('Failed to fetch fallbacks:', e)
  } finally {
    loading.value = false
  }
}

function toggleCluster(key: string) {
  clusterExpanded.value[key] = !clusterExpanded.value[key]
}

async function replayQuery(query: string) {
  // 对相同 query 做一次 gateway 请求获取完整匹配详情
  try {
    const res = await fetch('/api/p0/gateway', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    const data = await res.json()
    replayData.value = {
      query,
      topSeeds: data.matchCandidates || [],
      candidates: data.matchCandidates || [],
      topSeedComponents: data.topSeedComponents || {},
      topScore: data.matchScore || 0,
      degraded: data.degraded ?? true,
    }
    showReplay.value = true
  } catch (e) {
    console.error('Replay failed:', e)
  }
}

function closeReplay() { showReplay.value = false }

function approveSeed(cluster: any) {
  alert(`已标记候选 Seed：${cluster.candidateSeed || cluster.clusterKey}\n（待后端实现持久化后生效）`)
}

function ignoreCluster(cluster: any) {
  cluster.ignored = true
}

function banCluster(cluster: any) {
  cluster.baned = true
  alert(`已标记 "${cluster.clusterKey}" 为永久退化\n（待后端实现持久化后生效）`)
}

onMounted(fetchData)
</script>

<style scoped>
/* ===== 页面 ===== */
.f-page {
  min-height: 100vh;
  background: #0b0d14;
  color: #e0e2e8;
  font-family: system-ui, -apple-system, sans-serif;
  position: relative;
}
.f-bg {
  position: fixed; inset: 0;
  background:
    radial-gradient(ellipse 600px 400px at 80% 20%, rgba(139,92,246,0.06), transparent),
    radial-gradient(ellipse 500px 500px at 20% 80%, rgba(245,158,11,0.04), transparent);
  pointer-events: none;
}

/* ===== 导航 ===== */
.f-nav {
  position: sticky; top: 0; z-index: 50;
  backdrop-filter: blur(12px);
  background: rgba(11,13,20,0.8);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.f-nav-inner {
  max-width: 1200px; margin: 0 auto;
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 24px;
}
.f-nav-left { display: flex; align-items: center; gap: 10px; }
.f-logo { font-size: 22px; }
.f-title { font-weight: 600; font-size: 16px; }
.f-tag { font-size: 11px; padding: 2px 8px; border-radius: 6px; background: rgba(255,255,255,0.05); color: #555d73; }
.f-nav-right { display: flex; align-items: center; gap: 12px; }
.f-link {
  color: #8892b0; font-size: 13px; text-decoration: none;
  &:hover { color: #e0e2e8; }
}
.f-refresh {
  padding: 6px 14px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;
  background: transparent; color: #e0e2e8; font-size: 12px; cursor: pointer;
  &:hover:not(:disabled) { border-color: #8b5cf6; color: #8b5cf6; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
}

/* ===== Main ===== */
.f-main {
  max-width: 1200px; margin: 0 auto; padding: 24px;
}
.f-main-empty {
  display: flex; align-items: center; justify-content: center; min-height: 60vh;
}

/* ===== 总览 ===== */
.f-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px; margin-bottom: 28px;
}
.f-summary-card {
  padding: 18px; border-radius: 10px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
}
.f-summary-card--warn { border-color: rgba(245,158,11,0.3); }
.f-summary-num { font-size: 28px; font-weight: 700; }
.f-summary-label { font-size: 13px; color: #8892b0; margin: 4px 0 2px; }
.f-summary-desc { font-size: 11px; color: #555d73; }

/* ===== Cluster ===== */
.f-cluster {
  margin-bottom: 10px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.06);
  background: rgba(255,255,255,0.02);
  overflow: hidden;
}
.f-cluster-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; cursor: pointer;
  &:hover { background: rgba(255,255,255,0.015); }
}
.f-cluster-left {
  display: flex; align-items: center; gap: 10px;
}
.f-cluster-icon { font-size: 10px; color: #555d73; width: 12px; }
.f-cluster-key { font-weight: 600; font-size: 14px; }
.f-cluster-badge {
  padding: 1px 8px; border-radius: 8px;
  background: rgba(139,92,246,0.12); color: #a78bfa;
  font-size: 11px; font-weight: 500;
}
.f-cluster-candidate {
  font-size: 11px; color: #555d73;
  & code { padding: 1px 5px; border-radius: 3px; background: rgba(255,255,255,0.04); font-size: 11px; color: #8892b0; }
}
.f-cluster-right { display: flex; gap: 6px; }

/* ===== Buttons ===== */
.f-btn {
  padding: 4px 10px; border: 1px solid rgba(255,255,255,0.08); border-radius: 5px;
  background: transparent; font-size: 11px; cursor: pointer;
  transition: all 0.2s;
}
.f-btn-approve { color: #10b981; &:hover { border-color: #10b981; background: rgba(16,185,129,0.06); } }
.f-btn-ignore { color: #8892b0; &:hover { border-color: #8892b0; } }
.f-btn-ban { color: #ef4444; &:hover { border-color: #ef4444; background: rgba(239,68,68,0.06); } }

/* ===== Query 列表 ===== */
.f-cluster-body { border-top: 1px solid rgba(255,255,255,0.04); }
.f-query-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px 10px 28px;
  border-bottom: 1px solid rgba(255,255,255,0.02);
  cursor: pointer; transition: background 0.15s;
  &:hover { background: rgba(255,255,255,0.02); }
  &:last-child { border: none; }
}
.f-query-text { font-size: 13px; color: #8892b0; }
.f-query-preview { font-size: 11px; color: #555d73; }

/* ===== Top Fallback 列表 ===== */
.f-section { margin-top: 28px; }
.f-section-header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px; }
.f-section-header h3 { font-size: 15px; font-weight: 600; margin: 0; }
.f-hint { font-size: 12px; color: #555d73; }
.f-top-list {
  border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); overflow: hidden;
}
.f-top-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px; cursor: pointer;
  border-bottom: 1px solid rgba(255,255,255,0.02);
  &:hover { background: rgba(255,255,255,0.015); }
  &:last-child { border: none; }
}
.f-top-rank { color: #555d73; font-size: 11px; width: 20px; text-align: right; }
.f-top-text { flex: 1; font-size: 13px; color: #8892b0; }
.f-top-count { font-size: 12px; font-weight: 500; color: #a78bfa; }

/* ===== 空状态 ===== */
.f-empty { text-align: center; padding: 48px; }
.f-empty-state { text-align: center; }
.empty-icon { font-size: 48px; margin-bottom: 12px; }
.empty-title { font-size: 18px; font-weight: 600; margin-bottom: 6px; }
.empty-desc { font-size: 13px; color: #555d73; }
.f-link-inline { color: #8b5cf6; text-decoration: none; }

/* ===== Modal ===== */
.f-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
}
.f-modal {
  width: 560px; max-width: 90vw; max-height: 80vh; overflow-y: auto;
  background: #141620; border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
}
.f-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px 0;
  & h3 { margin: 0; font-size: 15px; }
}
.f-modal-close {
  background: none; border: none; color: #555d73; font-size: 18px; cursor: pointer;
  &:hover { color: #e0e2e8; }
}
.f-modal-body { padding: 16px 20px 20px; }

/* Replay */
.replay-query {
  padding: 10px 14px; border-radius: 8px;
  background: rgba(255,255,255,0.03);
  font-size: 15px; font-weight: 500;
  margin-bottom: 16px;
}
.replay-section { margin-bottom: 14px; }
.replay-label {
  font-size: 11px; color: #555d73; text-transform: uppercase; letter-spacing: 0.5px;
  margin-bottom: 8px;
}
.replay-results { }
.replay-result-item {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 0;
  font-size: 13px;
}
.rr-rank { font-size: 11px; color: #555d73; width: 32px; }
.rr-score { margin-left: auto; font-weight: 500; color: #a78bfa; }

.replay-dims { }
.replay-dim {
  display: flex; align-items: center; gap: 10px;
  padding: 5px 0; font-size: 13px;
}
.dim-name { width: 100px; color: #8892b0; }
.dim-bar-bg { flex: 1; height: 6px; border-radius: 3px; background: rgba(255,255,255,0.06); }
.dim-bar-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #8b5cf6, #6366f1); transition: width 0.4s; }
.dim-val { width: 48px; text-align: right; color: #8892b0; font-size: 12px; }

.replay-total {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 0; margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.06);
  font-size: 14px; font-weight: 500;
}
.total-val { font-size: 20px; color: #a78bfa; }

.replay-degraded {
  padding: 8px 12px; border-radius: 6px;
  background: rgba(245,158,11,0.08);
  color: #f59e0b; font-size: 12px;
}
</style>
