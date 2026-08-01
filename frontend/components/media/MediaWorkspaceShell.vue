<!--
  MediaWorkspaceShell — AI 企业经营总部 · 产品级工作空间壳
  Sprint-MEDIA-EXECUTIVE-EXPERIENCE-03（视觉体验重构：数据驾驶舱 → 企业经营总部）
  左栏 = AI 公司总部（品牌 + SaaS 分组导航 + 当前态明显 + 模型/会员/首页入口）
  顶栏 = 当前模块标题 + Live 状态 + 模型快捷入口
  色彩：深墨灰 #0B1020 / 昆仑紫 #7C3AED / 智能蓝 #3B82F6 / 成长绿 #22C55E；金色退场
-->
<template>
  <div class="mws">
    <!-- ═══ 左栏 · AI 公司总部 ═══ -->
    <aside class="mws-side">
      <!-- 品牌 -->
      <div class="mws-brand">
        <div class="mws-brand-logo">AI</div>
        <div class="mws-brand-text">
          <div class="mws-brand-name">AI 经营总部</div>
          <div class="mws-brand-sub">企业操作系统</div>
        </div>
      </div>

      <!-- 导航（SaaS 分组：icon / 名称 / 一句能力解释） -->
      <nav class="mws-nav">
        <NuxtLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="mws-nav-item"
          :class="{ 'is-active': isActive(item.path) }"
          :title="item.hint"
        >
          <span class="mws-nav-icon">{{ item.icon }}</span>
          <span class="mws-nav-text">
            <span class="mws-nav-label">{{ item.label }}</span>
            <span class="mws-nav-hint">{{ item.hint }}</span>
          </span>
          <span v-if="item.tag" class="mws-nav-tag">{{ item.tag }}</span>
        </NuxtLink>
      </nav>

      <!-- 底部：系统入口（模型/渠道/会员/首页，单一入口）+ 用户卡 -->
      <div class="mws-side-foot">
        <div class="mws-side-ops">
          <button class="mws-op" @click="showModelSettings = true"><span class="mws-op-ico">⚙</span>模型中心</button>
          <NuxtLink to="/workspace/media/accounts" class="mws-op"><span class="mws-op-ico">⇄</span>渠道中心</NuxtLink>
          <NuxtLink to="/user/membership" class="mws-op"><span class="mws-op-ico">★</span>会员中心</NuxtLink>
          <NuxtLink to="/" class="mws-op"><span class="mws-op-ico">←</span>昆仑镜首页</NuxtLink>
        </div>
        <div class="mws-side-glow"></div>
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
      <!-- 顶栏（当前模块 + 状态；返回/模型/工作空间已收敛至左栏，单一入口） -->
      <header class="mws-topbar">
        <div class="mws-topbar-left">
          <span class="mws-module-icon">{{ currentModule.icon }}</span>
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

      <!-- 内容区 -->
      <main class="mws-content">
        <slot />
      </main>
    </div>

    <!-- 模型设置：完整复用短剧 ModelSettingsModal（语言/图片/视觉理解/视频/TTS/音乐） -->
    <ModelSettingsModal
      :visible="showModelSettings"
      @close="showModelSettings = false"
    />
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

// 用户身份（复用 /api/member/profile + /api/user/profile，与短剧工作台同源）
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
    // 静默：用户卡保持默认
  }
})

const navItems = [
  { icon: '⌂', label: '经营总部', hint: '我的生意 · AI 经营状态', path: '/workspace/media/' },
  { icon: '♙', label: 'AI员工', hint: '5 名智能员工 · 正在工作', path: '/workspace/media/team' },
  { icon: '✎', label: '内容工厂', hint: '选题 → 创作 → 发布 → 复盘', path: '/workspace/media/content' },
  { icon: '♡', label: '客户中心', hint: '自动回复客户 · 发现销售机会', path: '/workspace/media/messages' },
  { icon: '□', label: '商品经营', hint: '我的线上生意 · 商品与店铺', path: '/workspace/media/shop', tag: '新' },
  { icon: '◫', label: '数据洞察', hint: '内容效果 · 商品销售 · 运营策略', path: '/workspace/media/analytics' },
  { icon: '◌', label: '行业机会', hint: '热点 · 竞品 · 平台规则', path: '/workspace/media/intelligence' },
]

const moduleMap: Record<string, { icon: string; name: string; sub: string }> = {
  '/workspace/media': { icon: '⌂', name: '经营总部', sub: '我的生意 · AI 经营状态' },
  '/workspace/media/team': { icon: '♙', name: 'AI员工', sub: '5 名智能员工 · 正在工作' },
  '/workspace/media/content': { icon: '✎', name: '内容工厂', sub: '选题到发布的内容生产中心' },
  '/workspace/media/messages': { icon: '♡', name: '客户中心', sub: '自动回复客户 · 发现销售机会' },
  '/workspace/media/accounts': { icon: '⇄', name: '渠道中心', sub: '内容平台 · 电商店铺 · 客户渠道' },
  '/workspace/media/shop': { icon: '□', name: '商品经营', sub: '我的线上生意 · 商品与店铺' },
  '/workspace/media/analytics': { icon: '◫', name: '数据洞察', sub: '内容效果 · 商品销售 · 运营策略' },
  '/workspace/media/intelligence': { icon: '◌', name: '行业机会', sub: '热点 · 竞品 · 平台规则' },
}

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

// 员工在线状态（真实数据：overview agents；个人空间=空数组→默认徽章）
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
    // 静默：状态徽章保持默认
  }
})
</script>

<style scoped>
.mws {
  display: flex;
  min-height: 100vh;
  background: var(--media-bg-deep);
  color: var(--media-text-title);
}

/* ── 左栏 · AI 工作空间（白天：白底 + 细边框） ── */
.mws-side {
  width: 232px;
  flex-shrink: 0;
  background: #FFFFFF;
  border-right: 1px solid #E5E7EB;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}
/* 品牌 */
.mws-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 18px 16px;
}
.mws-brand-logo {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--media-brand-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.02em;
  color: #fff;
  font-family: var(--font-mono);
  box-shadow: 0 6px 18px var(--media-brand-glow);
  position: relative;
}
.mws-brand-logo::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.18);
}
.mws-brand-name {
  font-size: 13.5px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: var(--media-text-hero);
}
.mws-brand-sub {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--media-brand-text);
  margin-top: 2px;
}
/* 导航（平铺） */
.mws-nav {
  flex: 1;
  padding: 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.mws-nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px 13px;
  border-radius: var(--media-radius-node);
  color: var(--media-text-body);
  text-decoration: none;
  transition: background 0.18s, color 0.18s, transform 0.12s;
  border: 1px solid transparent;
}
.mws-nav-item:hover {
  background: #F3F4F6;
  color: var(--media-text-title);
}
.mws-nav-item.is-active {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.22);
  color: #4F46E5;
  box-shadow: none;
}
.mws-nav-item.is-active::before {
  content: '';
  position: absolute;
  left: -12px;
  top: 20%;
  bottom: 20%;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: #6366F1;
}
.mws-nav-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.mws-nav-icon {
  font-size: 15px;
  width: 20px;
  text-align: center;
  color: #94A3B8;
  font-weight: 400;
  transition: color 0.18s;
}
.mws-nav-item:hover .mws-nav-icon { color: #64748B; }
.mws-nav-item.is-active .mws-nav-icon {
  color: #6366F1;
}
.mws-nav-label {
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.3;
}
.mws-nav-item.is-active .mws-nav-label {
  font-weight: 800;
}
.mws-nav-hint {
  font-size: 9.5px;
  color: var(--media-text-dim);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.18s;
}
.mws-nav-item:hover .mws-nav-hint,
.mws-nav-item.is-active .mws-nav-hint {
  color: var(--media-ai);
}
.mws-nav-tag {
  font-size: 9px;
  font-weight: 800;
  color: #6366F1;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.28);
  border-radius: 8px;
  padding: 1px 7px;
  letter-spacing: 0.08em;
  align-self: flex-start;
  margin-top: 4px;
}
/* 底部 */
.mws-side-foot {
  position: relative;
  padding: 10px 10px 14px;
  border-top: 1px solid #EEF0F3;
  overflow: hidden;
  z-index: 2;
}
.mws-side-ops {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 6px;
}
.mws-op {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px 12px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #64748B;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}
.mws-op-ico {
  width: 16px;
  text-align: center;
  font-size: 13px;
  color: #94A3B8;
}
.mws-op:hover {
  background: #F3F4F6;
  color: #111827;
}
.mws-side-foot :deep(.w-user-card) {
  position: relative;
  z-index: 2;
  border-top: none;
  padding: 10px 4px 2px;
}
.mws-side-foot :deep(.wuc-avatar) {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  font-size: 14px;
  background: linear-gradient(135deg, #6366F1, #4F46E5);
}
.mws-side-foot :deep(.wuc-name) {
  color: #111827;
}
.mws-side-foot :deep(.wuc-org) {
  color: #9CA3AF;
}
.mws-side-foot :deep(.wuc-plan-row) {
  background: rgba(99, 102, 241, 0.07);
  border: 1px solid rgba(99, 102, 241, 0.22);
  border-radius: var(--media-radius-pill);
  padding: 3px 12px;
}
.mws-side-foot :deep(.wuc-plan-dot) {
  background: #6366F1;
}
.mws-side-foot :deep(.wuc-plan-name) {
  color: #4F46E5;
}
.mws-side-foot :deep(.wuc-btn) {
  border: 1px solid #E5E7EB;
  background: #FFFFFF;
  color: #64748B;
  border-radius: var(--media-radius-node);
}
.mws-side-foot :deep(.wuc-btn:hover) {
  border-color: rgba(99, 102, 241, 0.4);
  color: #4F46E5;
  background: rgba(99, 102, 241, 0.06);
}
.mws-side-glow {
  display: none;
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
  padding: 10px 32px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid #E5E7EB;
  position: sticky;
  top: 0;
  z-index: 10;
}
.mws-topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.mws-module-icon {
  font-size: 15px;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6366F1;
}
.mws-module-name {
  display: block;
  font-size: 14px;
  font-weight: 800;
  color: #111827;
  letter-spacing: -0.01em;
}
.mws-module-sub {
  display: block;
  font-size: 11px;
  color: #9CA3AF;
  margin-top: 1px;
}
.mws-topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.mws-live {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 700;
  color: #059669;
  letter-spacing: 0.06em;
  background: rgba(5, 150, 105, 0.07);
  border: 1px solid rgba(5, 150, 105, 0.22);
  border-radius: var(--media-radius-pill);
  padding: 4px 12px;
}
.mws-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10B981;
  animation: mws-breathe 1.8s infinite;
}
@keyframes mws-breathe {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
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
