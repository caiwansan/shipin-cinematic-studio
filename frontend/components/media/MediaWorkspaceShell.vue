<!--
  MediaWorkspaceShell v2 — 昆仑镜 · AI 经营总部（Design System v1 · Dark Variant）
  SPRINT-MEDIA-DESIGN-DARK-THEME-06：
  - 结构/信息架构/导航体系完全保留 Design System v1（Dark Theme Variant，不推翻）
  - 色系：80% 深色空间（#0B1220/#111827/#162033）+ 15% 蓝青数据（#3B82F6/#22D3EE）+ 5% AI 紫（#8B5CF6 仅员工身份）
  - 品牌区：昆仑镜 / AI 经营总部；分组导航：经营总览 8 + 系统 3；SVG 线性图标
  - .mws 作用域覆盖 --color-* 深色统一值 → 子页自动对齐，短剧/招聘/企业工作台零影响
-->
<template>
  <div class="mws">
    <!-- ═══ 左栏 ═══ -->
    <aside class="mws-side">
      <!-- 品牌区 -->
      <div class="mws-brand">
        <span class="mws-brand-logo">K</span>
        <div class="mws-brand-text">
          <b class="mws-brand-name">昆仑镜</b>
          <span class="mws-brand-sub">AI 经营总部</span>
        </div>
      </div>

      <!-- 经营总览 -->
      <nav class="mws-nav">
        <div class="mws-nav-group">经营</div>
        <NuxtLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="mws-nav-item"
          :class="{ 'is-active': isActive(item.path) }"
        >
          <span class="mws-nav-icon" v-html="item.icon"></span>
          <span class="mws-nav-label">{{ item.label }}</span>
          <span v-if="item.tag" class="mws-nav-tag">{{ item.tag }}</span>
        </NuxtLink>
      </nav>

      <!-- 底部系统区（单一入口）+ 用户卡 -->
      <div class="mws-side-foot">
        <div class="mws-nav-group">系统</div>
        <div class="mws-side-ops">
          <button class="mws-op" @click="showModelSettings = true"><span class="mws-op-ico" v-html="icons.model"></span>模型中心</button>
          <NuxtLink to="/user/membership" class="mws-op"><span class="mws-op-ico" v-html="icons.member"></span>我的会员</NuxtLink>
          <NuxtLink to="/" class="mws-op"><span class="mws-op-ico" v-html="icons.home"></span>返回昆仑镜</NuxtLink>
        </div>
        <WorkspaceUserCard
          :username="userName"
          :display-name="displayName"
          :org-name="orgName"
          :plan-name="planName"
          hide-model-entry
          @open-billing="goMembership"
        />
      </div>
    </aside>

    <!-- ═══ 主区 ═══ -->
    <div class="mws-main">
      <header class="mws-topbar">
        <div class="mws-topbar-left">
          <span class="mws-module-icon" v-html="currentModule.icon"></span>
          <div class="mws-module-text">
            <span class="mws-module-name">{{ currentModule.name }}</span>
            <span class="mws-module-sub">{{ currentModule.sub }}</span>
          </div>
        </div>
        <div class="mws-topbar-right">
          <span class="mws-live">
            <span class="mws-live-dot"></span>
            {{ badgeText }}
          </span>
        </div>
      </header>
      <main class="mws-content">
        <slot />
      </main>
    </div>

    <ModelSettingsModal v-if="showModelSettings" @close="showModelSettings = false" />
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
import { ref, computed, onMounted } from 'vue'
import WorkspaceUserCard from '~/components/workspace/shared/WorkspaceUserCard.vue'
import ModelSettingsModal from '~/components/director/ModelSettingsModal.vue'

const route = useRoute()
const router = useRouter()

const showModelSettings = ref(false)
const badgeText = ref('Live')

const userName = ref('昆仑镜用户')
const displayName = ref('')
const orgName = ref('')
const planName = ref('')

function goMembership() {
  router.push('/user/membership')
}

onMounted(async () => {
  try {
    const token = getAuthToken()
    if (!token) return
    const [memberRes, userRes] = await Promise.all([
      fetch('/api/member/profile', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/user/profile', { headers: { Authorization: `Bearer ${token}` } }),
    ])
    const member = await memberRes.json()
    const user = await userRes.json()
    const m = member?.data || member || {}
    const u = user?.data || user || {}
    planName.value = m.membership?.tierLabel || m.tierLabel || m.memberTierLabel || ''
    userName.value = u.username || m.email?.split('@')[0] || '昆仑镜用户'
    displayName.value = u.name || u.username || userName.value
    orgName.value = u.organizationName || u.orgName || ''
  } catch {
    // 静默
  }
})

/* ── SVG 线性图标（Design System v1 · 第 4 节保留）── */
const S = (path: string) =>
  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`

const icons = {
  cockpit: S('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  staff: S('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M19 3l.6 1.4L21 5l-1.4.6L19 7l-.6-1.4L17 5l1.4-.6z"/>'),
  content: S('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  customer: S('<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-4.7a8.5 8.5 0 1 1 16.1-4.8z"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"/>'),
  shop: S('<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M16 10a4 4 0 0 1-8 0"/>'),
  channel: S('<circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="5" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M7.4 10.9L16.6 6M7.4 13.1L16.6 18"/>'),
  data: S('<path d="M3 20V10M9 20V4M15 20v-7M21 20V7"/>'),
  insight: S('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>'),
  model: S('<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 2v3M14 2v3M10 19v3M14 19v3M2 10h3M2 14h3M19 10h3M19 14h3"/>'),
  member: S('<path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.9L6.6 19.6l1-6L3.3 9.4l6-.9z"/>'),
  home: S('<path d="M19 12H5M12 19l-7-7 7-7"/>'),
}

const navItems = [
  { icon: icons.cockpit, label: '生意驾驶舱', path: '/workspace/media/', sub: '我的生意 · 经营状态' },
  { icon: icons.staff, label: 'AI员工', path: '/workspace/media/team', sub: '我的 AI 管理团队' },
  { icon: icons.content, label: '内容中心', path: '/workspace/media/content', sub: '选题到发布的内容生产' },
  { icon: icons.customer, label: '客户中心', path: '/workspace/media/messages', sub: '自动回复客户 · 销售机会' },
  { icon: icons.shop, label: '商品中心', path: '/workspace/media/shop', sub: '我的线上生意', tag: '新' },
  { icon: icons.channel, label: '渠道中心', path: '/workspace/media/accounts', sub: '内容 · 电商 · 客户渠道' },
  { icon: icons.data, label: '数据智能', path: '/workspace/media/analytics', sub: '内容效果 · 经营分析' },
  { icon: icons.insight, label: '行业机会', path: '/workspace/media/intelligence', sub: '热点 · 竞品 · 平台规则' },
]

const moduleMap: Record<string, { icon: string; name: string; sub: string }> = Object.fromEntries(
  navItems.map(n => [n.path.replace(/\/$/, ''), { icon: n.icon, name: n.label, sub: n.sub }])
)

const currentModule = computed(() => {
  const p = route.path
  const key = Object.keys(moduleMap)
    .filter(k => p === k || p.startsWith(k + '/'))
    .sort((a, b) => b.length - a.length)[0]
  return moduleMap[key] || moduleMap['/workspace/media']
})

function isActive(path: string) {
  const p = path === '/workspace/media/' ? '/workspace/media' : path
  return route.path === p || route.path.startsWith(p + '/')
}

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
      badgeText.value = agents.length ? `${agents.length} 名 AI 在线` : 'AI 团队待启动'
    }
  } catch {
    // 静默
  }
})
</script>

<style scoped>
/* ═══════ Dark Variant · Kunlun Executive Dark v2 ═══════
   80% 深色空间（#0B1220 夜晚办公室）+ 15% 蓝青数据（昆仑蓝 #3B82F6 / AI 青 #22D3EE）+ 5% AI 紫 #8B5CF6 */
.mws {
  display: flex;
  min-height: 100vh;
  background: var(--media-bg-deep);
  color: #F1F5F9;
}

/* ── 左栏（深色面板） ── */
.mws-side {
  width: 228px;
  flex-shrink: 0;
  background: #0E1626;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
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
  gap: 11px;
  padding: 18px 16px 14px;
}
.mws-brand-logo {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 900;
  letter-spacing: 0.02em;
  color: #fff;
  font-family: var(--font-mono);
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.35);
}
.mws-brand-text { display: flex; flex-direction: column; gap: 1px; }
.mws-brand-name {
  font-size: 14.5px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #F8FAFC;
  line-height: 1.2;
}
.mws-brand-sub {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #22D3EE;
}

/* ── 分组导航 ── */
.mws-nav {
  flex: 1;
  padding: 4px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mws-nav-group {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #475569;
  padding: 12px 10px 6px;
}
.mws-nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 11px;
  border-radius: 9px;
  color: #94A3B8;
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
  border: 1px solid transparent;
}
.mws-nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #F1F5F9;
}
.mws-nav-item.is-active {
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(59, 130, 246, 0.3);
  color: #60A5FA;
}
.mws-nav-item.is-active::before {
  content: '';
  position: absolute;
  left: -12px;
  top: 22%;
  bottom: 22%;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: #3B82F6;
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
}
.mws-nav-icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748B;
  flex-shrink: 0;
  transition: color 0.15s;
}
.mws-nav-icon :deep(svg) { display: block; }
.mws-nav-item:hover .mws-nav-icon { color: #94A3B8; }
.mws-nav-item.is-active .mws-nav-icon { color: #3B82F6; }
.mws-nav-label { flex: 1; font-size: 13px; font-weight: 600; line-height: 1.3; }
.mws-nav-item.is-active .mws-nav-label { font-weight: 800; }
.mws-nav-tag {
  font-size: 9px;
  font-weight: 800;
  color: #22D3EE;
  background: rgba(34, 211, 238, 0.1);
  border: 1px solid rgba(34, 211, 238, 0.3);
  border-radius: 8px;
  padding: 1px 7px;
  letter-spacing: 0.08em;
}

/* ── 底部系统区 ── */
.mws-side-foot {
  position: relative;
  padding: 6px 12px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
  z-index: 2;
}
.mws-side-ops {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 4px;
}
.mws-op {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 11px;
  border-radius: 9px;
  border: none;
  background: transparent;
  color: #94A3B8;
  font-size: 12.5px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}
.mws-op-ico {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748B;
  flex-shrink: 0;
}
.mws-op-ico :deep(svg) { display: block; }
.mws-op:hover { background: rgba(255, 255, 255, 0.05); color: #F1F5F9; }
.mws-op:hover .mws-op-ico { color: #94A3B8; }

/* 用户卡（Dark 覆盖） */
.mws-side-foot :deep(.w-user-card) {
  position: relative;
  z-index: 2;
  border-top: none;
  padding: 8px 4px 2px;
}
.mws-side-foot :deep(.wuc-avatar) {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  font-size: 13px;
  background: linear-gradient(135deg, #3B82F6, #2563EB);
}
.mws-side-foot :deep(.wuc-name) { color: #F1F5F9; }
.mws-side-foot :deep(.wuc-org) { color: #64748B; }
.mws-side-foot :deep(.wuc-plan-row) {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: var(--media-radius-pill);
  padding: 3px 12px;
}
.mws-side-foot :deep(.wuc-plan-dot) { background: #22D3EE; }
.mws-side-foot :deep(.wuc-plan-name) { color: #60A5FA; }
.mws-side-foot :deep(.wuc-btn) {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: #111827;
  color: #94A3B8;
  border-radius: var(--media-radius-node);
}
.mws-side-foot :deep(.wuc-btn:hover) {
  border-color: rgba(59, 130, 246, 0.5);
  color: #60A5FA;
  background: rgba(59, 130, 246, 0.08);
}

/* ── 主区 ── */
.mws-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.mws-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 32px;
  background: rgba(11, 18, 32, 0.85);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  position: sticky;
  top: 0;
  z-index: 10;
}
.mws-topbar-left { display: flex; align-items: center; gap: 12px; }
.mws-module-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3B82F6;
}
.mws-module-icon :deep(svg) { display: block; }
.mws-module-name { display: block; font-size: 14px; font-weight: 800; color: #F1F5F9; letter-spacing: -0.01em; }
.mws-module-sub { display: block; font-size: 11px; color: #64748B; margin-top: 1px; }
.mws-topbar-right { display: flex; align-items: center; gap: 12px; }
.mws-live {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 700;
  color: #34D399;
  letter-spacing: 0.06em;
  background: rgba(52, 211, 153, 0.08);
  border: 1px solid rgba(52, 211, 153, 0.25);
  border-radius: var(--media-radius-pill);
  padding: 4px 12px;
}
.mws-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #34D399;
  animation: mws-breathe 1.8s infinite;
}
@keyframes mws-breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
.mws-content {
  flex: 1;
  max-width: 1320px;
  width: 100%;
  margin: 0 auto;
  padding: var(--media-pad-page) 36px 72px;
}
@media (max-width: 860px) {
  .mws-side { display: none; }
  .mws-content { padding: 20px 16px 56px; }
}
</style>
