/**
 * CoverageScanner — 扫描所有 Dataset，建立原始覆盖关系
 *
 * 直接扫描文件系统，不依赖 DatasetValidator。
 * 一次性扫描，输出 CoverageEntry[]，供 CoverageIndex 构建。
 */
import type { CoverageEntry } from './CoverageIndex.js';
export declare function scanAllDatasets(): CoverageEntry[];
export declare function computeSummary(entries: CoverageEntry[]): import('./CoverageIndex.js').CoverageSummary;
