/**
 * Registry Completeness Validator
 *
 * 检查 Registry 中每个能力的 Dataset 覆盖情况：
 *   - primaryCapability 出现次数 = Primary Count
 *   - capabilities 中出现次数 = Secondary Count
 *   - 两者都为 0 → Warning（未来补充）
 */
import type { ValidationItem } from './ValidationReport.js';
export declare function validateRegistryCoverage(): ValidationItem[];
