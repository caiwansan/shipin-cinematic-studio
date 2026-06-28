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
import type { ValidationItem } from './ValidationReport.js';
export declare const DATASETS_DIR: string;
export interface LoadedDataset {
    id: string;
    level: string;
    metadata: {
        primaryCapability?: string;
        capabilities?: string[];
        stage?: string;
        [key: string]: any;
    };
}
/**
 * 加载所有 Dataset（metadata.yaml 扫描）
 */
export declare function loadAllDatasets(): LoadedDataset[];
/**
 * 验证单个 Dataset 的 Capability 引用。
 */
export declare function validateDatasetCapabilities(ds: LoadedDataset): ValidationItem[];
/**
 * 验证所有 Dataset
 */
export declare function validateAllDatasets(): ValidationItem[];
