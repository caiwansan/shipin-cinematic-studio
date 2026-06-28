import type { CapabilityGroup } from './capability.types.js';
/**
 * Group 分组定义 — 逻辑含义说明
 */
export interface CapabilityGroupInfo {
    id: CapabilityGroup;
    name: string;
    description: string;
    /** 排序权重（越小越优先） */
    order: number;
}
export declare function getGroupInfo(group: CapabilityGroup): CapabilityGroupInfo | undefined;
export declare const CAPABILITY_GROUPS: CapabilityGroupInfo[];
