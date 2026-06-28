/**
 * BenchmarkValidator — 统一验证入口
 *
 * 调用所有 Validator，合并输出 ValidationReport。
 * CLI / CI / Pipeline Report 都通过此入口验证。
 */
import type { ValidationReport } from './ValidationReport.js';
/**
 * 执行全部验证
 */
export declare function validateAll(strict?: boolean): ValidationReport;
/**
 * 仅验证 Dataset（供 CLI 单独使用）
 */
export declare function validateDatasets(strict?: boolean): ValidationReport;
/**
 * 仅验证 Registry（供 CLI 单独使用）
 */
export declare function validateRegistry(strict?: boolean): ValidationReport;
/**
 * 打印人类可读的验证摘要
 */
export declare function printValidationReport(report: ValidationReport): string;
