/**
 * CoverageExporter — 导出 coverage.json / coverage.md / coverage.csv
 */
import type { CoverageReportData } from './CoverageReport.js';
export type ExportFormat = 'json' | 'md' | 'csv';
/**
 * 导出全部格式
 */
export declare function exportAll(report: CoverageReportData): string[];
/**
 * 导出指定格式
 */
export declare function exportFormat(report: CoverageReportData, format: ExportFormat): string;
