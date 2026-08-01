<!--
  Sprint-MEDIA-DESIGN-SYSTEM-01 — AI Content Factory 内容生产车间（世界级 UI 重构）
  视觉: 生产工位（编号 + 图标 + AI Worker + 免费能力 / AI 能力 + 状态灯），不是流程图
  纪律: 纯产品展示 + 真实空态；SocialPost/AgentTask 接入后自动点亮
  六节点: 战略中心 → 选题池 → 内容创作 → 审核中心 → 发布中心 → 效果分析
-->
<template>
  <MediaWorkspaceShell>
    <MediaPageHeader
      kicker="AI Content Factory"
      title="AI 内容生产车间"
      :status="{ text: '生产线待启动', type: 'off' }"
      desc="从战略到效果分析的自动化内容生产线——免费查看完整流程，订阅 AI 员工后自动选题、生产、审核、发布并复盘。"
    />

    <!-- ═══ 生产线横幅 ═══ -->
    <div class="cf-line">
      <div class="cf-line-track">
        <div v-for="(s, i) in stages" :key="s.key" class="cf-line-node">
          <div class="cf-line-ico">
            {{ s.icon }}
            <span class="cf-line-num">{{ i + 1 }}</span>
          </div>
          <div class="cf-line-name">{{ s.name }}</div>
        </div>
      </div>
      <div class="cf-line-arrows">
        <span v-for="i in 5" :key="i" class="cf-line-arrow">→</span>
      </div>
      <div class="cf-line-foot">
        <span class="cf-line-dot"></span>
        AI Content Factory · 六道工序 · 订阅后全自动
      </div>
    </div>

    <!-- ═══ 生产工位 ═══ -->
    <div class="cf-stations">
      <div v-for="(s, i) in stages" :key="s.key" class="cf-station">
        <!-- 工位侧栏（编号 + 图标 + 负责人） -->
        <div class="cf-station-side">
          <span class="cf-station-num">{{ String(i + 1).padStart(2, '0') }}</span>
          <div class="cf-station-ico">{{ s.icon }}</div>
          <div class="cf-station-name">{{ s.name }}</div>
          <div class="cf-station-desc">{{ s.desc }}</div>
          <div class="cf-station-worker">
            <span class="cf-worker-dot"></span>
            {{ s.badge }}
          </div>
          <span class="cf-station-state">待启动</span>
        </div>

        <!-- 工位能力区（免费能力 / AI 能力） -->
        <div class="cf-station-body">
          <div class="cf-station-cap">
            <div class="cf-cap-label free">
              <span class="cf-cap-ico">🆓</span>
              免费能力
            </div>
            <div class="cf-cap-text">{{ s.free }}</div>
          </div>
          <div class="cf-station-cap ai">
            <div class="cf-cap-label ai">
              <span class="cf-cap-ico">🤖</span>
              AI 能力 · 订阅解锁
            </div>
            <div class="cf-cap-text">{{ s.ai }}</div>
          </div>
          <!-- 真实数据落点（空态 + 数据源说明，禁 mock） -->
          <div class="cf-station-source">
            <MediaEmptyState
              :icon="s.icon" :title="s.emptyTitle" :desc="s.emptyDesc"
              :source="s.source"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ 订阅提示条 ═══ -->
    <div class="cf-cta">
      <div class="cf-cta-text">
        <span class="cf-cta-ico">⚙️</span>
        <div>
          <div class="cf-cta-title">订阅 AI 员工后，这六道工序将由 AI 自动执行</div>
          <div class="cf-cta-sub">选题自动填充 → 内容自动生产 → 合规自动审核 → 排期自动发布 → 数据自动复盘</div>
        </div>
      </div>
      <NuxtLink to="/workspace/media" class="cf-cta-btn">解锁 AI 运营团队 →</NuxtLink>
    </div>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">

definePageMeta({ middleware: 'auth' })
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'
import MediaPageHeader from '~/components/media/MediaPageHeader.vue'
import MediaEmptyState from '~/components/media/MediaEmptyState.vue'

const stages = ref([
  {
    key: 'strategy', icon: '🎯', name: '战略中心', badge: 'Alice · AI 运营总监',
    desc: '内容方向、目标与排期的制定起点',
    free: '查看运营规划框架（内容方向 / 目标 / 排期模板），理解团队如何制定战略。',
    ai: 'AI 运营总监自动制定内容战略：结合行业热点与企业目标，输出月度内容方向与排期计划。',
    emptyTitle: '战略待制定',
    emptyDesc: 'AI 运营总监部署后，将生成内容方向、目标与排期计划并真实展示在这里。',
    source: 'AgentSchedule · strategy',
  },
  {
    key: 'ideas', icon: '💡', name: '选题池', badge: 'Bob · AI 内容策划',
    desc: '选题候选的汇聚与整理',
    free: '手动管理选题：添加、整理、排序选题候选，为内容创作做准备。',
    ai: 'AI 内容策划自动发现热点：扫描行业热点与竞品动态，挖掘选题并填充选题池。',
    emptyTitle: '选题池为空',
    emptyDesc: '行业智能数据源接入后，AI 将从热点/竞品中挖掘选题并真实填充这里。',
    source: '行业智能',
  },
  {
    key: 'produce', icon: '✍️', name: '内容创作', badge: 'Carol · AI 内容生产',
    desc: '从选题到成稿的生产环节',
    free: '查看生产流程：理解 AI 员工如何按选题撰写文章、脚本与营销素材（BYOK 模型）。',
    ai: 'AI 内容生产按选题自动生成：文章 / 短视频脚本 / 营销素材，发布前可人工审核。',
    emptyTitle: '生产队列空闲',
    emptyDesc: '选题确认后进入生产队列，由 AI 员工使用 BYOK 模型真实生成稿件。',
    source: 'AgentTask · content · BYOK',
  },
  {
    key: 'review', icon: '🔍', name: '审核中心', badge: '合规检查 · AI 审核',
    desc: '平台规则与合规审核',
    free: '查看审核规则：了解平台规则与合规要求，掌握发布前的把关标准。',
    ai: 'AI 合规检查：稿件发布前自动检查平台规则与合规风险，标记问题项供人工确认。',
    emptyTitle: '审核队列为空',
    emptyDesc: '生产完成的稿件进入合规审核队列，通过后进入发布中心。',
    source: '审核队列 · 平台规则',
  },
  {
    key: 'publish', icon: '🚀', name: '发布中心', badge: '渠道直发 · AI 发布',
    desc: '内容推送与渠道状态',
    free: '查看渠道状态：了解公众号/抖音/小红书/视频号的连接情况。',
    ai: 'AI 自动发布：按排期把审核通过的稿件自动发布到已连接渠道。',
    emptyTitle: '暂无发布记录',
    emptyDesc: '渠道连接后，真实发布记录将回流至此。',
    source: 'SocialPost',
  },
  {
    key: 'feedback', icon: '📈', name: '效果分析', badge: 'Eve · AI 数据分析',
    desc: '阅读/互动/转化数据回收',
    free: '查看数据入口：了解效果数据从哪里来、如何衡量内容表现。',
    ai: 'AI 数据分析自动复盘：回收效果数据，输出优化建议，驱动下一轮内容。',
    emptyTitle: '暂无效果数据',
    emptyDesc: '渠道数据回流后，每篇内容的真实效果将在这里展示。',
    source: 'SocialMetricsSnapshot',
  },
])
</script>

<style scoped>
/* ── 生产线横幅 ── */
.cf-line {
  position: relative;
  background: var(--media-card-bg);
  border: 1px solid var(--media-card-border);
  border-radius: var(--media-radius-card);
  padding: 26px 24px 18px;
  margin-bottom: var(--media-gap-section);
  box-shadow: var(--media-card-shadow);
  overflow: hidden;
}
.cf-line::before {
  content: '';
  position: absolute;
  top: -60px;
  left: 30%;
  width: 300px;
  height: 140px;
  background: radial-gradient(ellipse, var(--media-hero-glow-1), transparent 70%);
  pointer-events: none;
}
.cf-line-track {
  position: relative;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
  z-index: 1;
}
.cf-line-node {
  text-align: center;
}
.cf-line-ico {
  position: relative;
  width: 52px;
  height: 52px;
  margin: 0 auto 8px;
  border-radius: 15px;
  background: var(--media-brand-soft);
  border: 1px solid var(--media-ai-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  transition: all 0.2s;
}
.cf-line-node:hover .cf-line-ico {
  transform: translateY(-3px);
  box-shadow: 0 10px 24px var(--media-brand-glow);
}
.cf-line-num {
  position: absolute;
  top: -7px;
  right: -7px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--media-brand-gradient);
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px var(--media-brand-glow);
}
.cf-line-name {
  font-size: 12.5px;
  font-weight: 800;
  color: var(--media-text-title);
}
.cf-line-arrows {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  transform: translateY(-30px);
  display: flex;
  justify-content: space-around;
  z-index: 2;
  pointer-events: none;
}
.cf-line-arrow {
  font-size: 13px;
  color: var(--media-text-dim);
  text-shadow: 0 0 10px rgba(37, 99, 235, 0.5);
}
.cf-line-foot {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px dashed var(--color-border-primary);
  font-size: 11px;
  color: var(--media-text-dim);
  letter-spacing: 0.06em;
}
.cf-line-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-execution);
  box-shadow: 0 0 8px var(--color-execution);
  animation: cf-breathe 2s infinite;
}
@keyframes cf-breathe {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ── 生产工位 ── */
.cf-stations {
  display: flex;
  flex-direction: column;
  gap: var(--media-gap-card);
}
.cf-station {
  display: grid;
  grid-template-columns: 190px 1fr;
  background: var(--media-card-bg);
  border: 1px solid var(--media-card-border);
  border-radius: var(--media-radius-card);
  overflow: hidden;
  box-shadow: var(--media-card-shadow);
  transition: all 0.2s;
}
.cf-station:hover {
  border-color: var(--media-card-border-hover);
  box-shadow: var(--media-shadow-hover);
}
/* 工位侧栏 */
.cf-station-side {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
  background: linear-gradient(180deg, rgba(37, 99, 235, 0.08), rgba(244, 246, 250, 0.4));
  border-right: 1px solid var(--media-card-border);
}
.cf-station-num {
  position: absolute;
  top: 10px;
  left: 14px;
  font-size: 11px;
  font-weight: 800;
  color: var(--media-text-dim);
  font-family: var(--font-mono);
  letter-spacing: 0.1em;
}
.cf-station-ico {
  width: 54px;
  height: 54px;
  border-radius: 16px;
  background: var(--media-brand-soft);
  border: 1px solid var(--media-ai-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 23px;
  margin-bottom: 10px;
  box-shadow: 0 6px 18px rgba(16, 24, 40, 0.08);
}
.cf-station-name {
  font-size: 14px;
  font-weight: 800;
  color: var(--media-text-title);
}
.cf-station-desc {
  font-size: 10.5px;
  color: var(--media-text-dim);
  text-align: center;
  margin-top: 5px;
  line-height: 1.5;
}
.cf-station-worker {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  font-size: 10px;
  font-weight: 700;
  color: var(--media-brand-text);
  background: var(--media-ai-glow);
  border: 1px solid var(--media-ai-border);
  border-radius: var(--media-radius-pill);
  padding: 4px 11px;
  white-space: nowrap;
}
.cf-worker-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--media-ai);
  box-shadow: 0 0 6px var(--media-ai);
}
.cf-station-state {
  position: absolute;
  bottom: 10px;
  font-size: 9.5px;
  font-weight: 700;
  color: var(--color-warning);
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: var(--media-radius-pill);
  padding: 2px 10px;
}
/* 工位能力区 */
.cf-station-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 18px 20px;
}
.cf-station-cap {
  border-radius: var(--media-radius-node);
  padding: 14px;
}
.cf-station-cap.free {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
}
.cf-station-cap.ai {
  background: linear-gradient(160deg, var(--media-ai-glow), rgba(244, 246, 250, 0.4));
  border: 1px solid var(--media-ai-border);
}
.cf-cap-label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 800;
  margin-bottom: 8px;
}
.cf-cap-label.free { color: var(--media-text-body); }
.cf-cap-label.ai { color: var(--media-ai); }
.cf-cap-ico { font-size: 13px; }
.cf-cap-text {
  font-size: 11.5px;
  color: var(--media-text-body);
  line-height: 1.7;
}
.cf-station-source {
  grid-column: 1 / -1;
  border-top: 1px dashed var(--color-border-primary);
  padding-top: 6px;
}

/* ── 订阅提示条 ── */
.cf-cta {
  margin-top: var(--media-gap-section);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: linear-gradient(90deg, var(--media-card-bg-solid), rgba(37, 99, 235, 0.1));
  border: 1px solid var(--media-ai-border);
  border-radius: var(--media-radius-card);
  padding: 18px 24px;
  box-shadow: var(--media-card-shadow);
}
.cf-cta-text {
  display: flex;
  align-items: center;
  gap: 14px;
}
.cf-cta-ico {
  font-size: 24px;
  width: 46px;
  height: 46px;
  border-radius: 13px;
  background: var(--media-brand-soft);
  border: 1px solid var(--media-ai-border);
  display: flex;
  align-items: center;
  justify-content: center;
}
.cf-cta-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--media-text-title);
}
.cf-cta-sub {
  font-size: 11px;
  color: var(--media-text-dim);
  margin-top: 3px;
}
.cf-cta-btn {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: var(--media-brand-gradient);
  border-radius: var(--media-radius-node);
  padding: 11px 22px;
  text-decoration: none;
  white-space: nowrap;
  box-shadow: 0 6px 18px var(--media-brand-glow);
}
.cf-cta-btn:hover { filter: brightness(1.1); }

@media (max-width: 980px) {
  .cf-station { grid-template-columns: 1fr; }
  .cf-station-side { border-right: none; border-bottom: 1px solid var(--media-card-border); }
  .cf-station-body { grid-template-columns: 1fr; }
  .cf-line-track { grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .cf-line-arrows { display: none; }
}
@media (max-width: 640px) {
  .cf-cta { flex-direction: column; align-items: stretch; text-align: center; }
  .cf-line-track { grid-template-columns: repeat(2, 1fr); }
}
</style>
