"use strict";
/**
 * Dataset Capability Validator
 *
 * 检查每个 Dataset 的 capability 引用是否合法：
 *   ① primaryCapability 必须存在
 *   ② primaryCapability 必须属于 capabilities 列表
 *   ③ capability 必须存在于 Registry
 *   ④ capability 不允许重复
 *   ⑤ Dataset 至少拥有一个 capability
 *   ⑥ Stage Consistency：Dataset 的 stage 标签 vs Capability Registry 的 stage
 *   ⑦ Difficulty Consistency：Dataset 的 level vs Capability Registry 的 difficulty
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DATASETS_DIR = void 0;
exports.loadAllDatasets = loadAllDatasets;
exports.validateDatasetCapabilities = validateDatasetCapabilities;
exports.validateAllDatasets = validateAllDatasets;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const registry_js_1 = require("../capabilities/registry.js");
exports.DATASETS_DIR = path.resolve(process.cwd(), 'benchmarks', 'datasets');
/**
 * 加载所有 Dataset（metadata.yaml 扫描）
 */
function loadAllDatasets() {
    const datasets = [];
    if (!fs.existsSync(exports.DATASETS_DIR))
        return datasets;
    const entries = fs.readdirSync(exports.DATASETS_DIR, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        const metaPath = path.join(exports.DATASETS_DIR, entry.name, 'metadata.yaml');
        if (!fs.existsSync(metaPath))
            continue;
        try {
            const raw = js_yaml_1.default.load(fs.readFileSync(metaPath, 'utf-8'));
            datasets.push({
                id: entry.name,
                level: raw?.level ?? 'L0',
                metadata: {
                    primaryCapability: raw?.primaryCapability,
                    capabilities: raw?.capabilities ?? [],
                    stage: raw?.stage,
                    ...raw,
                },
            });
        }
        catch {
            // skip malformed
        }
    }
    return datasets;
}
/**
 * 验证单个 Dataset 的 Capability 引用。
 */
function validateDatasetCapabilities(ds) {
    const items = [];
    const caps = ds.metadata.capabilities ?? [];
    const primary = ds.metadata.primaryCapability;
    // ① primaryCapability 必须存在
    if (!primary) {
        items.push({
            type: 'MissingPrimaryCapability',
            severity: 'error',
            dataset: ds.id,
            message: `Dataset "${ds.id}": metadata.primaryCapability is missing`,
        });
    }
    // ⑤ Dataset 至少拥有一个 capability
    if (!caps || caps.length === 0) {
        items.push({
            type: 'EmptyCapabilitySet',
            severity: 'error',
            dataset: ds.id,
            message: `Dataset "${ds.id}": capabilities list is empty`,
        });
    }
    // 检查每个 capability
    const seen = new Set();
    for (const cap of caps) {
        // ④ capability 不允许重复
        if (seen.has(cap)) {
            items.push({
                type: 'DuplicateCapability',
                severity: 'error',
                dataset: ds.id,
                capability: cap,
                message: `Dataset "${ds.id}": duplicate capability "${cap}"`,
            });
            continue;
        }
        seen.add(cap);
        // ③ capability 必须存在于 Registry
        if (!registry_js_1.CapabilityRegistry.exists(cap)) {
            items.push({
                type: 'UnknownCapability',
                severity: 'error',
                dataset: ds.id,
                capability: cap,
                message: `Dataset "${ds.id}": unknown capability "${cap}" (not in Registry)`,
            });
        }
        else {
            // ⑥ Stage Consistency
            const def = registry_js_1.CapabilityRegistry.byId(cap);
            if (ds.metadata.stage && def.stage !== ds.metadata.stage) {
                items.push({
                    type: 'StageMismatch',
                    severity: 'warning',
                    dataset: ds.id,
                    capability: cap,
                    message: `Dataset "${ds.id}": stage "${ds.metadata.stage}" but capability "${cap}" requires stage "${def.stage}"`,
                });
            }
            // ⑦ Difficulty Consistency
            if (ds.level && def.difficulty !== ds.level) {
                items.push({
                    type: 'DifficultyMismatch',
                    severity: 'warning',
                    dataset: ds.id,
                    capability: cap,
                    message: `Dataset "${ds.id}": level "${ds.level}" but capability "${cap}" is difficulty "${def.difficulty}"`,
                });
            }
        }
    }
    // ② primaryCapability 必须属于 capabilities 列表
    if (primary && caps.length > 0 && !caps.includes(primary)) {
        items.push({
            type: 'PrimaryCapabilityNotIncluded',
            severity: 'error',
            dataset: ds.id,
            capability: primary,
            message: `Dataset "${ds.id}": primaryCapability "${primary}" is not in capabilities list`,
        });
    }
    return items;
}
/**
 * 验证所有 Dataset
 */
function validateAllDatasets() {
    const items = [];
    const datasets = loadAllDatasets();
    for (const ds of datasets) {
        items.push(...validateDatasetCapabilities(ds));
    }
    return items;
}
