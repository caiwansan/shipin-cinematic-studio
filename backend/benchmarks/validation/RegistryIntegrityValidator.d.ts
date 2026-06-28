/**
 * Registry Integrity Validator
 *
 * 验证 Registry 自身的完整性：
 *   ① 所有能力 ID 唯一
 *   ② 依赖链中没有死循环
 *   ③ 所有依赖的 ID 存在
 *   ④ 每个 stage 至少有一个能力
 *   ⑤ 每个 group 至少有一个能力（可选）
 */
import type { ValidationItem } from './ValidationReport.js';
export declare function validateRegistryIntegrity(): ValidationItem[];
