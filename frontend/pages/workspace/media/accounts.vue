<!--
  Sprint-MEDIA-UX-03 — 新媒体资产（账号管理，暗色产品级）
  资产卡 + AI 权限清单（发布/回复/数据读取）+ 连接流程
  纪律: 未连接态真实展示；Sprint-MEDIA-01 微信资产接入后点亮
-->
<template>
  <MediaWorkspaceShell>
    <MediaPageHeader
      kicker="Media Assets"
      title="新媒体资产"
      desc="企业真实账号资产，AI 员工通过授权执行发布、回复与数据读取。"
    />

    <!-- 微信公众号资产卡 -->
    <div class="as-asset">
      <div class="as-asset-left">
        <span class="as-logo">🟢</span>
        <div class="as-asset-meta">
          <div class="as-asset-name">微信公众号</div>
          <div class="as-asset-sub">企业认证服务号</div>
        </div>
        <div class="as-asset-status">
          <span class="as-status-dot off"></span>
          未连接
        </div>
      </div>
      <div class="as-asset-stats">
        <div class="as-stat"><b>—</b><span>粉丝</span></div>
        <div class="as-stat"><b>—</b><span>内容</span></div>
        <div class="as-stat"><b>—</b><span>互动</span></div>
      </div>

      <!-- AI 权限 -->
      <div class="as-perms">
        <div class="as-perms-title">🤖 AI 权限</div>
        <div v-for="p in perms" :key="p.key" class="as-perm">
          <span class="as-check" :class="{ off: !p.on }"></span>
          <div>
            <b>{{ p.name }}</b>
            <span class="as-perm-sub">{{ p.desc }}</span>
          </div>
        </div>
      </div>

      <button class="as-cta" @click="connect">连接微信公众平台</button>
    </div>

    <!-- 连接价值说明（未连接 ≠ 不可用：连接后 AI 员工才能执行运营任务） -->
    <div class="as-note">
      <span class="as-note-ico">🔗</span>
      <span><b>未连接不是不可用</b>——连接账号后，AI 员工才能基于授权执行运营任务：发布内容、回复粉丝、读取数据。连接流程见下方 4 步。</span>
    </div>

    <!-- 连接流程 -->
    <div class="as-steps">
      <div v-for="(s, i) in steps" :key="i" class="as-step">
        <span class="as-step-num">{{ i + 1 }}</span>
        <div>
          <b>{{ s.title }}</b>
          <span class="as-step-desc">{{ s.desc }}</span>
        </div>
      </div>
    </div>

    <!-- 多平台规划（统一「未连接」表达：接入准备中，非不可用） -->
    <MediaPanel icon="🌐" title="多平台规划" sub="企业新媒体矩阵扩展方向 · 均未连接">
      <div class="as-planned">
        <div v-for="p in planned" :key="p.name" class="as-planned-item">
          <span class="as-planned-ico">{{ p.icon }}</span>
          <div>
            <b>{{ p.name }}</b>
            <span class="as-planned-sub">{{ p.note }}</span>
          </div>
          <span class="as-planned-tag">未连接</span>
        </div>
      </div>
      <div class="as-planned-foot">各平台接入后统一走同一套流程：获取凭证 → 配置白名单 → 授权 AI 员工 → 验证连接。连接后 AI 员工才能执行对应平台的运营任务。</div>
    </MediaPanel>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">

definePageMeta({ middleware: 'auth' })
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'
import MediaPageHeader from '~/components/media/MediaPageHeader.vue'
import MediaPanel from '~/components/media/MediaPanel.vue'

const { $toast } = useNuxtApp() as any

const perms = ref([
  { key: 'publish', name: '发布', desc: 'AI 代发图文/文章', on: false },
  { key: 'reply', name: '回复', desc: 'AI 接待粉丝消息', on: false },
  { key: 'data', name: '数据读取', desc: '阅读/粉丝/互动统计', on: false },
])

const steps = [
  { title: '获取凭证', desc: '企业认证服务号 appid + secret' },
  { title: '配置白名单', desc: '服务器 IP 加入微信 IP 白名单' },
  { title: '授权 AI 员工', desc: '勾选发布/回复/数据权限' },
  { title: '验证连接', desc: '测试连接成功后资产卡点亮' },
]

const planned = [
  { icon: '📱', name: '抖音', note: '企业号 · 视频内容分发' },
  { icon: '📕', name: '小红书', note: '企业号 · 种草图文' },
  { icon: '📺', name: '视频号', note: '企业认证 · 微信生态分发' },
]

function connect() {
  $toast?.info?.('微信资产接入等待掌柜提供 appid/secret（Sprint-MEDIA-01）')
}
</script>

<style scoped>
.as-asset {
  background: var(--media-card-bg);
  border: 1px solid var(--media-card-border);
  border-radius: var(--media-radius-card);
  padding: 24px 26px;
  display: grid;
  grid-template-columns: 1.2fr 0.8fr auto auto;
  gap: 22px;
  align-items: center;
  margin-bottom: var(--media-gap-card);
  box-shadow: var(--media-card-shadow);
}
.as-asset-left {
  display: flex;
  align-items: center;
  gap: 14px;
}
.as-logo {
  font-size: 36px;
}
.as-asset-meta { flex: 1; }
.as-asset-name {
  font-size: 16px;
  font-weight: 800;
  color: var(--color-text-primary);
}
.as-asset-sub {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
}
.as-asset-status {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  background: var(--color-bg-hover);
  border-radius: 16px;
  padding: 5px 12px;
}
.as-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.as-status-dot.off { background: var(--color-text-disabled); }
.as-asset-stats {
  display: flex;
  gap: 22px;
}
.as-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  color: var(--color-text-muted);
}
.as-stat b {
  font-size: 18px;
  color: var(--color-text-primary);
}
.as-perms {
  border-left: 1px solid var(--color-border-primary);
  padding-left: 22px;
}
.as-perms-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-bottom: 10px;
}
.as-perm {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 0;
  font-size: 12px;
  color: var(--color-text-primary);
}
.as-perm b { display: block; font-size: 12px; }
.as-perm-sub { font-size: 10px; color: var(--color-text-muted); }
.as-check {
  width: 15px;
  height: 15px;
  border-radius: 4px;
  border: 2px solid var(--color-decision);
  background: var(--color-decision);
  position: relative;
  flex-shrink: 0;
}
.as-check::after {
  content: '✓';
  color: #fff;
  font-size: 10px;
  position: absolute;
  top: -2px;
  left: 2px;
  font-weight: 800;
}
.as-check.off {
  background: transparent;
  border-color: var(--color-border-secondary);
}
.as-check.off::after { content: '—'; color: var(--color-text-disabled); }
.as-cta {
  background: #07c160;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 13px 18px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 4px 16px rgba(7, 193, 96, 0.25);
}
.as-cta:hover { opacity: 0.92; }

.as-steps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.as-step {
  background: var(--media-card-bg);
  border: 1px solid var(--media-card-border);
  border-radius: var(--media-radius-panel);
  padding: 15px 16px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  box-shadow: var(--media-card-shadow);
}
.as-step-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--color-intelligence-glow);
  color: var(--color-intelligence);
  font-size: 12px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.as-step b {
  display: block;
  font-size: 12px;
  color: var(--color-text-primary);
}
.as-step-desc {
  font-size: 10px;
  color: var(--color-text-muted);
}
.as-planned {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.as-planned-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--media-card-bg);
  border: 1px solid var(--media-card-border);
  border-radius: var(--media-radius-panel);
  padding: 15px;
  box-shadow: var(--media-card-shadow);
}
.as-planned-ico { font-size: 22px; }
.as-planned-item b { display: block; font-size: 13px; color: var(--color-text-primary); }
.as-planned-sub { font-size: 10px; color: var(--color-text-muted); }
.as-planned-tag {
  margin-left: auto;
  font-size: 9px;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border-secondary);
  border-radius: 8px;
  padding: 2px 8px;
  white-space: nowrap;
}
.as-planned-foot {
  margin-top: 12px;
  font-size: 11px;
  color: var(--color-text-muted);
  line-height: 1.6;
}
.as-note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: linear-gradient(90deg, var(--media-card-bg-solid), rgba(139, 92, 246, 0.06));
  border: 1px solid var(--media-card-border);
  border-radius: var(--media-radius-panel);
  padding: 14px 18px;
  margin-bottom: var(--media-gap-card);
  font-size: 12px;
  color: var(--media-text-body);
  line-height: 1.6;
}
.as-note-ico { font-size: 15px; }
.as-note b { color: var(--color-text-primary); }
@media (max-width: 1000px) {
  .as-asset { grid-template-columns: 1fr; }
  .as-perms { border-left: none; padding-left: 0; border-top: 1px solid var(--color-border-primary); padding-top: 14px; }
  .as-steps { grid-template-columns: 1fr 1fr; }
  .as-planned { grid-template-columns: 1fr; }
}
</style>
