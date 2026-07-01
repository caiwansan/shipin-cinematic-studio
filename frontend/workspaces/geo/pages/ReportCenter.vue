<template>
  <div class="report-center">
    <!-- ===== Header ===== -->
    <header class="report-center__header">
      <div>
        <NuxtLink to="/workspace/geo/dashboard" class="report-center__back-btn">← 返回工作台</NuxtLink>
        <h1 class="report-center__title">交付中心</h1>
        <p class="report-center__subtitle">全面的品牌健康报告 — 所有章节汇总一处</p>
      </div>
      <div class="report-center__header-actions">
        <ExportMenu
          :report="report"
          @export="handleExport"
          @copy="handleCopyToClipboard"
        />
        <button
          class="report-center__btn report-center__btn--refresh"
          @click="loadReport"
          :disabled="loading"
        >
          🔄 {{ loading ? '加载中...' : '刷新' }}
        </button>
      </div>
    </header>

    <!-- ===== Error State ===== -->
    <div v-if="error" class="report-center__error">
      <p>{{ error }}</p>
      <button class="report-center__btn report-center__btn--primary" @click="loadReport">重试</button>
      <NuxtLink :to="`/workspace/geo/dashboard`" class="report-center__link">
        ← 返回工作台
      </NuxtLink>
    </div>

    <!-- ===== Loading State ===== -->
    <div v-if="loading && !report" class="report-center__loading">
      <div class="report-center__spinner" />
      <span>正在生成报告...</span>
    </div>

    <!-- ===== Report Content ===== -->
    <div v-if="report" class="report-center__body">
      <!-- Section 1: Executive Summary -->
      <ExecutiveSummaryCard
        :report="report"
        :project-name="projectName"
      />

      <!-- Section Divider -->
      <div class="report-center__divider" />

      <!-- Section 2: Findings -->
      <div class="report-center__section">
        <FindingsSection :report="report" />
      </div>

      <!-- Section 3: Opportunities -->
      <div class="report-center__section">
        <OpportunitiesSection :report="report" />
      </div>

      <!-- Section 4: Actions -->
      <div class="report-center__section">
        <ActionsSection :report="report" />
      </div>

      <!-- Section 5: Verification -->
      <div class="report-center__section">
        <VerificationSection :report="report" />
      </div>

      <!-- Section 6: Next Recommendations -->
      <div class="report-center__section">
        <NextRecommendations :report="report" />
      </div>

      <!-- Footer -->
      <div class="report-center__footer">
        <p class="report-center__footer-text">
          报告 ID：{{ report.id }} · 生成时间：{{ formattedDate }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGeoProjectStore } from '../stores/useGeoProjectStore'
import { geoApi } from '../services/api'
import type { DeliverableReport } from '../types/report'
import ExportMenu from '../../../components/kmki-ui/ExportMenu/index.vue'
import ExecutiveSummaryCard from '../../../components/kmki-ui/ExecutiveSummaryCard/index.vue'
import FindingsSection from '../../../components/kmki-ui/FindingsSection/index.vue'
import OpportunitiesSection from '../../../components/kmki-ui/OpportunitiesSection/index.vue'
import ActionsSection from '../../../components/kmki-ui/ActionsSection/index.vue'
import VerificationSection from '../../../components/kmki-ui/VerificationSection/index.vue'
import NextRecommendations from '../../../components/kmki-ui/NextRecommendations/index.vue'

definePageMeta({
  title: 'Report Center — GEO Workspace',
})

const route = useRoute()
const router = useRouter()
const projectStore = useGeoProjectStore()

const projectId = computed(() => route.params.projectId as string)
const projectName = ref('Project')

const report = ref<DeliverableReport | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const formattedDate = computed(() => {
  if (!report.value) return ''
  const d = new Date(report.value.generatedAt)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
})

onMounted(async () => {
  // Load project info
  if (projectId.value) {
    try {
      await projectStore.loadProject(projectId.value)
      if (projectStore.currentProject) {
        projectName.value = projectStore.currentProject.name || 'Project'
      }
    } catch {
      // Continue anyway
    }
  }

  await loadReport()
})

async function loadReport() {
  if (!projectId.value) {
    error.value = 'No project ID provided.'
    return
  }

  loading.value = true
  error.value = null

  try {
    const raw = await geoApi<{ success: boolean; data: DeliverableReport }>(
      `report/${projectId.value}`,
      { method: 'GET' }
    )
    report.value = raw.data
  } catch (err: any) {
    if (err.response?.status === 404) {
      error.value = 'No report available. Complete at least the Discovery step first.'
    } else {
      error.value = err?.message || 'Failed to load report'
    }
  } finally {
    loading.value = false
  }
}

function generateMarkdown(): string {
  if (!report.value) return ''

  const r = report.value
  const lines: string[] = []

  lines.push(`# Brand Health Report — ${r.projectName}`)
  lines.push(`**生成时间：**${formattedDate.value}`)
  lines.push('')

  // 1. Executive Summary
  lines.push('## 1. Executive Summary')
  lines.push(`- **Current ADI:** ${r.executiveSummary.currentAdi}`)
  lines.push(`- **ADI Change:** ${r.executiveSummary.adiChange >= 0 ? '+' : ''}${r.executiveSummary.adiChange}`)
  lines.push(`- **Completion Rate:** ${r.executiveSummary.completionRate}%`)
  lines.push(`- **Top Opportunities:** ${r.executiveSummary.topOpportunities}`)
  lines.push(`- **Confidence:** ${r.executiveSummary.confidence}`)
  lines.push(`- **Overall Health:** ${r.executiveSummary.overallHealth}`)
  lines.push('')

  // 2. Findings
  lines.push('## 2. Findings')
  lines.push(`- **Industry:** ${r.findings.industry || 'N/A'}`)
  lines.push(`- **Entity:** ${r.findings.entityName}`)
  lines.push(`- **Coverage Count:** ${r.findings.coverageCount}`)
  lines.push(`- **Total Scenarios:** ${r.findings.totalScenarios}`)
  lines.push('')
  if (r.findings.topScenarios.length > 0) {
    lines.push('### Top Scenarios')
    lines.push('| Scenario | Score | Trend |')
    lines.push('|----------|-------|-------|')
    for (const s of r.findings.topScenarios) {
      lines.push(`| ${s.name} | ${s.score} | ${s.trend === 'up' ? '↑' : s.trend === 'down' ? '↓' : '→'} |`)
    }
    lines.push('')
  }
  if (r.findings.bottomScenarios.length > 0) {
    lines.push('### Bottom Scenarios')
    lines.push('| Scenario | Score | Trend |')
    lines.push('|----------|-------|-------|')
    for (const s of r.findings.bottomScenarios) {
      lines.push(`| ${s.name} | ${s.score} | ${s.trend === 'up' ? '↑' : s.trend === 'down' ? '↓' : '→'} |`)
    }
    lines.push('')
  }

  // 3. Opportunities
  lines.push('## 3. Opportunities')
  lines.push(`- **High Priority:** ${r.opportunities.high}`)
  lines.push(`- **Medium Priority:** ${r.opportunities.medium}`)
  lines.push(`- **Low Priority:** ${r.opportunities.low}`)
  lines.push(`- **Total Expected Gain (ADI):** ${r.opportunities.totalExpectedGain.toFixed(1)}`)
  lines.push('')
  if (r.opportunities.items.length > 0) {
    lines.push('| Scenario | Gap | Priority | Expected Gain | Suggestion |')
    lines.push('|----------|-----|----------|---------------|------------|')
    for (const o of r.opportunities.items) {
      lines.push(`| ${o.scenarioName} | ${o.gap} | ${o.priority} | ${o.expectedAdiGain} | ${o.suggestion || '—'} |`)
    }
    lines.push('')
  }

  // 4. Actions
  lines.push('## 4. Actions')
  lines.push(`- **Total:** ${r.actions.total}`)
  lines.push(`- **Completed:** ${r.actions.completed}`)
  lines.push(`- **In Progress:** ${r.actions.inProgress}`)
  lines.push(`- **Skipped:** ${r.actions.skipped}`)
  lines.push(`- **Pending:** ${r.actions.pending}`)
  lines.push(`- **Estimated Gain:** ${r.actions.estimatedGain.toFixed(1)}`)
  lines.push(`- **Actual Gain:** ${r.actions.actualGain.toFixed(1)}`)
  lines.push('')
  if (r.actions.items.length > 0) {
    lines.push('| Action | Status | Expected Impact | Actual Impact |')
    lines.push('|--------|--------|-----------------|---------------|')
    for (const a of r.actions.items) {
      const actual = a.actualImpact !== null ? String(a.actualImpact) : '—'
      lines.push(`| ${a.title} | ${a.status} | ${a.expectedImpact} | ${actual} |`)
    }
    lines.push('')
  }

  // 5. Verification
  if (r.verification) {
    lines.push('## 5. Verification')
    lines.push(`- **Before ADI:** ${r.verification.beforeAdi}`)
    lines.push(`- **After ADI:** ${r.verification.afterAdi}`)
    lines.push(`- **Delta ADI:** ${r.verification.deltaAdi >= 0 ? '+' : ''}${r.verification.deltaAdi}`)
    lines.push(`- **Improvement Rate:** ${r.verification.improvementRate}%`)
    lines.push('')
    if (r.verification.breakdown.length > 0) {
      lines.push('### Improvement Breakdown')
      lines.push('| Factor | Contribution |')
      lines.push('|--------|--------------|')
      for (const b of r.verification.breakdown) {
        lines.push(`| ${b.label} | ${b.contribution >= 0 ? '+' : ''}${b.contribution} |`)
      }
      lines.push('')
    }
    if (r.verification.remainingIssues.length > 0) {
      lines.push('### Remaining Issues')
      lines.push('| Scenario | Gap | Priority |')
      lines.push('|----------|-----|----------|')
      for (const issue of r.verification.remainingIssues) {
        lines.push(`| ${issue.scenario} | ${issue.gap} | ${issue.priority} |`)
      }
      lines.push('')
    }
  }

  // 6. Next Recommendations
  if (r.nextRecommendations.length > 0) {
    lines.push('## 6. Next Recommendations')
    lines.push('| Scenario | Gap | Priority | Expected ADI Gain |')
    lines.push('|----------|-----|----------|-------------------|')
    for (const rec of r.nextRecommendations) {
      lines.push(`| ${rec.scenarioName} | ${rec.gap} | ${rec.priority} | ${rec.expectedAdiGain} |`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push(`*报告 ID：${r.id}*`)

  return lines.join('\n')
}

async function handleExport(format: 'markdown' | 'json') {
  if (!report.value) return

  if (format === 'markdown') {
    const md = generateMarkdown()
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${projectId.value}.md`
    a.click()
    URL.revokeObjectURL(url)
  } else {
    const json = JSON.stringify(report.value, null, 2)
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${projectId.value}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
}

async function handleCopyToClipboard() {
  if (!report.value) return
  const md = generateMarkdown()
  try {
    await navigator.clipboard.writeText(md)
    // Show brief success feedback
    const btn = document.querySelector('.export-menu button')
    if (btn) {
      const original = btn.innerHTML
      btn.innerHTML = '✅ Copied!'
      setTimeout(() => { btn.innerHTML = original }, 2000)
    }
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = md
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
}
</script>

<style scoped>
.report-center {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 0 48px;
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
}

/* ===== Header ===== */
.report-center__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.report-center__back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #6b7280;
  text-decoration: none;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.15s;
  margin-bottom: 12px;
}

.report-center__back-btn:hover {
  color: #374151;
  background: #f3f4f6;
}

.report-center__title {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 4px;
}

.report-center__subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.report-center__header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.report-center__btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
}

.report-center__btn--primary {
  background: #3b82f6;
  color: #fff;
}

.report-center__btn--primary:hover {
  background: #2563eb;
}

.report-center__btn--refresh {
  background: #fff;
  color: #374151;
  border: 1px solid #d1d5db;
}

.report-center__btn--refresh:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

.report-center__link {
  display: inline-block;
  margin-top: 12px;
  color: #3b82f6;
  font-size: 14px;
  text-decoration: none;
}

.report-center__link:hover {
  text-decoration: underline;
}

/* ===== Loading / Error ===== */
.report-center__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px;
  color: #6b7280;
}

.report-center__spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.report-center__error {
  text-align: center;
  padding: 32px;
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  margin-bottom: 24px;
}

/* ===== Body ===== */
.report-center__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.report-center__divider {
  height: 1px;
  background: linear-gradient(to right, transparent, #e5e7eb, transparent);
  margin: 8px 0;
}

.report-center__section {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px 24px;
}

.report-center__footer {
  text-align: center;
  padding: 16px;
}

.report-center__footer-text {
  font-size: 11px;
  color: #9ca3af;
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .report-center__header {
    flex-direction: column;
    gap: 12px;
  }

  .report-center__header-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
