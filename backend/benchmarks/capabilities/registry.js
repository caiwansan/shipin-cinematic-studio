"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAPABILITIES = exports.CapabilityRegistry = void 0;
// ════════════════════════════════════════════════════
// Capability Registry — SSOT
// 所有电影拍摄能力的唯一定义源。
// 新增能力：在此文件添加即可，其他模块自动感知。
// ════════════════════════════════════════════════════
const CAPABILITIES = [
    // ─── Camera ─────────────────────────────────────
    {
        id: 'CAMERA_PATH',
        name: 'Camera Path',
        description: '摄像机运动路径（推拉摇移跟升降旋转）',
        group: 'camera',
        stage: 'planner',
        difficulty: 'L2',
        dependencies: ['SHOT_TRANSITION'],
    },
    {
        id: 'CAMERA_MOTION',
        name: 'Camera Motion',
        description: '摄像机动态效果（抖动、跟随、稳定）',
        group: 'camera',
        stage: 'planner',
        difficulty: 'L1',
        dependencies: ['CAMERA_PATH'],
    },
    {
        id: 'CAMERA_COMPOSITION',
        name: 'Camera Composition',
        description: '画面构图（三分法、引导线、对称、景深）',
        group: 'camera',
        stage: 'planner',
        difficulty: 'L2',
        dependencies: [],
    },
    {
        id: 'CAMERA_FOCUS',
        name: 'Camera Focus',
        description: '焦点控制（浅景深、变焦、焦点转移）',
        group: 'camera',
        stage: 'planner',
        difficulty: 'L2',
        dependencies: ['CAMERA_PATH'],
    },
    // ─── Lighting ────────────────────────────────────
    {
        id: 'LIGHT_DIRECTION',
        name: 'Light Direction',
        description: '光照方向（顺光、侧光、逆光、顶光、底光）',
        group: 'lighting',
        stage: 'planner',
        difficulty: 'L1',
        dependencies: [],
    },
    {
        id: 'LIGHT_CONTINUITY',
        name: 'Light Continuity',
        description: '光照连续性（同一场景不同镜头光照一致）',
        group: 'lighting',
        stage: 'negotiator',
        difficulty: 'L2',
        dependencies: ['LIGHT_DIRECTION'],
    },
    {
        id: 'LIGHT_CONTROL',
        name: 'Light Control',
        description: '多光源控制（主光、辅助光、背光组合）',
        group: 'lighting',
        stage: 'planner',
        difficulty: 'L2',
        dependencies: ['LIGHT_DIRECTION'],
    },
    {
        id: 'LIGHT_TRANSITION',
        name: 'Light Transition',
        description: '光照过渡（场景切换时的光照变化）',
        group: 'lighting',
        stage: 'negotiator',
        difficulty: 'L2',
        dependencies: ['LIGHT_CONTINUITY'],
    },
    // ─── Character ───────────────────────────────────
    {
        id: 'CHARACTER_REFERENCE',
        name: 'Character Reference',
        description: '角色形象引用（保持角色外观一致）',
        group: 'character',
        stage: 'compiler',
        difficulty: 'L0',
        dependencies: [],
    },
    {
        id: 'CHARACTER_CONSISTENCY',
        name: 'Character Consistency',
        description: '角色跨镜头一致性（同一角色在不同镜头中保持一致）',
        group: 'character',
        stage: 'negotiator',
        difficulty: 'L2',
        dependencies: ['CHARACTER_REFERENCE'],
    },
    {
        id: 'CHARACTER_EMOTION',
        name: 'Character Emotion',
        description: '角色表情与情感表达',
        group: 'character',
        stage: 'planner',
        difficulty: 'L1',
        dependencies: ['CHARACTER_REFERENCE'],
    },
    {
        id: 'CHARACTER_POSE',
        name: 'Character Pose',
        description: '角色姿态控制（站姿、坐姿、手势）',
        group: 'character',
        stage: 'planner',
        difficulty: 'L1',
        dependencies: ['CHARACTER_REFERENCE'],
    },
    // ─── Render ──────────────────────────────────────
    {
        id: 'RENDER_SHOT',
        name: 'Render Shot',
        description: '基础镜头渲染（单镜头画面输出）',
        group: 'render',
        stage: 'renderer',
        difficulty: 'L0',
        dependencies: [],
    },
    {
        id: 'RENDER_KEYFRAME',
        name: 'Render Keyframe',
        description: '关键帧渲染（关键位置的画面输出）',
        group: 'render',
        stage: 'renderer',
        difficulty: 'L0',
        dependencies: [],
    },
    {
        id: 'RENDER_SEQUENCE',
        name: 'Render Sequence',
        description: '连续镜头序列渲染（保持帧间连续性）',
        group: 'render',
        stage: 'renderer',
        difficulty: 'L2',
        dependencies: ['RENDER_SHOT'],
    },
    {
        id: 'RENDER_MULTI_SHOT',
        name: 'Render Multi Shot',
        description: '多镜头合并渲染（shot→scene 合成）',
        group: 'render',
        stage: 'renderer',
        difficulty: 'L3',
        dependencies: ['RENDER_SEQUENCE'],
    },
    // ─── Temporal / Consistency ──────────────────────
    {
        id: 'TEMPORAL_CONSISTENCY',
        name: 'Temporal Consistency',
        description: '时间轴一致性（同一场景帧间稳定）',
        group: 'temporal',
        stage: 'negotiator',
        difficulty: 'L2',
        dependencies: ['CHARACTER_CONSISTENCY'],
    },
    {
        id: 'ACTION_TIMING',
        name: 'Action Timing',
        description: '动作时间轴（动作速度、节奏控制）',
        group: 'temporal',
        stage: 'planner',
        difficulty: 'L2',
        dependencies: [],
    },
    {
        id: 'SHOT_TRANSITION',
        name: 'Shot Transition',
        description: '镜头切换（切、淡、划、叠等过渡方式）',
        group: 'temporal',
        stage: 'planner',
        difficulty: 'L1',
        dependencies: [],
    },
    {
        id: 'TIMELINE_SYNC',
        name: 'Timeline Sync',
        description: '时间线同步（多元素在时间轴上的对齐）',
        group: 'temporal',
        stage: 'negotiator',
        difficulty: 'L2',
        dependencies: ['ACTION_TIMING', 'SHOT_TRANSITION'],
    },
    // ─── Physics ─────────────────────────────────────
    {
        id: 'PHYSICS_CONSTRAINT',
        name: 'Physics Constraint',
        description: '物理约束（重力、碰撞、刚体、布料、粒子）',
        group: 'physics',
        stage: 'renderer',
        difficulty: 'L3',
        dependencies: [],
    },
    {
        id: 'PHYSICS_ENVIRONMENT',
        name: 'Physics Environment',
        description: '环境物理（风、水、火、烟雾等自然现象）',
        group: 'physics',
        stage: 'renderer',
        difficulty: 'L3',
        dependencies: ['PHYSICS_CONSTRAINT'],
    },
    // ─── Spatial ─────────────────────────────────────
    {
        id: 'SPATIAL_LAYOUT',
        name: 'Spatial Layout',
        description: '空间布局（场景内的物体位置与关系）',
        group: 'spatial',
        stage: 'planner',
        difficulty: 'L0',
        dependencies: [],
    },
    {
        id: 'WORLD_STATE',
        name: 'World State',
        description: '世界状态一致性（物体在连续镜头中的位置一致）',
        group: 'spatial',
        stage: 'negotiator',
        difficulty: 'L2',
        dependencies: ['SPATIAL_LAYOUT'],
    },
    {
        id: 'OBJECT_PERSISTENCE',
        name: 'Object Persistence',
        description: '物体持久性（道具在切镜后保持状态）',
        group: 'spatial',
        stage: 'negotiator',
        difficulty: 'L2',
        dependencies: ['WORLD_STATE'],
    },
    {
        id: 'SPATIAL_RELATIONSHIP',
        name: 'Spatial Relationship',
        description: '空间关系（角色间的相对位置与视线方向）',
        group: 'spatial',
        stage: 'planner',
        difficulty: 'L1',
        dependencies: ['SPATIAL_LAYOUT'],
    },
    // ─── Style / Film Language ──────────────────────
    {
        id: 'STYLE_TRANSFER',
        name: 'Style Transfer',
        description: '风格迁移（画面风格化处理）',
        group: 'style',
        stage: 'renderer',
        difficulty: 'L2',
        dependencies: [],
    },
    {
        id: 'EMOTION_ALIGNMENT',
        name: 'Emotion Alignment',
        description: '情感对齐（画面风格与叙事情绪一致）',
        group: 'emotion',
        stage: 'planner',
        difficulty: 'L2',
        dependencies: ['STYLE_TRANSFER'],
    },
    {
        id: 'EMOTION_ARC',
        name: 'Emotion Arc',
        description: '情绪弧线（整场戏的情感变化曲线）',
        group: 'emotion',
        stage: 'planner',
        difficulty: 'L3',
        dependencies: ['EMOTION_ALIGNMENT'],
    },
    // ─── Post Production ────────────────────────────
    {
        id: 'POST_COLOR_GRADING',
        name: 'Post Color Grading',
        description: '后期调色（色彩校正与风格化）',
        group: 'post',
        stage: 'renderer',
        difficulty: 'L2',
        dependencies: [],
    },
    {
        id: 'POST_VFX',
        name: 'Post VFX',
        description: '后期特效（粒子、光晕、模糊等特效）',
        group: 'post',
        stage: 'renderer',
        difficulty: 'L2',
        dependencies: ['POST_COLOR_GRADING'],
    },
];
exports.CAPABILITIES = CAPABILITIES;
// ─── Built-index lookups ────────────────────────────
const byId = new Map();
const byGroup = new Map();
const byStage = new Map();
const byDifficulty = new Map();
function buildIndexes() {
    for (const cap of CAPABILITIES) {
        byId.set(cap.id, cap);
        if (!byGroup.has(cap.group))
            byGroup.set(cap.group, []);
        byGroup.get(cap.group).push(cap);
        if (!byStage.has(cap.stage))
            byStage.set(cap.stage, []);
        byStage.get(cap.stage).push(cap);
        if (!byDifficulty.has(cap.difficulty))
            byDifficulty.set(cap.difficulty, []);
        byDifficulty.get(cap.difficulty).push(cap);
    }
}
buildIndexes();
// ─── Registry API ───────────────────────────────────
class CapabilityRegistry {
    static get all() {
        return CAPABILITIES;
    }
    static byId(id) {
        return byId.get(id);
    }
    static byGroup(group) {
        return byGroup.get(group) ?? [];
    }
    static byStage(stage) {
        return byStage.get(stage) ?? [];
    }
    static byDifficulty(difficulty) {
        return byDifficulty.get(difficulty) ?? [];
    }
    /** 按多个条件筛选 */
    static query(query) {
        let result = CAPABILITIES;
        if (!query.includeDeprecated) {
            result = result.filter(c => !c.deprecated);
        }
        if (query.stage) {
            result = result.filter(c => c.stage === query.stage);
        }
        if (query.difficulty) {
            result = result.filter(c => c.difficulty === query.difficulty);
        }
        if (query.group) {
            result = result.filter(c => c.group === query.group);
        }
        if (query.ids) {
            const idSet = new Set(query.ids);
            result = result.filter(c => idSet.has(c.id));
        }
        return result;
    }
    /** 检查能力是否已注册 */
    static exists(id) {
        return byId.has(id);
    }
    /** 列出所有已注册 ID */
    static listIds() {
        return CAPABILITIES.map(c => c.id);
    }
    /** 列出所有分组 */
    static listGroups() {
        return [...byGroup.keys()];
    }
    /** 按分组统计数量 */
    static countByGroup() {
        const counts = {};
        for (const [group, caps] of byGroup) {
            counts[group] = caps.length;
        }
        return counts;
    }
    /** 按 Difficulty 统计数量 */
    static countByDifficulty() {
        const counts = {};
        for (const [diff, caps] of byDifficulty) {
            counts[diff] = caps.length;
        }
        return counts;
    }
    /** 返回依赖图邻接表（用于拓扑排序或依赖分析） */
    static dependencyGraph() {
        const graph = new Map();
        for (const cap of CAPABILITIES) {
            graph.set(cap.id, cap.dependencies.filter(d => byId.has(d)));
        }
        return graph;
    }
}
exports.CapabilityRegistry = CapabilityRegistry;
