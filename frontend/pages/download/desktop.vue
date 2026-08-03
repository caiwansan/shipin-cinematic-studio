<template>
  <div class="download-page">
    <KunlunNav
      :is-logged-in="isLoggedIn"
      @show-login="showLogin = true; isRegisterMode = false"
      @show-register="showLogin = true; isRegisterMode = true"
      @logout="doLogout"
    />

    <!-- 主区 -->
    <main class="dl-main">
      <section class="dl-hero">
        <div class="dl-badge">昆仑镜官方下载</div>
        <h1 class="dl-title">Kunlun Media <span class="dl-title-accent">Desktop</span></h1>
        <p class="dl-subtitle">AI 应用生态操作系统 · 桌面端</p>
        <p class="dl-desc">
          在本地电脑运行昆仑镜生态 —— 安装即用，无需任何开发环境。<br />
          登录昆仑镜账号 → 设备注册 → License 校验 → AI 员工插件运行。
        </p>

        <!-- 下载卡片 -->
        <div class="dl-card">
          <div class="dl-card-head">
            <div class="dl-os">
              <span class="dl-os-icon">🪟</span>
              <div>
                <div class="dl-os-name">Windows 版本</div>
                <div class="dl-os-sub">Windows 10 / 11 · 64 位</div>
              </div>
            </div>
            <div class="dl-meta" v-if="meta">
              <div class="dl-meta-row"><span>版本</span><b>{{ meta.version }}</b></div>
              <div class="dl-meta-row"><span>大小</span><b>{{ meta.sizeText }}</b></div>
              <div class="dl-meta-row"><span>更新时间</span><b>{{ meta.publishedText }}</b></div>
            </div>
          </div>

          <a
            :href="meta ? meta.downloadUrl : '#'"
            class="dl-btn"
            :class="{ 'dl-btn-disabled': !meta }"
            @click="meta ? null : $event.preventDefault()"
          >
            <span class="dl-btn-icon">⬇️</span>
            {{ meta ? '下载 Kunlun Media ' + meta.version : '正在获取版本信息…' }}
          </a>

          <div class="dl-foot" v-if="meta">
            <span>SHA256：<code class="dl-sha">{{ meta.sha256 }}</code></span>
          </div>
        </div>

        <!-- 说明 -->
        <div class="dl-steps">
          <div class="dl-step"><span class="dl-step-num">1</span><div><b>下载</b><p>从昆仑镜官网获取安装包，全程 HTTPS 安全传输</p></div></div>
          <div class="dl-step"><span class="dl-step-num">2</span><div><b>安装</b><p>双击安装包，无需 Node / Rust / 任何开发工具</p></div></div>
          <div class="dl-step"><span class="dl-step-num">3</span><div><b>启动</b><p>登录昆仑镜，设备注册 + License 校验后即可运行 AI 员工插件</p></div></div>
        </div>

        <div class="dl-note">
          ℹ️ 更新提示：应用内后续版本将支持自动升级（Tauri Updater），本页面始终提供最新版本。
        </div>

        <!-- DIAG-RELEASE-01：高级诊断下载（内部测试）-->
        <section class="dl-diag">
          <div class="dl-diag-head">
            <h2 class="dl-diag-title">🧪 高级诊断下载 <span class="dl-diag-tag">内部测试</span></h2>
            <p class="dl-diag-sub">Desktop Reality 验证专用，非正式版本。用于定位桌面端 JavaScript 执行链路问题。</p>
          </div>
          <div class="dl-diag-grid">
            <div v-for="p in diagPacks" :key="p.id" class="dl-diag-card">
              <div class="dl-diag-name">{{ p.name }}</div>
              <div class="dl-diag-desc">{{ p.desc }}</div>
              <div class="dl-diag-rows">
                <div class="dl-diag-row"><span>版本</span><b>{{ p.version }}</b></div>
                <div class="dl-diag-row"><span>测试点</span><b>{{ p.test }}</b></div>
                <div class="dl-diag-row dl-diag-row-sha"><span>SHA256</span><code>{{ p.sha256 }}</code></div>
              </div>
              <a :href="p.url" class="dl-diag-btn" :download="p.filename">⬇️ 下载 {{ p.name }}</a>
            </div>
          </div>
          <div class="dl-diag-note">
            测试流程：安装 DiagA → 运行截图 → 卸载 → 安装 DiagB → 运行截图。<br />
            期望：DiagA 显示「Hello World + JS 执行 OK（外部脚本）」；DiagB 显示「Vue 静态页正常渲染 + 按钮可点」。任一项缺失请截图回传。
          </div>
        </section>
      </section>
    </main>

    <KunlunFooter />

    <!-- 登录/注册 Modal（复用首页） -->
    <div v-if="showLogin" class="modal-overlay" @click.self="showLogin = false">
      <div class="modal-card">
        <button class="modal-close" @click="showLogin = false">✕</button>
        <div class="modal-header">
          <span class="logo-icon"><img src="/logo.png" alt="昆仑镜" class="modal-logo-img" /></span>
          <h2>{{ isRegisterMode ? '创建账号' : '登录昆仑镜' }}</h2>
        </div>
        <div class="modal-tabs">
          <button :class="['tab-btn', !isRegisterMode && 'tab-active']" @click="isRegisterMode = false">登录</button>
          <button :class="['tab-btn', isRegisterMode && 'tab-active']" @click="isRegisterMode = true">注册</button>
        </div>
        <form v-if="!isRegisterMode" @submit.prevent="doLogin" class="modal-form">
          <input v-model="loginForm.email" type="email" placeholder="邮箱" required class="modal-input" />
          <input v-model="loginForm.password" type="password" placeholder="密码" required class="modal-input" />
          <button type="submit" class="btn btn-primary btn-full">登录</button>
        </form>
        <form v-else @submit.prevent="doRegister" class="modal-form">
          <input v-model="loginForm.email" type="email" placeholder="邮箱" required class="modal-input" />
          <input v-model="loginForm.password" type="password" placeholder="密码（至少 8 位）" required class="modal-input" />
          <button type="submit" class="btn btn-primary btn-full">创建账号</button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// RELEASE-01.1 Task 04：昆仑镜桌面版下载入口（唯一用户下载源 = aigc.fushtn.com，禁止 GitHub 直链）
import { ref, onMounted } from 'vue'
import KunlunNav from '~/components/kunlun/business/KunlunNav.vue'
import KunlunFooter from '~/components/kunlun/business/KunlunFooter.vue'

useHead({ title: '下载桌面版 - 昆仑镜 Kunlun Media' })

const isLoggedIn = ref(false)
const showLogin = ref(false)
const isRegisterMode = ref(false)
const loginForm = ref({ email: '', password: '' })

interface ReleaseMeta {
  version: string
  size: number
  sizeText: string
  publishedAt: string
  publishedText: string
  sha256: string
  downloadUrl: string
}

const meta = ref<ReleaseMeta | null>(null)

onMounted(async () => {
  try {
    const res = await fetch('/releases/desktop/latest.json', { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const mb = (data.size / 1048576).toFixed(1)
    meta.value = {
      version: data.version ?? '—',
      size: data.size ?? 0,
      sizeText: `${mb} MB`,
      publishedAt: data.publishedAt ?? '',
      publishedText: formatTime(data.publishedAt),
      sha256: (data.sha256 ?? '').slice(0, 16) + '…',
      // 下载地址固定指向昆仑镜仓库（相对路径 → 同域 aigc.fushtn.com）
      downloadUrl: data.downloadUrl ?? '#',
    }
  } catch (e) {
    console.error('latest.json 获取失败', e)
  }
})

function formatTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// DIAG-RELEASE-01：诊断包清单（下载链接 + SHA256 + 版本 + 用途）
// 来源：aigc.fushtn.com/releases/desktop/diagnostics/（昆仑镜镜像仓，非 GitHub）
const diagPacks = [
  {
    id: 'diaga',
    name: 'DiagA — 纯 HTML + 外部 JS',
    desc: '验证 WebView2 基础 JS 执行（外部脚本路径）',
    test: 'HTML / external JS',
    version: '1.1.0',
    sha256: '64a587194ae5ee1c92a15a987d16a06e74e04cb2e8c004ddab04e4a6834e1104',
    filename: 'KunlunMediaDiagA_1.1.0_x64-setup.exe',
    url: '/releases/desktop/diagnostics/KunlunMediaDiagA_1.1.0_x64-setup.exe',
  },
  {
    id: 'diagb',
    name: 'DiagB — Vue + inline script',
    desc: '验证 inline script 执行路径（Vue 3 静态页）',
    test: 'Vue / inline script',
    version: '1.1.0',
    sha256: '55a74f2a9f3315a23e67319a4257964f9c238ecd04d90283846a4b84fbe6d68c',
    filename: 'KunlunMediaDiagB_1.1.0_x64-setup.exe',
    url: '/releases/desktop/diagnostics/KunlunMediaDiagB_1.1.0_x64-setup.exe',
  },
]

function doLogin() { /* 登录走 /login 完整流程，此处仅占位 */ }
function doRegister() { /* 注册走 /register 完整流程 */ }
function doLogout() { isLoggedIn.value = false }
</script>

<style scoped>
.download-page { min-height: 100vh; background: #0b0e1a; color: #e8ecf8; font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; }
.dl-main { max-width: 960px; margin: 0 auto; padding: 72px 24px 96px; }
.dl-hero { text-align: center; }
.dl-badge { display: inline-block; padding: 6px 16px; border-radius: 999px; background: rgba(99,102,241,.14); border: 1px solid rgba(99,102,241,.4); color: #a5b4fc; font-size: .85rem; letter-spacing: .5px; }
.dl-title { font-size: clamp(2rem, 5vw, 3.2rem); font-weight: 800; margin: 20px 0 8px; }
.dl-title-accent { background: linear-gradient(90deg,#6366f1,#a855f7); -webkit-background-clip: text; background-clip: text; color: transparent; }
.dl-subtitle { font-size: 1.15rem; color: #a0a8c3; margin-bottom: 16px; }
.dl-desc { color: #8a92b0; line-height: 1.8; margin-bottom: 40px; }

.dl-card { background: #131730; border: 1px solid #232947; border-radius: 20px; padding: 28px; text-align: left; box-shadow: 0 20px 60px rgba(0,0,0,.35); }
.dl-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
.dl-os { display: flex; gap: 14px; align-items: center; }
.dl-os-icon { font-size: 2rem; }
.dl-os-name { font-size: 1.15rem; font-weight: 700; }
.dl-os-sub { color: #7c84a3; font-size: .85rem; margin-top: 4px; }
.dl-meta { display: flex; gap: 28px; flex-wrap: wrap; }
.dl-meta-row { text-align: right; }
.dl-meta-row span { display: block; color: #6f7796; font-size: .78rem; margin-bottom: 4px; }
.dl-meta-row b { font-size: .95rem; color: #cdd4ee; }

.dl-btn { display: flex; align-items: center; justify-content: center; gap: 10px; background: linear-gradient(90deg,#6366f1,#8b5cf6); color: #fff; font-size: 1.1rem; font-weight: 700; padding: 16px 24px; border-radius: 14px; text-decoration: none; transition: transform .15s, box-shadow .15s; box-shadow: 0 8px 24px rgba(99,102,241,.35); }
.dl-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(99,102,241,.5); }
.dl-btn-disabled { opacity: .6; pointer-events: none; }
.dl-btn-icon { font-size: 1.3rem; }
.dl-foot { margin-top: 14px; color: #6f7796; font-size: .78rem; text-align: center; word-break: break-all; }
.dl-sha { color: #8a92b0; }

.dl-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 48px; text-align: left; }
.dl-step { background: #11152b; border: 1px solid #1e2440; border-radius: 16px; padding: 20px; display: flex; gap: 14px; }
.dl-step-num { width: 32px; height: 32px; flex-shrink: 0; border-radius: 50%; background: #6366f1; color: #fff; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.dl-step b { display: block; margin-bottom: 6px; }
.dl-step p { color: #7c84a3; font-size: .85rem; line-height: 1.6; margin: 0; }
.dl-note { margin-top: 32px; color: #6f7796; font-size: .82rem; }

/* DIAG-RELEASE-01：高级诊断下载 */
.dl-diag { margin-top: 56px; text-align: left; border-top: 1px dashed #232947; padding-top: 40px; }
.dl-diag-head { margin-bottom: 24px; }
.dl-diag-title { font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; gap: 10px; }
.dl-diag-tag { font-size: .7rem; font-weight: 600; padding: 3px 10px; border-radius: 999px; background: rgba(245,158,11,.15); border: 1px solid rgba(245,158,11,.45); color: #fbbf24; letter-spacing: .5px; }
.dl-diag-sub { color: #7c84a3; font-size: .85rem; margin-top: 8px; }
.dl-diag-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.dl-diag-card { background: #11152b; border: 1px solid #2a3150; border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
.dl-diag-name { font-weight: 700; font-size: 1rem; }
.dl-diag-desc { color: #8a92b0; font-size: .82rem; line-height: 1.6; }
.dl-diag-rows { display: flex; flex-direction: column; gap: 6px; font-size: .78rem; }
.dl-diag-row { display: flex; gap: 8px; align-items: baseline; }
.dl-diag-row span { color: #6f7796; width: 52px; flex-shrink: 0; }
.dl-diag-row b { color: #cdd4ee; }
.dl-diag-row-sha { flex-direction: column; gap: 2px; }
.dl-diag-row-sha code { color: #8a92b0; word-break: break-all; font-size: .7rem; }
.dl-diag-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: #1e2440; border: 1px solid #2a3150; color: #e8ecf8; font-size: .9rem; font-weight: 600; padding: 10px 14px; border-radius: 10px; text-decoration: none; transition: background .15s, border-color .15s; margin-top: auto; }
.dl-diag-btn:hover { background: #2a3150; border-color: #6366f1; }
.dl-diag-note { margin-top: 16px; color: #6f7796; font-size: .78rem; line-height: 1.8; background: rgba(245,158,11,.05); border: 1px solid rgba(245,158,11,.2); border-radius: 10px; padding: 12px 16px; }

@media (max-width: 768px) {
  .dl-diag-grid { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
  .dl-steps { grid-template-columns: 1fr; }
  .dl-meta { justify-content: flex-start; }
  .dl-meta-row { text-align: left; }
}

/* 登录 Modal（复用首页风格） */
.modal-overlay { position: fixed; inset: 0; background: rgba(5,7,16,.8); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 999; }
.modal-card { background: #141830; border: 1px solid #262d4e; border-radius: 18px; padding: 32px; width: 400px; max-width: 92vw; }
.modal-close { position: absolute; top: 14px; right: 18px; background: none; border: none; color: #8a92b0; font-size: 1.2rem; cursor: pointer; }
.modal-header { text-align: center; margin-bottom: 18px; }
.modal-header h2 { font-size: 1.25rem; }
.modal-tabs { display: flex; gap: 8px; margin-bottom: 18px; }
.tab-btn { flex: 1; padding: 8px; border-radius: 10px; border: 1px solid #262d4e; background: transparent; color: #8a92b0; cursor: pointer; }
.tab-active { background: #6366f1; color: #fff; border-color: #6366f1; }
.modal-form { display: flex; flex-direction: column; gap: 12px; }
.modal-input { padding: 12px 14px; border-radius: 10px; border: 1px solid #262d4e; background: #0e1226; color: #e8ecf8; }
.btn { border: none; cursor: pointer; border-radius: 10px; padding: 12px; font-weight: 700; }
.btn-primary { background: linear-gradient(90deg,#6366f1,#8b5cf6); color: #fff; }
.btn-full { width: 100%; }
</style>
