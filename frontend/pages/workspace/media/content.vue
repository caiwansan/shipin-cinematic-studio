<!--
  新媒体运营工作台 — 内容中心

  Sprint-MEDIA-UX-01: 内容发布框架（真实空态）
  - 展示发布流程设计（AI生成→合规→草稿→发布→回流），纯结构说明
  - 无内容：账号未接入，真实内容列表为空（禁 mock 内容）
-->
<template>
  <MediaWorkspaceShell>
    <!-- ═══ 发布流程框架 ═══ -->
    <section class="mc-section">
      <div class="mc-section-head">
        <h2 class="mc-section-title">📤 内容发布流程</h2>
        <span class="mc-section-meta">设计框架 · 账号接入后启用</span>
      </div>
      <div class="mc-flow">
        <div v-for="(step, i) in FLOW" :key="i" class="mc-flow-step">
          <div class="mc-flow-icon">{{ step.icon }}</div>
          <div class="mc-flow-body">
            <div class="mc-flow-title">{{ step.title }}</div>
            <div class="mc-flow-desc">{{ step.desc }}</div>
          </div>
          <span v-if="i < FLOW.length - 1" class="mc-flow-arrow">→</span>
        </div>
      </div>
    </section>

    <!-- ═══ 内容列表（真实空态）═══ -->
    <section class="mc-section">
      <div class="mc-section-head">
        <h2 class="mc-section-title">📚 内容列表</h2>
        <span class="mc-section-meta">真实发布记录（无 mock）</span>
      </div>
      <div class="mc-empty">
        <span class="mc-empty-icon">📝</span>
        <p class="mc-empty-title">暂无内容</p>
        <p class="mc-empty-desc">
          微信公众平台账号接入后，这里展示 AI 员工真实生成、发布的内容及平台回执状态
          （publish_id / 微信后台可见），不会出现任何模拟发布记录。
        </p>
      </div>
    </section>

    <!-- ═══ 合规说明 ═══ -->
    <section class="mc-section">
      <div class="mc-section-head">
        <h2 class="mc-section-title">🛡️ 发布合规</h2>
      </div>
      <ul class="mc-rules">
        <li>所有内容发布必须经过官方 API（freepublish），禁止伪造发布状态</li>
        <li>发布频控遵守平台规则，adapter 层实现退避重试，不触发封号风险</li>
        <li>账号属于企业资产，操作全程可追溯（agent_outcome + usage_logs）</li>
        <li>合规检查（media.compliance.check）将在能力注册后接入发布链路</li>
      </ul>
    </section>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">
const FLOW = [
  { icon: '🧠', title: 'AI 内容生成', desc: 'Media Producer 基于选题生成图文内容（BYOK 企业模型）' },
  { icon: '🛡️', title: '合规检查', desc: 'media.compliance.check 内容合规 + 敏感词校验' },
  { icon: '📄', title: '草稿箱', desc: '官方 draft/add 写入公众号草稿箱' },
  { icon: '🚀', title: '真实发布', desc: '官方 freepublish/submit 发布，微信后台可见' },
  { icon: '📊', title: '数据回流', desc: 'datacube 拉取阅读/分享数据 → SocialMetricsSnapshot → 运营日报' },
]
</script>

<style scoped>
.mc-section {
  background: #fff;
  border: 1px solid #ececf1;
  border-radius: 14px;
  padding: 20px;
  margin-bottom: 20px;
}
.mc-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 16px;
}
.mc-section-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #1a1a2e;
}
.mc-section-meta {
  font-size: 11px;
  color: #b0b0c0;
}
.mc-flow {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.mc-flow-step {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f7f8fa;
  border: 1px solid #ececf1;
  border-radius: 10px;
  padding: 12px 14px;
  position: relative;
  flex: 1;
  min-width: 170px;
}
.mc-flow-icon {
  font-size: 22px;
}
.mc-flow-title {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a2e;
}
.mc-flow-desc {
  font-size: 11px;
  color: #8a8a9e;
  margin-top: 3px;
  line-height: 1.5;
}
.mc-flow-arrow {
  color: #c5c5d0;
  font-size: 16px;
  position: absolute;
  right: -12px;
  z-index: 1;
}
.mc-empty {
  text-align: center;
  padding: 32px 0 20px;
}
.mc-empty-icon {
  font-size: 34px;
}
.mc-empty-title {
  font-weight: 600;
  color: #5a5a70;
  margin: 10px 0 4px;
  font-size: 15px;
}
.mc-empty-desc {
  font-size: 12px;
  color: #9a9aad;
  max-width: 460px;
  margin: 0 auto;
  line-height: 1.7;
}
.mc-rules {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: #6b6b80;
  line-height: 2.1;
}
</style>
