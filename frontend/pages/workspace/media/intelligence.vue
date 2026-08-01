<!--
  Sprint-MEDIA-UX-03 — Industry Intelligence 行业智能中心（新增）
  四象限: 行业热点 / 竞品动态 / 平台规则 / 内容机会
  纪律: 数据源未接入 → 诚实待激活（禁 mock）；Sprint-MEDIA-03 接入后点亮
-->
<template>
  <MediaWorkspaceShell>
    <MediaPageHeader
      kicker="Industry Intelligence"
      title="行业智能中心"
      desc="AI 员工持续扫描行业热点、竞品动态与平台规则，转化为内容机会。"
    >
      <template #actions>
        <span class="ii-status">
          <span class="ii-status-dot" :class="radar.supported ? 'on' : 'off'"></span>
          {{ radar.supported ? '雷达在线' : '数据源待接入' }}
        </span>
      </template>
    </MediaPageHeader>

    <!-- 数据源状态条 -->
    <div class="ii-sourcebar">
      <div class="ii-sourcebar-ico">📡</div>
      <div>
        <div class="ii-sourcebar-title">{{ radar.supported ? '行业雷达运行中' : '行业雷达待激活' }}</div>
        <div class="ii-sourcebar-desc">{{ radar.reason || '真实热点/竞品/规则数据源接入后启用，不做模拟。' }}</div>
      </div>
      <span class="ii-sourcebar-tag">Sprint-MEDIA-03</span>
    </div>

    <!-- 四象限 -->
    <div class="ii-quads">
      <div v-for="q in quads" :key="q.key" class="ii-quad">
        <div class="ii-quad-head">
          <span class="ii-quad-ico">{{ q.icon }}</span>
          <span class="ii-quad-title">{{ q.title }}</span>
          <span class="ii-quad-count">{{ q.count }}</span>
        </div>
        <div class="ii-quad-body">
          <template v-if="radar.supported && q.items.length">
            <div v-for="(it, i) in q.items" :key="i" class="ii-quad-item">
              <span class="ii-quad-item-dot"></span>
              <span>{{ it }}</span>
            </div>
          </template>
          <MediaEmptyState
            v-else :icon="q.icon" :title="q.emptyTitle" :desc="q.emptyDesc"
            :source="q.source"
          />
        </div>
      </div>
    </div>

    <!-- 智能扫描说明 -->
    <div class="ii-flow">
      <div class="ii-flow-title">🔄 智能扫描链路</div>
      <div class="ii-flow-steps">
        <div class="ii-flow-step"><b>1</b> 热点扫描<span>全网热点实时追踪</span></div>
        <div class="ii-flow-step"><b>2</b> 竞品监测<span>对标账号动态分析</span></div>
        <div class="ii-flow-step"><b>3</b> 规则更新<span>平台政策变化感知</span></div>
        <div class="ii-flow-step"><b>4</b> 机会生成<span>转化为内容选题建议</span></div>
      </div>
    </div>
    <!-- 订阅提示条 -->
    <div class="ii-cta">
      <span>订阅 AI 员工后：行业雷达自动扫描热点、竞品与规则，内容机会持续流入选题池。</span>
      <NuxtLink to="/workspace/media" class="ii-cta-btn">解锁 AI 运营团队 →</NuxtLink>
    </div>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">

definePageMeta({ middleware: 'auth' })
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'
import MediaPageHeader from '~/components/media/MediaPageHeader.vue'
import MediaEmptyState from '~/components/media/MediaEmptyState.vue'

const radar = ref({
  supported: false,
  reason: '热点/竞品/规则数据源未接入。真实雷达将于 Sprint-MEDIA-03 数据源就绪后启用。',
  hot: [] as string[],
  competitor: [] as string[],
  rule: [] as string[],
  suggestion: [] as string[],
})

const quads = computed(() => [
  {
    key: 'hot', icon: '🔥', title: '行业热点', count: radar.value.hot.length,
    items: radar.value.hot, emptyTitle: '热点待扫描', emptyDesc: '热点扫描源接入后实时展示。',
    source: '热点数据源 · Sprint-MEDIA-03',
  },
  {
    key: 'competitor', icon: '⚔️', title: '竞品动态', count: radar.value.competitor.length,
    items: radar.value.competitor, emptyTitle: '竞品待监测', emptyDesc: '竞品账号监测接入后展示动态。',
    source: '竞品监测 · Sprint-MEDIA-03',
  },
  {
    key: 'rule', icon: '📜', title: '平台规则', count: radar.value.rule.length,
    items: radar.value.rule, emptyTitle: '规则待同步', emptyDesc: '平台规则库接入后展示更新。',
    source: '平台规则库 · Sprint-MEDIA-03',
  },
  {
    key: 'opportunity', icon: '💡', title: '内容机会', count: radar.value.suggestion.length,
    items: radar.value.suggestion, emptyTitle: '机会待生成', emptyDesc: '热点与规则分析后生成内容机会。',
    source: 'AI 分析 · Sprint-MEDIA-03',
  },
])
</script>

<style scoped>
.ii-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--media-text-body);
  background: var(--media-card-bg-solid);
  border: 1px solid var(--media-card-border);
  border-radius: var(--media-radius-pill);
  padding: 7px 14px;
}
.ii-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.ii-status-dot.on { background: var(--color-execution); box-shadow: 0 0 8px var(--color-execution); }
.ii-status-dot.off { background: var(--color-text-disabled); }
.ii-sourcebar {
  display: flex;
  align-items: center;
  gap: 14px;
  background: linear-gradient(90deg, var(--color-bg-elevated), rgba(245, 158, 11, 0.06));
  border: 1px solid var(--color-border-primary);
  border-radius: 14px;
  padding: 16px 20px;
  margin-bottom: 18px;
}
.ii-sourcebar-ico {
  font-size: 24px;
}
.ii-sourcebar-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.ii-sourcebar-desc {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 2px;
}
.ii-sourcebar-tag {
  margin-left: auto;
  font-size: 10px;
  font-weight: 700;
  color: var(--color-warning);
  background: rgba(245, 158, 11, 0.1);
  border-radius: 10px;
  padding: 4px 12px;
  white-space: nowrap;
}
.ii-quads {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}
.ii-quad {
  background: var(--media-card-bg);
  border: 1px solid var(--media-card-border);
  border-radius: var(--media-radius-card);
  padding: 18px;
  box-shadow: var(--media-card-shadow);
  transition: border-color 0.2s;
}
.ii-quad-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-border-primary);
}
.ii-quad-ico {
  font-size: 16px;
}
.ii-quad-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.ii-quad-count {
  margin-left: auto;
  font-size: 12px;
  font-weight: 800;
  color: var(--color-intelligence);
  background: var(--color-intelligence-glow);
  border-radius: 12px;
  padding: 2px 10px;
}
.ii-quad-body {
  min-height: 140px;
  padding: 8px 16px;
}
.ii-quad-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
  font-size: 12px;
  color: var(--color-text-primary);
  border-bottom: 1px solid var(--color-border-primary);
}
.ii-quad-item:last-child { border-bottom: none; }
.ii-quad-item-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-intelligence);
  flex-shrink: 0;
}
.ii-flow {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 14px;
  padding: 18px 20px;
}
.ii-flow-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 12px;
}
.ii-flow-steps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.ii-flow-step {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 12px;
  color: var(--color-text-primary);
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.ii-flow-step b { color: var(--color-intelligence); font-size: 14px; }
.ii-flow-step span { font-size: 10px; color: var(--color-text-muted); }
.ii-cta {
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
.ii-cta-btn {
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
.ii-cta-btn:hover { filter: brightness(1.1); }

@media (max-width: 900px) {
  .ii-quads { grid-template-columns: 1fr; }
  .ii-flow-steps { grid-template-columns: 1fr 1fr; }
}
</style>
