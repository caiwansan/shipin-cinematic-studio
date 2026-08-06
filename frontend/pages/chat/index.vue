<template>
  <div class="tea-page">
    <div v-if="toastMsg" class="tea-toast">{{ toastMsg }}</div>
    <!-- 顶栏 -->
    <header class="tea-header">
      <div class="tea-brand" @click="goHome" title="返回首页">
        <span class="tea-logo">🍵</span>
        <div class="tea-title-wrap">
          <h1 class="tea-title">昆仑茶馆</h1>
          <p class="tea-sub">昆仑镜 · 三栏控制台</p>
        </div>
      </div>
      <div class="tea-status" :class="tea.connected.value ? 'is-on' : tea.connecting.value ? 'is-connecting' : 'is-off'">
        <span class="status-dot"></span>
        {{ tea.statusLabel.value }}
      </div>
      <button v-if="tea.connected.value" class="tea-btn ghost" @click="handleDisconnect">断开</button>
      <button class="tea-btn ghost member-toggle" @click="rightPanelOpen = !rightPanelOpen">
        {{ rightPanelOpen ? '收起面板' : '成员/好友' }}
      </button>
    </header>

    <div class="tea-body">
      <!-- ══ 左栏：会话导航 ══ -->
      <aside class="tea-sidebar">
        <div class="sidebar-search">
          <span class="search-icon">🔍</span>
          <input v-model="search" class="search-input" placeholder="搜频道 / 搜好友" />
        </div>

        <!-- 公共频道 -->
        <div class="side-group">
          <div class="side-group-title">🏮 公共频道</div>
          <div
            v-for="ch in filteredPublic"
            :key="ch.id"
            class="channel-item"
            :class="{ active: isActive(ch) }"
            @click="switchChannel(ch)"
          >
            <span class="channel-icon">🏮</span>
            <div class="channel-meta">
              <span class="channel-name">{{ ch.name }}</span>
              <span class="channel-desc">{{ ch.desc }}</span>
            </div>
          </div>
        </div>

        <!-- 我的频道（P1 预留） -->
        <div class="side-group">
          <div class="side-group-title">📁 我的频道</div>
          <div v-if="!filteredGroups.length" class="side-empty">暂无频道 · 敬请期待</div>
          <div
            v-for="ch in filteredGroups"
            :key="ch.id"
            class="channel-item"
            :class="{ active: isActive(ch) }"
            @click="switchChannel(ch)"
          >
            <span class="channel-icon">👥</span>
            <div class="channel-meta">
              <span class="channel-name">{{ ch.name }}</span>
              <span class="channel-desc">{{ ch.desc }}</span>
            </div>
          </div>
        </div>

        <!-- 最近私聊 -->
        <div class="side-group">
          <div class="side-group-title">💬 最近私聊</div>
          <div v-if="!filteredDms.length" class="side-empty">暂无私聊 · 右边好友点一下就能开聊</div>
          <div
            v-for="ch in filteredDms"
            :key="ch.id"
            class="channel-item"
            :class="{ active: isActive(ch) }"
            @click="switchChannel(ch)"
          >
            <span class="channel-icon">👤</span>
            <div class="channel-meta">
              <span class="channel-name">{{ ch.name }}</span>
              <span class="channel-desc">{{ ch.desc }}</span>
            </div>
          </div>
        </div>

        <div class="sidebar-foot">
          <span class="foot-hint">图片/短视频/文件 · 红包礼物 · 语音视频（陆续上桌）</span>
        </div>
      </aside>

      <!-- ══ 中栏：聊天窗口 ══ -->
      <section class="tea-chat">
        <div v-if="authFailed" class="chat-empty">
          <span class="empty-emoji">🔐</span>
          <p>请先登录昆仑镜，再进茶馆喝茶</p>
          <NuxtLink to="/" class="tea-btn primary go-login">去登录</NuxtLink>
        </div>
        <div v-else-if="!currentChannel" class="chat-empty">
          <span class="empty-emoji">🍵</span>
          <p>选一个频道，开始摆龙门阵</p>
        </div>
        <template v-else>
          <div class="chat-head">
            <div class="chat-head-main">
              <span class="chat-head-icon">{{ currentChannel.kind === 'dm' ? '👤' : '🏮' }}</span>
              <div>
                <div class="chat-head-name">{{ currentChannel.name }}</div>
                <div class="chat-head-sub">{{ members.length ? `共 ${members.length} 位茶客` : (currentChannel.kind === 'dm' ? '私聊' : '公共频道') }}</div>
              </div>
            </div>
          </div>
          <div ref="msgListRef" class="msg-list">
            <div v-for="msg in displayMessages" :key="msg.key" class="msg-row" :class="{ mine: msg.fromUID === tea.userId.value }">
              <div class="msg-bubble">
                <div class="msg-meta">
                  <span class="msg-author">{{ msg.authorName || (msg.fromUID === tea.userId.value ? '我' : memberName(msg.fromUID) || shortUid(msg.fromUID)) }}</span>
                  <span class="msg-time">{{ fmtTime(msg.timestamp) }}</span>
                </div>
                <div class="msg-content" v-html="renderMsg(msg)"></div>
              </div>
            </div>
            <div v-if="loadingHistory" class="msg-loading">正在烫茶…</div>
          </div>

          <div class="msg-input-bar">
            <button class="gift-btn" title="送礼物" @click="openGiftPanel">🎁</button>
            <button class="gift-btn" title="表情" @click.stop="emojiPanelOpen = !emojiPanelOpen">😊</button>
            <button class="gift-btn" title="上传图片" @click="pickFile('image')">📷</button>
            <button class="gift-btn" title="上传文档" @click="pickFile('file')">📄</button>
            <input ref="fileInputRef" type="file" class="hidden-file-input" @change="onFilePicked" />
            <textarea
              v-model="draft"
              class="msg-input"
              placeholder="和茶客们聊聊…（Enter 发送，Shift+Enter 换行）"
              rows="2"
              @keydown.enter.exact.prevent="handleSend"
            ></textarea>
            <button class="tea-btn primary" :disabled="(!draft.trim() && !sendingMedia) || !tea.connected.value" @click="handleSend">{{ sendingMedia ? '上传中…' : '发送' }}</button>
            <Teleport to="body">
              <div v-if="emojiPanelOpen" class="emoji-panel" @click.stop>
                <div class="emoji-panel-grid">
                  <button v-for="e in emojiList" :key="e" class="emoji-cell" @click="insertEmoji(e)">{{ e }}</button>
                </div>
              </div>
            </Teleport>
          </div>
        </template>
      </section>

      <!-- ══ 礼物弹窗（抖音式礼物墙 + 钻石余额 + 充值） ══ -->
      <div v-if="giftPanelOpen" class="gift-modal-mask" @click.self="giftPanelOpen = false">
        <div class="gift-modal">
          <div class="gift-modal-head">
            <div class="gift-modal-title">🎁 送礼物</div>
            <div class="gift-diamond-balance">
              <span class="gift-diamond-icon">💎</span>
              <span class="gift-diamond-num">{{ diamondBalance }}</span>
              <router-link to="/user/diamonds" class="gift-recharge-btn">充值</router-link>
            </div>
            <button class="gift-modal-close" @click="giftPanelOpen = false">✕</button>
          </div>

          <!-- 接收人选择（非私聊需指定茶客） -->
          <div v-if="!isDmChannel" class="gift-receiver-row">
            <span class="gift-receiver-label">送给</span>
            <div class="gift-receiver-list">
              <button
                v-for="m in members"
                :key="m.uid"
                :class="['gift-receiver-chip', giftReceiverUid === m.uid ? 'gift-receiver-chip--active' : '']"
                @click="giftReceiverUid = m.uid"
              >{{ m.name || m.uid.slice(0, 6) }}</button>
              <span v-if="!members.length" class="gift-receiver-empty">暂无在线茶客</span>
            </div>
          </div>

          <!-- 礼物墙：分类 tab + 格子 -->
          <div class="gift-wall">
            <div class="gift-tabs">
              <button
                v-for="g in giftGroups"
                :key="g.category"
                :class="['gift-tab', giftActiveTab === g.category ? 'gift-tab--active' : '']"
                @click="giftActiveTab = g.category"
              >{{ g.category }}</button>
            </div>
            <div class="gift-grid">
              <button
                v-for="g in activeGiftItems"
                :key="g.id"
                :class="['gift-item', giftSelected?.id === g.id ? 'gift-item--active' : '']"
                @click="giftSelected = g"
              >
                <span class="gift-item-icon">{{ g.iconUrl || '🎁' }}</span>
                <span class="gift-item-name">{{ g.name }}</span>
                <span class="gift-item-price">💎{{ g.priceDiamonds }}</span>
              </button>
              <div v-if="!activeGiftItems.length" class="gift-grid-empty">该分类暂无礼物</div>
            </div>
          </div>

          <div class="gift-modal-foot">
            <div class="gift-foot-info">
              <template v-if="giftSelected">
                <span class="gift-foot-name">{{ giftSelected.iconUrl }} {{ giftSelected.name }}</span>
                <span class="gift-foot-price">💎 {{ giftSelected.priceDiamonds }}</span>
              </template>
              <span v-else class="gift-foot-empty">选择一份礼物</span>
            </div>
            <button
              class="gift-send-btn"
              :disabled="!giftSelected || !giftReceiverOk || giftSending"
              @click="sendGift"
            >
              {{ giftSending ? '发送中...' : (!giftSelected ? '选择礼物' : (!giftReceiverOk ? '选择接收人' : '赠送')) }}
            </button>
          </div>
        </div>
      </div>

      <!-- ══ 礼物全屏动画（收到/送出时播放） ══ -->
      <div v-if="giftAnimation" class="gift-anim">
        <div class="gift-anim-icon">{{ giftAnimation.icon || '🎁' }}</div>
        <div class="gift-anim-name">{{ giftAnimation.name }}</div>
        <div class="gift-anim-from">{{ giftAnimation.fromName }} 送给 {{ giftAnimation.toName }}</div>
      </div>

      <!-- ══ 右栏：成员 / 好友 ══ -->
      <aside class="tea-panel" :class="{ open: rightPanelOpen }">
        <div class="panel-tabs">
          <button class="panel-tab" :class="{ active: rightTab === 'members' }" @click="rightTab = 'members'">成员</button>
          <button class="panel-tab" :class="{ active: friendPanel }" @click.stop="toggleFriendPanel">好友</button>
        </div>

        <!-- 成员 tab：资料卡（好友菜单查看资料） > 私聊资料卡 > 频道成员列表 -->
        <div v-if="rightTab === 'members'" class="panel-body">
          <template v-if="profileUser">
            <div class="peer-card">
              <div class="peer-avatar">{{ profileUser.name.slice(0, 1) }}</div>
              <div class="peer-name">{{ profileUser.name }}</div>
              <div class="peer-sub">{{ profileUser.email || '平台茶客 · 茶馆名录' }}</div>
              <div class="peer-badge" :class="{ online: profileUser.online }">
                <span class="status-dot"></span>{{ profileUser.online ? '在线' : '离线' }}
              </div>
              <button class="profile-follow-btn" :class="{ following: followStatus[profileUser.id] }" @click="toggleFollowId(profileUser.id)">{{ followStatus[profileUser.id] ? '✓ 已关注' : '+ 关注' }}</button>
            </div>
          </template>
          <template v-else-if="currentChannel && currentChannel.kind === 'dm'">
            <div class="peer-card">
              <div class="peer-avatar">{{ (peerInfo?.name || currentChannel.name || '?').slice(0, 1) }}</div>
              <div class="peer-name">{{ peerInfo?.name || currentChannel.name }}</div>
              <div class="peer-sub">{{ peerInfo?.email || '私聊 · 一对一说悄悄话' }}</div>
              <div class="peer-badge" :class="{ online: peerOnline }">
                <span class="status-dot"></span>{{ peerOnline ? '在线' : '离线' }}
              </div>
            </div>
          </template>
          <template v-else>
            <div class="panel-section-title">在线 ({{ onlineMembers.length }})</div>
            <div v-if="!onlineMembers.length" class="panel-empty">暂时没有在线茶客</div>
            <div v-for="m in onlineMembers" :key="m.uid" class="member-item clickable" @click="openMemberCard(m, $event)">
              <div class="member-avatar">{{ (m.name || '?').slice(0, 1) }}</div>
              <div class="member-meta">
                <span class="member-name">{{ m.name || shortUid(m.uid) }} <span v-if="m.role === 2" class="bot-badge">🤖</span></span>
                <span class="member-sub">在线</span>
              </div>
            </div>
            <div class="panel-section-title">全部 ({{ members.length }})</div>
            <div v-if="!members.length" class="panel-empty">暂无成员</div>
            <div v-for="m in members" :key="m.uid" class="member-item clickable" @click="openMemberCard(m, $event)">
              <div class="member-avatar">{{ (m.name || '?').slice(0, 1) }}</div>
              <div class="member-meta">
                <span class="member-name">{{ m.name || shortUid(m.uid) }} <span v-if="m.uid === 'kunlun_tea_bot'" class="bot-badge">🤖 AI 客服</span><span v-else-if="m.role === 2" class="bot-badge">🤖</span></span>
                <span class="member-sub">{{ m.uid === 'kunlun_tea_bot' ? '随时在线 · 喊「小管家」' : (m.status === 1 ? '在线' : '离线') }}</span>
              </div>
            </div>
          </template>
        </div>
      </aside>

      <!-- ══ 好友独立下拉框：Teleport 到 body + fixed，列表在框内滚动，绝不影响聊天页面 ══ -->
      <Teleport to="body">
        <div v-if="friendPanel" class="friend-panel" @click.stop>
          <div class="friend-panel-head">
            <div class="friend-panel-tabs">
              <button class="friend-panel-tab" :class="{ active: friendTab === 'following' }" @click="switchFriendTab('following')">关注 {{ followStats.followingCount }}</button>
              <button class="friend-panel-tab" :class="{ active: friendTab === 'follower' }" @click="switchFriendTab('follower')">粉丝 {{ followStats.followerCount }}</button>
              <button class="friend-panel-tab" :class="{ active: friendTab === 'directory' }" @click="switchFriendTab('directory')">茶客名录</button>
            </div>
            <button class="friend-panel-close" @click="toggleFriendPanel">✕</button>
          </div>
          <input v-if="friendTab === 'directory'" v-model="friendSearch" class="friend-panel-search" placeholder="搜茶客…" />
          <div class="friend-panel-list" @wheel.stop>
            <!-- 我的关注（含互相关注） -->
            <template v-if="friendTab === 'following'">
              <div v-if="followLoading" class="panel-empty">加载中…</div>
              <div v-else-if="!followUsers.length" class="panel-empty">还没有关注任何人 · 去茶客名录看看</div>
              <div v-for="u in followUsers" :key="u.id" class="member-item">
                <div class="member-avatar">{{ (u.name || '?').slice(0, 1) }}</div>
                <div class="member-meta">
                  <span class="member-name">{{ u.name }}
                    <span v-if="u.relation === 'mutual'" class="rel-badge rel-mutual">互相关注</span>
                    <span v-else class="rel-badge rel-following">已关注</span>
                  </span>
                  <span class="member-sub"><span class="mini-dot" :class="{ on: u.online }"></span>{{ u.online ? '在线' : (u.email || '离线') }}</span>
                </div>
                <div class="member-actions">
                  <button class="mini-act-btn" @click="menuSend(u)">💬</button>
                  <button class="mini-follow-btn following" @click="toggleFollowUser(u)">{{ u.relation === 'mutual' ? '互相关注' : '已关注' }}</button>
                </div>
              </div>
            </template>
            <!-- 粉丝（关注我的，可回关） -->
            <template v-else-if="friendTab === 'follower'">
              <div v-if="followLoading" class="panel-empty">加载中…</div>
              <div v-else-if="!followerUsers.length" class="panel-empty">还没有粉丝 · 去茶馆坐坐吧</div>
              <div v-for="u in followerUsers" :key="u.id" class="member-item">
                <div class="member-avatar">{{ (u.name || '?').slice(0, 1) }}</div>
                <div class="member-meta">
                  <span class="member-name">{{ u.name }}
                    <span v-if="u.relation === 'mutual'" class="rel-badge rel-mutual">互相关注</span>
                    <span v-else class="rel-badge rel-follower">关注了我</span>
                  </span>
                  <span class="member-sub"><span class="mini-dot" :class="{ on: u.online }"></span>{{ u.online ? '在线' : (u.email || '离线') }}</span>
                </div>
                <div class="member-actions">
                  <button class="mini-act-btn" @click="menuSend(u)">💬</button>
                  <button class="mini-follow-btn" @click="toggleFollowUser(u)">{{ u.relation === 'mutual' ? '互相关注' : '回关' }}</button>
                </div>
              </div>
            </template>
            <!-- 茶客名录（全部用户，可搜索 + 关注） -->
            <template v-else>
              <div v-if="!filteredUsers.length" class="panel-empty">没有匹配的茶客</div>
              <div
                v-for="u in filteredUsers"
                :key="u.id"
                class="member-item clickable"
                :class="{ active: currentChannel?.kind === 'dm' && currentChannel.peerUid === u.id }"
                @click="openFriendMenu(u, $event)"
              >
                <div class="member-avatar">{{ u.name.slice(0, 1) }}</div>
                <div class="member-meta">
                  <span class="member-name">{{ u.name }}</span>
                  <span class="member-sub">
                    <span class="mini-dot" :class="{ on: u.online }"></span>{{ u.online ? '在线' : (u.email || '离线') }}
                  </span>
                </div>
                <div class="member-actions" @click.stop>
                  <button class="mini-follow-btn" :class="{ following: followStatus[u.id] }" @click="toggleFollowId(u.id)">{{ followStatus[u.id] ? '已关注' : '+ 关注' }}</button>
                </div>
              </div>
            </template>
          </div>
          <div class="friend-panel-foot">{{ friendTab === 'directory' ? '点茶客弹出菜单 · Esc 关闭' : '单方面关注 · 互相关注成好友' }}</div>
        </div>
      </Teleport>

      <!-- ══ 成员头像卡片：公共频道点成员弹出，可关注 / 发消息 ══ -->
      <Teleport to="body">
        <div v-if="memberCard" class="member-card" :style="{ left: memberCard.x + 'px', top: memberCard.y + 'px' }" @click.stop>
          <div class="mc-head">
            <div class="mc-avatar">{{ (memberCard.m.name || '?').slice(0, 1) }}</div>
            <div class="mc-meta">
              <div class="mc-name">{{ memberCard.m.name || shortUid(memberCard.m.uid) }}
                <span v-if="memberCard.m.role === 2" class="bot-badge">🤖</span>
              </div>
              <div class="mc-sub">
                <span class="status-dot" :class="{ on: memberCard.m.status === 1 }"></span>{{ memberCard.m.status === 1 ? '在线' : '离线' }}
                <span class="mc-platform">昆仑茶馆茶客</span>
              </div>
            </div>
            <button class="mc-close" @click="closeMemberCard">✕</button>
          </div>
          <div class="mc-body">
            <button class="mc-follow-btn" :class="{ following: followStatus[memberCard.m.uid] }" :disabled="followBusyId === memberCard.m.uid" @click="toggleFollowId(memberCard.m.uid)">{{ followStatus[memberCard.m.uid] ? '✓ 已关注' : '+ 关注' }}</button>
            <button class="mc-msg-btn" @click="menuSend({ id: memberCard.m.uid, email: '', name: memberCard.m.name || shortUid(memberCard.m.uid) })">💬 发消息</button>
          </div>
        </div>
      </Teleport>

      <!-- 好友悬浮下拉菜单：独立弹层（fixed），不撑页面 / 不触发整页滚动 -->
      <Teleport to="body">
        <div
          v-if="friendMenu"
          class="friend-menu"
          :style="{ left: friendMenu.x + 'px', top: friendMenu.y + 'px' }"
          @click.stop
        >
          <div class="friend-menu-head">
            <div class="friend-menu-avatar">{{ friendMenu.user.name.slice(0, 1) }}</div>
            <div class="friend-menu-meta">
              <div class="friend-menu-name">{{ friendMenu.user.name }}</div>
              <div class="friend-menu-sub">
                <span class="mini-dot" :class="{ on: friendMenu.user.online }"></span>
                {{ friendMenu.user.online ? '在线' : (friendMenu.user.email || '离线') }}
              </div>
            </div>
          </div>
          <button class="friend-menu-item" @click="menuSend(friendMenu.user)">💬 发消息</button>
          <button class="friend-menu-item" @click="menuProfile(friendMenu.user)">👤 查看资料</button>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<script setup lang="ts">
// 昆仑茶馆 — 三栏控制台（SPRINT-IM-CHA-02）
// 左栏：会话导航（公共频道 / 我的频道 / 最近私聊）｜中栏：聊天｜右栏：成员 / 好友
// SDK 仅浏览器可用，SSR 阶段不渲染逻辑
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useKunlunTea } from '~/composables/useKunlunTea'

const tea = useKunlunTea()
const route = useRoute()
const channels = ref<any[]>([])
const groups = ref<any[]>([])
const dms = ref<any[]>([])
const currentChannel = ref<any>(null)
const messages = ref<any[]>([])
const members = ref<any[]>([])
const users = ref<any[]>([])
const draft = ref('')
const loadingHistory = ref(false)
const authFailed = ref(false)
const msgListRef = ref<HTMLElement | null>(null)
const search = ref('')
const rightTab = ref<'members' | 'friends'>('members')
const rightPanelOpen = ref(true)
const friendMenu = ref<{ user: any; x: number; y: number } | null>(null)
const friendPanel = ref(false)
const friendSearch = ref('')
const profileUser = ref<any>(null)
const memberCard = ref<{ m: any; x: number; y: number } | null>(null)

// ══ USER-FOLLOW-01 关注体系（好友=关注） ══════════════════════
const friendTab = ref<'following' | 'follower' | 'directory'>('following')
const followStats = ref({ followingCount: 0, followerCount: 0 })
const followUsers = ref<any[]>([])
const followerUsers = ref<any[]>([])
const followLoading = ref(false)
const followBusyId = ref('')
const followStatus = ref<Record<string, boolean>>({})

const displayMessages = computed(() => messages.value)
const onlineMembers = computed(() => members.value.filter((m) => m.status === 1))
const peerUid = computed(() => (currentChannel.value?.kind === 'dm' ? currentChannel.value.peerUid : ''))
const peerInfo = computed(() => users.value.find((u) => u.id === peerUid.value) || null)
const peerOnline = computed(() => peerInfo.value?.online ?? false)

const filteredPublic = computed(() => channels.value.filter((c) => !search.value || c.name.includes(search.value)))
const filteredGroups = computed(() => groups.value.filter((c) => !search.value || c.name.includes(search.value)))
const filteredDms = computed(() => dms.value.filter((c) => !search.value || c.name.includes(search.value)))
const filteredUsers = computed(() => users.value.filter((u) => !friendSearch.value || u.name.includes(friendSearch.value)))

function followToken() {
  try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' }
}

async function loadFollowStats() {
  try {
    const res = await fetch('/api/user/follow/stats', { headers: { Authorization: 'Bearer ' + followToken() } })
    if (res.ok) { const j = await res.json(); if (j.data) followStats.value = j.data }
  } catch { /* 非致命 */ }
}

async function loadFollowList(type: 'following' | 'follower') {
  followLoading.value = true
  try {
    const res = await fetch('/api/user/follow/list?type=' + type, { headers: { Authorization: 'Bearer ' + followToken() } })
    if (res.ok) {
      const j = await res.json()
      if (type === 'following') followUsers.value = j.data?.users || []
      else followerUsers.value = j.data?.users || []
    }
  } catch { /* 非致命 */ } finally { followLoading.value = false }
}

async function switchFriendTab(tab: 'following' | 'follower' | 'directory') {
  friendTab.value = tab
  if (tab === 'following') {
    await loadFollowList('following')
  } else if (tab === 'follower') {
    await loadFollowList('follower')
  } else {
    await refreshFollowStatus()
  }
}

async function refreshFollowStatus() {
  const ids = users.value.map((u) => u.id).filter(Boolean)
  if (!ids.length) { followStatus.value = {}; return }
  try {
    const res = await fetch('/api/user/follow/status', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + followToken() },
      body: JSON.stringify({ targetIds: ids }),
    })
    if (res.ok) { const j = await res.json(); followStatus.value = j.data?.status || {} }
  } catch { /* 非致命 */ }
}

async function toggleFollowId(targetId: string) {
  if (followBusyId.value) return
  followBusyId.value = targetId
  try {
    const isFollowing = followStatus.value[targetId]
    const res = await fetch(isFollowing ? '/api/user/unfollow' : '/api/user/follow', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + followToken() },
      body: JSON.stringify({ targetId }),
    })
    if (res.ok) {
      followStatus.value = { ...followStatus.value, [targetId]: !isFollowing }
      loadFollowStats()
    }
  } catch { /* 非致命 */ } finally { followBusyId.value = '' }
}

async function toggleFollowUser(u: any) {
  if (followBusyId.value) return
  followBusyId.value = u.id
  try {
    if (u.relation === 'follower') {
      const res = await fetch('/api/user/follow', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + followToken() },
        body: JSON.stringify({ targetId: u.id }),
      })
      if (res.ok) u.relation = 'mutual'
    } else {
      const res = await fetch('/api/user/unfollow', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + followToken() },
        body: JSON.stringify({ targetId: u.id }),
      })
      if (res.ok) u.relation = 'follower'
    }
    loadFollowStats()
    followUsers.value = [...followUsers.value]
    followerUsers.value = [...followerUsers.value]
  } catch { /* 非致命 */ } finally { followBusyId.value = '' }
}

function isActive(ch: any) {
  return currentChannel.value && currentChannel.value.id === ch.id && currentChannel.value.type === ch.type
}

function shortUid(uid: string) {
  return uid ? uid.slice(0, 8) : '未知茶客'
}

function memberName(uid: string) {
  if (!uid) return ''
  // ① 当前频道成员表（imChannelMember，含平台昵称）
  const m = members.value.find((x) => x.uid === uid)
  if (m?.name) return m.name
  // ② 平台用户列表（好友 tab 数据源，username 即账号昵称）
  const u = users.value.find((x) => x.id === uid)
  if (u?.name) return u.name
  // ③ 按需批量解析（User 表）
  resolveNamesFor([uid])
  return ''
}

// 按需批量解析 uid → 账号昵称（异步补名，防抖去重）
let nameResolveTimer: ReturnType<typeof setTimeout> | null = null
let nameResolveQueue: string[] = []
async function resolveNamesFor(uids: string[]) {
  nameResolveQueue = [...new Set([...nameResolveQueue, ...uids])]
  if (nameResolveTimer) return
  nameResolveTimer = setTimeout(async () => {
    const q = [...nameResolveQueue]
    nameResolveQueue = []
    nameResolveTimer = null
    try {
      const names = await tea.resolveNames(q)
      if (!Object.keys(names).length) return
      // 补名后刷新消息作者显示（依赖 members/users 引用不变，直接更新消息对象）
      for (const [uid, name] of Object.entries(names)) {
        messages.value = messages.value.map((m: any) =>
          m.fromUID === uid && !m.authorName ? { ...m, authorName: name } : m
        )
      }
    } catch (e) {
      console.warn('[昆仑茶馆] 昵称解析失败', e)
    }
  }, 120)
}

function fmtTime(ts: number) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 提取礼物信息（三种形态：A content={kind:'gift'} / B content={type:2,content:{kind:'gift'}} / C payload base64 解码）
function extractGiftInfo(msg: any): any {
  if (!msg) return null
  const probe = (obj: any) => (obj && typeof obj === 'object' && obj.kind === 'gift' ? obj : null)
  // A：content 直接是礼物对象
  if (msg.content && typeof msg.content === 'object') {
    const a = probe(msg.content)
    if (a) return a
    // B：content = {type:2, content:{kind:'gift'}}
    const b = probe(msg.content.content)
    if (b) return b
  }
  // C：payload base64 解码
  if (msg.payload) {
    try {
      const bin = atob(msg.payload)
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
      const decoded = JSON.parse(new TextDecoder().decode(bytes))
      const c = decoded.content
      const hit = probe(c)
      if (hit) return hit
      if (c && typeof c === 'object') {
        const hit2 = probe(c.content)
        if (hit2) return hit2
      }
      return probe(decoded)
    } catch { return null }
  }
  return null
}

function renderMsg(msg: any) {
  const giftInfo = extractGiftInfo(msg)
  if (giftInfo) {
    return `<span class="gift-inline">🎁 ${escapeHtml(giftInfo.giftName || '礼物')} ${giftInfo.priceDiamonds ? `<b class="gift-inline-price">💎${giftInfo.priceDiamonds}</b>` : ''}</span>`
  }
  const parsed = parseContentObj(msg)
  if (!parsed) return ''
  const { type, content } = parsed
  // 图片（type=2）
  if (type === 2 && content && content.url) {
    const src = absUrl(content.url)
    return `<img class="msg-img" src="${src}" loading="lazy" onclick="window.__klImgView && window.__klImgView('${src}')" />`
  }
  // 文件/文档（type=3）
  if (type === 3 && content && content.url) {
    const name = escapeHtml(content.name || '文件')
    const size = fmtSize(content.size)
    return `<a class="msg-file" href="${absUrl(content.url)}" target="_blank" rel="noopener"><span class="msg-file-icon">📄</span><span class="msg-file-main"><span class="msg-file-name">${name}</span>${size ? `<small class="msg-file-size">${size}</small>` : ''}</span></a>`
  }
  // 视频（type=4）
  if (type === 4 && content && content.url) {
    return `<video class="msg-video" src="${absUrl(content.url)}" controls preload="metadata"></video>`
  }
  // 文本（type=1）
  const text = typeof content === 'string' ? content : typeof content?.text === 'string' ? content.text : typeof content?.content === 'string' ? content.content : ''
  return escapeHtml(text).replace(/\n/g, '<br/>')
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/* ══ 表情 + 媒体上传（EMOJI-MEDIA-01） ══════════════════ */
const emojiPanelOpen = ref(false)
const sendingMedia = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
let pendingPickKind: 'image' | 'file' = 'image'

const emojiList = [
  '😀', '😄', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘', '😜',
  '🤔', '🤗', '😎', '🥳', '😏', '😴', '🤤', '😭', '😤', '😡',
  '👍', '👏', '🙏', '💪', '👌', '🤝', '✌️', '🤞', '👀', '💯',
  '🔥', '✨', '🎉', '🎊', '💖', '💎', '🍵', '🐟', '🌙', '☀️',
  '🐼', '🦊', '🐱', '🐶', '🍀', '🎵', '⚡', '🌈',
]

function insertEmoji(e: string) {
  draft.value += e
  emojiPanelOpen.value = false
}

function pickFile(kind: 'image' | 'file') {
  pendingPickKind = kind
  const input = fileInputRef.value
  if (!input) return
  input.accept = kind === 'image' ? 'image/*' : ''
  input.value = ''
  input.click()
}

async function onFilePicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const kind = pendingPickKind
  input.value = ''
  if (sendingMedia.value) return showToast('⏳ 正在上传上一份，稍等')
  await sendMedia(file, kind)
}

function absUrl(u: string) {
  if (!u) return ''
  return /^https?:\/\//.test(u) ? u : 'https://aigc.fushtn.com' + (u.startsWith('/') ? u : '/' + u)
}

async function sendMedia(file: File, kind: 'image' | 'file') {
  if (!currentChannel.value || !tea.connected.value) return showToast('⚠ 请先连接茶馆')
  sendingMedia.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const up = await fetch('/api/im/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + giftToken() },
      body: fd,
    }).then((r) => r.json())
    if (!up.success) throw new Error(up.error || '上传失败')
    const { url, name, size } = up.data
    let width = 0, height = 0
    if (kind === 'image') {
      try {
        const img = new Image()
        img.src = absUrl(url)
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej })
        width = img.naturalWidth; height = img.naturalHeight
      } catch { /* 非致命 */ }
    }
    const res = await fetch('/api/im/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + giftToken() },
      body: JSON.stringify({
        channelId: currentChannel.value.id,
        channelType: currentChannel.value.type,
        contentType: kind === 'image' ? 2 : 3,
        content: { url, name, size, width, height },
      }),
    }).then((r) => r.json())
    if (!res.success) throw new Error(res.error || '发送失败')
    messages.value.push({
      fromUID: tea.userId.value,
      timestamp: Date.now(),
      content: { type: kind === 'image' ? 2 : 3, content: { url, name, size, width, height } },
      key: 'media-' + Math.random().toString(36).slice(2, 8),
    })
    scrollBottom()
    showToast(kind === 'image' ? '📷 图片已发送' : '📄 文档已发送')
  } catch (err) {
    console.error('[昆仑茶馆] 媒体发送失败', err)
    showToast('⚠ ' + ((err as Error).message || '发送失败'))
  } finally {
    sendingMedia.value = false
  }
}

/* 图片灯箱 */
function viewImage(src: string) {
  const mask = document.createElement('div')
  mask.className = 'img-lightbox'
  const img = document.createElement('img')
  img.src = src
  mask.appendChild(img)
  mask.onclick = () => mask.remove()
  document.body.appendChild(mask)
}

function parseContentObj(msg: any): { type: number; content: any } | null {
  if (msg.content) {
    if (typeof msg.content === 'string') return { type: 1, content: msg.content }
    if (typeof msg.content.type === 'number' && msg.content.content !== undefined) return { type: msg.content.type, content: msg.content.content }
    if (typeof msg.content.text === 'string') return { type: 1, content: msg.content.text }
    if (msg.content.url) return { type: 2, content: msg.content }
  }
  if (msg.payload) {
    try {
      const bin = atob(msg.payload)
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
      const decoded = JSON.parse(new TextDecoder().decode(bytes))
      if (decoded && typeof decoded === 'object') {
        return { type: decoded.type || 1, content: decoded.content ?? decoded }
      }
    } catch { /* 非致命 */ }
  }
  return null
}

function fmtSize(n: number) {
  if (!n) return ''
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(1) + ' MB'
}

function msgKey(msg: any) {
  return `${msg.clientMsgNo || ''}-${msg.messageSeq || ''}-${msg.timestamp || ''}-${Math.random().toString(36).slice(2, 6)}`
}

async function loadChannels() {
  const data = await tea.loadChannels()
  if (!data) {
    authFailed.value = true
    return
  }
  channels.value = data.public || []
  groups.value = data.groups || []
  dms.value = data.dms || []
  // 默认进入公共频道
  if (!currentChannel.value && channels.value.length) {
    switchChannel(channels.value[0])
  }
}

async function loadMembersFor(ch: any) {
  if (!ch || ch.kind === 'dm') return
  const ms = await tea.loadMembers(ch.id, ch.type)
  members.value = ms
}

async function loadUsers() {
  users.value = await tea.loadUsers()
}

async function loadHistory() {
  if (!currentChannel.value) return
  loadingHistory.value = true
  const msgs = await tea.loadHistory(currentChannel.value.id, currentChannel.value.type, 0, 50)
  messages.value = msgs
    .map((m: any) => ({
      ...m,
      // WuKongIM 历史消息字段是 from_uid（下划线），实时消息是 fromUID → 统一驼峰
      fromUID: m.fromUID || m.from_uid,
      key: msgKey(m),
    }))
    .sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0))
  loadingHistory.value = false
  scrollBottom()
}

async function switchChannel(ch: any) {
  profileUser.value = null
  currentChannel.value = ch
  messages.value = []
  members.value = []
  await Promise.all([loadHistory(), loadMembersFor(ch)])
  scrollBottom()
}

/** 点好友 → 创建/复用私聊频道 → 切到中栏（资料卡保留同人） */
async function openPrivate(u: any) {
  const data = await tea.ensurePrivate(u.id)
  if (!data) return
  const ch = {
    id: data.channel.id,
    type: data.channel.type,
    name: data.channel.name,
    desc: data.peer.email,
    kind: 'dm',
    peerUid: data.peer.id,
  }
  // 左栏最近私聊去重 + 置顶；关闭好友下拉框，右栏切「成员」tab 显示对方资料卡
  dms.value = [ch, ...dms.value.filter((d) => d.id !== ch.id)]
  currentChannel.value = ch
  friendPanel.value = false
  rightTab.value = 'members'
  syncBodyLock()
  messages.value = []
  members.value = []
  await loadHistory()
  scrollBottom()
}

/** 好友独立下拉框：打开/关闭（打开时锁定页面滚动，滚动只发生在框内） */
function toggleFriendPanel() {
  friendPanel.value = !friendPanel.value
  if (friendPanel.value) {
    rightTab.value = 'friends'
    closeFriendMenu()
    // 打开时按当前 tab 预载数据（USER-FOLLOW-01）
    if (friendTab.value === 'following') loadFollowList('following')
    else if (friendTab.value === 'follower') loadFollowList('follower')
    else refreshFollowStatus()
  }
  syncBodyLock()
}

/** 统一页面滚动锁：面板或菜单任一打开 → 锁死 body，聊天页面纹丝不动 */
function syncBodyLock() {
  document.body.style.overflow = friendPanel.value || friendMenu.value || memberCard.value ? 'hidden' : ''
}

/** 好友下拉菜单：定位（右侧/底部空间不足自动反弹）+ 锁定页面滚动 */
function openFriendMenu(u: any, e: MouseEvent) {
  // 关键：阻止本次 click 继续冒泡到 window 关闭监听器（否则菜单刚打开就被自己关掉）
  e.stopPropagation()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const MENU_W = 190
  const MENU_H = 138
  let x = Math.min(rect.left, window.innerWidth - MENU_W - 8)
  let y = rect.bottom + 6
  if (y + MENU_H > window.innerHeight) y = Math.max(8, rect.top - MENU_H - 6)
  // 兜底：任何情况下菜单都在视口内（防滚动后的项 rect 异常）
  x = Math.max(8, x)
  y = Math.max(8, y)
  friendMenu.value = { user: u, x, y }
  syncBodyLock()
}

function closeFriendMenu() {
  friendMenu.value = null
  syncBodyLock()
}

/** 成员头像卡片：公共频道点成员弹出，头像卡片内可关注/发消息 */
function openMemberCard(m: any, e: MouseEvent) {
  e.stopPropagation()
  // 先查关注状态（单用户）
  if (m.uid && followStatus[m.uid] === undefined) {
    fetch('/api/user/follow/status', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + followToken() },
      body: JSON.stringify({ targetIds: [m.uid] }),
    }).then((r) => r.json()).then((j) => {
      if (j.data?.status) followStatus.value = { ...followStatus.value, ...j.data.status }
    }).catch(() => {})
  }
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const W = 300, H = 150
  let x = Math.min(Math.max(8, rect.left + rect.width / 2 - W / 2), window.innerWidth - W - 8)
  let y = rect.bottom + 8
  if (y + H > window.innerHeight) y = Math.max(8, rect.top - H - 8)
  memberCard.value = { m, x, y }
  syncBodyLock()
}

function closeMemberCard() {
  memberCard.value = null
  syncBodyLock()
}

async function menuSend(u: any) {
  closeFriendMenu()
  closeMemberCard()
  await openPrivate(u)
}

function menuProfile(u: any) {
  closeFriendMenu()
  friendPanel.value = false
  syncBodyLock()
  profileUser.value = u
  rightTab.value = 'members'
}

// 发送送达追踪：SDK send 返回本地消息（messageSeq=0），服务端 Sendack 回执（clientSeq + reasonCode）
// 才是真正送达确认；超时未收到回执 = 连接异常静默丢消息 → toast 提示
const pendingSends = new Map<number, { clientSeq: number; clientMsgNo: string; warnTimer: ReturnType<typeof setTimeout> }>()
const toastMsg = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(text: string) {
  toastMsg.value = text
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMsg.value = ''
  }, 4000)
}

function trackSend(clientSeq: number, clientMsgNo: string, text: string) {
  const warnTimer = setTimeout(() => {
    if (pendingSends.has(clientSeq)) {
      pendingSends.delete(clientSeq)
      // 静默丢失：恢复草稿方便重试 + toast 提示（不再假装已发出）
      if (!draft.value) draft.value = text
      showToast('⚠ 消息可能未送达（网络不稳定），草稿已保留，请重试')
    }
  }, 8000)
  pendingSends.set(clientSeq, { clientSeq, clientMsgNo, text, warnTimer })
}

function markDelivered(clientSeq: number) {
  const p = pendingSends.get(clientSeq)
  if (p) {
    clearTimeout(p.warnTimer)
    pendingSends.delete(clientSeq)
  }
}

async function handleSend() {
  let text = draft.value.trim()
  if (!text || !tea.connected.value || !currentChannel.value) return
  // M3 敏感词即时替换（客户端，无感知）：词库缓存 5 分钟，命中替换为等长 *
  await ensureSensitiveWords()
  const safe = sanitizeText(text)
  if (safe !== text) {
    text = safe
    showToast('⚠ 已自动过滤敏感词汇')
  }
  draft.value = ''
  try {
    const msg = await tea.sendText(text, currentChannel.value.id, currentChannel.value.type)
    messages.value.push({ ...msg, key: msgKey(msg) })
    // clientSeq 在 SDK 本地消息对象上（send 返回的 message），Sendack 用它配对
    const clientSeq = msg.clientSeq ?? (msg as any).clientSeq
    if (typeof clientSeq === 'number') trackSend(clientSeq, msg.clientMsgNo || '', text)
    scrollBottom()
  } catch (e) {
    console.error('[昆仑茶馆] 发送失败', e)
    draft.value = text
    showToast('⚠ 发送失败，草稿已保留')
  }
}

// ══ M3 敏感词即时替换（SPRINT-IM-CHA-03） ═════════════════
const sensitiveWords = ref<string[]>([])
let sensitiveFetchedAt = 0

function authToken() {
  try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' }
}

async function ensureSensitiveWords() {
  if (sensitiveWords.value.length && Date.now() - sensitiveFetchedAt < 5 * 60 * 1000) return
  try {
    const res = await fetch('/api/im/sensitive-words', { headers: { Authorization: 'Bearer ' + authToken() } })
    if (res.ok) {
      const j = await res.json()
      if (j.data?.words) { sensitiveWords.value = j.data.words; sensitiveFetchedAt = Date.now() }
    }
  } catch { /* 非致命：服务端 webhook 兜底 */ }
}

function sanitizeText(text: string) {
  let out = text
  for (const w of sensitiveWords.value) {
    if (!w || !out.includes(w)) continue
    out = out.split(w).join('*'.repeat(w.length))
  }
  return out
}

// ══ 礼物体系（GIFT-GOLD-ECO-01） ══════════════════════
const giftPanelOpen = ref(false)
const giftGroups = ref<any[]>([])
const giftActiveTab = ref('热门')
const giftSelected = ref<any>(null)
const giftReceiverUid = ref('')
const giftSending = ref(false)
const diamondBalance = ref(0)
const giftAnimation = ref<any>(null)
let giftAnimTimer: ReturnType<typeof setTimeout> | null = null

function giftToken() {
  try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' }
}

const isDmChannel = computed(() => currentChannel.value?.kind === 'dm')
const giftReceiverOk = computed(() => (isDmChannel.value ? !!peerUid.value : !!giftReceiverUid.value))
const activeGiftItems = computed(() => giftGroups.value.find((g) => g.category === giftActiveTab.value)?.items || [])

async function loadDiamondBalance() {
  try {
    const r = await fetch('/api/user/diamonds', { headers: { Authorization: 'Bearer ' + giftToken() } })
    const j = await r.json()
    diamondBalance.value = (j.data || j).totalDiamonds || 0
  } catch { diamondBalance.value = 0 }
}

async function openGiftPanel() {
  if (!currentChannel.value) return
  giftPanelOpen.value = true
  giftSelected.value = null
  giftReceiverUid.value = ''
  // 群里必须显式指定接收人（掌柜 08-06：群里未指定接收人必须无法送）；私聊直接送给对方
  if (isDmChannel.value) {
    giftReceiverUid.value = peerUid.value
  } else {
    giftReceiverUid.value = ''
  }
  try {
    const r = await fetch('/api/gifts/products', { headers: { Authorization: 'Bearer ' + giftToken() } })
    const j = await r.json()
    giftGroups.value = (j.data || {}).gifts || []
    if (giftGroups.value.length) giftActiveTab.value = giftGroups.value[0].category
  } catch { giftGroups.value = [] }
  loadDiamondBalance()
}

function playGiftAnimation(gift: any, toName: string) {
  const g = {
    icon: gift.iconUrl || '🎁',
    name: gift.giftName || gift.name || '礼物',
    fromName: '我',
    toName: toName || '茶客',
  }
  giftAnimation.value = g
  if (giftAnimTimer) clearTimeout(giftAnimTimer)
  giftAnimTimer = setTimeout(() => { giftAnimation.value = null }, 3200)
}

async function sendGift() {
  if (!giftSelected.value || !giftReceiverOk.value || giftSending.value || !currentChannel.value) return
  const receiverUid = isDmChannel.value ? peerUid.value : giftReceiverUid.value
  giftSending.value = true
  try {
    const r = await fetch('/api/gifts/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + giftToken() },
      body: JSON.stringify({
        giftId: giftSelected.value.id,
        receiverUid,
        channelId: currentChannel.value.id,
        channelType: currentChannel.value.type,
      }),
    })
    const j = await r.json()
    if (j.success) {
      diamondBalance.value = Math.max(0, diamondBalance.value - (j.data?.gift?.priceDiamonds || giftSelected.value.priceDiamonds))
      const toName = isDmChannel.value
        ? currentChannel.value.name || '茶客'
        : (members.value.find((m) => m.uid === receiverUid)?.name || '茶客')
      playGiftAnimation(giftSelected.value, toName)
      // 服务端已代发礼物消息，本地即时补一条（不等 WS 推送）
      messages.value.push({
        fromUID: tea.userId.value,
        authorName: '我',
        timestamp: Math.floor(Date.now() / 1000),
        content: { kind: 'gift', giftName: giftSelected.value.name, giftIcon: giftSelected.value.iconUrl, priceDiamonds: giftSelected.value.priceDiamonds, receiverUid },
        key: 'gift-' + Date.now(),
      })
      scrollBottom()
      giftPanelOpen.value = false
      showToast(`🎁 已送出「${giftSelected.value.name}」`)
    } else {
      showToast('⚠ ' + (j.error || '赠送失败'))
      if (j.code === 'DIAMOND_INSUFFICIENT') loadDiamondBalance()
    }
  } catch (e) {
    console.error('[昆仑茶馆] 送礼失败', e)
    showToast('⚠ 赠送失败，请重试')
  } finally {
    giftSending.value = false
  }
}

function goHome() {
  // 顶栏 logo / 标题 → 返回首页（工作台）
  if (typeof window !== 'undefined') window.location.href = '/'
}

function handleDisconnect() {
  tea.disconnect()
}

function scrollBottom() {
  nextTick(() => {
    if (msgListRef.value) msgListRef.value.scrollTop = msgListRef.value.scrollHeight
  })
}

// 窄屏自动折叠右栏
function handleResize() {
  if (typeof window !== 'undefined') {
    rightPanelOpen.value = window.innerWidth >= 1100
  }
}

// 外部点击 / Esc 关闭：菜单 + 好友下拉框
function onWindowClick() {
  closeFriendMenu()
  closeMemberCard()
  emojiPanelOpen.value = false
  if (friendPanel.value) toggleFriendPanel()
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeFriendMenu()
    closeMemberCard()
    emojiPanelOpen.value = false
    if (friendPanel.value) toggleFriendPanel()
  }
}

onMounted(async () => {
  ;(window as any).__klImgView = (src: string) => viewImage(src)
  tea.onMessage((msg: any) => {
    const ch = currentChannel.value
    if (!ch) return
    const msgChannel = msg.channel
    if (msgChannel && (msgChannel.channelID !== ch.id || msgChannel.channelType !== ch.type)) return
    if (msg.fromUID === tea.userId.value) return
    messages.value.push({ ...msg, fromUID: msg.fromUID || msg.from_uid, key: msgKey(msg) })
    // 他人送的礼物 → 全屏动画（服务端代发 payload: {type:2, content:{kind:'gift'}}）
    const giftInfo = extractGiftInfo(msg)
    if (giftInfo) {
      const toName = giftInfo.receiverUid ? (members.value.find((m) => m.uid === giftInfo.receiverUid)?.name || '茶客') : '茶客'
      playGiftAnimation(giftInfo, toName)
    }
    scrollBottom()
  })
  // 发送回执：reasonCode 0/1 或 messageSeq>0 = 成功送达（WuKongIM 入库即成功，1 表示已持久化）；
  // 非 0 且无 seq = 失败；reasonCode=3（不在频道，容器重启丢订阅）→ 自动重订阅 + 重发
  tea.onSendStatus(async (p: any) => {
    const clientSeq = p?.clientSeq
    if (typeof clientSeq !== 'number') return
    const pend = pendingSends.get(clientSeq)
    if (!pend) return
    const delivered = p.reasonCode === 0 || p.reasonCode === 1 || (p.messageSeq && p.messageSeq > 0)
    if (delivered) {
      markDelivered(clientSeq)
      return
    }
    if (p.reasonCode === 3 && pend.text) {
      pendingSends.delete(clientSeq)
      clearTimeout(pend.warnTimer)
      const text = pend.text
      showToast('🔄 频道订阅已恢复，正在重发…')
      try {
        await tea.rejoin()
        if (currentChannel.value && tea.connected.value) {
          const msg = await tea.sendText(text, currentChannel.value.id, currentChannel.value.type)
          messages.value.push({ ...msg, key: msgKey(msg) })
          const cs = msg.clientSeq ?? (msg as any).clientSeq
          if (typeof cs === 'number') trackSend(cs, msg.clientMsgNo || '', text)
          scrollBottom()
        }
      } catch (e) {
        console.error('[昆仑茶馆] 自动重发失败', e)
        showToast('⚠ 发送失败，请重试')
      }
      return
    }
    pendingSends.delete(clientSeq)
    clearTimeout(pend.warnTimer)
    showToast('⚠ 消息发送失败（' + (p.reason || '连接异常') + '）')
  })

  await Promise.all([loadChannels(), loadUsers()])
  // USER-FOLLOW-01：关注统计 + 关注列表 + 名录关注状态点亮
  loadFollowStats()
  loadFollowList('following')
  loadFollowList('follower')
  refreshFollowStatus()
  try {
    await tea.connect()
  } catch (e) {
    console.error('[昆仑茶馆] 连接失败', e)
  }
  // ?dm=<uid> 直达私聊（会员中心关注列表「发消息」跳转）
  const dmUid = route.query.dm as string | undefined
  if (dmUid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dmUid)) {
    const target = users.value.find((u) => u.id === dmUid)
    await openPrivate(target || { id: dmUid, email: '', name: '茶客' })
  }
  handleResize()
  window.addEventListener('resize', handleResize)
  // 点好友弹独立菜单：外部点击 / Esc 关闭
  window.addEventListener('click', onWindowClick)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('click', onWindowClick)
  window.removeEventListener('keydown', onKeydown)
  ;(window as any).__klImgView = undefined
  closeFriendMenu()
  friendPanel.value = false
  syncBodyLock()
})
</script>

<style scoped>
.tea-toast {
  position: fixed;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  padding: 10px 18px;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.92);
  color: #fff;
  font-size: 13px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
  pointer-events: none;
  animation: teaToastIn 0.25s ease;
}
@keyframes teaToastIn {
  from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
.tea-page {
  /* 微信群模式：页面锁死在视口高度，消息再多也不撑高页面、不挤走输入框 */
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background:
    radial-gradient(1200px 500px at 20% -10%, rgba(59, 130, 246, 0.12), transparent 60%),
    radial-gradient(900px 400px at 90% 0%, rgba(139, 92, 246, 0.08), transparent 55%),
    var(--color-bg-primary, #070b16);
  color: var(--color-text-primary, #f1f5f9);
  display: flex;
  flex-direction: column;
}

/* ── 顶栏 ─────────────────────────── */
.tea-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-border-primary, #1e293b);
  background: rgba(13, 19, 40, 0.85);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 10;
}
.tea-brand { display: flex; align-items: center; gap: 12px; cursor: pointer; border-radius: 10px; padding: 4px 8px; margin-left: -8px; transition: background 0.2s; }
.tea-brand:hover { background: rgba(124, 92, 52, 0.1); }
.tea-logo {
  font-size: 26px;
  width: 46px; height: 46px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #1e5aa8, #3b82f6);
  border-radius: 14px;
  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.35);
}
.tea-title { font-size: 20px; font-weight: 700; letter-spacing: 2px; margin: 0; }
.tea-sub { font-size: 12px; color: var(--color-text-muted, #64748b); margin: 2px 0 0; }

.tea-status {
  margin-left: auto;
  display: flex; align-items: center; gap: 6px;
  font-size: 13px;
  padding: 5px 12px;
  border-radius: 20px;
  border: 1px solid var(--color-border-primary, #1e293b);
  color: var(--color-text-secondary, #94a3b8);
}
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: #64748b; display: inline-block; }
.tea-status.is-on { color: #10b981; border-color: rgba(16, 185, 129, 0.4); }
.tea-status.is-on .status-dot { background: #10b981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.7); }
.tea-status.is-connecting { color: #f59e0b; }
.tea-status.is-connecting .status-dot { background: #f59e0b; animation: blink 1s infinite; }
@keyframes blink { 50% { opacity: 0.3; } }
.member-toggle { display: none; }

/* ── 主体三栏 ─────────────────────── */
.tea-body {
  flex: 1;
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr) 260px;
  /* 行高锁死为剩余高度：中栏消息区内部滚动，输入框永不被挤出视口 */
  grid-template-rows: minmax(0, 1fr);
  min-height: 0;
}

/* 左栏 */
.tea-sidebar {
  border-right: 1px solid var(--color-border-primary, #1e293b);
  background: rgba(13, 19, 40, 0.6);
  padding: 12px 10px;
  display: flex; flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}
.sidebar-search {
  display: flex; align-items: center; gap: 8px;
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1e293b);
  border-radius: 10px;
  padding: 7px 10px;
}
.search-icon { font-size: 13px; opacity: 0.7; }
.search-input {
  flex: 1; background: transparent; border: none; outline: none;
  color: var(--color-text-primary, #f1f5f9); font-size: 13px;
}
.side-group { display: flex; flex-direction: column; gap: 3px; }
.side-group-title {
  font-size: 12px; color: var(--color-text-muted, #64748b);
  padding: 2px 8px 6px; letter-spacing: 1px; font-weight: 600;
}
.side-empty { font-size: 12px; color: var(--color-text-disabled, #475569); padding: 6px 10px; }
.channel-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s;
  border: 1px solid transparent;
}
.channel-item:hover { background: var(--color-bg-hover, #1a2240); }
.channel-item.active { background: rgba(59, 130, 246, 0.15); border-color: rgba(59, 130, 246, 0.3); }
.channel-icon { font-size: 18px; }
.channel-meta { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.channel-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.channel-desc { font-size: 11px; color: var(--color-text-muted, #64748b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sidebar-foot { margin-top: auto; padding: 8px 8px 0; font-size: 11px; color: var(--color-text-disabled, #475569); }

/* 中栏 */
.tea-chat { display: flex; flex-direction: column; min-height: 0; min-width: 0; }
.chat-head {
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-border-primary, #1e293b);
  background: rgba(13, 19, 40, 0.5);
  display: flex; align-items: center;
}
.chat-head-main { display: flex; align-items: center; gap: 10px; }
.chat-head-icon { font-size: 22px; }
.chat-head-name { font-size: 15px; font-weight: 700; }
.chat-head-sub { font-size: 11px; color: var(--color-text-muted, #64748b); }

.chat-empty {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; color: var(--color-text-muted, #64748b);
}
.empty-emoji { font-size: 48px; opacity: 0.6; }
.go-login { text-decoration: none; margin-top: 6px; }

.msg-list {
  flex: 1;
  min-height: 0; /* 允许收缩：消息多时在框内滚动，不撑高页面 */
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.msg-row { display: flex; }
.msg-row.mine { justify-content: flex-end; }
.msg-bubble {
  max-width: 62%;
  padding: 10px 14px;
  border-radius: 14px;
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1e293b);
}
.msg-row.mine .msg-bubble {
  background: linear-gradient(135deg, rgba(30, 90, 168, 0.35), rgba(59, 130, 246, 0.25));
  border-color: rgba(59, 130, 246, 0.35);
}
.msg-meta { display: flex; gap: 8px; align-items: baseline; margin-bottom: 4px; }
.msg-author { font-size: 12px; font-weight: 600; color: var(--color-decision, #3b82f6); }
.msg-row.mine .msg-author { color: var(--color-execution, #10b981); }
.msg-time { font-size: 11px; color: var(--color-text-disabled, #475569); }
.msg-content { font-size: 14px; line-height: 1.6; word-break: break-word; }
.msg-loading { text-align: center; font-size: 12px; color: var(--color-text-disabled, #475569); }

.msg-input-bar {
  display: flex; gap: 10px; align-items: flex-end;
  padding: 14px 20px 18px;
  border-top: 1px solid var(--color-border-primary, #1e293b);
  background: rgba(13, 19, 40, 0.8);
}

/* ══ 礼物体系（GIFT-GOLD-ECO-01） ══ */
.gift-btn {
  flex-shrink: 0;
  width: 42px; height: 42px;
  border-radius: 12px;
  border: 1px solid var(--color-border-primary, #1e293b);
  background: linear-gradient(135deg, #1e2a4a, #0f172a);
  color: #fbbf24;
  font-size: 20px;
  cursor: pointer;
  transition: transform 0.15s;
}
.gift-btn:hover { transform: scale(1.08); background: linear-gradient(135deg, #2a3a63, #16203a); }

.gift-inline {
  display: inline-flex; align-items: center; gap: 6px;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.08));
  border: 1px solid rgba(251, 191, 36, 0.35);
  border-radius: 10px;
  padding: 4px 10px;
  font-size: 14px;
  color: #fbbf24;
}
.gift-inline-price { color: #fff; font-weight: 700; }

/* 礼物弹窗 */
.gift-modal-mask {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(2, 6, 23, 0.72);
  backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center;
}
.gift-modal {
  width: 520px; max-width: 94vw;
  background: linear-gradient(180deg, #101a35, #0b1126);
  border: 1px solid #1e2b4f;
  border-radius: 18px;
  padding: 18px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
}
.gift-modal-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.gift-modal-title { font-size: 17px; font-weight: 700; color: #fff; flex: 1; }
.gift-diamond-balance {
  display: flex; align-items: center; gap: 6px;
  background: rgba(251, 191, 36, 0.12);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 999px;
  padding: 5px 12px;
}
.gift-diamond-icon { font-size: 15px; }
.gift-diamond-num { font-size: 15px; font-weight: 800; color: #fbbf24; min-width: 28px; text-align: center; }
.gift-recharge-btn {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #fff; border: none; border-radius: 999px;
  padding: 4px 14px; font-size: 12px; font-weight: 700;
  cursor: pointer; text-decoration: none;
}
.gift-modal-close {
  background: none; border: none; color: rgba(255, 255, 255, 0.4);
  font-size: 18px; cursor: pointer; padding: 4px;
}
.gift-modal-close:hover { color: #fff; }

.gift-receiver-row {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 12px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
}
.gift-receiver-label { font-size: 12px; color: rgba(255, 255, 255, 0.5); flex-shrink: 0; }
.gift-receiver-list { display: flex; flex-wrap: wrap; gap: 6px; max-height: 44px; overflow-y: auto; }
.gift-receiver-chip {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px; padding: 3px 10px;
  cursor: pointer;
}
.gift-receiver-chip--active { background: rgba(251, 191, 36, 0.2); border-color: #fbbf24; color: #fbbf24; }
.gift-receiver-empty { font-size: 12px; color: rgba(255, 255, 255, 0.35); }

.gift-wall { margin-bottom: 14px; }
.gift-tabs { display: flex; gap: 6px; margin-bottom: 10px; }
.gift-tab {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px; padding: 5px 16px;
  cursor: pointer;
}
.gift-tab--active { background: linear-gradient(135deg, #f59e0b, #d97706); border-color: transparent; color: #fff; font-weight: 700; }
.gift-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;
  max-height: 220px; overflow-y: auto;
}
.gift-item {
  background: rgba(255, 255, 255, 0.04);
  border: 1.5px solid rgba(255, 255, 255, 0.07);
  border-radius: 12px;
  padding: 10px 4px 8px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  cursor: pointer;
  transition: transform 0.12s, border-color 0.12s;
}
.gift-item:hover { transform: translateY(-2px); border-color: rgba(251, 191, 36, 0.4); }
.gift-item--active { border-color: #fbbf24; background: rgba(251, 191, 36, 0.12); box-shadow: 0 0 0 1px #fbbf24; }
.gift-item-icon { font-size: 30px; line-height: 1; }
.gift-item-name { font-size: 12px; color: rgba(255, 255, 255, 0.85); }
.gift-item-price { font-size: 11px; color: #fbbf24; font-weight: 700; }
.gift-grid-empty { grid-column: 1 / -1; text-align: center; color: rgba(255, 255, 255, 0.35); padding: 24px 0; font-size: 13px; }

.gift-modal-foot {
  display: flex; align-items: center; gap: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.gift-foot-info { flex: 1; display: flex; align-items: center; gap: 8px; min-height: 20px; }
.gift-foot-name { font-size: 14px; color: #fff; font-weight: 600; }
.gift-foot-price { font-size: 14px; color: #fbbf24; font-weight: 800; }
.gift-foot-empty { font-size: 13px; color: rgba(255, 255, 255, 0.35); }
.gift-send-btn {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  border: none; border-radius: 12px;
  color: #fff; font-size: 14px; font-weight: 700;
  padding: 10px 30px;
  cursor: pointer;
}
.gift-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* 礼物全屏动画 */
.gift-anim {
  position: fixed; inset: 0; z-index: 10000;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: radial-gradient(circle, rgba(251, 191, 36, 0.18), rgba(2, 6, 23, 0.35) 70%);
  pointer-events: none;
  animation: gift-anim-fade 3.2s ease forwards;
}
.gift-anim-icon {
  font-size: 96px;
  animation: gift-anim-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  filter: drop-shadow(0 12px 32px rgba(251, 191, 36, 0.5));
}
.gift-anim-name {
  margin-top: 12px;
  font-size: 26px; font-weight: 800; color: #fff;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
}
.gift-anim-from {
  margin-top: 6px;
  font-size: 15px; color: rgba(255, 255, 255, 0.85);
}
@keyframes gift-anim-pop {
  0% { transform: scale(0.2); opacity: 0; }
  60% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes gift-anim-fade {
  0% { opacity: 1; }
  72% { opacity: 1; }
  100% { opacity: 0; visibility: hidden; }
}
.msg-input {
  flex: 1;
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1e293b);
  border-radius: 12px;
  color: var(--color-text-primary, #f1f5f9);
  padding: 10px 14px;
  font-size: 14px;
  resize: none;
  outline: none;
  transition: border-color 0.2s;
}
.msg-input:focus { border-color: rgba(59, 130, 246, 0.6); }

/* 右栏 */
.tea-panel {
  border-left: 1px solid var(--color-border-primary, #1e293b);
  background: rgba(13, 19, 40, 0.6);
  display: flex; flex-direction: column;
  min-height: 0;
}
.panel-tabs {
  display: flex; gap: 4px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border-primary, #1e293b);
}
.panel-tab {
  flex: 1;
  background: transparent; border: 1px solid transparent;
  border-radius: 8px; padding: 6px 0;
  color: var(--color-text-muted, #64748b);
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: all 0.2s;
}
.panel-tab.active {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.3);
  color: var(--color-text-primary, #f1f5f9);
}
.panel-body { flex: 1; overflow-y: auto; padding: 12px; }
.panel-section-title {
  font-size: 12px; color: var(--color-text-muted, #64748b);
  padding: 8px 4px 6px; font-weight: 600;
}
.panel-empty { font-size: 12px; color: var(--color-text-disabled, #475569); padding: 8px 4px; }

.member-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
}
.member-item.clickable { cursor: pointer; transition: background 0.2s; }
.member-item.clickable:hover { background: var(--color-bg-hover, #1a2240); }
.member-item.active { background: rgba(59, 130, 246, 0.15); }
.member-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: linear-gradient(135deg, #1e5aa8, #3b82f6);
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.member-meta { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.member-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.member-sub { font-size: 11px; color: var(--color-text-muted, #64748b); }
.bot-badge { font-size: 11px; }
.mini-dot { width: 6px; height: 6px; border-radius: 50%; background: #64748b; display: inline-block; margin-right: 4px; }
.mini-dot.on { background: #10b981; box-shadow: 0 0 6px rgba(16, 185, 129, 0.7); }

/* ══ 好友独立下拉框：fixed 悬浮层，列表在框内滚动，聊天页面零影响 ══ */
.friend-panel {
  position: fixed;
  z-index: 9998;
  top: 64px;
  right: 12px;
  width: 300px;
  max-height: calc(100vh - 84px);
  display: flex;
  flex-direction: column;
  background: var(--color-bg-panel, #141a2e);
  border: 1px solid var(--color-border, #26304d);
  border-radius: 14px;
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.55);
  overflow: hidden;
  animation: panel-pop 0.18s ease-out;
}
@keyframes panel-pop {
  from { opacity: 0; transform: translateY(-8px) scale(0.98); }
  to { opacity: 1; transform: none; }
}
.friend-panel-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px 8px;
  gap: 8px;
}
.friend-panel-tabs {
  display: flex; gap: 4px; flex-wrap: wrap;
}
.friend-panel-tab {
  background: none; border: 1px solid transparent;
  color: var(--color-text-muted, #64748b);
  font-size: 12px; font-weight: 600;
  padding: 4px 10px; border-radius: 20px;
  cursor: pointer; transition: all 0.15s;
}
.friend-panel-tab.active {
  color: #fff;
  background: rgba(59, 130, 246, 0.18);
  border-color: rgba(59, 130, 246, 0.35);
}
/* 列表项右侧操作（关注/发消息） */
.member-actions {
  display: flex; align-items: center; gap: 4px; margin-left: auto; flex-shrink: 0;
}
.mini-act-btn {
  width: 26px; height: 26px; border-radius: 8px;
  border: 0; background: rgba(255, 255, 255, 0.06);
  font-size: 13px; cursor: pointer; transition: all 0.15s;
}
.mini-act-btn:hover { background: rgba(59, 130, 246, 0.25); }
.mini-follow-btn {
  border: 0; font-size: 11px; font-weight: 600;
  padding: 4px 10px; border-radius: 20px; cursor: pointer;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #141a2e; transition: all 0.15s;
}
.mini-follow-btn:hover { filter: brightness(1.1); }
.mini-follow-btn.following {
  background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.55);
}
.rel-badge {
  font-size: 10px; padding: 1px 6px; border-radius: 8px; margin-left: 4px;
  white-space: nowrap; vertical-align: 1px;
}
.rel-mutual { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
.rel-following { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
.rel-follower { background: rgba(16, 185, 129, 0.15); color: #34d399; }
/* 资料卡关注按钮 */
.profile-follow-btn {
  margin-top: 10px;
  border: 0; font-size: 12px; font-weight: 600;
  padding: 6px 16px; border-radius: 20px; cursor: pointer;
  background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #141a2e;
  transition: all 0.15s;
}
.profile-follow-btn.following {
  background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.6);
}

/* ══ 成员头像卡片（公共频道点成员弹出） ══ */
.member-card {
  position: fixed;
  z-index: 9999;
  width: 300px;
  background: var(--color-bg-panel, #141a2e);
  border: 1px solid var(--color-border, #26304d);
  border-radius: 14px;
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.55);
  padding: 14px;
  animation: panel-pop 0.18s ease-out;
}
.mc-head {
  display: flex; align-items: center; gap: 12px;
}
.mc-avatar {
  width: 52px; height: 52px; border-radius: 50%;
  background: linear-gradient(135deg, #1e5aa8, #3b82f6);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 700; color: #fff; flex-shrink: 0;
  box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35);
}
.mc-meta {
  flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px;
}
.mc-name {
  font-size: 15px; font-weight: 700; color: var(--color-text, #e2e8f0);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.mc-sub {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--color-text-muted, #64748b);
}
.mc-platform {
  font-size: 10px; padding: 1px 6px; border-radius: 8px;
  background: rgba(255, 255, 255, 0.06); color: rgba(255, 255, 255, 0.4);
}
.mc-close {
  width: 24px; height: 24px; border-radius: 50%;
  border: 0; background: transparent;
  color: var(--color-text-muted, #64748b);
  font-size: 13px; line-height: 1; cursor: pointer;
  transition: all 0.2s; flex-shrink: 0;
}
.mc-close:hover { background: rgba(239, 68, 68, 0.15); color: #f87171; }
.mc-body {
  display: flex; gap: 8px; margin-top: 12px;
  padding-top: 12px; border-top: 1px solid var(--color-border-primary, #1e293b);
}
.mc-follow-btn, .mc-msg-btn {
  flex: 1;
  border: 0; font-size: 12px; font-weight: 600;
  padding: 8px 0; border-radius: 20px; cursor: pointer;
  transition: all 0.15s;
}
.mc-follow-btn {
  background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #141a2e;
}
.mc-follow-btn.following {
  background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.6);
}
.mc-follow-btn:disabled { opacity: 0.5; pointer-events: none; }
.mc-msg-btn {
  background: rgba(59, 130, 246, 0.18); color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
}
.mc-msg-btn:hover { background: rgba(59, 130, 246, 0.3); }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: #64748b; display: inline-block; }
.status-dot.on { background: #10b981; box-shadow: 0 0 6px rgba(16, 185, 129, 0.7); }

/* ══ 表情面板 + 媒体消息（EMOJI-MEDIA-01） ══ */
.hidden-file-input { display: none; }
.emoji-panel {
  position: fixed;
  z-index: 9999;
  bottom: 96px;
  left: 50%;
  transform: translateX(-50%);
  width: 372px;
  max-width: calc(100vw - 32px);
  background: var(--color-bg-panel, #141a2e);
  border: 1px solid var(--color-border, #26304d);
  border-radius: 14px;
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.55);
  padding: 10px;
  animation: panel-pop 0.18s ease-out;
}
.emoji-panel-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
  max-height: 240px;
  overflow-y: auto;
}
.emoji-cell {
  background: transparent;
  border: 0;
  font-size: 22px;
  line-height: 1.4;
  padding: 4px 0;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s;
}
.emoji-cell:hover { background: rgba(255, 255, 255, 0.08); }

.msg-img {
  max-width: 260px;
  max-height: 300px;
  border-radius: 10px;
  display: block;
  cursor: zoom-in;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.msg-file {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  text-decoration: none;
  color: var(--color-text, #e2e8f0);
  max-width: 260px;
  transition: background 0.15s;
}
.msg-file:hover { background: rgba(255, 255, 255, 0.12); }
.msg-file-icon { font-size: 24px; }
.msg-file-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.msg-file-name {
  font-size: 13px;
  font-weight: 600;
  color: #60a5fa;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.msg-file-size { font-size: 11px; color: var(--color-text-muted, #64748b); }
.msg-video {
  max-width: 280px;
  max-height: 300px;
  border-radius: 10px;
  display: block;
}
.img-lightbox {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
  animation: panel-pop 0.15s ease-out;
}
.img-lightbox img {
  max-width: 92vw;
  max-height: 92vh;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
}
.friend-panel-title {
  font-size: 13px; font-weight: 700; color: var(--color-text, #e2e8f0);
  letter-spacing: 0.02em;
}
.friend-panel-close {
  width: 24px; height: 24px; border-radius: 50%;
  border: 0; background: transparent;
  color: var(--color-text-muted, #64748b);
  font-size: 13px; line-height: 1; cursor: pointer;
  transition: all 0.2s;
}
.friend-panel-close:hover { background: rgba(239, 68, 68, 0.15); color: #f87171; }
.friend-panel-search {
  margin: 0 12px 8px;
  background: rgba(7, 11, 22, 0.6);
  border: 1px solid var(--color-border-primary, #1e293b);
  border-radius: 8px;
  padding: 7px 10px;
  color: var(--color-text-primary, #f1f5f9);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}
.friend-panel-search:focus { border-color: rgba(59, 130, 246, 0.6); }
/* 核心：列表固定区域 + 框内独立滚动（overscroll 不穿透到页面） */
.friend-panel-list {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 8px 8px;
  min-height: 60px;
}
.friend-panel-foot {
  padding: 8px 12px;
  border-top: 1px solid var(--color-border-primary, #1e293b);
  font-size: 11px; color: var(--color-text-disabled, #475569);
  text-align: center;
}

/* 好友悬浮下拉菜单：独立弹层（fixed），不撑页面 / 不触发整页滚动 */
.friend-menu {
  position: fixed;
  z-index: 9999;
  width: 190px;
  background: var(--color-bg-panel, #141a2e);
  border: 1px solid var(--color-border, #26304d);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  padding: 8px;
  animation: menu-pop 0.15s ease-out;
}
@keyframes menu-pop {
  from { opacity: 0; transform: translateY(-4px) scale(0.98); }
  to { opacity: 1; transform: none; }
}
.friend-menu-head {
  display: flex; gap: 9px; align-items: center;
  padding: 4px 8px 9px;
  border-bottom: 1px solid var(--color-border, #26304d);
  margin-bottom: 6px;
}
.friend-menu-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: linear-gradient(135deg, #f59e0b, #b45309);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 700; flex-shrink: 0;
}
.friend-menu-meta { min-width: 0; }
.friend-menu-name { font-size: 13px; font-weight: 600; color: var(--color-text, #e2e8f0); }
.friend-menu-sub { font-size: 11px; color: var(--color-text-muted, #64748b); margin-top: 2px; }
.friend-menu-item {
  display: flex; align-items: center; gap: 8px;
  width: 100%; text-align: left;
  padding: 8px 10px; border: 0; border-radius: 8px;
  background: transparent; color: var(--color-text, #e2e8f0);
  font-size: 13px; cursor: pointer;
}
.friend-menu-item:hover { background: rgba(59, 130, 246, 0.15); }

/* 私聊资料卡 */
.peer-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 28px 12px 20px;
}
.peer-avatar {
  width: 72px; height: 72px; border-radius: 50%;
  background: linear-gradient(135deg, #1e5aa8, #3b82f6);
  display: flex; align-items: center; justify-content: center;
  font-size: 30px; font-weight: 700; color: #fff;
  box-shadow: 0 8px 30px rgba(59, 130, 246, 0.35);
}
.peer-name { font-size: 16px; font-weight: 700; margin-top: 6px; }
.peer-sub { font-size: 12px; color: var(--color-text-muted, #64748b); }
.peer-badge {
  display: flex; align-items: center; gap: 5px;
  font-size: 12px; color: #64748b;
  padding: 3px 10px; border-radius: 20px;
  border: 1px solid var(--color-border-primary, #1e293b);
  margin-top: 4px;
}
.peer-badge.online { color: #10b981; border-color: rgba(16, 185, 129, 0.4); }
.peer-badge.online .status-dot { background: #10b981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.7); }

/* 按钮 */
.tea-btn {
  border: none; border-radius: 10px;
  padding: 9px 18px;
  font-size: 14px; font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}
.tea-btn.primary {
  background: linear-gradient(135deg, #1e5aa8, #3b82f6);
  color: #fff;
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3);
}
.tea-btn.primary:disabled { opacity: 0.4; cursor: not-allowed; }
.tea-btn.primary:not(:disabled):hover { transform: translateY(-1px); }
.tea-btn.ghost {
  background: transparent;
  border: 1px solid var(--color-border-primary, #1e293b);
  color: var(--color-text-secondary, #94a3b8);
  padding: 6px 12px; font-size: 12px;
}
.tea-btn.ghost:hover { color: #f87171; border-color: rgba(248, 113, 113, 0.4); }

/* 响应式：<1100px 右栏收成抽屉 */
@media (max-width: 1100px) {
  .tea-body { grid-template-columns: 250px minmax(0, 1fr); }
  .tea-panel {
    position: fixed; right: 0; top: 64px; bottom: 0; width: 280px;
    transform: translateX(105%);
    transition: transform 0.25s ease;
    z-index: 20;
    box-shadow: -12px 0 40px rgba(0, 0, 0, 0.4);
    border-left: 1px solid var(--color-border-primary, #1e293b);
  }
  .tea-panel.open { transform: translateX(0); }
  .member-toggle { display: inline-block; }
}
@media (max-width: 768px) {
  .tea-body { grid-template-columns: 1fr; }
  .tea-sidebar { display: none; }
  .tea-panel { top: 56px; width: 260px; }
}
</style>
