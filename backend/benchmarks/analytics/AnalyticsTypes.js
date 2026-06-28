"use strict";
/**
 * Capability Analytics 类型定义
 *
 * 汇聚 Coverage（静态）+ Benchmark（动态）的统一事实来源。
 * P1.3.4 只取 Coverage 走通，execution/negotiator/planner/runner 字段预留。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeHealth = computeHealth;
exports.computeCoverageStatus = computeCoverageStatus;
/**
 * 根据条件自动判断健康状态
 */
function computeHealth(coverageScore, resolutionRate) {
    if (coverageScore === 0)
        return 'critical';
    if (resolutionRate !== null && resolutionRate < 80)
        return 'weak';
    if (resolutionRate !== null && resolutionRate >= 80)
        return 'healthy';
    // No resolution data yet — coverage > 0 is enough to not be critical
    return 'healthy';
}
function computeCoverageStatus(primary, secondary) {
    if (primary > 0)
        return 'covered';
    if (secondary > 0)
        return 'partial';
    return 'uncovered';
}
