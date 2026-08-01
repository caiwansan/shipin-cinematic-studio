<!--
  MediaWorkspaceShell — AI 新媒体运营部 · 产品级工作台壳（Sprint-MEDIA-UX-03）
  企业级 SaaS 布局：暗色分组侧栏 + 部门状态顶栏 + 内容区
  全部引用 Enterprise Design Tokens（CTO Frozen），不造新设计体系
-->
<template>
  <div class="mws">
    <!-- ═══ 左侧导航 ═══ -->
    <aside class="mws-side">
      <div class="mws-brand">
        <div class="mws-brand-logo">📣</div>
        <div class="mws-brand-text">
          <div class="mws-brand-name">新媒体运营部</div>
          <div class="mws-brand-sub">AI Media Ops</div>
        </div>
      </div>

      <nav class="mws-nav">
        <div v-for="group in navGroups" :key="group.label" class="mws-nav-group">
          <div class="mws-nav-group-label">{{ group.label }}</div>
          <NuxtLink
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            class="mws-nav-item"
            :class="{ 'is-active': isActive(item.path) }"
          >
            <span class="mws-nav-icon">{{ item.icon }}</span>
            <span class="mws-nav-label">{{ item.label }}</span>
            <span v-if="item.tag" class="mws-nav-tag">{{ item.tag }}</span>
          </NuxtLink>
        </div>
      </nav>

      <div class="mws-side-foot">
        <div class="mws-foot-dot" :class="{ online: teamOnline }"></div>
        <div class="mws-foot-text">
          <div class="mws-foot-title">{{ teamOnline ? 'AI 员工工作中' : 'AI 员工待部署' }}</div>
          <div class="mws-foot-sub">{{ agentsOnline }}/{{ agentsTotal }} 在线</div>
        </div>
      </div>
    </aside>

    <!-- ═══ 主区 ═══ -->
    <div class="mws-main">
      <!-- 顶栏 -->
      <header class="mws-topbar">
        <div class="mws-topbar-left">
          <button class="mws-back" @click="goHome">←</button>
          <span class="mws-crumb">工作台 / 新媒体运营</span>
        </div>
        <div class="mws-topbar-right">
          <span class="mws-live">
            <span class="mws-live-dot"></span>
            Live
          </span>
          <span class="mws-badge">{{ badgeText }}</span>
          <WorkspaceSwitcher />
        </div>
      </header>

      <!-- 内容区 -->
      <main class="mws-content">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import WorkspaceSwitcher from '~/components/WorkspaceSwitcher.vue'

const route = useRoute()
const router = useRouter()

const goHome = () => router.push('/')

const badgeText = ref('运营中心')
const agentsTotal = ref(0)
const agentsOnline = ref(0)
const teamOnline = computed(() => agentsOnline.value > 0)

// 分组导航：对应产品结构（AI员工团队 → 账号资产 → 内容生产 → 客户运营 → 商业结果）
const navGroups = [
  {
    label: '运营',
    items: [{ icon: '🏠', label: '运营总览', path: '/workspace/media/', tag: '' }],
  },
  {
    label: '内容',
    items: [{ icon: '🏭', label: '内容工厂', path: '/workspace/media/content', tag: '' }],
  },
  {
    label: '客户',
    items: [
      { icon: '💬', label: '消息互动', path: '/workspace/media/messages', tag: '' },
      { icon: '👥', label: '客户资产', path: '/workspace/media/customers', tag: '' },
    ],
  },
  {
    label: '智能',
    items: [{ icon: '📡', label: '行业智能', path: '/workspace/media/intelligence', tag: 'NEW' }],
  },
  {
    label: '组织',
    items: [
      { icon: '🧑‍💼', label: 'AI 员工团队', path: '/workspace/media/team', tag: '' },
      { icon: '🔗', label: '新媒体资产', path: '/workspace/media/accounts', tag: '' },
    ],
  },
  {
    label: '数据',
    items: [{ icon: '📊', label: '数据分析', path: '/workspace/media/analytics', tag: '' }],
  },
]

function isActive(path: string) {
  const p = path === '/workspace/media/' ? '/workspace/media' : path
  return route.path === p || route.path.startsWith(p + '/')
}

// 员工在线状态（真实数据：overview agents）
onMounted(async () => {
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || ''
    const res = await fetch('/api/enterprise/media/overview', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data?.code === 0 && data?.data) {
      const agents = data.data.agents || []
      agentsTotal.value = agents.length
      agentsOnline.value = agents.filter((a: any) => a.lifecycleState === 'ACTIVE').length
      badgeText.value = agents.length ? 'AI 部门运行中' : '待部署 AI 员工'
    }
  } catch {
    // 静默：状态徽章保持默认
  }
})
</script>

<style scoped>
.mws {
  display: flex;
  min-height: 100vh;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

/* ── 侧栏 ── */
.mws-side {
  width: 224px;
  flex-shrink: 0;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border-primary);
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}
.mws-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 16px 14px;
  border-bottom: 1px solid var(--color-border-primary);
}
.mws-brand-logo {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--color-intelligence), var(--color-decision));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  box-shadow: 0 4px 14px var(--color-intelligence-glow);
}
.mws-brand-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.mws-brand-sub {
  font-size: 10px;
  color: var(--color-text-muted);
  letter-spacing: 0.06em;
}
.mws-nav {
  flex: 1;
  padding: 12px 10px;
}
.mws-nav-group {
  margin-bottom: 14px;
}
.mws-nav-group-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-disabled);
  padding: 6px 10px;
}
.mws-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 10px;
  font-size: 13px;
  color: var(--color-text-secondary);
  text-decoration: none;
  margin-bottom: 2px;
  transition: background 0.15s, color 0.15s;
}
.mws-nav-item:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}
.mws-nav-item.is-active {
  background: var(--color-intelligence-glow);
  color: var(--color-text-primary);
  font-weight: 600;
  box-shadow: inset 2px 0 0 var(--color-intelligence);
}
.mws-nav-icon {
  font-size: 14px;
  width: 20px;
  text-align: center;
}
.mws-nav-tag {
  margin-left: auto;
  font-size: 9px;
  font-weight: 800;
  color: var(--color-intelligence);
  background: var(--color-intelligence-glow);
  border-radius: 8px;
  padding: 1px 6px;
  letter-spacing: 0.06em;
}
.mws-side-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-top: 1px solid var(--color-border-primary);
}
.mws-foot-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--color-text-disabled);
  box-shadow: 0 0 0 3px rgba(100, 116, 139, 0.15);
}
.mws-foot-dot.online {
  background: var(--color-execution);
  box-shadow: 0 0 0 3px var(--color-execution-glow);
  animation: breathe 2.4s infinite;
}
@keyframes breathe {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.mws-foot-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.mws-foot-sub {
  font-size: 10px;
  color: var(--color-text-muted);
}

/* ── 主区 ── */
.mws-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.mws-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 28px;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border-primary);
  position: sticky;
  top: 0;
  z-index: 10;
}
.mws-topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.mws-back {
  border: 1px solid var(--color-border-primary);
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 8px;
  width: 28px;
  height: 28px;
  cursor: pointer;
  font-size: 13px;
}
.mws-back:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}
.mws-crumb {
  font-size: 12px;
  color: var(--color-text-muted);
}
.mws-topbar-right {
  display: flex;
  align-items: center;
  gap: 14px;
}
.mws-live {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-execution);
  letter-spacing: 0.06em;
}
.mws-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-execution);
  box-shadow: 0 0 8px var(--color-execution);
  animation: breathe 1.6s infinite;
}
.mws-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-bg-hover);
  border: 1px solid var(--color-border-primary);
  border-radius: 20px;
  padding: 4px 12px;
}
.mws-content {
  flex: 1;
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
  padding: 28px 32px 60px;
}
@media (max-width: 860px) {
  .mws-side { display: none; }
  .mws-content { padding: 20px 16px 48px; }
}
</style>
