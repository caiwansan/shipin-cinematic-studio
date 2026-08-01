<!--
  Sprint-MEDIA-UX-03 — Customer Intelligence 客户智能中心
  管线: 客户池 → AI 价值判断 → 销售机会 → 真人接管
  分级规则（已冻结）: A级购买意向强 / B级持续关注 / C级普通互动
  纪律: 无真实客户 → 空态；Sprint-MEDIA-04 客服识别后点亮
-->
<template>
  <MediaWorkspaceShell>
    <MediaPageHeader
      kicker="Customer Intelligence"
      title="客户资产"
      desc="AI 客服识别客户价值，分级沉淀资产，高价值客户立即转真人接管。"
    />

    <!-- 管线 -->
    <div class="ci-pipeline">
      <div v-for="(s, i) in pipeline" :key="s.key" class="ci-pnode">
        <span class="ci-pnode-ico">{{ s.icon }}</span>
        <span class="ci-pnode-name">{{ s.name }}</span>
        <span v-if="i < pipeline.length - 1" class="ci-pnode-arrow">→</span>
      </div>
    </div>

    <!-- 客户分级池 -->
    <div class="ci-tiers">
      <div v-for="tier in tiers" :key="tier.key" class="ci-tier" :class="'ct-' + tier.key">
        <div class="ci-tier-head">
          <span class="ci-tier-badge">{{ tier.badge }}</span>
          <div class="ci-tier-meta">
            <div class="ci-tier-name">{{ tier.name }}</div>
            <div class="ci-tier-desc">{{ tier.desc }}</div>
          </div>
          <span class="ci-tier-count">{{ tier.customers.length }}</span>
        </div>
        <div class="ci-tier-body">
          <template v-if="tier.customers.length">
            <div v-for="c in tier.customers" :key="c.id" class="ci-cust">
              <span class="ci-cust-avatar">{{ c.avatar }}</span>
              <span class="ci-cust-name">{{ c.name }}</span>
              <span class="ci-cust-note">{{ c.note }}</span>
              <button v-if="tier.key === 'a'" class="ci-takeover">真人接管</button>
            </div>
          </template>
          <MediaEmptyState
            v-else :icon="tier.icon" :title="tier.emptyTitle" :desc="tier.emptyDesc"
            :source="tier.source"
          />
        </div>
      </div>
    </div>

    <!-- 分级规则（冻结） -->
    <div class="ci-rule">
      <div class="ci-rule-title">📐 分级规则（已冻结）</div>
      <div class="ci-rule-grid">
        <div class="ci-rule-item"><b class="r-a">A 级</b><span>咨询购买/合作、明确留资 → 真人第一时间接管</span></div>
        <div class="ci-rule-item"><b class="r-b">B 级</b><span>多次互动、收藏内容 → AI 持续跟进</span></div>
        <div class="ci-rule-item"><b class="r-c">C 级</b><span>一般留言/点赞 → AI 标准回复</span></div>
      </div>
    </div>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">

definePageMeta({ middleware: 'auth' })
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'
import MediaPageHeader from '~/components/media/MediaPageHeader.vue'
import MediaEmptyState from '~/components/media/MediaEmptyState.vue'

const pipeline = [
  { key: 'pool', icon: '🗂️', name: '客户池' },
  { key: 'judge', icon: '🧠', name: 'AI 价值判断' },
  { key: 'opp', icon: '💼', name: '销售机会' },
  { key: 'human', icon: '🤝', name: '真人接管' },
]

const tiers = ref([
  {
    key: 'a', badge: 'A', icon: '🔴', name: '购买意向强', desc: '咨询购买/合作，真人第一时间接管',
    emptyTitle: '暂无 A 级客户', emptyDesc: 'AI 客服识别出高价值客户后，将立即转真人接管。',
    source: 'AI 价值判断 · Sprint-MEDIA-04', customers: [] as any[],
  },
  {
    key: 'b', badge: 'B', icon: '🟠', name: '持续关注', desc: '多次互动/收藏内容，AI 持续跟进',
    emptyTitle: '暂无 B 级客户', emptyDesc: '持续互动客户由 AI 员工跟进维护。',
    source: 'AI 价值判断 · Sprint-MEDIA-04', customers: [] as any[],
  },
  {
    key: 'c', badge: 'C', icon: '⚪', name: '普通互动', desc: '一般留言/点赞，AI 标准回复',
    emptyTitle: '暂无 C 级客户', emptyDesc: '普通互动客户由 AI 标准回复服务。',
    source: 'AI 价值判断 · Sprint-MEDIA-04', customers: [] as any[],
  },
])
</script>

<style scoped>
.ci-pipeline {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 14px;
  padding: 16px 22px;
  margin-bottom: 18px;
  overflow-x: auto;
}
.ci-pnode {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.ci-pnode-ico {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--color-bg-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}
.ci-pnode-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.ci-pnode-arrow {
  color: var(--color-text-disabled);
  font-size: 14px;
  margin: 0 8px;
}

.ci-tiers {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 18px;
}
.ci-tier {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 14px;
  overflow: hidden;
  border-left-width: 4px;
}
.ct-a { border-left-color: var(--color-danger); }
.ct-b { border-left-color: var(--color-warning); }
.ct-c { border-left-color: var(--color-text-muted); }
.ci-tier-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--color-border-primary);
}
.ci-tier-badge {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 14px;
  color: #fff;
  flex-shrink: 0;
}
.ct-a .ci-tier-badge { background: var(--color-danger); }
.ct-b .ci-tier-badge { background: var(--color-warning); }
.ct-c .ci-tier-badge { background: var(--color-text-muted); }
.ci-tier-meta { flex: 1; }
.ci-tier-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.ci-tier-desc {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
}
.ci-tier-count {
  font-size: 13px;
  font-weight: 800;
  color: var(--color-text-primary);
  background: var(--color-bg-hover);
  border-radius: 12px;
  padding: 3px 12px;
  font-variant-numeric: tabular-nums;
}
.ci-tier-body {
  padding: 10px 16px;
}
.ci-cust {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--color-bg-secondary);
  border-radius: 9px;
  padding: 10px 14px;
  margin-bottom: 8px;
  font-size: 13px;
}
.ci-cust:last-child { margin-bottom: 0; }
.ci-cust-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-intelligence-glow);
  color: var(--color-intelligence);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
}
.ci-cust-name { font-weight: 600; color: var(--color-text-primary); }
.ci-cust-note { font-size: 11px; color: var(--color-text-muted); }
.ci-takeover {
  margin-left: auto;
  background: var(--color-danger);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.ci-rule {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 14px;
  padding: 18px 20px;
}
.ci-rule-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 12px;
}
.ci-rule-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.ci-rule-item {
  background: var(--color-bg-secondary);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}
.ci-rule-item b { font-size: 13px; }
.r-a { color: var(--color-danger); }
.r-b { color: var(--color-warning); }
.r-c { color: var(--color-text-muted); }
@media (max-width: 900px) {
  .ci-rule-grid { grid-template-columns: 1fr; }
}
</style>
