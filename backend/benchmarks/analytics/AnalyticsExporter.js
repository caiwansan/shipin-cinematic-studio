"use strict";
/**
 * Analytics Exporter — 导出 JSON/Markdown 文件 + Trend 快照
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportSnapshot = exportSnapshot;
exports.listRuns = listRuns;
exports.computeTrends = computeTrends;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const AnalyticsReport_js_1 = require("./AnalyticsReport.js");
const EXPORT_DIR = path.resolve(process.cwd(), 'benchmarks', 'analytics', 'exports');
function ensureDir(dir) {
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
}
/**
 * 导出当前快照
 */
function exportSnapshot(snapshot) {
    ensureDir(EXPORT_DIR);
    const files = [];
    // JSON
    const jsonPath = path.join(EXPORT_DIR, 'analytics.json');
    fs.writeFileSync(jsonPath, (0, AnalyticsReport_js_1.exportJSON)(snapshot), 'utf-8');
    files.push(jsonPath);
    // Markdown
    const mdPath = path.join(EXPORT_DIR, 'analytics.md');
    fs.writeFileSync(mdPath, (0, AnalyticsReport_js_1.exportMarkdown)(snapshot), 'utf-8');
    files.push(mdPath);
    // Timestamped run snapshot (for Trend)
    const ts = snapshot.generated.replace(/[:.]/g, '-');
    const runDir = path.join(EXPORT_DIR, 'runs');
    ensureDir(runDir);
    const runPath = path.join(runDir, `run_${ts}.json`);
    fs.writeFileSync(runPath, (0, AnalyticsReport_js_1.exportJSON)(snapshot), 'utf-8');
    files.push(runPath);
    return files;
}
/**
 * 读取历史 Trend 快照
 */
function listRuns() {
    const runDir = path.join(EXPORT_DIR, 'runs');
    if (!fs.existsSync(runDir))
        return [];
    const runs = [];
    for (const file of fs.readdirSync(runDir)) {
        if (!file.startsWith('run_') || !file.endsWith('.json'))
            continue;
        const ts = file.replace('run_', '').replace('.json', '').replace(/-/g, ':');
        runs.push({ timestamp: ts, path: path.join(runDir, file) });
    }
    return runs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
/**
 * 计算 Trend 数据（简版）
 */
function computeTrends() {
    const runs = listRuns();
    const coverageHistory = [];
    for (const run of runs) {
        try {
            const data = JSON.parse(fs.readFileSync(run.path, 'utf-8'));
            coverageHistory.push({
                time: run.timestamp,
                score: data.summary.averageCoverage,
                health: data.summary.healthScore,
            });
        }
        catch {
            // skip corrupt runs
        }
    }
    return { coverageHistory };
}
