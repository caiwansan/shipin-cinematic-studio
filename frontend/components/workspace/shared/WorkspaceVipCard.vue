<!--
  WorkspaceVipCard.vue — 左侧导航底部个人会员卡 + AI 模型设置入口
  SPRINT-MEDIA-IDENTITY-REALITY-FIX-02: 短剧工作台同款 VIP 卡（PipelineSidebar 逻辑复刻）
  - 数据源: /api/member/profile（会员层级/积分/到期日）+ /api/user/profile（用户名）
  - 个人身份模型：新媒体工作台 = 昆仑镜用户个人运营空间（非企业部门）
  - 交互: 免费 → 升级 VIP（/user/membership）；付费 → 个人中心（/user/center）
-->
<template>
  <div class="wvc">
    <!-- 会员卡片（短剧同款：头像 / 用户名 / VIP 状态） -->
    <div v-if="planInfo" class="wvc-vip-wrapper" @click="handleCardClick">
      <div class="wvc-vip-card" :style="vipCardStyle">
        <div class="wvc-vip-bg" :style="{ background: vipInfo?.gradient }" />
        <div class="wvc-vip-glow" :style="{ background: vipInfo?.glowColor }" />
        <div class="wvc-vip-content">
          <div class="wvc-vip-left">
            <div class="wvc-vip-avatar" :style="{ background: vipInfo?.gradient }">{{ avatarChar }}</div>
          </div>
          <div class="wvc-vip-right">
            <div class="wvc-vip-top">
              <span class="wvc-vip-tier-icon">{{ vipInfo?.icon }}</span>
              <span class="wvc-vip-tier-name" :style="{ color: vipInfo?.color }">{{ vipInfo?.label || planLabel }}</span>
            </div>
            <div class="wvc-vip-user">{{ displayName }}</div>
            <div class="wvc-vip-expiry">
              <span class="wvc-expiry-label">到期日:</span>
              <span class="wvc-expiry-date">{{ formattedExpiry }}</span>
            </div>
            <template v-if="planClass === 'free'">
              <button class="wvc-vip-upgrade" @click.stop="goUpgrade">升级 VIP</button>
            </template>
            <template v-else>
              <div class="wvc-vip-entrance" @click.stop="goUserCenter">
                <span class="wvc-entrance-text">进入个人中心 →</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="wvc-vip-wrapper" @click="goLogin">
      <div class="wvc-vip-card wvc-guest">
        <div class="wvc-vip-content">
          <div class="wvc-vip-left">
            <div class="wvc-vip-avatar wvc-guest-avatar">👤</div>
          </div>
          <div class="wvc-vip-right">
            <div class="wvc-vip-top"><span class="wvc-vip-tier-name">未登录</span></div>
            <div class="wvc-vip-sub">点击登录 / 注册</div>
          </div>
        </div>
      </div>
    </div>

    <!-- AI 模型设置入口（语言/图片/视频/多模态等全部能力） -->
    <button class="wvc-model-btn" @click="$emit('open-model-settings')">
      <span class="wvc-model-icon">🤖</span>
      <span class="wvc-model-text">
        <span class="wvc-model-title">AI 模型设置</span>
        <span class="wvc-model-desc">语言 / 图片 / 视频 / 多模态</span>
      </span>
      <span class="wvc-model-arrow">⚙️</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getAuthToken } from '~/utils/auth/token'

defineEmits<{ 'open-model-settings': [] }>()

const planInfo = ref<any>(null)
const userInfo = ref<any>(null)

const displayName = computed(() => {
  if (userInfo.value?.name) return userInfo.value.name
  if (userInfo.value?.username) return userInfo.value.username
  if (planInfo.value?.email) return planInfo.value.email.split('@')[0]
  return '昆仑镜用户'
})

const avatarChar = computed(() => {
  const n = displayName.value
  return n ? n.charAt(0).toUpperCase() : 'U'
})

const planClass = computed(() => {
  if (!planInfo.value) return 'free'
  return (planInfo.value.membership?.tier || planInfo.value.memberTier || 'free').toLowerCase()
})

const planLabel = computed(() => planInfo.value?.membership?.tierLabel || planInfo.value?.tierLabel || '会员')

const formattedExpiry = computed(() => {
  if (!planInfo.value?.expiresAt) return '永久'
  try {
    return new Date(planInfo.value.expiresAt).toLocaleDateString('zh-CN')
  } catch {
    return planInfo.value.expiresAt
  }
})

const vipInfo = computed(() => {
  const MAP: Record<string, { label: string; icon: string; color: string; gradient: string; glowColor: string }> = {
    free: { label: '免费用户', icon: '🆓', color: '#9ca3af', gradient: 'linear-gradient(135deg, #374151, #4b5563)', glowColor: 'rgba(107,114,128,0.15)' },
    trial: { label: '新人体验卡', icon: '🎁', color: '#F59E0B', gradient: 'linear-gradient(135deg, #F59E0B, #fcd34d)', glowColor: 'rgba(245,158,11,0.2)' },
    basic: { label: '基础版', icon: '⭐', color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)', glowColor: 'rgba(59,130,246,0.2)' },
    pro: { label: '本地版', icon: '💻', color: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #c084fc)', glowColor: 'rgba(168,85,247,0.2)' },
    enterprise: { label: '年卡', icon: '👑', color: '#22c55e', gradient: 'linear-gradient(135deg, #22c55e, #4ade80)', glowColor: 'rgba(34,197,94,0.2)' },
    gold: { label: '黄金会员', icon: '⭐', color: '#D4AF37', gradient: 'linear-gradient(135deg, #D4AF37, #fbbf24)', glowColor: 'rgba(212,175,55,0.2)' },
    premium: { label: '黄金会员', icon: '⭐', color: '#D4AF37', gradient: 'linear-gradient(135deg, #D4AF37, #fbbf24)', glowColor: 'rgba(212,175,55,0.2)' },
    vip: { label: '黄金会员', icon: '⭐', color: '#D4AF37', gradient: 'linear-gradient(135deg, #D4AF37, #fbbf24)', glowColor: 'rgba(212,175,55,0.25)' },
    Pro: { label: '钻石会员', icon: '💎', color: '#E53E3E', gradient: 'linear-gradient(135deg, #E53E3E, #fc8181)', glowColor: 'rgba(229,62,62,0.2)' },
    director: { label: '年卡会员', icon: '👑', color: '#9333EA', gradient: 'linear-gradient(135deg, #9333EA, #c084fc)', glowColor: 'rgba(147,51,234,0.2)' },
    vip_year: { label: '钻石会员', icon: '💎', color: '#E53E3E', gradient: 'linear-gradient(135deg, #E53E3E, #fc8181)', glowColor: 'rgba(229,62,62,0.2)' },
    vip_platinum: { label: '至尊会员', icon: '👑', color: '#9333EA', gradient: 'linear-gradient(135deg, #9333EA, #f472b6)', glowColor: 'rgba(147,51,234,0.2)' },
  }
  return MAP[planClass.value] || MAP.free
})

const vipCardStyle = computed(() => ({
  borderColor: vipInfo.value?.color ? vipInfo.value.color + '20' : 'transparent',
}))

function handleCardClick() {
  if (planClass.value === 'free') {
    window.location.href = '/user/membership'
  } else {
    window.location.href = '/user/center'
  }
}
function goUpgrade() { window.location.href = '/user/membership' }
function goUserCenter() { window.location.href = '/user/center' }
function goLogin() { window.location.href = '/?showLogin=1' }

onMounted(async () => {
  const token = getAuthToken()
  if (!token) return
  const headers = { Authorization: `Bearer ${token}` }
  try {
    const [planRes, userRes] = await Promise.all([
      fetch('/api/member/profile', { headers }).catch(() => null),
      fetch('/api/user/profile', { headers }).catch(() => null),
    ])
    if (planRes && planRes.ok) {
      planInfo.value = await planRes.json()
    }
    if (userRes && userRes.ok) {
      // user/profile 返回多层嵌套 data（{success,data:{success,data:{...}}}）→ 解包到最深层
      let u: any = await userRes.json()
      while (u && typeof u === 'object' && 'data' in u) u = u.data
      userInfo.value = u
    }
  } catch {
    // 静默：会员卡保持未加载态
  }
})
</script>

<style scoped>
.wvc {
  padding: 10px 8px 12px;
  border-top: 1px solid var(--color-border-primary, #334155);
}
.wvc-vip-wrapper { cursor: pointer; }
.wvc-vip-card {
  position: relative;
  border-radius: 12px;
  padding: 12px;
  overflow: hidden;
  border: 1px solid transparent;
  transition: all 0.2s;
}
.wvc-vip-card:hover { transform: translateY(-1px); }
.wvc-vip-card.wvc-guest { background: rgba(255,255,255,0.03); border-color: #1a1a28; }
.wvc-vip-bg { position: absolute; inset: 0; opacity: 0.12; }
.wvc-vip-glow {
  position: absolute; top: -50%; right: -50%; width: 100%; height: 100%;
  border-radius: 50%; filter: blur(40px); opacity: 0.15;
}
.wvc-vip-content { position: relative; display: flex; gap: 10px; }
.wvc-vip-left { flex-shrink: 0; }
.wvc-vip-avatar {
  width: 40px; height: 40px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 700; color: #fff;
}
.wvc-guest-avatar { background: #1a1a28; font-size: 18px; }
.wvc-vip-right { flex: 1; min-width: 0; }
.wvc-vip-top { display: flex; align-items: center; gap: 4px; margin-bottom: 3px; }
.wvc-vip-tier-icon { font-size: 12px; }
.wvc-vip-tier-name { font-size: 12px; font-weight: 600; }
.wvc-vip-user { font-size: 12px; font-weight: 600; color: var(--color-text-primary, #F1F5F9); margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wvc-vip-sub { font-size: 11px; color: #6b7280; margin-top: 6px; }
.wvc-vip-expiry { display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
.wvc-expiry-label { font-size: 10px; color: #6b7280; }
.wvc-expiry-date { font-size: 10px; color: #9ca3af; }
.wvc-vip-upgrade {
  display: block; width: 100%; padding: 4px 0; border-radius: 6px; border: none;
  background: linear-gradient(135deg, #D4AF37, #fbbf24); color: #000;
  font-size: 11px; font-weight: 600; cursor: pointer; transition: opacity 0.15s;
}
.wvc-vip-upgrade:hover { opacity: 0.85; }
.wvc-vip-entrance { margin-top: 4px; cursor: pointer; text-align: center; }
.wvc-entrance-text { font-size: 11px; color: #60a5fa; opacity: 0.8; transition: opacity 0.15s; }
.wvc-vip-entrance:hover .wvc-entrance-text { opacity: 1; }

/* AI 模型设置入口 */
.wvc-model-btn {
  display: flex; align-items: center; gap: 8px; width: 100%;
  margin: 8px 0 0; padding: 8px 10px; border-radius: 8px;
  border: 1px solid var(--color-border-primary, #334155);
  background: transparent; color: var(--color-text-secondary, #CBD5E1);
  cursor: pointer; transition: all 0.15s; text-align: left;
}
.wvc-model-btn:hover {
  background: var(--color-bg-hover, #1e293b);
  border-color: var(--color-border-hover, #475569);
  color: var(--color-text-primary, #F1F5F9);
}
.wvc-model-icon { font-size: 15px; }
.wvc-model-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.wvc-model-title { font-size: 12px; font-weight: 600; }
.wvc-model-desc { font-size: 10px; color: var(--color-text-muted, #64748B); }
.wvc-model-arrow { font-size: 12px; opacity: 0.7; }
</style>
