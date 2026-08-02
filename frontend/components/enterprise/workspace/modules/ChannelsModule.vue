<!-- ChannelsModule — 渠道中心（真实入口）
     SPRINT-MEDIA-LOGIN-REALITY-HARDENING-02 Task03：
     删除假连接组件 ChannelConnectCenter.vue（本地 ref 假连接，违反「真实或不存在」）。
     本模块 = 真实渠道状态展示 + 唯一连接入口引导：
       - 平台能力 100% 来自 GET /api/enterprise/channels/registry（禁止前端硬编码 connectable）
       - 账号真实状态来自 GET /api/enterprise/workspaces/owner-view（🟢在线/⚪等待授权/🟡需要重新登录）
       - 连接/管理统一跳转媒体工作台渠道中心 /workspace/media/accounts（唯一 Connect API 入口） -->
<template>
  <div class="channels-module">
    <div class="cm-header">
      <h2>渠道中心</h2>
      <span class="cm-desc">真实平台账号连接（扫码登录 → 数字电脑 → AI 员工使用）</span>
    </div>

    <!-- 加载/错误 -->
    <div v-if="loading" class="cm-state">加载平台能力中...</div>
    <div v-else-if="error" class="cm-state cm-error">{{ error }}</div>

    <!-- 平台卡片（registry 驱动） -->
    <div v-else class="cm-grid">
      <div v-for="cap in platforms" :key="cap.platform" class="cm-card">
        <div class="cm-card-head">
          <span class="cm-icon">{{ platformIcon(cap.platform) }}</span>
          <div class="cm-card-info">
            <span class="cm-name">{{ cap.displayName }}</span>
            <span class="cm-tag" :class="cap.status">{{ statusLabel(cap) }}</span>
          </div>
        </div>
        <div class="cm-login-methods">
          <span class="cm-method">{{ cap.loginMethods.includes('qr') ? '扫码' : '' }}{{ cap.loginMethods.length > 1 ? ' · 短信' : '' }}</span>
          <span v-if="cap.metricsSupported" class="cm-method">数据读取 ✓</span>
        </div>
        <!-- 真实账号状态（owner-view） -->
        <div class="cm-account">
          <template v-if="accountByPlatform(cap.platform)">
            <span class="cm-dot" :class="statusDot(accountByPlatform(cap.platform))"></span>
            <span class="cm-acc-name">{{ identityName(cap.platform) }}</span>
          </template>
          <template v-else>
            <span class="cm-dot cm-dot--gray"></span>
            <span class="cm-acc-name cm-acc-muted">未连接</span>
          </template>
        </div>
        <button class="cm-btn" :class="{ 'cm-btn--bound': !!accountByPlatform(cap.platform) }" @click="goConnect(cap)">
          {{ accountByPlatform(cap.platform) ? '查看账号' : '去连接' }}
        </button>
      </div>
    </div>

    <div class="cm-foot">
      <span>连接 = 真实浏览器扫码授权，登录态持久化，服务重启自动恢复</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { navigateTo } from '#imports'

interface PlatformCap {
  platform: string
  displayName: string
  connectable: boolean
  loginMethods: string[]
  postScanBehavior?: string
  adapterReady: boolean
  probeReady: boolean
  metricsSupported: boolean
  status: 'ready' | 'config_only' | 'frozen'
}

interface OwnerRow {
  platform: string | null
  online: boolean
  workerStatus: string
  identity: { status: string; accountName: string | null; externalAccountId: string | null; reason?: string | null } | null
}

const loading = ref(true)
const error = ref('')
const platforms = ref<PlatformCap[]>([])
const ownerRows = ref<OwnerRow[]>([])

function getAuthToken(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem('token') || window.localStorage.getItem('accessToken') || ''
}

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

function platformIcon(p: string): string {
  return { douyin: '📱', kuaishou: '🎥', xiaohongshu: '📕', channels_wechat: '🎬' }[p] || '🔌'
}

function statusLabel(cap: PlatformCap): string {
  if (cap.status === 'frozen') return '冻结'
  if (cap.status === 'ready' && cap.connectable) return '可连接'
  if (cap.status === 'config_only') return '未注册'
  return '不可用'
}

function accountByPlatform(platform: string): OwnerRow | undefined {
  return ownerRows.value.find(r => r.platform === platform)
}

function identityName(platform: string): string {
  const row = accountByPlatform(platform)
  if (!row?.identity?.accountName) return '未连接'
  return row.identity.accountName
}

function statusDot(row: OwnerRow): string {
  if (row.online) return 'cm-dot--green'
  if (row.workerStatus === 'waiting_scan') return 'cm-dot--yellow'
  if (row.workerStatus === 'expired' || row.workerStatus === 'error') return 'cm-dot--red'
  return 'cm-dot--gray'
}

function goConnect(cap: PlatformCap) {
  // 唯一连接入口 = 媒体工作台渠道中心（真实 Connect API 链路）
  navigateTo(`/workspace/media/accounts?platform=${cap.platform}`)
}

onMounted(async () => {
  try {
    const reg = await api('/api/enterprise/channels/registry')
    platforms.value = (reg.data?.platforms || []).filter((p: PlatformCap) => ['douyin', 'kuaishou', 'xiaohongshu', 'channels_wechat'].includes(p.platform))
    try {
      const ov = await api('/api/enterprise/workspaces/owner-view?businessType=media')
      ownerRows.value = ov.data || []
    } catch {
      ownerRows.value = []
    }
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.channels-module {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}
.cm-header { display: flex; flex-direction: column; gap: var(--space-xs); }
.cm-header h2 { font-size: var(--font-size-lg); font-weight: 600; margin: 0; }
.cm-desc { font-size: var(--font-size-sm); color: var(--color-text-muted); }
.cm-state { padding: var(--space-lg); text-align: center; color: var(--color-text-muted); font-size: var(--font-size-sm); }
.cm-error { color: var(--color-execution); }
.cm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-md); }
.cm-card { padding: var(--space-md); background: var(--color-bg-secondary); border: 1px solid var(--color-border-primary); border-radius: var(--radius-lg); display: flex; flex-direction: column; gap: var(--space-md); }
.cm-card-head { display: flex; align-items: center; gap: var(--space-md); }
.cm-icon { font-size: 26px; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; background: var(--color-bg-elevated); border-radius: var(--radius-md); }
.cm-card-info { display: flex; flex-direction: column; gap: 2px; }
.cm-name { font-weight: 600; }
.cm-tag { font-size: var(--font-size-xs); padding: 2px 8px; border-radius: 999px; width: fit-content; }
.cm-tag.ready { background: rgba(16, 185, 129, 0.12); color: #10B981; }
.cm-tag.config_only { background: rgba(217, 119, 6, 0.12); color: #D97706; }
.cm-tag.frozen { background: rgba(100, 116, 139, 0.15); color: #64748B; }
.cm-login-methods { display: flex; gap: var(--space-sm); }
.cm-method { font-size: var(--font-size-xs); color: var(--color-text-muted); background: var(--color-bg-elevated); padding: 2px 8px; border-radius: var(--radius-sm); }
.cm-account { display: flex; align-items: center; gap: var(--space-sm); min-height: 22px; }
.cm-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.cm-dot--green { background: #10B981; }
.cm-dot--yellow { background: #D97706; }
.cm-dot--red { background: #DC2626; }
.cm-dot--gray { background: #CBD5E1; }
.cm-acc-name { font-size: var(--font-size-sm); font-weight: 500; }
.cm-acc-muted { color: var(--color-text-muted); font-weight: 400; }
.cm-btn { padding: var(--space-xs) var(--space-md); background: var(--color-intelligence); color: #000; border: none; border-radius: var(--radius-md); font-size: var(--font-size-sm); font-weight: 600; cursor: pointer; }
.cm-btn:hover { opacity: 0.85; }
.cm-btn--bound { background: transparent; border: 1px solid var(--color-border-primary); color: var(--color-text-muted); }
.cm-foot { font-size: var(--font-size-xs); color: var(--color-text-muted); }
</style>
