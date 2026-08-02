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

    <!-- SPRINT-MEDIA-BROWSER-WORKSPACE-01 Task08.1 — Browser Workspace Owner View（老板视角）
         AI员工 → 工作电脑（🟢在线）→ 平台 → 最近操作 → 状态
         SPRINT-MEDIA-BROWSER-WORKSPACE-01.1：展示 media 域专属员工（禁止 Career/Recruitment Agent 混入）-->
    <div v-if="ownerViews.length" class="ac-owner">
      <div class="ac-owner-head">
        <span class="ac-owner-title">新媒体运营部门 · 我的 AI 员工</span>
        <span class="ac-owner-sub">每个 AI 员工拥有自己的工作电脑 · 登录态长期保留</span>
      </div>
      <div class="ac-owner-grid">
        <div v-for="ov in ownerViews" :key="ov.workspaceId" class="ac-owner-card">
          <div class="ac-owner-top">
            <span class="ac-owner-avatar">{{ (ov.agent?.name || 'AI')[0] }}</span>
            <div class="ac-owner-meta">
              <div class="ac-owner-name">{{ ov.agent?.name || 'AI 员工' }}</div>
              <div class="ac-owner-role">{{ ov.agent?.role || '运营' }}</div>
              <div class="ac-owner-dept"><span class="ac-owner-dept-dot"></span>{{ ov.businessType === 'media' ? '新媒体运营部门' : ov.businessType }}</div>
            </div>
            <span class="ac-owner-state" :class="ownerStateClass(ov)">
              <span class="ac-owner-dot" :class="ownerStateClass(ov)"></span>
              {{ workerStatusLabel(ov) }}
            </span>
          </div>
          <div class="ac-owner-info">
            <div class="ac-owner-row"><span class="k">工作电脑</span><span class="v">🖥 {{ (ov.platformName || ov.platform || '运营空间') + '运营空间' }}</span></div>
            <!-- IDENTITY-VIEW-01 Task04 — 账号身份块：真实头像 + 账号名 + 平台ID（SSOT，前端不保存账号名） -->
            <div class="ac-owner-row ac-owner-identity">
              <span class="k">账号身份</span>
              <span class="v ac-identity-cell">
                <img v-if="ov.identity?.avatar" :src="ov.identity.avatar" class="ac-identity-avatar" alt="账号头像" referrerpolicy="no-referrer" />
                <span v-else class="ac-identity-avatar-fb">{{ (ov.identity?.accountName || '?')[0] }}</span>
                <span class="ac-identity-main">
                  <span class="ac-identity-name">{{ ov.identity?.accountName || '未获取' }}</span>
                  <span v-if="ov.identity?.externalAccountId" class="ac-identity-ext">ID {{ ov.identity.externalAccountId }}</span>
                </span>
              </span>
            </div>
            <!-- IDENTITY-VIEW-01 Task05 — 身份失效展示：登录过就保留身份，显示需重新验证 + 原因 + 最后验证 -->
            <div v-if="ov.identity?.status === 'stale'" class="ac-owner-row ac-owner-warn">
              <span class="k">状态</span>
              <span class="v">🟡 登录状态需要重新验证<span class="ac-owner-warn-reason">{{ ov.identity.reason || '身份快照超期' }}</span></span>
            </div>
            <div v-else class="ac-owner-row"><span class="k">状态</span><span class="v">{{ workerStatusDetail(ov) }}</span></div>
            <div v-if="ov.identity?.lastVerifiedAt" class="ac-owner-row"><span class="k">最近验证</span><span class="v">{{ timeAgo(ov.identity.lastVerifiedAt) }}<span class="ac-owner-verify-by">{{ verifiedByLabel(ov) }}</span></span></div>
            <div class="ac-owner-row"><span class="k">最近动作</span><span class="v">{{ ov.lastOperation ? timeAgo(ov.lastOperation.createdAt) + ' · ' + ov.lastOperation.description : '暂无真实动作记录' }}</span></div>
            <!-- AI-EMPLOYEE-OPERATION-REALITY-01 Task04 — 今日运营状态（真实指标快照，无数据不显示0） -->
            <div v-if="ov.metrics" class="ac-owner-row ac-owner-metrics">
              <span class="k">今日状态</span>
              <span class="v">
                <template v-if="ov.metrics.status === 'available' && ov.metrics.metrics">
                  <span class="ac-metric-line">粉丝 <b>{{ fmtCount(ov.metrics.metrics.followerCount) }}</b></span>
                  <span v-if="ov.metrics.metrics.videoCount != null" class="ac-metric-line">作品 <b>{{ fmtCount(ov.metrics.metrics.videoCount) }}</b></span>
                  <span v-if="ov.metrics.metrics.recentViews != null" class="ac-metric-line">近7天播放 <b>{{ fmtCount(ov.metrics.metrics.recentViews) }}</b></span>
                  <span v-if="ov.metrics.metrics.interactionRate != null" class="ac-metric-line">互动率 <b>{{ ov.metrics.metrics.interactionRate }}%</b></span>
                  <span class="ac-metric-time">采集于 {{ timeAgo(ov.metrics.collectedAt) }}</span>
                </template>
                <template v-else>
                  <span class="ac-metric-unavailable">暂无数据{{ ov.metrics.unavailableReason ? ' · ' + ov.metrics.unavailableReason : '' }}</span>
                  <span v-if="ov.metrics.collectedAt" class="ac-metric-time">最近尝试 {{ timeAgo(ov.metrics.collectedAt) }}</span>
                </template>
              </span>
            </div>
            <!-- AI-EMPLOYEE-REALITY-01 Task04 — AI 判断：置信度徽章 + 规则摘要（完整分析走 /metrics/analyze） -->
            <div v-if="ov.aiInsight" class="ac-owner-row ac-owner-ai">
              <span class="k">AI 判断</span>
              <span class="v ac-ai-cell">
                <span class="ac-conf-badge" :class="'lv-' + (ov.aiInsight.confidence?.level || 'warning')">
                  {{ confidenceLabel(ov.aiInsight.confidence) }}
                </span>
                <span class="ac-ai-summary">{{ ov.aiInsight.summary || '暂无可用数据，无法生成 AI 判断' }}</span>
              </span>
            </div>
            <!-- AI-EMPLOYEE-REALITY-01 Task01 — 账号健康（Channel Health Guard）：NEEDS_ATTENTION 展示保护 + 人工恢复 -->
            <div v-if="ov.health && ov.health.state !== 'HEALTHY'" class="ac-owner-row ac-owner-health" :class="ov.health.state === 'NEEDS_ATTENTION' ? 'danger' : 'warn'">
              <span class="k">账号健康</span>
              <span class="v ac-health-cell">
                <template v-if="ov.health.state === 'NEEDS_ATTENTION'">
                  <span class="ac-health-tag danger">🔴 需要关注</span>
                  <span class="ac-health-reason">{{ ov.health.pauseReason || '连续失败已暂停任务，保护账号资产' }}</span>
                  <button class="ac-health-recover" @click.stop="recoverChannel(ov)">✓ 人工确认恢复</button>
                </template>
                <template v-else>
                  <span class="ac-health-tag warn">🟡 注意</span>
                  <span class="ac-health-reason">近期出现 {{ ov.health.failureCount }} 次失败，继续失败将自动保护</span>
                </template>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

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
            <span v-if="p.deviceTrusted" class="ac-bound-tag ac-bound-tag--trusted">🛡 安全验证已完成</span>
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
            <div class="ac-confirm-title">已检测到{{ connectPlatform?.name }}账号登录</div>
            <div class="ac-confirm-account">{{ detectedName || connectPlatform?.name || '平台账号' }}</div>
            <div class="ac-confirm-desc">确认这是你要绑定的账号吗？绑定后 AI 员工（Alice 运营总监）将以 <strong>观察权限（L1）</strong> 读取该账号数据，不会自动发布任何内容。</div>
            <div class="ac-confirm-actions">
              <button class="ac-btn ac-btn-ghost" :disabled="connecting" @click="rejectBinding">不是这个账号</button>
              <button class="ac-btn ac-btn-primary" :disabled="connecting" @click="confirmBinding">✓ 确认绑定</button>
            </div>
          </div>

          <template v-else>
            <!-- 扫码模式：优先显示放大的实时二维码（可直接扫）；无二维码时回退整页截图 -->
            <div v-if="loginMode === 'qr' && qrCode" class="ac-qr-wrap">
              <img :src="qrCode" class="ac-qr-big" alt="登录二维码" @error="onQrImageError" />
              <div class="ac-qr-refresh-tip">二维码每 15 秒自动刷新，直接用<strong>{{ connectPlatform?.appName || connectPlatform?.name }} App</strong> 扫一扫</div>
            </div>
            <!-- 整页截图（短信模式 / 二维码提取失败时兜底） -->
            <div v-else class="ac-shot-wrap">
              <img v-if="screenshot" :src="screenshot" class="ac-shot" alt="登录画面" />
              <div v-else class="ac-shot-empty">
                <div class="ac-shot-spinner"></div>
                <div>正在启动登录浏览器...</div>
              </div>
            </div>

            <!-- 登录方式切换（短信 tab 仅平台支持时显示：视频号/公众号仅扫码） -->
            <div class="ac-mode-tabs">
              <button class="ac-mode-tab" :class="{ active: loginMode === 'qr' }" @click="switchLoginTab('qr')">📱 扫码登录</button>
              <button v-if="connectPlatform?.loginMethods?.includes('sms')" class="ac-mode-tab" :class="{ active: loginMode === 'sms' }" @click="switchLoginTab('sms')">💬 短信验证码</button>
            </div>

            <!-- 短信登录表单 -->
            <div v-if="loginMode === 'sms'" class="ac-sms-form">
              <div class="ac-sms-row">
                <input v-model="phone" class="ac-input" :placeholder="`输入${connectPlatform?.name || '平台'}绑定的手机号`" maxlength="11" />
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
              用<strong>{{ connectPlatform?.appName || connectPlatform?.name }} App</strong> 扫一扫上方二维码，确认登录后自动完成连接
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

            <!-- Channel Identity Trust Completion — 平台安全验证产品流程（新设备首次绑定）
                 不是错误：平台识别为新设备，要求完成一次安全验证；完成后本环境长期可信，无需重复 -->
            <div v-if="verificationRequired && loginStage === 'verifying' && !verificationAcknowledged" class="ac-verify">
              <div class="ac-verify-head">
                <span class="ac-verify-icon">🛡</span>
                <div>
                  <div class="ac-verify-title">需要完成一次安全验证</div>
                  <div class="ac-verify-sub">首次绑定新设备，{{ connectPlatform?.name }}要求确认本人操作（正常安全流程）</div>
                </div>
              </div>
              <div class="ac-verify-steps">
                <div class="ac-verify-step">
                  <span class="ac-verify-step-dot">①</span>
                  <div>
                    <div class="ac-verify-step-name">
                      {{ verificationType === 'sms' ? '接收短信验证码' : verificationType === 'face' ? '手机刷脸验证' : (connectPlatform?.appName || connectPlatform?.name) + ' App 确认' }}
                    </div>
                    <div class="ac-verify-step-desc">
                      <template v-if="verificationTriggered">✅ 验证请求已发送到你的{{ connectPlatform?.appName || connectPlatform?.name }} App，请在手机上完成{{ verificationType === 'sms' ? '短信验证' : verificationType === 'face' ? '刷脸' : '确认' }}（若未收到，点击下方按钮重新发送）</template>
                      <template v-else>在{{ connectPlatform?.appName || connectPlatform?.name }} App 中按提示完成{{ verificationType === 'sms' ? '短信验证' : verificationType === 'face' ? '刷脸' : '确认登录' }}</template>
                    </div>
                  </div>
                </div>
                <button v-if="verificationType === 'face' || verificationType === 'sms'" class="ac-btn ac-btn-ghost ac-verify-resend" :disabled="connecting" @click="resendVerification">
                  ↻ 重新发送验证请求
                </button>
                <div class="ac-verify-step">
                  <span class="ac-verify-step-dot">②</span>
                  <div>
                    <div class="ac-verify-step-name">返回{{ connectPlatform?.name }}工作台</div>
                    <div class="ac-verify-step-desc">验证完成后页面自动进入{{ connectPlatform?.name }}工作台</div>
                  </div>
                </div>
              </div>
              <button class="ac-btn ac-btn-primary ac-verify-btn" :disabled="connecting" @click="verificationAcknowledged = true">
                我已完成验证，继续连接
              </button>
              <div class="ac-verify-note">💡 完成本次验证后，昆仑镜将把此浏览器环境固化为可信设备，后续直接恢复登录态，无需重复验证</div>
            </div>

            <!-- ═══ SPRINT-MEDIA-LOGIN-REALITY-FIX-01 Task05：Login Debug Panel ═══
                 为什么二维码没有？——不再靠猜：URL / Frames / QR Detector 四通道 / Page Text 全展示 -->
            <div class="ac-debug">
              <button class="ac-debug-toggle" @click="showLoginDebug = !showLoginDebug">
                🔍 登录诊断
                <span class="ac-debug-arrow" :class="{ open: showLoginDebug }">▾</span>
              </button>
              <div v-if="showLoginDebug && loginDebug" class="ac-debug-body">
                <div class="ac-debug-row"><span class="ac-debug-k">Status</span><span class="ac-debug-v">{{ loginStage }} / {{ loginDebug.qrSource || 'none' }}</span></div>
                <div class="ac-debug-row"><span class="ac-debug-k">URL</span><span class="ac-debug-v ac-debug-url">{{ loginDebug.loginSurface?.url || '(未知)' }}</span></div>
                <div class="ac-debug-row"><span class="ac-debug-k">Frames</span><span class="ac-debug-v">{{ loginDebug.frames ?? '—' }}</span></div>
                <div class="ac-debug-row"><span class="ac-debug-k">QR Detector</span>
                  <span class="ac-debug-v">
                    <span class="ac-debug-chip" :class="{ ok: loginDebug.detector?.img?.found }">img {{ loginDebug.detector?.img?.found ? '✅' : '❌' }}</span>
                    <span class="ac-debug-chip" :class="{ ok: loginDebug.detector?.canvas?.found }">canvas {{ loginDebug.detector?.canvas?.found ? '✅' : '❌' }}</span>
                    <span class="ac-debug-chip" :class="{ ok: loginDebug.detector?.iframe?.found }">iframe {{ loginDebug.detector?.iframe?.found ? '✅' : '❌' }}</span>
                    <span class="ac-debug-chip" :class="{ ok: loginDebug.detector?.screenshot?.found }">shot {{ loginDebug.detector?.screenshot?.found ? '✅' : '❌' }}</span>
                  </span>
                </div>
                <div v-if="loginDebug.detector?.img?.note" class="ac-debug-row"><span class="ac-debug-k">img note</span><span class="ac-debug-v">{{ loginDebug.detector.img.note }}</span></div>
                <div v-if="loginDebug.detector?.canvas?.note" class="ac-debug-row"><span class="ac-debug-k">canvas note</span><span class="ac-debug-v">{{ loginDebug.detector.canvas.note }}</span></div>
                <div v-if="loginDebug.detector?.screenshot?.note" class="ac-debug-row"><span class="ac-debug-k">shot note</span><span class="ac-debug-v">{{ loginDebug.detector.screenshot.note }}</span></div>
                <div class="ac-debug-row"><span class="ac-debug-k">Page Text</span><span class="ac-debug-v">{{ loginDebug.pageTextSample || '—' }}</span></div>
              </div>
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
// SPRINT-MEDIA-LOGIN-REALITY-FIX-01 Task05：Login Debug Panel 数据
const loginDebug = ref<any>(null)
const showLoginDebug = ref(false)
// TASK03.2.2-QRFIX — 裂图自修复：后端 JPEG 二维码提取 bug 时，前端用 jsQR 从整页截图定位+裁剪放大二维码
const lastScreenshotBase64 = ref('')
const qrFallbackTried = ref(false)
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
// Channel Identity Trust Completion — 平台安全验证（新设备首次绑定风控：短信/App确认/刷脸）
const verificationRequired = ref(false)
const verificationType = ref<'sms' | 'app' | 'face' | 'none'>('none')
const verificationAcknowledged = ref(false)
const verificationTriggered = ref(false)

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
  // Channel Identity Trust Completion — 重置安全验证状态
  verificationRequired.value = false
  verificationType.value = 'none'
  verificationAcknowledged.value = false
  verificationTriggered.value = false
  loginStage.value = 'waiting_scan'
  try {
    // 1) 确保渠道账号存在（多平台：URL 带 platform）
    const ensure = await api(`/api/enterprise/channels/runtime/${connectPlatform.value.platform}/ensure-account`, { method: 'POST', body: {} })
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
      statusMsg.value = `请扫码或使用短信验证码登录${connectPlatform.value.name}`
      startPolling()
    }
  } catch (e: any) {
    statusMsg.value = '启动失败: ' + e.message
    $toast?.error?.(`连接启动失败: ${e.message}`)
  } finally {
    connecting.value = false
  }
}

// 重新发送验证请求：手动触发一次 status 轮询（getLoginStatus 会自动点击刷脸/短信按钮向手机推送）
async function resendVerification() {
  if (!sessionId.value || connecting.value) return
  statusMsg.value = '正在重新发送验证请求...'
  try {
    const d = await api(`/api/enterprise/channels/runtime/browser/${encodeURIComponent(sessionId.value)}/status`)
    if (d?.data?.verificationTriggered) {
      verificationTriggered.value = true
      statusMsg.value = `✅ 验证请求已重新发送，请在${connectPlatform.value?.appName || connectPlatform.value?.name || '平台'} App 上完成验证`
    } else if (d?.data?.verificationRequired) {
      statusMsg.value = '验证页已就绪，若手机仍未收到请求请稍后再试'
    } else {
      statusMsg.value = '验证状态已刷新'
    }
  } catch (e: any) {
    statusMsg.value = '重新发送失败: ' + e.message
  }
}

function startPolling() {
  stopPolling()
  let pollingInFlight = false  // TASK03.2.2-FIX — 防重入：探针执行 2-3s > 轮询间隔，避免请求堆积并发
  pollTimer.value = setInterval(async () => {
    if (!sessionId.value || pollingInFlight) return
    pollingInFlight = true
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
      // Channel Identity Trust Completion — 平台安全验证页（新设备首次绑定风控）
      // 产品化：不是错误，是正常的安全验证流程（短信/App确认/刷脸），完成后无需重复
      if (d.verificationRequired && !verificationAcknowledged.value) {
        verificationRequired.value = true
        verificationType.value = d.verificationType || 'app'
        verificationTriggered.value = !!d.verificationTriggered
        loginStage.value = 'verifying'
        statusMsg.value = verificationTriggered.value
          ? `已向你的${connectPlatform.value?.appName || connectPlatform.value?.name || '平台'} App 发送验证请求，请在手机上完成验证`
          : `${connectPlatform.value?.name || '平台'}要求完成一次安全验证（新设备首次绑定），验证完成后本环境长期可信`
      }
      if (d.verificationRequired && verificationAcknowledged.value) {
        // 已确认：不打断，继续轮询等探针检测登录态
        verificationRequired.value = true
      }
      // 优先放大二维码（工作台可直接扫码），回退整页截图
      // TASK03.2.2-QRFIX — 保留最新整页截图 base64（裂图时用于 jsQR 自修复）
      if (d.screenshotBase64) lastScreenshotBase64.value = d.screenshotBase64
      // SPRINT-MEDIA-LOGIN-REALITY-FIX-01 Task05：Login Debug Panel 数据
      if (d.debug) loginDebug.value = d.debug
      if (d.qrCodeBase64) {
        qrCode.value = 'data:image/png;base64,' + d.qrCodeBase64
        qrFallbackTried.value = false  // 新二维码到来，重置裂图修复标记
      } else if (d.screenshotBase64) {
        qrCode.value = ''
        screenshot.value = 'data:image/png;base64,' + d.screenshotBase64
      }
    } catch (e: any) {
      // 轮询失败静默，等下次
    } finally {
      pollingInFlight = false  // TASK03.2.2-FIX — 释放防重入标志
    }
  }, 3000)  // TASK03.2.2-FIX — 间隔 2.5s→3s（探针执行 2-3s，留余量）
}

function stopPolling() {
  if (pollTimer.value) { clearInterval(pollTimer.value); pollTimer.value = null }
}

// TASK03.2.2-QRFIX — 裂图自修复：img 加载失败（后端 JPEG 提取坏图）时，用 jsQR 从整页截图定位二维码并裁剪放大
let jsQRModule: any = null
async function loadJsQR(): Promise<any> {
  if (jsQRModule) return jsQRModule
  const mod = await import('~/static/vendor/jsqr.min.js')
  jsQRModule = mod.default || mod
  return jsQRModule
}

async function onQrImageError() {
  if (qrFallbackTried.value) return
  qrFallbackTried.value = true
  const shotB64 = lastScreenshotBase64.value
  if (!shotB64) return
  try {
    const jsQR = await loadJsQR()
    // 整页截图 → canvas → jsQR 定位
    const img = new Image()
    img.src = 'data:image/png;base64,' + shotB64
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const id = ctx.getImageData(0, 0, c.width, c.height)
    const code = jsQR(id.data, id.width, id.height)
    if (!code) { screenshot.value = 'data:image/png;base64,' + shotB64; return }
    // 用 jsQR 返回的定位角计算二维码包围盒（含余量）
    const loc = code.location
    const pts = [loc.topLeftCorner, loc.topRightCorner, loc.bottomRightCorner, loc.bottomLeftCorner]
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
    const pad = 16
    const sx = Math.max(0, Math.min(...xs) - pad)
    const sy = Math.max(0, Math.min(...ys) - pad)
    const sw = Math.min(c.width - sx, Math.max(...xs) - Math.min(...xs) + pad * 2)
    const sh = Math.min(c.height - sy, Math.max(...ys) - Math.min(...ys) + pad * 2)
    // 裁剪 + 4x 放大 + 白边（与后端 1024 放大等效）
    const scale = 4
    const out = document.createElement('canvas')
    out.width = sw * scale
    out.height = sh * scale
    const octx = out.getContext('2d')!
    octx.imageSmoothingEnabled = true
    octx.imageSmoothingQuality = 'high'
    octx.drawImage(c, sx, sy, sw, sh, 0, 0, out.width, out.height)
    // 白边画布
    const border = 48
    const final = document.createElement('canvas')
    final.width = out.width + border * 2
    final.height = out.height + border * 2
    const fctx = final.getContext('2d')!
    fctx.fillStyle = '#ffffff'
    fctx.fillRect(0, 0, final.width, final.height)
    fctx.drawImage(out, border, border)
    qrCode.value = final.toDataURL('image/png')
    screenshot.value = ''
    statusMsg.value = `二维码已自动修复，请用${connectPlatform.value?.appName || connectPlatform.value?.name || '平台'} App 扫描`
  } catch (e: any) {
    // 修复失败 → 回退整页截图
    screenshot.value = 'data:image/png;base64,' + shotB64
  }
}

// LOGIN-REALITY-FIX-01 Task02 — Reality API 复核：登录成功 = 浏览器真实登录 + DB 身份闭环，两者缺一不可
// 禁止 accountName 存在 = 登录成功（那只是探针实时状态，刷新后即丢）
async function fetchReality() {
  try {
    const r = await api(`/api/enterprise/channels/${accountId.value}/reality`)
    return r.data || null
  } catch (e: any) {
    console.warn('[finishConnect] reality 复核失败:', e?.message)
    return null
  }
}

// 连接成功展示（绿色）：reality.identity.verified + account.connected 双确认
function showConnected(name: string, avatar: string, employeeName?: string) {
  loginStage.value = 'connected'
  statusMsg.value = employeeName
    ? `账号已连接：${name} ✓ AI 员工「${employeeName}」可使用`
    : `账号已连接：${name} ✓`
  if (connectPlatform.value) {
    connectPlatform.value.connected = true
    connectPlatform.value.name = name
    connectPlatform.value.boundName = name
    connectPlatform.value.boundAvatar = avatar
  }
  $toast?.success?.(`${name}连接成功！`)
  setTimeout(() => { connectModal.value = false }, 1800)
}

// 中间态展示（黄色）：账号已登录但身份闭环未完成，绝不宣称已连接
function showConfirming(msg: string, name?: string, avatar?: string, externalId?: string) {
  loginStage.value = 'awaiting_confirmation'
  awaitingConfirm.value = true
  if (name) detectedName.value = name
  if (avatar) detectedAvatar.value = avatar
  if (externalId) detectedAccountId.value = externalId
  statusMsg.value = msg
}

async function finishConnect() {
  try {
    // TASK03.2.1 — 登录成功闭环：wait-for-login 探针确认 + 身份提取 + 凭证落库
    const res = await api(`/api/enterprise/channels/runtime/${accountId.value}/wait-for-login`, { method: 'POST', body: {} })
    const d = res.data || {}
    const st = String(d.status || '').toUpperCase()

    if (st === 'CONNECTED') {
      // 后端全闭环成功（身份+凭证+连接落库）→ Reality API 复核（掌柜：只认真实状态）
      const reality = await fetchReality()
      if (reality?.identity?.verified && reality?.account?.connected) {
        const name = d.accountName || reality.identity.name || connectPlatform.value?.name || '平台账号'
        showConnected(name, reality.identity.avatar || d.avatar || '', reality.employee?.binding?.name || undefined)
      } else {
        // 后端说成功但 Reality 复核未过（异常降级）→ 黄色，不假成功
        showConfirming('账号已登录，正在确认身份...', d.accountName || '', d.avatar || '', d.externalAccountId || '')
        $toast?.info?.('登录态已确认，正在完成账号身份绑定...')
      }
      return
    }
    if (st === 'IDENTITY_VERIFIED') {
      // 身份已锚定但凭证未落库 → 展示确认卡片，用户确认后补完闭环（confirm-binding）
      showConfirming(d.message || '账号身份已确认，请确认绑定完成连接', d.accountName || '', d.avatar || '', d.externalAccountId || '')
      return
    }
    if (st === 'AUTHENTICATED') {
      // 探针确认登录但身份提取失败 → 黄色明确提示，绝不假成功
      loginStage.value = 'awaiting_confirmation'
      statusMsg.value = d.message || '登录成功，但账号身份确认失败，请重新扫码或确认绑定'
      $toast?.warn?.(statusMsg.value)
      return
    }
    // awaiting_confirmation（探针检测到登录，等人工确认绑定）
    showConfirming(d.message || '已检测到账号，请确认绑定', d.accountName || '', d.avatar || '', d.externalAccountId || '')
  } catch (e: any) {
    // wait-for-login 超时（未扫）→ 回退：仅保存当前登录态（仍走 Reality 复核，不假成功）
    try {
      await api(`/api/enterprise/channels/runtime/${accountId.value}/refresh-credential`, { method: 'POST', body: {} })
      const reality = await fetchReality()
      if (reality?.identity?.verified && reality?.account?.connected) {
        const name = reality.identity.name || connectPlatform.value?.name || '平台账号'
        showConnected(name, reality.identity.avatar || '')
      } else {
        showConfirming('账号已登录，正在确认身份...')
      }
    } catch (e2: any) {
      statusMsg.value = '登录态保存失败: ' + e2.message
      $toast?.error?.(`登录态保存失败: ${e2.message}`)
    }
  }
}

// TASK03.2.2 — 人工授权确认：用户点「确认绑定」→ 探针复核 → 身份锚定（IDENTITY_VERIFIED）→ 凭证落库 → CONNECTED
// LOGIN-REALITY-FIX-01 Task03 — 后端失败显式报错不假成功；前端成功同样过 Reality 复核
async function confirmBinding() {
  connecting.value = true
  statusMsg.value = '正在确认账号身份...'
  try {
    const res = await api(`/api/enterprise/channels/runtime/${accountId.value}/confirm-binding`, { method: 'POST', body: {} })
    const d = res.data || {}
    const reality = await fetchReality()
    if (!reality?.identity?.verified || !reality?.account?.connected) {
      // 后端返回成功但 Reality 复核未过（异常）→ 黄色，不假成功
      showConfirming('账号身份已确认，但连接状态未落库，请稍后刷新确认', d.accountName || '', d.avatar || '', d.externalAccountId || '')
      $toast?.warn?.('身份已确认，但连接闭环未完成，请稍后重试')
      return
    }
    const name = d.accountName || reality.identity.name || connectPlatform.value?.name || '平台账号'
    const avatar = reality.identity.avatar || d.avatar || ''
    awaitingConfirm.value = false
    loggedIn.value = true
    loginStage.value = 'connected'
    statusMsg.value = reality.employee?.usable
      ? `已连接：${name}（L1 观察权限）✓ AI 员工「${reality.employee.binding?.name}」可使用`
      : `已连接：${name}（L1 观察权限）✓`
    if (connectPlatform.value) {
      connectPlatform.value.connected = true
      connectPlatform.value.name = name
      connectPlatform.value.boundName = name
      connectPlatform.value.boundAvatar = avatar
    }
    $toast?.success?.(`${name}账号绑定成功！`)
    setTimeout(() => { connectModal.value = false }, 2000)
  } catch (e: any) {
    // LOGIN-REALITY-FIX-01 — 后端明确错误（identity_missing / credential_failed）直接展示，禁止假成功
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
  statusMsg.value = mode === 'qr' ? `请用${connectPlatform.value?.appName || connectPlatform.value?.name || '平台'} App 扫码` : '请填写手机号接收短信验证码'
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
// 2026-08-02 — 多平台浏览器渠道：抖音/快手/小红书/视频号已真实可连（connectable+platform）
const contentPlatforms = [
  { icon: '📱', name: '抖音', plan: '短视频 · 直播', category: 'content', platform: 'douyin', appName: '抖音', loginMethods: ['qr', 'sms'], connectable: true, connected: false },
  { icon: '🎥', name: '快手', plan: '短视频 · 直播', category: 'content', platform: 'kuaishou', appName: '快手', loginMethods: ['qr', 'sms'], connectable: true, connected: false },
  { icon: '📕', name: '小红书', plan: '种草图文 · 视频', category: 'content', platform: 'xiaohongshu', appName: '小红书', loginMethods: ['qr', 'sms'], connectable: true, connected: false },
  { icon: '🎬', name: '视频号', plan: '微信生态分发', category: 'content', platform: 'channels_wechat', appName: '微信', loginMethods: ['qr'], connectable: true, connected: false },
  { icon: '💬', name: '微信公众号', plan: '图文 · 菜单服务', category: 'content', connectable: false, connected: false },
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
// SPRINT-MEDIA-BROWSER-WORKSPACE-01 Task08.1 — 加载 AI 员工工作电脑 Owner View
const ownerViews = ref<any[]>([])

// REALITY-HARDENING-01 Task03 — 状态标签：未登录绝不显示「工作中」
// REALITY-GATE-FINAL-01 Task04 — 老板语言三态：🟢 在线 / ⚪ 等待授权 / 🟡 需要重新登录 / 🔴 账号保护中 / ⚫ 电脑离线
const WORKER_STATUS_LABEL: Record<string, string> = {
  working: '🟢 在线',
  waiting_scan: '⚪ 等待授权',
  verifying: '⚪ 等待授权',
  authenticated: '⚪ 等待授权',
  expired: '🟡 需要重新登录',
  error: '🔴 电脑异常',
  pending: '⚪ 等待授权',
  offline: '⚫ 电脑离线',
  attention: '🔴 账号保护中',
}
const WORKER_STATUS_DETAIL: Record<string, string> = {
  working: '电脑在线 · 账号已连接 · 可读取数据',
  waiting_scan: '电脑就绪 · 等待扫码授权',
  verifying: '电脑就绪 · 扫码完成，验证中',
  authenticated: '电脑就绪 · 身份已确认，凭证保存中',
  expired: '电脑在线 · 登录态已失效，请重新扫码登录',
  error: '电脑异常 · 请检查浏览器环境',
  pending: '电脑就绪 · 尚未发起连接',
  offline: '电脑离线',
  attention: '账号保护中 · 连续失败已暂停任务，等待老板确认恢复',
}
function workerStatusLabel(ov: any): string {
  return WORKER_STATUS_LABEL[ov.workerStatus || (ov.online ? 'working' : 'offline')] || '⚫ 电脑离线'
}
// REALITY-GATE-FINAL-01 Task04 — 状态点颜色：🟢在线=绿 / 🟡需重新登录=黄 / 🔴保护=红 / 其余=灰
function ownerStateClass(ov: any): string {
  const st = ov.workerStatus || (ov.online ? 'working' : 'offline')
  if (st === 'working') return 'on'
  if (st === 'expired') return 'warn'
  if (st === 'attention' || st === 'error') return 'danger'
  return 'off'
}
function workerStatusDetail(ov: any): string {
  return WORKER_STATUS_DETAIL[ov.workerStatus || (ov.online ? 'working' : 'offline')] || ov.workspaceStatus || '—'
}
// IDENTITY-VIEW-01 Task04 — 账号身份新鲜度：由卡片身份块（头像/账号名/ID/最近验证/失效原因）承载，
// 展示逻辑内联在模板（identity.status 分支），此处不再保留单行文本函数
// IDENTITY-VIEW-01 Task05 — 身份验证来源标注（verifiedBy → 人话）
function verifiedByLabel(ov: any): string {
  const via = ov.identity?.verifiedBy
  if (!via) return ''
  const map: Record<string, string> = {
    confirm_binding: '· 扫码确认绑定',
    connect_keepalive: '· 登录态维持',
    wait_login_keepalive: '· 登录轮询确认',
    refresh_credential: '· 凭证刷新确认',
    startup_recovery: '· 开机恢复确认',
    manual_bind: '· 手动绑定',
  }
  return map[via] || ''
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return m + ' 分钟前'
  const h = Math.floor(m / 60)
  if (h < 24) return h + ' 小时前'
  return Math.floor(h / 24) + ' 天前'
}

function fmtCount(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 100000000) return (n / 100000000).toFixed(1) + ' 亿'
  if (n >= 10000) return (n / 10000).toFixed(1) + ' 万'
  return n.toLocaleString()
}

// AI-EMPLOYEE-REALITY-01 Task04 — 置信度徽章文案（AI 不虚报：数据不足必须如实展示）
function confidenceLabel(c: any): string {
  if (!c) return '数据不足'
  const map: Record<string, string> = {
    strong: 'AI 判断 · 高置信',
    medium: 'AI 判断 · 中等置信',
    weak: 'AI 判断 · 低置信',
    warning: 'AI 判断 · 数据不足',
  }
  return map[c.level] || 'AI 判断'
}

// AI-EMPLOYEE-REALITY-01 Task01 — 人工确认恢复（老板确认后解除账号保护，恢复 AI 员工绑定）
async function recoverChannel(ov: any) {
  if (!ov?.channelAccountId) return
  try {
    const res = await api(`/api/enterprise/channels/${ov.channelAccountId}/health/recover`, { method: 'POST', body: { by: 'owner', reason: '老板人工确认账号正常' } })
    if (res.code === 0) {
      $toast?.success?.('账号已恢复，AI 员工可继续工作')
      await reloadOwnerViews()
    } else {
      $toast?.error?.(res.message || '恢复失败')
    }
  } catch (e: any) {
    $toast?.error?.('恢复失败: ' + e.message)
  }
}

async function reloadOwnerViews() {
  try {
    const ov = await api('/api/enterprise/workspaces/owner-view')
    ownerViews.value = (ov.data || []).filter((r: any) => r.agent)
  } catch (e: any) {
    // 静默
  }
}

onMounted(async () => {
  // 2026-08-02 — 多平台：循环加载全部可连接渠道的连接状态
  const connectables = allPlatforms.filter((p: any) => p.connectable && p.platform)
  await Promise.all(connectables.map(async (p: any) => {
    try {
      const res = await api(`/api/enterprise/channels/runtime/${p.platform}/account-status`)
      const d = res.data || {}
      if (d.connected) {
        p.connected = true
        p.boundName = d.accountName || p.name
        p.boundAvatar = d.avatar || ''
        p.permissionLevel = d.permissionLevel || 1
        p.deviceTrusted = !!d.deviceTrusted
      }
    } catch (e: any) {
      // 账号状态加载失败静默（未连接态保持默认）
    }
  }))
  // Task08.1 — Owner View（失败静默，不影响渠道列表）
  // REALITY-HARDENING-01 Task03 — 不得按 online 过滤：等待扫码/验证中也是真实状态，必须展示
  try {
    const ov = await api('/api/enterprise/workspaces/owner-view')
    ownerViews.value = (ov.data || []).filter((r: any) => r.agent)
  } catch (e: any) {
    // 静默
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
    if (p.platform) {
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
/* ═══ SPRINT-MEDIA-BROWSER-WORKSPACE-01 Task08.1 — AI 员工工作电脑 Owner View ═══ */
.ac-owner {
  background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
  border: 1px solid #e0e7ff;
  border-radius: 14px;
  padding: 16px 18px;
  margin-bottom: 20px;
}
.ac-owner-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
}
.ac-owner-title {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
}
.ac-owner-sub {
  font-size: 12px;
  color: #64748b;
}
.ac-owner-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.ac-owner-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
}
.ac-owner-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.ac-owner-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ac-owner-meta {
  flex: 1;
  min-width: 0;
}
.ac-owner-name {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
}
.ac-owner-role {
  font-size: 12px;
  color: #64748b;
}
.ac-owner-dept {
  font-size: 11px;
  color: #8b5cf6;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 1px;
}
.ac-owner-dept-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #8b5cf6;
}
.ac-owner-state {
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 20px;
}
.ac-owner-state.on {
  color: #059669;
  background: #ecfdf5;
}
.ac-owner-state.off {
  color: #64748b;
  background: #f1f5f9;
}
.ac-owner-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.ac-owner-dot.on {
  background: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}
.ac-owner-dot.warn {
  background: #d97706;
  box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.15);
}
.ac-owner-dot.danger {
  background: #dc2626;
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.15);
}
.ac-owner-dot.off {
  background: #94a3b8;
}
.ac-owner-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ac-owner-row {
  display: flex;
  gap: 8px;
  font-size: 12px;
}
.ac-owner-row .k {
  color: #94a3b8;
  width: 52px;
  flex-shrink: 0;
}
.ac-owner-row .v {
  color: #334155;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* IDENTITY-VIEW-01 Task04/05 — 身份单元格：头像 + 账号名 + 平台ID；失效警示 */
.ac-owner-identity .v { display: flex; align-items: center; }
.ac-identity-cell { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ac-identity-avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: #f1f5f9; }
.ac-identity-avatar-fb { width: 28px; height: 28px; border-radius: 50%; background: #eef2ff; color: #6366f1; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ac-identity-main { display: flex; flex-direction: column; min-width: 0; }
.ac-identity-name { font-weight: 500; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ac-identity-ext { font-size: 10px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
.ac-owner-warn .v { color: #b45309; display: flex; flex-direction: column; gap: 2px; }
.ac-owner-warn-reason { font-size: 11px; color: #d97706; opacity: .85; }
.ac-owner-verify-by { font-size: 10px; color: #94a3b8; margin-left: 4px; }

/* AI-EMPLOYEE-OPERATION-REALITY-01 Task04 — 今日运营状态（真实指标，无数据不显示0） */
.ac-owner-metrics .v { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ac-metric-line { font-size: 12px; color: #374151; white-space: nowrap; }
.ac-metric-line b { color: #111827; font-weight: 600; }
.ac-metric-time { font-size: 10px; color: #94a3b8; }
.ac-metric-unavailable { font-size: 12px; color: #94a3b8; }

/* AI-EMPLOYEE-REALITY-01 Task04 — AI 判断（置信度徽章 + 摘要） */
.ac-owner-ai .v { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ac-ai-cell { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ac-conf-badge {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 20px;
  white-space: nowrap;
}
.ac-conf-badge.lv-strong { color: #059669; background: #ecfdf5; border: 1px solid #a7f3d0; }
.ac-conf-badge.lv-medium { color: #2563eb; background: #eff6ff; border: 1px solid #bfdbfe; }
.ac-conf-badge.lv-weak { color: #64748b; background: #f1f5f9; border: 1px solid #e2e8f0; }
.ac-conf-badge.lv-warning { color: #d97706; background: #fffbeb; border: 1px solid #fde68a; }
.ac-ai-summary { font-size: 11.5px; color: #475569; line-height: 1.55; white-space: normal; }

/* AI-EMPLOYEE-REALITY-01 Task01 — 账号健康（Channel Health Guard） */
.ac-owner-health .v { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ac-health-cell { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ac-health-tag {
  align-self: flex-start;
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 20px;
  white-space: nowrap;
}
.ac-health-tag.danger { color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; }
.ac-health-tag.warn { color: #d97706; background: #fffbeb; border: 1px solid #fde68a; }
.ac-health-reason { font-size: 11px; color: #6b7280; line-height: 1.5; white-space: normal; }
.ac-owner-health.danger .ac-health-reason { color: #b91c1c; }
.ac-health-recover {
  align-self: flex-start;
  font-size: 10.5px;
  font-weight: 700;
  color: #059669;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 8px;
  padding: 4px 10px;
  cursor: pointer;
}
.ac-health-recover:hover { background: #d1fae5; }

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
/* Channel Identity Trust Completion — 平台安全验证产品流程（新设备首次绑定） */
.ac-verify {
  margin-top: 14px;
  padding: 14px 14px 12px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.10), rgba(59, 130, 246, 0.08));
  border: 1px solid rgba(139, 92, 246, 0.25);
}
.ac-verify-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.ac-verify-icon {
  font-size: 22px;
  line-height: 1.2;
}
.ac-verify-title {
  font-size: 13px;
  font-weight: 700;
  color: #f1f5f9;
}
.ac-verify-sub {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
}
.ac-verify-steps {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ac-verify-step {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.ac-verify-step-dot {
  font-size: 11px;
  color: #8b5cf6;
  font-weight: 700;
  margin-top: 1px;
}
.ac-verify-step-name {
  font-size: 12px;
  font-weight: 600;
  color: #e2e8f0;
}
.ac-verify-step-desc {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 1px;
}
.ac-verify-resend {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 6px;
  color: #8b5cf6;
  border: 1px solid rgba(139, 92, 246, .35);
  background: rgba(139, 92, 246, .08);
  cursor: pointer;
  margin-top: 2px;
}
.ac-verify-resend:hover {
  background: rgba(139, 92, 246, .16);
}
.ac-verify-btn {
  margin-top: 14px;
  width: 100%;
}
.ac-verify-note {
  margin-top: 10px;
  font-size: 11px;
  color: #8b5cf6;
  line-height: 1.5;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(139, 92, 246, 0.08);
  border: 1px dashed rgba(139, 92, 246, 0.3);
}

/* ── Login Debug Panel（SPRINT-MEDIA-LOGIN-REALITY-FIX-01 Task05） ── */
.ac-debug {
  margin-top: 12px;
  border: 1px solid rgba(100, 116, 139, 0.25);
  border-radius: 10px;
  overflow: hidden;
  background: rgba(15, 23, 42, 0.5);
}
.ac-debug-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
}
.ac-debug-toggle:hover { color: #e2e8f0; }
.ac-debug-arrow { transition: transform 0.2s; font-size: 10px; }
.ac-debug-arrow.open { transform: rotate(180deg); }
.ac-debug-body {
  padding: 10px 12px;
  border-top: 1px solid rgba(100, 116, 139, 0.2);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ac-debug-row { display: flex; gap: 8px; font-size: 11px; line-height: 1.5; }
.ac-debug-k { flex: 0 0 74px; color: #64748b; font-weight: 500; }
.ac-debug-v { color: #cbd5e1; word-break: break-all; }
.ac-debug-url { font-family: monospace; font-size: 10px; }
.ac-debug-chip {
  display: inline-block;
  padding: 1px 6px;
  margin-right: 4px;
  border-radius: 6px;
  font-size: 10px;
  background: rgba(220, 38, 38, 0.15);
  color: #fca5a5;
}
.ac-debug-chip.ok {
  background: rgba(16, 185, 129, 0.15);
  color: #6ee7b7;
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
.ac-bound-tag--trusted {
  background: rgba(139, 92, 246, 0.12);
  color: #a78bfa;
  border-color: rgba(139, 92, 246, 0.3);
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
