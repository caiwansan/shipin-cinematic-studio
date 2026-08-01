<!--
  Sprint-MEDIA-UX-02 — 账号管理（新媒体资产）
  资产卡: 状态 + 粉丝/内容统计位 + AI 权限清单（发布/回复/数据读取）
  纪律: 未连接态真实展示；连接（Sprint-MEDIA-01）后显示真实资产数据
-->
<template>
  <MediaWorkspaceShell>
    <div class="ac">
      <div class="ac-head">
        <div>
          <h2 class="ac-title">🔗 新媒体资产</h2>
          <p class="ac-sub">企业真实账号资产 · AI 员工通过授权执行发布/回复/数据读取</p>
        </div>
      </div>

      <!-- 微信公众平台资产卡 -->
      <div class="ac-asset">
        <div class="ac-asset-main">
          <span class="ac-logo">🟢</span>
          <div class="ac-asset-meta">
            <div class="ac-asset-name">微信公众号</div>
            <div class="ac-asset-status">
              <span class="ac-status-dot ac-status-off"></span>
              未连接
            </div>
          </div>
          <div class="ac-asset-stats">
            <div class="ac-asset-stat"><b>—</b><span>粉丝</span></div>
            <div class="ac-asset-stat"><b>—</b><span>内容</span></div>
            <div class="ac-asset-stat"><b>—</b><span>互动</span></div>
          </div>
        </div>

        <!-- AI 权限清单 -->
        <div class="ac-perms">
          <div class="ac-perms-title">🤖 AI 权限（授权后生效）</div>
          <div class="ac-perm">
            <span class="ac-checkbox" :class="{ off: !permissions.publish }"></span>
            <div><b>发布</b><span class="ac-perm-sub">AI 代发图文/文章</span></div>
          </div>
          <div class="ac-perm">
            <span class="ac-checkbox" :class="{ off: !permissions.reply }"></span>
            <div><b>回复</b><span class="ac-perm-sub">AI 接待粉丝消息</span></div>
          </div>
          <div class="ac-perm">
            <span class="ac-checkbox" :class="{ off: !permissions.data }"></span>
            <div><b>数据读取</b><span class="ac-perm-sub">阅读/粉丝/互动统计</span></div>
          </div>
        </div>

        <button class="ac-cta" @click="startConnect">连接微信公众平台</button>
      </div>

      <!-- 连接流程 -->
      <div class="ac-steps">
        <div v-for="(s, i) in steps" :key="i" class="ac-step">
          <span class="ac-step-num">{{ i + 1 }}</span>
          <div class="ac-step-body">
            <b>{{ s.title }}</b>
            <span>{{ s.desc }}</span>
          </div>
        </div>
      </div>

      <!-- 平台规划位 -->
      <div class="ac-more">
        <h3 class="ac-more-title">多平台规划</h3>
        <div class="ac-more-grid">
          <div v-for="p in planned" :key="p.name" class="ac-more-item">
            <span>{{ p.icon }}</span>
            <div><b>{{ p.name }}</b><span class="ac-more-sub">{{ p.note }}</span></div>
            <span class="ac-more-tag">规划中</span>
          </div>
        </div>
      </div>
    </div>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'

const { $toast } = useNuxtApp() as any

const permissions = ref({ publish: false, reply: false, data: false })

const steps = [
  { title: '获取凭证', desc: '企业认证服务号 appid + secret（掌柜提供）' },
  { title: '配置白名单', desc: '服务器 IP 加入微信 IP 白名单' },
  { title: '授权 AI 员工', desc: '勾选发布/回复/数据读取权限' },
  { title: '验证连接', desc: '测试连接成功后资产卡自动点亮' },
]

const planned = [
  { icon: '📱', name: '抖音', note: '企业号 · 视频内容分发', tag: '规划中' },
  { icon: '🧣', name: '微博', note: '企业号 · 图文分发', tag: '规划中' },
  { icon: '💼', name: '知乎', note: '企业号 · 深度内容', tag: '规划中' },
]

function startConnect() {
  $toast?.info?.('微信资产接入等待掌柜提供 appid/secret（Sprint-MEDIA-01）')
}
</script>

<style scoped>
.ac-head {
  margin-bottom: 20px;
}
.ac-title {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0;
}
.ac-sub {
  font-size: 12px;
  color: #8a8a9e;
  margin: 4px 0 0;
}
.ac-asset {
  background: #fff;
  border: 1px solid #ececf1;
  border-radius: 12px;
  padding: 20px;
  display: grid;
  grid-template-columns: 1.4fr 1fr auto;
  gap: 20px;
  align-items: center;
  margin-bottom: 16px;
}
.ac-asset-main {
  display: flex;
  align-items: center;
  gap: 14px;
}
.ac-logo {
  font-size: 34px;
}
.ac-asset-meta { flex: 1; }
.ac-asset-name {
  font-size: 15px;
  font-weight: 700;
  color: #1a1a2e;
}
.ac-asset-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #8a8a9e;
  margin-top: 4px;
}
.ac-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.ac-status-off { background: #d1d1da; }
.ac-asset-stats {
  display: flex;
  gap: 20px;
}
.ac-asset-stat {
  display: flex;
  flex-direction: column;
  font-size: 11px;
  color: #9a9aad;
  text-align: center;
}
.ac-asset-stat b {
  font-size: 17px;
  color: #1a1a2e;
}
.ac-perms {
  border-left: 1px solid #f1f1f5;
  padding-left: 20px;
}
.ac-perms-title {
  font-size: 12px;
  font-weight: 700;
  color: #333;
  margin-bottom: 10px;
}
.ac-perm {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  font-size: 13px;
  color: #444;
}
.ac-perm b { display: block; }
.ac-perm-sub {
  font-size: 11px;
  color: #9a9aad;
}
.ac-checkbox {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 2px solid #2563eb;
  background: #2563eb;
  position: relative;
  flex-shrink: 0;
}
.ac-checkbox::after {
  content: '✓';
  color: #fff;
  font-size: 11px;
  position: absolute;
  top: -2px;
  left: 2px;
  font-weight: 800;
}
.ac-checkbox.off {
  background: #fff;
  border-color: #d1d1da;
}
.ac-checkbox.off::after {
  content: '—';
  color: #b0b0c0;
}
.ac-cta {
  background: #07c160;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}
.ac-cta:hover {
  background: #06ad56;
}
.ac-steps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}
.ac-step {
  background: #fff;
  border: 1px solid #ececf1;
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.ac-step-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #eef2ff;
  color: #2563eb;
  font-size: 12px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ac-step-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: #444;
}
.ac-step-body span {
  font-size: 11px;
  color: #9a9aad;
}
.ac-more {
  background: #fff;
  border: 1px solid #ececf1;
  border-radius: 12px;
  padding: 16px 18px;
}
.ac-more-title {
  font-size: 13px;
  font-weight: 700;
  color: #333;
  margin: 0 0 12px;
}
.ac-more-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.ac-more-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fafafc;
  border-radius: 10px;
  padding: 12px;
  font-size: 13px;
}
.ac-more-item span { font-size: 20px; }
.ac-more-item b { display: block; color: #333; }
.ac-more-sub { font-size: 11px; color: #9a9aad; }
.ac-more-tag {
  margin-left: auto;
  font-size: 10px;
  background: #f0f0f5;
  color: #9a9aad;
  border-radius: 8px;
  padding: 2px 8px;
  font-size: 10px;
}
@media (max-width: 900px) {
  .ac-asset { grid-template-columns: 1fr; }
  .ac-perms { border-left: none; padding-left: 0; border-top: 1px solid #f1f1f5; padding-top: 14px; }
  .ac-steps { grid-template-columns: 1fr 1fr; }
}
</style>
