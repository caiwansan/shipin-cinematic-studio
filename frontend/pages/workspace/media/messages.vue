<!--
  Sprint-MEDIA-PRODUCT-ONBOARDING-01B — AI 客户运营中心（AI 私信空间）
  定位: 客户运营中心，不是普通聊天页面
  流程固定: 客户进入 → AI理解需求 → 客户价值判断 → 自动回复 → 销售机会 → 人工接管
  纪律: 严禁假聊天记录/假客户/假成交/假AI回复 —— 一律 MediaEmptyState + 真实数据源说明
-->
<template>
  <MediaWorkspaceShell>
    <MediaPageHeader
      kicker="AI Inbox · Customer Ops"
      title="AI 私信空间"
      :status="{ text: '等待渠道连接', type: 'warn' }"
      desc="AI 客户运营中心——客户从这里进入你的私信：AI 客服员工理解需求、判断价值、自动回复，关键时刻转人工接管。"
    />

    <!-- 六步客户运营流程 -->
    <div class="mg-flow">
      <div class="mg-flow-title">🔄 客户运营流程</div>
      <div class="mg-flow-steps">
        <div v-for="(s, i) in flow" :key="s.key" class="mg-flow-step">
          <b>{{ i + 1 }}</b>
          <div class="mg-flow-name">{{ s.name }}</div>
          <span class="mg-flow-desc">{{ s.desc }}</span>
        </div>
      </div>
    </div>

    <!-- 免费 vs AI 员工能力 -->
    <div class="mg-cap">
      <MediaCapabilitySplit
        free="查看客户运营流程与能力说明，理解 AI 客服如何接待、分级、转化客户。"
        ai="解锁 AI 客服员工：自动回复 · 意向判断 · 客户分级 · 销售机会提醒，全程 AI 接待、关键时刻转人工。"
      />
    </div>

    <!-- 客户价值分级说明（能力说明） -->
    <MediaPanel icon="💎" title="客户价值分级" sub="AI 客服判断客户价值的核心逻辑（能力说明）">
      <div class="mg-tier-grid">
        <div v-for="t in tiers" :key="t.tier" class="mg-tier" :class="'mg-tier-' + t.tier.toLowerCase()">
          <span class="mg-tier-tag">{{ t.tier }} 级</span>
          <div class="mg-tier-name">{{ t.name }}</div>
          <div class="mg-tier-desc">{{ t.desc }}</div>
        </div>
      </div>
    </MediaPanel>

    <!-- 会话区（真实空态：无假客户 / 无假聊天记录 / 无假 AI 回复） -->
    <MediaPanel icon="💬" title="客户会话" :sub="`${sessions.length} 个会话 · 真实消息接入后点亮`">
      <MediaEmptyState
        icon="💬" title="暂无会话"
        desc="微信消息接入后，AI 客服会话将真实显示在这里——不展示任何模拟对话、模拟客户或模拟成交。"
        source="微信消息接收 · Sprint-MEDIA-04"
      />
    </MediaPanel>

    <!-- 订阅提示条 -->
    <div class="mg-cta">
      <span>订阅 AI 员工后，AI 客服自动接待私信、判断价值、提醒销售机会。</span>
      <NuxtLink to="/workspace/media" class="mg-cta-btn">解锁 AI 运营团队 →</NuxtLink>
    </div>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">

definePageMeta({ middleware: 'auth' })
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'
import MediaPageHeader from '~/components/media/MediaPageHeader.vue'
import MediaPanel from '~/components/media/MediaPanel.vue'
import MediaEmptyState from '~/components/media/MediaEmptyState.vue'
import MediaCapabilitySplit from '~/components/media/MediaCapabilitySplit.vue'

const flow = [
  { key: 'enter', name: '客户进入', desc: '粉丝从已连接渠道发来私信' },
  { key: 'understand', name: 'AI 理解需求', desc: '识别客户意图与问题' },
  { key: 'value', name: '客户价值判断', desc: 'A/B/C 三级自动分级' },
  { key: 'reply', name: '自动回复', desc: 'BYOK 模型真实生成回复' },
  { key: 'opp', name: '销售机会', desc: '高意向客户标记提醒' },
  { key: 'human', name: '人工接管', desc: 'A 级客户转真人跟进' },
]

const tiers = [
  { tier: 'A', name: '高价值客户', desc: '强购买意向 / 高客单咨询，立即转人工跟进，AI 同步会话上下文。' },
  { tier: 'B', name: '潜在客户', desc: '有明确需求，AI 持续接待与培育，记录意向供销售跟进。' },
  { tier: 'C', name: '普通粉丝', desc: '一般咨询，AI 自动回复，沉淀为内容互动数据。' },
]

const sessions = ref<any[]>([])
</script>

<style scoped>
.mg-flow {
  background: var(--media-card-bg);
  border: 1px solid var(--media-card-border);
  border-radius: var(--media-radius-card);
  padding: 20px 22px;
  margin-bottom: var(--media-gap-card);
  box-shadow: var(--media-card-shadow);
}
.mg-flow-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--media-text-title);
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.mg-flow-steps {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
}
.mg-flow-step {
  position: relative;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--media-radius-node);
  padding: 13px 14px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  transition: all 0.18s;
}
.mg-flow-step:hover {
  border-color: var(--media-ai-border);
  transform: translateY(-2px);
}
.mg-flow-step b {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--media-brand-gradient);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
  box-shadow: 0 3px 10px var(--media-brand-glow);
}
.mg-flow-name {
  font-size: 12px;
  font-weight: 800;
  color: var(--media-text-title);
}
.mg-flow-desc {
  font-size: 10px;
  color: var(--media-text-dim);
  line-height: 1.5;
}

.mg-cap {
  margin-bottom: var(--media-gap-card);
}

.mg-tier-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.mg-tier {
  background: var(--media-card-bg);
  border: 1px solid var(--media-card-border);
  border-radius: var(--media-radius-panel);
  padding: 16px 18px;
  box-shadow: var(--media-card-shadow);
}
.mg-tier-a { border-left: 3px solid var(--color-danger); }
.mg-tier-b { border-left: 3px solid var(--color-warning); }
.mg-tier-c { border-left: 3px solid var(--media-text-dim); }
.mg-tier-tag {
  font-size: 10px;
  font-weight: 800;
  border-radius: var(--media-radius-pill);
  padding: 2px 12px;
}
.mg-tier-a .mg-tier-tag { background: rgba(239, 68, 68, 0.15); color: var(--color-danger); }
.mg-tier-b .mg-tier-tag { background: rgba(245, 158, 11, 0.14); color: var(--color-warning); }
.mg-tier-c .mg-tier-tag { background: var(--color-bg-hover); color: var(--media-text-dim); }
.mg-tier-name {
  font-size: 13px;
  font-weight: 800;
  color: var(--media-text-title);
  margin-top: 10px;
}
.mg-tier-desc {
  font-size: 11px;
  color: var(--media-text-dim);
  line-height: 1.7;
  margin-top: 5px;
}

.mg-cta {
  margin-top: var(--media-gap-section);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  background: linear-gradient(90deg, var(--media-card-bg-solid), rgba(37, 99, 235, 0.1));
  border: 1px solid var(--media-ai-border);
  border-radius: var(--media-radius-card);
  padding: 18px 24px;
  font-size: 12px;
  color: var(--media-text-body);
  box-shadow: var(--media-card-shadow);
}
.mg-cta-btn {
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
.mg-cta-btn:hover { filter: brightness(1.1); }

@media (max-width: 1100px) {
  .mg-flow-steps { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 800px) {
  .mg-tier-grid { grid-template-columns: 1fr; }
  .mg-flow-steps { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .mg-cta { flex-direction: column; align-items: stretch; text-align: center; }
}
</style>
