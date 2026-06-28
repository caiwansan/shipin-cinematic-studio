/**
 * GapAnalyzer — 三级缺口分析 + 建议 Dataset
 *
 * P0（Critical）: primary=0, secondary=0 → 必须补
 * P1（Weak）:    primary=0, secondary>0 → 需要专门测试
 * P2（Sparse）:  primary<=1, secondary<=1 → 以后补
 */
import type { CoverageEntry, GapLevel } from './CoverageIndex.js';
export interface GapSuggestion {
    capability: string;
    level: GapLevel;
    suggestedId: string;
    primaryCapability: string;
    secondaryCapabilities: string[];
    reason: string;
    priority: number;
}
export interface GapReport {
    critical: GapSuggestion[];
    weak: GapSuggestion[];
    sparse: GapSuggestion[];
    totalGaps: number;
    suggestions: GapSuggestion[];
}
/**
 * 分析缺口并生成建议 Dataset ID
 */
export declare function analyzeGaps(entries: CoverageEntry[]): GapReport;
/**
 * 生成人类可读的 Gap 摘要
 */
export declare function printGapReport(report: GapReport): string;
