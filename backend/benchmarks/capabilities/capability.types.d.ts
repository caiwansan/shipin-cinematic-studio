export type CapabilityStage = 'compiler' | 'planner' | 'negotiator' | 'renderer';
export type CapabilityDifficulty = 'L0' | 'L1' | 'L2' | 'L3';
export interface CapabilityDefinition {
    /** 唯一 ID，全大写。例如：CAMERA_PATH */
    id: string;
    /** 人类可读名称 */
    name: string;
    /** 简短描述 */
    description: string;
    /** 能力分组 */
    group: CapabilityGroup;
    /** 哪个 Pipeline 阶段处理 */
    stage: CapabilityStage;
    /** 默认难度分级（L0 最基础，L3 最复杂） */
    difficulty: CapabilityDifficulty;
    /** 依赖的其他能力 ID */
    dependencies: string[];
    /** 是否已废弃 */
    deprecated?: boolean;
}
export type CapabilityGroup = 'camera' | 'lighting' | 'character' | 'render' | 'physics' | 'temporal' | 'action' | 'emotion' | 'spatial' | 'style' | 'audio' | 'dialogue' | 'world' | 'post';
export interface CoverageStats {
    /** 作为 primaryCapability 的 Dataset 数 */
    primary: number;
    /** 作为次要能力的 Dataset 数 */
    secondary: number;
    /** 总出现次数（primary + secondary） */
    total: number;
    /** 平均 Confidence（基于 Negotiator Resolution Rate） */
    averageConfidence: number;
    /** Confidence 方差 */
    confidenceVariance: number;
    /** 最后一次观测到的 Resolution Rate */
    lastResolutionRate: number;
}
export interface RegistryQuery {
    stage?: CapabilityStage;
    difficulty?: CapabilityDifficulty;
    group?: CapabilityGroup;
    ids?: string[];
    includeDeprecated?: boolean;
}
export interface CapabilityMetrics {
    capabilityId: string;
    resolutionRate: number;
    confidenceVariance: number;
    averageScore: number;
    plannerHit: number;
    negotiatorHit: number;
    falsePositive: number;
    falseNegative: number;
    datasetCount: number;
}
