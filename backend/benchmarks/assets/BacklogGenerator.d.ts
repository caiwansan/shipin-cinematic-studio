/**
 * Capability Backlog — 根据 Coverage Index 自动生成唯一待办
 *
 * P1.4.1: Backlog 是 Dataset 资产生产的唯一驱动源。
 * 任何新增能力自动进入 Backlog，不允许跳过 Backlog 直接写 Dataset。
 */
import type { BacklogEntry } from './AssetTypes.js';
/**
 * 根据 Coverage Index 的 Gap 生成 Backlog
 */
export declare function generateBacklog(): BacklogEntry[];
/**
 * 格式化 Backlog 为 Markdown
 */
export declare function formatBacklog(backlog: BacklogEntry[]): string;
/**
 * 格式化 Backlog 为 CSV
 */
export declare function formatBacklogCSV(backlog: BacklogEntry[]): string;
