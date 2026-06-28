"use strict";
/**
 * Registry Completeness Validator
 *
 * 检查 Registry 中每个能力的 Dataset 覆盖情况：
 *   - primaryCapability 出现次数 = Primary Count
 *   - capabilities 中出现次数 = Secondary Count
 *   - 两者都为 0 → Warning（未来补充）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRegistryCoverage = validateRegistryCoverage;
const registry_js_1 = require("../capabilities/registry.js");
const DatasetValidator_js_1 = require("./DatasetValidator.js");
function validateRegistryCoverage() {
    const items = [];
    const allCapIds = new Set(registry_js_1.CapabilityRegistry.listIds());
    // 扫描所有 Dataset
    const datasets = (0, DatasetValidator_js_1.loadAllDatasets)();
    const primaryCount = {};
    const secondaryCount = {};
    for (const id of allCapIds) {
        primaryCount[id] = 0;
        secondaryCount[id] = 0;
    }
    for (const ds of datasets) {
        const meta = ds.metadata ?? {};
        const primary = meta.primaryCapability;
        const caps = meta.capabilities ?? [];
        // 统计 primary
        if (primary && primaryCount[primary] !== undefined) {
            primaryCount[primary]++;
        }
        // 统计 secondary
        for (const cap of caps) {
            if (secondaryCount[cap] !== undefined) {
                secondaryCount[cap]++;
            }
        }
    }
    // 输出覆盖报告
    for (const id of allCapIds) {
        const pri = primaryCount[id];
        const sec = secondaryCount[id];
        if (pri === 0 && sec === 0) {
            const cap = registry_js_1.CapabilityRegistry.byId(id);
            items.push({
                type: 'UncoveredCapability',
                severity: 'warning',
                capability: id,
                message: `Capability "${id}" (${cap?.name ?? ''}) has zero Dataset coverage: primary=0, secondary=0`,
            });
        }
    }
    return items;
}
