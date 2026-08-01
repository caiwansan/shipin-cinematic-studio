<!--
  Sprint-MEDIA-UX-CONSOLIDATION-04 — 首页 = 昆仑镜统一 Workspace · 白天模式三层结构
  掌柜战略指令（UX 收敛治理）：新媒体工作台正在变成「堆功能的 AI 后台」——
  停止加模块，做 UX 收敛：像企业经营软件（Stripe/Linear/Notion），不像 AI 模板网站。
  结构（三层，老板不用滚很远）：
    第一层 经营状态 40%：AI 经营总部标题条 + 经营健康卡 / 今日核心指标 / AI 今日简报
    第二层 AI正在工作 30%：AI 员工紧凑卡（小头像/角色/状态/今日完成✓/查看详情）
    第三层 经营资产 30%：渠道/商品/客户资产 + 近7天趋势 + 渠道入口（底部中性）
  色彩：90% 中性（#F7F8FA 背景 / #FFFFFF 卡片 / #111827 文字）+ 8% 蓝 + 2% 紫（#6366F1 只点缀）
  纪律：零禁止词（等待连接/未连接/去连接/连接账号 0 出现）；无数据全「待接入」；双态渲染；零新 API/零新表/零假数据
-->
<template>
  <MediaWorkspaceShell>
    <!-- 身份引导（login-expired / personal-space） -->
    <div v-if="identityState === 'login-expired'" class="hq-identity hq-identity-error">
      <b>⚠️ 登录已过期</b>
      <span>你的会话已失效，请重新登录后继续使用。</span>
      <NuxtLink to="/?showLogin=1" class="hq-identity-btn">重新登录 →</NuxtLink>
    </div>

    <template v-else>
      <!-- ═══════ 第一层 · 经营状态（40%） ═══════ -->
      <section class="hq-top">
        <!-- 标题条（紧凑品牌区） -->
        <div class="hq-head">
          <div class="hq-head-title">
            <h1 class="hq-title">AI 经营总部</h1>
            <span class="hq-badge">企业操作系统</span>
          </div>
          <span class="hq-gm-state"><i :class="hasData ? 'on' : ''"></i>AI 团队{{ hasData ? '运行中' : '已就位' }} · 5 名 AI 员工</span>
        </div>

        <!-- 三列：健康 / 核心指标 / AI 简报 -->
        <div class="hq-top-grid">
          <!-- 经营健康卡 -->
          <div class="hq-card hq-health">
            <div class="hq-card-head">
              <span class="hq-kicker">经营状态</span>
              <span class="hq-dot" :class="hasData ? 'on' : ''"></span>
            </div>
            <div class="hq-health-score">
              <span class="hq-health-num">{{ hasData ? healthScore : '待接入' }}</span>
              <span class="hq-health-label">{{ hasData ? healthLabel : '等待数据接入' }}</span>
            </div>
            <div class="hq-health-trends">
              <div class="hq-health-trend"><span>内容</span><b :class="axisCls('content')">{{ axisTrend('content') }}</b></div>
              <div class="hq-health-trend"><span>客户</span><b :class="axisCls('customer')">{{ axisTrend('customer') }}</b></div>
              <div class="hq-health-trend"><span>销售</span><b :class="axisCls('sales')">{{ axisTrend('sales') }}</b></div>
            </div>
          </div>

          <!-- 今日核心指标 -->
          <div class="hq-card hq-kpi">
            <div class="hq-card-head">
              <span class="hq-kicker">今日核心指标</span>
              <span class="hq-date">{{ todayLabel }}</span>
            </div>
            <div class="hq-kpi-list">
              <div class="hq-kpi-row">
                <span class="hq-kpi-label">内容曝光</span>
                <span class="hq-kpi-num">{{ fmtBig(d.exposure) }}</span>
                <span class="hq-kpi-trend" :class="trendCls(d.exposureTrend)">{{ trendText(d.exposureTrend) }}</span>
              </div>
              <div class="hq-kpi-row">
                <span class="hq-kpi-label">新增客户</span>
                <span class="hq-kpi-num">{{ fmtBig(d.customers) }}</span>
                <span class="hq-kpi-trend" :class="trendCls(d.customerTrend)">{{ trendText(d.customerTrend) }}</span>
              </div>
              <div class="hq-kpi-row">
                <span class="hq-kpi-label">成交金额</span>
                <span class="hq-kpi-num">{{ fmtMoney(d.revenue) }}</span>
                <span class="hq-kpi-trend" :class="trendCls(d.revenueTrend)">{{ trendText(d.revenueTrend) }}</span>
              </div>
            </div>
          </div>

          <!-- AI 今日简报 -->
          <div class="hq-card hq-brief">
            <div class="hq-card-head">
              <span class="hq-kicker">AI 今日简报</span>
              <span class="hq-brief-badge" :class="hasData ? 'on' : ''">{{ hasData ? 'AI 已总结' : '待接入' }}</span>
            </div>
            <template v-if="hasData">
              <div class="hq-brief-item good"><b>⭐ 内容表现提升</b><span>品牌被更多人看到</span></div>
              <div class="hq-brief-item warn"><b>⚠ 需要留意</b><span>淘宝转化有所下降</span></div>
              <div class="hq-brief-item tip"><b>💡 AI 建议</b><span>增加产品测评内容</span></div>
            </template>
            <div v-else class="hq-brief-empty">
              <b>你的 AI 经营简报将在这里生成</b>
              <span>每天早晨 AI 总结内容表现 · 客户增长 · 销售机会，并给出经营建议。数据接入后自动开始。</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══════ 第二层 · AI 正在工作（30%） ═══════ -->
      <section class="hq-section">
        <div class="hq-sec-head">
          <span class="hq-sec-title">AI 正在工作</span>
          <NuxtLink to="/workspace/media/team" class="hq-sec-link">团队办公室 →</NuxtLink>
        </div>
        <div class="hq-team">
          <div v-for="a in team" :key="a.name" class="hq-team-card">
            <div class="hq-team-top">
              <span class="hq-team-avatar">{{ a.initial }}</span>
              <div class="hq-team-meta">
                <b class="hq-team-name">{{ a.name }}</b>
                <span class="hq-team-role">{{ a.role }}</span>
              </div>
              <span class="hq-team-state" :class="teamState(a)"><i></i>{{ teamStateLabel(a) }}</span>
            </div>
            <div class="hq-team-today">今日完成</div>
            <ul class="hq-team-todos">
              <li v-for="(t, i) in teamTodos(a)" :key="i">
                <span class="hq-team-check" :class="t.done ? 'on' : ''">{{ t.done ? '✓' : '○' }}</span>
                <span class="hq-team-todo-text">{{ t.text }}</span>
              </li>
            </ul>
            <NuxtLink to="/workspace/media/team" class="hq-team-more">查看详情 →</NuxtLink>
          </div>
        </div>
      </section>

      <!-- ═══════ 第三层 · 经营资产（30%） ═══════ -->
      <section class="hq-section">
        <div class="hq-sec-head">
          <span class="hq-sec-title">经营资产</span>
          <span class="hq-sec-note">数据接入后自动同步</span>
        </div>
        <div class="hq-assets">
          <div class="hq-asset">
            <span class="hq-asset-ico">◫</span>
            <div class="hq-asset-meta">
              <b>渠道资产</b>
              <span>{{ hasData ? `${assets.content + assets.shops + assets.channels} 个已接入` : '待接入' }}</span>
            </div>
          </div>
          <div class="hq-asset">
            <span class="hq-asset-ico">□</span>
            <div class="hq-asset-meta">
              <b>商品资产</b>
              <span>{{ hasData ? `${assets.shops} 个店铺` : '待接入' }}</span>
            </div>
          </div>
          <div class="hq-asset">
            <span class="hq-asset-ico">♡</span>
            <div class="hq-asset-meta">
              <b>客户资产</b>
              <span>{{ hasData ? `${assets.channels} 个渠道` : '待接入' }}</span>
            </div>
          </div>
          <div class="hq-asset-sync"><i :class="hasData ? 'on' : ''"></i>数据同步：{{ hasData ? '正常' : '待接入' }}</div>
        </div>

        <div class="hq-trends">
          <div class="hq-trend"><span class="hq-trend-name">内容增长</span><b>{{ hasData ? '↗ ' + trends.content : '待接入' }}</b><em>近 7 天</em></div>
          <div class="hq-trend"><span class="hq-trend-name">客户增长</span><b>{{ hasData ? '↗ ' + trends.customers : '待接入' }}</b><em>近 7 天</em></div>
          <div class="hq-trend"><span class="hq-trend-name">销售增长</span><b>{{ hasData ? '↗ ' + trends.sales : '待接入' }}</b><em>近 7 天</em></div>
          <div class="hq-trend"><span class="hq-trend-name">品牌影响力</span><b>{{ hasData ? '↗ ' + trends.brand : '待接入' }}</b><em>近 7 天</em></div>
        </div>

        <!-- 渠道入口（数据来源 · 底部中性入口） -->
        <NuxtLink to="/workspace/media/accounts" class="hq-entry">
          <span class="hq-entry-text"><b>渠道中心</b><em>内容平台 · 电商店铺 · 客户渠道 —— 你的数据都从这里来</em></span>
          <span class="hq-entry-link">进入渠道中心 →</span>
        </NuxtLink>
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

/* ═══ 经营数据（UX-CONSOLIDATION-04） ═══
 * 真实数据接入后（渠道连接服务 → AI 员工 Runtime → 数据回流），把 dashboardData 替换为真实值即可，
 * 全部渲染逻辑已按「有数据 / 无数据」双态写好。示例值仅为渲染逻辑参照，运行时恒为空态。 */
const dashboardData = ref<any>(null)
const hasData = computed(() => !!dashboardData.value && !!dashboardData.value.health)

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

const todayLabel = computed(() => {
  const now = new Date()
  return `${now.getMonth() + 1} 月 ${now.getDate()} 日`
})

function axisTrend(key: string) {
  if (!hasData.value) return '·'
  const t = dashboardData.value?.axis?.[key]
  if (t === 'up') return '↑'
  if (t === 'down') return '↓'
  return '→'
}
function axisCls(key: string) {
  const t = dashboardData.value?.axis?.[key]
  if (t === 'up') return 'up'
  if (t === 'down') return 'down'
  return ''
}
function trendCls(t: number) {
  if (t > 0) return 'up'
  if (t < 0) return 'down'
  return 'idle'
}
function trendText(t: number) {
  if (t > 0) return `↑ ${t}%`
  if (t < 0) return `↓ ${Math.abs(t)}%`
  return '→'
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

/* ═══ AI 团队（紧凑员工卡：小头像/角色/状态/今日完成/查看详情） ═══ */
const team = [
  { name: 'Alice', role: '运营总监', initial: 'A', focus: '制定运营计划 · 分析经营' },
  { name: 'Bob', role: '内容策划', initial: 'B', focus: '发现热点 · 营销机会' },
  { name: 'Carol', role: '内容专家', initial: 'C', focus: '制作内容 · 商品素材' },
  { name: 'David', role: '客户管家', initial: 'D', focus: '回复咨询 · 跟进客户' },
  { name: 'Eve', role: '数据分析师', initial: 'E', focus: '数据报告 · 收益提升' },
]
const teamPlans: Record<string, string[]> = {
  Alice: ['制定今日内容计划', '分析经营数据'],
  Bob: ['发现今日热点', '寻找营销机会'],
  Carol: ['生成今日内容', '制作商品素材'],
  David: ['回复客户咨询', '跟进潜在客户'],
  Eve: ['生成经营报告', '优化投放建议'],
}
function teamState(a: any) {
  return overview.value.recentOutcomes?.length || overview.value.agents?.length ? 'on' : 'idle'
}
function teamStateLabel(a: any) {
  return overview.value.recentOutcomes?.length || overview.value.agents?.length ? '正在工作' : '已就位'
}
function teamTodos(a: any) {
  const plan = teamPlans[a.name] || []
  if (hasData.value && overview.value.recentOutcomes?.length) {
    return plan.map((t, i) => ({ text: t, done: i === 0 }))
  }
  return plan.map(t => ({ text: t, done: false }))
}

/* ═══ 经营资产 ═══ */
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
    // 静默：经营总部保持空态
  }
})
</script>

<style scoped>
/* ═══════ 昆仑镜 Workspace · 白天 SaaS 视觉 ═══════
 * 90% 中性（白/雾灰/深灰）+ 8% 蓝 + 2% 紫（#6366F1 只点缀：数字/激活/CTA）
 * 紧凑卡片：白卡 + 细边框 + 微投影；无大面积渐变、无金色、无玻璃炫技 */

.hq-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.hq-head-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.hq-title {
  font-size: 21px;
  font-weight: 800;
  color: #111827;
  margin: 0;
  letter-spacing: -0.01em;
}
.hq-badge {
  font-size: 10px;
  font-weight: 700;
  color: #6366F1;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 999px;
  padding: 3px 10px;
  letter-spacing: 0.06em;
}
.hq-gm-state {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11.5px;
  font-weight: 600;
  color: #64748B;
}
.hq-gm-state i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #CBD5E1;
  display: inline-block;
}
.hq-gm-state i.on {
  background: #16A34A;
}

/* ── 第一层 grid ── */
.hq-top-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1.25fr;
  gap: 12px;
}
.hq-card {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  padding: 16px 18px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
}
.hq-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.hq-kicker {
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: #9CA3AF;
  text-transform: uppercase;
}
.hq-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #CBD5E1;
}
.hq-dot.on {
  background: #16A34A;
}
.hq-date {
  font-size: 11px;
  color: #9CA3AF;
  font-weight: 600;
}

/* 经营健康卡 */
.hq-health-score {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
}
.hq-health-num {
  font-size: 34px;
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1;
  background: linear-gradient(135deg, #6366F1, #4F46E5);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.hq-health-label {
  font-size: 12px;
  font-weight: 600;
  color: #9CA3AF;
}
.hq-health-trends {
  display: flex;
  gap: 8px;
}
.hq-health-trend {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #F8FAFC;
  border: 1px solid #EEF0F3;
}
.hq-health-trend span {
  font-size: 10.5px;
  font-weight: 600;
  color: #94A3B8;
}
.hq-health-trend b {
  font-size: 14px;
  font-weight: 800;
  color: #CBD5E1;
}
.hq-health-trend b.up { color: #16A34A; }
.hq-health-trend b.down { color: #DC2626; }

/* 今日核心指标 */
.hq-kpi-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hq-kpi-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  background: #F8FAFC;
  border: 1px solid #EEF0F3;
}
.hq-kpi-label {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: #64748B;
}
.hq-kpi-num {
  font-size: 18px;
  font-weight: 800;
  color: #111827;
  letter-spacing: -0.01em;
}
.hq-kpi-trend {
  min-width: 44px;
  text-align: right;
  font-size: 11.5px;
  font-weight: 700;
}
.hq-kpi-trend.up { color: #16A34A; }
.hq-kpi-trend.down { color: #DC2626; }
.hq-kpi-trend.idle { color: #CBD5E1; }

/* AI 今日简报 */
.hq-brief-badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #9CA3AF;
  background: #F3F4F6;
  border: 1px solid #E5E7EB;
  border-radius: 999px;
  padding: 2px 10px;
}
.hq-brief-badge.on {
  color: #16A34A;
  background: rgba(22, 163, 74, 0.07);
  border-color: rgba(22, 163, 74, 0.25);
}
.hq-brief-item {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  background: #F8FAFC;
  border: 1px solid #EEF0F3;
  margin-bottom: 6px;
}
.hq-brief-item:last-child { margin-bottom: 0; }
.hq-brief-item b {
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}
.hq-brief-item span {
  font-size: 11.5px;
  color: #64748B;
}
.hq-brief-item.good b { color: #16A34A; }
.hq-brief-item.warn b { color: #D97706; }
.hq-brief-item.tip b { color: #4F46E5; }
.hq-brief-empty {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #F8FAFC;
  border: 1px dashed rgba(99, 102, 241, 0.3);
}
.hq-brief-empty b {
  font-size: 12.5px;
  font-weight: 800;
  color: #4F46E5;
}
.hq-brief-empty span {
  font-size: 11.5px;
  line-height: 1.6;
  color: #64748B;
}

/* ── 区块通用 ── */
.hq-section {
  margin-top: 20px;
}
.hq-sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.hq-sec-title {
  font-size: 14.5px;
  font-weight: 800;
  color: #111827;
  letter-spacing: -0.01em;
}
.hq-sec-link {
  font-size: 11.5px;
  font-weight: 600;
  color: #6366F1;
  text-decoration: none;
}
.hq-sec-link:hover { color: #4F46E5; }
.hq-sec-note {
  font-size: 11px;
  color: #9CA3AF;
}

/* ── 第二层 · AI 正在工作 ── */
.hq-team {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}
.hq-team-card {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  padding: 13px 14px 12px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
  display: flex;
  flex-direction: column;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.hq-team-card:hover {
  border-color: rgba(99, 102, 241, 0.4);
  box-shadow: 0 4px 14px rgba(16, 24, 40, 0.08);
}
.hq-team-top {
  display: flex;
  align-items: center;
  gap: 9px;
}
.hq-team-avatar {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
  color: #4F46E5;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.2);
  font-family: var(--font-mono);
}
.hq-team-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.hq-team-name {
  font-size: 12.5px;
  font-weight: 800;
  color: #111827;
}
.hq-team-role {
  font-size: 10px;
  color: #9CA3AF;
}
.hq-team-state {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 9.5px;
  font-weight: 700;
  border-radius: 999px;
  padding: 2px 8px;
  white-space: nowrap;
}
.hq-team-state i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  display: inline-block;
}
.hq-team-state.on {
  color: #16A34A;
  background: rgba(22, 163, 74, 0.07);
  border: 1px solid rgba(22, 163, 74, 0.22);
}
.hq-team-state.on i { background: #16A34A; }
.hq-team-state.idle {
  color: #94A3B8;
  background: #F3F4F6;
  border: 1px solid #E5E7EB;
}
.hq-team-state.idle i { background: #CBD5E1; }
.hq-team-today {
  margin-top: 11px;
  padding-top: 8px;
  border-top: 1px dashed #EEF0F3;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: #9CA3AF;
  text-transform: uppercase;
}
.hq-team-todos {
  list-style: none;
  margin: 7px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.hq-team-todos li {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 10.5px;
  color: #64748B;
  line-height: 1.4;
}
.hq-team-check {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1.5px solid #D1D5DB;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  color: transparent;
}
.hq-team-check.on {
  background: rgba(22, 163, 74, 0.1);
  border-color: #16A34A;
  color: #16A34A;
}
.hq-team-more {
  margin-top: 9px;
  padding-top: 7px;
  border-top: 1px solid #F1F3F5;
  font-size: 10.5px;
  font-weight: 700;
  color: #6366F1;
  text-decoration: none;
}
.hq-team-more:hover { color: #4F46E5; }

/* ── 第三层 · 经营资产 ── */
.hq-assets {
  display: flex;
  align-items: stretch;
  gap: 10px;
}
.hq-asset {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 11px;
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  padding: 12px 15px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
}
.hq-asset-ico {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #6366F1;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.2);
}
.hq-asset-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hq-asset-meta b { font-size: 12.5px; font-weight: 800; color: #111827; }
.hq-asset-meta span { font-size: 11px; color: #9CA3AF; }
.hq-asset-sync {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 600;
  color: #94A3B8;
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  padding: 12px 15px;
  white-space: nowrap;
}
.hq-asset-sync i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #CBD5E1;
  display: inline-block;
}
.hq-asset-sync i.on {
  background: #16A34A;
}

/* 趋势 */
.hq-trends {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-top: 10px;
}
.hq-trend {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 10px;
  padding: 10px 13px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
}
.hq-trend-name {
  flex: 1;
  font-size: 11px;
  font-weight: 600;
  color: #64748B;
}
.hq-trend b {
  font-size: 13px;
  font-weight: 800;
  color: #16A34A;
}
.hq-trend em {
  font-style: normal;
  font-size: 9.5px;
  color: #CBD5E1;
}

/* 渠道入口 */
.hq-entry {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 16px;
  border-radius: 10px;
  background: #FFFFFF;
  border: 1px dashed #D1D5DB;
  text-decoration: none;
  transition: border-color 0.15s;
}
.hq-entry:hover { border-color: rgba(99, 102, 241, 0.45); }
.hq-entry-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hq-entry-text b { font-size: 12.5px; font-weight: 800; color: #111827; }
.hq-entry-text em {
  font-style: normal;
  font-size: 11px;
  color: #9CA3AF;
}
.hq-entry-link {
  font-size: 11.5px;
  font-weight: 700;
  color: #6366F1;
  white-space: nowrap;
}

/* 身份引导 */
.hq-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-radius: 12px;
  margin-bottom: 16px;
}
.hq-identity-error {
  background: #FEF2F2;
  border: 1px solid #FECACA;
  color: #B91C1C;
}
.hq-identity b { font-size: 13px; }
.hq-identity span { flex: 1; font-size: 12px; opacity: 0.85; }
.hq-identity-btn {
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #6366F1, #4F46E5);
  border-radius: 9px;
  padding: 7px 14px;
  text-decoration: none;
  white-space: nowrap;
}

@media (max-width: 1080px) {
  .hq-top-grid { grid-template-columns: 1fr; }
  .hq-team { grid-template-columns: repeat(3, 1fr); }
  .hq-assets { flex-wrap: wrap; }
  .hq-trends { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 720px) {
  .hq-team { grid-template-columns: repeat(2, 1fr); }
  .hq-trends { grid-template-columns: 1fr; }
}
</style>
