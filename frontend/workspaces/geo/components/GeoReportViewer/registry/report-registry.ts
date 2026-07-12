/**
 * ReportRegistry — 按需注册的 Report 类型配置
 *
 * 新增 reportType → 只需在此加一条配置，零改动 GeoReportViewer 主体。
 */
import type { ReportTypeConfig, Report } from '../types'

/** 默认指标构建器：从 executiveSummary 提取通用指标 */
function defaultMetrics(report: Report) {
  return [
    { label: '当前 ADI', value: report.executiveSummary.currentAdi, color: report.executiveSummary.currentAdi >= 70 ? 'green' as const : 'yellow' as const },
    { label: '完成率', value: `${report.executiveSummary.completionRate}%`, unit: '%' },
    { label: '信心指数', value: report.executiveSummary.confidence, color: report.executiveSummary.confidence >= 0.7 ? 'green' as const : 'yellow' as const },
  ]
}

const ReportRegistry: Record<string, ReportTypeConfig> = {
  'brand-health': {
    defaultSections: ['findings', 'opportunities', 'actions', 'verification', 'recommendations'],
    metricsBuilder: (r) => [
      ...defaultMetrics(r),
      { label: '剩余机会', value: r.executiveSummary.topOpportunities, color: r.executiveSummary.topOpportunities > 0 ? 'yellow' as const : 'green' as const },
    ],
  },
  'discovery': {
    defaultSections: ['findings', 'opportunities', 'recommendations'],
    metricsBuilder: defaultMetrics,
  },
  'verification': {
    defaultSections: ['verification', 'actions'],
    metricsBuilder: () => [
      { label: '验证状态', value: '已完成', color: 'green' as const },
    ],
  },
  'publishing': {
    defaultSections: ['publishing-status', 'verification'],
    metricsBuilder: () => [
      { label: '发布状态', value: '待确认', color: 'neutral' as const },
    ],
  },
  'executive': {
    defaultSections: ['findings', 'opportunities'],
    metricsBuilder: defaultMetrics,
  },
}

/** Register a new report type at runtime */
export function registerReportType(type: string, config: ReportTypeConfig): void {
  ReportRegistry[type] = config
}

/** Get config for a report type */
export function getReportConfig(type: string): ReportTypeConfig | undefined {
  return ReportRegistry[type]
}

/** Get default sections for a report type */
export function getDefaultSections(type: string): string[] {
  return ReportRegistry[type]?.defaultSections ?? []
}

/** Build metrics for a report type */
export function buildMetrics(report: Report) {
  const config = ReportRegistry[report.meta.reportType]
  if (config?.metricsBuilder) {
    return config.metricsBuilder(report)
  }
  return defaultMetrics(report)
}

export default ReportRegistry
