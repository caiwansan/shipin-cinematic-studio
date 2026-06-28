"use strict";
/**
 * Registry Integrity Validator
 *
 * 验证 Registry 自身的完整性：
 *   ① 所有能力 ID 唯一
 *   ② 依赖链中没有死循环
 *   ③ 所有依赖的 ID 存在
 *   ④ 每个 stage 至少有一个能力
 *   ⑤ 每个 group 至少有一个能力（可选）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRegistryIntegrity = validateRegistryIntegrity;
const registry_js_1 = require("../capabilities/registry.js");
const capability_schema_js_1 = require("../capabilities/capability.schema.js");
function validateRegistryIntegrity() {
    const items = [];
    // 复用 capability.schema.ts 的 validateRegistry
    const result = (0, capability_schema_js_1.validateRegistry)(registry_js_1.CapabilityRegistry);
    for (const err of result.errors) {
        items.push({
            type: 'RegistryError',
            severity: 'error',
            message: err,
        });
    }
    for (const warn of result.warnings) {
        items.push({
            type: 'RegistryWarning',
            severity: 'warning',
            message: warn,
        });
    }
    return items;
}
