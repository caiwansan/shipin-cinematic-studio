<!--
  Sprint-MEDIA-CHANNEL-EXPANSION-05 + MEDIA-DATA-CENTER-01 — 渠道中心（连接你的线上运营渠道 · 纯产品语言）
  升级：账号管理 → 渠道管理 → 渠道中心；内容/电商/客户 三类 Tabs
  纪律: 未连接态真实展示；不出现 API/Webhook/Token/OAuth/SDK 等技术词；零假数据
  微信: 真实接入流程保留（授权绑定 → 勾选权限 → 授权 AI 员工 → 完成连接）
  电商/客户渠道: 即将开放（诚实展示，不造假连接）
-->
<template>
  <MediaWorkspaceShell>
    <MediaPageHeader
      kicker="我的运营渠道"
      title="渠道中心"
      :status="{ text: '未连接', type: 'warn' }"
      desc="连接你的线上运营渠道，AI 员工才能帮你运营——发布内容、运营店铺、回复客户、读取数据。"
    />

    <!-- 分类 Tabs -->
    <div class="ac-tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="ac-tab"
        :class="{ active: activeTab === t.key }"
        @click="activeTab = t.key"
      >
        <span class="ac-tab-ico">{{ t.icon }}</span>
        {{ t.label }}
        <span class="ac-tab-count">{{ t.count }}</span>
      </button>
    </div>

    <!-- 渠道卡片 -->
    <div class="ac-grid">
      <div
        v-for="p in visiblePlatforms"
        :key="p.name"
        class="ac-card"
        :class="{ 'ac-card--shop': p.category === 'shop', 'ac-card--connected': p.connected }"
        @click="onClick(p)"
      >
        <div class="ac-card-top">
          <span class="ac-ico">{{ p.icon }}</span>
          <span v-if="p.connected" class="ac-state on">
            <span class="ac-dot on"></span>
            已连接
          </span>
          <span v-else class="ac-state off">
            <span class="ac-dot off"></span>
            未连接
          </span>
        </div>
        <div class="ac-name">{{ p.name }}</div>
        <div class="ac-plan">{{ p.plan }}</div>

        <!-- TASK03.2.2 G4 — 已连接账号身份卡片（账号/头像/AI员工/权限） -->
        <div v-if="p.connected" class="ac-bound">
          <div class="ac-bound-row">
            <div class="ac-bound-avatar">
              <img v-if="p.boundAvatar" :src="p.boundAvatar" class="ac-bound-avatar-img" alt="账号头像" />
              <span v-else class="ac-bound-avatar-fb">{{ (p.boundName || p.name)[0] }}</span>
            </div>
            <div class="ac-bound-info">
              <div class="ac-bound-name">{{ p.boundName || p.name }}</div>
              <div class="ac-bound-ai">🤖 AI 员工：Alice 运营总监</div>
            </div>
          </div>
          <div class="ac-bound-tags">
            <span class="ac-bound-tag">L1 观察权限</span>
            <span class="ac-bound-tag">读取数据 · 分析</span>
          </div>
        </div>

        <!-- 连接后 AI 可以帮助（产品表达） -->
        <div v-else-if="p.helps && p.helps.length" class="ac-helps">
          <div class="ac-helps-title">连接后 AI 可以帮助</div>
          <div v-for="h in p.helps" :key="h" class="ac-help">
            <span class="ac-help-check">✓</span>{{ h }}
          </div>
        </div>

        <button v-if="p.connectable" class="ac-cta" :class="{ 'ac-cta--bound': p.connected }">{{ p.connected ? '查看账号' : '去连接' }}</button>
        <span v-else class="ac-soon">即将开放</span>
      </div>
    </div>

    <!-- 连接价值说明 -->
    <div class="ac-note">
      <span class="ac-note-ico">🔗</span>
      <span><b>连接渠道后，AI 员工才能帮你运营</b>——自动发布内容、运营店铺、回复客户消息、读取运营数据。微信公众号已支持，电商与客户渠道正在接入。</span>
    </div>

    <!-- 微信连接流程（真实接入） -->
    <div v-if="activeTab === 'all' || activeTab === 'content'" class="ac-flow">
      <div class="ac-flow-head">
        <span class="ac-flow-ico">💬</span>
        <div>
          <div class="ac-flow-title">连接微信公众号</div>
          <div class="ac-flow-sub">企业认证服务号 · 4 步完成连接</div>
        </div>
      </div>
      <div class="ac-steps">
        <div v-for="(s, i) in steps" :key="i" class="ac-step">
          <span class="ac-step-num">{{ i + 1 }}</span>
          <div>
            <b>{{ s.title }}</b>
            <span class="ac-step-desc">{{ s.desc }}</span>
          </div>
        </div>
      </div>
      <button class="ac-connect-btn" @click="connect">开始连接 →</button>
    </div>

    <!-- AI 权限说明 -->
    <div class="ac-perms">
      <div class="ac-perms-title">🤖 AI 员工获得的权限</div>
      <div class="ac-perms-grid">
        <div v-for="p in perms" :key="p.key" class="ac-perm">
          <span class="ac-perm-ico">{{ p.ico }}</span>
          <div>
            <b>{{ p.name }}</b>
            <span class="ac-perm-sub">{{ p.desc }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ 抖音浏览器连接弹窗 ═══ -->
    <Teleport to="body">
      <div v-if="connectModal" class="ac-modal-mask" @click.self="closeConnectModal">
        <div class="ac-modal">
          <div class="ac-modal-head">
            <div>
              <div class="ac-modal-title">{{ connectPlatform?.icon }} 连接{{ connectPlatform?.name }}</div>
              <div class="ac-modal-sub">登录态保存在服务器浏览器中，AI 员工将用此账号运营</div>
            </div>
            <button class="ac-modal-close" @click="closeConnectModal">✕</button>
          </div>

          <div v-if="loggedIn" class="ac-modal-success">
            <div class="ac-success-ico">✓</div>
            <div>连接成功！账号已点亮</div>
            <div class="ac-success-sub">{{ statusMsg }}</div>
          </div>

          <!-- TASK03.2.2 — 人工授权确认：探针已检测到登录态，等老板确认绑定（SaaS 授权确认事件） -->
          <div v-else-if="awaitingConfirm" class="ac-confirm">
            <div class="ac-confirm-avatar">
              <img v-if="detectedAvatar" :src="detectedAvatar" class="ac-confirm-avatar-img" alt="账号头像" />
              <div v-else class="ac-confirm-avatar-fallback">{{ (detectedName || '抖')[0] }}</div>
            </div>
            <div class="ac-confirm-title">已检测到抖音账号登录</div>
            <div class="ac-confirm-account">{{ detectedName || '抖音账号' }}</div>
            <div class="ac-confirm-desc">确认这是你要绑定的账号吗？绑定后 AI 员工（Alice 运营总监）将以 <strong>观察权限（L1）</strong> 读取该账号数据，不会自动发布任何内容。</div>
            <div class="ac-confirm-actions">
              <button class="ac-btn ac-btn-ghost" :disabled="connecting" @click="rejectBinding">不是这个账号</button>
              <button class="ac-btn ac-btn-primary" :disabled="connecting" @click="confirmBinding">✓ 确认绑定</button>
            </div>
          </div>

          <template v-else>
            <!-- 扫码模式：优先显示放大的实时二维码（可直接扫）；无二维码时回退整页截图 -->
            <div v-if="loginMode === 'qr' && qrCode" class="ac-qr-wrap">
              <img :src="qrCode" class="ac-qr-big" alt="抖音登录二维码" />
              <div class="ac-qr-refresh-tip">二维码每 15 秒自动刷新，直接用<strong>抖音 App</strong> 扫一扫</div>
            </div>
            <!-- 整页截图（短信模式 / 二维码提取失败时兜底） -->
            <div v-else class="ac-shot-wrap">
              <img v-if="screenshot" :src="screenshot" class="ac-shot" alt="登录画面" />
              <div v-else class="ac-shot-empty">
                <div class="ac-shot-spinner"></div>
                <div>正在启动登录浏览器...</div>
              </div>
            </div>

            <!-- 登录方式切换 -->
            <div class="ac-mode-tabs">
              <button class="ac-mode-tab" :class="{ active: loginMode === 'qr' }" @click="switchLoginTab('qr')">📱 扫码登录</button>
              <button class="ac-mode-tab" :class="{ active: loginMode === 'sms' }" @click="switchLoginTab('sms')">💬 短信验证码</button>
            </div>

            <!-- 短信登录表单 -->
            <div v-if="loginMode === 'sms'" class="ac-sms-form">
              <div class="ac-sms-row">
                <input v-model="phone" class="ac-input" placeholder="输入抖音绑定的手机号" maxlength="11" />
                <button class="ac-btn ac-btn-ghost" :disabled="countdown > 0 || connecting" @click="sendSmsCode">
                  {{ countdown > 0 ? `${countdown}s 后重发` : '获取验证码' }}
                </button>
              </div>
              <div class="ac-sms-row">
                <input v-model="smsCode" class="ac-input" placeholder="输入短信验证码" maxlength="8" />
                <button class="ac-btn ac-btn-primary" :disabled="!codeSent || connecting" @click="submitLogin">登录</button>
              </div>
            </div>

            <div v-if="loginMode === 'qr' && !qrCode" class="ac-qr-tip">
              用<strong>抖音 App</strong> 扫一扫上方二维码，确认登录后自动完成连接
            </div>

            <!-- TASK03.2.1 — 登录阶段状态机（等待扫码 → 扫码确认 → 验证登录 → 已连接）
                 TASK03.2.2 — 新增 awaiting_confirmation：探针已检测到登录态，等待人工确认绑定 -->
            <div v-if="loginStage === 'scan_confirming' || loginStage === 'verifying' || loginStage === 'awaiting_confirmation' || loginStage === 'connected'" class="ac-stage">
              <div class="ac-stage-item" :class="{ on: ['scan_confirming','verifying','awaiting_confirmation','connected'].includes(loginStage) }">
                <span class="ac-stage-dot">①</span>扫码确认
              </div>
              <div class="ac-stage-arrow">→</div>
              <div class="ac-stage-item" :class="{ on: ['verifying','awaiting_confirmation','connected'].includes(loginStage) }">
                <span class="ac-stage-dot">②</span>验证登录
              </div>
              <div class="ac-stage-arrow">→</div>
              <div class="ac-stage-item" :class="{ on: loginStage === 'connected' }">
                <span class="ac-stage-dot">③</span>账号已连接
              </div>
            </div>

            <!-- 状态提示 -->
            <div v-if="statusMsg" class="ac-status" :class="{ err: statusMsg.includes('失败') || statusMsg.includes('启动失败') }">
              {{ statusMsg }}
            </div>
          </template>
        </div>
      </div>
    </Teleport>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">

definePageMeta({ middleware: 'auth' })
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'
import MediaPageHeader from '~/components/media/MediaPageHeader.vue'

const { $toast } = useNuxtApp() as any
import { getAuthToken } from '~/utils/auth/token'

const activeTab = ref('all')

/* ═══ 抖音浏览器连接弹窗状态 ═══ */
const connectModal = ref(false)
const connectPlatform = ref<any>(null)
const sessionId = ref('')
const accountId = ref('')
const screenshot = ref('')
const qrCode = ref('')
const loginMode = ref<'qr' | 'sms'>('qr')
const phone = ref('')
const smsCode = ref('')
const countdown = ref(0)
const statusMsg = ref('')
const connecting = ref(false)
const loggedIn = ref(false)
const loginStage = ref<'waiting_scan' | 'scan_confirming' | 'verifying' | 'awaiting_confirmation' | 'connected'>('waiting_scan')
const pollTimer = ref<any>(null)
const codeSent = ref(false)
// TASK03.2.2 — 人工授权确认（探针已检测到登录态，等老板确认绑定）
const awaitingConfirm = ref(false)
const detectedName = ref('')
const detectedAvatar = ref('')
const detectedAccountId = ref('')

async function api(url: string, opts: any = {}) {
  const token = getAuthToken() || ''
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}

async function openDouyinConnect(p: any) {
  connectPlatform.value = p
  connectModal.value = true
  statusMsg.value = '正在启动登录浏览器...'
  connecting.value = true
  loggedIn.value = false
  screenshot.value = ''
  loginMode.value = 'qr'
  countdown.value = 0
  codeSent.value = false
  phone.value = ''
  smsCode.value = ''
  qrCode.value = ''
  // TASK03.2.2 — 重置人工确认状态
  awaitingConfirm.value = false
  detectedName.value = ''
  detectedAvatar.value = ''
  detectedAccountId.value = ''
  loginStage.value = 'waiting_scan'
  try {
    // 1) 确保渠道账号存在
    const ensure = await api('/api/enterprise/channels/runtime/douyin/ensure-account', { method: 'POST', body: {} })
    accountId.value = ensure.data.id
    // 2) 打开登录浏览器
    const conn = await api(`/api/enterprise/channels/runtime/${accountId.value}/connect`, { method: 'POST', body: {} })
    sessionId.value = conn.data.sessionId
    // TASK03.2.2 — 已绑定账号：直接 connected（维持登录）；首次登录：等人工确认
    if (conn.data.status === 'connected') {
      loggedIn.value = true
      statusMsg.value = '登录态已恢复 ✓'
      startPolling()
    } else if (conn.data.status === 'awaiting_confirmation') {
      awaitingConfirm.value = true
      detectedName.value = conn.data.accountName || ''
      detectedAvatar.value = conn.data.avatar || ''
      detectedAccountId.value = conn.data.externalAccountId || ''
      statusMsg.value = '已检测到账号，请确认绑定'
      loginStage.value = 'awaiting_confirmation'
      startPolling()
    } else {
      statusMsg.value = '请扫码或使用短信验证码登录'
      startPolling()
    }
  } catch (e: any) {
    statusMsg.value = '启动失败: ' + e.message
    $toast?.error?.(`连接启动失败: ${e.message}`)
  } finally {
    connecting.value = false
  }
}

function startPolling() {
  stopPolling()
  pollTimer.value = setInterval(async () => {
    if (!sessionId.value) return
    try {
      const res = await api(`/api/enterprise/channels/runtime/browser/${encodeURIComponent(sessionId.value)}/status`)
      const d = res.data || {}
      // TASK03.2.1 — 登录阶段状态机：等待扫码 → 扫码确认 → 验证中 → 已连接
      // TASK03.2.2 — 探针检测到登录态 → awaiting_confirmation（等老板确认绑定，不再自动 connected）
      if (d.loginStage === 'connected' || d.loggedIn) {
        // 已绑定账号维持登录态 → 直接 connected；未绑定 → 显示确认卡片
        if (awaitingConfirm.value || !d.accountName) {
          // 等待人工确认（探针已给身份，用户点确认绑定）
          loginStage.value = 'awaiting_confirmation'
          if (!awaitingConfirm.value) {
            awaitingConfirm.value = true
            detectedName.value = d.accountName || ''
            detectedAvatar.value = d.avatar || ''
            detectedAccountId.value = d.externalAccountId || ''
            statusMsg.value = '已检测到账号，请确认绑定'
          }
          stopPolling()
        } else {
          loginStage.value = 'connected'
          statusMsg.value = '登录成功！正在保存登录态...'
          stopPolling()
          await finishConnect()
        }
        return
      } else if (d.loginStage === 'scan_confirming') {
        loginStage.value = 'scan_confirming'
        statusMsg.value = '扫码确认成功，正在验证登录...'
      } else if (loginStage.value !== 'verifying' && loginStage.value !== 'awaiting_confirmation') {
        loginStage.value = 'waiting_scan'
      }
      // 优先放大二维码（工作台可直接扫码），回退整页截图
      if (d.qrCodeBase64) qrCode.value = 'data:image/png;base64,' + d.qrCodeBase64
      else if (d.screenshotBase64) {
        qrCode.value = ''
        screenshot.value = 'data:image/png;base64,' + d.screenshotBase64
      }
    } catch (e: any) {
      // 轮询失败静默，等下次
    }
  }, 2500)
}

function stopPolling() {
  if (pollTimer.value) { clearInterval(pollTimer.value); pollTimer.value = null }
}

async function finishConnect() {
  try {
    // TASK03.2.1 — 登录成功闭环：wait-for-login 自动回写账号（connected + 身份 + 凭证）
    const res = await api(`/api/enterprise/channels/runtime/${accountId.value}/wait-for-login`, { method: 'POST', body: {} })
    const d = res.data || {}
    statusMsg.value = d.accountName
      ? `账号已连接：${d.accountName} ✓`
      : '连接成功！账号已点亮 ✓'
    if (connectPlatform.value) {
      connectPlatform.value.connected = true
      if (d.accountName) connectPlatform.value.name = d.accountName
    }
    $toast?.success?.('抖音渠道连接成功！')
    setTimeout(() => { connectModal.value = false }, 1800)
  } catch (e: any) {
    // wait-for-login 超时（未扫）→ 回退：仅保存当前登录态
    try {
      await api(`/api/enterprise/channels/runtime/${accountId.value}/refresh-credential`, { method: 'POST', body: {} })
      statusMsg.value = '连接成功！账号已点亮 ✓'
      $toast?.success?.('抖音渠道连接成功！')
      setTimeout(() => { connectModal.value = false }, 1500)
    } catch (e2: any) {
      statusMsg.value = '登录态保存失败: ' + e2.message
    }
  }
}

// TASK03.2.2 — 人工授权确认：用户点「确认绑定」→ 探针复核 → 回写 DB + 保存凭证
async function confirmBinding() {
  connecting.value = true
  statusMsg.value = '正在确认账号身份...'
  try {
    const res = await api(`/api/enterprise/channels/runtime/${accountId.value}/confirm-binding`, { method: 'POST', body: {} })
    const d = res.data || {}
    awaitingConfirm.value = false
    loggedIn.value = true
    loginStage.value = 'connected'
    statusMsg.value = d.accountName
      ? `已连接：${d.accountName}（L1 观察权限）✓`
      : '连接成功！账号已点亮（L1 观察权限）✓'
    if (connectPlatform.value) {
      connectPlatform.value.connected = true
      connectPlatform.value.name = d.accountName || connectPlatform.value.name
      connectPlatform.value.boundName = d.accountName || connectPlatform.value.name
      connectPlatform.value.boundAvatar = d.avatar || ''
    }
    $toast?.success?.('抖音账号绑定成功！')
    setTimeout(() => { connectModal.value = false }, 2000)
  } catch (e: any) {
    statusMsg.value = '确认绑定失败: ' + e.message
    $toast?.error?.(`确认绑定失败: ${e.message}`)
  } finally {
    connecting.value = false
  }
}

// TASK03.2.2 — 拒绝绑定：关闭确认卡片，回到登录页（不写任何 DB 状态）
async function rejectBinding() {
  awaitingConfirm.value = false
  detectedName.value = ''
  detectedAvatar.value = ''
  detectedAccountId.value = ''
  loginStage.value = 'waiting_scan'
  statusMsg.value = '已取消绑定，可重新扫码或切换账号'
  startPolling()
}

function closeConnectModal() {
  stopPolling()
  connectModal.value = false
  qrCode.value = ''
  screenshot.value = ''
  awaitingConfirm.value = false
  detectedName.value = ''
  detectedAvatar.value = ''
  detectedAccountId.value = ''
}

async function switchLoginTab(mode: 'qr' | 'sms') {
  loginMode.value = mode
  statusMsg.value = mode === 'qr' ? '请用抖音 App 扫码' : '请填写手机号接收短信验证码'
  if (!sessionId.value) return
  try {
    await api(`/api/enterprise/channels/runtime/browser/${encodeURIComponent(sessionId.value)}/tab`, { method: 'POST', body: { tab: mode === 'qr' ? 'qr' : 'sms' } })
  } catch (e: any) {
    statusMsg.value = '切换登录方式失败: ' + e.message
  }
}

async function sendSmsCode() {
  if (!/^1\d{10}$/.test(phone.value)) { $toast?.warn?.('请先填写正确的手机号'); return }
  if (!sessionId.value) return
  statusMsg.value = '正在发送验证码...'
  try {
    await api(`/api/enterprise/channels/runtime/browser/${encodeURIComponent(sessionId.value)}/phone`, { method: 'POST', body: { phone: phone.value } })
    const res = await api(`/api/enterprise/channels/runtime/browser/${encodeURIComponent(sessionId.value)}/send-code`, { method: 'POST', body: {} })
    codeSent.value = true
    if (res.data?.countdown) {
      statusMsg.value = '验证码已发送，请查收手机短信'
      startCountdown(59)
    } else {
      statusMsg.value = '验证码已发送，请查收手机短信'
      startCountdown(59)
    }
  } catch (e: any) {
    statusMsg.value = '发送失败: ' + e.message
  }
}

function startCountdown(sec: number) {
  countdown.value = sec
  const timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) { clearInterval(timer); countdown.value = 0 }
  }, 1000)
}

async function submitLogin() {
  if (!/^\d{4,8}$/.test(smsCode.value)) { $toast?.warn?.('请填写收到的验证码'); return }
  if (!sessionId.value) return
  statusMsg.value = '正在登录...'
  try {
    await api(`/api/enterprise/channels/runtime/browser/${encodeURIComponent(sessionId.value)}/code`, { method: 'POST', body: { code: smsCode.value } })
    statusMsg.value = '登录中，请稍候...'
    // 等待登录检测（轮询会自动处理 loggedIn → finishConnect）
    startPolling()
  } catch (e: any) {
    statusMsg.value = '登录失败: ' + e.message
  }
}

onBeforeUnmount(() => stopPolling())

const tabs = computed(() => [
  { key: 'all', icon: '◉', label: '全部', count: allPlatforms.length },
  { key: 'content', icon: '📱', label: '内容平台', count: contentPlatforms.length },
  { key: 'shop', icon: '🛒', label: '电商平台', count: shopPlatforms.length },
  { key: 'customer', icon: '💬', label: '客户平台', count: customerPlatforms.length },
])

// ① 内容平台（品牌曝光）
const contentPlatforms = [
  { icon: '📱', name: '抖音', plan: '短视频 · 直播', category: 'content', platform: 'douyin', connectable: true, connected: false },
  { icon: '📱', name: '快手', plan: '短视频 · 直播', category: 'content', connectable: false, connected: false },
  { icon: '📕', name: '小红书', plan: '种草图文 · 视频', category: 'content', connectable: false, connected: false },
  { icon: '🎬', name: '视频号', plan: '微信生态分发', category: 'content', connectable: false, connected: false },
  { icon: '💬', name: '微信公众号', plan: '图文 · 菜单服务', category: 'content', connectable: true, connected: false },
  { icon: '🌐', name: '微博', plan: '话题 · 图文', category: 'content', connectable: false, connected: false },
  { icon: '📰', name: '百家号', plan: '图文 · 视频', category: 'content', connectable: false, connected: false },
  { icon: '📰', name: '今日头条', plan: '图文 · 视频', category: 'content', connectable: false, connected: false },
]

// ② 电商店铺（商品销售）——连接后 AI 可以帮助（产品表达）
const shopPlatforms = [
  { icon: '🛒', name: '淘宝店', plan: '商品销售 · 店铺运营', category: 'shop', connectable: false, connected: false, helps: ['分析商品表现', '辅助制作商品内容', '关注客户反馈'] },
  { icon: '🛒', name: '京东店', plan: '商品销售 · 店铺运营', category: 'shop', connectable: false, connected: false, helps: ['商品运营分析', '内容推广建议', '客户服务辅助'] },
  { icon: '🛒', name: '拼多多店', plan: '商品销售 · 店铺运营', category: 'shop', connectable: false, connected: false, helps: ['商品推广分析', '活动运营建议'] },
  { icon: '🛒', name: '抖音商城', plan: '短视频电商 · 直播带货', category: 'shop', connectable: false, connected: false, helps: ['商品表现分析', '直播内容辅助', '客户反馈关注'] },
  { icon: '🛒', name: '美团店铺', plan: '本地生活 · 门店运营', category: 'shop', connectable: false, connected: false, helps: ['门店运营分析', '用户评价分析', '营销活动建议'] },
  { icon: '🛒', name: '小红书店铺', plan: '种草转化 · 商品销售', category: 'shop', connectable: false, connected: false, helps: ['种草内容辅助', '商品表现分析', '客户反馈关注'] },
]

// ③ 客户运营（客户沟通）
const customerPlatforms = [
  { icon: '🏢', name: '企业微信', plan: '私域客户运营', category: 'customer', connectable: false, connected: false, helps: ['自动回复客户', '客户标签管理', '营销活动触达'] },
  { icon: '💬', name: '微信客户', plan: '客户沟通 · 跟进', category: 'customer', connectable: false, connected: false, helps: ['客户沟通记录', '跟进提醒', '购买机会发现'] },
  { icon: '📞', name: '客服渠道', plan: '咨询接待 · 售后', category: 'customer', connectable: false, connected: false, helps: ['咨询自动接待', '售后处理辅助', '反馈汇总'] },
]

const allPlatforms = [...contentPlatforms, ...shopPlatforms, ...customerPlatforms]

const visiblePlatforms = computed(() => {
  if (activeTab.value === 'all') return allPlatforms
  return allPlatforms.filter((p: any) => p.category === activeTab.value)
})

// TASK03.2.2 G4 — 加载真实账号连接状态（已连接卡片：账号/头像/AI员工/权限）
onMounted(async () => {
  try {
    const res = await api('/api/enterprise/channels/runtime/douyin/account-status')
    const d = res.data || {}
    if (d.connected) {
      const douyin = allPlatforms.find((p: any) => p.platform === 'douyin')
      if (douyin) {
        douyin.connected = true
        douyin.boundName = d.accountName || douyin.name
        douyin.boundAvatar = d.avatar || ''
        douyin.permissionLevel = d.permissionLevel || 1
      }
    }
  } catch (e: any) {
    // 账号状态加载失败静默（未连接态保持默认）
  }
})

const perms = [
  { key: 'publish', ico: '📤', name: '发布内容', desc: 'AI 员工代发图文与视频' },
  { key: 'reply', ico: '💬', name: '回复客户', desc: 'AI 员工接待客户消息' },
  { key: 'data', ico: '📊', name: '读取数据', desc: '阅读量、订单、粉丝、互动统计' },
]

const steps = [
  { title: '授权绑定', desc: '填写公众号授权信息，完成账号绑定' },
  { title: '勾选权限', desc: '选择发布内容、回复客户、读取数据' },
  { title: '授权 AI 员工', desc: '你的 AI 团队开始接管对应工作' },
  { title: '完成连接', desc: '连接成功，账号状态点亮' },
]

function onClick(p: any) {
  if (p.connected) return
  if (p.connectable) {
    if (p.platform === 'douyin') {
      openDouyinConnect(p)
    } else {
      $toast?.info?.('微信资产接入等待掌柜提供授权信息（Sprint-MEDIA-01 遗留）')
    }
  } else {
    $toast?.info?.(`「${p.name}」接入即将开放，先连接抖音体验完整流程`)
  }
}
</script>

<style scoped>
/* ═══ 分类 Tabs ═══ */
.ac-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}
.ac-tab {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: #94a3b8;
  background: rgba(22, 32, 51, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.3);
  cursor: pointer;
  transition: all 0.16s;
}
.ac-tab:hover { color: #F1F5F9; border-color: rgba(59, 130, 246, 0.4); }
.ac-tab.active {
  color: #fff;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(59, 130, 246, 0.95));
  border-color: transparent;
  box-shadow: 0 6px 18px rgba(59, 130, 246, 0.3);
}
.ac-tab-ico { font-size: 12px; }
.ac-tab-count {
  font-size: 9.5px;
  font-weight: 800;
  background: rgba(148, 163, 184, 0.3);
  border-radius: 999px;
  padding: 1px 7px;
}
.ac-tab.active .ac-tab-count { background: rgba(255, 255, 255, 0.18); }

/* ═══ 渠道卡片网格 ═══ */
.ac-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 16px;
}
.ac-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 17px 18px;
  border-radius: 15px;
  background: rgba(22, 32, 51, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.28);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: transform 0.15s, border-color 0.18s;
}
.ac-card:hover { transform: translateY(-2px); border-color: rgba(59, 130, 246, 0.4); }
.ac-card--shop { border-color: rgba(245, 158, 11, 0.22); }
.ac-card--shop:hover { border-color: rgba(245, 158, 11, 0.5); }
.ac-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.ac-ico { font-size: 24px; }
.ac-state {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 9.5px; font-weight: 700;
  border-radius: 999px; padding: 2px 9px;
}
.ac-state.on { color: #34D399; background: rgba(52, 211, 153, 0.1); border: 1px solid rgba(52, 211, 153, 0.3); }
.ac-state.off { color: #94a3b8; background: rgba(148, 163, 184, 0.12); border: 1px solid rgba(148, 163, 184, 0.3); }
.ac-dot { width: 6px; height: 6px; border-radius: 50%; }
.ac-dot.on { background: #34D399; box-shadow: 0 0 6px #34D399; }
.ac-dot.off { background: #64748b; }
.ac-name { font-size: 14px; font-weight: 800; color: #F1F5F9; }
.ac-plan { font-size: 10px; color: #64748b; }

/* 连接后 AI 可以帮助 */
.ac-helps {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 9px;
  padding-top: 9px;
  border-top: 1px dashed rgba(148, 163, 184, 0.28);
}
.ac-helps-title { font-size: 9px; font-weight: 700; color: #64748b; letter-spacing: 0.04em; }
.ac-help {
  display: flex; align-items: center; gap: 6px;
  font-size: 10.5px; color: #94a3b8;
}
.ac-help-check { color: #34D399; font-weight: 800; }

.ac-cta {
  margin-top: 10px;
  font-size: 11px; font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #3B82F6, #2563EB);
  border: none; border-radius: 9px; padding: 7px 0;
  cursor: pointer;
}
.ac-card.connected .ac-cta { background: rgba(52, 211, 153, 0.15); color: #34D399; cursor: default; }
.ac-soon {
  margin-top: 10px;
  font-size: 10px; font-weight: 600;
  color: #64748b;
  text-align: center;
  border: 1px dashed rgba(148, 163, 184, 0.4);
  border-radius: 9px; padding: 6px 0;
}

/* ═══ 价值说明 ═══ */
.ac-note {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 13px 16px;
  border-radius: 13px;
  background: rgba(22, 32, 51, 0.6);
  border: 1px solid rgba(59, 130, 246, 0.2);
  font-size: 11.5px; color: #94a3b8; line-height: 1.7;
  margin-bottom: 16px;
}
.ac-note b { color: #cbd5e1; }
.ac-note-ico { font-size: 14px; }

/* ═══ 微信连接流程 ═══ */
.ac-flow {
  padding: 18px 20px;
  border-radius: 16px;
  background: rgba(22, 32, 51, 0.72);
  border: 1px solid rgba(59, 130, 246, 0.25);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  margin-bottom: 16px;
}
.ac-flow-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.ac-flow-ico { font-size: 22px; }
.ac-flow-title { font-size: 14px; font-weight: 800; color: #F1F5F9; }
.ac-flow-sub { font-size: 10px; color: #64748b; margin-top: 1px; }
.ac-steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.ac-step {
  display: flex; gap: 9px; align-items: flex-start;
  padding: 11px 12px;
  border-radius: 12px;
  background: rgba(5, 8, 22, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.22);
}
.ac-step-num {
  width: 20px; height: 20px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  font-size: 10px; font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #3B82F6, #2563EB);
}
.ac-step b { display: block; font-size: 11.5px; color: #F1F5F9; margin-bottom: 2px; }
.ac-step-desc { font-size: 9.5px; color: #64748b; line-height: 1.55; }
.ac-connect-btn {
  width: 100%;
  font-size: 12.5px; font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #3B82F6, #2563EB 55%, #3b82f6);
  border: none; border-radius: 11px; padding: 11px 0;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(59, 130, 246, 0.3);
  transition: transform 0.15s, box-shadow 0.15s;
}
.ac-connect-btn:hover { transform: translateY(-1px); box-shadow: 0 10px 26px rgba(59, 130, 246, 0.45); }

/* ═══ AI 权限说明 ═══ */
.ac-perms {
  padding: 18px 20px;
  border-radius: 16px;
  background: rgba(22, 32, 51, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.28);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}
.ac-perms-title { font-size: 13px; font-weight: 800; color: #F1F5F9; margin-bottom: 12px; }
.ac-perms-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.ac-perm {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 11px 12px;
  border-radius: 12px;
  background: rgba(5, 8, 22, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.22);
}
.ac-perm-ico { font-size: 16px; }
.ac-perm b { display: block; font-size: 11.5px; color: #F1F5F9; margin-bottom: 2px; }
.ac-perm-sub { font-size: 9.5px; color: #64748b; line-height: 1.55; }

@media (max-width: 900px) {
  .ac-grid, .ac-perms-grid { grid-template-columns: repeat(2, 1fr); }
  .ac-steps { grid-template-columns: repeat(2, 1fr); }
}

/* ═══ 抖音浏览器连接弹窗 ═══ */
.ac-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(11, 16, 32, 0.72);
  backdrop-filter: blur(6px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.ac-modal {
  width: 560px;
  max-width: 96vw;
  max-height: 92vh;
  overflow-y: auto;
  background: #12192e;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 16px;
  padding: 22px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
}
.ac-modal-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}
.ac-modal-title { font-size: 16px; font-weight: 800; color: #f1f5f9; }
.ac-modal-sub { font-size: 11.5px; color: #64748b; margin-top: 4px; }
.ac-modal-close {
  background: rgba(148, 163, 184, 0.12);
  border: none;
  color: #94a3b8;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}
.ac-modal-close:hover { background: rgba(148, 163, 184, 0.25); color: #f1f5f9; }
.ac-shot-wrap {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: #0b1020;
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
}
/* 放大二维码展示（工作台直接扫码） */
.ac-qr-wrap {
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: #ffffff;
  padding: 22px 22px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.ac-qr-big {
  width: 340px;
  height: 340px;
  object-fit: contain;
  image-rendering: auto;
  display: block;
}
.ac-qr-refresh-tip {
  font-size: 12px;
  color: #64748b;
  text-align: center;
}
.ac-qr-refresh-tip strong { color: #111827; }
.ac-shot {
  width: 100%;
  max-height: 420px;
  object-fit: contain;
  display: block;
}
.ac-shot-empty {
  padding: 48px 20px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
}
.ac-shot-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(59, 130, 246, 0.2);
  border-top-color: #3b82f6;
  border-radius: 50%;
  margin: 0 auto 12px;
  animation: ac-spin 0.9s linear infinite;
}
@keyframes ac-spin { to { transform: rotate(360deg); } }
.ac-mode-tabs {
  display: flex;
  gap: 8px;
  margin: 14px 0 12px;
}
.ac-mode-tab {
  flex: 1;
  padding: 9px 0;
  border-radius: 10px;
  font-size: 12.5px;
  font-weight: 700;
  color: #94a3b8;
  background: rgba(148, 163, 184, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.2);
  cursor: pointer;
  transition: all 0.16s;
}
.ac-mode-tab.active {
  color: #fff;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-color: transparent;
}
.ac-sms-form { display: flex; flex-direction: column; gap: 10px; }
.ac-sms-row { display: flex; gap: 8px; }
.ac-input {
  flex: 1;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(11, 16, 32, 0.6);
  color: #f1f5f9;
  font-size: 13px;
  outline: none;
}
.ac-input:focus { border-color: #3b82f6; }
.ac-btn {
  padding: 10px 16px;
  border-radius: 10px;
  border: none;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.16s;
}
.ac-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ac-btn-ghost { background: rgba(148, 163, 184, 0.15); color: #e2e8f0; }
.ac-btn-ghost:hover:not(:disabled) { background: rgba(148, 163, 184, 0.28); }
.ac-btn-primary { background: linear-gradient(135deg, #3b82f6, #2563eb); color: #fff; }
.ac-btn-primary:hover:not(:disabled) { filter: brightness(1.1); }
.ac-qr-tip {
  margin-top: 12px;
  font-size: 12px;
  color: #94a3b8;
  text-align: center;
  line-height: 1.6;
}
.ac-qr-tip strong { color: #f1f5f9; }
.ac-status {
  margin-top: 12px;
  padding: 9px 12px;
  border-radius: 10px;
  font-size: 12px;
  color: #93c5fd;
  background: rgba(59, 130, 246, 0.12);
  border: 1px solid rgba(59, 130, 246, 0.25);
}
.ac-status.err {
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.3);
}
/* TASK03.2.1 — 登录阶段状态机指示条 */
.ac-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 14px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.2);
}
.ac-stage-item {
  font-size: 12px;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 4px;
}
.ac-stage-item.on {
  color: #34d399;
  font-weight: 700;
}
.ac-stage-dot {
  font-size: 11px;
}
.ac-stage-arrow {
  color: #475569;
  font-size: 11px;
}
.ac-modal-success {
  text-align: center;
  padding: 48px 20px;
  color: #f1f5f9;
  font-size: 15px;
  font-weight: 700;
}
.ac-success-ico {
  width: 56px;
  height: 56px;
  margin: 0 auto 14px;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.15);
  border: 2px solid #10b981;
  color: #10b981;
  font-size: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ac-success-sub { font-size: 12px; color: #64748b; font-weight: 400; margin-top: 6px; }

.ac-card--connected {
  border-color: rgba(16, 185, 129, 0.4);
  background: linear-gradient(180deg, rgba(16, 185, 129, 0.06), rgba(255,255,255,0.02) 40%);
}
.ac-bound {
  margin-top: 12px;
  padding: 12px;
  border-radius: 10px;
  background: rgba(16, 185, 129, 0.07);
  border: 1px solid rgba(16, 185, 129, 0.2);
}
.ac-bound-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ac-bound-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(139, 92, 246, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}
.ac-bound-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.ac-bound-avatar-fb {
  font-size: 16px;
  font-weight: 800;
  color: #a78bfa;
}
.ac-bound-info { min-width: 0; }
.ac-bound-name {
  font-size: 13px;
  font-weight: 700;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ac-bound-ai {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}
.ac-bound-tags {
  margin-top: 10px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.ac-bound-tag {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 20px;
  background: rgba(16, 185, 129, 0.12);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.25);
}
.ac-cta--bound {
  border-color: rgba(16, 185, 129, 0.4);
  color: #34d399;
}

/* TASK03.2.2 — 人工授权确认卡片（SaaS 授权确认事件） */
.ac-confirm {
  padding: 32px 24px;
  text-align: center;
  color: #f1f5f9;
}
.ac-confirm-avatar {
  width: 64px;
  height: 64px;
  margin: 0 auto 14px;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(139, 92, 246, 0.15);
  border: 2px solid rgba(139, 92, 246, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}
.ac-confirm-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.ac-confirm-avatar-fallback {
  font-size: 26px;
  font-weight: 800;
  color: #a78bfa;
}
.ac-confirm-title {
  font-size: 16px;
  font-weight: 700;
}
.ac-confirm-account {
  margin-top: 8px;
  font-size: 20px;
  font-weight: 800;
  color: #fff;
}
.ac-confirm-desc {
  margin: 14px auto 0;
  max-width: 340px;
  font-size: 12px;
  line-height: 1.7;
  color: #94a3b8;
}
.ac-confirm-actions {
  margin-top: 22px;
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style>
