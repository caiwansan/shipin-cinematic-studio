/**
 * Analytics Report — JSON / Markdown 导出
 */
import type { AnalyticsSnapshot } from './AnalyticsTypes.js';
export declare function exportJSON(snapshot: AnalyticsSnapshot): string;
export declare function exportMarkdown(snapshot: AnalyticsSnapshot): string;
