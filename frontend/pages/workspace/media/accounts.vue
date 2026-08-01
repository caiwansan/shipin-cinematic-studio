<!--
  新媒体运营工作台 — 账号管理

  Sprint-MEDIA-UX-01: 账号管理框架（真实空态）
  - 微信公众平台：未连接（等 appid/secret + IP 白名单），凭证将加密入 ProviderCredential
  - 多平台位：规划中 locked（官方 API 唯一通道，禁浏览器自动化）
  - 不创建假连接状态
-->
<template>
  <MediaWorkspaceShell>
    <!-- ═══ 微信公众平台 ═══ -->
    <section class="ma-section">
      <div class="ma-card">
        <div class="ma-card-head">
          <div class="ma-logo ma-logo--wx">微</div>
          <div>
            <h3 class="ma-name">微信公众平台</h3>
            <p class="ma-desc">企业认证服务号 · 内容发布与数据回流</p>
          </div>
          <span class="ma-badge ma-badge--wait">⏳ 未连接</span>
        </div>

        <div class="ma-connect-flow">
          <div v-for="(step, i) in CONNECT_STEPS" :key="i" class="ma-step">
            <div class="ma-step-num">{{ i + 1 }}</div>
            <div>
              <div class="ma-step-title">{{ step.title }}</div>
              <div class="ma-step-desc">{{ step.desc }}</div>
            </div>
          </div>
        </div>

        <div class="ma-note">
          <strong>凭证安全：</strong>appid/secret 将加密存入 ProviderCredential（企业资产），平台侧仅展示掩码
          <code class="ma-code">sk-****</code> 风格，管理员零明文可见（G4 标准延续）。
        </div>

        <div class="ma-pending">
          <p>⏳ 等待掌柜交付：① 企业认证服务号 ② appid + secret ③ IP 白名单授权（服务器出口 <code class="ma-code">124.223.208.24</code>）</p>
          <p class="ma-pending-sub">到货后 Sprint-MEDIA-01 启动真实连接，此页自动切换为已连接状态（非手动伪造）。</p>
        </div>
      </div>
    </section>

    <!-- ═══ 多平台规划 ═══ -->
    <section class="ma-section">
      <div class="ma-section-head">
        <h2 class="ma-section-title">🌐 平台扩展</h2>
        <span class="ma-section-meta">仅官方 API 接入 · 禁浏览器自动化（MEDIA-PRODUCT-CONSTITUTION-01）</span>
      </div>
      <div class="ma-platform-grid">
        <div v-for="p in PLATFORMS" :key="p.name" class="ma-platform ma-platform--locked">
          <span class="ma-platform-icon">{{ p.icon }}</span>
          <div class="ma-platform-name">{{ p.name }}</div>
          <div class="ma-platform-desc">{{ p.desc }}</div>
          <span class="ma-platform-tag">{{ p.tag }}</span>
        </div>
      </div>
    </section>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">
const CONNECT_STEPS = [
  { title: '凭证加密入库', desc: 'appid/secret 经 encryptKey 加密存入 ProviderCredential（provider=wechat_mp）' },
  { title: 'access_token 获取', desc: '官方 /cgi-bin/token 接口换取 2h 凭证，缓存 + 过期刷新（IP 白名单校验）' },
  { title: '账号连接', desc: 'SocialAccount 建立，健康检查 healthStatus=ok，微信后台可见账号' },
  { title: '内容发布闭环', desc: '素材 → 草稿 → freepublish 真实发布 → datacube 数据回流昆仑镜' },
]

const PLATFORMS = [
  { icon: '📱', name: '视频号', desc: '官方开放平台接入（规划中）', tag: '规划中' },
  { icon: '🎵', name: '抖音', desc: '官方开放平台接入（规划中）', tag: '规划中' },
  { icon: '📕', name: '小红书', desc: '官方开放平台接入（规划中）', tag: '规划中' },
]
</script>

<style scoped>
.ma-section {
  background: #fff;
  border: 1px solid #ececf1;
  border-radius: 14px;
  padding: 20px;
  margin-bottom: 20px;
}
.ma-card-head {
  display: flex;
  align-items: center;
  gap: 14px;
}
.ma-logo {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
}
.ma-logo--wx {
  background: #07c160;
  color: #fff;
}
.ma-name {
  margin: 0;
  font-size: 15px;
  color: #1a1a2e;
}
.ma-desc {
  margin: 2px 0 0;
  font-size: 12px;
  color: #9a9aad;
}
.ma-badge {
  margin-left: auto;
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 20px;
  font-weight: 600;
}
.ma-badge--wait {
  background: #fffbea;
  color: #b45309;
  border: 1px solid #fde68a;
}
.ma-connect-flow {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin: 20px 0 14px;
}
.ma-step {
  display: flex;
  gap: 10px;
  background: #f7f8fa;
  border: 1px solid #ececf1;
  border-radius: 10px;
  padding: 12px;
}
.ma-step-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #2563eb;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ma-step-title {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a2e;
}
.ma-step-desc {
  font-size: 11px;
  color: #8a8a9e;
  margin-top: 3px;
  line-height: 1.5;
}
.ma-note {
  font-size: 12px;
  color: #6b6b80;
  background: #eff6ff;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  padding: 10px 14px;
  line-height: 1.6;
}
.ma-code {
  background: #fff;
  border: 1px solid #e5e5ec;
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 11px;
}
.ma-pending {
  margin-top: 14px;
  font-size: 13px;
  color: #6b6b80;
  background: #fffbea;
  border: 1px dashed #fde68a;
  border-radius: 10px;
  padding: 12px 14px;
}
.ma-pending p {
  margin: 0;
}
.ma-pending-sub {
  margin-top: 6px;
  font-size: 12px;
  color: #9a9aad;
}
.ma-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 14px;
}
.ma-section-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #1a1a2e;
}
.ma-section-meta {
  font-size: 11px;
  color: #b0b0c0;
}
.ma-platform-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.ma-platform {
  border: 1px dashed #d5d5e0;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  background: #fafafc;
}
.ma-platform-icon {
  font-size: 26px;
}
.ma-platform-name {
  font-size: 14px;
  font-weight: 600;
  color: #5a5a70;
  margin-top: 8px;
}
.ma-platform-desc {
  font-size: 11px;
  color: #9a9aad;
  margin-top: 4px;
}
.ma-platform-tag {
  display: inline-block;
  margin-top: 10px;
  font-size: 10px;
  background: #f0f0f5;
  color: #9a9aad;
  border-radius: 10px;
  padding: 2px 8px;
}
</style>
