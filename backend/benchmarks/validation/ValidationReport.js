"use strict";
// ─── Severity ────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.createValidationReport = createValidationReport;
// ─── 工厂函数 ───────────────────────────────────────
function createValidationReport(validator, items, strict, datasetCount, registryCount) {
    const start = Date.now();
    const errorCount = items.filter(i => i.severity === 'error').length;
    const warningCount = items.filter(i => i.severity === 'warning').length;
    const infoCount = items.filter(i => i.severity === 'info').length;
    return {
        errorCount,
        warningCount,
        infoCount,
        datasetCount,
        registryCount,
        items,
        validator,
        durationMs: Date.now() - start,
        strict,
        timestamp: new Date().toISOString(),
        passed: strict ? errorCount === 0 : true,
    };
}
