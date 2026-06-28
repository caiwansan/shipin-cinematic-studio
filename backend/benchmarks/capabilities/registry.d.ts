import type { CapabilityDefinition } from './capability.types.js';
declare const CAPABILITIES: CapabilityDefinition[];
export declare class CapabilityRegistry {
    static get all(): readonly CapabilityDefinition[];
    static byId(id: string): CapabilityDefinition | undefined;
    static byGroup(group: CapabilityDefinition['group']): CapabilityDefinition[];
    static byStage(stage: CapabilityDefinition['stage']): CapabilityDefinition[];
    static byDifficulty(difficulty: CapabilityDefinition['difficulty']): CapabilityDefinition[];
    /** 按多个条件筛选 */
    static query(query: {
        stage?: CapabilityDefinition['stage'];
        difficulty?: CapabilityDefinition['difficulty'];
        group?: CapabilityDefinition['group'];
        ids?: string[];
        includeDeprecated?: boolean;
    }): CapabilityDefinition[];
    /** 检查能力是否已注册 */
    static exists(id: string): boolean;
    /** 列出所有已注册 ID */
    static listIds(): string[];
    /** 列出所有分组 */
    static listGroups(): CapabilityDefinition['group'][];
    /** 按分组统计数量 */
    static countByGroup(): Record<string, number>;
    /** 按 Difficulty 统计数量 */
    static countByDifficulty(): Record<string, number>;
    /** 返回依赖图邻接表（用于拓扑排序或依赖分析） */
    static dependencyGraph(): Map<string, string[]>;
}
export { CAPABILITIES };
