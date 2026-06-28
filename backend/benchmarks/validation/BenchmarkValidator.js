"use strict";
/**
 * BenchmarkValidator — 统一验证入口
 *
 * 调用所有 Validator，合并输出 ValidationReport。
 * CLI / CI / Pipeline Report 都通过此入口验证。
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAll = validateAll;
exports.validateDatasets = validateDatasets;
exports.validateRegistry = validateRegistry;
exports.printValidationReport = printValidationReport;
const ValidationReport_js_1 = require("./ValidationReport.js");
const DatasetValidator_js_1 = require("./DatasetValidator.js");
const RegistryValidator_js_1 = require("./RegistryValidator.js");
const RegistryIntegrityValidator_js_1 = require("./RegistryIntegrityValidator.js");
const registry_js_1 = require("../capabilities/registry.js");
/**
 * 执行全部验证
 */
function validateAll(strict = false) {
    const items = [];
    // 1. Registry Integrity
    items.push(...(0, RegistryIntegrityValidator_js_1.validateRegistryIntegrity)());
    // 2. Dataset Capability Validation
    items.push(...(0, DatasetValidator_js_1.validateAllDatasets)());
    // 3. Registry Coverage
    items.push(...(0, RegistryValidator_js_1.validateRegistryCoverage)());
    const datasetCount = countDatasets();
    const registryCount = registry_js_1.CapabilityRegistry.all.length;
    return (0, ValidationReport_js_1.createValidationReport)('BenchmarkValidator', items, strict, datasetCount, registryCount);
}
/**
 * 仅验证 Dataset（供 CLI 单独使用）
 */
function validateDatasets(strict = false) {
    const items = (0, DatasetValidator_js_1.validateAllDatasets)();
    return (0, ValidationReport_js_1.createValidationReport)('DatasetValidator', items, strict, countDatasets(), registry_js_1.CapabilityRegistry.all.length);
}
/**
 * 仅验证 Registry（供 CLI 单独使用）
 */
function validateRegistry(strict = false) {
    const items = [...(0, RegistryIntegrityValidator_js_1.validateRegistryIntegrity)(), ...(0, RegistryValidator_js_1.validateRegistryCoverage)()];
    return (0, ValidationReport_js_1.createValidationReport)('RegistryValidator', items, strict, countDatasets(), registry_js_1.CapabilityRegistry.all.length);
}
// ─── Helper ──────────────────────────────────────────
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function countDatasets() {
    const dir = path.resolve(process.cwd(), 'benchmarks', 'datasets');
    if (!fs.existsSync(dir))
        return 0;
    return fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).length;
}
/**
 * 打印人类可读的验证摘要
 */
function printValidationReport(report) {
    const lines = [];
    if (report.errorCount > 0) {
        for (const item of report.items.filter(i => i.severity === 'error')) {
            lines.push(`❌ ${item.type}: ${item.message}`);
        }
    }
    if (report.warningCount > 0) {
        for (const item of report.items.filter(i => i.severity === 'warning')) {
            lines.push(`⚠️  ${item.type}: ${item.message}`);
        }
    }
    lines.push('');
    lines.push(`✔ Registry: ${report.registryCount} capabilities`);
    lines.push(`✔ Datasets: ${report.datasetCount} datasets`);
    lines.push(`${report.errorCount > 0 ? '❌' : '✔'} Errors: ${report.errorCount}`);
    lines.push(`${report.warningCount > 0 ? '⚠️' : '✔'} Warnings: ${report.warningCount}`);
    if (report.passed) {
        lines.push('');
        lines.push('✅ PASS');
    }
    else {
        lines.push('');
        lines.push('❌ FAIL (strict mode: errors > 0)');
    }
    return lines.join('\n');
}
