<template>
  <div class="member-center-page cn-member-page cn-page">
    <!-- 背景 -->
    <div class="bg-grid" />
    <div class="bg-glow top-left" />
    <div class="bg-glow bottom-right" />
    
    <!-- 顶部导航栏 -->
    <nav class="nav-bar">
      <div class="nav-inner">
        <div class="nav-logo">
          <span class="logo-icon"><img src="/logo.png" alt="昆仑镜" class="nav-logo-img" /></span>
          <span class="logo-text">昆仑镜</span>
        </div>
        <div class="nav-links">
          <router-link to="/" class="nav-link">首页</router-link>
          <router-link to="/user/center" class="nav-link">会员中心</router-link>
        </div>
        <div class="nav-actions">
          <div v-if="userInfo" class="nav-user-badge" @click="router.push('/user/center')">
            <div class="nav-user-avatar" :class="`nav-user-avatar--${tierClass}`">
              {{ avatarChar }}
            </div>
            <span class="nav-tier-tag" :class="`nav-tier-tag--${tierClass}`">
              {{ tierInfo.label }}
            </span>
          </div>
          <button v-else class="btn btn-outline" @click="goHome">登录</button>
        </div>
      </div>
    </nav>

    <!-- 主内容 -->
    <div class="center-content">

      <!-- 会员信息卡片（大号） -->
      <div class="member-hero-card" :class="`member-hero-card--${tierClass}`">
        <div class="member-hero-glow" />
        <div class="member-hero-inner">
          <div class="member-hero-avatar-area">
            <div class="member-hero-avatar-wrap" @click="triggerAvatarUpload" :title="avatarUrl ? '点击更换头像' : '点击上传头像'">
              <UserAvatar :src="avatarUrl" :name="userDisplayName" size="hero" class="member-hero-avatar-img" />
              <div class="member-hero-avatar-edit">
                <span v-if="avatarUploading">⏳</span>
                <span v-else>{{ avatarUrl ? '换' : '传' }}</span>
              </div>
            </div>
            <input ref="avatarInput" type="file" accept="image/png,image/jpeg,image/gif,image/webp" class="avatar-file-input" @change="onAvatarFileChange" />
            <div class="member-tier-badge" :class="`member-tier-badge--${tierClass}`">
              <span class="member-tier-icon">{{ tierInfo.icon }}</span>
              <span class="member-tier-label">{{ tierInfo.label }}</span>
            </div>
          </div>
          <div class="member-hero-info">
            <h2 class="member-hero-name">
              {{ userDisplayName }}
              <span v-if="userInfo?.agentStatus === 'active'" class="agent-badge" :class="'agent-badge--' + (userInfo?.agentLevel || 'senior')">
                {{ userInfo?.agentLevel === 'premium' ? '👑 顶级代理' : '⭐ 高级代理' }}
              </span>
            </h2>
            <p class="member-hero-email">{{ userInfo?.email || '' }}</p>
            <div class="member-hero-stats">
              <div class="member-hero-stat">
                <span class="member-hero-stat-icon">⭐</span>
                <div class="member-hero-stat-text">
                  <span class="member-hero-stat-value">{{ coins }}</span>
                  <span class="member-hero-stat-label">积分</span>
                </div>
              </div>
              <div class="member-hero-stat" v-if="userInfo?.memberExpiresAt">
                <span class="member-hero-stat-icon">📅</span>
                <div class="member-hero-stat-text">
                  <span class="member-hero-stat-value">{{ formattedExpiry }}</span>
                  <span class="member-hero-stat-label">到期时间</span>
                </div>
              </div>
            </div>
            <!-- USER-FOLLOW-01 关注/粉丝（掌柜：积分下方） -->
            <div class="member-hero-follow">
              <button class="follow-stat" @click="openFollowPanel('following')">
                <span class="follow-stat-value">{{ followStats.followingCount }}</span>
                <span class="follow-stat-label">关注</span>
              </button>
              <span class="follow-divider">·</span>
              <button class="follow-stat" @click="openFollowPanel('follower')">
                <span class="follow-stat-value">{{ followStats.followerCount }}</span>
                <span class="follow-stat-label">粉丝</span>
              </button>
              <span class="follow-divider">·</span>
              <!-- MY-GIFTS-01 我的礼物入口（掌柜：粉丝后面，进金币兑换页） -->
              <button class="follow-stat follow-stat--gift" @click="router.push('/user/gold-coins')">
                <span class="follow-stat-value">🎁</span>
                <span class="follow-stat-label">我的礼物</span>
              </button>
            </div>
          </div>
          <div v-if="tierClass !== 'vip_platinum'" class="member-hero-upgrade">
            <a href="/user/membership" class="upgrade-main-btn" style="text-decoration:none;display:inline-block;">
              {{ tierClass === 'free' ? '升级VIP →' : '续费/升级 →' }}
            </a>
          </div>
          <div v-else style="margin-top:16px;">
            <a href="/user/membership" class="upgrade-main-btn">
              会员中心 →
            </a>
          </div>
        </div>
      </div>

      <!-- 代理商管理面板（仅已开通代理时显示） -->
      <div v-if="userInfo?.agentStatus === 'active'" class="agent-panel">
        <div class="agent-panel-header">
          <div class="agent-panel-header-left">
            <span class="agent-panel-icon">{{ userInfo?.agentLevel === 'premium' ? '👑' : '⭐' }}</span>
            <div>
              <h3 class="agent-panel-title">代理商管理</h3>
              <p class="agent-panel-desc">推广昆仑镜，赚取佣金收益</p>
            </div>
          </div>
          <router-link to="/user/agent" class="agent-panel-btn">进入管理中心 →</router-link>
        </div>
        <div class="agent-panel-stats" v-if="agentStats">
          <div class="agent-stat-card">
            <p class="agent-stat-value">{{ agentStats.clientCount || 0 }}</p>
            <p class="agent-stat-label">旗下客户</p>
          </div>
          <div class="agent-stat-card">
            <p class="agent-stat-value">¥{{ (agentStats.totalCommission || 0).toFixed(1) }}</p>
            <p class="agent-stat-label">累计佣金</p>
          </div>
          <div class="agent-stat-card">
            <p class="agent-stat-value">¥{{ (agentStats.pendingCommission || 0).toFixed(1) }}</p>
            <p class="agent-stat-label">待结算</p>
          </div>
          <div class="agent-stat-card">
            <p class="agent-stat-value">¥{{ (agentStats.settledCommission || 0).toFixed(1) }}</p>
            <p class="agent-stat-label">已结算</p>
          </div>
        </div>
        <div v-else class="agent-panel-loading">
          <span class="text-gray-500 text-xs">正在加载代理商数据...</span>
        </div>
      </div>

      <!-- 九大功能模块（会员中心重构） -->
      <div class="member-modules">
        <router-link to="/user/settings" class="member-module">
          <div class="module-icon-area" style="background: rgba(107,114,128,0.12);">
            <span class="module-icon">⚙️</span>
          </div>
          <div class="module-text">
            <h3 class="module-title">设置中心</h3>
            <p class="module-desc">手机/微信/支付宝绑定 · 密码</p>
          </div>
          <span class="module-arrow">→</span>
        </router-link>

        <div class="member-module" style="cursor:pointer" @click="openWallet">
          <div class="module-icon-area" style="background: rgba(16,185,129,0.12);">
            <span class="module-icon">💰</span>
          </div>
          <div class="module-text">
            <h3 class="module-title">我的余额</h3>
            <p class="module-desc">收益余额 · 提现 · 绑卡</p>
          </div>
          <span class="module-arrow">→</span>
        </div>

        <router-link to="/user/diamonds" class="member-module">
          <div class="module-icon-area" style="background: rgba(59,130,246,0.12);">
            <span class="module-icon">💎</span>
          </div>
          <div class="module-text">
            <h3 class="module-title">我的钻石</h3>
            <p class="module-desc">充值钻石 · 收益钻石 · 流水</p>
          </div>
          <span class="module-arrow">→</span>
        </router-link>

        <router-link to="/user/membership" class="member-module">
          <div class="module-icon-area" style="background: rgba(245,158,11,0.12);">
            <span class="module-icon">👑</span>
          </div>
          <div class="module-text">
            <h3 class="module-title">我的VIP</h3>
            <p class="module-desc">会员等级 · 升级 · 续费</p>
          </div>
          <span class="module-arrow">→</span>
        </router-link>

        <router-link to="/user/orders" class="member-module">
          <div class="module-icon-area" style="background: rgba(139,92,246,0.12);">
            <span class="module-icon">📋</span>
          </div>
          <div class="module-text">
            <h3 class="module-title">我的订单</h3>
            <p class="module-desc">充值 · VIP · 消费记录</p>
          </div>
          <span class="module-arrow">→</span>
        </router-link>

        <router-link to="/user/referral" class="member-module">
          <div class="module-icon-area" style="background: rgba(245,158,11,0.1);">
            <span class="module-icon">📣</span>
          </div>
          <div class="module-text">
            <h3 class="module-title">我要推广</h3>
            <p class="module-desc">邀请链接 · 奖励 · 佣金</p>
          </div>
          <span class="module-arrow">→</span>
        </router-link>

        <router-link to="/user/team" class="member-module">
          <div class="module-icon-area" style="background: rgba(251,191,36,0.1);">
            <span class="module-icon">👥</span>
          </div>
          <div class="module-text">
            <h3 class="module-title">我的团队</h3>
            <p class="module-desc">推广成员 · 团队规模</p>
          </div>
          <span class="module-arrow">→</span>
        </router-link>

        <router-link to="/chat?view=friends" class="member-module">
          <div class="module-icon-area" style="background: rgba(236,72,153,0.1);">
            <span class="module-icon">💬</span>
          </div>
          <div class="module-text">
            <h3 class="module-title">我的好友</h3>
            <p class="module-desc">聊天好友 · 私聊</p>
          </div>
          <span class="module-arrow">→</span>
        </router-link>

        <router-link to="/chat?view=groups" class="member-module">
          <div class="module-icon-area" style="background: rgba(52,211,153,0.1);">
            <span class="module-icon">🏘️</span>
          </div>
          <div class="module-text">
            <h3 class="module-title">我的社群</h3>
            <p class="module-desc">聊天频道 · 群聊</p>
          </div>
          <span class="module-arrow">→</span>
        </router-link>
      </div>

      <!-- 创作工作区 -->
      <div class="member-modules member-modules--work">
        <div class="work-module-title">创作工作区</div>
        <router-link to="/studio/v2" class="member-module">
          <div class="module-icon-area" style="background: rgba(59,130,246,0.1);">
            <span class="module-icon">🎬</span>
          </div>
          <div class="module-text">
            <h3 class="module-title">我的作品</h3>
            <p class="module-desc">查看和管理你的创作项目</p>
          </div>
          <span class="module-arrow">→</span>
        </router-link>

        <router-link to="/user/gallery" class="member-module">
          <div class="module-icon-area" style="background: rgba(139,92,246,0.1);">
            <span class="module-icon">🖼️</span>
          </div>
          <div class="module-text">
            <h3 class="module-title">我的图库</h3>
            <p class="module-desc">管理你的生成图片和素材</p>
          </div>
          <span class="module-arrow">→</span>
        </router-link>

        <router-link to="/user/storage" class="member-module">
          <div class="module-icon-area" style="background: rgba(16,185,129,0.1);">
            <span class="module-icon">💾</span>
          </div>
          <div class="module-text">
            <h3 class="module-title">我的存储空间</h3>
            <p class="module-desc">
              已使用 <strong>{{ storageUsed }}</strong> / {{ storageTotal }}
            </p>
            <div class="storage-bar">
              <div class="storage-bar-fill" :style="{ width: storagePercent + '%' }" />
            </div>
          </div>
          <span class="module-arrow">→</span>
        </router-link>

        <router-link to="/user/agent" class="member-module">
          <div class="module-icon-area" :style="{ background: userInfo?.agentStatus === 'active' ? 'rgba(251,191,36,0.15)' : 'rgba(107,114,128,0.1)' }">
            <span class="module-icon">{{ userInfo?.agentStatus === 'active' ? '🤝' : '📋' }}</span>
          </div>
          <div class="module-text">
            <h3 class="module-title">代理商{{ userInfo?.agentStatus === 'active' ? '中心' : '申请' }}</h3>
            <p class="module-desc">{{ userInfo?.agentStatus === 'active' ? '管理推广、佣金和客户' : '成为代理商，赚取佣金收益' }}</p>
          </div>
          <span class="module-arrow">→</span>
        </router-link>
      </div>
    </div>
  </div>

  <!-- MEMBER-CENTER-03 我的余额弹窗：钱包 / 充值 / 提现设置 / 余额明细 -->
  <teleport to="body">
    <div v-if="walletOpen" class="wallet-modal-mask" @click.self="walletOpen = false">
      <div class="wallet-modal">
        <div class="wallet-modal-head">
          <h2 class="wallet-modal-title">💰 我的钱包</h2>
          <button class="wallet-modal-close" @click="walletOpen = false">✕</button>
        </div>

        <!-- Tab 导航 -->
        <div class="wallet-tabs">
          <button class="wallet-tab" :class="{ active: walletTab === 'wallet' }" @click="walletTab = 'wallet'">钱包</button>
          <button class="wallet-tab" :class="{ active: walletTab === 'withdraw' }" @click="walletTab = 'withdraw'">提现设置</button>
          <button class="wallet-tab" :class="{ active: walletTab === 'detail' }" @click="walletTab = 'detail'">余额明细</button>
        </div>

        <!-- Tab 1 钱包总览 -->
        <div v-if="walletTab === 'wallet'" class="wallet-tab-pane">
          <div class="wallet-balance-card">
            <p class="wallet-balance-label">当前可提现余额</p>
            <p class="wallet-balance-value">¥{{ walletBalance.toFixed(2) }}</p>
            <p class="wallet-balance-sub">收益佣金实时结算 · 满 ¥100 可提现</p>
          </div>
          <div class="wallet-quick-actions">
            <button class="wallet-quick-btn primary" @click="goRecharge">⚡ 充值钻石</button>
            <button class="wallet-quick-btn" @click="goUpgrade">👑 升级VIP</button>
          </div>
          <div class="wallet-tip">
            💡 充值请前往「我的钻石」；升级会员请前往「我的VIP」。本页余额为推广佣金收益，可提现至支付宝/微信。
          </div>
        </div>

        <!-- Tab 2 提现设置 -->
        <div v-if="walletTab === 'withdraw'" class="wallet-tab-pane">
          <div class="wallet-section-title">收款账号</div>
          <div v-if="paymentAccount" class="wallet-account-bound">
            <span class="wallet-account-type">{{ paymentAccount.accountType === 'alipay' ? '支付宝' : '微信' }}</span>
            <span class="wallet-account-name">{{ paymentAccount.accountName }}</span>
            <span class="wallet-account-no">{{ maskAccountNo(paymentAccount.accountNo) }}</span>
            <button class="wallet-link-btn" @click="bindFormOpen = !bindFormOpen">修改</button>
          </div>
          <div v-else class="wallet-account-empty" @click="bindFormOpen = true">
            未绑定收款账号，点击绑定 →
          </div>
          <div v-if="bindFormOpen" class="wallet-bind-form">
            <div class="wallet-form-row">
              <select v-model="bindForm.accountType" class="wallet-input">
                <option value="alipay">支付宝</option>
                <option value="wechat">微信</option>
              </select>
            </div>
            <div class="wallet-form-row">
              <input v-model="bindForm.accountName" class="wallet-input" placeholder="收款人真实姓名" />
            </div>
            <div class="wallet-form-row">
              <input v-model="bindForm.accountNo" class="wallet-input" placeholder="收款账号（支付宝账号/微信手机号）" />
            </div>
            <div class="wallet-form-row">
              <button class="wallet-btn full" :disabled="binding" @click="saveBindAccount">
                {{ binding ? '保存中...' : '保存收款账号' }}
              </button>
            </div>
          </div>

          <div class="wallet-section-title">申请提现</div>
          <div class="wallet-form-row">
            <input v-model.number="withdrawAmount" type="number" min="100" class="wallet-input" placeholder="提现金额（≥ ¥100）" />
          </div>
          <div class="wallet-form-row">
            <button class="wallet-btn full primary" :disabled="withdrawing" @click="submitWithdraw">
              {{ withdrawing ? '提交中...' : '确认提现' }}
            </button>
          </div>
          <p v-if="withdrawMsg" class="wallet-msg">{{ withdrawMsg }}</p>
        </div>

        <!-- Tab 3 余额明细 -->
        <div v-if="walletTab === 'detail'" class="wallet-tab-pane">
          <div class="wallet-section-title">佣金收入</div>
          <div v-if="walletData.commissions.length" class="wallet-list">
            <div v-for="c in walletData.commissions" :key="c.id" class="wallet-list-item">
              <div class="wallet-list-main">
                <p class="wallet-list-title">{{ c.title || '推广佣金' }}</p>
                <p class="wallet-list-sub">{{ formatTime(c.createdAt) }}</p>
              </div>
              <span class="wallet-list-amount plus">+¥{{ Number(c.amount || 0).toFixed(2) }}</span>
            </div>
          </div>
          <div v-else class="wallet-empty">暂无佣金收入</div>

          <div class="wallet-section-title">提现记录</div>
          <div v-if="walletData.withdraws.length" class="wallet-list">
            <div v-for="w in walletData.withdraws" :key="w.id" class="wallet-list-item">
              <div class="wallet-list-main">
                <p class="wallet-list-title">提现 ¥{{ Number(w.amount || 0).toFixed(2) }}</p>
                <p class="wallet-list-sub">{{ formatTime(w.createdAt) }} · {{ withdrawStatusLabel(w.status) }}</p>
              </div>
              <span class="wallet-list-amount">-¥{{ Number(w.amount || 0).toFixed(2) }}</span>
            </div>
          </div>
          <div v-else class="wallet-empty">暂无提现记录</div>
        </div>
      </div>
    </div>
  </teleport>

  <!-- USER-FOLLOW-01 关注/粉丝弹窗 -->
  <teleport to="body">
    <div v-if="followPanelOpen" class="follow-mask" @click.self="followPanelOpen = false">
      <div class="follow-panel">
        <div class="follow-panel-head">
          <div class="follow-tabs">
            <button class="follow-tab" :class="{ active: followTab === 'following' }" @click="switchFollowTab('following')">关注 {{ followStats.followingCount }}</button>
            <button class="follow-tab" :class="{ active: followTab === 'follower' }" @click="switchFollowTab('follower')">粉丝 {{ followStats.followerCount }}</button>
          </div>
          <button class="follow-close" @click="followPanelOpen = false">✕</button>
        </div>
        <div class="follow-list">
          <div v-if="followLoading" class="follow-empty">加载中…</div>
          <div v-else-if="!followList.length" class="follow-empty">{{ followTab === 'following' ? '还没有关注任何人' : '还没有粉丝，去茶馆坐坐吧' }}</div>
          <div v-for="u in followList" :key="u.id" class="follow-item">
            <UserAvatar :src="u.avatar" :name="u.name || 'U'" size="md" class="follow-item-avatar" />
            <div class="follow-item-meta">
              <span class="follow-item-name">{{ u.name }}
                <span class="mini-dot" :class="{ on: u.online }"></span>
                <span v-if="u.relation === 'mutual'" class="rel-badge rel-mutual">互相关注</span>
                <span v-else-if="u.relation === 'following'" class="rel-badge rel-following">已关注</span>
                <span v-else class="rel-badge rel-follower">关注了我</span>
              </span>
              <span class="follow-item-sub">{{ u.online ? '在线' : (u.email || '离线') }}</span>
            </div>
            <div class="follow-item-actions">
              <button class="follow-act-btn" @click="goPrivate(u)">发消息</button>
              <button class="follow-btn" :class="{ following: u.relation !== 'follower', busy: followBusyId === u.id }" @click="toggleFollow(u)" :disabled="followBusyId === u.id">
                {{ u.relation === 'mutual' ? '互相关注' : u.relation === 'following' ? '已关注' : '回关' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import UserAvatar from '~/components/common/UserAvatar.vue'

const router = useRouter()

interface UserInfo {
  memberTier?: string
  email?: string
  username?: string
  coins?: number
  memberExpiresAt?: string
  avatarUrl?: string | null
  [key: string]: any
}

const userInfo = ref<UserInfo | null>(null)
const agentStats = ref<any>(null)

// ══ USER-FOLLOW-01 关注体系 ══════════════════════
const followStats = ref({ followingCount: 0, followerCount: 0 })
const followPanelOpen = ref(false)
const followTab = ref<'following' | 'follower'>('following')
const followList = ref<any[]>([])
const followLoading = ref(false)
const followBusyId = ref('')

async function loadFollowStats() {
  try {
    const res = await fetch('/api/user/follow/stats', { headers: { Authorization: `Bearer ${_token()}` } })
    if (res.ok) {
      const j = await res.json()
      if (j.data) followStats.value = j.data
    }
  } catch { /* 非致命 */ }
}

async function openFollowPanel(tab: 'following' | 'follower') {
  followTab.value = tab
  followPanelOpen.value = true
  await loadFollowList()
}

async function switchFollowTab(tab: 'following' | 'follower') {
  followTab.value = tab
  await loadFollowList()
}

async function loadFollowList() {
  followLoading.value = true
  try {
    const res = await fetch(`/api/user/follow/list?type=${followTab.value}`, { headers: { Authorization: `Bearer ${_token()}` } })
    if (res.ok) {
      const j = await res.json()
      followList.value = j.data?.users || []
    }
  } catch { followList.value = [] } finally { followLoading.value = false }
}

async function toggleFollow(u: any) {
  if (followBusyId.value) return
  followBusyId.value = u.id
  try {
    if (u.relation === 'follower') {
      // 回关
      const res = await fetch('/api/user/follow', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_token()}` },
        body: JSON.stringify({ targetId: u.id }),
      })
      if (res.ok) u.relation = 'mutual'
    } else {
      // 已关注/互相关注 → 取关
      const res = await fetch('/api/user/unfollow', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_token()}` },
        body: JSON.stringify({ targetId: u.id }),
      })
      if (res.ok) u.relation = 'follower'
    }
    await loadFollowStats()
    followList.value = [...followList.value]
  } catch { /* 非致命 */ } finally { followBusyId.value = '' }
}

function goPrivate(u: any) {
  followPanelOpen.value = false
  router.push('/chat?dm=' + u.id)
}

// MEMBER-CENTER-02 头像上传
const avatarInput = ref<HTMLInputElement | null>(null)
const avatarUploading = ref(false)
const avatarUrl = computed(() => userInfo.value?.avatarUrl || '')
// 头像边昵称：displayName(nickname 优先) → username 登录标识
const userDisplayName = computed(() => userInfo.value?.displayName || userInfo.value?.nickname || userInfo.value?.username || userInfo.value?.email?.split('@')[0] || '用户')

function triggerAvatarUpload() {
  avatarInput.value?.click()
}

async function onAvatarFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    alert('头像文件不能超过 5MB')
    input.value = ''
    return
  }
  const token = (() => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } })()
  if (!token) { alert('请先登录'); return }

  avatarUploading.value = true
  try {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/user/avatar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    const data = await res.json()
    if (!res.ok) {
      alert(data.error || '头像上传失败')
      return
    }
    const url = data.data?.avatarUrl || data.avatarUrl
    if (url && userInfo.value) {
      userInfo.value.avatarUrl = url
      // 同步 localStorage + auth store（全站即时生效）
      const cached = JSON.parse(localStorage.getItem('auth_user') || '{}')
      cached.avatarUrl = url
      localStorage.setItem('auth_user', JSON.stringify(cached))
      try {
        const { useAuthStore } = await import('~/stores/auth')
        const auth = useAuthStore()
        auth.setAvatar(url)
      } catch {}
    }
    alert('头像更新成功 ✅')
  } catch (err: any) {
    alert('头像上传失败: ' + (err.message || ''))
  } finally {
    avatarUploading.value = false
    input.value = ''
  }
}

import { getTierLabel } from '~/constants/membership'

// VIP 等级配置 — 与 constants/membership.ts 保持一致
const tierConfig: Record<string, { label: string; icon: string; color: string }> = {
  free: { label: '体验版', icon: '🔓', color: '#6b7280' },
  trial: { label: '新人体验卡', icon: '🎁', color: '#F59E0B' },
  basic: { label: '基础版', icon: '⭐', color: '#3b82f6' },
  pro: { label: '本地版', icon: '💻', color: '#a855f7' },
  enterprise: { label: '年卡', icon: '👑', color: '#22c55e' },
  gold: { label: '黄金会员', icon: '⭐', color: '#D4AF37' },
  premium: { label: '黄金会员', icon: '⭐', color: '#D4AF37' },
  vip: { label: '黄金会员', icon: '⭐', color: '#EAB308' },
  Pro: { label: '钻石会员', icon: '💎', color: '#E53E3E' },
  director: { label: '年卡会员', icon: '👑', color: '#9333EA' },
  vip_year: { label: '钻石会员', icon: '💎', color: '#E53E3E' },
  vip_season: { label: '钻石会员', icon: '💎', color: '#E53E3E' },
  vip_platinum: { label: '至尊会员', icon: '👑', color: '#9333EA' },
}

const tierClass = computed(() => {
  const tier = userInfo.value?.memberTier || 'free'
  return tierConfig[tier] ? tier : 'free'
})

const tierInfo = computed(() => tierConfig[tierClass.value] || tierConfig.free)

const avatarChar = computed(() => {
  return (userDisplayName || 'U').charAt(0).toUpperCase()
})

const coins = computed(() => userInfo.value?.coins ?? 0)

const formattedExpiry = computed(() => {
  if (!userInfo.value?.memberExpiresAt) return '—'
  try {
    const d = new Date(userInfo.value.memberExpiresAt)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return '—'
  }
})

// 存储数据 —— 从 API 获取
const storageUsed = ref('0 MB')
const storageTotal = ref('1 GB')
const storagePercent = computed(() => {
  const used = parseFloat(storageUsed.value)
  const total = parseFloat(storageTotal.value)
  return Math.min(Math.round((used / total) * 100), 100)
})

function goHome() {
  router.push('/')
}

function handlePlaceholder(msg: string) {
  alert(msg)
}

// MEMBER-CENTER-03 我的余额弹窗
const walletOpen = ref(false)
const walletTab = ref<'wallet' | 'withdraw' | 'detail'>('wallet')
const walletBalance = ref(0)
const walletData = ref<{ commissions: any[]; withdraws: any[] }>({ commissions: [], withdraws: [] })
const paymentAccount = ref<any>(null)
const bindFormOpen = ref(false)
const bindForm = ref({ accountType: 'alipay', accountName: '', accountNo: '' })
const binding = ref(false)
const withdrawing = ref(false)
const withdrawAmount = ref<number | null>(null)
const withdrawMsg = ref('')

function _token() { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }

async function loadWallet() {
  const token = _token()
  if (!token) return
  try {
    const [walletRes, accountRes] = await Promise.all([
      fetch('/api/wallet', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/wallet/account', { headers: { Authorization: `Bearer ${token}` } }),
    ])
    if (walletRes.ok) {
      const d = await walletRes.json()
      if (d.success && d.data) {
        walletBalance.value = Number(d.data.balance || 0)
        walletData.value = {
          commissions: d.data.commissions || [],
          withdraws: d.data.withdraws || [],
        }
      }
    }
    if (accountRes.ok) {
      const d = await accountRes.json()
      if (d.success && d.data) paymentAccount.value = d.data
    }
  } catch (e) { console.warn('[WalletModal] load failed', e) }
}

function openWallet() {
  walletOpen.value = true
  walletTab.value = 'wallet'
  withdrawMsg.value = ''
  loadWallet()
}

function goRecharge() { router.push('/user/diamonds') }
function goUpgrade() { router.push('/user/membership') }

function maskAccountNo(no?: string) {
  if (!no || no.length < 4) return no || ''
  return no.slice(0, 2) + '****' + no.slice(-2)
}

async function saveBindAccount() {
  if (!bindForm.value.accountName || bindForm.value.accountName.length < 2) {
    alert('请填写收款人真实姓名')
    return
  }
  binding.value = true
  try {
    const res = await fetch('/api/wallet/bind-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_token()}` },
      body: JSON.stringify(bindForm.value),
    })
    const d = await res.json()
    if (!res.ok) { alert(d.error || '保存失败'); return }
    paymentAccount.value = { ...bindForm.value }
    bindFormOpen.value = false
    alert('收款账号已保存 ✅')
  } catch (e: any) {
    alert('保存失败: ' + (e.message || ''))
  } finally { binding.value = false }
}

async function submitWithdraw() {
  withdrawMsg.value = ''
  const amount = Number(withdrawAmount.value)
  if (!amount || amount < 100) { withdrawMsg.value = '提现金额不能小于 ¥100'; return }
  if (amount > walletBalance.value) { withdrawMsg.value = '余额不足'; return }
  if (!paymentAccount.value) { withdrawMsg.value = '请先绑定收款账号'; walletTab.value = 'withdraw'; return }
  withdrawing.value = true
  try {
    const res = await fetch('/api/wallet/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_token()}` },
      body: JSON.stringify({ amount }),
    })
    const d = await res.json()
    if (!res.ok) { withdrawMsg.value = d.error || '提现失败'; return }
    withdrawMsg.value = '提现申请已提交 ✅ 等待管理员审核打款'
    withdrawAmount.value = null
    loadWallet()
  } catch (e: any) {
    withdrawMsg.value = '提现失败: ' + (e.message || '')
  } finally { withdrawing.value = false }
}

function formatTime(t?: string) {
  if (!t) return ''
  try {
    const d = new Date(t)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch { return '' }
}

function withdrawStatusLabel(s?: string) {
  const map: Record<string, string> = { pending: '待审核', paid: '已打款', rejected: '已驳回', active: '绑定中' }
  return map[s || ''] || s || ''
}

onMounted(async () => {
  const _gt = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }; const token = _gt()

  // USER-FOLLOW-01 关注/粉丝统计（昵称卡片积分下方）
  loadFollowStats()

  // 先调 storage API 获取真实 tier（更快，不需要 auth/me）
  if (token) {
    try {
      const storageRes = await fetch('/api/user/storage', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (storageRes.ok) {
        const storageJson = await storageRes.json()
        if (storageJson.success && storageJson.data) {
          storageUsed.value = storageJson.data.usedFormatted
          storageTotal.value = storageJson.data.totalFormatted

          // 用 storage API 返回的 tier 覆盖 localStorage 缓存的旧数据
          if (storageJson.data.tier) {
            const cached = JSON.parse(localStorage.getItem('auth_user') || '{}')
            cached.memberTier = storageJson.data.tier
            // 只更新 tier，不覆盖整个 userInfo（避免丢失 agentStatus 等字段）
            if (userInfo.value) {
              userInfo.value.memberTier = storageJson.data.tier
            } else {
              userInfo.value = { ...cached }
            }
            localStorage.setItem('auth_user', JSON.stringify(cached))
          }
        }
      }
    } catch (e) {
      console.warn('[MemberCenter] failed to fetch storage', e)
    }
  }

  // 尝试从 API 刷新用户信息（覆盖缓存）
  if (token) {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        const profile = data.data?.user || data.data || data
        if (profile) {
          userInfo.value = profile
          localStorage.setItem('auth_user', JSON.stringify(profile))
        }

        // 尝试加载代理数据（即使 profile 没有 agentStatus，也直接调 API 确认）
        try {
          const dashRes = await fetch('/api/agent/dashboard', {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (dashRes.ok) {
            const dashData = await dashRes.json()
            if (dashData.data) {
              // 后端返回了数据说明确实是代理商
              if (dashData.data.agentStatus === 'active') {
                // 更新 userInfo 的 agentStatus
                if (!userInfo.value?.agentStatus || userInfo.value.agentStatus !== 'active') {
                  userInfo.value = { ...(userInfo.value || {}), agentStatus: 'active', agentLevel: dashData.data.agentLevel } as any
                }
                agentStats.value = dashData.data.stats || null
              }
            }
          }
        } catch {}
      }
    } catch (e) {
      console.warn('[MemberCenter] failed to fetch profile', e)
    }
  }

  // 从 localStorage 读取兜底
  if (!userInfo.value) {
    try {
      const authUserRaw = window.localStorage?.getItem("auth_user")
      if (authUserRaw) {
        const parsed = JSON.parse(authUserRaw)
        userInfo.value = parsed
      }
    } catch {}
  }
})
</script>

<style scoped>
.member-center-page {
  min-height: 100vh;
  background: #0B1320;
  color: #e0e0e0;
  font-family: system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  position: relative;
  overflow-x: hidden;
}

/* 背景 */
.bg-grid {
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
  background-size: 60px 60px;
  pointer-events: none;
  z-index: 0;
}

.bg-glow {
  position: fixed;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.08;
  pointer-events: none;
  z-index: 0;
}

.bg-glow.top-left { top: -100px; left: -100px; background: #f97316; }
.bg-glow.bottom-right { bottom: -100px; right: -100px; background: #6366f1; }

/* 导航栏 */
.nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(11, 19, 32, 0.85);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-logo { display: flex; align-items: center; gap: 8px; }

.logo-icon { display: flex; align-items: center; }
.nav-logo-img { width: 26px; height: 26px; }
.logo-text { font-size: 1rem; font-weight: 600; color: #fff; }

.nav-links { display: flex; gap: 24px; }

.nav-link {
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  font-size: 0.85rem;
  transition: color 0.2s;
}

.nav-link:hover { color: rgba(255, 255, 255, 0.8); }

.nav-actions { display: flex; gap: 10px; align-items: center; }

.nav-user-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 10px 4px 4px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: all 0.2s;
}

.nav-user-badge:hover {
  background: rgba(255, 255, 255, 0.06);
}

.nav-user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 700;
  color: #fff;
}

.nav-user-avatar--free { background: linear-gradient(135deg, #4b5563, #6b7280); }
.nav-user-avatar--basic { background: linear-gradient(135deg, #3b82f6, #60a5fa); }
.nav-user-avatar--pro { background: linear-gradient(135deg, #a855f7, #c084fc); }
.nav-user-avatar--enterprise { background: linear-gradient(135deg, #22c55e, #4ade80); }
.nav-user-avatar--premium { background: linear-gradient(135deg, #D4AF37, #fbbf24); }
.nav-user-avatar--vip_year { background: linear-gradient(135deg, #E53E3E, #fc8181); }
.nav-user-avatar--vip_platinum { background: linear-gradient(135deg, #9333EA, #c084fc); }

.nav-tier-tag {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}

.nav-tier-tag--free { color: #9ca3af; }
.nav-tier-tag--basic { color: #60a5fa; }
.nav-tier-tag--pro { color: #c084fc; }
.nav-tier-tag--enterprise { color: #4ade80; }
.nav-tier-tag--premium { color: #fbbf24; }
.nav-tier-tag--vip_year { color: #fc8181; }
.nav-tier-tag--vip_platinum { color: #c084fc; }

.btn {
  padding: 8px 18px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-outline {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

.btn-outline:hover { border-color: rgba(255, 255, 255, 0.2); color: #fff; }

/* 主内容区 */
.center-content {
  position: relative;
  z-index: 1;
  max-width: 800px;
  margin: 0 auto;
  padding: 90px 24px 60px;
}


/* 桌面版下载卡片 */

/* 大号会员卡片 */
.member-hero-card {
  position: relative;
  border-radius: 20px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.025);
  backdrop-filter: blur(16px);
  margin-bottom: 32px;
  transition: all 0.3s;
}

.member-hero-card:hover {
  transform: translateY(-3px);
}

.member-hero-card--free {
  border: 1px solid rgba(107, 114, 128, 0.2);
}
.member-hero-card--free:hover {
  box-shadow: 0 12px 40px rgba(107, 114, 128, 0.08);
}

.member-hero-card--basic {
  border: 1px solid rgba(59, 130, 246, 0.25);
}
.member-hero-card--basic:hover {
  box-shadow: 0 12px 40px rgba(59, 130, 246, 0.12);
}

.member-hero-card--pro {
  border: 1px solid rgba(168, 85, 247, 0.25);
}
.member-hero-card--pro:hover {
  box-shadow: 0 12px 40px rgba(168, 85, 247, 0.12);
}

.member-hero-card--enterprise {
  border: 1px solid rgba(34, 197, 94, 0.25);
}
.member-hero-card--enterprise:hover {
  box-shadow: 0 12px 40px rgba(34, 197, 94, 0.12);
}

.member-hero-card--premium {
  border: 1px solid rgba(212, 175, 55, 0.25);
}
.member-hero-card--premium:hover {
  box-shadow: 0 12px 40px rgba(212, 175, 55, 0.12);
}

.member-hero-card--vip_year {
  border: 1px solid rgba(229, 62, 62, 0.25);
}
.member-hero-card--vip_year:hover {
  box-shadow: 0 12px 40px rgba(229, 62, 62, 0.12);
}

.member-hero-card--vip_platinum {
  border: 1px solid rgba(147, 51, 234, 0.25);
}
.member-hero-card--vip_platinum:hover {
  box-shadow: 0 12px 40px rgba(147, 51, 234, 0.12);
}

.member-hero-glow {
  position: absolute;
  top: -30%;
  right: -20%;
  width: 60%;
  height: 80%;
  border-radius: 50%;
  pointer-events: none;
  opacity: 0.15;
}

.member-hero-card--free .member-hero-glow {
  background: radial-gradient(circle, rgba(107,114,128,0.08) 0%, transparent 70%);
}
.member-hero-card--basic .member-hero-glow {
  background: radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%);
}
.member-hero-card--pro .member-hero-glow {
  background: radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%);
}
.member-hero-card--enterprise .member-hero-glow {
  background: radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 70%);
}
.member-hero-card--premium .member-hero-glow {
  background: radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%);
}
.member-hero-card--vip_year .member-hero-glow {
  background: radial-gradient(circle, rgba(229,62,62,0.15) 0%, transparent 70%);
}
.member-hero-card--vip_platinum .member-hero-glow {
  background: radial-gradient(circle, rgba(147,51,234,0.15) 0%, transparent 70%);
}

.member-hero-inner {
  position: relative;
  z-index: 1;
  padding: 36px 32px;
  display: flex;
  align-items: center;
  gap: 28px;
  flex-wrap: wrap;
}

.member-hero-avatar-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

/* MEMBER-CENTER-02 头像上传 */
.member-hero-avatar-wrap {
  position: relative;
  cursor: pointer;
  border-radius: 50%;
  padding: 3px;
  background: linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.04));
  transition: all 0.25s;
}
.member-hero-avatar-wrap:hover {
  transform: scale(1.04);
  box-shadow: 0 0 24px rgba(249, 115, 22, 0.25);
}
.member-hero-avatar-img {
  border-radius: 50%;
  display: block;
}
.member-hero-avatar-edit {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f97316, #fb923c);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #0B1320;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
}
.avatar-file-input {
  display: none;
}

.member-hero-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  font-weight: 700;
  color: #fff;
  position: relative;
}

.member-hero-avatar::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.member-hero-avatar--free { background: linear-gradient(135deg, #4b5563, #6b7280); }
.member-hero-avatar--basic {
  background: linear-gradient(135deg, #3b82f6, #60a5fa);
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
}
.member-hero-avatar--pro {
  background: linear-gradient(135deg, #a855f7, #c084fc);
  box-shadow: 0 0 20px rgba(168, 85, 247, 0.3);
}
.member-hero-avatar--enterprise {
  background: linear-gradient(135deg, #22c55e, #4ade80);
  box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
}
.member-hero-avatar--premium {
  background: linear-gradient(135deg, #D4AF37, #fbbf24);
  box-shadow: 0 0 20px rgba(212, 175, 55, 0.3);
}
.member-hero-avatar--vip_year {
  background: linear-gradient(135deg, #E53E3E, #fc8181);
  box-shadow: 0 0 20px rgba(229, 62, 62, 0.3);
}
.member-hero-avatar--vip_platinum {
  background: linear-gradient(135deg, #9333EA, #c084fc);
  box-shadow: 0 0 20px rgba(147, 51, 234, 0.3);
}

.member-tier-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 14px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
}

.member-tier-badge--free {
  background: rgba(107, 114, 128, 0.12);
  color: #9ca3af;
}
.member-tier-badge--basic {
  background: rgba(59, 130, 246, 0.12);
  color: #60a5fa;
}
.member-tier-badge--pro {
  background: rgba(168, 85, 247, 0.12);
  color: #c084fc;
}
.member-tier-badge--enterprise {
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
}
.member-tier-badge--premium {
  background: rgba(212, 175, 55, 0.12);
  color: #fbbf24;
}
.member-tier-badge--vip_year {
  background: rgba(229, 62, 62, 0.12);
  color: #fc8181;
}
.member-tier-badge--vip_platinum {
  background: rgba(147, 51, 234, 0.12);
  color: #c084fc;
}

.member-hero-info {
  flex: 1;
  min-width: 180px;
}

.member-hero-name {
  font-size: 1.4rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 4px;
}

.member-hero-email {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.35);
  margin: 0 0 16px;
}

.member-hero-stats {
  display: flex;
  gap: 24px;
}

.member-hero-stat {
  display: flex;
  align-items: center;
  gap: 8px;
}

.member-hero-stat-icon {
  font-size: 1.2rem;
}

.member-hero-stat-text {
  display: flex;
  flex-direction: column;
}

.member-hero-stat-value {
  font-size: 1rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.8);
}

.member-hero-stat-label {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* USER-FOLLOW-01 关注/粉丝（积分下方） */
.member-hero-follow {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.follow-stat {
  display: flex;
  align-items: baseline;
  gap: 5px;
  background: none;
  border: none;
  padding: 2px 6px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.follow-stat:hover {
  background: rgba(255, 255, 255, 0.08);
}

.follow-stat-value {
  font-size: 0.95rem;
  font-weight: 700;
  color: #fbbf24;
}

.follow-stat-label {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
}

.follow-divider {
  color: rgba(255, 255, 255, 0.2);
}

/* 关注/粉丝弹窗 */
.follow-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.follow-panel {
  width: 420px;
  max-width: calc(100vw - 32px);
  max-height: 70vh;
  background: #1b1f2b;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.follow-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.follow-tabs {
  display: flex;
  gap: 6px;
}

.follow-tab {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.85rem;
  padding: 6px 12px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.15s;
}

.follow-tab.active {
  color: #fff;
  background: rgba(251, 191, 36, 0.15);
}

.follow-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.9rem;
  cursor: pointer;
}

.follow-list {
  overflow-y: auto;
  padding: 8px;
}

.follow-empty {
  padding: 40px 0;
  text-align: center;
  color: rgba(255, 255, 255, 0.35);
  font-size: 0.85rem;
}

.follow-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 8px;
  border-radius: 12px;
  transition: background 0.15s;
}

.follow-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.follow-item-avatar {
  flex-shrink: 0;
}

.follow-item-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.follow-item-name {
  font-size: 0.88rem;
  color: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  gap: 6px;
}

.follow-item-sub {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.4);
}

.mini-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4b5563;
  margin-left: 4px;
}

.mini-dot.on {
  background: #34d399;
}

.rel-badge {
  font-size: 0.6rem;
  padding: 1px 6px;
  border-radius: 8px;
  white-space: nowrap;
}

.rel-mutual {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}

.rel-following {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.rel-follower {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.follow-item-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.follow-act-btn {
  background: rgba(255, 255, 255, 0.06);
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
  padding: 5px 10px;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.15s;
}

.follow-act-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

.follow-btn {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  border: none;
  color: #1b1f2b;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.15s;
}

.follow-btn.following {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.6);
}

.follow-btn.busy {
  opacity: 0.5;
  pointer-events: none;
}

.member-hero-upgrade {
  flex-shrink: 0;
}

.upgrade-main-btn {
  padding: 12px 28px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #f97316, #ea580c);
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s;
}

.upgrade-main-btn:hover {
  background: linear-gradient(135deg, #fb923c, #f97316);
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(249, 115, 22, 0.3);
}

/* 九大功能模块（MEMBER-CENTER-02 双列网格） */
.member-modules {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.member-modules--work {
  margin-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 22px;
}

.work-module-title {
  grid-column: 1 / -1;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 1px;
}

.member-module {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 14px;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.25s;
}

.member-module:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

.module-icon-area {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.module-icon {
  font-size: 1.4rem;
}

.module-text {
  flex: 1;
  min-width: 0;
}

.module-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #e0e0e0;
  margin: 0 0 4px;
}

.module-desc {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.35);
  margin: 0;
}

.module-arrow {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.15);
  transition: transform 0.2s;
}

.member-module:hover .module-arrow {
  transform: translateX(4px);
  color: rgba(255, 255, 255, 0.3);
}

/* 存储进度条 */
.storage-bar {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 6px;
}

.storage-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #34d399);
  border-radius: 3px;
  transition: width 0.5s ease;
}

@media (max-width: 768px) {
  .member-modules {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .member-hero-inner {
    flex-direction: column;
    text-align: center;
    padding: 28px 20px;
  }

  .member-hero-stats {
    justify-content: center;
  }

  .nav-links {
    display: none;
  }

  .member-modules {
    grid-template-columns: 1fr;
  }
}
/* agent badge */
.agent-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 10px;
  border-radius: 999px;
  margin-left: 8px;
  vertical-align: middle;
}
.agent-badge--senior {
  background: rgba(99,102,241,0.12);
  color: #818cf8;
  border: 1px solid rgba(99,102,241,0.2);
}
.agent-badge--premium {
  background: rgba(251,191,36,0.12);
  color: #fbbf24;
  border: 1px solid rgba(251,191,36,0.2);
}

/* 代理商管理面板 */
.agent-panel {
  background: linear-gradient(135deg, rgba(251,191,36,0.04) 0%, rgba(251,191,36,0.01) 100%);
  border: 1px solid rgba(251,191,36,0.12);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 28px;
  backdrop-filter: blur(8px);
}
.agent-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}
.agent-panel-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.agent-panel-icon {
  font-size: 22px;
}
.agent-panel-title {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
  margin: 0;
}
.agent-panel-desc {
  font-size: 11px;
  color: rgba(255,255,255,0.35);
  margin: 2px 0 0;
}
.agent-panel-btn {
  font-size: 12px;
  padding: 6px 14px;
  border-radius: 8px;
  background: rgba(251,191,36,0.1);
  color: #fbbf24;
  text-decoration: none;
  border: 1px solid rgba(251,191,36,0.2);
  transition: all 0.2s;
  white-space: nowrap;
}
.agent-panel-btn:hover {
  background: rgba(251,191,36,0.18);
}
.agent-panel-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.agent-stat-card {
  background: rgba(0,0,0,0.25);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 12px;
  padding: 14px 12px;
  text-align: center;
}
.agent-stat-value {
  font-size: 20px;
  font-weight: 700;
  color: rgba(255,255,255,0.9);
  margin: 0 0 4px;
}
.agent-stat-label {
  font-size: 10px;
  color: rgba(255,255,255,0.3);
  margin: 0;
}
.agent-panel-loading {
  padding: 16px 0;
  text-align: center;
}

/* MEMBER-CENTER-03 我的余额弹窗 */
.wallet-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.wallet-modal {
  width: 480px;
  max-width: 100%;
  max-height: 84vh;
  overflow-y: auto;
  background: #12141d;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  box-shadow: 0 24px 60px rgba(0,0,0,0.5);
  padding: 22px;
}
.wallet-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.wallet-modal-title {
  font-size: 17px;
  font-weight: 700;
  color: rgba(255,255,255,0.92);
  margin: 0;
}
.wallet-modal-close {
  background: rgba(255,255,255,0.06);
  border: none;
  color: rgba(255,255,255,0.6);
  width: 28px;
  height: 28px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}
.wallet-modal-close:hover { background: rgba(255,255,255,0.12); color: #fff; }
.wallet-tabs {
  display: flex;
  gap: 6px;
  background: rgba(255,255,255,0.05);
  padding: 4px;
  border-radius: 10px;
  margin-bottom: 16px;
}
.wallet-tab {
  flex: 1;
  border: none;
  background: transparent;
  color: rgba(255,255,255,0.5);
  padding: 8px 0;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.wallet-tab.active {
  background: rgba(16,185,129,0.18);
  color: #34d399;
  font-weight: 600;
}
.wallet-tab-pane { min-height: 220px; }
.wallet-balance-card {
  background: linear-gradient(135deg, rgba(16,185,129,0.22), rgba(16,185,129,0.06));
  border: 1px solid rgba(16,185,129,0.25);
  border-radius: 14px;
  padding: 20px;
  text-align: center;
  margin-bottom: 14px;
}
.wallet-balance-label {
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  margin: 0 0 6px;
}
.wallet-balance-value {
  font-size: 34px;
  font-weight: 800;
  color: #34d399;
  margin: 0 0 6px;
}
.wallet-balance-sub {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  margin: 0;
}
.wallet-quick-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}
.wallet-quick-btn {
  flex: 1;
  padding: 11px 0;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.85);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.wallet-quick-btn:hover { background: rgba(255,255,255,0.1); }
.wallet-quick-btn.primary {
  background: linear-gradient(135deg, #10b981, #059669);
  border: none;
  color: #fff;
  font-weight: 600;
}
.wallet-quick-btn.primary:hover { opacity: 0.9; }
.wallet-tip {
  font-size: 11px;
  line-height: 1.6;
  color: rgba(255,255,255,0.4);
  background: rgba(255,255,255,0.04);
  border-radius: 10px;
  padding: 10px 12px;
}
.wallet-section-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255,255,255,0.55);
  margin: 14px 0 8px;
}
.wallet-account-bound {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255,255,255,0.05);
  border-radius: 10px;
  padding: 12px;
}
.wallet-account-type {
  background: rgba(16,185,129,0.2);
  color: #34d399;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
}
.wallet-account-name { font-size: 13px; color: rgba(255,255,255,0.9); }
.wallet-account-no { font-size: 12px; color: rgba(255,255,255,0.45); }
.wallet-link-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: #60a5fa;
  font-size: 12px;
  cursor: pointer;
}
.wallet-account-empty {
  background: rgba(255,255,255,0.04);
  border: 1px dashed rgba(255,255,255,0.15);
  border-radius: 10px;
  padding: 14px;
  text-align: center;
  font-size: 12px;
  color: rgba(255,255,255,0.55);
  cursor: pointer;
}
.wallet-account-empty:hover { border-color: rgba(16,185,129,0.4); color: #34d399; }
.wallet-bind-form {
  margin-top: 10px;
  background: rgba(255,255,255,0.04);
  border-radius: 10px;
  padding: 12px;
}
.wallet-form-row { margin-bottom: 10px; }
.wallet-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.9);
  font-size: 13px;
  outline: none;
}
.wallet-input:focus { border-color: rgba(16,185,129,0.5); }
.wallet-input::placeholder { color: rgba(255,255,255,0.3); }
.wallet-btn {
  width: 100%;
  padding: 11px 0;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.85);
  font-size: 13px;
  cursor: pointer;
}
.wallet-btn.full { width: 100%; }
.wallet-btn.primary {
  background: linear-gradient(135deg, #10b981, #059669);
  border: none;
  color: #fff;
  font-weight: 600;
}
.wallet-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.wallet-msg {
  font-size: 12px;
  color: #fbbf24;
  margin: 8px 0 0;
}
.wallet-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.wallet-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255,255,255,0.04);
  border-radius: 10px;
  padding: 10px 12px;
}
.wallet-list-main { min-width: 0; }
.wallet-list-title {
  font-size: 13px;
  color: rgba(255,255,255,0.9);
  margin: 0 0 2px;
}
.wallet-list-sub {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  margin: 0;
}
.wallet-list-amount {
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  margin-left: 10px;
}
.wallet-list-amount.plus { color: #34d399; }
.wallet-list-amount:not(.plus) { color: rgba(255,255,255,0.6); }
.wallet-empty {
  text-align: center;
  color: rgba(255,255,255,0.35);
  font-size: 12px;
  padding: 20px 0;
}

/* ═══════════════════════════════════════════════════════════════
   会员中心中式化（雨过天青 × 青花瓷 × 朱砂印章）
   COMMUNITY-CN-01.2 — 掌柜 2026-08-06
   ═══════════════════════════════════════════════════════════════ */
.cn-member-page.member-center-page {
  background-color: var(--cn-paper);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cg fill='none' stroke='%2326547C' stroke-width='1.1' opacity='0.05'%3E%3Ccircle cx='90' cy='90' r='26'/%3E%3Ccircle cx='90' cy='90' r='14'/%3E%3Cpath d='M90 64c-9-7-18-9-27-9 0 9 4 16 13 21'/%3E%3Cpath d='M90 64c9-7 18-9 27-9 0 9-4 16-13 21'/%3E%3Cpath d='M90 116c-9 7-18 9-27 9 0-9 4-16 13-21'/%3E%3Cpath d='M90 116c9 7 18 9 27 9 0-9-4-16-13-21'/%3E%3Cpath d='M90 64v-18M90 116v18M64 90H46M116 90h18'/%3E%3Cpath d='M30 30c7-9 21-9 28 0-9 5-19 5-28 0z'/%3E%3Cpath d='M150 30c-7-9-21-9-28 0 9 5 19 5 28 0z'/%3E%3Cpath d='M30 150c7 9 21 9 28 0-9-5-19-5-28 0z'/%3E%3Cpath d='M150 150c-7 9 21 9 28 0 9-5 19-5 28 0z'/%3E%3Cpath d='M90 90m-40 0a40 40 0 1 0 80 0a40 40 0 1 0-80 0' stroke-dasharray='3 6'/%3E%3C/g%3E%3C/svg%3E");
  background-size: 180px 180px;
  color: var(--cn-ink);
  font-family: var(--cn-body);
}
.cn-member-page .bg-grid { display: none; }
.cn-member-page .bg-glow { opacity: 0.18; filter: blur(130px); }
.cn-member-page .bg-glow.top-left { background: var(--cn-celadon); }
.cn-member-page .bg-glow.bottom-right { background: var(--cn-cobalt); }

/* ── 导航栏：浅色宣纸 + 青花下边线 ── */
.cn-member-page .nav-bar {
  background: rgba(246, 241, 227, 0.88);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(38, 84, 124, 0.18);
}
.cn-member-page .logo-text {
  color: var(--cn-cobalt-deep);
  font-family: var(--cn-serif);
  font-size: 1.05rem;
  letter-spacing: 3px;
}
.cn-member-page .nav-link { color: var(--cn-ink-soft); }
.cn-member-page .nav-link:hover { color: var(--cn-cinnabar); }
.cn-member-page .nav-user-badge {
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(38, 84, 124, 0.25);
  box-shadow: rgba(246, 241, 227, 0.9) 0 0 0 2px inset;
  border-radius: 22px;
}
.cn-member-page .nav-user-badge:hover { background: #fff; }
.cn-member-page .btn-outline { border-color: rgba(38, 84, 124, 0.4); color: var(--cn-cobalt); }
.cn-member-page .btn-outline:hover { border-color: var(--cn-cinnabar); color: var(--cn-cinnabar); }
.cn-member-page .center-content { padding-top: 96px; }

/* ── 会员 hero 卡：雨过天青 + 青花双线框 ── */
.cn-member-page .member-hero-card {
  background: linear-gradient(135deg, #7FB6C9 0%, var(--cn-celadon) 45%, var(--cn-celadon-deep) 100%) !important;
  border: none !important;
  border-radius: 20px;
  box-shadow: rgba(246, 241, 227, 0.9) 0 0 0 4px inset, rgba(38, 84, 124, 0.55) 0 0 0 6px inset, 0 10px 30px rgba(38, 84, 124, 0.18);
}
.cn-member-page .member-hero-card--free:hover,
.cn-member-page .member-hero-card--basic:hover,
.cn-member-page .member-hero-card--pro:hover,
.cn-member-page .member-hero-card--enterprise:hover,
.cn-member-page .member-hero-card--premium:hover,
.cn-member-page .member-hero-card--vip_year:hover,
.cn-member-page .member-hero-card--vip_platinum:hover {
  box-shadow: rgba(246, 241, 227, 0.9) 0 0 0 4px inset, rgba(38, 84, 124, 0.55) 0 0 0 6px inset, 0 14px 36px rgba(38, 84, 124, 0.25);
}
.cn-member-page .member-hero-card:hover { transform: translateY(-3px); }
.cn-member-page .member-hero-glow { opacity: 0.3; }
.cn-member-page .member-hero-name { color: var(--cn-paper-card); font-family: var(--cn-serif); letter-spacing: 1px; }
.cn-member-page .member-hero-email { color: rgba(251, 248, 239, 0.75); }
.cn-member-page .member-hero-stat-value { color: var(--cn-paper-card); }
.cn-member-page .member-hero-stat-label { color: rgba(251, 248, 239, 0.7); }
.cn-member-page .member-hero-stat-icon { filter: saturate(0.9); }
.cn-member-page .follow-stat-value { color: var(--cn-paper-card); }
.cn-member-page .follow-stat-label { color: rgba(251, 248, 239, 0.7); }
.cn-member-page .follow-divider { color: rgba(251, 248, 239, 0.6); }

/* 等级徽章 → 朱砂印章（高级等级保留金属色） */
.cn-member-page .member-tier-badge {
  background: var(--cn-cinnabar);
  color: var(--cn-paper-card);
  border: 1px solid rgba(140, 46, 36, 0.6);
  border-radius: 6px;
  box-shadow: rgba(251, 248, 239, 0.75) 0 0 0 2px inset;
  font-family: var(--cn-serif);
  letter-spacing: 1px;
  padding: 5px 14px;
}
.cn-member-page .member-tier-badge--premium { background: var(--cn-gold); border-color: rgba(139, 102, 45, 0.6); }
.cn-member-page .member-tier-badge--vip_platinum { background: #6A5ACD; border-color: rgba(82, 68, 161, 0.7); }
.cn-member-page .member-tier-badge--enterprise { background: var(--cn-celadon-deep); }

/* 升级按钮 → 朱砂印章 */
.cn-member-page .upgrade-main-btn {
  background: linear-gradient(135deg, #C24432, var(--cn-cinnabar)) !important;
  border-radius: 10px;
  box-shadow: rgba(251, 248, 239, 0.6) 0 0 0 2px inset, 0 4px 14px rgba(140, 46, 36, 0.35);
  color: var(--cn-paper-card);
  font-family: var(--cn-serif);
  letter-spacing: 2px;
  padding: 12px 28px;
  font-weight: 600;
}
.cn-member-page .upgrade-main-btn:hover { opacity: 0.92; }

/* ── 代理商面板 ── */
.cn-member-page .agent-panel {
  background: rgba(251, 248, 239, 0.92);
  border: 1px solid rgba(38, 84, 124, 0.25);
  border-radius: 16px;
  box-shadow: rgba(38, 84, 124, 0.16) 0 0 0 2px inset, 0 8px 24px rgba(38, 84, 124, 0.08);
}
.cn-member-page .agent-panel-title { color: var(--cn-cobalt); font-family: var(--cn-serif); }
.cn-member-page .agent-panel-desc { color: var(--cn-ink-soft); }
.cn-member-page .agent-panel-btn {
  background: var(--cn-cinnabar);
  color: var(--cn-paper-card);
  border: none;
  border-radius: 8px;
  font-weight: 600;
  box-shadow: rgba(251, 248, 239, 0.5) 0 0 0 1.5px inset;
}
.cn-member-page .agent-panel-btn:hover { background: var(--cn-cinnabar-deep); }
.cn-member-page .agent-stat-card {
  background: var(--cn-paper);
  border: 1px solid rgba(38, 84, 124, 0.18);
  border-radius: 12px;
}
.cn-member-page .agent-stat-value { color: var(--cn-cobalt); }
.cn-member-page .agent-stat-card:nth-child(2) .agent-stat-value { color: var(--cn-celadon-deep); }
.cn-member-page .agent-stat-card:nth-child(3) .agent-stat-value { color: var(--cn-gold); }
.cn-member-page .agent-stat-card:nth-child(4) .agent-stat-value { color: var(--cn-cinnabar); }
.cn-member-page .agent-stat-label { color: var(--cn-ink-soft); }
.cn-member-page .agent-panel-loading { color: var(--cn-ink-soft); }

/* ── 功能模块：宣纸青花卡片 ── */
.cn-member-page .member-modules--work { border-top-color: rgba(38, 84, 124, 0.15); }
.cn-member-page .work-module-title {
  font-family: var(--cn-serif);
  color: var(--cn-cobalt);
  font-size: 1.02rem;
  letter-spacing: 5px;
  display: flex;
  align-items: center;
  gap: 14px;
}
.cn-member-page .work-module-title::before,
.cn-member-page .work-module-title::after {
  content: '';
  flex: 1;
  height: 1px;
}
.cn-member-page .work-module-title::before {
  background: linear-gradient(90deg, transparent, rgba(38, 84, 124, 0.4));
}
.cn-member-page .work-module-title::after {
  background: linear-gradient(90deg, rgba(38, 84, 124, 0.4), transparent);
}
.cn-member-page .member-module {
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(38, 84, 124, 0.2);
  border-radius: 14px;
  box-shadow: rgba(38, 84, 124, 0.12) 0 0 0 1px inset, 0 2px 8px rgba(38, 84, 124, 0.06);
}
.cn-member-page .member-module:hover {
  background: #fff;
  border-color: rgba(38, 84, 124, 0.45);
  transform: translateY(-3px);
  box-shadow: rgba(38, 84, 124, 0.22) 0 0 0 1px inset, 0 8px 20px rgba(38, 84, 124, 0.1);
}
.cn-member-page .module-icon-area {
  background: linear-gradient(135deg, rgba(95, 168, 190, 0.22), rgba(38, 84, 124, 0.14)) !important;
  border: 1px solid rgba(38, 84, 124, 0.25);
  border-radius: 14px;
  box-shadow: rgba(246, 241, 227, 0.9) 0 0 0 1px inset;
}
.cn-member-page .module-title { color: var(--cn-ink); font-family: var(--cn-serif); font-size: 0.95rem; }
.cn-member-page .module-desc { color: var(--cn-ink-soft); }
.cn-member-page .module-arrow { color: var(--cn-celadon-deep); }
.cn-member-page .member-module:hover .module-arrow { color: var(--cn-cinnabar); }
.cn-member-page .storage-bar { background: rgba(38, 84, 124, 0.12); }
.cn-member-page .storage-bar-fill { background: linear-gradient(90deg, var(--cn-celadon), var(--cn-cobalt)); }

/* ── 弹窗（teleport 至 body → 全局覆盖） ── */
:global(html body .wallet-modal-mask), :global(html body .follow-mask){background: rgba(22, 58, 92, 0.5) !important; backdrop-filter: blur(6px)}
:global(html body .wallet-modal), :global(html body .follow-panel){background: var(--cn-paper-card) !important; border: 1px solid rgba(38, 84, 124, 0.3) !important; border-radius: 18px; box-shadow: rgba(38, 84, 124, 0.2) 0 0 0 3px inset, 0 24px 60px rgba(22, 58, 92, 0.35) !important}
:global(html body .wallet-modal-title){color: var(--cn-cobalt-deep) !important; font-family: var(--cn-serif); letter-spacing: 2px}
:global(html body .wallet-modal-close){background: rgba(38, 84, 124, 0.08) !important; color: var(--cn-cobalt) !important}
:global(html body .wallet-modal-close:hover){background: rgba(176, 58, 46, 0.12) !important; color: var(--cn-cinnabar) !important}
:global(html body .wallet-tabs){background: rgba(38, 84, 124, 0.08) !important}
:global(html body .wallet-tab){color: var(--cn-ink-soft) !important}
:global(html body .wallet-tab.active){background: var(--cn-cobalt) !important; color: var(--cn-paper-card) !important; font-weight: 600}
:global(html body .wallet-balance-card){background: linear-gradient(135deg, rgba(95, 168, 190, 0.25), rgba(38, 84, 124, 0.08)) !important; border: 1px solid rgba(38, 84, 124, 0.25) !important}
:global(html body .wallet-balance-label){color: var(--cn-ink-soft) !important}
:global(html body .wallet-balance-value){color: var(--cn-cobalt) !important; font-family: var(--cn-serif); letter-spacing: 1px}
:global(html body .wallet-balance-sub){color: var(--cn-ink-soft) !important}
:global(html body .wallet-quick-btn){border-color: rgba(38, 84, 124, 0.25) !important; background: rgba(255, 255, 255, 0.85) !important; color: var(--cn-ink) !important}
:global(html body .wallet-quick-btn:hover){background: #fff !important}
:global(html body .wallet-quick-btn.primary){background: linear-gradient(135deg, #C24432, var(--cn-cinnabar)) !important; border: none !important; color: var(--cn-paper-card) !important; font-weight: 600}
:global(html body .wallet-tip){color: var(--cn-ink-soft) !important; background: rgba(38, 84, 124, 0.06) !important}
:global(html body .wallet-section-title){color: var(--cn-cobalt) !important; font-weight: 600}
:global(html body .wallet-account-bound){background: rgba(255, 255, 255, 0.85) !important}
:global(html body .wallet-account-type){background: rgba(95, 168, 190, 0.2) !important; color: var(--cn-celadon-deep) !important}
:global(html body .wallet-account-name){color: var(--cn-ink) !important}
:global(html body .wallet-account-no){color: var(--cn-ink-soft) !important}
:global(html body .wallet-link-btn){color: var(--cn-celadon-deep) !important}
:global(html body .wallet-account-empty){background: rgba(255, 255, 255, 0.7) !important; border: 1px dashed rgba(38, 84, 124, 0.35) !important; color: var(--cn-ink-soft) !important}
:global(html body .wallet-account-empty:hover){border-color: var(--cn-cinnabar) !important; color: var(--cn-cinnabar) !important}
:global(html body .wallet-bind-form){background: rgba(255, 255, 255, 0.7) !important}
:global(html body .wallet-input){border-color: rgba(38, 84, 124, 0.25) !important; background: #fff !important; color: var(--cn-ink) !important}
:global(html body .wallet-input:focus){border-color: var(--cn-celadon) !important}
:global(html body .wallet-input::placeholder){color: var(--cn-ink-faint) !important}
:global(html body .wallet-btn){border-color: rgba(38, 84, 124, 0.25) !important; background: rgba(255, 255, 255, 0.85) !important; color: var(--cn-ink) !important}
:global(html body .wallet-btn.primary){background: linear-gradient(135deg, #C24432, var(--cn-cinnabar)) !important; border: none !important; color: var(--cn-paper-card) !important; font-weight: 600}
:global(html body .wallet-btn:disabled){opacity: 0.6}
:global(html body .wallet-msg){color: var(--cn-cinnabar) !important}
:global(html body .wallet-list-item){background: rgba(255, 255, 255, 0.7) !important}
:global(html body .wallet-list-title){color: var(--cn-ink) !important}
:global(html body .wallet-list-sub){color: var(--cn-ink-soft) !important}
:global(html body .wallet-list-amount.plus){color: var(--cn-celadon-deep) !important}
:global(html body .wallet-list-amount:not(.plus)){color: var(--cn-cinnabar) !important}
:global(html body .wallet-empty){color: var(--cn-ink-faint) !important}
:global(html body .follow-panel-head){border-bottom: 1px solid rgba(38, 84, 124, 0.12) !important}
:global(html body .follow-tab){color: var(--cn-ink-soft) !important}
:global(html body .follow-tab.active){color: var(--cn-cinnabar) !important; background: rgba(176, 58, 46, 0.1) !important}
:global(html body .follow-close){background: rgba(38, 84, 124, 0.08) !important; color: var(--cn-cobalt) !important; border-radius: 6px}
:global(html body .follow-empty){color: var(--cn-ink-faint) !important}
:global(html body .follow-item){border-bottom: 1px solid rgba(38, 84, 124, 0.08) !important}
:global(html body .follow-item-name){color: var(--cn-ink) !important}
:global(html body .follow-item-sub){color: var(--cn-ink-soft) !important}
:global(html body .follow-act-btn){background: rgba(38, 84, 124, 0.08) !important; color: var(--cn-cobalt) !important}
:global(html body .follow-act-btn:hover){background: rgba(38, 84, 124, 0.15) !important}
:global(html body .follow-btn){background: var(--cn-cinnabar) !important; color: var(--cn-paper-card) !important}
:global(html body .follow-btn.following){background: rgba(38, 84, 124, 0.1) !important; color: var(--cn-cobalt) !important}
:global(html body .rel-badge.rel-mutual){background: rgba(176, 58, 46, 0.12) !important; color: var(--cn-cinnabar) !important}
:global(html body .rel-badge.rel-following){background: rgba(38, 84, 124, 0.1) !important; color: var(--cn-cobalt) !important}
:global(html body .rel-badge.rel-follower){background: rgba(95, 168, 190, 0.15) !important; color: var(--cn-celadon-deep) !important}
</style>
