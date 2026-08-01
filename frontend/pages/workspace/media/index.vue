<!--
  Sprint-MEDIA-DESIGN-LOCALIZATION-04 — 首页 = 我的 AI 新媒体公司总部
  中国企业用户产品语言：无英文技术词 / 卡片三问（这是什么·能帮我什么·下一步）
  结构：总部头(使命+双CTA) → 我的 AI 员工 → 我的新媒体渠道(9平台) → 运营情况
  数据：全部复用 /api/enterprise/media/overview（零新 API）
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
      <span>这里是你个人的 AI 新媒体运营中心。连接新媒体账号、解锁 AI 员工后，你的 AI 新媒体部门将开始自动工作。</span>
      <NuxtLink to="/workspace/media/accounts" class="dash-identity-btn">连接新媒体账号 →</NuxtLink>
    </div>

    <!-- ═══════ 总部头 · 我是谁 + 下一步 ═══════ -->
    <section class="hq-hero">
      <div class="hq-hero-grid"></div>
      <div class="hq-hero-glow"></div>
      <div class="hq-hero-inner">
        <h1 class="hq-title">AI 新媒体运营中心</h1>
        <p class="hq-mission">让 AI 员工帮你持续做好内容、运营客户、提升品牌影响力</p>
        <div class="hq-cta">
          <NuxtLink to="/workspace/media/accounts" class="hq-btn hq-btn-primary">
            连接新媒体账号 <span class="hq-btn-arrow">→</span>
          </NuxtLink>
          <button v-if="!agents.length" class="hq-btn hq-btn-ghost" @click="showSubscribe = true">
            解锁 AI 员工团队 <span class="hq-btn-arrow">→</span>
          </button>
          <NuxtLink v-else to="/workspace/media/team" class="hq-btn hq-btn-ghost">
            查看我的 AI 员工 <span class="hq-btn-arrow">→</span>
          </NuxtLink>
        </div>
        <div class="hq-why">
          <span class="hq-why-item">🤖 5 名智能员工，解锁后自动工作</span>
          <span class="hq-why-item">📱 支持 9 大新媒体平台</span>
          <span class="hq-why-item">📊 运营成果自动汇总</span>
        </div>
      </div>
    </section>

    <!-- ═══════ 我的 AI 员工 · 我拥有 ═══════ -->
    <section class="hq-section">
      <div class="hq-sec-head">
        <div>
          <div class="hq-sec-kicker">我的 AI 员工</div>
          <h2 class="hq-sec-title">5 名智能员工，等待为你工作</h2>
        </div>
        <NuxtLink to="/workspace/media/team" class="hq-sec-link">查看全部 →</NuxtLink>
      </div>

      <div class="hq-team-grid">
        <div
          v-for="(m, i) in teamRoster"
          :key="m.name"
          class="hq-team-card"
          :class="{ 'is-locked': !deployedNames.includes(m.name) }"
        >
          <!-- 卡片三问 1：这是什么 -->
          <div class="hq-card-top">
            <span class="hq-status" :class="deployedNames.includes(m.name) ? 'on' : 'off'">
              <span class="hq-status-dot"></span>
              {{ deployedNames.includes(m.name) ? '运行中' : '未解锁' }}
            </span>
            <span class="hq-card-no">0{{ i + 1 }}</span>
          </div>

          <div class="hq-card-body">
            <div class="hq-avatar">{{ m.avatar }}</div>
            <div class="hq-name">{{ m.name }}</div>
            <div class="hq-role">{{ m.role }}</div>
            <!-- 卡片三问 2：能帮我什么 -->
            <div class="hq-helps">
              <div v-for="h in m.helps" :key="h" class="hq-help">
                <span class="hq-help-check">✓</span>{{ h }}
              </div>
            </div>
          </div>

          <!-- 卡片三问 3：下一步 -->
          <div class="hq-card-foot">
            <button v-if="!deployedNames.includes(m.name)" class="hq-unlock" @click="showSubscribe = true">
              🔓 解锁这个员工
            </button>
            <NuxtLink v-else to="/workspace/media/team" class="hq-view">查看工作台 →</NuxtLink>
          </div>
        </div>
      </div>
      <p class="hq-sec-note">解锁后自动工作：AI 员工将按你的业务自动规划内容、制作素材、运营客户、分析数据。</p>
    </section>

    <!-- ═══════ 我的新媒体渠道 · 入口 ═══════ -->
    <section class="hq-section">
      <div class="hq-sec-head">
        <div>
          <div class="hq-sec-kicker">我的新媒体渠道</div>
          <h2 class="hq-sec-title">连接你的内容渠道，AI 员工才能帮你运营</h2>
        </div>
        <NuxtLink to="/workspace/media/accounts" class="hq-sec-link">账号管理 →</NuxtLink>
      </div>

      <div class="hq-channel-grid">
        <div
          v-for="ch in channelBlueprints"
          :key="ch.name"
          class="hq-channel"
          :class="ch.connected ? 'connected' : ''"
          @click="onChannelClick(ch)"
        >
          <span class="hq-channel-ico">{{ ch.icon }}</span>
          <div class="hq-channel-meta">
            <span class="hq-channel-name">{{ ch.name }}</span>
            <span class="hq-channel-plan">{{ ch.plan }}</span>
          </div>
          <span class="hq-channel-state">
            <span class="hq-channel-dot" :class="ch.connected ? 'on' : 'off'"></span>
            {{ ch.connected ? '已连接' : '未连接' }}
          </span>
        </div>
      </div>
      <p class="hq-sec-note">
        {{ channels.connected > 0
          ? `已连接 ${channels.connected} 个账号——AI 员工可以开始帮你发布内容、回复客户。`
          : '连接账号后，AI 员工才能帮你发布内容、回复客户、读取数据。' }}
      </p>
    </section>

    <!-- ═══════ 运营情况 · 成果 ═══════ -->
    <section class="hq-section">
      <div class="hq-sec-head">
        <div>
          <div class="hq-sec-kicker">运营情况</div>
          <h2 class="hq-sec-title">你的 AI 新媒体部门做了多少事</h2>
        </div>
      </div>

      <div class="hq-ops-grid">
        <!-- 今日内容 -->
        <div class="hq-ops-card">
          <div class="hq-ops-ico">📝</div>
          <div class="hq-ops-meta">
            <span class="hq-ops-label">今日内容</span>
            <span class="hq-ops-num">{{ contentOutcomes }}</span>
          </div>
          <span class="hq-ops-sub">AI 生产的图文与视频</span>
        </div>

        <!-- 客户咨询 -->
        <div class="hq-ops-card">
          <div class="hq-ops-ico">💬</div>
          <div class="hq-ops-meta">
            <span class="hq-ops-label">客户咨询</span>
            <span class="hq-ops-num">{{ customerOutcomes }}</span>
          </div>
          <span class="hq-ops-sub">AI 客服接待与跟进</span>
        </div>

        <!-- 粉丝互动 -->
        <div class="hq-ops-card">
          <div class="hq-ops-ico">❤️</div>
          <div class="hq-ops-meta">
            <span class="hq-ops-label">粉丝互动</span>
            <span class="hq-ops-num">{{ fanInteractions }}</span>
          </div>
          <span class="hq-ops-sub">连接账号后自动统计</span>
        </div>

        <!-- 数据报告 -->
        <div class="hq-ops-card">
          <div class="hq-ops-ico">📊</div>
          <div class="hq-ops-meta">
            <span class="hq-ops-label">数据报告</span>
            <span class="hq-ops-num hq-ops-num--text">{{ reportText }}</span>
          </div>
          <span class="hq-ops-sub">运营效果与增长建议</span>
        </div>
      </div>
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
            <div class="sub-modal-note">解锁后：自动部署 AI 员工 → 绑定新媒体账号 → 开始自动运营 → 成果汇总到运营情况</div>
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
const today = computed(() => overview.value.today || {})
const usage = computed(() => overview.value.usage || {})
const channels = computed(() => overview.value.channels || { connected: 0, total: 9 })
const recentOutcomes = computed(() => overview.value.recentOutcomes || [])

const activeCount = computed(() => agents.value.filter((a: any) => a.lifecycleState === 'ACTIVE').length)
const deployedNames = computed(() => agents.value.map((a: any) => a.name).filter(Boolean))

const contentOutcomes = computed(() => recentOutcomes.value.filter((o: any) => /CONTENT|PUBLISH|CREATE/i.test(o.outcomeType || '')).length)
const customerOutcomes = computed(() => recentOutcomes.value.filter((o: any) => /CUSTOMER|CLIENT|LEAD/i.test(o.outcomeType || '')).length)
const fanInteractions = computed(() => 0) // 无渠道数据源：诚实 0，连接账号后回流
const reportText = computed(() => {
  if (usage.value.executions > 0 || recentOutcomes.value.length > 0) {
    return `${usage.value.executions || 0} 次执行`
  }
  return '等待连接账号'
})

// 9 大新媒体平台（产品蓝图；连接状态：微信公众号真实接入后点亮，其余待接入诚实展示）
const channelBlueprints = computed(() => {
  const connected = channels.value.connected || 0
  const defs = [
    { icon: '📱', name: '抖音', plan: '短视频 · 直播' },
    { icon: '📱', name: '快手', plan: '短视频 · 直播' },
    { icon: '📕', name: '小红书', plan: '种草图文 · 视频' },
    { icon: '🎬', name: '视频号', plan: '微信生态分发' },
    { icon: '💬', name: '微信公众号', plan: '图文 · 菜单服务' },
    { icon: '🌐', name: '微博', plan: '话题 · 图文' },
    { icon: '📰', name: '百家号', plan: '图文 · 视频' },
    { icon: '📰', name: '今日头条', plan: '图文 · 视频' },
    { icon: '🏢', name: '企业微信', plan: '私域客户运营' },
  ]
  return defs.map((d, i) => ({ ...d, connected: i === 4 && connected > 0 }))
})

function onChannelClick(ch: any) {
  if (ch.connected) return
  if (ch.name === '微信公众号') {
    window.location.href = '/workspace/media/accounts'
  } else {
    $toast?.info?.(`「${ch.name}」接入即将开放，先连接微信公众号体验完整流程`)
  }
}

// 5 名 AI 员工（产品语言：职位 + 帮你做什么 + 解锁后自动工作）
const teamRoster = [
  { name: 'Alice', role: 'AI 运营总监', avatar: '👩‍💼', helps: ['制定内容计划', '安排发布节奏', '规划全年运营方向'], auto: '自动制定内容计划与发布排期，指挥团队执行' },
  { name: 'Bob', role: 'AI 内容策划', avatar: '🧑‍💻', helps: ['发现热门内容', '规划每日选题'], auto: '每天发现热门内容方向，选题自动排满内容日历' },
  { name: 'Carol', role: 'AI 内容制作', avatar: '👩‍🎨', helps: ['生成文章', '生成图片', '生成视频'], auto: '按选题自动生成文章、图片、视频初稿，交人工审核' },
  { name: 'David', role: 'AI 客户管家', avatar: '🧑‍💼', helps: ['自动回复客户咨询', '发现销售机会'], auto: '自动回复客户消息，发现销售机会并提醒你跟进' },
  { name: 'Eve', role: 'AI 数据分析师', avatar: '👩‍🔬', helps: ['分析运营效果', '优化运营方向'], auto: '每天分析运营效果，自动产出报告与增长建议' },
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
/* ═══ 总部头（视觉保持 DESIGN-REFINEMENT-03：深空黑 + 玻璃 + AI 氛围） ═══ */
.hq-hero {
  position: relative;
  padding: 44px 40px 36px;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(5, 8, 22, 0.96));
  border: 1px solid rgba(99, 102, 241, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 24px 60px rgba(2, 6, 23, 0.6);
  overflow: hidden;
  margin-bottom: 34px;
}
.hq-hero-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(99, 102, 241, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99, 102, 241, 0.05) 1px, transparent 1px);
  background-size: 34px 34px;
  mask-image: radial-gradient(ellipse 80% 70% at 50% 0%, #000 40%, transparent 100%);
  pointer-events: none;
}
.hq-hero-glow {
  position: absolute;
  top: -200px;
  right: -120px;
  width: 560px;
  height: 560px;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.16), transparent 65%);
  pointer-events: none;
}
.hq-hero-inner { position: relative; z-index: 1; max-width: 760px; }
.hq-title {
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #f8fafc;
  margin: 0 0 12px;
}
.hq-mission {
  font-size: 15px;
  line-height: 1.8;
  color: #94a3b8;
  margin: 0 0 24px;
}
.hq-cta { display: flex; gap: 12px; flex-wrap: wrap; }
.hq-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 11px 22px;
  border-radius: 12px;
  font-size: 13.5px; font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.hq-btn:hover { transform: translateY(-1px); }
.hq-btn-primary {
  color: #fff;
  background: linear-gradient(135deg, #8b5cf6, #6366f1 55%, #3b82f6);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.35);
}
.hq-btn-primary:hover { box-shadow: 0 10px 28px rgba(99, 102, 241, 0.5); }
.hq-btn-ghost {
  color: #cbd5e1;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(71, 85, 105, 0.4);
}
.hq-btn-ghost:hover { color: #fff; border-color: rgba(129, 140, 248, 0.5); }
.hq-btn-arrow { font-size: 14px; }
.hq-why {
  display: flex; flex-wrap: wrap; gap: 10px 20px;
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid rgba(71, 85, 105, 0.22);
}
.hq-why-item { font-size: 11.5px; color: #64748b; }

/* ═══ 区块通用 ═══ */
.hq-section { margin-bottom: 34px; }
.hq-sec-head {
  display: flex; align-items: flex-end; justify-content: space-between;
  margin-bottom: 16px;
}
.hq-sec-kicker {
  font-size: 11px; font-weight: 800; letter-spacing: 0.08em;
  color: #818cf8; margin-bottom: 4px;
}
.hq-sec-title { font-size: 19px; font-weight: 800; color: #f1f5f9; margin: 0; letter-spacing: -0.01em; }
.hq-sec-link {
  font-size: 11.5px; font-weight: 600; color: #94a3b8;
  text-decoration: none; transition: color 0.15s;
}
.hq-sec-link:hover { color: #a5b4fc; }
.hq-sec-note { margin: 12px 2px 0; font-size: 11px; color: #64748b; line-height: 1.7; }

/* ═══ 我的 AI 员工 ═══ */
.hq-team-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
}
.hq-team-card {
  display: flex; flex-direction: column;
  border-radius: 17px;
  background: rgba(15, 23, 42, 0.78);
  border: 1px solid rgba(71, 85, 105, 0.3);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 10px 30px rgba(2, 6, 23, 0.35);
  overflow: hidden;
  transition: transform 0.2s, border-color 0.2s;
}
.hq-team-card:hover {
  transform: translateY(-3px);
  border-color: rgba(129, 140, 248, 0.45);
}
.hq-card-top {
  display: flex; align-items: center; justify-content: space-between;
  padding: 11px 14px 0;
}
.hq-status {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 9.5px; font-weight: 700;
  border-radius: 999px; padding: 2px 10px;
}
.hq-status.on { color: #34d399; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.32); }
.hq-status.off { color: #94a3b8; background: rgba(71, 85, 105, 0.12); border: 1px solid rgba(71, 85, 105, 0.3); }
.hq-status-dot { width: 6px; height: 6px; border-radius: 50%; }
.hq-status.on .hq-status-dot { background: #34d399; box-shadow: 0 0 6px #34d399; animation: pulse 2s infinite; }
.hq-status.off .hq-status-dot { background: #64748b; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.hq-card-no { font-size: 10px; font-weight: 800; color: #334155; }
.hq-card-body { padding: 12px 14px 10px; display: flex; flex-direction: column; }
.hq-avatar { font-size: 26px; margin-bottom: 4px; }
.hq-name { font-size: 17px; font-weight: 800; color: #f1f5f9; letter-spacing: 0.06em; }
.hq-role { font-size: 11px; font-weight: 700; color: #818cf8; margin-top: 2px; }
.hq-helps { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; }
.hq-help {
  display: flex; align-items: center; gap: 6px;
  font-size: 10.5px; color: #94a3b8;
}
.hq-help-check { color: #34d399; font-weight: 800; }
.hq-card-foot {
  margin-top: auto;
  padding: 10px 14px 14px;
  border-top: 1px solid rgba(71, 85, 105, 0.18);
}
.hq-unlock {
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
.hq-unlock:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(99, 102, 241, 0.35); }
.hq-view {
  display: block; text-align: center;
  padding: 8px 0;
  border-radius: 10px;
  font-size: 11.5px; font-weight: 700;
  color: #a5b4fc;
  border: 1px solid rgba(99, 102, 241, 0.35);
  text-decoration: none;
  transition: background 0.15s;
}
.hq-view:hover { background: rgba(99, 102, 241, 0.1); }

/* ═══ 我的新媒体渠道 ═══ */
.hq-channel-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.hq-channel {
  display: flex; align-items: center; gap: 11px;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(71, 85, 105, 0.28);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: border-color 0.18s, transform 0.15s;
}
.hq-channel:hover { transform: translateY(-2px); border-color: rgba(129, 140, 248, 0.4); }
.hq-channel.connected { border-color: rgba(16, 185, 129, 0.35); cursor: default; }
.hq-channel-ico { font-size: 20px; }
.hq-channel-meta { display: flex; flex-direction: column; flex: 1; }
.hq-channel-name { font-size: 12.5px; font-weight: 700; color: #e2e8f0; }
.hq-channel-plan { font-size: 9.5px; color: #64748b; }
.hq-channel-state {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 9.5px; font-weight: 700;
  color: #64748b;
}
.hq-channel.connected .hq-channel-state { color: #34d399; }
.hq-channel-dot { width: 6px; height: 6px; border-radius: 50%; }
.hq-channel-dot.on { background: #34d399; box-shadow: 0 0 6px #34d399; }
.hq-channel-dot.off { background: #475569; }

/* ═══ 运营情况 ═══ */
.hq-ops-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.hq-ops-card {
  display: flex; align-items: center; gap: 12px;
  padding: 16px 18px;
  border-radius: 15px;
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(71, 85, 105, 0.28);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}
.hq-ops-ico { font-size: 20px; }
.hq-ops-meta { display: flex; flex-direction: column; flex: 1; }
.hq-ops-label { font-size: 11px; color: #94a3b8; }
.hq-ops-num { font-size: 22px; font-weight: 800; color: #f1f5f9; letter-spacing: -0.02em; }
.hq-ops-num--text { font-size: 15px; line-height: 1.6; }
.hq-ops-sub { font-size: 9.5px; color: #64748b; align-self: flex-end; }

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
.sub-modal-title { font-size: 17px; font-weight: 800; color: #f1f5f9; }
.sub-modal-sub { font-size: 11px; color: #64748b; margin-top: 4px; }
.sub-modal-close { background: none; border: none; color: #64748b; font-size: 15px; cursor: pointer; padding: 4px; }
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
.sub-modal-duty, .sub-modal-auto { font-size: 10.5px; color: #94a3b8; line-height: 1.55; }
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
  .hq-team-grid { grid-template-columns: repeat(3, 1fr); }
  .hq-ops-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 900px) {
  .hq-channel-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
