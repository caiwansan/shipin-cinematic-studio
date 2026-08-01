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
      <NuxtLink to="/workspace/media" class="mg-cta-btn">解锁 AI 新媒体团队 →</NuxtLink>
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
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 14px;
  padding: 18px 20px;
  margin-bottom: 16px;
}
.mg-flow-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 12px;
}
.mg-flow-steps {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
}
.mg-flow-step {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.mg-flow-step b {
  color: var(--color-decision);
  font-size: 14px;
}
.mg-flow-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.mg-flow-desc {
  font-size: 10px;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.mg-cap {
  margin-bottom: 16px;
}

.mg-tier-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.mg-tier {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: 12px;
  padding: 14px 16px;
}
.mg-tier-a { border-left: 3px solid var(--color-danger); }
.mg-tier-b { border-left: 3px solid var(--color-warning); }
.mg-tier-c { border-left: 3px solid var(--color-text-muted); }
.mg-tier-tag {
  font-size: 10px;
  font-weight: 800;
  border-radius: 8px;
  padding: 2px 10px;
}
.mg-tier-a .mg-tier-tag { background: rgba(239, 68, 68, 0.15); color: var(--color-danger); }
.mg-tier-b .mg-tier-tag { background: rgba(245, 158, 11, 0.14); color: var(--color-warning); }
.mg-tier-c .mg-tier-tag { background: var(--color-bg-hover); color: var(--color-text-muted); }
.mg-tier-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-top: 8px;
}
.mg-tier-desc {
  font-size: 11px;
  color: var(--color-text-muted);
  line-height: 1.6;
  margin-top: 4px;
}

.mg-cta {
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
.mg-cta-btn {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--color-intelligence), var(--color-decision));
  border-radius: 10px;
  padding: 9px 18px;
  text-decoration: none;
  white-space: nowrap;
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
