"use strict";
/**
 * CoverageReport — 生成 Coverage Index 的 JSON / Markdown
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCoverageReport = buildCoverageReport;
exports.exportJSON = exportJSON;
exports.exportMarkdown = exportMarkdown;
const CoverageScanner_js_1 = require("./CoverageScanner.js");
const GapAnalyzer_js_1 = require("./GapAnalyzer.js");
const registry_js_1 = require("../capabilities/registry.js");
/**
 * 构建完整 Report 数据结构
 */
function buildCoverageReport(entries) {
    const summary = (0, CoverageScanner_js_1.computeSummary)(entries);
    const gapReport = (0, GapAnalyzer_js_1.analyzeGaps)(entries);
    // 分组 by stage
    const byStage = {};
    for (const e of entries) {
        if (!byStage[e.stage])
            byStage[e.stage] = [];
        byStage[e.stage].push(e);
    }
    // 分组 by difficulty
    const byDifficulty = {};
    for (const e of entries) {
        if (!byDifficulty[e.difficulty])
            byDifficulty[e.difficulty] = [];
        byDifficulty[e.difficulty].push(e);
    }
    // 分组 by group
    const groups = registry_js_1.CapabilityRegistry.listGroups();
    const byGroup = {};
    for (const group of groups) {
        const groupCaps = registry_js_1.CapabilityRegistry.query({ group: group.id }).map(c => c.id);
        const groupEntries = entries.filter(e => groupCaps.includes(e.capability));
        const total = groupEntries.length;
        const covered = groupEntries.filter(e => !e.gap).length;
        byGroup[group.id] = {
            total,
            covered,
            coverage: total > 0 ? Math.round((covered / total) * 100) : 0,
        };
    }
    return {
        generated: new Date().toISOString(),
        summary,
        registryId: 'v1',
        registryVersion: '1.0.0',
        entries,
        gapReport,
        byStage,
        byDifficulty,
        byGroup,
    };
}
/**
 * 导出 JSON
 */
function exportJSON(report) {
    return JSON.stringify(report, null, 2);
}
/**
 * 导出 Markdown
 */
function exportMarkdown(report) {
    const lines = [];
    lines.push(`# Capability Coverage Report`);
    lines.push(``);
    lines.push(`Generated: ${report.generated}`);
    lines.push(`Registry: ${report.registryId} @ ${report.registryVersion}`);
    lines.push(``);
    // Summary
    lines.push(`## Summary\n`);
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Capabilities | ${report.summary.total} |`);
    lines.push(`| Covered | ${report.summary.covered} |`);
    lines.push(`| Missing (P0) | ${report.summary.missing} |`);
    lines.push(`| Weak (P1) | ${report.summary.weak} |`);
    lines.push(`| Sparse (P2) | ${report.summary.sparse} |`);
    lines.push(`| **Coverage Score** | **${report.summary.coverageScore}%** |`);
    // Group breakdown
    lines.push(`\n## By Group\n`);
    lines.push(`| Group | Total | Covered | Coverage |`);
    lines.push(`|-------|-------|---------|----------|`);
    for (const [g, stats] of Object.entries(report.byGroup).sort()) {
        lines.push(`| ${g} | ${stats.total} | ${stats.covered} | ${stats.coverage}% |`);
    }
    // Stage breakdown
    lines.push(`\n## By Stage\n`);
    for (const [stage, stageEntries] of Object.entries(report.byStage).sort()) {
        const covered = stageEntries.filter(e => !e.gap).length;
        lines.push(`- **${stage}**: ${covered}/${stageEntries.length} (${Math.round(covered / stageEntries.length * 100)}%)`);
    }
    // Difficulty breakdown
    lines.push(`\n## By Difficulty\n`);
    for (const [diff, diffEntries] of Object.entries(report.byDifficulty).sort()) {
        const covered = diffEntries.filter(e => !e.gap).length;
        lines.push(`- **${diff}**: ${covered}/${diffEntries.length} (${Math.round(covered / diffEntries.length * 100)}%)`);
    }
    // Gap Report
    lines.push(`\n## Gaps\n`);
    lines.push((0, GapAnalyzer_js_1.printGapReport)(report.gapReport));
    // Detail table
    lines.push(`\n## Detail\n`);
    lines.push(`| Capability | Stage | Difficulty | Primary | Secondary | Total | Status |`);
    lines.push(`|------------|-------|------------|---------|-----------|-------|--------|`);
    for (const entry of report.entries) {
        const status = entry.gap ? `❌ ${entry.gapLevel ?? 'GAP'}` : '✅';
        lines.push(`| ${entry.capability} | ${entry.stage} | ${entry.difficulty} | ${entry.primaryDatasets.length} | ${entry.secondaryDatasets.length} | ${entry.totalCoverage} | ${status} |`);
    }
    lines.push(``);
    return lines.join('\n');
}
