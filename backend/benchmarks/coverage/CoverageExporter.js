"use strict";
/**
 * CoverageExporter — 导出 coverage.json / coverage.md / coverage.csv
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
exports.exportAll = exportAll;
exports.exportFormat = exportFormat;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const CoverageReport_js_1 = require("./CoverageReport.js");
const EXPORT_DIR = path.resolve(process.cwd(), 'benchmarks', 'coverage', 'exports');
function ensureDir(dir) {
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
}
/**
 * 导出全部格式
 */
function exportAll(report) {
    ensureDir(EXPORT_DIR);
    const files = [];
    // JSON
    const jsonPath = path.join(EXPORT_DIR, 'coverage.json');
    fs.writeFileSync(jsonPath, (0, CoverageReport_js_1.exportJSON)(report), 'utf-8');
    files.push(jsonPath);
    // Markdown
    const mdPath = path.join(EXPORT_DIR, 'coverage.md');
    fs.writeFileSync(mdPath, (0, CoverageReport_js_1.exportMarkdown)(report), 'utf-8');
    files.push(mdPath);
    // CSV (summary table)
    const csvPath = path.join(EXPORT_DIR, 'coverage.csv');
    const csvLines = ['Capability,Stage,Difficulty,Primary,Secondary,Total,Status'];
    for (const entry of report.entries) {
        const status = entry.gap ? 'GAP' : 'COVERED';
        csvLines.push(`${entry.capability},${entry.stage},${entry.difficulty},${entry.primaryDatasets.length},${entry.secondaryDatasets.length},${entry.totalCoverage},${status}`);
    }
    fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');
    files.push(csvPath);
    return files;
}
/**
 * 导出指定格式
 */
function exportFormat(report, format) {
    ensureDir(EXPORT_DIR);
    switch (format) {
        case 'json': {
            const fp = path.join(EXPORT_DIR, 'coverage.json');
            fs.writeFileSync(fp, (0, CoverageReport_js_1.exportJSON)(report), 'utf-8');
            return fp;
        }
        case 'md': {
            const fp = path.join(EXPORT_DIR, 'coverage.md');
            fs.writeFileSync(fp, (0, CoverageReport_js_1.exportMarkdown)(report), 'utf-8');
            return fp;
        }
        case 'csv': {
            const fp = path.join(EXPORT_DIR, 'coverage.csv');
            const csvLines = ['Capability,Stage,Difficulty,Primary,Secondary,Total,Status'];
            for (const entry of report.entries) {
                const status = entry.gap ? 'GAP' : 'COVERED';
                csvLines.push(`${entry.capability},${entry.stage},${entry.difficulty},${entry.primaryDatasets.length},${entry.secondaryDatasets.length},${entry.totalCoverage},${status}`);
            }
            fs.writeFileSync(fp, csvLines.join('\n'), 'utf-8');
            return fp;
        }
    }
}
