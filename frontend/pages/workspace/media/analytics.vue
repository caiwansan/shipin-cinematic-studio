<!--
  Sprint-MEDIA-UX-02 — 数据分析（框架）
  维度: 内容数据（阅读/分享/在看）· 粉丝数据（新增/取关）· 互动数据（留言/点赞）
  纪律: 微信 datacube 回流（Sprint-MEDIA-01）前全部为待启用空态，禁 mock
-->
<template>
  <MediaWorkspaceShell>
    <div class="an">
      <div class="an-head">
        <div>
          <h2 class="an-title">📊 数据分析</h2>
          <p class="an-sub">微信 datacube 真实数据回流后启用</p>
        </div>
        <span class="an-badge">待数据源</span>
      </div>

      <div class="an-grid">
        <div v-for="dim in dims" :key="dim.key" class="an-card">
          <div class="an-card-head">
            <span class="an-card-ico">{{ dim.icon }}</span>
            <span class="an-card-name">{{ dim.name }}</span>
          </div>
          <div class="an-chart">
            <div class="an-chart-empty">
              <div class="an-chart-ico">📈</div>
              <p>待启用</p>
              <p class="an-chart-sub">{{ dim.note }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="an-note">
        <b>数据原则（已冻结）</b>
        <p>所有图表数据来自微信公众平台 datacube 官方接口回流，禁止伪造阅读量/粉丝数/互动数据。账号连接并开启数据权限后自动点亮。</p>
      </div>
    </div>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'

const dims = [
  { key: 'content', icon: '📄', name: '内容数据', note: '阅读量 · 分享 · 在看（datacube）' },
  { key: 'fans', icon: '👥', name: '粉丝数据', note: '新增 · 取关 · 净增（datacube）' },
  { key: 'interact', icon: '💬', name: '互动数据', note: '留言 · 点赞 · 收藏（datacube）' },
]
</script>

<style scoped>
.an-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 20px;
}
.an-title {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0;
}
.an-sub {
  font-size: 12px;
  color: #8a8a9e;
  margin: 4px 0 0;
}
.an-badge {
  font-size: 11px;
  background: #f0f0f5;
  color: #9a9aad;
  border-radius: 20px;
  padding: 4px 12px;
  font-weight: 600;
}
.an-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 20px;
}
.an-card {
  background: #fff;
  border: 1px solid #ececf1;
  border-radius: 12px;
  overflow: hidden;
}
.an-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid #f1f1f5;
}
.an-card-ico { font-size: 16px; }
.an-card-name {
  font-size: 13px;
  font-weight: 700;
  color: #333;
}
.an-chart {
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.an-chart-empty {
  text-align: center;
  color: #8a8a9e;
  font-size: 13px;
}
.an-chart-ico {
  font-size: 28px;
  margin-bottom: 6px;
  opacity: 0.5;
}
.an-chart-sub {
  font-size: 11px;
  color: #b0b0c0;
  margin-top: 4px;
}
.an-note {
  background: #fff8e8;
  border: 1px solid #ffe2ae;
  border-radius: 12px;
  padding: 14px 18px;
  font-size: 12px;
  color: #7a5a1e;
}
.an-note p {
  margin: 6px 0 0;
  line-height: 1.6;
}
@media (max-width: 900px) {
  .an-grid { grid-template-columns: 1fr; }
}
</style>
