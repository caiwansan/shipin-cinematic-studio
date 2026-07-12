/** Report types shared across GeoReportViewer */

/** Dynamic section — array-based, not fixed fields */
export interface ReportSection<T = unknown> {
  type: string
  title: string
  description?: string
  data: T
  /** Sort weight (low → high). Default 100 */
  order?: number
}

export interface ExecutiveSummary {
  currentAdi: number
  adiChange: number
  completionRate: number
  topOpportunities: number
  overallHealth: 'good' | 'fair' | 'poor'
  confidence: number
}

export interface ReportMeta {
  id: string
  projectId: string
  projectName: string
  /** string — not a fixed enum. Viewer resolves via ReportRegistry */
  reportType: string
  generatedAt: string
  version: string
}

export interface Report {
  meta: ReportMeta
  executiveSummary: ExecutiveSummary
  /** Dynamic sections instead of fixed fields */
  sections: ReportSection[]
  /** Caller-defined extensions */
  extra?: Record<string, unknown>
}

/** Metric card displayed in the metrics row */
export interface MetricItem {
  label: string
  value: number | string
  unit?: string
  color?: 'green' | 'yellow' | 'red' | 'neutral'
}

// ── Registry types ──

export interface ReportTypeConfig {
  /** Default section type list (in order) for this report type */
  defaultSections: string[]
  /** Optional metrics builder */
  metricsBuilder?: (report: Report) => MetricItem[]
}

export interface SectionRendererConfig {
  /** Dynamic import returning a Vue component */
  component: () => Promise<{ default: any }>
  /** Whether this section is always visible (default: false) */
  alwaysShow?: boolean
}

export interface ExportFormat {
  label: string
  icon: string
  mime: string
  ext: string
  export: (report: Report) => string | Promise<string>
}
