/**
 * Production Validation Report Writer
 *
 * Generates a structured JSON report from a validation run.
 * Designed to be read by humans and parsed by machines.
 */

import type { ValidationReportData } from './run.js'

export function generateReport(report: ValidationReportData): string {
  const doc = buildReportDocument(report)
  return JSON.stringify(doc, null, 2)
}

export function generateMarkdownReport(report: ValidationReportData): string {
  const lines: string[] = []

  lines.push('# Production Validation Report', '')
  lines.push(`**Session:** \`${report.sessionId}\``)
  lines.push(`**Project:** \`${report.projectId || '(simulated)'}\``)
  lines.push(`**Duration:** ${(report.totalDuration / 1000).toFixed(1)}s`)
  lines.push(`**Status:** ${report.finalStatus}`, '')

  // Summary table
  lines.push('## Summary', '')
  lines.push('| Phase | Status | Duration |')
  lines.push('|-------|--------|----------|')
  for (const p of report.phases) {
    lines.push(`| ${p.phase} | ${p.status} | ${p.duration}ms |`)
  }
  lines.push('', '---', '')

  // Schema
  lines.push('## Schema Validation', '')
  lines.push(`- **Passed:** ${report.schema.passed}`)
  lines.push(`- **Errors:** ${report.schema.errors.length}`)
  lines.push(`- **Warnings:** ${report.schema.warnings.length}`)
  if (report.schema.errors.length > 0) {
    lines.push('', '### Errors')
    for (const e of report.schema.errors) {
      lines.push(`- \`${e.path}\`: ${e.message}`)
    }
  }
  lines.push('', '---', '')

  // Quarantine
  lines.push('## Quarantine', '')
  lines.push(`- **Records:** ${report.quarantine.length}`)
  if (report.quarantine.length > 0) {
    lines.push('', '### Quarantine Records')
    for (const q of report.quarantine) {
      lines.push(`- \`${q.id}\`: ${q.errorCount} errors (${q.source})`)
    }
  }
  lines.push('', '---', '')

  // Tasks
  lines.push('## Tasks', '')
  lines.push(`- **Total:** ${report.tasks.total}`)
  lines.push(`- **Success:** ${report.tasks.success}`)
  lines.push(`- **Failed:** ${report.tasks.failed}`)
  if (Object.keys(report.tasks.providerDistribution).length > 0) {
    lines.push('', '### Provider Distribution')
    for (const [p, c] of Object.entries(report.tasks.providerDistribution)) {
      lines.push(`- ${p}: ${c}`)
    }
  }
  lines.push('', '---', '')

  // Runtime KPI
  lines.push('## Runtime KPI', '')
  lines.push('| Metric | Value |')
  lines.push('|--------|-------|')
  lines.push(`| Agent Success Rate | ${report.runtimeKPI.agentSuccessRate}% |`)
  lines.push(`| Schema Pass Rate | ${report.runtimeKPI.schemaPassRate}% |`)
  lines.push(`| Quarantine Rate | ${report.runtimeKPI.quarantineRate}% |`)
  lines.push(`| Task Success Rate | ${report.runtimeKPI.taskSuccessRate}% |`)
  lines.push(`| Average Provider Latency | ${report.runtimeKPI.averageProviderLatency}ms |`)
  lines.push(`| P95 Latency | ${report.runtimeKPI.p95Latency}ms |`)
  lines.push(`| Average Queue Time | ${Math.round(report.runtimeKPI.averageQueueTime)}ms |`)
  lines.push(`| Average Execution Time | ${Math.round(report.runtimeKPI.averageExecutionTime)}ms |`)
  lines.push('')

  // Final
  lines.push('---', '')
  lines.push(`## Final Verdict: **${report.finalStatus}**`)
  lines.push('')
  if (report.lastErrorMessage) {
    lines.push(`**Last Error:** ${report.lastErrorMessage}`)
  }

  return lines.join('\n')
}

function buildReportDocument(report: ValidationReportData): any {
  return {
    report: {
      metadata: {
        sessionId: report.sessionId,
        projectId: report.projectId,
        generatedAt: new Date().toISOString(),
        method: 'Production Validation Run (PVR)',
      },
      verdict: report.finalStatus,
      summary: {
        totalDurationMs: report.totalDuration,
        totalDurationSeconds: (report.totalDuration / 1000).toFixed(1),
        phasesCompleted: report.phases.length,
        phasesPassed: report.phases.filter(p => p.status === 'PASS').length,
        phasesFailed: report.phases.filter(p => p.status === 'FAIL').length,
        phasesWarned: report.phases.filter(p => p.status === 'WARN').length,
      },
      schema: report.schema,
      quarantine: report.quarantine.map(q => ({
        id: q.id,
        timestamp: q.timestamp,
        source: q.source,
        errorCount: q.errorCount,
      })),
      tasks: report.tasks,
      runtimeKPI: report.runtimeKPI,
      assets: report.generatedAssets,
      phases: report.phases.map(p => ({
        name: p.phase,
        status: p.status,
        durationMs: p.duration,
        errors: p.errors || [],
      })),
      diagnostics: {
        lastErrorMessage: report.lastErrorMessage || null,
        hasErrors: report.phases.some(p => p.status === 'FAIL'),
        hasWarnings: report.phases.some(p => p.status === 'WARN'),
      },
    },
  }
}

// ─── File Output ─────────────────────────────────────

import fs from 'fs'
import path from 'path'

const REPORT_DIR = path.resolve(__dirname, '../../reports')

export function saveReport(report: ValidationReportData): string {
  const json = generateReport(report)
  const md = generateMarkdownReport(report)

  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const jsonPath = path.join(REPORT_DIR, `pvr_${timestamp}.json`)
  const mdPath = path.join(REPORT_DIR, `pvr_${timestamp}.md`)

  fs.writeFileSync(jsonPath, json, 'utf-8')
  fs.writeFileSync(mdPath, md, 'utf-8')

  console.log(`\n💾 Report saved:`)
  console.log(`   JSON: ${jsonPath}`)
  console.log(`   Markdown: ${mdPath}`)

  return jsonPath
}
