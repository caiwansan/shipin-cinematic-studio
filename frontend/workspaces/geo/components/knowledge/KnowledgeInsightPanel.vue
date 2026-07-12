<template>
  <div v-if="insight" class="kip-overlay" @click.self="$emit('close')">
    <div class="kip-panel">
      <!-- Priority Badge -->
      <div class="kip__priority" :class="`priority--${priorityClass}`">
        ● {{ insight.recommendation.priority }} 优先级
      </div>

      <!-- Problem — 一句话 -->
      <section class="kip__section">
        <h4 class="kip__section-title">问题</h4>
        <p class="kip__problem-text">{{ problemSentence }}</p>
      </section>

      <!-- Why this happened — 聚合 -->
      <section class="kip__section" v-if="aggregatedRuleTraces.length">
        <h4 class="kip__section-title">原因</h4>
        <div v-for="rule in aggregatedRuleTraces" :key="rule.ruleId" class="kip__rule-trace">
          <code>{{ rule.ruleId }}</code>: {{ rule.summary }}
        </div>
      </section>

      <!-- Evidence — 最多 3 条，其余折叠 -->
      <section class="kip__section">
        <h4 class="kip__section-title">证据 ({{ evidence.length }})</h4>
        <div v-for="ev in visibleEvidence" :key="ev.type" class="kip__evidence-row">
          <span class="kip__evidence-type">{{ ev.type }}</span>
          <span class="kip__evidence-sep">:</span>
          <span class="kip__evidence-value">{{ ev.value }}</span>
          <span class="kip__evidence-confidence">({{ Math.round(ev.confidence * 100) }}%)</span>
          <span class="kip__evidence-source">&middot; {{ ev.source }}</span>
        </div>
        <button v-if="evidence.length > 3" class="kip__show-more" @click="showAllEvidence = !showAllEvidence">
          {{ showAllEvidence ? '收起' : `+${evidence.length - 3} 更多` }}
        </button>
      </section>

      <!-- Fix — 具体建议 -->
      <section class="kip__section">
        <h4 class="kip__section-title">修复建议</h4>
        <p class="kip__fix-text">{{ fixSentence }}</p>
      </section>

      <!-- Expected Benefit — 分开展示 Benefit 和 Impact -->
      <section class="kip__section">
        <h4 class="kip__section-title">预期收益</h4>
        <p class="kip__benefit-text">{{ insight.recommendation.expectedBenefit }}</p>
        <div class="kip__impact-row">
          <span class="kip__impact-label">预估影响</span>
          <span class="kip__impact-value">{{ insight.recommendation.estimatedImpact }}</span>
        </div>
      </section>

      <!-- CTA: Action-first -->
      <div class="kip__action">
        <button class="kip__action-btn" @click="$emit('go-to-object')">
          改进此知识 →
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { KnowledgeObjectInsight } from '../../viewmodels/KnowledgeBrowserVM'

const props = defineProps<{
  insight: KnowledgeObjectInsight
  evidence: Array<{
    type: string
    source: string
    value: number | string
    confidence: number
  }>
}>()

defineEmits<{
  close: []
  'go-to-object': []
}>()

const showAllEvidence = ref(false)

const priorityClass = computed(() => {
  const p = props.insight.recommendation.priority
  return p ? p.toLowerCase() : 'low'
})

/**
 * problemSentence: 从所有 assessment 维度中找出分数最低的那个维度，生成一句话。
 */
const problemSentence = computed(() => {
  const assessment = props.insight.assessment
  const dims = [
    { name: 'coverage' as const, score: assessment.coverage.score, label: assessment.coverage.label },
    { name: 'freshness' as const, score: assessment.freshness.score, label: assessment.freshness.label },
    { name: 'authority' as const, score: assessment.authority.score, label: assessment.authority.label },
    { name: 'consistency' as const, score: assessment.consistency.score, label: assessment.consistency.label },
  ]
  const lowest = dims.reduce((min, d) => (d.score < min.score ? d : min), dims[0])

  switch (lowest.name) {
    case 'coverage':
      // Attempt to extract scenario info from evidence
      const covEvidence = props.evidence.find(e => e.type === 'scenarioCoverage')
      const scenarioCount = typeof covEvidence?.value === 'number' ? covEvidence.value : 0
      const totalScenarios = 8
      return `AI cannot reliably surface this knowledge because only ${scenarioCount} of ${totalScenarios} scenarios are covered.`
    case 'freshness':
      // Attempt to extract last updated info
      const freshEvidence = props.evidence.find(e => e.type === 'lastUpdated')
      const lastUpdated = typeof freshEvidence?.value === 'string' ? freshEvidence.value : 'unknown'
      // Calculate days since last update from freshness score
      const freshnessScore = assessment.freshness.score
      let daysAgo = 0
      if (freshnessScore < 80) daysAgo = 365
      else if (freshnessScore < 90) daysAgo = 150
      else daysAgo = 14
      return `This knowledge may be stale — last updated ${lastUpdated !== 'unknown' ? lastUpdated : daysAgo + ' days'} ago, making it less reliable for AI consumption.`
    case 'authority':
      return 'AI lacks trusted references for this knowledge — no authoritative citations found.'
    case 'consistency':
      return 'This knowledge contains conflicting information that reduces AI comprehension.'
  }
})

/**
 * aggregatedRuleTraces: 从 assessment 的 4 个维度中收集所有 ruleResults，扁平化为一个数组。
 */
const aggregatedRuleTraces = computed(() => {
  const assessment = props.insight.assessment
  const dims = ['coverage', 'freshness', 'authority', 'consistency'] as const
  const traces: Array<{ ruleId: string; summary: string }> = []
  for (const dim of dims) {
    const dimScore = (assessment as any)[dim]
    if (dimScore && dimScore.ruleResults) {
      for (const rr of dimScore.ruleResults) {
        traces.push({
          ruleId: rr.ruleId,
          summary: rr.reason ? rr.reason.substring(0, 60) : '',
        })
      }
    }
  }
  return traces
})

/**
 * fixSentence: 根据 recommendation 生成具体可执行的建议。
 */
const fixSentence = computed(() => {
  const rec = props.insight.recommendation
  return rec.reason
})

/**
 * visibleEvidence: 默认显示前 3 条，展开显示全部。
 */
const visibleEvidence = computed(() => {
  return showAllEvidence.value
    ? props.evidence
    : props.evidence.slice(0, 3)
})
</script>

<style scoped>
.kip-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.kip-panel {
  background: #fff;
  border-radius: 12px;
  max-width: 480px;
  width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
  padding: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

/* ── Priority Badge ── */
.kip__priority {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 14px;
}

.priority--high {
  color: #ef4444;
}

.priority--medium {
  color: #f59e0b;
}

.priority--low {
  color: #64748b;
}

/* ── Sections ── */
.kip__section {
  margin-bottom: 14px;
}

.kip__section-title {
  margin: 0 0 6px 0;
  font-size: 13px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.kip__problem-text {
  margin: 0;
  font-size: 14px;
  color: #1a1a2e;
  line-height: 1.5;
}

/* ── Rule Traces ── */
.kip__rule-trace {
  margin-top: 3px;
  padding-left: 4px;
  border-left: 2px solid #e2e8f0;
}

.kip__rule-trace code {
  font-family: monospace;
  font-size: 12px;
  color: #94a3b8;
}

.kip__rule-trace {
  font-size: 13px;
  color: #475569;
  line-height: 1.4;
}

/* ── Evidence ── */
.kip__evidence-row {
  display: flex;
  gap: 8px;
  font-size: 13px;
  align-items: center;
  color: #475569;
  margin-bottom: 4px;
}

.kip__evidence-type {
  font-weight: 500;
}

.kip__evidence-sep {
  color: #94a3b8;
}

.kip__evidence-value {
  font-weight: 600;
}

.kip__evidence-confidence {
  color: #64748b;
  font-size: 12px;
}

.kip__evidence-source {
  color: #94a3b8;
  font-size: 12px;
}

.kip__show-more {
  font-size: 12px;
  color: #3b82f6;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 0;
}

.kip__show-more:hover {
  color: #2563eb;
}

/* ── Fix ── */
.kip__fix-text {
  margin: 0;
  font-size: 14px;
  color: #1a1a2e;
  line-height: 1.5;
}

/* ── Benefit & Impact ── */
.kip__benefit-text {
  margin: 0 0 6px 0;
  font-size: 14px;
  color: #1a1a2e;
}

.kip__impact-row {
  display: flex;
  justify-content: space-between;
  background: #f8fafc;
  padding: 8px 12px;
  border-radius: 8px;
}

.kip__impact-label {
  font-size: 13px;
  color: #64748b;
}

.kip__impact-value {
  font-size: 16px;
  font-weight: 700;
  color: #16a34a;
}

/* ── CTA ── */
.kip__action {
  margin-top: 8px;
}

.kip__action-btn {
  width: 100%;
  padding: 12px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 4px;
}

.kip__action-btn:hover {
  background: #2563eb;
}
</style>
