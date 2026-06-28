"use strict";
/**
 * Coverage Index — 能力覆盖的唯一真相源
 *
 * 所有模块（Gap Report、Pipeline Report、Dashboard、P1.3.4 Analytics）
 * 都通过此索引消费，不重复扫描 Dataset。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateGapLevel = calculateGapLevel;
function calculateGapLevel(entry) {
    if (!entry.gap)
        return undefined;
    if (entry.primaryDatasets.length === 0 && entry.secondaryDatasets.length === 0)
        return 'P0';
    if (entry.primaryDatasets.length === 0)
        return 'P1';
    return 'P2';
}
