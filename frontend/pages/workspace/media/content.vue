<!--
  Sprint-MEDIA-UX-03 — AI Content Factory 内容工厂
  六层结构: 内容战略 → 选题池 → 生产队列 → 审核中心 → 发布记录 → 效果反馈
  纪律: 真实空态；SocialPost 接入（Sprint-MEDIA-01）后自动点亮
-->
<template>
  <MediaWorkspaceShell>
    <MediaPageHeader
      kicker="AI Content Factory"
      title="内容工厂"
      desc="从内容战略到效果反馈的完整生产管线——AI 员工在这里选题、生产、审核、发布并回收数据。"
    />

    <!-- 工厂管线横幅 -->
    <div class="cf-pipeline">
      <div v-for="(s, i) in stages" :key="s.key" class="cf-stage" :class="{ 'is-current': i === 0 }">
        <div class="cf-stage-node">
          <span class="cf-stage-ico">{{ s.icon }}</span>
          <span class="cf-stage-num">{{ i + 1 }}</span>
        </div>
        <div class="cf-stage-name">{{ s.name }}</div>
        <div class="cf-stage-count">{{ s.count }} 项</div>
      </div>
    </div>

    <!-- 六层生产面板 -->
    <div class="cf-layers">
      <div v-for="(s, i) in stages" :key="s.key" class="cf-layer" :class="{ 'is-core': i >= 1 && i <= 4 }">
        <div class="cf-layer-head">
          <div class="cf-layer-title">
            <span class="cf-layer-ico">{{ s.icon }}</span>
            <div>
              <div class="cf-layer-name">{{ s.name }}</div>
              <div class="cf-layer-desc">{{ s.desc }}</div>
            </div>
          </div>
          <span class="cf-layer-badge">{{ s.badge }}</span>
        </div>
        <div class="cf-layer-body">
          <MediaEmptyState
            :icon="s.icon" :title="s.emptyTitle" :desc="s.emptyDesc"
            :source="s.source"
          />
        </div>
      </div>
    </div>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'
import MediaPageHeader from '~/components/media/MediaPageHeader.vue'
import MediaEmptyState from '~/components/media/MediaEmptyState.vue'

const stages = ref([
  {
    key: 'strategy', icon: '🎯', name: '内容战略', badge: 'AI 规划',
    desc: 'AI 运营总监制定内容方向与排期',
    emptyTitle: '战略待制定', emptyDesc: 'AI 总监部署后，将生成内容方向、目标与排期计划。',
    source: 'AgentSchedule · strategy · Sprint-MEDIA-03', count: 0,
  },
  {
    key: 'ideas', icon: '💡', name: '选题池', badge: '热点驱动',
    desc: '行业热点扫描产生的选题候选',
    emptyTitle: '选题池为空', emptyDesc: '行业智能数据源接入后，AI 将从热点/竞品中挖掘选题。',
    source: '行业智能 · Sprint-MEDIA-03', count: 0,
  },
  {
    key: 'produce', icon: '✍️', name: '生产队列', badge: 'BYOK 生成',
    desc: 'AI 员工撰写文章/视频文案',
    emptyTitle: '队列空闲', emptyDesc: '选题确认后进入生产队列，由 AI 员工真实生成稿件。',
    source: 'AgentTask · content · BYOK 模型', count: 0,
  },
  {
    key: 'review', icon: '🔍', name: '审核中心', badge: '合规检查',
    desc: '平台规则与合规审核',
    emptyTitle: '审核队列为空', emptyDesc: '生产完成的稿件进入合规审核，通过后进入发布队列。',
    source: '审核队列 · 平台规则', count: 0,
  },
  {
    key: 'publish', icon: '🚀', name: '发布记录', badge: '微信首发',
    desc: '已发布内容与平台状态',
    emptyTitle: '暂无发布记录', emptyDesc: '微信资产连接（Sprint-MEDIA-01）后，真实发布记录将回流至此。',
    source: 'SocialPost · Sprint-MEDIA-01', count: 0,
  },
  {
    key: 'feedback', icon: '📈', name: '效果反馈', badge: 'datacube',
    desc: '阅读/互动/转化数据回收',
    emptyTitle: '暂无效果数据', emptyDesc: '微信 datacube 回流后，每篇内容的真实效果将在这里展示。',
    source: 'SocialMetricsSnapshot · Sprint-MEDIA-01', count: 0,
  },
])
</script>

<style scoped>
.cf-pipeline {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
  margin-bottom: 22px;
}
.cf-stage {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 12px;
  padding: 14px 10px;
  text-align: center;
  position: relative;
}
.cf-stage.is-current {
  border-color: var(--color-intelligence);
  background: linear-gradient(180deg, var(--color-intelligence-glow), var(--color-bg-elevated));
}
.cf-stage-node {
  position: relative;
  display: inline-flex;
  margin-bottom: 8px;
}
.cf-stage-ico {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--color-bg-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}
.cf-stage.is-current .cf-stage-ico {
  background: linear-gradient(135deg, var(--color-intelligence), var(--color-decision));
  box-shadow: 0 4px 14px var(--color-intelligence-glow);
}
.cf-stage-num {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-text-disabled);
  color: var(--color-bg-primary);
  font-size: 9px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cf-stage.is-current .cf-stage-num {
  background: var(--color-execution);
}
.cf-stage-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.cf-stage-count {
  font-size: 10px;
  color: var(--color-text-muted);
  margin-top: 3px;
}

.cf-layers {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.cf-layer {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 14px;
  overflow: hidden;
}
.cf-layer.is-core {
  border-left: 3px solid var(--color-decision);
}
.cf-layer-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid var(--color-border-primary);
  background: linear-gradient(180deg, rgba(59, 130, 246, 0.04), transparent);
}
.cf-layer-title {
  display: flex;
  align-items: center;
  gap: 12px;
}
.cf-layer-ico {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: var(--color-bg-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
}
.cf-layer-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.cf-layer-desc {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 1px;
}
.cf-layer-badge {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-decision);
  background: var(--color-decision-glow);
  border-radius: 10px;
  padding: 3px 10px;
}
.cf-layer-body {
  padding: 8px 16px;
}
@media (max-width: 900px) {
  .cf-pipeline { grid-template-columns: repeat(3, 1fr); }
}
</style>
