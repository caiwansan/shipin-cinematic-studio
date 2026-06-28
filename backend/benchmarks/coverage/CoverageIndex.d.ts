/**
 * Coverage Index — 能力覆盖的唯一真相源
 *
 * 所有模块（Gap Report、Pipeline Report、Dashboard、P1.3.4 Analytics）
 * 都通过此索引消费，不重复扫描 Dataset。
 */
export type GapLevel = 'P0' | 'P1' | 'P2';
export interface CoverageEntry {
    capability: string;
    primaryDatasets: string[];
    secondaryDatasets: string[];
    totalCoverage: number;
    stage: string;
    difficulty: string;
    gap: boolean;
    gapLevel?: GapLevel;
    evidence: any[];
    metrics: Record<string, any>;
}
export interface CoverageSummary {
    total: number;
    covered: number;
    /** P0: primary=0, secondary=0 */
    missing: number;
    /** P1: primary=0, secondary>0 */
    weak: number;
    /** P2: primary<=1, secondary<=1 total */
    sparse: number;
    coverageScore: number;
}
export interface CoverageIndexSnapshot {
    entries: CoverageEntry[];
    byCapability: Record<string, CoverageEntry>;
    byStage: Record<string, CoverageEntry[]>;
    byDifficulty: Record<string, CoverageEntry[]>;
    summary: CoverageSummary;
}
export declare function calculateGapLevel(entry: CoverageEntry): GapLevel | undefined;
