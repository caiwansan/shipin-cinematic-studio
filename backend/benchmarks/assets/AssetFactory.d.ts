/**
 * Capability Asset 工厂 — 标准化 Dataset 生成器
 *
 * P1.4.2: 每个 Dataset 按固定模板生成，包含 failureModes + evaluationCriteria + Gold Reference。
 * 不允许直接手写 YAML 绕过模板。
 */
import type { CapabilityAsset, AssetMetadata, FailureMode, EvaluationCriterion, GoldReference } from './AssetTypes.js';
/**
 * 生成一个完整的 CapabilityAsset
 *
 * 所有字段都必须明确提供。
 * failureModes 和 evaluationCriteria 是必选项（不能为空数组——至少有一个）。
 */
export declare function createAsset(metadata: AssetMetadata, failureModes: FailureMode[], evaluationCriteria: EvaluationCriterion[], goldReference?: GoldReference): CapabilityAsset;
/**
 * 写出 Asset 到文件系统
 */
export declare function writeAsset(asset: CapabilityAsset): string;
/**
 * 读取 Asset
 */
export declare function readAsset(id: string): CapabilityAsset | null;
/**
 * 资产验证（Dataset Quality Gate）
 */
export declare function validateAsset(asset: CapabilityAsset): string[];
