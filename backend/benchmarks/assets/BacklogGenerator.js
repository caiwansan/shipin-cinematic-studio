"use strict";
/**
 * Capability Backlog — 根据 Coverage Index 自动生成唯一待办
 *
 * P1.4.1: Backlog 是 Dataset 资产生产的唯一驱动源。
 * 任何新增能力自动进入 Backlog，不允许跳过 Backlog 直接写 Dataset。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBacklog = generateBacklog;
exports.formatBacklog = formatBacklog;
exports.formatBacklogCSV = formatBacklogCSV;
const CoverageScanner_js_1 = require("../coverage/CoverageScanner.js");
const registry_js_1 = require("../capabilities/registry.js");
const GapAnalyzer_js_1 = require("../coverage/GapAnalyzer.js");
const BACKLOG_PATH = 'benchmarks/assets/BACKLOG.yaml';
/**
 * 根据 Coverage Index 的 Gap 生成 Backlog
 */
function generateBacklog() {
    const entries = (0, CoverageScanner_js_1.scanAllDatasets)();
    const gapReport = (0, GapAnalyzer_js_1.analyzeGaps)(entries);
    const backlog = [];
    for (const g of gapReport.suggestions) {
        const def = registry_js_1.CapabilityRegistry.byId(g.capability);
        backlog.push({
            capability: g.capability,
            priority: g.level,
            group: def?.group ?? 'UNKNOWN',
            stage: def?.stage ?? 'unknown',
            difficulty: def?.difficulty ?? 'L0',
            suggestedId: g.suggestedId,
            reason: g.reason,
            status: 'todo',
            createdAt: new Date().toISOString(),
        });
    }
    // P0 排在前面，组内排序
    const priorityOrder = { P0: 0, P1: 1, P2: 2 };
    backlog.sort((a, b) => {
        const pDiff = (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
        if (pDiff !== 0)
            return pDiff;
        return a.group.localeCompare(b.group);
    });
    return backlog;
}
/**
 * 格式化 Backlog 为 Markdown
 */
function formatBacklog(backlog) {
    const lines = [];
    lines.push('# Capability Backlog\n');
    lines.push(`Generated: ${new Date().toISOString()}\n`);
    lines.push(`Total entries: ${backlog.length}\n`);
    for (const priority of ['P0', 'P1', 'P2']) {
        const items = backlog.filter(b => b.priority === priority);
        if (items.length === 0)
            continue;
        const icon = priority === 'P0' ? '🔴' : priority === 'P1' ? '🟡' : '🟢';
        lines.push(`## ${icon} ${priority} (${items.length})\n`);
        lines.push(`| Priority | Capability | Group | Stage | Difficulty | Suggested ID | Status |`);
        lines.push(`|----------|------------|-------|-------|------------|--------------|--------|`);
        for (const b of items) {
            lines.push(`| ${b.priority} | ${b.capability} | ${b.group} | ${b.stage} | ${b.difficulty} | ${b.suggestedId} | ${b.status} |`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
/**
 * 格式化 Backlog 为 CSV
 */
function formatBacklogCSV(backlog) {
    const lines = ['Priority,Capability,Group,Stage,Difficulty,SuggestedId,Status,CreatedAt'];
    for (const b of backlog) {
        lines.push(`${b.priority},${b.capability},${b.group},${b.stage},${b.difficulty},${b.suggestedId},${b.status},${b.createdAt}`);
    }
    return lines.join('\n');
}
