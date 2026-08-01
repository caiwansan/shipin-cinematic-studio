<!--
  Sprint-MEDIA-UX-03 — 数据分析（暗色产品级）
  维度: 内容 / 粉丝 / 互动（微信 datacube 回流）
  纪律: 回流前全部待启用空态，禁 mock
-->
<template>
  <MediaWorkspaceShell>
    <MediaPageHeader
      kicker="Media Analytics"
      title="数据分析"
      :status="{ text: '等待数据回流', type: 'off' }"
      desc="微信 datacube 官方数据回流后，内容、粉丝与互动数据将在这里形成图表。"
    />

    <div class="an-grid">
      <MediaPanel
        v-for="dim in dims" :key="dim.key"
        :icon="dim.icon" :title="dim.name" :sub="dim.note"
      >
        <MediaEmptyState
          :icon="dim.icon" title="待数据回流"
          :desc="dim.emptyDesc" :source="dim.source"
        />
      </MediaPanel>
    </div>

    <div class="an-rule">
      <div class="an-rule-title">🔒 数据原则（已冻结）</div>
      <p>所有图表数据来自微信公众平台 datacube 官方接口回流。禁止伪造阅读量、粉丝数与互动数据。账号连接并开启数据权限后自动点亮。</p>
    </div>
    <!-- 订阅提示条 -->
    <div class="an-cta">
      <span>订阅 AI 员工后：数据自动回流、每周自动复盘，产出增长建议驱动下一轮内容。</span>
      <NuxtLink to="/workspace/media" class="an-cta-btn">解锁 AI 新媒体团队 →</NuxtLink>
    </div>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">

definePageMeta({ middleware: 'auth' })
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'
import MediaPageHeader from '~/components/media/MediaPageHeader.vue'
import MediaPanel from '~/components/media/MediaPanel.vue'
import MediaEmptyState from '~/components/media/MediaEmptyState.vue'

const dims = [
  { key: 'content', icon: '📄', name: '内容数据', note: '阅读 · 分享 · 在看', emptyDesc: '每篇内容的真实阅读与互动数据。', source: 'WeChat datacube · Sprint-MEDIA-01' },
  { key: 'fans', icon: '👥', name: '粉丝数据', note: '新增 · 取关 · 净增', emptyDesc: '粉丝增长趋势与来源分析。', source: 'WeChat datacube · Sprint-MEDIA-01' },
  { key: 'interact', icon: '💬', name: '互动数据', note: '留言 · 点赞 · 收藏', emptyDesc: '用户互动行为与内容偏好。', source: 'WeChat datacube · Sprint-MEDIA-01' },
]
</script>

<style scoped>
.an-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 18px;
}
.an-rule {
  background: var(--media-card-bg);
  border: 1px solid var(--media-card-border);
  border-radius: var(--media-radius-card);
  padding: 18px 22px;
  box-shadow: var(--media-card-shadow);
}
.an-rule-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--media-text-title);
  margin-bottom: 8px;
}
.an-rule p {
  font-size: 12px;
  color: var(--media-text-body);
  line-height: 1.7;
  margin: 0;
}
.an-cta {
  margin-top: var(--media-gap-section);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  background: linear-gradient(90deg, var(--media-card-bg-solid), rgba(139, 92, 246, 0.1));
  border: 1px solid var(--media-ai-border);
  border-radius: var(--media-radius-card);
  padding: 16px 22px;
  font-size: 12px;
  color: var(--media-text-body);
  box-shadow: var(--media-card-shadow);
}
.an-cta-btn {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: var(--media-brand-gradient);
  border-radius: var(--media-radius-node);
  padding: 10px 20px;
  text-decoration: none;
  white-space: nowrap;
  box-shadow: 0 6px 18px var(--media-brand-glow);
}
.an-cta-btn:hover { filter: brightness(1.1); }

@media (max-width: 900px) {
  .an-grid { grid-template-columns: 1fr; }
}
</style>
