/**
 * CoverageReport — 生成 Coverage Index 的 JSON / Markdown
 */
import type { CoverageEntry, CoverageSummary } from './CoverageIndex.js';
import type { GapReport } from './GapAnalyzer.js';
export interface CoverageReportData {
    generated: string;
    summary: CoverageSummary;
    registryId: string;
    registryVersion: string;
    entries: CoverageEntry[];
    gapReport: GapReport;
    byStage: Record<string, CoverageEntry[]>;
    byDifficulty: Record<string, CoverageEntry[]>;
    byGroup: Record<string, {
        total: number;
        covered: number;
        coverage: number;
    }>;
}
/**
 * 构建完整 Report 数据结构
 */
export declare function buildCoverageReport(entries: CoverageEntry[]): CoverageReportData;
/**
 * 导出 JSON
 */
export declare function exportJSON(report: CoverageReportData): string;
/**
 * 导出 Markdown
 */
export declare function exportMarkdown(report: CoverageReportData): string;
