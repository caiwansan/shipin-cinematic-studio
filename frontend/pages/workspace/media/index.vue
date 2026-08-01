<!--
  Sprint-MEDIA-DATA-CENTER-01 — 首页 = 企业经营数据中心（老板每天看的经营驾驶舱）
  掌柜指令：把「AI 工具展示页」升级为「AI 经营驾驶舱」
  老板视角信息架构：经营数据中心 → 今日经营概览 → 全渠道数据地图 → 我的 AI 运营团队 → 经营趋势
  纪律：零新 API / 零新表 / 不造数据 / 不改后端；未连接一律「等待连接」，绝不显示 0
  风格：企业管理软件 / 高端 SaaS BI；清晰 · 稳重 · 高级 · 可信 · 数据驱动
-->
<template>
  <MediaWorkspaceShell>
    <!-- 身份引导（login-expired / personal-space） -->
    <div v-if="identityState === 'login-expired'" class="dash-identity dash-identity-error">
      <b>⚠️ 登录已过期</b>
      <span>你的会话已失效，请重新登录后继续使用。</span>
      <NuxtLink to="/?showLogin=1" class="dash-identity-btn">重新登录 →</NuxtLink>
    </div>
    <div v-else-if="identityState === 'personal-space'" class="dash-identity dash-identity-ok">
      <b>✅ 个人空间已就绪</b>
      <span>这里是你个人的 AI 全渠道运营中心。连接内容平台、电商店铺和客户渠道，解锁 AI 员工后，你的 AI 运营团队将开始自动工作。</span>
      <NuxtLink to="/workspace/media/accounts" class="dash-identity-btn">连接你的运营渠道 →</NuxtLink>
    </div>

    <!-- ═══════ 顶部定位 · 我是谁 ═══════ -->
    <section class="dash-hero">
      <div class="dash-hero-inner">
        <h1 class="dash-title">AI 全渠道运营中心</h1>
        <p class="dash-mission">让 AI 员工帮你运营内容、客户和线上生意</p>
        <div class="dash-cta">
          <NuxtLink to="/workspace/media/accounts" class="dash-btn dash-btn-primary">
            连接你的运营渠道 <span class="dash-btn-arrow">→</span>
          </NuxtLink>
          <NuxtLink to="/workspace/media/team" class="dash-btn dash-btn-ghost">
            查看我的 AI 员工 <span class="dash-btn-arrow">→</span>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- ═══════ 经营数据中心 · 数据在哪里 ═══════ -->
    <section class="dash-datahub">
      <div class="dash-datahub-ico">📊</div>
      <div class="dash-datahub-text">
        <b>经营数据中心</b>
        <span>连接你的内容平台、电商店铺和客户渠道后，所有运营数据将在这里统一展示</span>
      </div>
      <NuxtLink to="/workspace/media/accounts" class="dash-datahub-link">去连接渠道 →</NuxtLink>
    </section>

    <!-- ═══════ 第一核心 · 今日经营概览 ═══════ -->
    <section class="dash-section">
      <div class="dash-sec-head">
        <div>
          <div class="dash-sec-kicker">今日经营概览</div>
          <h2 class="dash-sec-title">你的生意数据，连接渠道后自动统计</h2>
        </div>
        <NuxtLink to="/workspace/media/accounts" class="dash-sec-link">渠道中心 →</NuxtLink>
      </div>

      <div class="dash-kpi-grid">
        <!-- 内容表现 -->
        <div class="dash-kpi">
          <div class="dash-kpi-top">
            <span class="dash-kpi-ico">📝</span>
            <b class="dash-kpi-name">内容表现</b>
          </div>
          <div class="dash-kpi-core">
            <span class="dash-kpi-label">今日发布</span>
            <span class="dash-kpi-wait">等待连接</span>
          </div>
          <div class="dash-kpi-minis">
            <span>阅读/播放 <em>等待连接</em></span>
            <span>点赞互动 <em>等待连接</em></span>
            <span>分享传播 <em>等待连接</em></span>
          </div>
          <div class="dash-kpi-foot">
            <span>连接抖音、小红书等账号后自动统计</span>
            <NuxtLink to="/workspace/media/accounts" class="dash-kpi-act">去连接 →</NuxtLink>
          </div>
        </div>

        <!-- 客户运营 -->
        <div class="dash-kpi">
          <div class="dash-kpi-top">
            <span class="dash-kpi-ico">💬</span>
            <b class="dash-kpi-name">客户运营</b>
          </div>
          <div class="dash-kpi-core">
            <span class="dash-kpi-label">新增客户</span>
            <span class="dash-kpi-wait">等待连接</span>
          </div>
          <div class="dash-kpi-minis">
            <span>客户咨询 <em>等待连接</em></span>
            <span>有效线索 <em>等待连接</em></span>
            <span>成交机会 <em>等待连接</em></span>
          </div>
          <div class="dash-kpi-foot">
            <span>连接企业微信、客服渠道后自动统计</span>
            <NuxtLink to="/workspace/media/accounts" class="dash-kpi-act">去连接 →</NuxtLink>
          </div>
        </div>

        <!-- 线上销售 -->
        <div class="dash-kpi">
          <div class="dash-kpi-top">
            <span class="dash-kpi-ico">🛒</span>
            <b class="dash-kpi-name">线上销售</b>
          </div>
          <div class="dash-kpi-core">
            <span class="dash-kpi-label">订单数量</span>
            <span class="dash-kpi-wait">等待连接</span>
          </div>
          <div class="dash-kpi-minis">
            <span>成交金额 <em>等待连接</em></span>
            <span>商品销量 <em>等待连接</em></span>
            <span>客户转化 <em>等待连接</em></span>
          </div>
          <div class="dash-kpi-foot">
            <span>连接淘宝、京东、拼多多等店铺后自动统计</span>
            <NuxtLink to="/workspace/media/accounts" class="dash-kpi-act">去连接 →</NuxtLink>
          </div>
        </div>

        <!-- 品牌增长 -->
        <div class="dash-kpi">
          <div class="dash-kpi-top">
            <span class="dash-kpi-ico">📈</span>
            <b class="dash-kpi-name">品牌增长</b>
          </div>
          <div class="dash-kpi-core">
            <span class="dash-kpi-label">粉丝总量</span>
            <span class="dash-kpi-wait">等待连接</span>
          </div>
          <div class="dash-kpi-minis">
            <span>今日增长 <em>等待连接</em></span>
            <span>访问人数 <em>等待连接</em></span>
            <span>用户画像 <em>等待连接</em></span>
          </div>
          <div class="dash-kpi-foot">
            <span>连接内容平台与数据渠道后自动统计</span>
            <NuxtLink to="/workspace/media/accounts" class="dash-kpi-act">去连接 →</NuxtLink>
          </div>
        </div>
      </div>

      <p class="dash-sec-note">
        <b>等待连接渠道</b> —— 连接抖音、小红书、淘宝等账号后自动统计你的真实经营数据
      </p>
    </section>

    <!-- ═══════ 第二核心 · 全渠道数据地图 ═══════ -->
    <section class="dash-section">
      <div class="dash-sec-head">
        <div>
          <div class="dash-sec-kicker">全渠道数据地图</div>
          <h2 class="dash-sec-title">我的运营渠道</h2>
        </div>
        <NuxtLink to="/workspace/media/accounts" class="dash-sec-link">渠道中心 →</NuxtLink>
      </div>

      <!-- 内容渠道 -->
      <div class="dash-cat">
        <div class="dash-cat-head">
          <span class="dash-cat-ico">📱</span>
          <div class="dash-cat-meta">
            <b>内容渠道</b>
            <span>品牌曝光 · 内容发布</span>
          </div>
          <span class="dash-cat-count">{{ contentPlatforms.length }} 个平台 · 未连接</span>
        </div>
        <div class="dash-channel-grid">
          <div v-for="ch in contentPlatforms" :key="ch.name" class="dash-channel" @click="onChannelClick(ch)">
            <span class="dash-channel-ico">{{ ch.icon }}</span>
            <div class="dash-channel-meta">
              <span class="dash-channel-name">{{ ch.name }}</span>
              <span class="dash-channel-plan">{{ ch.plan }}</span>
            </div>
            <span class="dash-channel-state">
              <span class="dash-channel-dot off"></span>
              未连接
            </span>
          </div>
        </div>
      </div>

      <!-- 电商渠道 -->
      <div class="dash-cat">
        <div class="dash-cat-head">
          <span class="dash-cat-ico">🛒</span>
          <div class="dash-cat-meta">
            <b>电商渠道</b>
            <span>商品销售 · 店铺运营</span>
          </div>
          <span class="dash-cat-count">{{ shopPlatforms.length }} 个平台 · 未连接</span>
        </div>
        <div class="dash-channel-grid">
          <div v-for="ch in shopPlatforms" :key="ch.name" class="dash-channel" @click="onChannelClick(ch)">
            <span class="dash-channel-ico">{{ ch.icon }}</span>
            <div class="dash-channel-meta">
              <span class="dash-channel-name">{{ ch.name }}</span>
              <span class="dash-channel-plan">{{ ch.plan }}</span>
            </div>
            <span class="dash-channel-state">
              <span class="dash-channel-dot off"></span>
              未连接
            </span>
          </div>
        </div>
        <div class="dash-cat-foot">
          <NuxtLink to="/workspace/media/shop" class="dash-cat-link">查看商品运营 →</NuxtLink>
        </div>
      </div>

      <!-- 客户渠道 -->
      <div class="dash-cat">
        <div class="dash-cat-head">
          <span class="dash-cat-ico">💬</span>
          <div class="dash-cat-meta">
            <b>客户渠道</b>
            <span>客户沟通 · 私域维护</span>
          </div>
          <span class="dash-cat-count">{{ customerPlatforms.length }} 个渠道 · 未连接</span>
        </div>
        <div class="dash-channel-grid">
          <div v-for="ch in customerPlatforms" :key="ch.name" class="dash-channel" @click="onChannelClick(ch)">
            <span class="dash-channel-ico">{{ ch.icon }}</span>
            <div class="dash-channel-meta">
              <span class="dash-channel-name">{{ ch.name }}</span>
              <span class="dash-channel-plan">{{ ch.plan }}</span>
            </div>
            <span class="dash-channel-state">
              <span class="dash-channel-dot off"></span>
              未连接
            </span>
          </div>
        </div>
      </div>

      <p class="dash-sec-note">点击任意渠道进入渠道中心。真实接入按：用户授权 → 渠道连接服务 → AI 员工 Runtime 推进，当前全部渠道均未连接。</p>
    </section>

    <!-- ═══════ 第三核心 · 我的 AI 运营团队 ═══════ -->
    <section class="dash-section">
      <div class="dash-sec-head">
        <div>
          <div class="dash-sec-kicker">我的 AI 运营团队</div>
          <h2 class="dash-sec-title">5 名 AI 员工，帮你把生意做起来</h2>
        </div>
        <NuxtLink to="/workspace/media/team" class="dash-sec-link">查看全部 →</NuxtLink>
      </div>

      <div class="dash-team-grid">
        <div
          v-for="(m, i) in teamRoster"
          :key="m.name"
          class="dash-team-card"
          :class="{ 'is-locked': !deployedNames.includes(m.name) }"
        >
          <div class="dash-team-head">
            <span class="dash-avatar">{{ m.avatar }}</span>
            <div class="dash-team-meta">
              <div class="dash-team-name">{{ m.name }}</div>
              <div class="dash-team-role">{{ m.role }}</div>
            </div>
            <span class="dash-status" :class="deployedNames.includes(m.name) ? 'on' : 'off'">
              <span class="dash-status-dot"></span>
              {{ deployedNames.includes(m.name) ? '运行中' : '未解锁' }}
            </span>
          </div>
          <p class="dash-team-duty">帮你{{ m.duty }}</p>
          <div class="dash-team-foot">
            <button v-if="!deployedNames.includes(m.name)" class="dash-unlock" @click="showSubscribe = true">
              解锁这个员工
            </button>
            <NuxtLink v-else to="/workspace/media/team" class="dash-view">查看工作台 →</NuxtLink>
          </div>
        </div>
      </div>

      <!-- AI 已为你完成（真实成果数据，无数据不显示 0） -->
      <div class="dash-done">
        <div class="dash-done-head">
          <b>AI 已为你完成</b>
          <span>解锁员工并连接渠道后，成果自动汇总在这里</span>
        </div>
        <div class="dash-done-grid">
          <div class="dash-done-card">
            <div class="dash-done-meta">
              <span class="dash-done-label">今日内容</span>
              <span class="dash-done-num">{{ fmtCount(contentOutcomes) }}</span>
            </div>
            <span class="dash-done-sub">AI 生产的图文与视频</span>
          </div>
          <div class="dash-done-card">
            <div class="dash-done-meta">
              <span class="dash-done-label">客户咨询</span>
              <span class="dash-done-num">{{ fmtCount(customerOutcomes) }}</span>
            </div>
            <span class="dash-done-sub">AI 客服接待与跟进</span>
          </div>
          <div class="dash-done-card">
            <div class="dash-done-meta">
              <span class="dash-done-label">粉丝互动</span>
              <span class="dash-done-num">{{ fmtCount(fanInteractions) }}</span>
            </div>
            <span class="dash-done-sub">连接账号后自动统计</span>
          </div>
          <div class="dash-done-card">
            <div class="dash-done-meta">
              <span class="dash-done-label">数据报告</span>
              <span class="dash-done-num dash-done-num--text">{{ reportText }}</span>
            </div>
            <span class="dash-done-sub">运营效果与增长建议</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════ 第四核心 · 经营趋势 ═══════ -->
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
          <span class="dash-trend-val">↗ 等待连接</span>
          <span class="dash-trend-sub">内容表现趋势</span>
        </div>
        <div class="dash-trend">
          <span class="dash-trend-name">客户增长</span>
          <span class="dash-trend-val">↗ 等待连接</span>
          <span class="dash-trend-sub">客户运营趋势</span>
        </div>
        <div class="dash-trend">
          <span class="dash-trend-name">销售增长</span>
          <span class="dash-trend-val">↗ 等待连接</span>
          <span class="dash-trend-sub">线上销售趋势</span>
        </div>
        <div class="dash-trend">
          <span class="dash-trend-name">品牌影响力</span>
          <span class="dash-trend-val">↗ 等待连接</span>
          <span class="dash-trend-sub">品牌增长趋势</span>
        </div>
      </div>

      <p class="dash-sec-note">连接渠道后生成你的经营趋势</p>
    </section>

    <!-- ═══ 解锁 AI 员工团队弹窗（纯产品语言） ═══ -->
    <Teleport to="body">
      <div v-if="showSubscribe" class="sub-modal-mask" @click.self="showSubscribe = false">
        <div class="sub-modal">
          <div class="sub-modal-head">
            <div>
              <div class="sub-modal-title">🤖 解锁 AI 员工团队</div>
              <div class="sub-modal-sub">一份订阅 · 5 名 AI 员工 · 解锁后自动工作</div>
            </div>
            <button class="sub-modal-close" @click="showSubscribe = false">✕</button>
          </div>
          <div class="sub-modal-list">
            <div v-for="m in teamRoster" :key="m.name" class="sub-modal-row">
              <span class="sub-modal-avatar">{{ m.avatar }}</span>
              <div class="sub-modal-meta">
                <div class="sub-modal-name">{{ m.name }} · {{ m.role }}</div>
                <div class="sub-modal-duty">帮你：{{ m.helps.join('、') }}</div>
                <div class="sub-modal-auto">⚙️ 解锁后自动工作：{{ m.auto }}</div>
              </div>
            </div>
          </div>
          <div class="sub-modal-foot">
            <div class="sub-modal-note">解锁后：自动部署 AI 员工 → 连接你的运营渠道 → 开始自动运营 → 成果汇总到 AI 已为你完成</div>
            <div class="sub-modal-actions">
              <NuxtLink to="/workspace/media/accounts" class="sub-modal-secondary" @click="showSubscribe = false">先去连接账号 →</NuxtLink>
              <button class="sub-modal-primary" @click="showSubscribe = false">知道了</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
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

const { $toast } = useNuxtApp() as any

const agents = computed(() => overview.value.agents || [])
const usage = computed(() => overview.value.usage || {})
const recentOutcomes = computed(() => overview.value.recentOutcomes || [])

const deployedNames = computed(() => agents.value.map((a: any) => a.name).filter(Boolean))

const contentOutcomes = computed(() => recentOutcomes.value.filter((o: any) => /CONTENT|PUBLISH|CREATE/i.test(o.outcomeType || '')).length)
const customerOutcomes = computed(() => recentOutcomes.value.filter((o: any) => /CUSTOMER|CLIENT|LEAD/i.test(o.outcomeType || '')).length)
const fanInteractions = computed(() => 0) // 无渠道数据源：诚实空，连接账号后回流
const reportText = computed(() => {
  if (usage.value.executions > 0 || recentOutcomes.value.length > 0) {
    return `${usage.value.executions || 0} 次执行`
  }
  return '等待连接渠道'
})

// 不显示 0：真实数据为 0 时显示「等待连接」（老板视角：0 = 无价值，等待连接 = 待接入）
function fmtCount(n: number) {
  return n > 0 ? String(n) : '等待连接'
}

// 运营渠道（产品蓝图；全部未连接——真实接入按：用户授权 → 渠道连接服务 → AI 员工 Runtime）
const contentPlatforms = [
  { icon: '📱', name: '抖音', plan: '短视频 · 直播' },
  { icon: '📱', name: '快手', plan: '短视频 · 直播' },
  { icon: '📕', name: '小红书', plan: '种草图文 · 视频' },
  { icon: '🎬', name: '视频号', plan: '微信生态分发' },
  { icon: '💬', name: '微信公众号', plan: '图文 · 菜单服务' },
  { icon: '🌐', name: '微博', plan: '话题 · 图文' },
  { icon: '📰', name: '百家号', plan: '图文 · 视频' },
  { icon: '📰', name: '今日头条', plan: '图文 · 视频' },
]
const shopPlatforms = [
  { icon: '🛒', name: '淘宝店', plan: '商品销售 · 店铺运营' },
  { icon: '🛒', name: '京东店', plan: '商品销售 · 店铺运营' },
  { icon: '🛒', name: '拼多多店', plan: '商品销售 · 店铺运营' },
  { icon: '🛒', name: '抖音商城', plan: '短视频电商 · 直播带货' },
  { icon: '🛒', name: '美团店铺', plan: '本地生活 · 门店运营' },
  { icon: '🛒', name: '小红书店铺', plan: '种草转化 · 商品销售' },
]
const customerPlatforms = [
  { icon: '🏢', name: '企业微信', plan: '私域客户运营' },
  { icon: '💬', name: '微信客户', plan: '客户沟通 · 跟进' },
  { icon: '📞', name: '客服渠道', plan: '咨询接待 · 售后' },
]

function onChannelClick(ch: any) {
  if (ch.name === '微信公众号') {
    window.location.href = '/workspace/media/accounts'
  } else {
    $toast?.info?.(`「${ch.name}」接入即将开放，先连接微信公众号体验完整流程`)
  }
}

// 5 名 AI 员工（老板视角一句话：帮你做什么）
const teamRoster = [
  { name: 'Alice', role: 'AI 运营总监', avatar: '👩‍💼', duty: '制定运营计划、分析每天经营情况', helps: ['制定内容计划', '规划营销活动', '管理运营节奏'], auto: '统筹内容计划与营销节奏，指挥团队执行' },
  { name: 'Bob', role: 'AI 内容策划', avatar: '🧑‍💻', duty: '发现热点和营销机会', helps: ['发现热点', '策划商品推广内容', '生成营销主题'], auto: '每天发现热点，选题与营销主题自动排满内容日历' },
  { name: 'Carol', role: 'AI 内容制作', avatar: '👩‍🎨', duty: '制作内容和商品素材', helps: ['制作图片', '制作视频', '制作商品宣传素材'], auto: '按选题自动制作图片、视频与商品素材，交人工审核' },
  { name: 'David', role: 'AI 客户管家', avatar: '🧑‍💼', duty: '维护客户关系', helps: ['回复客户咨询', '维护客户关系', '发现购买机会'], auto: '自动回复客户消息，维护客户关系并发现购买机会提醒你跟进' },
  { name: 'Eve', role: 'AI 数据分析师', avatar: '👩‍🔬', duty: '分析数据提升收益', helps: ['分析内容效果', '分析商品销售', '优化运营策略'], auto: '每天分析内容与销售数据，自动产出报告与运营策略建议' },
]

const showSubscribe = ref(false)
const identityState = ref('') // '' | 'login-expired' | 'personal-space'

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
    } else {
      $toast?.error?.(data?.message || '加载失败')
    }
  } catch {
    $toast?.error?.('加载失败（网络异常）')
  }
})
</script>

<style scoped>
/* ═══ 顶部定位 · 稳重商务面板（收敛 AI 氛围：无大渐变、无光斑、无玻璃） ═══ */
.dash-hero {
  position: relative;
  padding: 34px 36px 32px;
  border-radius: var(--media-radius-card);
  background: var(--media-card-bg-solid);
  border: 1px solid var(--media-card-border);
  border-left: 4px solid #6366f1;
  box-shadow: var(--media-shadow-card);
  margin-bottom: 18px;
  overflow: hidden;
}
.dash-hero-inner { position: relative; z-index: 1; max-width: 780px; }
.dash-title {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.015em;
  color: var(--media-text-hero);
  margin: 0 0 8px;
}
.dash-mission {
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--media-text-body);
  margin: 0 0 20px;
}
.dash-cta { display: flex; gap: 12px; flex-wrap: wrap; }
.dash-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 13px; font-weight: 700;
  text-decoration: none;
  transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
}
.dash-btn:hover { transform: translateY(-1px); }
.dash-btn-primary {
  color: #fff;
  background: linear-gradient(135deg, #7c5cf0, #6366f1 60%, #4f7cf0);
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.3);
}
.dash-btn-ghost {
  color: var(--media-text-body);
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid var(--media-card-border);
}
.dash-btn-ghost:hover { color: var(--media-text-hero); border-color: var(--media-ai-border); }
.dash-btn-arrow { font-size: 13px; }

/* ═══ 经营数据中心 · 数据在哪里（浅色高亮条，老板 5 秒定位） ═══ */
.dash-datahub {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  border-radius: var(--media-radius-panel);
  background: linear-gradient(135deg, #eef2ff, #f8fafc);
  border: 1px solid #c7d2fe;
  margin-bottom: 30px;
}
.dash-datahub-ico {
  width: 40px; height: 40px;
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 19px;
  border-radius: 11px;
  background: #fff;
  border: 1px solid #c7d2fe;
}
.dash-datahub-text { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.dash-datahub-text b { font-size: 14.5px; font-weight: 800; color: #1e293b; }
.dash-datahub-text span { font-size: 12px; color: #475569; line-height: 1.5; }
.dash-datahub-link {
  font-size: 12px; font-weight: 700; color: #4f46e5;
  text-decoration: none; white-space: nowrap;
}
.dash-datahub-link:hover { text-decoration: underline; }

/* ═══ 区块通用 ═══ */
.dash-section { margin-bottom: 34px; }
.dash-sec-head {
  display: flex; align-items: flex-end; justify-content: space-between;
  margin-bottom: 14px;
}
.dash-sec-kicker {
  font-size: 10.5px; font-weight: 800; letter-spacing: 0.08em;
  color: #818cf8; margin-bottom: 4px;
}
.dash-sec-title { font-size: 18px; font-weight: 800; color: var(--media-text-title); margin: 0; letter-spacing: -0.01em; }
.dash-sec-link {
  font-size: 11.5px; font-weight: 600; color: var(--media-text-body);
  text-decoration: none; transition: color 0.15s;
}
.dash-sec-link:hover { color: #a5b4fc; }
.dash-sec-note { margin: 12px 2px 0; font-size: 11px; color: var(--media-text-dim); line-height: 1.7; }
.dash-sec-note b { color: #fbbf24; font-weight: 700; }

/* ═══ 今日经营概览 · KPI 卡（标题 + 一个核心 + 一句解释 + 一个动作） ═══ */
.dash-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.dash-kpi {
  display: flex; flex-direction: column;
  padding: 16px 18px 14px;
  border-radius: var(--media-radius-card);
  background: var(--media-card-bg-solid);
  border: 1px solid var(--media-card-border);
  box-shadow: var(--media-shadow-card);
}
.dash-kpi-top { display: flex; align-items: center; gap: 9px; margin-bottom: 14px; }
.dash-kpi-ico {
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
  border-radius: 9px;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.25);
}
.dash-kpi-name { font-size: 13px; font-weight: 800; color: var(--media-text-title); }
.dash-kpi-core {
  display: flex; flex-direction: column; gap: 3px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(71, 85, 105, 0.2);
  margin-bottom: 10px;
}
.dash-kpi-label { font-size: 11px; color: var(--media-text-body); }
.dash-kpi-wait {
  align-self: flex-start;
  font-size: 15px; font-weight: 800;
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.28);
  border-radius: 8px;
  padding: 3px 10px;
  margin-top: 2px;
}
.dash-kpi-minis { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.dash-kpi-minis span {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 10.5px; color: var(--media-text-dim);
}
.dash-kpi-minis em {
  font-style: normal; font-size: 10.5px; font-weight: 700; color: var(--media-text-body);
}
.dash-kpi-foot {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 12px; padding-top: 10px;
  border-top: 1px solid rgba(71, 85, 105, 0.18);
  gap: 8px;
}
.dash-kpi-foot span { font-size: 9.5px; color: var(--media-text-dim); line-height: 1.5; }
.dash-kpi-act {
  font-size: 10.5px; font-weight: 700; color: #a5b4fc;
  text-decoration: none; white-space: nowrap;
}
.dash-kpi-act:hover { color: #c7d2fe; }

/* ═══ 全渠道数据地图 ═══ */
.dash-cat { margin-bottom: 22px; }
.dash-cat:last-child { margin-bottom: 0; }
.dash-cat-head {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 10px; padding: 0 2px;
}
.dash-cat-ico {
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
  border-radius: 9px;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.25);
}
.dash-cat-meta { display: flex; flex-direction: column; flex: 1; }
.dash-cat-meta b { font-size: 12.5px; font-weight: 800; color: var(--media-text-title); }
.dash-cat-meta span { font-size: 10px; color: var(--media-text-dim); margin-top: 1px; }
.dash-cat-count {
  font-size: 9.5px; font-weight: 700;
  color: var(--media-text-dim);
  background: rgba(71, 85, 105, 0.14);
  border: 1px solid rgba(71, 85, 105, 0.28);
  border-radius: 999px;
  padding: 2px 10px;
}
.dash-channel-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.dash-channel {
  display: flex; align-items: center; gap: 11px;
  padding: 13px 15px;
  border-radius: var(--media-radius-node);
  background: var(--media-card-bg-solid);
  border: 1px solid var(--media-card-border);
  cursor: pointer;
  transition: border-color 0.18s, transform 0.15s;
}
.dash-channel:hover { transform: translateY(-2px); border-color: rgba(129, 140, 248, 0.4); }
.dash-channel-ico { font-size: 18px; }
.dash-channel-meta { display: flex; flex-direction: column; flex: 1; }
.dash-channel-name { font-size: 12.5px; font-weight: 700; color: var(--media-text-title); }
.dash-channel-plan { font-size: 9.5px; color: var(--media-text-dim); }
.dash-channel-state {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 9.5px; font-weight: 700; color: var(--media-text-dim);
}
.dash-channel-dot { width: 6px; height: 6px; border-radius: 50%; background: #475569; }
.dash-cat-foot {
  display: flex; justify-content: flex-end;
  margin-top: 8px;
}
.dash-cat-link {
  font-size: 11px; font-weight: 700; color: #a5b4fc;
  text-decoration: none;
}
.dash-cat-link:hover { color: #c7d2fe; }

/* ═══ 我的 AI 运营团队 ═══ */
.dash-team-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
}
.dash-team-card {
  display: flex; flex-direction: column;
  padding: 16px 16px 14px;
  border-radius: var(--media-radius-card);
  background: var(--media-card-bg-solid);
  border: 1px solid var(--media-card-border);
  box-shadow: var(--media-shadow-card);
  transition: transform 0.2s, border-color 0.2s;
}
.dash-team-card:hover { transform: translateY(-3px); border-color: rgba(129, 140, 248, 0.45); }
.dash-team-head { display: flex; align-items: center; gap: 10px; }
.dash-avatar {
  width: 38px; height: 38px;
  display: flex; align-items: center; justify-content: center;
  font-size: 19px;
  border-radius: 11px;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.25);
}
.dash-team-meta { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.dash-team-name { font-size: 14px; font-weight: 800; color: var(--media-text-title); letter-spacing: 0.04em; }
.dash-team-role { font-size: 10px; font-weight: 700; color: #818cf8; margin-top: 1px; }
.dash-status {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 9px; font-weight: 700;
  border-radius: 999px; padding: 2px 8px;
}
.dash-status.on { color: #34d399; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.32); }
.dash-status.off { color: var(--media-text-dim); background: rgba(71, 85, 105, 0.12); border: 1px solid rgba(71, 85, 105, 0.3); }
.dash-status-dot { width: 5px; height: 5px; border-radius: 50%; }
.dash-status.on .dash-status-dot { background: #34d399; }
.dash-status.off .dash-status-dot { background: #64748b; }
.dash-team-duty {
  margin: 12px 0 0;
  font-size: 11px; line-height: 1.7;
  color: var(--media-text-body);
  flex: 1;
}
.dash-team-foot { margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(71, 85, 105, 0.18); }
.dash-unlock {
  width: 100%;
  padding: 8px 0;
  border-radius: 9px;
  font-size: 11.5px; font-weight: 700;
  color: #e2e8f0;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.9), rgba(99, 102, 241, 0.9));
  border: 1px solid rgba(139, 92, 246, 0.5);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.dash-unlock:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(99, 102, 241, 0.35); }
.dash-view {
  display: block; text-align: center;
  padding: 8px 0;
  border-radius: 9px;
  font-size: 11.5px; font-weight: 700;
  color: #a5b4fc;
  border: 1px solid rgba(99, 102, 241, 0.35);
  text-decoration: none;
  transition: background 0.15s;
}
.dash-view:hover { background: rgba(99, 102, 241, 0.1); }

/* AI 已为你完成（真实成果） */
.dash-done {
  margin-top: 18px;
  padding: 16px 18px 18px;
  border-radius: var(--media-radius-card);
  background: rgba(13, 19, 40, 0.55);
  border: 1px dashed rgba(100, 116, 139, 0.35);
}
.dash-done-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; }
.dash-done-head b { font-size: 12.5px; font-weight: 800; color: var(--media-text-title); }
.dash-done-head span { font-size: 10.5px; color: var(--media-text-dim); }
.dash-done-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.dash-done-card {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 12px 14px;
  border-radius: var(--media-radius-node);
  background: var(--media-card-bg-solid);
  border: 1px solid var(--media-card-border);
}
.dash-done-meta { display: flex; flex-direction: column; gap: 2px; }
.dash-done-label { font-size: 10.5px; color: var(--media-text-body); }
.dash-done-num { font-size: 18px; font-weight: 800; color: var(--media-text-title); letter-spacing: -0.01em; }
.dash-done-num--text { font-size: 12.5px; line-height: 1.6; }
.dash-done-sub { font-size: 9px; color: var(--media-text-dim); text-align: right; max-width: 90px; }

/* ═══ 经营趋势 ═══ */
.dash-trend-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.dash-trend {
  display: flex; flex-direction: column; gap: 5px;
  padding: 16px 18px;
  border-radius: var(--media-radius-card);
  background: var(--media-card-bg-solid);
  border: 1px solid var(--media-card-border);
  box-shadow: var(--media-shadow-card);
}
.dash-trend-name { font-size: 11px; font-weight: 700; color: var(--media-text-body); }
.dash-trend-val { font-size: 15px; font-weight: 800; color: #fbbf24; }
.dash-trend-sub { font-size: 9.5px; color: var(--media-text-dim); }

/* ═══ 身份引导 ═══ */
.dash-identity {
  display: flex; flex-direction: column; gap: 6px;
  padding: 14px 18px;
  border-radius: 14px;
  font-size: 12px; line-height: 1.6;
  margin-bottom: 26px;
}
.dash-identity-error { border: 1px solid rgba(245, 158, 11, 0.35); background: rgba(245, 158, 11, 0.07); color: var(--media-text-body); }
.dash-identity-error b { color: #fbbf24; font-size: 13px; }
.dash-identity-ok { border: 1px solid rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.06); color: var(--media-text-body); }
.dash-identity-ok b { color: #34d399; font-size: 13px; }
.dash-identity-btn {
  align-self: flex-start; margin-top: 4px;
  padding: 5px 14px; border-radius: 8px;
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  color: #fff; font-size: 12px; font-weight: 600; text-decoration: none;
}

/* ═══ 解锁弹窗 ═══ */
.sub-modal-mask {
  position: fixed; inset: 0; z-index: 999;
  background: rgba(2, 6, 23, 0.7);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
.sub-modal {
  width: 560px; max-height: 82vh; overflow-y: auto;
  border-radius: 20px;
  background: #0f172a;
  border: 1px solid rgba(99, 102, 241, 0.3);
  box-shadow: 0 30px 80px rgba(2, 6, 23, 0.8);
}
.sub-modal-head {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 20px 22px 14px;
  border-bottom: 1px solid rgba(71, 85, 105, 0.2);
}
.sub-modal-title { font-size: 17px; font-weight: 800; color: var(--media-text-title); }
.sub-modal-sub { font-size: 11px; color: var(--media-text-dim); margin-top: 4px; }
.sub-modal-close { background: none; border: none; color: var(--media-text-dim); font-size: 15px; cursor: pointer; padding: 4px; }
.sub-modal-close:hover { color: var(--media-text-title); }
.sub-modal-list { padding: 10px 22px; display: flex; flex-direction: column; gap: 8px; }
.sub-modal-row {
  display: flex; gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(71, 85, 105, 0.22);
}
.sub-modal-avatar { font-size: 18px; }
.sub-modal-meta { display: flex; flex-direction: column; gap: 3px; }
.sub-modal-name { font-size: 12px; font-weight: 800; color: var(--media-text-title); }
.sub-modal-duty, .sub-modal-auto { font-size: 10.5px; color: var(--media-text-body); line-height: 1.55; }
.sub-modal-foot { padding: 14px 22px 20px; border-top: 1px solid rgba(71, 85, 105, 0.2); }
.sub-modal-note { font-size: 10.5px; color: var(--media-text-dim); margin-bottom: 12px; }
.sub-modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
.sub-modal-secondary {
  font-size: 12px; font-weight: 600; color: var(--media-text-body);
  text-decoration: none; padding: 8px 14px; border-radius: 10px;
  border: 1px solid rgba(71, 85, 105, 0.4);
}
.sub-modal-secondary:hover { color: var(--media-text-title); }
.sub-modal-primary {
  font-size: 12px; font-weight: 700; color: #fff;
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  border: none; border-radius: 10px; padding: 8px 18px; cursor: pointer;
}

/* 响应式 */
@media (max-width: 1180px) {
  .dash-kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .dash-team-grid { grid-template-columns: repeat(3, 1fr); }
  .dash-done-grid { grid-template-columns: repeat(2, 1fr); }
  .dash-trend-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 900px) {
  .dash-channel-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
