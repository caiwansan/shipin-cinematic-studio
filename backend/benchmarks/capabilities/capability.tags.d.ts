/**
 * 标签工具 — 将 Capability ID 映射到人类可读标签。
 * 用于 Dataset metadata 的自动补全和校验。
 */
export interface CapabilityTag {
    id: string;
    label: string;
    keywords: string[];
    /** 推荐出现在哪些类型的 Dataset 中 */
    recommendedScenario: string[];
}
export declare function getTag(id: string): CapabilityTag | undefined;
export declare function searchByKeyword(keyword: string): CapabilityTag[];
export declare function recommendForScenario(scenario: string): CapabilityTag[];
