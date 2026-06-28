/**
 * Capability Analytics 类型定义
 *
 * 汇聚 Coverage（静态）+ Benchmark（动态）的统一事实来源。
 * P1.3.4 只取 Coverage 走通，execution/negotiator/planner/runner 字段预留。
 */
export type Health = 'healthy' | 'weak' | 'critical';
export interface CapabilityAnalytics {
    capability: string;
    name: string;
    group: string;
    stage: string;
    difficulty: string;
    primaryCoverage: number;
    secondaryCoverage: number;
    coverageScore: number;
    coverageStatus: 'covered' | 'partial' | 'uncovered';
    executions: number | null;
    successRate: number | null;
    averageScore: number | null;
    resolutionRate: number | null;
    confidence: number | null;
    confidenceVariance: number | null;
    plannerHitRate: number | null;
    averageLatency: number | null;
    averageTokens: number | null;
    health: Health;
}
export interface AnalyticsSummary {
    total: number;
    healthy: number;
    weak: number;
    critical: number;
    healthScore: number;
    averageCoverage: number;
}
export interface AnalyticsSnapshot {
    generated: string;
    registryId: string;
    registryVersion: string;
    analytics: CapabilityAnalytics[];
    summary: AnalyticsSummary;
    trends: Record<string, any>[];
}
/**
 * 根据条件自动判断健康状态
 */
export declare function computeHealth(coverageScore: number, resolutionRate: number | null): Health;
export declare function computeCoverageStatus(primary: number, secondary: number): 'covered' | 'partial' | 'uncovered';
