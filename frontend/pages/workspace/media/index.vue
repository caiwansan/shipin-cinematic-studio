<!--
  Sprint-MEDIA-UX-PRODUCT-DESIGN-05 — 首页 = 老板桌面（Design System v1）
  掌柜纠偏：不是换颜色，是建立世界级 AI 企业产品视觉。
  老板每天打开想知道「今天公司怎么样？」→ 第一屏就是经营结果：
    ① 问候条：「早上好，老板」+ 日期 + AI 团队状态
    ② 经营状态：健康指数 / 收入趋势 / 客户增长 三卡（紧凑 80-120px）
    ③ 今天 AI 已完成：✓ 清单（真实数据，空态说明）
    ④ 本周经营表现：苹果式摘要（大数字 + 三指标 + AI 判断）
    ⑤ 我的业务地图：内容 / 客户 / 商品 / 渠道 四入口
  视觉：90% 中性（#F4F6FA/#FFFFFF/#111827）+ 昆仑蓝 #2563EB 点缀 + 青蓝 #06B6D4 AI 态
  纪律：零禁止词；无数据全「待接入」；双态渲染；零新 API/零新表/零假数据
-->
<template>
  <MediaWorkspaceShell>
    <!-- 身份引导 -->
    <div v-if="identityState === 'login-expired'" class="hq-identity hq-identity-error">
      <b>⚠️ 登录已过期</b>
      <span>你的会话已失效，请重新登录后继续使用。</span>
      <NuxtLink to="/?showLogin=1" class="hq-identity-btn">重新登录 →</NuxtLink>
    </div>

    <template v-else>
      <!-- ① 问候条 -->
      <div class="hq-greet">
        <div class="hq-greet-text">
          <h1 class="hq-greet-title">{{ greetWord }}，老板</h1>
          <p class="hq-greet-sub">今天是 {{ todayLabel }}，{{ greetSub }}</p>
        </div>
        <span class="hq-gm-state"><i :class="hasData ? 'on' : ''"></i>AI 团队{{ hasData ? '运行中' : '已就位' }} · 5 名 AI 员工</span>
      </div>

      <!-- ② 经营状态三卡 -->
      <div class="hq-stats">
        <div class="hq-stat">
          <div class="hq-stat-head"><span class="hq-kicker">经营健康</span><span class="hq-stat-src">综合</span></div>
          <div class="hq-stat-row">
            <b class="hq-stat-num hl">{{ hasData ? healthScore : '待接入' }}</b>
            <span v-if="hasData" class="hq-stat-trend up">↑ {{ healthTrend }}%</span>
          </div>
          <div class="hq-stat-foot">本周{{ hasData ? '增长 ' + healthTrend + '%' : '等待数据接入' }}</div>
        </div>
        <div class="hq-stat">
          <div class="hq-stat-head"><span class="hq-kicker">收入趋势</span><span class="hq-stat-src">近 7 天</span></div>
          <div class="hq-stat-row">
            <b class="hq-stat-num">{{ fmtMoney(d.revenue) }}</b>
            <span class="hq-stat-trend" :class="trendCls(d.revenueTrend)">{{ trendText(d.revenueTrend) }}</span>
          </div>
          <div class="hq-stat-foot">{{ hasData ? '成交金额 · 全渠道' : '等待数据接入' }}</div>
        </div>
        <div class="hq-stat">
          <div class="hq-stat-head"><span class="hq-kicker">客户增长</span><span class="hq-stat-src">近 7 天</span></div>
          <div class="hq-stat-row">
            <b class="hq-stat-num">{{ fmtInt(d.customers) }}</b>
            <span class="hq-stat-trend" :class="trendCls(d.customerTrend)">{{ trendText(d.customerTrend) }}</span>
          </div>
          <div class="hq-stat-foot">{{ hasData ? '新增客户 · 全渠道' : '等待数据接入' }}</div>
        </div>
      </div>

      <!-- ③ 今天 AI 已完成 -->
      <div class="hq-sec">
        <div class="hq-sec-head">
          <span class="hq-sec-title">今天 AI 已完成</span>
          <NuxtLink to="/workspace/media/team" class="hq-sec-link">我的 AI 管理团队 →</NuxtLink>
        </div>
        <div class="hq-done">
          <template v-if="hasData && doneItems.length">
            <div v-for="(item, i) in doneItems" :key="i" class="hq-done-item">
              <span class="hq-done-check">✓</span>
              <span class="hq-done-text">{{ item }}</span>
            </div>
          </template>
          <div v-else class="hq-done-empty">
            <b>AI 今天的工作记录将在这里显示</b>
            <span>数据接入后，AI 员工每天完成的内容分析、销售机会发现、客户回复都会汇总到这里。</span>
          </div>
        </div>
      </div>

      <!-- ④ 本周经营表现（苹果式摘要） -->
      <div class="hq-sec">
        <div class="hq-sec-head">
          <span class="hq-sec-title">本周经营表现</span>
          <span class="hq-sec-note">近 7 天 · 全渠道汇总</span>
        </div>
        <div class="hq-week">
          <div class="hq-week-main">
            <div class="hq-week-num" :class="hasData ? 'up' : ''">{{ hasData ? '↑' + weekDelta + '%' : '待接入' }}</div>
            <div class="hq-week-label">整体经营表现</div>
          </div>
          <div class="hq-week-metrics">
            <div class="hq-week-metric"><span>内容曝光</span><b>{{ fmtBig(d.exposure) }}</b></div>
            <div class="hq-week-metric"><span>客户增长</span><b>{{ fmtInt(d.customers) }}</b></div>
            <div class="hq-week-metric"><span>成交金额</span><b>{{ fmtMoney(d.revenue) }}</b></div>
          </div>
          <div class="hq-week-judge">
            <span class="hq-week-judge-ico">AI</span>
            <div class="hq-week-judge-text">
              <b>AI 判断</b>
              <span>{{ hasData ? aiJudge : '数据接入后，AI 将给出本周经营判断与建议。' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ⑤ 我的业务地图 -->
      <div class="hq-sec">
        <div class="hq-sec-head">
          <span class="hq-sec-title">我的业务地图</span>
          <span class="hq-sec-note">内容 · 客户 · 商品 · 渠道</span>
        </div>
        <div class="hq-map">
          <NuxtLink to="/workspace/media/content" class="hq-map-card">
            <span class="hq-map-ico" v-html="mapIcons.content"></span>
            <div class="hq-map-meta"><b>内容</b><span>选题 · 创作 · 发布 · 复盘</span></div>
            <span class="hq-map-go">→</span>
          </NuxtLink>
          <NuxtLink to="/workspace/media/messages" class="hq-map-card">
            <span class="hq-map-ico" v-html="mapIcons.customer"></span>
            <div class="hq-map-meta"><b>客户</b><span>咨询回复 · 销售机会</span></div>
            <span class="hq-map-go">→</span>
          </NuxtLink>
          <NuxtLink to="/workspace/media/shop" class="hq-map-card">
            <span class="hq-map-ico" v-html="mapIcons.shop"></span>
            <div class="hq-map-meta"><b>商品</b><span>商品经营 · 线上生意</span></div>
            <span class="hq-map-go">→</span>
          </NuxtLink>
          <NuxtLink to="/workspace/media/accounts" class="hq-map-card">
            <span class="hq-map-ico" v-html="mapIcons.channel"></span>
            <div class="hq-map-meta"><b>渠道</b><span>内容平台 · 电商 · 客户渠道</span></div>
            <span class="hq-map-go">→</span>
          </NuxtLink>
        </div>
      </div>
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

/* ═══ 经营数据（Design System v1） ═══
 * 真实数据接入后把 dashboardData 替换为真实值即可（双态渲染已就绪）；示例值仅注释参照，运行时恒空态 */
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
const healthTrend = computed(() => dashboardData.value?.healthTrend ?? 0)
const weekDelta = computed(() => dashboardData.value?.weekDelta ?? 0)
const aiJudge = computed(() => dashboardData.value?.aiJudge || '')

const doneItems = computed(() => {
  const raw = dashboardData.value?.doneToday
  if (Array.isArray(raw) && raw.length) return raw
  const t = overview.value.today || {}
  const items: string[] = []
  if (t.completed > 0) items.push(`完成 ${t.completed} 项内容分析与经营任务`)
  if (overview.value.recentOutcomes?.length) {
    overview.value.recentOutcomes.slice(0, 3).forEach((o: any) => {
      if (o?.title) items.push(o.title)
    })
  }
  return items
})

const now = new Date()
const hour = now.getHours()
const greetWord = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好'
const greetSub = hasData.value ? '今天你的生意正在被 AI 打理。' : '这是你的 AI 经营总部，数据接入后自动汇报经营情况。'
const todayLabel = computed(() => {
  const n = new Date()
  return `${n.getMonth() + 1} 月 ${n.getDate()} 日`
})

function trendCls(t: number) {
  if (t > 0) return 'up'
  if (t < 0) return 'down'
  return 'idle'
}
function trendText(t: number) {
  if (t > 0) return `↑ ${t}%`
  if (t < 0) return `↓ ${Math.abs(t)}%`
  return '→ 持平'
}
function fmtBig(n: number) {
  if (!hasData.value) return '待接入'
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万'
  return String(n)
}
function fmtInt(n: number) {
  if (!hasData.value) return '待接入'
  if (n > 0) return '+' + n
  return String(n)
}
function fmtMoney(n: number) {
  if (!hasData.value) return '待接入'
  return '¥' + (n >= 10000 ? (n / 10000).toFixed(1).replace(/\.0$/, '') + '万' : n.toLocaleString())
}

/* 业务地图图标（SVG 线性） */
const S = (path: string) =>
  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`
const mapIcons = {
  content: S('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  customer: S('<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-4.7a8.5 8.5 0 1 1 16.1-4.8z"/>'),
  shop: S('<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M16 10a4 4 0 0 1-8 0"/>'),
  channel: S('<circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="5" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M7.4 10.9L16.6 6M7.4 13.1L16.6 18"/>'),
}

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
/* ═══════ 老板桌面 · Design System v1 ═══════
   90% 中性 + 昆仑蓝点缀 + 青蓝 AI 态；卡片 80-120px；信息密度高；无大 Hero */

/* ① 问候条 */
.hq-greet {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}
.hq-greet-title {
  font-size: 24px;
  font-weight: 800;
  color: #111827;
  margin: 0;
  letter-spacing: -0.02em;
}
.hq-greet-sub {
  font-size: 12.5px;
  color: #64748B;
  margin: 6px 0 0;
}
.hq-gm-state {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11.5px;
  font-weight: 600;
  color: #64748B;
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 999px;
  padding: 6px 13px;
  white-space: nowrap;
}
.hq-gm-state i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #CBD5E1;
  display: inline-block;
}
.hq-gm-state i.on {
  background: #10B981;
}

/* ② 经营状态三卡（紧凑） */
.hq-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.hq-stat {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  padding: 13px 16px 12px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
}
.hq-stat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.hq-kicker {
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #9CA3AF;
}
.hq-stat-src {
  font-size: 10px;
  color: #CBD5E1;
  font-weight: 600;
}
.hq-stat-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.hq-stat-num {
  font-size: 26px;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: #111827;
  line-height: 1.1;
}
.hq-stat-num.hl {
  background: linear-gradient(135deg, #2563EB, #1D4ED8);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.hq-stat-trend {
  font-size: 12px;
  font-weight: 800;
}
.hq-stat-trend.up { color: #10B981; }
.hq-stat-trend.down { color: #DC2626; }
.hq-stat-trend.idle { color: #9CA3AF; }
.hq-stat-foot {
  margin-top: 7px;
  font-size: 11px;
  color: #9CA3AF;
}

/* 区块 */
.hq-sec {
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
  color: #2563EB;
  text-decoration: none;
}
.hq-sec-link:hover { color: #1D4ED8; }
.hq-sec-note {
  font-size: 11px;
  color: #9CA3AF;
}

/* ③ 今天 AI 已完成 */
.hq-done {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.hq-done-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 10px;
  background: #F8FAFC;
  border: 1px solid #EEF0F3;
  font-size: 12.5px;
  font-weight: 600;
  color: #475569;
}
.hq-done-check {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.12);
  color: #10B981;
  font-size: 10px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hq-done-empty {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 6px 10px;
}
.hq-done-empty b {
  font-size: 12.5px;
  font-weight: 800;
  color: #475569;
}
.hq-done-empty span {
  font-size: 11.5px;
  color: #9CA3AF;
  line-height: 1.6;
}

/* ④ 本周经营表现（苹果式摘要） */
.hq-week {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
  display: grid;
  grid-template-columns: 200px 1fr 1.3fr;
  gap: 0;
  overflow: hidden;
}
.hq-week-main {
  padding: 18px 20px;
  border-right: 1px solid #EEF0F3;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}
.hq-week-num {
  font-size: 30px;
  font-weight: 900;
  letter-spacing: -0.03em;
  color: #9CA3AF;
}
.hq-week-num.up {
  background: linear-gradient(135deg, #2563EB, #06B6D4);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.hq-week-label {
  font-size: 11.5px;
  color: #9CA3AF;
  font-weight: 600;
}
.hq-week-metrics {
  padding: 18px 20px;
  border-right: 1px solid #EEF0F3;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
}
.hq-week-metric {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}
.hq-week-metric span {
  font-size: 12px;
  color: #64748B;
  font-weight: 600;
}
.hq-week-metric b {
  font-size: 17px;
  font-weight: 800;
  color: #111827;
}
.hq-week-judge {
  padding: 18px 20px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: rgba(6, 182, 212, 0.035);
}
.hq-week-judge-ico {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 8px;
  background: linear-gradient(135deg, #2563EB, #06B6D4);
  color: #fff;
  font-size: 10px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
}
.hq-week-judge-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.hq-week-judge-text b {
  font-size: 12px;
  font-weight: 800;
  color: #0E7490;
}
.hq-week-judge-text span {
  font-size: 12px;
  color: #64748B;
  line-height: 1.6;
}

/* ⑤ 我的业务地图 */
.hq-map {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.hq-map-card {
  display: flex;
  align-items: center;
  gap: 11px;
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  padding: 13px 15px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
  text-decoration: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.hq-map-card:hover {
  border-color: rgba(37, 99, 235, 0.4);
  box-shadow: 0 4px 14px rgba(16, 24, 40, 0.07);
}
.hq-map-ico {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #2563EB;
  background: rgba(37, 99, 235, 0.07);
  border: 1px solid rgba(37, 99, 235, 0.18);
}
.hq-map-ico :deep(svg) { display: block; }
.hq-map-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hq-map-meta b {
  font-size: 13px;
  font-weight: 800;
  color: #111827;
}
.hq-map-meta span {
  font-size: 10.5px;
  color: #9CA3AF;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hq-map-go {
  font-size: 13px;
  color: #CBD5E1;
  font-weight: 700;
  transition: color 0.15s, transform 0.15s;
}
.hq-map-card:hover .hq-map-go {
  color: #2563EB;
  transform: translateX(2px);
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
  background: linear-gradient(135deg, #2563EB, #1D4ED8);
  border-radius: 9px;
  padding: 7px 14px;
  text-decoration: none;
  white-space: nowrap;
}

@media (max-width: 1080px) {
  .hq-stats { grid-template-columns: 1fr; }
  .hq-week { grid-template-columns: 1fr; }
  .hq-week-main, .hq-week-metrics { border-right: none; border-bottom: 1px solid #EEF0F3; }
  .hq-map { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 720px) {
  .hq-map { grid-template-columns: 1fr; }
}
</style>
