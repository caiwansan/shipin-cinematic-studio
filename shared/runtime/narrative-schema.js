"use strict";
/**
 * shared/runtime/narrative-schema.ts — Narrative Runtime Constitution v1
 *
 * ⚠️ 全系统唯一 Narrative Canonical Schema
 *
 * 宪法规定：
 *   - 前端/后端/DB/artifact 所有层只能从本文件读取类型
 *   - 禁止任何层独立定义 Narrative 相关类型
 *   - Prompt 模板的 JSON Schema 必须与本文件字段名一致
 *
 * 命名规则：
 *   - ID 全部使用 string，格式: {type}_{uuid或序号}
 *   - 字段名统一使用 camelCase
 *   - nullable 统一使用 null（禁止 undefined / '' / 0 混用）
 *   - 字段 fallback 统一在 normalize 层完成，下游禁止补字段
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNarrativeId = generateNarrativeId;
exports.toNull = toNull;
exports.toNullStrict = toNullStrict;
exports.toNullArray = toNullArray;
exports.safeArray = safeArray;
// ============================================================
// ID 生成器（统一规范）
// ============================================================
const ID_PREFIXES = {
    character: 'char',
    scene: 'scene',
    dialogue: 'dlg',
    action: 'act',
    voice: 'voice',
    prop: 'prop',
    segment: 'seg',
    beat: 'bt',
    frame: 'frame',
};
function generateNarrativeId(type, suffix) {
    const prefix = ID_PREFIXES[type];
    const s = suffix || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return `${prefix}_${s}`;
}
// ============================================================
// Nullable 辅助工具
// ============================================================
/** 将 '' / undefined / 0 统一为 null */
function toNull(value) {
    if (value === undefined || value === '' || value === 0 || value === null)
        return null;
    return value;
}
/** 将 '' / undefined 统一为 null（保留 0） */
function toNullStrict(value) {
    if (value === undefined || value === '' || value === null)
        return null;
    return value;
}
/** 将空数组转为 null */
function toNullArray(arr) {
    if (!arr || arr.length === 0)
        return null;
    return arr;
}
/** 安全地返回非空数组（normalize 层用，内部处理时快捷工具） */
function safeArray(arr, fallback = []) {
    return arr ?? fallback;
}
