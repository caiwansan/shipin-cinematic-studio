<!--
  MediaWorkspaceShell — AI 新媒体运营中心 · 产品级工作空间壳
  Sprint-MEDIA-DESIGN-SYSTEM-01（世界级 UI 重构）
  左栏 = AI 工作空间（品牌 + 平铺导航 + 当前态明显 + VIP/模型）
  顶栏 = 当前模块标题 + Live 状态 + 模型快捷入口
  全部基于 Kunlun Token + Media Design Language（media-tokens.css）
-->
<template>
  <div class="mws">
    <!-- ═══ 左栏 · AI 工作空间 ═══ -->
    <aside class="mws-side">
      <!-- 品牌 -->
      <div class="mws-brand">
        <div class="mws-brand-logo">AI</div>
        <div class="mws-brand-text">
          <div class="mws-brand-name">AI MEDIA</div>
          <div class="mws-brand-sub">OPERATIONS</div>
        </div>
      </div>

      <!-- 导航（平铺 · 产品化） -->
      <nav class="mws-nav">
        <NuxtLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="mws-nav-item"
          :class="{ 'is-active': isActive(item.path) }"
        >
          <span class="mws-nav-icon">{{ item.icon }}</span>
          <span class="mws-nav-label">{{ item.label }}</span>
          <span v-if="item.tag" class="mws-nav-tag">{{ item.tag }}</span>
        </NuxtLink>
      </nav>

      <!-- 底部氛围 + 用户卡 -->
      <div class="mws-side-foot">
        <div class="mws-side-glow"></div>
        <WorkspaceVipCard @open-model-settings="showModelSettings = true" />
      </div>
    </aside>

    <!-- ═══ 主区 ═══ -->
    <div class="mws-main">
      <!-- 顶栏（产品化：当前模块名 + 实时状态） -->
      <header class="mws-topbar">
        <div class="mws-topbar-left">
          <span class="mws-module-icon">{{ currentModule.icon }}</span>
          <div class="mws-module-text">
            <span class="mws-module-name">{{ currentModule.name }}</span>
            <span class="mws-module-sub">{{ currentModule.sub }}</span>
          </div>
        </div>
        <div class="mws-topbar-right">
          <button class="mws-model-btn" @click="showModelSettings = true">
            <span class="mws-model-dot"></span>
            模型设置
          </button>
          <span class="mws-live">
            <span class="mws-live-dot"></span>
            {{ badgeText }}
          </span>
          <WorkspaceSwitcher />
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
import WorkspaceSwitcher from '~/components/WorkspaceSwitcher.vue'
import WorkspaceVipCard from '~/components/workspace/shared/WorkspaceVipCard.vue'
import ModelSettingsModal from '~/components/director/ModelSettingsModal.vue'

const route = useRoute()
const router = useRouter()

const showModelSettings = ref(false)
const badgeText = ref('Live')

const navItems = [
  { icon: '🏠', label: '首页', path: '/workspace/media/', tag: '' },
  { icon: '🤖', label: 'AI 团队', path: '/workspace/media/team', tag: '' },
  { icon: '🏭', label: '内容车间', path: '/workspace/media/content', tag: '' },
  { icon: '💬', label: '客户运营', path: '/workspace/media/messages', tag: '' },
  { icon: '🌐', label: '渠道资产', path: '/workspace/media/accounts', tag: '' },
  { icon: '📊', label: '数据分析', path: '/workspace/media/analytics', tag: '' },
  { icon: '🧠', label: '行业智能', path: '/workspace/media/intelligence', tag: 'NEW' },
]

const moduleMap: Record<string, { icon: string; name: string; sub: string }> = {
  '/workspace/media': { icon: '🏠', name: '运营总览', sub: 'AI 新媒体运营总控中心' },
  '/workspace/media/team': { icon: '🤖', name: 'AI 团队', sub: '你的 AI 新媒体运营团队' },
  '/workspace/media/content': { icon: '🏭', name: '内容车间', sub: 'AI Content Factory' },
  '/workspace/media/messages': { icon: '💬', name: '客户运营', sub: 'AI Inbox · 客户运营中心' },
  '/workspace/media/accounts': { icon: '🌐', name: '渠道资产', sub: '媒体账号资产管理' },
  '/workspace/media/analytics': { icon: '📊', name: '数据分析', sub: '内容 · 粉丝 · 互动' },
  '/workspace/media/intelligence': { icon: '🧠', name: '行业智能', sub: '热点 · 竞品 · 规则 · 机会' },
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

/* ── 左栏 · AI 工作空间 ── */
.mws-side {
  width: 232px;
  flex-shrink: 0;
  background: linear-gradient(180deg, #0B1020 0%, var(--color-bg-secondary) 60%, #0A0E1E 100%);
  border-right: 1px solid var(--color-border-primary);
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
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: var(--media-text-hero);
  font-family: var(--font-mono);
}
.mws-brand-sub {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.34em;
  color: var(--media-brand-text);
  margin-top: 2px;
  font-family: var(--font-mono);
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
  gap: 12px;
  padding: 11px 14px;
  border-radius: var(--media-radius-node);
  font-size: 13.5px;
  color: var(--media-text-body);
  text-decoration: none;
  transition: background 0.18s, color 0.18s, transform 0.12s;
  border: 1px solid transparent;
}
.mws-nav-item:hover {
  background: rgba(51, 65, 85, 0.35);
  color: var(--media-text-title);
  transform: translateX(2px);
}
.mws-nav-item.is-active {
  background: linear-gradient(90deg, var(--media-ai-glow), rgba(59, 130, 246, 0.08));
  border-color: var(--media-ai-border);
  color: var(--media-text-hero);
  font-weight: 700;
  box-shadow: 0 4px 16px rgba(2, 6, 23, 0.35);
}
.mws-nav-item.is-active::before {
  content: '';
  position: absolute;
  left: -12px;
  top: 20%;
  bottom: 20%;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--media-brand-gradient);
  box-shadow: 0 0 10px var(--media-brand-glow);
}
.mws-nav-icon {
  font-size: 15px;
  width: 22px;
  text-align: center;
  filter: saturate(0.9);
}
.mws-nav-item.is-active .mws-nav-icon {
  filter: saturate(1.2) drop-shadow(0 0 6px var(--media-brand-glow));
}
.mws-nav-label {
  flex: 1;
}
.mws-nav-tag {
  font-size: 9px;
  font-weight: 800;
  color: var(--media-ai);
  background: var(--media-ai-glow);
  border: 1px solid var(--media-ai-border);
  border-radius: 8px;
  padding: 1px 7px;
  letter-spacing: 0.08em;
}
/* 底部 */
.mws-side-foot {
  position: relative;
  padding: 12px 10px 14px;
  border-top: 1px solid rgba(71, 85, 105, 0.25);
  overflow: hidden;
}
.mws-side-glow {
  position: absolute;
  top: -30px;
  left: 20%;
  width: 200px;
  height: 90px;
  background: radial-gradient(ellipse, var(--media-hero-glow-1), transparent 70%);
  pointer-events: none;
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
  padding: 14px 32px;
  background: rgba(7, 11, 22, 0.82);
  backdrop-filter: blur(10px);
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
.mws-module-icon {
  font-size: 20px;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--media-brand-soft);
  border: 1px solid var(--media-ai-border);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(2, 6, 23, 0.4);
}
.mws-module-name {
  display: block;
  font-size: 15px;
  font-weight: 800;
  color: var(--media-text-hero);
  letter-spacing: -0.01em;
}
.mws-module-sub {
  display: block;
  font-size: 11px;
  color: var(--media-text-dim);
  margin-top: 1px;
}
.mws-topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.mws-model-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 600;
  color: var(--media-text-body);
  background: var(--color-bg-hover);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--media-radius-pill);
  padding: 7px 14px;
  cursor: pointer;
  transition: all 0.15s;
}
.mws-model-btn:hover {
  color: var(--media-text-title);
  border-color: var(--media-ai-border);
  background: var(--media-ai-glow);
}
.mws-model-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--media-ai);
  box-shadow: 0 0 8px var(--media-ai);
}
.mws-live {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-execution);
  letter-spacing: 0.06em;
  background: var(--color-execution-glow);
  border: 1px solid rgba(16, 185, 129, 0.25);
  border-radius: var(--media-radius-pill);
  padding: 5px 12px;
}
.mws-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-execution);
  box-shadow: 0 0 8px var(--color-execution);
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
