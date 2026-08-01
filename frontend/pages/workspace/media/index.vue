<!--
  AI 新媒体运营中心 · CEO 驾驶舱
  Sprint-MEDIA-DESIGN-REFINEMENT-03（掌柜 Design Direction）
  叙事：Hero(我是谁+能力+AI部门) → AI TEAM CONTENT ENGINE(我拥有) → CHANNEL INTELLIGENCE(入口) → OPERATION MEMORY(记忆/成果)
  视觉：深空黑 #050816 + 玻璃面板 #0F172A + 紫蓝渐变仅用于 激活/AI状态/CTA
  数据：全部复用 /api/enterprise/media/overview（零新 API）
-->
<template>
  <MediaWorkspaceShell>
    <!-- 身份引导（login-expired / personal-space） -->
    <div v-if="identityState === 'login-expired'" class="dash-identity dash-identity-error">
      <b>⚠️ 登录已过期</b>
      <span>你的会话已失效，请重新登录后继续使用 AI 新媒体运营中心。</span>
      <NuxtLink to="/?showLogin=1" class="dash-identity-btn">重新登录 →</NuxtLink>
    </div>
    <div v-else-if="identityState === 'personal-space'" class="dash-identity dash-identity-ok">
      <b>✅ 个人空间已就绪</b>
      <span>这里是你个人的 AI 新媒体运营中心。连接渠道资产、部署 AI 员工后，你的 AI 新媒体部门将开始全自动工作。</span>
      <NuxtLink to="/workspace/media/accounts" class="dash-identity-btn">连接渠道资产 →</NuxtLink>
    </div>

    <!-- ═══════════ HERO · 驾驶舱头 ═══════════ -->
    <section class="cockpit-hero">
      <div class="cockpit-hero-grid"></div>
      <div class="cockpit-hero-glow"></div>

      <!-- 左：身份 + 使命 + 能力 -->
      <div class="cockpit-hero-left">
        <div class="cockpit-kicker">
          <span class="cockpit-kicker-dot"></span>
          AI 新媒体运营中心
        </div>
        <h1 class="cockpit-title">
          让 AI 员工成为你的<br />
          <span class="cockpit-title-accent">全天候内容运营团队</span>
        </h1>
        <p class="cockpit-sub">你的 AI 新媒体部门正在等待启动——内容生产、客户运营、增长分析，交给 5 名 AI 员工，24 小时自动执行。</p>

        <!-- 三大能力（icon + 标签 + 动态状态） -->
        <div class="cockpit-caps">
          <div class="cockpit-cap">
            <span class="cockpit-cap-ico">🏭</span>
            <div class="cockpit-cap-meta">
              <span class="cockpit-cap-name">内容生产</span>
              <span class="cockpit-cap-sub">选题 · 创作 · 发布</span>
            </div>
            <span class="cockpit-cap-state" :class="systemReady ? 'on' : 'off'">
              <span class="cockpit-cap-dot"></span>{{ systemReady ? 'AI 运行中' : 'AI 待启动' }}
            </span>
          </div>
          <div class="cockpit-cap">
            <span class="cockpit-cap-ico">💬</span>
            <div class="cockpit-cap-meta">
              <span class="cockpit-cap-name">客户运营</span>
              <span class="cockpit-cap-sub">私信 · 分级 · 转化</span>
            </div>
            <span class="cockpit-cap-state" :class="systemReady ? 'on' : 'off'">
              <span class="cockpit-cap-dot"></span>{{ systemReady ? 'AI 运行中' : 'AI 待启动' }}
            </span>
          </div>
          <div class="cockpit-cap">
            <span class="cockpit-cap-ico">📈</span>
            <div class="cockpit-cap-meta">
              <span class="cockpit-cap-name">增长分析</span>
              <span class="cockpit-cap-sub">数据 · 复盘 · 洞察</span>
            </div>
            <span class="cockpit-cap-state" :class="systemReady ? 'on' : 'off'">
              <span class="cockpit-cap-dot"></span>{{ systemReady ? 'AI 运行中' : 'AI 待启动' }}
            </span>
          </div>
        </div>

        <!-- 双 CTA：下一步 -->
        <div class="cockpit-cta">
          <NuxtLink to="/workspace/media/accounts" class="cockpit-btn cockpit-btn-primary">
            连接渠道资产 <span class="cockpit-btn-arrow">→</span>
          </NuxtLink>
          <button v-if="!agents.length" class="cockpit-btn cockpit-btn-ghost" @click="showSubscribe = true">
            部署 AI 团队 <span class="cockpit-btn-arrow">→</span>
          </button>
          <NuxtLink v-else to="/workspace/media/team" class="cockpit-btn cockpit-btn-ghost">
            查看 AI 团队 <span class="cockpit-btn-arrow">→</span>
          </NuxtLink>
        </div>
      </div>

      <!-- 右：AI Department Visualization -->
      <div class="cockpit-hero-right">
        <div class="ai-dept">
          <div class="ai-dept-head">
            <span class="ai-dept-title">AI DEPARTMENT</span>
            <span class="ai-dept-sys" :class="systemReady ? 'ready' : 'standby'">
              <span class="ai-dept-sys-dot"></span>
              {{ systemReady ? 'SYSTEM ACTIVE' : 'SYSTEM STANDBY' }}
            </span>
          </div>
          <div class="ai-dept-body">
            <div
              v-for="(m, i) in teamRoster"
              :key="m.name"
              class="ai-dept-node"
              :class="{ 'is-locked': !deployedNames.includes(m.name) }"
            >
              <span class="ai-dept-node-dot" :class="deployedNames.includes(m.name) ? 'on' : 'off'"></span>
              <span class="ai-dept-node-avatar">{{ m.avatar }}</span>
              <div class="ai-dept-node-meta">
                <span class="ai-dept-node-name">{{ m.name }}</span>
                <span class="ai-dept-node-role">{{ m.eng }}</span>
              </div>
              <span class="ai-dept-node-state">
                {{ deployedNames.includes(m.name) ? 'READY' : 'STANDBY' }}
              </span>
              <span v-if="i < teamRoster.length - 1" class="ai-dept-node-link"></span>
            </div>
          </div>
          <div class="ai-dept-foot">
            <span class="ai-dept-foot-ico">◈</span>
            <span>5 名 AI 员工 · 一支属于你的新媒体部门</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════ AI TEAM CONTENT ENGINE · 我拥有 ═══════════ -->
    <section class="cockpit-section">
      <div class="cockpit-sec-head">
        <div>
          <div class="cockpit-sec-kicker">AI TEAM CONTENT ENGINE</div>
          <h2 class="cockpit-sec-title">我的 AI 运营团队</h2>
        </div>
        <NuxtLink to="/workspace/media/team" class="cockpit-sec-link">团队工作台 →</NuxtLink>
      </div>

      <div class="ce-grid">
        <div
          v-for="(m, i) in teamRoster"
          :key="m.name"
          class="ce-card"
          :class="{ 'is-locked': !deployedNames.includes(m.name) }"
        >
          <!-- 顶部：状态灯 -->
          <div class="ce-card-top">
            <span class="ce-status" :class="deployedNames.includes(m.name) ? 'ready' : 'locked'">
              <span class="ce-status-dot"></span>
              {{ deployedNames.includes(m.name) ? 'READY' : 'LOCKED' }}
            </span>
            <span class="ce-no">0{{ i + 1 }}</span>
          </div>

          <!-- 中间：核心信息 -->
          <div class="ce-card-core">
            <div class="ce-card-avatar">{{ m.avatar }}</div>
            <div class="ce-card-name">{{ m.name }}</div>
            <div class="ce-card-role">{{ m.eng }}</div>
            <div class="ce-card-duty">{{ m.duty }}</div>
            <div class="ce-card-caps">
              <span v-for="c in m.caps" :key="c" class="ce-cap">{{ c }}</span>
            </div>
          </div>

          <!-- 底部：行动入口 -->
          <div class="ce-card-foot">
            <button
              v-if="!deployedNames.includes(m.name)"
              class="ce-deploy-btn"
              @click="showSubscribe = true"
            >
              🔓 部署员工
            </button>
            <NuxtLink v-else to="/workspace/media/team" class="ce-view-link">查看工作台 →</NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════ CHANNEL INTELLIGENCE · 入口 ═══════════ -->
    <section class="cockpit-section">
      <div class="cockpit-sec-head">
        <div>
          <div class="cockpit-sec-kicker">CHANNEL INTELLIGENCE</div>
          <h2 class="cockpit-sec-title">渠道智能</h2>
        </div>
        <NuxtLink to="/workspace/media/accounts" class="cockpit-sec-link">渠道资产 →</NuxtLink>
      </div>

      <div class="ci-strip">
        <div
          v-for="ch in channelBlueprints"
          :key="ch.key"
          class="ci-node"
          :class="ch.connected ? 'connected' : ''"
        >
          <span class="ci-node-ico">{{ ch.icon }}</span>
          <div class="ci-node-meta">
            <span class="ci-node-name">{{ ch.name }}</span>
            <span class="ci-node-plan">{{ ch.plan }}</span>
          </div>
          <span class="ci-node-state">
            <span class="ci-node-dot" :class="ch.connected ? 'on' : 'off'"></span>
            {{ ch.connected ? '已连接' : '待接入' }}
          </span>
        </div>
      </div>
      <p class="ci-note">
        {{ channels.connected > 0
          ? `已连接 ${channels.connected} 个渠道——AI 员工可开始执行发布、回复与数据读取。`
          : '连接渠道资产后，AI 员工将自动开始发布与运营——渠道是 AI 部门的双手。' }}
      </p>
    </section>

    <!-- ═══════════ OPERATION MEMORY · 记忆与成果 ═══════════ -->
    <section class="cockpit-section">
      <div class="cockpit-sec-head">
        <div>
          <div class="cockpit-sec-kicker">OPERATION MEMORY</div>
          <h2 class="cockpit-sec-title">运营记忆</h2>
        </div>
      </div>

      <div class="om-grid">
        <!-- 今日任务（真实数据） -->
        <div class="om-card om-card--tasks">
          <div class="om-card-head">
            <span class="om-card-ico">📋</span>
            <span class="om-card-title">今日任务</span>
            <span class="om-card-badge">{{ today.completed || 0 }} 完成 · {{ today.pendingSchedules || 0 }} 待执行</span>
          </div>
          <div v-if="timeline.length" class="om-list">
            <div v-for="(t, i) in timeline" :key="i" class="om-row">
              <span class="om-row-dot"></span>
              <span class="om-row-title">{{ t.title }}</span>
              <span class="om-row-time">{{ t.time }}</span>
            </div>
          </div>
          <div v-else class="om-empty">
            <span class="om-empty-ico">⏳</span>
            <span class="om-empty-text">AI 员工部署后，今日任务将在这里实时滚动</span>
          </div>
        </div>

        <!-- 内容资产 -->
        <div class="om-card">
          <div class="om-card-head">
            <span class="om-card-ico">📦</span>
            <span class="om-card-title">内容资产</span>
            <span class="om-card-badge">{{ contentOutcomes }} 条成果</span>
          </div>
          <div class="om-empty">
            <span class="om-empty-ico">🎬</span>
            <span class="om-empty-text">AI 生产的图文与视频将沉淀为你的内容资产库</span>
          </div>
        </div>

        <!-- 客户洞察 -->
        <div class="om-card">
          <div class="om-card-head">
            <span class="om-card-ico">💎</span>
            <span class="om-card-title">客户洞察</span>
            <span class="om-card-badge">{{ customerOutcomes }} 条线索</span>
          </div>
          <div class="om-empty">
            <span class="om-empty-ico">👥</span>
            <span class="om-empty-text">AI 客服识别的客户价值分级将在这里沉淀</span>
          </div>
        </div>

        <!-- 数据复盘 -->
        <div class="om-card">
          <div class="om-card-head">
            <span class="om-card-ico">📊</span>
            <span class="om-card-title">数据复盘</span>
            <span class="om-card-badge">{{ usage.executions || 0 }} 次执行</span>
          </div>
          <div class="om-cost">
            <div class="om-cost-num">${{ usage.todayCost ? usage.todayCost.toFixed(4) : '0.0000' }}</div>
            <div class="om-cost-label">今日 AI 运营成本（真实归因）</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ 解锁 AI 团队弹窗（复用） ═══ -->
    <Teleport to="body">
      <div v-if="showSubscribe" class="sub-modal-mask" @click.self="showSubscribe = false">
        <div class="sub-modal">
          <div class="sub-modal-head">
            <div>
              <div class="sub-modal-title">🤖 解锁 AI 新媒体团队</div>
              <div class="sub-modal-sub">一份订阅 · 5 名 AI 员工 · 自动部署自动工作</div>
            </div>
            <button class="sub-modal-close" @click="showSubscribe = false">✕</button>
          </div>
          <div class="sub-modal-list">
            <div v-for="m in teamRoster" :key="m.name" class="sub-modal-row">
              <span class="sub-modal-avatar">{{ m.avatar }}</span>
              <div class="sub-modal-meta">
                <div class="sub-modal-name">{{ m.name }} · {{ m.role }}</div>
                <div class="sub-modal-duty">📌 {{ m.duty }}</div>
                <div class="sub-modal-value">→ {{ m.value }}</div>
                <div class="sub-modal-auto">⚙️ 订阅后自动执行：{{ m.auto }}</div>
              </div>
            </div>
          </div>
          <div class="sub-modal-foot">
            <div class="sub-modal-note">订阅后：自动部署 AI 员工 → 绑定渠道资产 → 开始自动运营 → 成果回流总控中心</div>
            <div class="sub-modal-actions">
              <NuxtLink to="/workspace/media/accounts" class="sub-modal-secondary" @click="showSubscribe = false">先去连接公众号 →</NuxtLink>
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
  channels: { connected: 0, total: 4 },
  industryRadar: { supported: false, reason: '' },
})

const { $toast } = useNuxtApp() as any

const agents = computed(() => overview.value.agents || [])
const today = computed(() => overview.value.today || {})
const usage = computed(() => overview.value.usage || {})
const channels = computed(() => overview.value.channels || { connected: 0, total: 4 })
const recentOutcomes = computed(() => overview.value.recentOutcomes || [])
const industryRadar = computed(() => overview.value.industryRadar || {})

const activeCount = computed(() => agents.value.filter((a: any) => a.lifecycleState === 'ACTIVE').length)
const systemReady = computed(() => activeCount.value > 0)
const deployedNames = computed(() => agents.value.map((a: any) => a.name).filter(Boolean))

const contentOutcomes = computed(() => recentOutcomes.value.filter((o: any) => /CONTENT|PUBLISH|CREATE/i.test(o.outcomeType || '')).length)
const customerOutcomes = computed(() => recentOutcomes.value.filter((o: any) => /CUSTOMER|CLIENT|LEAD/i.test(o.outcomeType || '')).length)

function taskTypeLabel(t: string) {
  const map: Record<string, string> = {
    content: '内容生成', scan: '热点扫描', analysis: '数据分析',
    report: '日报生成', outreach: '粉丝触达', auto: '自动任务',
  }
  return map[t] || t
}
function fmtTime(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

const timeline = computed(() => {
  const items: { kind: 'schedule' | 'outcome'; title: string; time: string }[] = []
  for (const s of today.value.scheduleItems || []) {
    items.push({ kind: 'schedule', title: taskTypeLabel(s.taskType), time: fmtTime(s.nextRunAt) })
  }
  for (const o of overview.value.recentOutcomes || []) {
    const d = new Date(o.createdAt)
    if (d.toDateString() === new Date().toDateString()) {
      items.push({ kind: 'outcome', title: o.outcomeType + (o.title ? ' · ' + o.title : ''), time: fmtTime(o.createdAt) })
    }
  }
  return items.sort((a, b) => a.time.localeCompare(b.time)).slice(0, 6)
})

// 渠道资产蓝图（产品 4 平台；连接状态由 overview.channels 真实计数）
const channelBlueprints = computed(() => {
  const connected = channels.value.connected || 0
  const defs = [
    { key: 'wechat', icon: '🟢', name: '微信公众号', plan: '企业认证服务号' },
    { key: 'douyin', icon: '📱', name: '抖音', plan: '企业号' },
    { key: 'xiaohongshu', icon: '📕', name: '小红书', plan: '企业号' },
    { key: 'video', icon: '📺', name: '视频号', plan: '企业认证' },
  ]
  return defs.map((d, i) => ({ ...d, connected: i < connected }))
})

// 标准编制（免费可见价值 · 订阅解锁）· eng=英文职能 · caps=能力标签
const teamRoster = [
  { name: 'Alice', role: '运营总监', eng: 'Strategy Director', avatar: '👩‍💼', duty: '统筹内容日历与发布节奏，制定月度运营策略', caps: ['战略规划', '内容日历', '增长分析'], value: '减少人工策划成本：运营策略与排期自动生成，每周一份清晰运营计划', auto: '自动制定内容战略与月度排期，指挥团队执行' },
  { name: 'Bob', role: '内容策划', eng: 'Content Planner', avatar: '🧑‍💻', duty: '追踪行业热点与竞品动态，产出选题池与策略建议', caps: ['热点追踪', '选题池', '竞品分析'], value: '持续产生内容方向：选题自动排满内容日历，不再为“今天发什么”发愁', auto: '每日扫描热点与竞品，选题池自动填充' },
  { name: 'Carol', role: '内容生产', eng: 'Content Producer', avatar: '👩‍🎨', duty: '按选题生产图文与视频内容，AI 辅助创作输出成品', caps: ['图文创作', '视频生产', 'AI 初稿'], value: '提高生产效率：图文视频批量产出，发布前可人工审核把关', auto: '按选题自动生成图文与视频初稿，交人工审核' },
  { name: 'David', role: 'AI 客服', eng: 'Customer Ops', avatar: '🧑‍💼', duty: '接待粉丝消息，识别高价值客户并转交真人跟进', caps: ['私信秒回', 'A/B/C 分级', '线索提醒'], value: '减少人工客服压力：私信秒回，客户线索自动分类，不错过潜在客户', auto: '自动回复粉丝私信，A/B/C 分级并提醒销售机会' },
  { name: 'Eve', role: '数据分析', eng: 'Analytics Lead', avatar: '👩‍🔬', duty: '回流账号数据，产出运营周报与增长洞察', caps: ['数据回流', '运营周报', '增长建议'], value: '持续优化运营：每周自动复盘，什么有效、粉丝从哪来、下一步做什么', auto: '每周自动产出运营周报与增长建议' },
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
      $toast?.error?.(data?.message || '加载驾驶舱失败')
    }
  } catch {
    $toast?.error?.('加载驾驶舱失败（网络异常）')
  }
})
</script>

<style scoped>
/* ═══ 深空黑基底（掌柜 Design Direction：Base #050816 / Surface #0F172A） ═══ */
.cockpit-hero {
  position: relative;
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 28px;
  padding: 34px 36px;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(5, 8, 22, 0.96));
  border: 1px solid rgba(99, 102, 241, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 24px 60px rgba(2, 6, 23, 0.6);
  overflow: hidden;
  margin-bottom: 34px;
}
.cockpit-hero-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(99, 102, 241, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99, 102, 241, 0.05) 1px, transparent 1px);
  background-size: 34px 34px;
  mask-image: radial-gradient(ellipse 80% 70% at 50% 0%, #000 40%, transparent 100%);
  pointer-events: none;
}
.cockpit-hero-glow {
  position: absolute;
  top: -180px;
  right: -120px;
  width: 520px;
  height: 520px;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.16), transparent 65%);
  pointer-events: none;
}
.cockpit-hero-left, .cockpit-hero-right { position: relative; z-index: 1; }

/* Hero 左 */
.cockpit-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.16em;
  color: #a5b4fc;
  margin-bottom: 14px;
}
.cockpit-kicker-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: linear-gradient(135deg, #a78bfa, #6366f1);
  box-shadow: 0 0 10px rgba(129, 140, 248, 0.9);
}
.cockpit-title {
  font-size: 34px;
  font-weight: 800;
  line-height: 1.22;
  letter-spacing: -0.02em;
  color: #f8fafc;
  margin: 0 0 14px;
}
.cockpit-title-accent {
  background: linear-gradient(120deg, #c7d2fe 0%, #a5b4fc 45%, #818cf8 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.cockpit-sub {
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.8;
  margin: 0 0 20px;
  max-width: 480px;
}

/* 三大能力标签 */
.cockpit-caps {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
}
.cockpit-cap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  border-radius: 13px;
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid rgba(71, 85, 105, 0.35);
  transition: border-color 0.18s;
}
.cockpit-cap:hover { border-color: rgba(129, 140, 248, 0.45); }
.cockpit-cap-ico { font-size: 15px; }
.cockpit-cap-meta { display: flex; flex-direction: column; flex: 1; }
.cockpit-cap-name { font-size: 12.5px; font-weight: 700; color: #e2e8f0; }
.cockpit-cap-sub { font-size: 10px; color: #64748b; }
.cockpit-cap-state {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 700; letter-spacing: 0.05em;
  border-radius: 999px; padding: 2px 10px;
}
.cockpit-cap-state.on { color: #34d399; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); }
.cockpit-cap-state.off { color: #94a3b8; background: rgba(71, 85, 105, 0.15); border: 1px solid rgba(71, 85, 105, 0.3); }
.cockpit-cap-dot { width: 6px; height: 6px; border-radius: 50%; }
.cockpit-cap-state.on .cockpit-cap-dot { background: #34d399; box-shadow: 0 0 6px #34d399; animation: pulse 2s infinite; }
.cockpit-cap-state.off .cockpit-cap-dot { background: #64748b; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

/* 双 CTA */
.cockpit-cta { display: flex; gap: 12px; }
.cockpit-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 20px;
  border-radius: 12px;
  font-size: 13px; font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.cockpit-btn:hover { transform: translateY(-1px); }
.cockpit-btn-primary {
  color: #fff;
  background: linear-gradient(135deg, #8b5cf6, #6366f1 55%, #3b82f6);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.35);
}
.cockpit-btn-primary:hover { box-shadow: 0 10px 28px rgba(99, 102, 241, 0.5); }
.cockpit-btn-ghost {
  color: #cbd5e1;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(71, 85, 105, 0.4);
}
.cockpit-btn-ghost:hover { color: #fff; border-color: rgba(129, 140, 248, 0.5); }
.cockpit-btn-arrow { font-size: 14px; }

/* ═══ Hero 右 · AI Department Visualization ═══ */
.ai-dept {
  position: relative;
  border-radius: 18px;
  background: rgba(5, 8, 22, 0.72);
  border: 1px solid rgba(99, 102, 241, 0.22);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 18px 44px rgba(2, 6, 23, 0.5);
  overflow: hidden;
}
.ai-dept-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 13px 16px;
  border-bottom: 1px solid rgba(71, 85, 105, 0.25);
}
.ai-dept-title {
  font-size: 10.5px; font-weight: 800; letter-spacing: 0.18em;
  color: #94a3b8;
}
.ai-dept-sys {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 9.5px; font-weight: 800; letter-spacing: 0.08em;
  border-radius: 999px; padding: 3px 10px;
}
.ai-dept-sys.ready { color: #34d399; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.32); }
.ai-dept-sys.standby { color: #fbbf24; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.28); }
.ai-dept-sys-dot { width: 6px; height: 6px; border-radius: 50%; }
.ai-dept-sys.ready .ai-dept-sys-dot { background: #34d399; box-shadow: 0 0 7px #34d399; animation: pulse 2s infinite; }
.ai-dept-sys.standby .ai-dept-sys-dot { background: #fbbf24; box-shadow: 0 0 7px #fbbf24; animation: pulse 2.4s infinite; }

.ai-dept-body { position: relative; padding: 14px 16px 6px; }
.ai-dept-node {
  position: relative;
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  border-radius: 11px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(71, 85, 105, 0.25);
  margin-bottom: 8px;
  transition: border-color 0.18s;
}
.ai-dept-node:hover { border-color: rgba(129, 140, 248, 0.4); }
.ai-dept-node.is-locked { opacity: 0.75; }
.ai-dept-node-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.ai-dept-node-dot.on { background: #34d399; box-shadow: 0 0 8px #34d399; }
.ai-dept-node-dot.off { background: #475569; }
.ai-dept-node-avatar { font-size: 15px; }
.ai-dept-node-meta { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.ai-dept-node-name { font-size: 12px; font-weight: 800; color: #e2e8f0; letter-spacing: 0.04em; }
.ai-dept-node-role { font-size: 9.5px; color: #64748b; letter-spacing: 0.06em; text-transform: uppercase; }
.ai-dept-node-state {
  font-size: 9px; font-weight: 800; letter-spacing: 0.1em;
  color: #34d399;
}
.ai-dept-node.is-locked .ai-dept-node-state { color: #64748b; }
.ai-dept-foot {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 16px 14px;
  font-size: 10.5px; color: #64748b;
}
.ai-dept-foot-ico { color: #818cf8; }

/* ═══ 区块通用 ═══ */
.cockpit-section { margin-bottom: 34px; }
.cockpit-sec-head {
  display: flex; align-items: flex-end; justify-content: space-between;
  margin-bottom: 16px;
}
.cockpit-sec-kicker {
  font-size: 10px; font-weight: 800; letter-spacing: 0.2em;
  color: #818cf8; margin-bottom: 4px;
}
.cockpit-sec-title { font-size: 19px; font-weight: 800; color: #f1f5f9; margin: 0; letter-spacing: -0.01em; }
.cockpit-sec-link {
  font-size: 11.5px; font-weight: 600; color: #94a3b8;
  text-decoration: none;
  transition: color 0.15s;
}
.cockpit-sec-link:hover { color: #a5b4fc; }

/* ═══ AI Glass Card · 员工 ═══ */
.ce-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
}
.ce-card {
  display: flex; flex-direction: column;
  border-radius: 17px;
  background: rgba(15, 23, 42, 0.78);
  border: 1px solid rgba(71, 85, 105, 0.3);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 10px 30px rgba(2, 6, 23, 0.35);
  overflow: hidden;
  transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
}
.ce-card:hover {
  transform: translateY(-3px);
  border-color: rgba(129, 140, 248, 0.45);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 18px 44px rgba(2, 6, 23, 0.55), 0 0 0 1px rgba(129, 140, 248, 0.12);
}
.ce-card.is-locked { opacity: 0.85; }
.ce-card-top {
  display: flex; align-items: center; justify-content: space-between;
  padding: 11px 14px 0;
}
.ce-status {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 9px; font-weight: 800; letter-spacing: 0.12em;
  border-radius: 999px; padding: 2px 9px;
}
.ce-status.ready { color: #34d399; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.32); }
.ce-status.locked { color: #94a3b8; background: rgba(71, 85, 105, 0.12); border: 1px solid rgba(71, 85, 105, 0.3); }
.ce-status-dot { width: 6px; height: 6px; border-radius: 50%; }
.ce-status.ready .ce-status-dot { background: #34d399; box-shadow: 0 0 6px #34d399; animation: pulse 2s infinite; }
.ce-status.locked .ce-status-dot { background: #64748b; }
.ce-no { font-size: 10px; font-weight: 800; color: #334155; letter-spacing: 0.1em; }
.ce-card-core { padding: 12px 14px 10px; display: flex; flex-direction: column; gap: 5px; }
.ce-card-avatar { font-size: 26px; margin-bottom: 2px; }
.ce-card-name { font-size: 17px; font-weight: 800; color: #f1f5f9; letter-spacing: 0.06em; }
.ce-card-role { font-size: 9.5px; font-weight: 700; color: #818cf8; letter-spacing: 0.1em; text-transform: uppercase; }
.ce-card-duty { font-size: 11px; color: #94a3b8; line-height: 1.6; margin-top: 3px; min-height: 36px; }
.ce-card-caps { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 4px; }
.ce-cap {
  font-size: 9px; font-weight: 600; color: #a5b4fc;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.22);
  border-radius: 7px; padding: 2px 7px;
}
.ce-card-foot {
  margin-top: auto;
  padding: 10px 14px 14px;
  border-top: 1px solid rgba(71, 85, 105, 0.18);
}
.ce-deploy-btn {
  width: 100%;
  padding: 8px 0;
  border-radius: 10px;
  font-size: 11.5px; font-weight: 700;
  color: #e2e8f0;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.9), rgba(99, 102, 241, 0.9));
  border: 1px solid rgba(139, 92, 246, 0.5);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.ce-deploy-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(99, 102, 241, 0.35); }
.ce-view-link {
  display: block; text-align: center;
  padding: 8px 0;
  border-radius: 10px;
  font-size: 11.5px; font-weight: 700;
  color: #a5b4fc;
  border: 1px solid rgba(99, 102, 241, 0.35);
  text-decoration: none;
  transition: background 0.15s;
}
.ce-view-link:hover { background: rgba(99, 102, 241, 0.1); }

/* ═══ CHANNEL INTELLIGENCE ═══ */
.ci-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.ci-node {
  display: flex; align-items: center; gap: 11px;
  padding: 15px 16px;
  border-radius: 15px;
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(71, 85, 105, 0.28);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  transition: border-color 0.18s, transform 0.15s;
}
.ci-node:hover { transform: translateY(-2px); border-color: rgba(129, 140, 248, 0.4); }
.ci-node.connected { border-color: rgba(16, 185, 129, 0.35); }
.ci-node-ico { font-size: 20px; }
.ci-node-meta { display: flex; flex-direction: column; flex: 1; }
.ci-node-name { font-size: 12.5px; font-weight: 700; color: #e2e8f0; }
.ci-node-plan { font-size: 9.5px; color: #64748b; }
.ci-node-state {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 9.5px; font-weight: 700;
  color: #64748b;
}
.ci-node.connected .ci-node-state { color: #34d399; }
.ci-node-dot { width: 6px; height: 6px; border-radius: 50%; }
.ci-node-dot.on { background: #34d399; box-shadow: 0 0 6px #34d399; }
.ci-node-dot.off { background: #475569; }
.ci-note {
  margin: 12px 2px 0;
  font-size: 11px; color: #64748b;
}

/* ═══ OPERATION MEMORY ═══ */
.om-grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr 1fr 1fr;
  gap: 14px;
}
.om-card {
  display: flex; flex-direction: column;
  min-height: 138px;
  border-radius: 15px;
  padding: 15px 16px;
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(71, 85, 105, 0.28);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}
.om-card-head {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 10px;
}
.om-card-ico { font-size: 14px; }
.om-card-title { font-size: 12.5px; font-weight: 800; color: #e2e8f0; flex: 1; }
.om-card-badge { font-size: 9px; font-weight: 700; color: #818cf8; background: rgba(99, 102, 241, 0.1); border-radius: 999px; padding: 2px 9px; }
.om-list { display: flex; flex-direction: column; gap: 6px; }
.om-row {
  display: flex; align-items: center; gap: 8px;
  font-size: 11px;
}
.om-row-dot { width: 5px; height: 5px; border-radius: 50%; background: #818cf8; box-shadow: 0 0 5px rgba(129, 140, 248, 0.7); flex-shrink: 0; }
.om-row-title { color: #cbd5e1; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.om-row-time { color: #64748b; font-size: 10px; }
.om-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; flex: 1; padding: 8px 0; }
.om-empty-ico { font-size: 20px; opacity: 0.7; }
.om-empty-text { font-size: 10.5px; color: #64748b; text-align: center; line-height: 1.6; }
.om-cost { display: flex; flex-direction: column; justify-content: center; align-items: center; flex: 1; gap: 4px; }
.om-cost-num { font-size: 21px; font-weight: 800; color: #f1f5f9; letter-spacing: -0.02em; }
.om-cost-label { font-size: 9.5px; color: #64748b; }

/* ═══ 身份引导 ═══ */
.dash-identity {
  display: flex; flex-direction: column; gap: 6px;
  padding: 14px 18px;
  border-radius: 14px;
  font-size: 12px; line-height: 1.6;
  margin-bottom: 26px;
}
.dash-identity-error { border: 1px solid rgba(245, 158, 11, 0.35); background: rgba(245, 158, 11, 0.07); color: #94a3b8; }
.dash-identity-error b { color: #fbbf24; font-size: 13px; }
.dash-identity-ok { border: 1px solid rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.06); color: #94a3b8; }
.dash-identity-ok b { color: #34d399; font-size: 13px; }
.dash-identity-btn {
  align-self: flex-start; margin-top: 4px;
  padding: 5px 14px; border-radius: 8px;
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  color: #fff; font-size: 12px; font-weight: 600; text-decoration: none;
}

/* ═══ 订阅弹窗 ═══ */
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
.sub-modal-title { font-size: 17px; font-weight: 800; color: #f1f5f9; }
.sub-modal-sub { font-size: 11px; color: #64748b; margin-top: 4px; }
.sub-modal-close {
  background: none; border: none; color: #64748b;
  font-size: 15px; cursor: pointer; padding: 4px;
}
.sub-modal-close:hover { color: #f1f5f9; }
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
.sub-modal-name { font-size: 12px; font-weight: 800; color: #e2e8f0; }
.sub-modal-duty, .sub-modal-value, .sub-modal-auto { font-size: 10.5px; color: #94a3b8; line-height: 1.55; }
.sub-modal-foot { padding: 14px 22px 20px; border-top: 1px solid rgba(71, 85, 105, 0.2); }
.sub-modal-note { font-size: 10.5px; color: #64748b; margin-bottom: 12px; }
.sub-modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
.sub-modal-secondary {
  font-size: 12px; font-weight: 600; color: #94a3b8;
  text-decoration: none; padding: 8px 14px; border-radius: 10px;
  border: 1px solid rgba(71, 85, 105, 0.4);
}
.sub-modal-secondary:hover { color: #e2e8f0; }
.sub-modal-primary {
  font-size: 12px; font-weight: 700; color: #fff;
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  border: none; border-radius: 10px; padding: 8px 18px; cursor: pointer;
}

/* 响应式 */
@media (max-width: 1180px) {
  .ce-grid { grid-template-columns: repeat(3, 1fr); }
  .om-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 900px) {
  .cockpit-hero { grid-template-columns: 1fr; }
  .ci-strip { grid-template-columns: repeat(2, 1fr); }
}
</style>
