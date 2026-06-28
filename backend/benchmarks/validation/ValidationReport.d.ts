export type ValidationSeverity = 'error' | 'warning' | 'info';
export interface ValidationItem {
    type: string;
    severity: ValidationSeverity;
    dataset?: string;
    capability?: string;
    message: string;
}
export interface ValidationReport {
    /** 统计 */
    errorCount: number;
    warningCount: number;
    infoCount: number;
    datasetCount: number;
    registryCount: number;
    items: ValidationItem[];
    /** 执行元信息 */
    validator: string;
    durationMs: number;
    strict: boolean;
    timestamp: string;
    /** 快速结论 */
    passed: boolean;
}
export interface Validator {
    readonly name: string;
    validate(): ValidationItem[];
}
export declare function createValidationReport(validator: string, items: ValidationItem[], strict: boolean, datasetCount: number, registryCount: number): ValidationReport;
