<template>
  <div class="sp-page">
    <div class="sp-bg" />

    <!-- 导航 -->
    <nav class="sp-nav">
      <div class="sp-nav-inner">
        <div class="sp-nav-left">
          <span class="sp-logo">🌱</span>
          <span class="sp-title">种子详情</span>
          <span class="sp-tag" :class="loading ? 'tag-loading' : 'tag-ok'">
            {{ loading ? '加载中...' : seedCount + ' 颗种子' }}
          </span>
        </div>
        <div class="sp-nav-right">
          <NuxtLink to="/p0/coverage" class="sp-link">覆盖率</NuxtLink>
          <NuxtLink to="/p0/fallbacks" class="sp-link">Fallback 池</NuxtLink>
          <!-- @deprecated 生活助手 — V4.2 业务废弃 -->
          <!-- <NuxtLink to="/p0/life-assistant" class="sp-link">对话</NuxtLink> -->
          <NuxtLink to="/" class="sp-link">首页</NuxtLink>
          <button class="sp-refresh" @click="fetchData" :disabled="loading">🔄 刷新</button>
        </div>
      </div>
    </nav>

    <main class="sp-main" v-if="seeds.length > 0">
      <!-- 汇总行 -->
      <section class="sp-summary-row">
        <div class="sp-summary-card card-total">
          <div class="sm-val">{{ totalQueries }}</div>
          <div class="sm-label">总查询</div>
        </div>
        <div class="sp-summary-card card-hit">
          <div class="sm-val">{{ matchedQueries }}</div>
          <div class="sm-label">已命中</div>
        </div>
        <div class="sp-summary-card card-miss">
          <div class="sm-val">{{ fallbackQueries }}</div>
          <div class="sm-label">未命中</div>
        </div>
        <div class="sp-summary-card card-cov">
          <div class="sm-val">{{ coverageRate }}<small>%</small></div>
          <div class="sm-label">覆盖率</div>
        </div>
      </section>

      <!-- 种子表格 -->
      <section class="sp-table-wrap">
        <table class="sp-table">
          <thead>
            <tr>
              <th>Seed</th>
              <th>Domain</th>
              <th>Hits</th>
              <th>Coverage</th>
              <th>Strong</th>
              <th>Acceptable</th>
              <th>Avg Score</th>
              <th>Near Miss</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="seed in seeds" :key="seed.seedId"
              :class="{ 'tr-hot': seed.hitCount >= 5, 'tr-cold': seed.hitCount === 0 }">
              <td class="td-seed">
                <span class="seed-name">{{ seed.seedId }}</span>
              </td>
              <td><span class="domain-tag">{{ seed.domain || '—' }}</span></td>
              <td class="td-num">{{ seed.hitCount }}</td>
              <td class="td-num">{{ seed.shareOfTotal }}</td>
              <td class="td-num"><span :class="seed.strongRate >= 50 ? 'num-good' : 'num-ok'">{{ seed.strongRate }}%</span></td>
              <td class="td-num">{{ seed.acceptableRate }}%</td>
              <td class="td-num">{{ seed.avgScore.toFixed(2) }}</td>
              <td class="td-num">
                <span v-if="seed.nearMissCount > 0" class="num-near">{{ seed.nearMissCount }}</span>
                <span v-else class="num-zero">0</span>
              </td>
              <td>
                <span class="state-badge" :class="'state-' + seed.state.toLowerCase()">{{ seed.state }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>

    <!-- 空状态 -->
    <main class="sp-main sp-empty" v-else-if="!loading">
      <div class="sp-empty-icon">🌱</div>
      <h2>暂无种子数据</h2>
      <!-- @deprecated 生活助手 — V4.2 业务废弃 -->
      <p>生活助手功能已下线</p>
      <!-- <p>还没有查询记录，先去生活助手发几条消息吧</p>
      <NuxtLink to="/p0/life-assistant" class="sp-empty-link">→ 去对话</NuxtLink> -->
    </main>

    <!-- 加载中 -->
    <main class="sp-main sp-loading" v-else>
      <div class="loader">加载中...</div>
    </main>
  </div>
</template>

<script setup>
definePageMeta({
  middleware: ['deprecated-module'],
  moduleName: 'customer-service',
})


const seeds = ref([])
const loading = ref(true)
const totalQueries = ref(0)
const matchedQueries = ref(0)
const fallbackQueries = ref(0)
const coverageRate = ref(0)
const seedCount = ref(0)

async function fetchData() {
  loading.value = true
  try {
    const res = await $fetch('/api/p0/seed-stats')
    seeds.value = res.seeds || []
    totalQueries.value = res.seeds.reduce((acc, s) => acc + s.hitCount, 0)
    matchedQueries.value = res.seeds.filter(s => s.hitCount > 0).length
    fallbackQueries.value = Math.max(0, totalQueries.value - matchedQueries.value)
    coverageRate.value = totalQueries.value > 0
      ? Math.round(matchedQueries.value / totalQueries.value * 100)
      : 0
    seedCount.value = res.totalSeeds || seeds.value.length
  } catch (e) {
    console.error('Failed to fetch seed stats:', e)
  }
  loading.value = false
}

onMounted(fetchData)
</script>

<style scoped>
.sp-page { min-height: 100vh; background: #0a0a0f; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.sp-bg { position: fixed; inset: 0; background: radial-gradient(ellipse at 30% 20%, rgba(30, 60, 120, 0.15) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(60, 30, 90, 0.1) 0%, transparent 60%); pointer-events: none; z-index: 0; }

/* Nav */
.sp-nav { position: sticky; top: 0; z-index: 10; background: rgba(10, 10, 15, 0.85); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.06); }
.sp-nav-inner { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; padding: 12px 24px; }
.sp-nav-left { display: flex; align-items: center; gap: 12px; }
.sp-logo { font-size: 24px; }
.sp-title { font-size: 18px; font-weight: 600; }
.sp-tag { font-size: 12px; padding: 2px 10px; border-radius: 12px; }
.tag-ok { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.tag-loading { background: rgba(234, 179, 8, 0.15); color: #eab308; }
.sp-nav-right { display: flex; align-items: center; gap: 16px; }
.sp-link { color: #888; text-decoration: none; font-size: 14px; transition: color 0.2s; }
.sp-link:hover { color: #fff; }
.sp-refresh { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #ccc; padding: 6px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; transition: all 0.2s; }
.sp-refresh:hover { background: rgba(255,255,255,0.12); }
.sp-refresh:disabled { opacity: 0.4; cursor: not-allowed; }

/* Main */
.sp-main { max-width: 1200px; margin: 0 auto; padding: 24px; position: relative; z-index: 1; }

/* Summary */
.sp-summary-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.sp-summary-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 20px; text-align: center; }
.sm-val { font-size: 32px; font-weight: 700; margin-bottom: 4px; }
.sm-val small { font-size: 16px; color: #888; }
.sm-label { font-size: 13px; color: #888; }
.card-total .sm-val { color: #60a5fa; }
.card-hit .sm-val { color: #22c55e; }
.card-miss .sm-val { color: #f97316; }
.card-cov .sm-val { color: #a78bfa; }

/* Table */
.sp-table-wrap { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; overflow: hidden; }
.sp-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.sp-table th { background: rgba(255,255,255,0.04); padding: 12px 16px; text-align: left; font-weight: 500; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
.sp-table td { padding: 14px 16px; border-top: 1px solid rgba(255,255,255,0.04); }
.tr-hot { background: rgba(34, 197, 94, 0.04); }
.tr-cold { background: rgba(239, 68, 68, 0.03); }
.tr-hot:hover { background: rgba(34, 197, 94, 0.08); }
.tr-cold:hover { background: rgba(239, 68, 68, 0.06); }
.td-seed { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 13px; color: #e0e0e0; }
.seed-name { font-weight: 500; }
.domain-tag { background: rgba(96, 165, 250, 0.1); color: #60a5fa; padding: 2px 8px; border-radius: 6px; font-size: 12px; }
.td-num { font-family: 'SF Mono', 'Fira Code', monospace; text-align: center; }
.num-good { color: #22c55e; font-weight: 600; }
.num-ok { color: #facc15; }
.num-near { color: #f97316; font-weight: 600; padding: 1px 6px; background: rgba(249, 115, 22, 0.1); border-radius: 4px; }
.num-zero { color: #555; }

/* State */
.state-badge { padding: 2px 10px; border-radius: 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
.state-active { background: rgba(34, 197, 94, 0.12); color: #22c55e; }
.state-frozen { background: rgba(96, 165, 250, 0.12); color: #60a5fa; }
.state-candidate { background: rgba(249, 115, 22, 0.12); color: #f97316; }
.state-retired { background: rgba(107, 114, 128, 0.12); color: #6b7280; }

/* Empty/Loading */
.sp-empty, .sp-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; text-align: center; }
.sp-empty-icon { font-size: 64px; margin-bottom: 16px; opacity: 0.6; }
.sp-empty h2 { font-size: 20px; margin-bottom: 8px; }
.sp-empty p { color: #888; margin-bottom: 16px; }
.sp-empty-link { color: #60a5fa; text-decoration: none; font-size: 14px; }
.sp-empty-link:hover { text-decoration: underline; }
.loader { font-size: 16px; color: #888; }
</style>
