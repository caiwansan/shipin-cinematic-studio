/**
 * Analytics Exporter — 导出 JSON/Markdown 文件 + Trend 快照
 */
import type { AnalyticsSnapshot } from './AnalyticsTypes.js';
/**
 * 导出当前快照
 */
export declare function exportSnapshot(snapshot: AnalyticsSnapshot): string[];
/**
 * 读取历史 Trend 快照
 */
export declare function listRuns(): {
    timestamp: string;
    path: string;
}[];
/**
 * 计算 Trend 数据（简版）
 */
export declare function computeTrends(): {
    coverageHistory: {
        time: string;
        score: number;
        health: number;
    }[];
};
