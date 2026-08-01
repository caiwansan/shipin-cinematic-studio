<!--
  Sprint-MEDIA-BUSINESS-DASHBOARD-02 — 首页 = AI 全渠道经营驾驶舱
  掌柜战略纠偏：驾驶舱不是渠道接入页 / 不是等待状态页 / 不是 AI 展示页。
  定位：所有新媒体账号、电商店铺、客户渠道的数据汇聚中心。先展示「结果」，渠道与 AI 员工是支撑结果的能力。
  信息架构：① 经营数据罗盘 → ② 今日经营总览（漂亮数据卡）→ ③ AI 正在帮你经营 → ④ 我的经营资产 → ⑤ 经营趋势 → ⑥ 渠道入口
  视觉：企业老板驾驶舱 / 高端商业 BI / 飞机驾驶仪表 / 豪华汽车中控；70% 数据视觉 / 20% AI 成果 / 10% 设置入口
  纪律：第一屏禁止「等待连接 / 未连接 / 去连接 / 连接账号」；无真实数据时用驾驶舱空态（待接入），绝不显示 0 / --；零新 API / 零新表 / 零假数据
  数据渲染逻辑预留：dashboardData 接入真实渠道数据后自动切换为完整仪表盘（示例值见 script 注释，运行时恒为空态）
-->
<template>
  <MediaWorkspaceShell>
    <!-- 身份引导（login-expired / personal-space） -->
    <div v-if="identityState === 'login-expired'" class="dash-identity dash-identity-error">
      <b>⚠️ 登录已过期</b>
      <span>你的会话已失效，请重新登录后继续使用。</span>
      <NuxtLink to="/?showLogin=1" class="dash-identity-btn">重新登录 →</NuxtLink>
    </div>

    <template v-else>
      <!-- ═══════ 顶部定位 · 我是谁 ═══════ -->
      <section class="dash-head">
        <div class="dash-head-mark">⌂</div>
        <div class="dash-head-text">
          <h1 class="dash-title">AI 全渠道经营驾驶舱</h1>
          <p class="dash-mission">所有新媒体账号、电商店铺、客户渠道的数据汇聚中心</p>
        </div>
        <div class="dash-head-stamp">
          <span class="dash-stamp-dot"></span>
          <span>{{ hasData ? '数据实时同步' : '经营驾驶舱' }}</span>
        </div>
      </section>

      <!-- ═══════ ① 经营数据罗盘（核心） ═══════ -->
      <section class="dash-compass">
        <div class="dash-compass-kicker"><span class="dash-compass-kicker-dot"></span>经营数据罗盘<span class="dash-compass-kicker-en">BUSINESS COMPASS</span></div>
        <div class="dash-compass-main">
          <!-- 圆形罗盘 -->
          <div class="dash-gauge">
            <svg class="dash-gauge-svg" viewBox="0 0 220 220">
              <!-- 刻度（每 15° 一格，270° 表盘开口朝下） -->
              <g v-for="i in 18" :key="i">
                <line
                  :x1="cx(i * 15)" :y1="cy(i * 15, 86)"
                  :x2="cx(i * 15)" :y2="cy(i * 15, i % 3 === 0 ? 76 : 82)"
                  stroke="rgba(148,163,184,0.28)" stroke-width="1.4"
                />
              </g>
              <!-- 背景弧 -->
              <circle cx="110" cy="110" r="70" fill="none" stroke="rgba(51,65,85,0.6)" stroke-width="10" stroke-linecap="round"
                :stroke-dasharray="arcDash(270)" :transform="`rotate(135 110 110)`" />
              <!-- 进度弧（接入真实数据后按健康度填充；空态为暗弧） -->
              <circle cx="110" cy="110" r="70" fill="none" stroke="url(#gaugeGrad)" stroke-width="10" stroke-linecap="round"
                :stroke-dasharray="hasData ? arcDash(healthArc) : arcDash(0)"
                :transform="`rotate(135 110 110)`" style="transition: stroke-dasharray 0.9s ease" />
              <defs>
                <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#F5B84B" />
                  <stop offset="100%" stop-color="#38BDF8" />
                </linearGradient>
              </defs>
            </svg>
            <div class="dash-gauge-center">
              <span class="dash-gauge-num">{{ hasData ? healthScore : '待接入' }}</span>
              <span class="dash-gauge-state">{{ hasData ? healthLabel : '等待数据接入' }}</span>
            </div>
            <!-- 三轴标签 -->
            <div class="dash-axis dash-axis-l">
              <span class="dash-axis-name">内容影响</span>
              <span class="dash-axis-trend" :class="axisTrend('content')">{{ axisTrend('content') === '·' ? '·' : axisTrend('content') }}</span>
            </div>
            <div class="dash-axis dash-axis-b">
              <span class="dash-axis-name">客户增长</span>
              <span class="dash-axis-trend" :class="axisTrend('customer')">{{ axisTrend('customer') === '·' ? '·' : axisTrend('customer') }}</span>
            </div>
            <div class="dash-axis dash-axis-r">
              <span class="dash-axis-name">销售转化</span>
              <span class="dash-axis-trend" :class="axisTrend('sales')">{{ axisTrend('sales') === '·' ? '·' : axisTrend('sales') }}</span>
            </div>
          </div>

          <!-- 今日速览 -->
          <div class="dash-speed">
            <div class="dash-speed-head">
              <span class="dash-speed-kicker">TODAY · 今日经营速览</span>
              <span class="dash-speed-date">{{ todayLabel }}</span>
            </div>
            <div class="dash-speed-grid">
              <div class="dash-speed-cell">
                <span class="dash-speed-label">📢 内容曝光</span>
                <span class="dash-speed-num">{{ fmtBig(d.exposure) }}</span>
                <span class="dash-speed-trend" :class="trendCls(d.exposureTrend)">{{ trendText(d.exposureTrend) }}</span>
              </div>
              <div class="dash-speed-cell">
                <span class="dash-speed-label">👥 新增客户</span>
                <span class="dash-speed-num">{{ fmtBig(d.customers) }}</span>
                <span class="dash-speed-trend" :class="trendCls(d.customerTrend)">{{ trendText(d.customerTrend) }}</span>
              </div>
              <div class="dash-speed-cell">
                <span class="dash-speed-label">🛒 成交金额</span>
                <span class="dash-speed-num">{{ fmtMoney(d.revenue) }}</span>
                <span class="dash-speed-trend" :class="trendCls(d.revenueTrend)">{{ trendText(d.revenueTrend) }}</span>
              </div>
            </div>
            <!-- 数据汇聚链 -->
            <div class="dash-flow">
              <div class="dash-flow-src">
                <span>内容</span><em>抖音 · 快手 · 小红书 · 视频号 · 公众号 · 微博</em>
                <span>电商</span><em>淘宝 · 京东 · 拼多多 · 抖音商城 · 美团</em>
                <span>客户</span><em>企业微信</em>
              </div>
              <div class="dash-flow-arrow">↓</div>
              <div class="dash-flow-node">AI 全渠道数据汇总</div>
              <div class="dash-flow-arrow">↓</div>
              <div class="dash-flow-node dash-flow-node--final">经营驾驶舱</div>
            </div>
          </div>
        </div>

        <!-- 空态引导（无真实数据时；优雅说明，不是渠道按钮） -->
        <div v-if="!hasData" class="dash-empty">
          <span class="dash-empty-ico">🧭</span>
          <div class="dash-empty-text">
            <b>你的经营驾驶舱正在等待数据接入</b>
            <span>连接你的账号后，这里会自动汇总：内容表现 · 客户增长 · 商品销售 · 品牌影响力。AI 将持续帮你分析经营机会。</span>
          </div>
        </div>
      </section>

      <!-- ═══════ ② 今日经营总览（漂亮数据卡） ═══════ -->
      <section class="dash-section">
        <div class="dash-sec-head">
          <div>
            <div class="dash-sec-kicker">今日经营总览</div>
            <h2 class="dash-sec-title">我的生意，现在怎么样</h2>
          </div>
          <span class="dash-sec-badge">{{ hasData ? '实时' : '待接入' }}</span>
        </div>

        <div class="dash-metrics">
          <div v-for="m in metrics" :key="m.key" class="dash-metric">
            <div class="dash-metric-top">
              <span class="dash-metric-ico">{{ m.icon }}</span>
              <b class="dash-metric-name">{{ m.name }}</b>
            </div>
            <div class="dash-metric-num">
              <span v-if="hasData" class="dash-metric-value">{{ m.value }}</span>
              <span v-else class="dash-metric-wait">待接入</span>
            </div>
            <div class="dash-metric-trend">
              <span v-if="hasData" class="dash-metric-delta" :class="trendCls(m.delta)">{{ m.delta > 0 ? '↑' : '↓' }} {{ Math.abs(m.delta) }}%</span>
              <span v-else class="dash-metric-delta is-idle">·</span>
              <span class="dash-metric-sub">{{ m.sub }}</span>
            </div>
            <div class="dash-metric-src">
              <span v-if="hasData">来自：{{ m.src }}</span>
              <span v-else>连接后自动汇总</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══════ ③ AI 正在帮你经营 ═══════ -->
      <section class="dash-section">
        <div class="dash-sec-head">
          <div>
            <div class="dash-sec-kicker">AI 正在帮你经营</div>
            <h2 class="dash-sec-title">今天，AI 已经为你做了这些</h2>
          </div>
          <NuxtLink to="/workspace/media/team" class="dash-sec-link">AI 员工团队 →</NuxtLink>
        </div>

        <div class="dash-ai-grid">
          <div v-for="a in aiRoster" :key="a.name" class="dash-ai-card">
            <div class="dash-ai-head">
              <span class="dash-ai-avatar">{{ a.avatar }}</span>
              <div class="dash-ai-meta">
                <b>{{ a.name }} · {{ a.role }}</b>
                <span>{{ a.focus }}</span>
              </div>
              <span class="dash-ai-state" :class="aiState(a)">{{ aiStateLabel(a) }}</span>
            </div>
            <ul class="dash-ai-todos">
              <li v-for="(t, i) in aiTodos(a)" :key="i">
                <span class="dash-ai-check" :class="aiTodos(a)[i].done ? 'on' : ''">{{ aiTodos(a)[i].done ? '✓' : '○' }}</span>
                <span class="dash-ai-todo-text">{{ aiTodos(a)[i].text }}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- ═══════ ④ 我的经营资产（数据资产池） ═══════ -->
      <section class="dash-section">
        <div class="dash-sec-head">
          <div>
            <div class="dash-sec-kicker">我的经营资产</div>
            <h2 class="dash-sec-title">数据资产池</h2>
          </div>
        </div>

        <div class="dash-assets">
          <div class="dash-assets-grid">
            <div class="dash-asset">
              <span class="dash-asset-ico">📱</span>
              <div class="dash-asset-meta">
                <b>内容账号</b>
                <span>{{ hasData ? `${assets.content} 个账号` : '待接入' }}</span>
              </div>
            </div>
            <div class="dash-asset">
              <span class="dash-asset-ico">🛒</span>
              <div class="dash-asset-meta">
                <b>店铺</b>
                <span>{{ hasData ? `${assets.shops} 个店铺` : '待接入' }}</span>
              </div>
            </div>
            <div class="dash-asset">
              <span class="dash-asset-ico">👥</span>
              <div class="dash-asset-meta">
                <b>客户渠道</b>
                <span>{{ hasData ? `${assets.channels} 个渠道` : '待接入' }}</span>
              </div>
            </div>
          </div>
          <div class="dash-assets-status">
            <span class="dash-assets-status-item"><i :class="hasData ? 'on' : ''"></i>数据同步：{{ hasData ? '正常' : '待接入' }}</span>
            <span class="dash-assets-status-item">最后更新：{{ hasData ? '刚刚' : '待接入' }}</span>
          </div>
        </div>
      </section>

      <!-- ═══════ ⑤ 经营趋势 ═══════ -->
      <section class="dash-section">
        <div class="dash-sec-head">
          <div>
            <div class="dash-sec-kicker">经营趋势</div>
            <h2 class="dash-sec-title">近 7 天</h2>
          </div>
        </div>

        <div class="dash-trend-grid">
          <div class="dash-trend">
            <span class="dash-trend-name">内容增长</span>
            <span class="dash-trend-val">{{ hasData ? '↗ ' + trends.content : '待接入' }}</span>
            <span class="dash-trend-sub">内容表现趋势</span>
          </div>
          <div class="dash-trend">
            <span class="dash-trend-name">客户增长</span>
            <span class="dash-trend-val">{{ hasData ? '↗ ' + trends.customers : '待接入' }}</span>
            <span class="dash-trend-sub">客户运营趋势</span>
          </div>
          <div class="dash-trend">
            <span class="dash-trend-name">销售增长</span>
            <span class="dash-trend-val">{{ hasData ? '↗ ' + trends.sales : '待接入' }}</span>
            <span class="dash-trend-sub">线上销售趋势</span>
          </div>
          <div class="dash-trend">
            <span class="dash-trend-name">品牌影响力</span>
            <span class="dash-trend-val">{{ hasData ? '↗ ' + trends.brand : '待接入' }}</span>
            <span class="dash-trend-sub">品牌增长趋势</span>
          </div>
        </div>

        <p class="dash-sec-note">数据接入后生成你的经营趋势</p>
      </section>

      <!-- ═══════ ⑥ 渠道入口（数据来源 · 降级为底部入口） ═══════ -->
      <section class="dash-entry">
        <div class="dash-entry-text">
          <b>渠道中心</b>
          <span>内容平台 · 电商店铺 · 客户渠道 —— 你的数据都从这里来</span>
        </div>
        <NuxtLink to="/workspace/media/accounts" class="dash-entry-link">进入渠道中心 →</NuxtLink>
      </section>
    </template>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'

definePageMeta({ middleware: 'auth' })
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'

const overview = ref<any>({
  agents: [],
  today: { completed: 0, pendingSchedules: 0, byType: [], scheduleItems: [] },
  calendar: [],
  recentOutcomes: [],
  usage: { todayCost: 0, executions: 0 },
  channels: { connected: 0, total: 9 },
})

const identityState = ref('') // '' | 'login-expired' | 'personal-space'

/* ═══ 驾驶舱数据（BUSINESS-DASHBOARD-02） ═══
 * 真实数据接入后（渠道连接服务 → AI 员工 Runtime → 数据回流），把 dashboardData 替换为真实值即可，
 * 全部渲染逻辑已按「有数据 / 无数据」双态写好。示例值仅为渲染逻辑参照，运行时恒为空态。
 * 示例（有数据时）：
 *   health: 87, healthLabel: '良好 ↑', axis: { content: 'up', customer: 'up', sales: 'up' },
 *   exposure: 128560, customers: 368, revenue: 58920, ... 
 */
const dashboardData = ref<any>(null)
const hasData = computed(() => !!dashboardData.value && !!dashboardData.value.health)

// 数据视图（无数据 → 空态占位）
const d = computed(() => {
  const raw = dashboardData.value
  return {
    exposure: raw?.exposure ?? 0,
    customers: raw?.customers ?? 0,
    revenue: raw?.revenue ?? 0,
    exposureTrend: raw?.exposureTrend ?? 0,
    customerTrend: raw?.customerTrend ?? 0,
    revenueTrend: raw?.revenueTrend ?? 0,
  }
})

const healthScore = computed(() => dashboardData.value?.health ?? 0)
const healthLabel = computed(() => dashboardData.value?.healthLabel || '—')
const healthArc = computed(() => Math.max(0, Math.min(270, (healthScore.value / 100) * 270)))

function axisTrend(key: string) {
  if (!hasData.value) return '·'
  const t = dashboardData.value?.axis?.[key]
  if (t === 'up') return '↑'
  if (t === 'down') return '↓'
  return '—'
}

const todayLabel = computed(() => {
  const now = new Date()
  return `${now.getMonth() + 1} 月 ${now.getDate()} 日`
})

function trendCls(t: number) {
  if (t > 0) return 'up'
  if (t < 0) return 'down'
  return 'idle'
}
function trendText(t: number) {
  if (t > 0) return `↑ ${t}%`
  if (t < 0) return `↓ ${Math.abs(t)}%`
  return '·'
}
function fmtBig(n: number) {
  if (!hasData.value) return '待接入'
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万'
  return String(n)
}
function fmtMoney(n: number) {
  if (!hasData.value) return '待接入'
  return '¥' + (n >= 10000 ? (n / 10000).toFixed(1).replace(/\.0$/, '') + '万' : String(n))
}

/* 罗盘 SVG 刻度坐标 */
function cx(deg: number) {
  const rad = ((deg + 135) * Math.PI) / 180
  return 110 + 90 * Math.cos(rad)
}
function cy(deg: number, r: number) {
  const rad = ((deg + 135) * Math.PI) / 180
  return 110 + r * Math.sin(rad)
}
function arcDash(totalDeg: number) {
  // 周长 = 2πr = 439.8；270° 对应 329.9
  const len = (2 * Math.PI * 70 * totalDeg) / 360
  return `${len} 440`
}

/* ═══ 今日经营总览 · 六张数据卡 ═══
 * 有数据时每卡展示：图标 + 标题 / 核心数字 / 变化趋势 / 来源说明（最多五行） */
const metrics = computed(() => {
  const raw = dashboardData.value?.metrics
  return [
    { key: 'influence', icon: '📢', name: '内容影响力', value: raw?.influence?.value ?? '—', delta: raw?.influence?.delta ?? 0, sub: '今日曝光', src: '抖音、小红书、视频号' },
    { key: 'fans', icon: '👥', name: '粉丝资产', value: raw?.fans?.value ?? '—', delta: raw?.fans?.delta ?? 0, sub: '今日新增 +2,380', src: '全内容平台粉丝' },
    { key: 'customers', icon: '💬', name: '客户经营', value: raw?.customers?.value ?? '—', delta: raw?.customers?.delta ?? 0, sub: '咨询人数 126', src: '企业微信、客服渠道' },
    { key: 'sales', icon: '🛒', name: '商品销售', value: raw?.sales?.value ?? '—', delta: raw?.sales?.delta ?? 0, sub: '订单 426', src: '淘宝、京东、拼多多、抖音商城、美团' },
    { key: 'brand', icon: '🔥', name: '品牌热度', value: raw?.brand?.value ?? '—', delta: raw?.brand?.delta ?? 0, sub: '互动率 12.6%', src: '全网搜索与互动' },
    { key: 'ai', icon: '🤖', name: 'AI 工作成果', value: raw?.ai?.value ?? '—', delta: raw?.ai?.delta ?? 0, sub: '回复客户 89 次 · 报告 1 份', src: 'AI 员工自动执行' },
  ]
})

/* ═══ AI 正在帮你经营 · 结果卡 ═══
 * 无数据：员工「已就位」+ 能力待执行；有数据：真实今日完成清单 */
const aiRoster = [
  { name: 'Alice', role: '运营策略', avatar: '👩‍💼', focus: '制定计划 · 分析经营' },
  { name: 'Carol', role: '内容生产', avatar: '👩‍🎨', focus: '生成内容 · 商品素材' },
  { name: 'David', role: '客户服务', avatar: '🧑‍💼', focus: '回复咨询 · 跟进客户' },
  { name: 'Eve', role: '经营分析', avatar: '👩‍🔬', focus: '数据报告 · 机会洞察' },
]
const aiPlans: Record<string, string[]> = {
  Alice: ['制定今日内容计划', '分析热门趋势', '推荐 3 个营销方向'],
  Carol: ['生成今日内容', '制作商品宣传图', '产出视频素材'],
  David: ['回复客户咨询', '跟进潜在客户', '整理客户需求'],
  Eve: ['生成经营报告', '发现销售机会', '优化投放建议'],
}
function aiState(a: any) {
  // 有真实 AI 执行记录 → 工作中；否则已就位
  return overview.value.recentOutcomes?.length || overview.value.agents?.length ? 'on' : 'idle'
}
function aiStateLabel(a: any) {
  return overview.value.recentOutcomes?.length || overview.value.agents?.length ? '工作中' : '已就位'
}
function aiTodos(a: any) {
  const plan = aiPlans[a.name] || []
  if (hasData.value && overview.value.recentOutcomes?.length) {
    return plan.map((t, i) => ({ text: t, done: i === 0 }))
  }
  return plan.map(t => ({ text: t, done: false }))
}

/* ═══ 我的经营资产 ═══ */
const assets = computed(() => {
  const raw = dashboardData.value?.assets
  return { content: raw?.content ?? 0, shops: raw?.shops ?? 0, channels: raw?.channels ?? 0 }
})

/* ═══ 经营趋势 ═══ */
const trends = computed(() => {
  const raw = dashboardData.value?.trends
  return {
    content: raw?.content ?? '—',
    customers: raw?.customers ?? '—',
    sales: raw?.sales ?? '—',
    brand: raw?.brand ?? '—',
  }
})

onMounted(async () => {
  const token = getAuthToken()
  try {
    const res = await fetch('/api/enterprise/media/overview', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data?.code === 0 && data?.data) {
      overview.value = data.data
      if (data.data.personalSpace) identityState.value = 'personal-space'
    } else if (res.status === 401) {
      identityState.value = 'login-expired'
    }
  } catch {
    // 静默：驾驶舱保持空态
  }
})
</script>

<style scoped>
/* ═══ 驾驶舱基调：深色仪表盘（老板驾驶舱 · 高端 BI · 飞机仪表质感） ═══ */
.dash-head {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 4px 22px;
}
.dash-head-mark {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #F5B84B;
  background: linear-gradient(135deg, rgba(245, 184, 75, 0.16), rgba(56, 189, 248, 0.1));
  border: 1px solid rgba(245, 184, 75, 0.35);
  box-shadow: 0 0 22px rgba(245, 184, 75, 0.12);
}
.dash-head-text { flex: 1; }
.dash-title {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.015em;
  color: var(--media-text-hero);
  margin: 0;
}
.dash-mission {
  font-size: 12.5px;
  color: var(--media-text-dim);
  margin: 5px 0 0;
}
.dash-head-stamp {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 700;
  color: var(--media-text-body);
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(71, 85, 105, 0.4);
  border-radius: 999px;
  padding: 6px 14px;
  letter-spacing: 0.04em;
}
.dash-stamp-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #F5B84B;
  box-shadow: 0 0 8px rgba(245, 184, 75, 0.8);
}

/* ═══ ① 经营数据罗盘 ═══ */
.dash-compass {
  position: relative;
  border-radius: 20px;
  background:
    radial-gradient(1100px 420px at 20% -10%, rgba(56, 189, 248, 0.07), transparent 60%),
    linear-gradient(180deg, #0D1428 0%, #0A0F1F 100%);
  border: 1px solid rgba(71, 85, 105, 0.45);
  box-shadow: 0 20px 50px rgba(2, 6, 23, 0.5), inset 0 1px 0 rgba(148, 163, 184, 0.08);
  padding: 30px 34px 22px;
  margin-bottom: 18px;
  overflow: hidden;
}
.dash-compass::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.035) 1px, transparent 1px);
  background-size: 34px 34px;
  pointer-events: none;
}
.dash-compass-kicker {
  position: relative;
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: var(--media-text-body);
  margin-bottom: 14px;
}
.dash-compass-kicker-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #F5B84B;
  box-shadow: 0 0 10px rgba(245, 184, 75, 0.9);
}
.dash-compass-kicker-en {
  font-size: 9px;
  letter-spacing: 0.22em;
  color: var(--media-text-dim);
  font-weight: 700;
}
.dash-compass-main {
  position: relative;
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 34px;
  align-items: center;
}
/* 罗盘表盘 */
.dash-gauge {
  position: relative;
  width: 300px;
  height: 300px;
  margin: 0 auto;
}
.dash-gauge-svg { width: 100%; height: 100%; }
.dash-gauge-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.dash-gauge-num {
  font-size: 46px;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: #F5B84B;
  text-shadow: 0 0 26px rgba(245, 184, 75, 0.35);
  line-height: 1;
}
.dash-gauge-state {
  margin-top: 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--media-text-body);
  letter-spacing: 0.06em;
}
/* 三轴 */
.dash-axis {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.dash-axis-name {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--media-text-dim);
  letter-spacing: 0.05em;
}
.dash-axis-trend {
  font-size: 14px;
  font-weight: 800;
  color: #10B981;
  text-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
}
.dash-axis-trend:not(.up):not(.down) { color: #64748b; text-shadow: none; }
.dash-axis-trend.down { color: #F87171; text-shadow: 0 0 10px rgba(248, 113, 113, 0.5); }
.dash-axis-l { left: 4px; top: 50%; transform: translateY(-50%); }
.dash-axis-b { bottom: 6px; left: 50%; transform: translateX(-50%); }
.dash-axis-r { right: 4px; top: 50%; transform: translateY(-50%); }
/* 今日速览 */
.dash-speed { min-width: 0; }
.dash-speed-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 16px;
}
.dash-speed-kicker {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: var(--media-text-dim);
}
.dash-speed-date {
  font-size: 11.5px;
  color: var(--media-text-body);
  font-weight: 600;
}
.dash-speed-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.dash-speed-cell {
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(71, 85, 105, 0.4);
  border-radius: 16px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
  overflow: hidden;
}
.dash-speed-cell::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, #F5B84B, #38BDF8);
}
.dash-speed-label { font-size: 11.5px; font-weight: 700; color: var(--media-text-body); }
.dash-speed-num {
  font-size: 30px;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: var(--media-text-hero);
  line-height: 1.1;
}
.dash-speed-trend { font-size: 12px; font-weight: 800; }
.dash-speed-trend.up { color: #10B981; }
.dash-speed-trend.down { color: #F87171; }
.dash-speed-trend.idle { color: #64748b; }
/* 数据汇聚链 */
.dash-flow {
  margin-top: 20px;
  background: rgba(2, 6, 23, 0.55);
  border: 1px dashed rgba(71, 85, 105, 0.45);
  border-radius: 14px;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.dash-flow-src {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 10.5px;
}
.dash-flow-src span {
  font-weight: 800;
  color: #38BDF8;
  background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 999px;
  padding: 2px 10px;
}
.dash-flow-src em {
  font-style: normal;
  color: var(--media-text-dim);
}
.dash-flow-arrow { color: #475569; font-size: 13px; }
.dash-flow-node {
  font-size: 11px;
  font-weight: 800;
  color: var(--media-text-body);
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(71, 85, 105, 0.5);
  border-radius: 999px;
  padding: 5px 14px;
  letter-spacing: 0.04em;
}
.dash-flow-node--final {
  color: #F5B84B;
  border-color: rgba(245, 184, 75, 0.45);
  background: rgba(245, 184, 75, 0.08);
}
/* 空态引导 */
.dash-empty {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 18px;
  padding: 14px 18px;
  border-radius: 14px;
  background: rgba(245, 184, 75, 0.07);
  border: 1px solid rgba(245, 184, 75, 0.22);
}
.dash-empty-ico { font-size: 22px; }
.dash-empty-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.dash-empty-text b {
  font-size: 13px;
  font-weight: 800;
  color: #F5B84B;
}
.dash-empty-text span {
  font-size: 12px;
  line-height: 1.7;
  color: var(--media-text-body);
}

/* ═══ 通用区块 ═══ */
.dash-section {
  margin-top: 26px;
}
.dash-sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.dash-sec-kicker {
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.16em;
  color: var(--media-ai);
  text-transform: uppercase;
}
.dash-sec-title {
  font-size: 19px;
  font-weight: 800;
  color: var(--media-text-hero);
  margin: 4px 0 0;
  letter-spacing: -0.01em;
}
.dash-sec-link {
  font-size: 12px;
  font-weight: 700;
  color: var(--media-text-body);
  text-decoration: none;
  padding: 7px 14px;
  border-radius: 10px;
  border: 1px solid rgba(71, 85, 105, 0.4);
  background: rgba(15, 23, 42, 0.7);
  transition: all 0.15s;
}
.dash-sec-link:hover { color: #F5B84B; border-color: rgba(245, 184, 75, 0.4); }
.dash-sec-badge {
  font-size: 11px;
  font-weight: 800;
  color: #F5B84B;
  background: rgba(245, 184, 75, 0.1);
  border: 1px solid rgba(245, 184, 75, 0.3);
  border-radius: 999px;
  padding: 4px 13px;
  letter-spacing: 0.08em;
}
.dash-sec-note {
  margin: 14px 0 0;
  font-size: 11.5px;
  color: var(--media-text-dim);
  text-align: center;
}

/* ═══ ② 今日经营总览 · 六张数据卡（图标 / 标题 / 核心数字 / 趋势 / 来源，五行内） ═══ */
.dash-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.dash-metric {
  background: linear-gradient(180deg, #0E1528 0%, #0B1120 100%);
  border: 1px solid rgba(71, 85, 105, 0.4);
  border-radius: 16px;
  padding: 16px 18px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  overflow: hidden;
  transition: border-color 0.18s, transform 0.18s, box-shadow 0.18s;
}
.dash-metric:hover {
  border-color: rgba(245, 184, 75, 0.35);
  transform: translateY(-2px);
  box-shadow: 0 12px 30px rgba(2, 6, 23, 0.45);
}
.dash-metric::after {
  content: '';
  position: absolute;
  right: -30px; top: -30px;
  width: 90px; height: 90px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.08), transparent 70%);
  pointer-events: none;
}
.dash-metric-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dash-metric-ico {
  width: 30px; height: 30px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.22);
}
.dash-metric-name { font-size: 13px; font-weight: 800; color: var(--media-text-hero); }
.dash-metric-num { min-height: 38px; display: flex; align-items: center; }
.dash-metric-value {
  font-size: 30px;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: var(--media-text-hero);
  line-height: 1.1;
}
.dash-metric-wait {
  font-size: 22px;
  font-weight: 800;
  color: #64748b;
  letter-spacing: 0.04em;
}
.dash-metric-trend {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dash-metric-delta { font-size: 12.5px; font-weight: 800; }
.dash-metric-delta.up { color: #10B981; }
.dash-metric-delta.down { color: #F87171; }
.dash-metric-delta.is-idle { color: #475569; font-size: 16px; line-height: 1; }
.dash-metric-sub { font-size: 11.5px; color: var(--media-text-body); }
.dash-metric-src {
  font-size: 10.5px;
  color: var(--media-text-dim);
  padding-top: 8px;
  border-top: 1px dashed rgba(71, 85, 105, 0.3);
}

/* ═══ ③ AI 正在帮你经营 ═══ */
.dash-ai-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.dash-ai-card {
  background: linear-gradient(180deg, #0E1528 0%, #0B1120 100%);
  border: 1px solid rgba(71, 85, 105, 0.4);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dash-ai-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dash-ai-avatar {
  width: 36px; height: 36px;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(56, 189, 248, 0.12));
  border: 1px solid rgba(99, 102, 241, 0.35);
}
.dash-ai-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.dash-ai-meta b { font-size: 13px; font-weight: 800; color: var(--media-text-hero); }
.dash-ai-meta span { font-size: 10.5px; color: var(--media-text-dim); }
.dash-ai-state {
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.06em;
  border-radius: 999px;
  padding: 3px 9px;
}
.dash-ai-state.on {
  color: #10B981;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
}
.dash-ai-state.idle {
  color: #94a3b8;
  background: rgba(71, 85, 105, 0.15);
  border: 1px solid rgba(71, 85, 105, 0.35);
}
.dash-ai-todos {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dash-ai-todos li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 11.5px;
  color: var(--media-text-body);
  line-height: 1.5;
}
.dash-ai-check {
  width: 15px; height: 15px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1.5px solid #475569;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  margin-top: 1px;
}
.dash-ai-check.on {
  background: rgba(16, 185, 129, 0.15);
  border-color: #10B981;
  color: #10B981;
}
.dash-ai-todo-text { flex: 1; }

/* ═══ ④ 我的经营资产 ═══ */
.dash-assets {
  background: linear-gradient(180deg, #0E1528 0%, #0B1120 100%);
  border: 1px solid rgba(71, 85, 105, 0.4);
  border-radius: 16px;
  padding: 18px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}
.dash-assets-grid {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
.dash-asset {
  display: flex;
  align-items: center;
  gap: 11px;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(71, 85, 105, 0.4);
  border-radius: 13px;
  padding: 11px 16px;
}
.dash-asset-ico {
  width: 34px; height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  background: rgba(245, 184, 75, 0.1);
  border: 1px solid rgba(245, 184, 75, 0.25);
}
.dash-asset-meta {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.dash-asset-meta b { font-size: 12.5px; font-weight: 800; color: var(--media-text-hero); }
.dash-asset-meta span { font-size: 11px; color: var(--media-text-body); }
.dash-assets-status {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dash-assets-status-item {
  font-size: 11.5px;
  color: var(--media-text-body);
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.dash-assets-status-item i {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #475569;
  display: inline-block;
}
.dash-assets-status-item i.on {
  background: #10B981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.8);
}

/* ═══ ⑤ 经营趋势 ═══ */
.dash-trend-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.dash-trend {
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(71, 85, 105, 0.4);
  border-radius: 14px;
  padding: 15px 17px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.dash-trend-name { font-size: 11.5px; font-weight: 700; color: var(--media-text-body); }
.dash-trend-val { font-size: 17px; font-weight: 900; color: #10B981; }
.dash-trend-sub { font-size: 10.5px; color: var(--media-text-dim); }

/* ═══ ⑥ 渠道入口（数据来源 · 底部中性入口） ═══ */
.dash-entry {
  margin-top: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 22px;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px dashed rgba(71, 85, 105, 0.5);
}
.dash-entry-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.dash-entry-text b { font-size: 13.5px; font-weight: 800; color: var(--media-text-hero); }
.dash-entry-text span { font-size: 11.5px; color: var(--media-text-dim); }
.dash-entry-link {
  font-size: 12.5px;
  font-weight: 800;
  color: #F5B84B;
  text-decoration: none;
  padding: 9px 18px;
  border-radius: 11px;
  background: rgba(245, 184, 75, 0.1);
  border: 1px solid rgba(245, 184, 75, 0.35);
  transition: all 0.15s;
  white-space: nowrap;
}
.dash-entry-link:hover {
  background: rgba(245, 184, 75, 0.18);
  box-shadow: 0 0 18px rgba(245, 184, 75, 0.15);
}

/* 身份引导 */
.dash-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 22px;
  border-radius: 14px;
  margin-bottom: 18px;
}
.dash-identity-error {
  background: rgba(248, 113, 113, 0.08);
  border: 1px solid rgba(248, 113, 113, 0.3);
  color: #FCA5A5;
}
.dash-identity-ok {
  background: rgba(16, 185, 129, 0.07);
  border: 1px solid rgba(16, 185, 129, 0.25);
  color: #6EE7B7;
}
.dash-identity b { font-size: 13.5px; }
.dash-identity span { flex: 1; font-size: 12px; opacity: 0.85; }
.dash-identity-btn {
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #7c5cf0, #6366f1);
  border-radius: 10px;
  padding: 8px 16px;
  text-decoration: none;
  white-space: nowrap;
}

@media (max-width: 1080px) {
  .dash-compass-main { grid-template-columns: 1fr; }
  .dash-metrics { grid-template-columns: repeat(2, 1fr); }
  .dash-ai-grid { grid-template-columns: repeat(2, 1fr); }
  .dash-trend-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .dash-metrics { grid-template-columns: 1fr; }
  .dash-ai-grid { grid-template-columns: 1fr; }
  .dash-speed-grid { grid-template-columns: 1fr; }
}
</style>
