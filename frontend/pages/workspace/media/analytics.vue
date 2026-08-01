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
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 14px;
  padding: 18px 20px;
}
.an-rule-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 8px;
}
.an-rule p {
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.7;
  margin: 0;
}
@media (max-width: 900px) {
  .an-grid { grid-template-columns: 1fr; }
}
</style>
