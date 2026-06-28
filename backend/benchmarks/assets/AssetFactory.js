"use strict";
/**
 * Capability Asset 工厂 — 标准化 Dataset 生成器
 *
 * P1.4.2: 每个 Dataset 按固定模板生成，包含 failureModes + evaluationCriteria + Gold Reference。
 * 不允许直接手写 YAML 绕过模板。
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
exports.createAsset = createAsset;
exports.writeAsset = writeAsset;
exports.readAsset = readAsset;
exports.validateAsset = validateAsset;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// @ts-ignore
const yaml = require('js-yaml');
const registry_js_1 = require("../capabilities/registry.js");
const ASSETS_DIR = path.resolve(process.cwd(), 'benchmarks', 'assets', 'datasets');
/**
 * 生成一个完整的 CapabilityAsset
 *
 * 所有字段都必须明确提供。
 * failureModes 和 evaluationCriteria 是必选项（不能为空数组——至少有一个）。
 */
function createAsset(metadata, failureModes, evaluationCriteria, goldReference) {
    // 校验 primaryCapability 必须在 Registry 中
    if (!registry_js_1.CapabilityRegistry.exists(metadata.primaryCapability)) {
        throw new Error(`Unknown primaryCapability: ${metadata.primaryCapability}`);
    }
    // 校验 secondaryCapabilities 都在 Registry 中
    for (const cap of metadata.secondaryCapabilities) {
        if (!registry_js_1.CapabilityRegistry.exists(cap)) {
            throw new Error(`Unknown secondaryCapability: ${cap}`);
        }
    }
    // failureModes 不能为空
    if (failureModes.length === 0) {
        throw new Error('failureModes must not be empty');
    }
    // evaluationCriteria 不能为空
    if (evaluationCriteria.length === 0) {
        throw new Error('evaluationCriteria must not be empty');
    }
    return {
        metadata,
        failureModes,
        evaluationCriteria,
        goldReference,
    };
}
/**
 * 写出 Asset 到文件系统
 */
function writeAsset(asset) {
    const dir = path.join(ASSETS_DIR, asset.metadata.id);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const metaPath = path.join(dir, 'metadata.yaml');
    fs.writeFileSync(metaPath, yaml.dump(asset.metadata, { indent: 2, lineWidth: 120 }), 'utf-8');
    const failurePath = path.join(dir, 'failure-modes.yaml');
    fs.writeFileSync(failurePath, yaml.dump(asset.failureModes, { indent: 2 }), 'utf-8');
    const criteriaPath = path.join(dir, 'evaluation-criteria.yaml');
    fs.writeFileSync(criteriaPath, yaml.dump(asset.evaluationCriteria, { indent: 2 }), 'utf-8');
    if (asset.goldReference) {
        const goldPath = path.join(dir, 'gold-reference.json');
        fs.writeFileSync(goldPath, JSON.stringify(asset.goldReference, null, 2), 'utf-8');
    }
    const inputPath = path.join(dir, 'input');
    if (!fs.existsSync(inputPath)) {
        fs.mkdirSync(inputPath);
    }
    return dir;
}
/**
 * 读取 Asset
 */
function readAsset(id) {
    const dir = path.join(ASSETS_DIR, id);
    if (!fs.existsSync(dir))
        return null;
    const metaPath = path.join(dir, 'metadata.yaml');
    const failurePath = path.join(dir, 'failure-modes.yaml');
    const criteriaPath = path.join(dir, 'evaluation-criteria.yaml');
    const goldPath = path.join(dir, 'gold-reference.json');
    if (!fs.existsSync(metaPath))
        return null;
    try {
        const metadata = yaml.load(fs.readFileSync(metaPath, 'utf-8'));
        const failureModes = fs.existsSync(failurePath)
            ? yaml.load(fs.readFileSync(failurePath, 'utf-8'))
            : [];
        const evaluationCriteria = fs.existsSync(criteriaPath)
            ? yaml.load(fs.readFileSync(criteriaPath, 'utf-8'))
            : [];
        const goldReference = fs.existsSync(goldPath)
            ? JSON.parse(fs.readFileSync(goldPath, 'utf-8'))
            : undefined;
        return { metadata, failureModes, evaluationCriteria, goldReference };
    }
    catch {
        return null;
    }
}
/**
 * 资产验证（Dataset Quality Gate）
 */
function validateAsset(asset) {
    const errors = [];
    // 必须有唯一 primaryCapability
    if (!asset.metadata.primaryCapability) {
        errors.push('Missing primaryCapability');
    }
    // primaryCapability 必须在 Registry
    if (asset.metadata.primaryCapability && !registry_js_1.CapabilityRegistry.exists(asset.metadata.primaryCapability)) {
        errors.push(`Unknown primaryCapability: ${asset.metadata.primaryCapability}`);
    }
    // failureModes 不能为空
    if (asset.failureModes.length === 0) {
        errors.push('failureModes is empty');
    }
    // 每个 failureMode 必须有 description
    for (const fm of asset.failureModes) {
        if (!fm.description) {
            errors.push(`failureMode ${fm.id} missing description`);
        }
        if (!fm.expectedBehavior) {
            errors.push(`failureMode ${fm.id} missing expectedBehavior`);
        }
    }
    // evaluationCriteria 不能为空
    if (asset.evaluationCriteria.length === 0) {
        errors.push('evaluationCriteria is empty');
    }
    // weight 之和应接近 1
    const weightSum = asset.evaluationCriteria.reduce((s, c) => s + (c.weight ?? 0), 0);
    if (Math.abs(weightSum - 1) > 0.01 && asset.evaluationCriteria.length > 0) {
        errors.push(`evaluationCriteria weights sum to ${weightSum}, expected 1`);
    }
    return errors;
}
