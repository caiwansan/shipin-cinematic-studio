"use strict";
/**
 * shared/runtime/shot-graph.ts — Canonical Shot Graph Schema
 *
 * Sprint 1: 纯导演语义，不含 Camera/VFX/Particle/Motion
 *
 * 宪法规定：
 *   - ShotGraph 是昆仑镜所有视频生成的唯一事实源
 *   - 禁止 Prompt → Video 直通，必须经过 ShotGraph
 *   - ShotNode 只定义导演决策，不定义镜头运动/特效/渲染参数
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHOT_PATTERNS = void 0;
exports.inferSceneType = inferSceneType;
/**
 * 场景类型 → 默认镜头模板
 */
exports.SHOT_PATTERNS = {
    battle: ['establishing', 'reveal', 'reveal', 'confrontation', 'action', 'action', 'impact', 'climax', 'reaction', 'ending'],
    dialogue: ['establishing', 'dialogue', 'dialogue', 'dialogue', 'ending'],
    chase: ['establishing', 'action', 'action', 'action', 'impact', 'ending'],
    exploration: ['establishing', 'reveal', 'detail', 'action', 'reveal', 'ending'],
    ceremony: ['establishing', 'reveal', 'dialogue', 'climax', 'reaction', 'ending'],
    disaster: ['establishing', 'action', 'action', 'impact', 'climax', 'reaction', 'ending'],
    romance: ['establishing', 'reveal', 'dialogue', 'dialogue', 'climax', 'ending'],
    travel: ['establishing', 'action', 'reveal', 'action', 'reveal', 'ending'],
    suspense: ['establishing', 'detail', 'detail', 'confrontation', 'climax', 'reaction', 'ending'],
    tranformation: ['establishing', 'reveal', 'action', 'climax', 'reveal', 'ending'],
};
/**
 * 基于关键词推断场景类型
 */
function inferSceneType(text) {
    const t = text.toLowerCase();
    const battleKeywords = ['大战', '战斗', '对决', '对战', '厮杀', '交锋', '搏斗', 'fight', 'battle', 'war', 'combat', 'clash'];
    if (battleKeywords.some(k => t.includes(k)))
        return 'battle';
    const chaseKeywords = ['追逐', '追赶', '追击', '逃跑', 'chase', 'run', 'escape', 'pursuit'];
    if (chaseKeywords.some(k => t.includes(k)))
        return 'chase';
    const disasterKeywords = ['灾难', '毁灭', '崩塌', '爆炸', 'disaster', 'destroy', 'explosion', 'collapse'];
    if (disasterKeywords.some(k => t.includes(k)))
        return 'disaster';
    const suspicionKeywords = ['悬疑', '秘密', '黑暗', '诡异', 'suspense', 'mystery', 'secret', 'dark'];
    if (suspicionKeywords.some(k => t.includes(k)))
        return 'suspense';
    const romanceKeywords = ['爱情', '相遇', '表白', 'love', 'romance', 'kiss', 'meet'];
    if (romanceKeywords.some(k => t.includes(k)))
        return 'romance';
    const ceremonyKeywords = ['仪式', '祭典', '加冕', 'ceremony', 'ritual', 'coronation'];
    if (ceremonyKeywords.some(k => t.includes(k)))
        return 'ceremony';
    const transformationKeywords = ['蜕变', '觉醒', '突破', '升级', 'awaken', 'transform', 'evolve'];
    if (transformationKeywords.some(k => t.includes(k)))
        return 'tranformation';
    const travelKeywords = ['旅程', '飞行', '穿越', 'travel', 'journey', 'fly', 'cross'];
    if (travelKeywords.some(k => t.includes(k)))
        return 'travel';
    const explorationKeywords = ['探索', '发现', '进入', 'explore', 'discover', 'enter'];
    if (explorationKeywords.some(k => t.includes(k)))
        return 'exploration';
    return 'dialogue';
}
