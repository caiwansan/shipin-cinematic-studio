/**
 * SIE — Scenario Intelligence Engine
 * Normalize Utilities
 *
 * 从原 `scenario-matcher.ts` 提取的通用归一化/字符工具。
 */

/**
 * 归一化：去空格、转小写、保留中英文字符和数字
 */
export function normalize(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
    .trim();
}

/**
 * 提取去重中文字符
 */
export function uniqueChars(text: string): string[] {
  return [...new Set(text.split('').filter((ch) => /[\u4e00-\u9fa5]/.test(ch)))];
}
