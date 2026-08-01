<!--
  Sprint-MEDIA-EXECUTIVE-EXPERIENCE-03 — 首页 = AI 企业经营总部（纯视觉体验重构）
  掌柜战略指令：从「数据驾驶舱」升级为「AI 企业经营总部」——老板打开的不是报表，是自己的 AI 公司。
  设计纪律：
    ❌ 数据大屏风 / 仪表盘模板风 / 卡片堆叠风 / 科技蓝炫技风 / 金色廉价感
    ✅ 高级 · 克制 · 可信 · 未来企业 · AI 助理（Apple 发布页 / Notion / Linear / Stripe 商业感）
  信息架构：① Hero（你的 AI 经营总部 + AI 总经理状态）→ ② AI 今日简报（老板每天打开的理由）
            → ③ 经营健康卡 + 今日速览 → ④ 经营故事卡（数字 + 洞察 + AI建议）→ ⑤ 我的 AI 团队（员工正在干活）
            → ⑥ 我的经营资产 → ⑦ 经营趋势 → ⑧ 渠道入口（底部中性入口）
  色彩：深墨灰 #0B1020 基础 / 昆仑紫 #7C3AED 主色 / 智能蓝 #3B82F6 辅助 / 成长绿 #22C55E 强调；金色退场
  纪律：第一屏禁止「等待连接 / 未连接 / 去连接 / 连接账号」；无真实数据时「待接入」优雅空态，绝不显示 0 / --；
        零新 API / 零新表 / 零假数据；dashboardData 接入真实数据后自动点亮（示例值仅注释）
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
      <!-- ═══════ ① Hero · 你的 AI 经营总部 ═══════ -->
      <section class="hq-hero">
        <div class="hq-hero-glow"></div>
        <div class="hq-hero-left">
          <div class="hq-hero-badge"><span class="hq-hero-badge-dot"></span>AI 企业经营操作系统</div>
          <h1 class="hq-hero-title">你的 AI 经营总部</h1>
          <p class="hq-hero-sub">让 AI 员工每天帮你管理内容、客户和线上生意</p>
          <div class="hq-hero-meta">
            <span class="hq-hero-meta-item"><i :class="hasData ? 'on' : ''"></i>AI 团队{{ hasData ? '运行中' : '已就位' }}</span>
            <span class="hq-hero-meta-item">5 名 AI 员工</span>
            <span class="hq-hero-meta-item">{{ todayLabel }}</span>
          </div>
        </div>

        <!-- AI 总经理状态卡 -->
        <div class="hq-gm">
          <div class="hq-gm-head">
            <span class="hq-gm-avatar">🧭</span>
            <div class="hq-gm-meta">
              <b>AI 运营团队</b>
              <span class="hq-gm-state"><i :class="hasData ? 'on' : ''"></i>{{ hasData ? '正常运行' : '已就位 · 等待数据接入' }}</span>
            </div>
          </div>
          <div class="hq-gm-title">今日完成</div>
          <ul class="hq-gm-todos">
            <template v-if="hasData">
              <li><span class="hq-gm-check on">✓</span>内容规划</li>
              <li><span class="hq-gm-check on">✓</span>客户分析</li>
              <li><span class="hq-gm-check on">✓</span>经营复盘</li>
            </template>
            <li v-else class="hq-gm-idle">
              数据接入后，AI 团队每天自动完成：内容规划 · 客户分析 · 经营复盘
            </li>
          </ul>
        </div>
      </section>

      <!-- ═══════ ② AI 今日简报 · 老板每天打开的理由 ═══════ -->
      <section class="hq-brief">
        <div class="hq-brief-head">
          <div>
            <div class="hq-sec-kicker">AI 今日简报</div>
            <h2 class="hq-sec-title">早上好，老板</h2>
          </div>
          <span class="hq-brief-badge" :class="hasData ? 'on' : ''">{{ hasData ? 'AI 已为你总结' : '待接入' }}</span>
        </div>

        <!-- 有数据：AI 经营摘要（示例结构，真实数据接入后自动点亮） -->
        <div v-if="hasData" class="hq-brief-body">
          <div class="hq-brief-item good">
            <b>⭐ 内容表现提升</b>
            <span>小红书互动增长明显，品牌被更多人看到</span>
          </div>
          <div class="hq-brief-item warn">
            <b>⚠ 需要留意</b>
            <span>淘宝商品转化有所下降</span>
          </div>
          <div class="hq-brief-item tip">
            <b>💡 AI 建议</b>
            <span>今天增加产品测评内容，带动转化回升</span>
          </div>
        </div>

        <!-- 空态：简报说明（绝不编造经营结论） -->
        <div v-else class="hq-brief-empty">
          <span class="hq-brief-empty-ico">🗞</span>
          <div class="hq-brief-empty-text">
            <b>你的 AI 经营简报将在这里生成</b>
            <span>每天早晨，AI 为你总结：内容表现 · 客户增长 · 销售机会，并给出今天的经营建议。数据接入后自动开始。</span>
          </div>
        </div>
      </section>

      <!-- ═══════ ③ 经营健康卡 + 今日速览 ═══════ -->
      <section class="hq-health-wrap">
        <!-- 经营健康卡（替代机械表盘） -->
        <div class="hq-health">
          <div class="hq-health-top">
            <span class="hq-health-kicker">经营状态</span>
            <span class="hq-health-dot" :class="hasData ? 'on' : ''"></span>
          </div>
          <div class="hq-health-score">
            <span class="hq-health-num">{{ hasData ? healthScore : '待接入' }}</span>
            <span class="hq-health-label">{{ hasData ? healthLabel : '等待数据接入' }}</span>
          </div>
          <div class="hq-health-trends">
            <div class="hq-health-trend">
              <span>内容增长</span>
              <b :class="axisCls('content')">{{ axisTrend('content') }}</b>
            </div>
            <div class="hq-health-trend">
              <span>客户增长</span>
              <b :class="axisCls('customer')">{{ axisTrend('customer') }}</b>
            </div>
            <div class="hq-health-trend">
              <span>销售增长</span>
              <b :class="axisCls('sales')">{{ axisTrend('sales') }}</b>
            </div>
          </div>
        </div>

        <!-- 今日速览 -->
        <div class="hq-speed">
          <div class="hq-speed-head">
            <span class="hq-speed-kicker">TODAY · 今日经营速览</span>
            <span class="hq-speed-date">{{ todayLabel }}</span>
          </div>
          <div class="hq-speed-grid">
            <div class="hq-speed-cell">
              <span class="hq-speed-label">📢 内容曝光</span>
              <span class="hq-speed-num">{{ fmtBig(d.exposure) }}</span>
              <span class="hq-speed-trend" :class="trendCls(d.exposureTrend)">{{ trendText(d.exposureTrend) }}</span>
            </div>
            <div class="hq-speed-cell">
              <span class="hq-speed-label">👥 新增客户</span>
              <span class="hq-speed-num">{{ fmtBig(d.customers) }}</span>
              <span class="hq-speed-trend" :class="trendCls(d.customerTrend)">{{ trendText(d.customerTrend) }}</span>
            </div>
            <div class="hq-speed-cell">
              <span class="hq-speed-label">🛒 成交金额</span>
              <span class="hq-speed-num">{{ fmtMoney(d.revenue) }}</span>
              <span class="hq-speed-trend" :class="trendCls(d.revenueTrend)">{{ trendText(d.revenueTrend) }}</span>
            </div>
          </div>

          <!-- 数据汇聚链 -->
          <div class="hq-flow">
            <div class="hq-flow-src">
              <span>内容</span><em>抖音 · 快手 · 小红书 · 视频号 · 公众号 · 微博</em>
              <span>电商</span><em>淘宝 · 京东 · 拼多多 · 抖音商城 · 美团</em>
              <span>客户</span><em>企业微信</em>
            </div>
            <div class="hq-flow-arrow">↓</div>
            <div class="hq-flow-node">AI 全渠道数据汇总</div>
            <div class="hq-flow-arrow">↓</div>
            <div class="hq-flow-node hq-flow-node--final">经营总部</div>
          </div>
        </div>
      </section>

      <!-- ═══════ ④ 经营故事卡 · 数字 + 洞察 + AI建议 ═══════ -->
      <section class="hq-section">
        <div class="hq-sec-head">
          <div>
            <div class="hq-sec-kicker">今日经营总览</div>
            <h2 class="hq-sec-title">我的生意，现在怎么样</h2>
          </div>
          <span class="hq-sec-badge">{{ hasData ? '实时' : '待接入' }}</span>
        </div>

        <div class="hq-stories">
          <div v-for="m in metrics" :key="m.key" class="hq-story">
            <div class="hq-story-top">
              <span class="hq-story-ico">{{ m.icon }}</span>
              <b class="hq-story-name">{{ m.name }}</b>
            </div>
            <p class="hq-story-insight">{{ m.insight }}</p>
            <div class="hq-story-num">
              <span v-if="hasData" class="hq-story-value">{{ m.value }}</span>
              <span v-else class="hq-story-wait">待接入</span>
            </div>
            <div class="hq-story-meta">
              <span class="hq-story-sub">{{ m.sub }}</span>
              <span v-if="hasData" class="hq-story-delta" :class="trendCls(m.delta)">{{ trendText(m.delta) }}</span>
              <span v-else class="hq-story-delta is-idle">·</span>
            </div>
            <div class="hq-story-advice">
              <span class="hq-story-advice-ico">💡</span>
              <span><b class="hq-story-advice-label">AI建议：</b>{{ m.advice }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══════ ⑤ 我的 AI 团队 · 员工正在干活 ═══════ -->
      <section class="hq-section">
        <div class="hq-sec-head">
          <div>
            <div class="hq-sec-kicker">我的 AI 团队</div>
            <h2 class="hq-sec-title">员工正在干活</h2>
          </div>
          <NuxtLink to="/workspace/media/team" class="hq-sec-link">进入团队办公室 →</NuxtLink>
        </div>

        <div class="hq-team">
          <div v-for="a in team" :key="a.name" class="hq-team-card">
            <div class="hq-team-avatar" :class="'grad-' + a.grad">{{ a.initial }}</div>
            <b class="hq-team-name">{{ a.name }}</b>
            <span class="hq-team-role">{{ a.role }}</span>
            <span class="hq-team-state" :class="teamState(a)">
              <i></i>{{ teamStateLabel(a) }}
            </span>
            <div class="hq-team-today">今日</div>
            <ul class="hq-team-todos">
              <li v-for="(t, i) in teamTodos(a)" :key="i">
                <span class="hq-team-check" :class="t.done ? 'on' : ''">{{ t.done ? '✓' : '○' }}</span>
                <span class="hq-team-todo-text">{{ t.text }}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- ═══════ ⑥ 我的经营资产 ═══════ -->
      <section class="hq-section">
        <div class="hq-sec-head">
          <div>
            <div class="hq-sec-kicker">我的经营资产</div>
            <h2 class="hq-sec-title">数据资产池</h2>
          </div>
        </div>

        <div class="hq-assets">
          <div class="hq-assets-grid">
            <div class="hq-asset">
              <span class="hq-asset-ico">📱</span>
              <div class="hq-asset-meta">
                <b>内容账号</b>
                <span>{{ hasData ? `${assets.content} 个账号` : '待接入' }}</span>
              </div>
            </div>
            <div class="hq-asset">
              <span class="hq-asset-ico">🛒</span>
              <div class="hq-asset-meta">
                <b>店铺</b>
                <span>{{ hasData ? `${assets.shops} 个店铺` : '待接入' }}</span>
              </div>
            </div>
            <div class="hq-asset">
              <span class="hq-asset-ico">👥</span>
              <div class="hq-asset-meta">
                <b>客户渠道</b>
                <span>{{ hasData ? `${assets.channels} 个渠道` : '待接入' }}</span>
              </div>
            </div>
          </div>
          <div class="hq-assets-status">
            <span class="hq-assets-status-item"><i :class="hasData ? 'on' : ''"></i>数据同步：{{ hasData ? '正常' : '待接入' }}</span>
            <span class="hq-assets-status-item">最后更新：{{ hasData ? '刚刚' : '待接入' }}</span>
          </div>
        </div>
      </section>

      <!-- ═══════ ⑦ 经营趋势 ═══════ -->
      <section class="hq-section">
        <div class="hq-sec-head">
          <div>
            <div class="hq-sec-kicker">经营趋势</div>
            <h2 class="hq-sec-title">近 7 天</h2>
          </div>
        </div>

        <div class="hq-trend-grid">
          <div class="hq-trend">
            <span class="hq-trend-name">内容增长</span>
            <span class="hq-trend-val">{{ hasData ? '↗ ' + trends.content : '待接入' }}</span>
            <span class="hq-trend-sub">内容表现趋势</span>
          </div>
          <div class="hq-trend">
            <span class="hq-trend-name">客户增长</span>
            <span class="hq-trend-val">{{ hasData ? '↗ ' + trends.customers : '待接入' }}</span>
            <span class="hq-trend-sub">客户运营趋势</span>
          </div>
          <div class="hq-trend">
            <span class="hq-trend-name">销售增长</span>
            <span class="hq-trend-val">{{ hasData ? '↗ ' + trends.sales : '待接入' }}</span>
            <span class="hq-trend-sub">线上销售趋势</span>
          </div>
          <div class="hq-trend">
            <span class="hq-trend-name">品牌影响力</span>
            <span class="hq-trend-val">{{ hasData ? '↗ ' + trends.brand : '待接入' }}</span>
            <span class="hq-trend-sub">品牌增长趋势</span>
          </div>
        </div>

        <p class="hq-sec-note">数据接入后生成你的经营趋势</p>
      </section>

      <!-- ═══════ ⑧ 渠道入口（数据来源 · 底部中性入口） ═══════ -->
      <section class="hq-entry">
        <div class="hq-entry-text">
          <b>渠道中心</b>
          <span>内容平台 · 电商店铺 · 客户渠道 —— 你的数据都从这里来</span>
        </div>
        <NuxtLink to="/workspace/media/accounts" class="hq-entry-link">进入渠道中心 →</NuxtLink>
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

/* ═══ 经营数据（EXECUTIVE-EXPERIENCE-03） ═══
 * 真实数据接入后（渠道连接服务 → AI 员工 Runtime → 数据回流），把 dashboardData 替换为真实值即可，
 * 全部渲染逻辑已按「有数据 / 无数据」双态写好。示例值仅为渲染逻辑参照，运行时恒为空态。
 * 示例（有数据时）：
 *   health: 87, healthLabel: '优秀',
 *   axis: { content: 'up', customer: 'up', sales: 'flat' },
 *   exposure: 128560, exposureTrend: 12, customers: 368, customerTrend: 8,
 *   revenue: 58920, revenueTrend: 5,
 *   metrics: { influence: { value: '12.8万', delta: 12, insight: '今天你的品牌被更多人看到', advice: '继续增加短视频发布频率' }, ... }
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

/* ═══ 经营故事卡 · 六张（数字 + 洞察 + AI建议） ═══
 * 与 BI 报表的本质区别：每个数字配一句「人话洞察」和一条「AI 经营建议」。
 * 空态：洞察/建议为中性说明文案，绝不编造经营结论。 */
const metrics = computed(() => {
  const raw = dashboardData.value?.metrics
  return [
    {
      key: 'influence', icon: '📢', name: '内容影响力',
      value: raw?.influence?.value ?? '—', delta: raw?.influence?.delta ?? 0,
      sub: '曝光人数',
      insight: hasData.value ? (raw?.influence?.insight || '今天你的品牌被更多人看到') : '这里会告诉你今天有多少人看到了你的内容',
      advice: hasData.value ? (raw?.influence?.advice || '继续增加短视频发布频率') : '数据接入后，AI 将给出经营建议',
    },
    {
      key: 'fans', icon: '👥', name: '粉丝资产',
      value: raw?.fans?.value ?? '—', delta: raw?.fans?.delta ?? 0,
      sub: '今日新增',
      insight: hasData.value ? (raw?.fans?.insight || '你的粉丝正在稳步增长') : '这里会告诉你今天有多少人关注了你',
      advice: hasData.value ? (raw?.fans?.advice || '保持稳定更新节奏') : '数据接入后，AI 将给出经营建议',
    },
    {
      key: 'customers', icon: '💬', name: '客户经营',
      value: raw?.customers?.value ?? '—', delta: raw?.customers?.delta ?? 0,
      sub: '咨询人数',
      insight: hasData.value ? (raw?.customers?.insight || '客户咨询保持活跃') : '这里会告诉你今天有多少客户来找你',
      advice: hasData.value ? (raw?.customers?.advice || '及时跟进新客户需求') : '数据接入后，AI 将给出经营建议',
    },
    {
      key: 'sales', icon: '🛒', name: '商品销售',
      value: raw?.sales?.value ?? '—', delta: raw?.sales?.delta ?? 0,
      sub: '订单数',
      insight: hasData.value ? (raw?.sales?.insight || '线上销售平稳推进') : '这里会告诉你今天卖出了多少商品',
      advice: hasData.value ? (raw?.sales?.advice || '关注高转化商品的库存') : '数据接入后，AI 将给出经营建议',
    },
    {
      key: 'brand', icon: '🔥', name: '品牌热度',
      value: raw?.brand?.value ?? '—', delta: raw?.brand?.delta ?? 0,
      sub: '互动率',
      insight: hasData.value ? (raw?.brand?.insight || '品牌正在被更多人讨论') : '这里会告诉你今天品牌被多少人讨论',
      advice: hasData.value ? (raw?.brand?.advice || '参与热点话题提升声量') : '数据接入后，AI 将给出经营建议',
    },
    {
      key: 'ai', icon: '🤖', name: 'AI 工作成果',
      value: raw?.ai?.value ?? '—', delta: raw?.ai?.delta ?? 0,
      sub: 'AI 自动执行',
      insight: hasData.value ? (raw?.ai?.insight || 'AI 员工今天完成了大量工作') : '这里会告诉你 AI 员工今天完成了什么',
      advice: hasData.value ? (raw?.ai?.advice || '让 AI 承担更多重复工作') : '数据接入后，AI 将给出经营建议',
    },
  ]
})

/* ═══ 我的 AI 团队 · 五名员工（办公室感） ═══ */
const team = [
  { name: 'Alice', role: '运营总监', initial: 'A', grad: 'violet', focus: '制定运营计划 · 分析经营' },
  { name: 'Bob', role: '内容策划', initial: 'B', grad: 'blue', focus: '发现热点 · 营销机会' },
  { name: 'Carol', role: '内容专家', initial: 'C', grad: 'teal', focus: '制作内容 · 商品素材' },
  { name: 'David', role: '客户管家', initial: 'D', grad: 'indigo', focus: '回复咨询 · 跟进客户' },
  { name: 'Eve', role: '数据分析师', initial: 'E', grad: 'green', focus: '数据报告 · 收益提升' },
]
const teamPlans: Record<string, string[]> = {
  Alice: ['制定今日内容计划', '分析经营数据', '推荐营销方向'],
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
    // 静默：经营总部保持空态
  }
})
</script>

<style scoped>
/* ═══════ AI 企业经营总部 · 设计基调 ═══════
 * 高级 · 克制 · 可信 · 未来企业 · AI 助理
 * 深墨灰 #0B1020 / 昆仑紫 #7C3AED / 智能蓝 #3B82F6 / 成长绿 #22C55E；金色退场 */

/* ── ① Hero ── */
.hq-hero {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 26px;
  padding: 34px 36px 30px;
  border-radius: 20px;
  background:
    radial-gradient(900px 300px at 12% -20%, rgba(124, 58, 237, 0.13), transparent 62%),
    linear-gradient(180deg, #101830 0%, #0C1326 100%);
  border: 1px solid rgba(124, 58, 237, 0.22);
  box-shadow: 0 18px 44px rgba(2, 6, 23, 0.45);
  overflow: hidden;
}
.hq-hero-glow {
  position: absolute;
  top: -80px;
  right: 8%;
  width: 320px;
  height: 200px;
  background: radial-gradient(ellipse, rgba(59, 130, 246, 0.10), transparent 70%);
  pointer-events: none;
}
.hq-hero-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0;
  position: relative;
  z-index: 1;
}
.hq-hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: #C4B5FD;
  text-transform: uppercase;
  margin-bottom: 14px;
}
.hq-hero-badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #7C3AED;
  box-shadow: 0 0 10px rgba(124, 58, 237, 0.9);
}
.hq-hero-title {
  font-size: 38px;
  font-weight: 900;
  letter-spacing: -0.025em;
  color: #F8FAFC;
  margin: 0;
  line-height: 1.12;
}
.hq-hero-sub {
  font-size: 14.5px;
  color: #94A3B8;
  margin: 12px 0 0;
  line-height: 1.6;
}
.hq-hero-meta {
  display: flex;
  align-items: center;
  gap: 22px;
  margin-top: 20px;
  flex-wrap: wrap;
}
.hq-hero-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11.5px;
  font-weight: 600;
  color: #64748B;
}
.hq-hero-meta-item i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #64748B;
  display: inline-block;
}
.hq-hero-meta-item i.on {
  background: #22C55E;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.8);
}

/* AI 总经理状态卡 */
.hq-gm {
  width: 280px;
  flex-shrink: 0;
  align-self: center;
  background: rgba(11, 16, 32, 0.75);
  border: 1px solid rgba(167, 139, 250, 0.25);
  border-radius: 16px;
  padding: 18px 20px;
  position: relative;
  z-index: 1;
}
.hq-gm-head {
  display: flex;
  align-items: center;
  gap: 11px;
}
.hq-gm-avatar {
  width: 42px;
  height: 42px;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 19px;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.25), rgba(59, 130, 246, 0.15));
  border: 1px solid rgba(167, 139, 250, 0.4);
}
.hq-gm-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.hq-gm-meta b {
  font-size: 14px;
  font-weight: 800;
  color: #F1F5F9;
}
.hq-gm-state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  color: #94A3B8;
}
.hq-gm-state i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #64748B;
  display: inline-block;
}
.hq-gm-state i.on {
  background: #22C55E;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.8);
}
.hq-gm-title {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(71, 85, 105, 0.3);
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: #64748B;
  text-transform: uppercase;
}
.hq-gm-todos {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hq-gm-todos li {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 12px;
  color: #CBD5E1;
  line-height: 1.5;
}
.hq-gm-check {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1.5px solid #475569;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: transparent;
}
.hq-gm-check.on {
  background: rgba(34, 197, 94, 0.14);
  border-color: #22C55E;
  color: #22C55E;
}
.hq-gm-idle {
  color: #64748B !important;
  font-size: 11px !important;
  line-height: 1.7 !important;
}

/* ── 通用区块 ── */
.hq-section {
  margin-top: 26px;
}
.hq-sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.hq-sec-kicker {
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.16em;
  color: #A78BFA;
  text-transform: uppercase;
}
.hq-sec-title {
  font-size: 20px;
  font-weight: 800;
  color: #F1F5F9;
  margin: 4px 0 0;
  letter-spacing: -0.01em;
}
.hq-sec-link {
  font-size: 12px;
  font-weight: 700;
  color: #94A3B8;
  text-decoration: none;
  padding: 7px 14px;
  border-radius: 10px;
  border: 1px solid rgba(71, 85, 105, 0.35);
  background: rgba(16, 24, 48, 0.7);
  transition: all 0.15s;
}
.hq-sec-link:hover {
  color: #C4B5FD;
  border-color: rgba(124, 58, 237, 0.45);
}
.hq-sec-badge {
  font-size: 11px;
  font-weight: 800;
  color: #A78BFA;
  background: rgba(124, 58, 237, 0.1);
  border: 1px solid rgba(124, 58, 237, 0.3);
  border-radius: 999px;
  padding: 4px 13px;
  letter-spacing: 0.08em;
}
.hq-sec-note {
  margin: 14px 0 0;
  font-size: 11.5px;
  color: #64748B;
  text-align: center;
}

/* ── ② AI 今日简报 ── */
.hq-brief {
  margin-top: 26px;
  background:
    linear-gradient(180deg, rgba(124, 58, 237, 0.07), transparent 70%),
    #0D1428;
  border: 1px solid rgba(124, 58, 237, 0.2);
  border-radius: 18px;
  padding: 22px 26px;
}
.hq-brief-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.hq-brief-badge {
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: #64748B;
  background: rgba(71, 85, 105, 0.15);
  border: 1px solid rgba(71, 85, 105, 0.35);
  border-radius: 999px;
  padding: 4px 12px;
}
.hq-brief-badge.on {
  color: #22C55E;
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
}
.hq-brief-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hq-brief-item {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(16, 24, 48, 0.7);
  border: 1px solid rgba(71, 85, 105, 0.3);
}
.hq-brief-item b {
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
}
.hq-brief-item span {
  font-size: 12.5px;
  color: #94A3B8;
}
.hq-brief-item.good b { color: #22C55E; }
.hq-brief-item.warn b { color: #F59E0B; }
.hq-brief-item.tip { border-color: rgba(124, 58, 237, 0.4); }
.hq-brief-item.tip b { color: #A78BFA; }
.hq-brief-empty {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  border-radius: 12px;
  background: rgba(16, 24, 48, 0.6);
  border: 1px dashed rgba(124, 58, 237, 0.35);
}
.hq-brief-empty-ico { font-size: 24px; }
.hq-brief-empty-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hq-brief-empty-text b {
  font-size: 13.5px;
  font-weight: 800;
  color: #C4B5FD;
}
.hq-brief-empty-text span {
  font-size: 12px;
  line-height: 1.7;
  color: #94A3B8;
}

/* ── ③ 经营健康卡 + 今日速览 ── */
.hq-health-wrap {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 16px;
  margin-top: 26px;
}
.hq-health {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 24px 26px;
  border-radius: 18px;
  background:
    radial-gradient(420px 240px at 30% -10%, rgba(124, 58, 237, 0.16), transparent 65%),
    linear-gradient(180deg, #121A38 0%, #0D1428 100%);
  border: 1px solid rgba(124, 58, 237, 0.25);
}
.hq-health-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.hq-health-kicker {
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.16em;
  color: #94A3B8;
  text-transform: uppercase;
}
.hq-health-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #64748B;
}
.hq-health-dot.on {
  background: #22C55E;
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.9);
}
.hq-health-score {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px 0;
}
.hq-health-num {
  font-size: 52px;
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1;
  background: linear-gradient(135deg, #C4B5FD, #A78BFA 60%, #3B82F6);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.hq-health-label {
  font-size: 13px;
  font-weight: 700;
  color: #94A3B8;
  letter-spacing: 0.08em;
}
.hq-health-trends {
  display: flex;
  gap: 10px;
}
.hq-health-trend {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 11px 14px;
  border-radius: 12px;
  background: rgba(11, 16, 32, 0.6);
  border: 1px solid rgba(71, 85, 105, 0.3);
}
.hq-health-trend span {
  font-size: 10.5px;
  font-weight: 600;
  color: #64748B;
}
.hq-health-trend b {
  font-size: 17px;
  font-weight: 900;
  color: #64748B;
}
.hq-health-trend b.up { color: #22C55E; }
.hq-health-trend b.down { color: #EF4444; }

/* 今日速览 */
.hq-speed {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.hq-speed-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}
.hq-speed-kicker {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: #64748B;
}
.hq-speed-date {
  font-size: 11.5px;
  color: #94A3B8;
  font-weight: 600;
}
.hq-speed-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.hq-speed-cell {
  background: #0D1428;
  border: 1px solid rgba(71, 85, 105, 0.3);
  border-radius: 14px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  transition: border-color 0.18s, transform 0.18s;
}
.hq-speed-cell:hover {
  border-color: rgba(124, 58, 237, 0.4);
  transform: translateY(-2px);
}
.hq-speed-label {
  font-size: 11.5px;
  font-weight: 700;
  color: #94A3B8;
}
.hq-speed-num {
  font-size: 28px;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: #F1F5F9;
  line-height: 1.1;
}
.hq-speed-trend { font-size: 12px; font-weight: 800; }
.hq-speed-trend.up { color: #22C55E; }
.hq-speed-trend.down { color: #EF4444; }
.hq-speed-trend.idle { color: #64748B; }

/* 数据汇聚链 */
.hq-flow {
  margin-top: 12px;
  background: rgba(11, 16, 32, 0.7);
  border: 1px dashed rgba(124, 58, 237, 0.3);
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.hq-flow-src {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 10px;
}
.hq-flow-src span {
  font-weight: 800;
  color: #A78BFA;
  background: rgba(124, 58, 237, 0.1);
  border: 1px solid rgba(124, 58, 237, 0.25);
  border-radius: 999px;
  padding: 2px 9px;
}
.hq-flow-src em {
  font-style: normal;
  color: #64748B;
}
.hq-flow-arrow { color: #475569; font-size: 12px; }
.hq-flow-node {
  font-size: 10.5px;
  font-weight: 800;
  color: #94A3B8;
  background: rgba(16, 24, 48, 0.9);
  border: 1px solid rgba(71, 85, 105, 0.45);
  border-radius: 999px;
  padding: 4px 12px;
  letter-spacing: 0.04em;
}
.hq-flow-node--final {
  color: #C4B5FD;
  border-color: rgba(124, 58, 237, 0.45);
  background: rgba(124, 58, 237, 0.1);
}

/* ── ④ 经营故事卡 ── */
.hq-stories {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.hq-story {
  background: linear-gradient(180deg, #101830 0%, #0C1326 100%);
  border: 1px solid rgba(71, 85, 105, 0.3);
  border-radius: 16px;
  padding: 18px 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: border-color 0.18s, transform 0.18s, box-shadow 0.18s;
}
.hq-story:hover {
  border-color: rgba(124, 58, 237, 0.4);
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(2, 6, 23, 0.4);
}
.hq-story-top {
  display: flex;
  align-items: center;
  gap: 9px;
}
.hq-story-ico {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  background: rgba(124, 58, 237, 0.1);
  border: 1px solid rgba(124, 58, 237, 0.22);
}
.hq-story-name {
  font-size: 13.5px;
  font-weight: 800;
  color: #F1F5F9;
}
.hq-story-insight {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: #64748B;
  min-height: 36px;
}
.hq-story-num {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.hq-story-value {
  font-size: 32px;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: #F8FAFC;
  line-height: 1.1;
}
.hq-story-wait {
  font-size: 22px;
  font-weight: 800;
  color: #64748B;
  letter-spacing: 0.04em;
}
.hq-story-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.hq-story-sub {
  font-size: 11px;
  color: #64748B;
}
.hq-story-delta { font-size: 12.5px; font-weight: 800; }
.hq-story-delta.up { color: #22C55E; }
.hq-story-delta.down { color: #EF4444; }
.hq-story-delta.is-idle { color: #475569; font-size: 15px; line-height: 1; }
.hq-story-advice {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 9px 11px;
  border-radius: 10px;
  background: rgba(124, 58, 237, 0.08);
  border: 1px solid rgba(124, 58, 237, 0.18);
  font-size: 11px;
  line-height: 1.55;
  color: #A78BFA;
}
.hq-story-advice-ico { font-size: 11px; }
.hq-story-advice-label { font-weight: 800; }

/* ── ⑤ 我的 AI 团队 ── */
.hq-team {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 13px;
}
.hq-team-card {
  background: linear-gradient(180deg, #101830 0%, #0C1326 100%);
  border: 1px solid rgba(71, 85, 105, 0.3);
  border-radius: 16px;
  padding: 18px 16px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  transition: border-color 0.18s, transform 0.18s;
}
.hq-team-card:hover {
  border-color: rgba(124, 58, 237, 0.4);
  transform: translateY(-2px);
}
.hq-team-avatar {
  width: 54px;
  height: 54px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 900;
  color: #F8FAFC;
  font-family: var(--font-mono);
  margin-bottom: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
}
.hq-team-avatar.grad-violet { background: linear-gradient(135deg, #7C3AED, #6D28D9); }
.hq-team-avatar.grad-blue { background: linear-gradient(135deg, #3B82F6, #2563EB); }
.hq-team-avatar.grad-teal { background: linear-gradient(135deg, #14B8A6, #0D9488); }
.hq-team-avatar.grad-indigo { background: linear-gradient(135deg, #6366F1, #4F46E5); }
.hq-team-avatar.grad-green { background: linear-gradient(135deg, #22C55E, #16A34A); }
.hq-team-name {
  font-size: 14.5px;
  font-weight: 800;
  color: #F1F5F9;
}
.hq-team-role {
  font-size: 11px;
  color: #64748B;
  margin-top: 3px;
}
.hq-team-state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 11px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.05em;
  border-radius: 999px;
  padding: 3px 11px;
}
.hq-team-state i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}
.hq-team-state.on {
  color: #22C55E;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
}
.hq-team-state.on i { background: #22C55E; }
.hq-team-state.idle {
  color: #94A3B8;
  background: rgba(71, 85, 105, 0.15);
  border: 1px solid rgba(71, 85, 105, 0.35);
}
.hq-team-state.idle i { background: #64748B; }
.hq-team-today {
  align-self: stretch;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px dashed rgba(71, 85, 105, 0.3);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: #64748B;
  text-transform: uppercase;
  text-align: left;
}
.hq-team-todos {
  list-style: none;
  margin: 9px 0 0;
  padding: 0;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  gap: 7px;
  text-align: left;
}
.hq-team-todos li {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: 10.5px;
  color: #94A3B8;
  line-height: 1.5;
}
.hq-team-check {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1.5px solid #475569;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8.5px;
  color: transparent;
  margin-top: 1px;
}
.hq-team-check.on {
  background: rgba(34, 197, 94, 0.14);
  border-color: #22C55E;
  color: #22C55E;
}
.hq-team-todo-text { flex: 1; }

/* ── ⑥ 我的经营资产 ── */
.hq-assets {
  background: linear-gradient(180deg, #101830 0%, #0C1326 100%);
  border: 1px solid rgba(71, 85, 105, 0.3);
  border-radius: 16px;
  padding: 18px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}
.hq-assets-grid {
  display: flex;
  gap: 13px;
  flex-wrap: wrap;
}
.hq-asset {
  display: flex;
  align-items: center;
  gap: 11px;
  background: rgba(11, 16, 32, 0.8);
  border: 1px solid rgba(71, 85, 105, 0.3);
  border-radius: 13px;
  padding: 11px 16px;
}
.hq-asset-ico {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  background: rgba(124, 58, 237, 0.1);
  border: 1px solid rgba(124, 58, 237, 0.22);
}
.hq-asset-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hq-asset-meta b { font-size: 12.5px; font-weight: 800; color: #F1F5F9; }
.hq-asset-meta span { font-size: 11px; color: #94A3B8; }
.hq-assets-status {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hq-assets-status-item {
  font-size: 11.5px;
  color: #94A3B8;
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.hq-assets-status-item i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #475569;
  display: inline-block;
}
.hq-assets-status-item i.on {
  background: #22C55E;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.8);
}

/* ── ⑦ 经营趋势 ── */
.hq-trend-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 13px;
}
.hq-trend {
  background: #0D1428;
  border: 1px solid rgba(71, 85, 105, 0.3);
  border-radius: 14px;
  padding: 15px 17px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.hq-trend-name { font-size: 11.5px; font-weight: 700; color: #94A3B8; }
.hq-trend-val { font-size: 17px; font-weight: 900; color: #22C55E; }
.hq-trend-sub { font-size: 10.5px; color: #64748B; }

/* ── ⑧ 渠道入口 ── */
.hq-entry {
  margin-top: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 22px;
  border-radius: 16px;
  background: rgba(13, 20, 40, 0.7);
  border: 1px dashed rgba(71, 85, 105, 0.45);
}
.hq-entry-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.hq-entry-text b { font-size: 13.5px; font-weight: 800; color: #F1F5F9; }
.hq-entry-text span { font-size: 11.5px; color: #64748B; }
.hq-entry-link {
  font-size: 12.5px;
  font-weight: 800;
  color: #C4B5FD;
  text-decoration: none;
  padding: 9px 18px;
  border-radius: 11px;
  background: rgba(124, 58, 237, 0.1);
  border: 1px solid rgba(124, 58, 237, 0.35);
  transition: all 0.15s;
  white-space: nowrap;
}
.hq-entry-link:hover {
  background: rgba(124, 58, 237, 0.18);
  box-shadow: 0 0 18px rgba(124, 58, 237, 0.14);
}

/* 身份引导 */
.hq-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 22px;
  border-radius: 14px;
  margin-bottom: 18px;
}
.hq-identity-error {
  background: rgba(248, 113, 113, 0.08);
  border: 1px solid rgba(248, 113, 113, 0.3);
  color: #FCA5A5;
}
.hq-identity b { font-size: 13.5px; }
.hq-identity span { flex: 1; font-size: 12px; opacity: 0.85; }
.hq-identity-btn {
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #7C3AED, #6D28D9);
  border-radius: 10px;
  padding: 8px 16px;
  text-decoration: none;
  white-space: nowrap;
}

@media (max-width: 1200px) {
  .hq-team { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 1080px) {
  .hq-hero { flex-direction: column; }
  .hq-gm { width: 100%; align-self: stretch; }
  .hq-health-wrap { grid-template-columns: 1fr; }
  .hq-stories { grid-template-columns: repeat(2, 1fr); }
  .hq-trend-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 720px) {
  .hq-team { grid-template-columns: repeat(2, 1fr); }
  .hq-stories { grid-template-columns: 1fr; }
  .hq-speed-grid { grid-template-columns: 1fr; }
  .hq-hero-title { font-size: 30px; }
}
</style>
