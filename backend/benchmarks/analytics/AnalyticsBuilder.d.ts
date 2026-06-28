/**
 * Capability Analytics Builder
 *
 * 将 Coverage Index（静态）产出 + 后续动态指标汇聚为 CapabilityAnalytics。
 *
 * 当前版本只使用 Coverage Index 走通全部流程；
 * execution/negotiator/planner/runner 字段预留为 null。
 * 后续 Pipeline Metrics 挂入后自动填充。
 */
import type { CapabilityAnalytics, AnalyticsSummary, AnalyticsSnapshot } from './AnalyticsTypes.js';
export declare function buildAnalytics(): CapabilityAnalytics[];
export declare function computeSummary(analytics: CapabilityAnalytics[]): AnalyticsSummary;
export declare function buildSnapshot(): AnalyticsSnapshot;
