/**
 * ExporterRegistry — 导出格式注册表
 *
 * 新增导出格式 → 在此注册一个 exporter，零改动 Viewer。
 */
import type { ExportFormat, Report } from '../types'

// ── Markdown Exporter ──

export function markdownExporter(report: Report): string {
  const r = report
  const lines: string[] = []

  lines.push(`# 品牌健康报告 — ${r.meta.projectName}`)
  lines.push(`**报告类型：**${r.meta.reportType}`)
  lines.push(`**生成时间：**${r.meta.generatedAt}`)
  lines.push('')

  // Executive Summary
  lines.push('## 执行摘要')
  lines.push(`- 当前 ADI: ${r.executiveSummary.currentAdi}`)
  lines.push(`- ADI 变化: ${r.executiveSummary.adiChange >= 0 ? '+' : ''}${r.executiveSummary.adiChange}`)
  lines.push(`- 完成率: ${r.executiveSummary.completionRate}%`)
  lines.push(`- 机会数: ${r.executiveSummary.topOpportunities}`)
  lines.push(`- 信心指数: ${r.executiveSummary.confidence}`)
  lines.push(`- 总体健康: ${r.executiveSummary.overallHealth}`)
  lines.push('')

  // Sections
  for (const section of r.sections) {
    lines.push(`## ${section.title}`)
    if (section.description) {
      lines.push(`> ${section.description}`)
    }
    lines.push('')
    try {
      const data = typeof section.data === 'object'
        ? JSON.stringify(section.data, null, 2)
        : String(section.data)
      lines.push(`\`\`\`json\n${data}\n\`\`\``)
    } catch {
      lines.push(String(section.data))
    }
    lines.push('')
  }

  lines.push('---')
  lines.push(`*报告 ID: ${r.meta.id} | 版本: ${r.meta.version}*`)
  return lines.join('\n')
}

// ── JSON Exporter ──

export function jsonExporter(report: Report): string {
  return JSON.stringify(report, null, 2)
}

// ── Registry ──

const exporterFormats: ExportFormat[] = [
  {
    label: 'Markdown',
    icon: '📝',
    mime: 'text/markdown;charset=utf-8',
    ext: 'md',
    export: markdownExporter,
  },
  {
    label: 'JSON',
    icon: '📋',
    mime: 'application/json;charset=utf-8',
    ext: 'json',
    export: jsonExporter,
  },
]

export function getExportFormats(): ExportFormat[] {
  return exporterFormats
}

/** Register an additional export format at runtime */
export function registerExportFormat(format: ExportFormat): void {
  exporterFormats.push(format)
}

export async function exportReport(report: Report, format: ExportFormat): Promise<void> {
  const content = await format.export(report)
  const blob = new Blob([content], { type: format.mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `report-${report.meta.projectId}-${report.meta.id}.${format.ext}`
  a.click()
  URL.revokeObjectURL(url)
}
