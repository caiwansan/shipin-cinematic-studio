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
/** 规范化的 ID 格式：{prefix}_{value}，如 char_001, scene_abc */
export type NarrativeId = string;
/** 角色 */
export interface NarrativeCharacter {
    id: NarrativeId;
    name: string;
    /** 形象描述（身高/体型/面部/气质） */
    description: string | null;
    /** 性格描述 */
    personality: string | null;
    /** 外貌/穿着 */
    appearance: string | null;
    /** gender/age/role 由 Prompt 填充，前端展示用 */
    gender: string | null;
    age: string | null;
    role: string | null;
    /** 音色类型（如果是主角/配角就指定默认音色） */
    voiceType: string | null;
    /** AI 生成的 imagePrompt（角色定妆图 prompt） */
    imagePrompt: string | null;
    /** 副提示词 */
    negativePrompt: string | null;
    /** 角色服装变体列表 */
    clothingVariants: string[] | null;
}
/** 场景 */
export interface NarrativeScene {
    id: NarrativeId;
    name: string;
    description: string | null;
    type: string | null;
    timeOfDay: string | null;
    lighting: string | null;
    mood: string | null;
    colorTone: string | null;
    keyProps: string[] | null;
    environment: string | null;
    imagePrompt: string | null;
    negativePrompt: string | null;
}
/** 对话 */
export interface NarrativeDialogue {
    id: NarrativeId;
    /** 所属场景名（与 NarrativeScene.name 关联） */
    sceneName: string | null;
    /** 所属分段 ID（与 NarrativeVideoSegment.id 关联） */
    segmentId: NarrativeId | null;
    /** 角色名 */
    characterName: string;
    /** 台词内容 */
    dialogue: string;
    /** 语气描述（温柔、急切、嘲讽等） */
    tone: string | null;
}
/** 动作表情 */
export interface NarrativeAction {
    id: NarrativeId;
    /** 所属场景名 */
    sceneName: string | null;
    /** 所属分段 ID */
    segmentId: NarrativeId | null;
    /** 角色名 */
    characterName: string;
    /** 详细动作描述 */
    action: string;
    /** 面部表情描述 */
    expression: string | null;
}
/** 音色设定 */
export interface NarrativeVoice {
    id: NarrativeId;
    characterName: string;
    voiceType: string;
    pitch: number | null;
    speed: number | null;
    tone: string | null;
    speakingStyle: string | null;
    description: string | null;
    /** TTS prompt（用于语音合成时的附加提示） */
    ttsPrompt: string | null;
}
/** 道具 */
export interface NarrativeProp {
    id: NarrativeId;
    name: string;
    category: string | null;
    description: string | null;
    /** 关联场景 ID 列表 */
    sceneIds: NarrativeId[] | null;
    /** 关联角色名列表 */
    characterNames: string[] | null;
    imagePrompt: string | null;
    metadata: Record<string, unknown> | null;
}
/** 镜头节拍 — 一个 videoSegment 内部的镜头级拆分 */
export interface NarrativeStoryboardBeat {
    start: number;
    end: number;
    camera: string | null;
    visual: string | null;
    dialogue: string | null;
    effect: string | null;
    sound: string | null;
    emotion: string | null;
    label: string | null;
}
/** 视频段落 — 8-15s 一段，每段按镜头切分成 beats */
export interface NarrativeVideoSegment {
    id: NarrativeId;
    title: string | null;
    /** 所属场景名 */
    scene: string | null;
    duration: number | null;
    beats: NarrativeStoryboardBeat[] | null;
    /** 参与角色名列表 */
    characters: string[] | null;
    /** 段落转场方式 */
    transition: string | null;
    /** 段落的对话列表（平铺） */
    dialogues: NarrativeDialogue[] | null;
    /** 段落的动作列表（平铺） */
    actions: NarrativeAction[] | null;
    /** ⭐ 段落叙事目的/画面描述（剧本原文摘要） */
    narrativePurpose: string | null;
    /** ⭐ 段落完整文本 */
    fullText: string | null;
    /** ⭐ 拍摄模式 */
    shotPattern: string | null;
    /** ⭐ 情绪弧线 */
    emotionArc: string | null;
    /** ⭐ 图像生成提示词 */
    imagePrompt: string | null;
    /** ⭐ 负面提示词 */
    negativePrompt: string | null;
}
/** 分镜帧 — 一个 videoSegment 的首尾帧画面 */
export interface NarrativeStoryboardFrame {
    id: NarrativeId;
    segmentId: NarrativeId | null;
    firstFrameDescription: string | null;
    firstFramePrompt: string | null;
    firstFrameCameraAngle: string | null;
    lastFrameDescription: string | null;
    lastFramePrompt: string | null;
    lastFrameCameraAngle: string | null;
    sortOrder: number | null;
}
/** 情绪曲线点 */
export interface NarrativeEmotionPoint {
    second: number;
    emotion: string;
    intensity: number;
}
/** 情绪曲线 */
export interface NarrativeEmotionCurve {
    points: NarrativeEmotionPoint[];
}
/** 视频生产元数据 */
export interface NarrativeProductionMetadata {
    overallStyle: string | null;
    fps: number | null;
    resolution: string | null;
    colorPalette: string | null;
    transitionStyle: string | null;
}
/**
 * NarrativeProjectSnapshot — 标准化后的完整叙事项目快照
 *
 * 这是 normalize 的唯一输出格式。
 * 下游（DB写入 / frontend hydration / artifact sync）只消费此类型。
 */
export interface NarrativeProjectSnapshot {
    version: 'v2';
    title: string | null;
    synopsis: string | null;
    characters: NarrativeCharacter[];
    scenes: NarrativeScene[];
    dialogues: NarrativeDialogue[];
    actions: NarrativeAction[];
    voices: NarrativeVoice[];
    props: NarrativeProp[];
    videoSegments: NarrativeVideoSegment[];
    emotionCurve: NarrativeEmotionCurve | null;
    productionMetadata: NarrativeProductionMetadata | null;
    /** 原始 AI 响应（仅用于 debug，禁止被前端消费） */
    rawAiResponse: unknown | null;
}
declare const ID_PREFIXES: Record<string, string>;
export declare function generateNarrativeId(type: keyof typeof ID_PREFIXES, suffix?: string): NarrativeId;
/** 将 '' / undefined / 0 统一为 null */
export declare function toNull<T>(value: T | undefined | '' | 0): T | null;
/** 将 '' / undefined 统一为 null（保留 0） */
export declare function toNullStrict<T>(value: T | undefined | ''): T | null;
/** 将空数组转为 null */
export declare function toNullArray<T>(arr: T[] | undefined | null): T[] | null;
/** 安全地返回非空数组（normalize 层用，内部处理时快捷工具） */
export declare function safeArray<T>(arr: T[] | undefined | null, fallback?: T[]): T[];
export {};
