<!--
  Sprint-MEDIA-PRODUCT-ONBOARDING-01B — AI 内容生产车间
  六节点固定: 战略中心 → 选题池 → 内容创作 → 审核中心 → 发布中心 → 效果分析
  产品表达: 每个节点回答「免费用户现在能做什么？订阅 AI 员工后自动增加什么？」
  纪律: 纯产品展示 + 真实空态；SocialPost/AgentTask 接入（Sprint-MEDIA-01/03）后自动点亮
-->
<template>
  <MediaWorkspaceShell>
    <MediaPageHeader
      kicker="Content Factory"
      title="AI 内容生产车间"
      desc="从战略到效果分析的内容生产管线——免费查看完整流程与规则，订阅 AI 员工后自动选题、生产、审核、发布并复盘。"
    />

    <!-- 六节点管线 -->
    <div class="cf-pipeline">
      <div v-for="(s, i) in stages" :key="s.key" class="cf-stage">
        <div class="cf-stage-node">
          <span class="cf-stage-ico">{{ s.icon }}</span>
          <span class="cf-stage-num">{{ i + 1 }}</span>
        </div>
        <div class="cf-stage-name">{{ s.name }}</div>
        <div class="cf-stage-sub">{{ s.freeShort }}</div>
      </div>
    </div>

    <!-- 六节点详情 -->
    <div class="cf-layers">
      <div v-for="s in stages" :key="s.key" class="cf-layer">
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

        <!-- 免费 vs AI 员工能力双栏 -->
        <div class="cf-layer-cap">
          <MediaCapabilitySplit :free="s.free" :ai="s.ai" />
        </div>

        <!-- 真实数据落点（空态 + 数据源说明，禁 mock） -->
        <div class="cf-layer-body">
          <MediaEmptyState
            :icon="s.icon" :title="s.emptyTitle" :desc="s.emptyDesc"
            :source="s.source"
          />
        </div>
      </div>
    </div>

    <!-- 订阅提示条 -->
    <div class="cf-cta">
      <span>订阅 AI 员工后，这六个节点将由 AI 自动执行，成果回流驾驶舱。</span>
      <NuxtLink to="/workspace/media" class="cf-cta-btn">解锁 AI 新媒体团队 →</NuxtLink>
    </div>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'
import MediaPageHeader from '~/components/media/MediaPageHeader.vue'
import MediaEmptyState from '~/components/media/MediaEmptyState.vue'
import MediaCapabilitySplit from '~/components/media/MediaCapabilitySplit.vue'

const stages = ref([
  {
    key: 'strategy', icon: '🎯', name: '战略中心', badge: 'AI 运营总监',
    desc: '内容方向、目标与排期的制定起点',
    freeShort: '查看框架',
    free: '查看运营规划框架（内容方向 / 目标 / 排期模板），理解团队如何制定战略。',
    ai: 'AI 运营总监自动制定内容战略：结合行业热点与企业目标，输出月度内容方向与排期计划。',
    emptyTitle: '战略待制定',
    emptyDesc: 'AI 运营总监部署后，将生成内容方向、目标与排期计划并真实展示在这里。',
    source: 'AgentSchedule · strategy · Sprint-MEDIA-03',
  },
  {
    key: 'ideas', icon: '💡', name: '选题池', badge: '热点驱动',
    desc: '选题候选的汇聚与整理',
    freeShort: '手动管理',
    free: '手动管理选题：添加、整理、排序选题候选，为内容创作做准备。',
    ai: 'AI 内容策划自动发现热点：扫描行业热点与竞品动态，挖掘选题并填充选题池。',
    emptyTitle: '选题池为空',
    emptyDesc: '行业智能数据源接入后，AI 将从热点/竞品中挖掘选题并真实填充这里。',
    source: '行业智能 · Sprint-MEDIA-03',
  },
  {
    key: 'produce', icon: '✍️', name: '内容创作', badge: 'BYOK 生成',
    desc: '从选题到成稿的生产环节',
    freeShort: '查看流程',
    free: '查看生产流程：理解 AI 员工如何按选题撰写文章、脚本与营销素材（BYOK 企业模型）。',
    ai: 'AI 内容生产按选题自动生成：文章 / 短视频脚本 / 营销素材，发布前可人工审核。',
    emptyTitle: '生产队列空闲',
    emptyDesc: '选题确认后进入生产队列，由 AI 员工使用企业 BYOK 模型真实生成稿件。',
    source: 'AgentTask · content · BYOK 模型',
  },
  {
    key: 'review', icon: '🔍', name: '审核中心', badge: '合规检查',
    desc: '平台规则与合规审核',
    freeShort: '查看规则',
    free: '查看审核规则：了解平台规则与合规要求，掌握发布前的把关标准。',
    ai: 'AI 合规检查：稿件发布前自动检查平台规则与合规风险，标记问题项供人工确认。',
    emptyTitle: '审核队列为空',
    emptyDesc: '生产完成的稿件进入合规审核队列，通过后进入发布中心。',
    source: '审核队列 · 平台规则',
  },
  {
    key: 'publish', icon: '🚀', name: '发布中心', badge: '渠道直发',
    desc: '内容推送与渠道状态',
    freeShort: '查看渠道',
    free: '查看渠道状态：了解微信公众号/抖音/小红书/视频号的连接情况。',
    ai: 'AI 自动发布：按排期把审核通过的稿件自动发布到已连接渠道。',
    emptyTitle: '暂无发布记录',
    emptyDesc: '渠道连接（Sprint-MEDIA-01）后，真实发布记录将回流至此。',
    source: 'SocialPost · Sprint-MEDIA-01',
  },
  {
    key: 'feedback', icon: '📈', name: '效果分析', badge: '数据复盘',
    desc: '阅读/互动/转化数据回收',
    freeShort: '查看入口',
    free: '查看数据入口：了解效果数据从哪里来、如何衡量内容表现。',
    ai: 'AI 数据分析自动复盘：回收效果数据，输出优化建议，驱动下一轮内容。',
    emptyTitle: '暂无效果数据',
    emptyDesc: '渠道数据回流后，每篇内容的真实效果将在这里展示。',
    source: 'SocialMetricsSnapshot · Sprint-MEDIA-01',
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
.cf-stage-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.cf-stage-sub {
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
  white-space: nowrap;
}
.cf-layer-cap {
  padding: 6px 16px 0;
}
.cf-layer-body {
  padding: 0 16px 10px;
}

.cf-cta {
  margin-top: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  background: linear-gradient(90deg, var(--color-bg-elevated), var(--color-intelligence-glow));
  border: 1px solid var(--color-border-primary);
  border-radius: 14px;
  padding: 16px 22px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.cf-cta-btn {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--color-intelligence), var(--color-decision));
  border-radius: 10px;
  padding: 9px 18px;
  text-decoration: none;
  white-space: nowrap;
}
.cf-cta-btn:hover { filter: brightness(1.1); }

@media (max-width: 900px) {
  .cf-pipeline { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 640px) {
  .cf-pipeline { grid-template-columns: repeat(2, 1fr); }
  .cf-cta { flex-direction: column; align-items: stretch; text-align: center; }
}
</style>
