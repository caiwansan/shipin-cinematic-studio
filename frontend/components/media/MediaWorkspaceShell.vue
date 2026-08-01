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
          <div class="mws-brand-name">AI 新媒体运营中心</div>
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
        <!-- SPRINT-MEDIA-IDENTITY-REALITY-FIX-02: 个人运营空间（短剧同款 VIP 卡 + 完整模型设置入口） -->
        <WorkspaceVipCard @open-model-settings="showModelSettings = true" />
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

    <!-- SPRINT-MEDIA-IDENTITY-REALITY-FIX-02: 完整复用短剧 ModelSettingsModal（不传 filterCapability）
         支持语言/图片/视觉理解/视频/TTS/音乐全能力 —— 新媒体不是只有 LLM -->
    <ModelSettingsModal
      :visible="showModelSettings"
      @close="showModelSettings = false"
    />
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
import { ref, computed, onMounted } from 'vue'
import WorkspaceSwitcher from '~/components/WorkspaceSwitcher.vue'
import WorkspaceVipCard from '~/components/workspace/shared/WorkspaceVipCard.vue'
import ModelSettingsModal from '~/components/director/ModelSettingsModal.vue'

const route = useRoute()
const router = useRouter()

const showModelSettings = ref(false)

const goHome = () => router.push('/')

const badgeText = ref('运营中心')

// SPRINT-MEDIA-IDENTITY-REALITY-FIX-02: 导航对齐个人运营空间产品结构（首页/AI团队/内容车间/客户运营/渠道资产/数据分析/行业智能）
const navGroups = [
  {
    label: '运营',
    items: [{ icon: '🏠', label: '首页', path: '/workspace/media/', tag: '' }],
  },
  {
    label: '团队',
    items: [{ icon: '🧑‍💼', label: 'AI 团队', path: '/workspace/media/team', tag: '' }],
  },
  {
    label: '内容',
    items: [{ icon: '🏭', label: '内容车间', path: '/workspace/media/content', tag: '' }],
  },
  {
    label: '客户',
    items: [
      { icon: '💬', label: '客户运营', path: '/workspace/media/messages', tag: '' },
      { icon: '👥', label: '客户资产', path: '/workspace/media/customers', tag: '' },
    ],
  },
  {
    label: '资产',
    items: [
      { icon: '🔗', label: '渠道资产', path: '/workspace/media/accounts', tag: '' },
      { icon: '📊', label: '数据分析', path: '/workspace/media/analytics', tag: '' },
    ],
  },
  {
    label: '智能',
    items: [{ icon: '📡', label: '行业智能', path: '/workspace/media/intelligence', tag: 'NEW' }],
  },
]

function isActive(path: string) {
  const p = path === '/workspace/media/' ? '/workspace/media' : path
  return route.path === p || route.path.startsWith(p + '/')
}

// 员工在线状态（真实数据：overview agents；个人空间=空数组→默认徽章）
// SPRINT-MEDIA-IDENTITY-REALITY-FIX-02: 身份/会员由 WorkspaceVipCard 自加载（短剧同款链），Shell 不再拉企业订阅
onMounted(async () => {
  try {
    const token = getAuthToken()
    if (!token) return
    const res = await fetch('/api/enterprise/media/overview', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data?.code === 0 && data?.data) {
      const agents = data.data.agents || []
      badgeText.value = agents.length ? `AI 团队 ${agents.length} 人` : '个人运营空间'
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
  padding: 0;
  border-top: 1px solid var(--color-border-primary);
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
