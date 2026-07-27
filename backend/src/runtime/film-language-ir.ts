/**
 * FilmLanguageIR v0.1
 * ==================
 * 昆仑镜规范运行时（Canonical Runtime）
 * 不属于任何 Provider，所有 Adapter 消费此 IR。
 *
 * 原则：
 * - 用户层：自然语言 narrative（唯一可编辑文本）
 * - 执行层：FilmLanguageIR（LLM 创作 → Compiler 编译 → Adapter 执行）
 * - Compiler 应是确定性的：同一句 narrative 永远编译成一样的 IR
 *
 * Phase A（现在）: LLM 直接输出 filmIR，但最终目标是 Compiler 承担此职责
 * Phase B（A6）  : FilmCompiler（Parser → Normalizer → Constraint Builder → SceneGraph Builder → FilmLanguageIR）
 */


// ─── Metadata ───
export interface FilmIRMetadata {
  id: string;                  // filmir_xxx（UUID 格式）
  version: string;             // "0.1.0" semver
  createdBy: string;           // "deepseek-v4" | "film-compiler@0.1"
  createdAt: string;           // ISO 8601
  source: string;              // "ai-optimize-shot" | "film-compiler"
  confidence: number;          // 0-1（LLM 直接输出时不准确，Compiler 输出时为 1）
  provider?: string;           // 使用的 AI provider（如 deepseek-v4-flash）
  schemaVersion: string;       // "film-ir@0.1"
  parentId?: string;           // 如果由 clone() 生成，指向原始 ID
}

/** 生成 FilmIR ID */
export function generateFilmIRId(): string {
  return `filmir_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 创建默认 Metadata */
export function createFilmIRMetadata(overrides?: Partial<FilmIRMetadata>): FilmIRMetadata {
  return {
    id: generateFilmIRId(),
    version: '0.1.0',
    createdBy: 'unknown',
    createdAt: new Date().toISOString(),
    source: 'unknown',
    confidence: 0.5,
    schemaVersion: 'film-ir@0.1',
    ...overrides,
  }
}

// ─── 全局 ───
export interface FilmIRGlobal {
  duration: number;           // 视频总时长（秒）
  mood?: string;              // 情绪基调（如 "宁静诗意"、"紧张激烈"）
  narrativePurpose?: string;  // 该片段在故事中的叙事目的
  genre?: string;             // 类型（古装/现代/仙侠/悬疑...）
}

// ─── 场景 ───
export interface FilmIRScene {
  location: string;           // 地点（如 "乌有城城南老茶馆门口"）
  environment: string;        // 环境描述（如 "老街石板路，木门，老槐树"）
  timeOfDay: string;          // 时段（清晨/正午/黄昏/夜晚）
  weather: string;            // 天气（晴/阴/雨/雪/风）
  year?: string;              // 年代设定（如 "初春"）
}

// ─── 角色 ───
export interface FilmIRCharacter {
  name: string;               // 角色名
  position: string;           // 在画面中的位置（如 "画面中央偏左，站在茶馆门前"）
  motion: string;             // 动作描述（如 "右手推门，身体微侧"）
  expression: string;         // 表情（如 "嘴角含笑，眼神温暖"）
  clothing?: string;          // 服装
  appearance?: string;        // 外貌特征
  actionDetail?: string;      // ⭐ 详细的物理交互指导（供视频模型理解）
}

// ─── 镜头 ───
export interface FilmIRCamera {
  shotType: string;           // 景别（远景/全景/中景/中近景/特写/大特写）
  movement: string;           // 运镜（固定/推/拉/摇/移/跟/升降/呼吸感）
  angle: string;              // 角度（平视/仰拍/俯拍/过肩/主观）
  focalLength?: string;       // 焦段（广角/标准/长焦/微距）
  composition?: string;       // 构图技巧（三分法/对称/引导线/框架构图）
}

// ─── 光影 ───
export interface FilmIRLighting {
  keyLight: string;           // 主光描述（如 "清晨侧上方斜射柔光"）
  fillLight?: string;         // 补光描述
  mood: string;               // 光影情绪（如 "温暖柔和"、"冷峻硬朗"）
  colorTemperature?: string;  // 色温（暖/冷/中性/混合）
}

// ─── 动作与交互 ───
export interface FilmIRAction {
  type: string;               // 动作类型（开门/喝茶/行走/坐下/打斗...）
  subject: string;            // 执行者（角色名）
  target?: string;            // 作用目标（如 "木门"、"茶杯"、"椅子"）
  physicsDetail: string;      // ⭐ 物理交互细节（LLM 写，视频模型理解）
  duration?: number;          // 动作持续时间（秒）
  soundEffect?: string;       // 音效描述
}

// ─── 环境 ───
export interface FilmIREnvironment {
  atmosphere: string;         // 氛围（如 "宁静、生机、略带苍凉"）
  particles?: string;         // 粒子特效（尘埃/花瓣/雪/雨/光斑）
  backgroundMotion?: string;  // 背景动态（树叶摇曳/旗帜飘动/水面波纹）
  colorPalette?: string;      // 主色调（如 "嫩绿、灰蓝、青灰"）
}

// ─── 风格 ───
export interface FilmIRStyle {
  genre: string;              // 类型风格（古装写实/武侠/悬疑/年代剧）
  texture: string;            // 质感（电影级/胶片/数字/纪录片）
  rendering?: string;         // 渲染风格（写实/风格化/水墨/赛博朋克）
}

// ─── 约束（核心！不埋在 action 里） ───
export interface FilmIRConstraint {
  continuity: string[];       // 连续性约束（如 "沈三笑青色长衫不变"、"门板始终连接门框"）
  physics: string[];          // 物理规则（如 "门绕合页旋转，不脱离门框"、"打斗时受力方随击打方向移动"）
  identity: string[];         // 角色身份一致性（如 "面部特征稳定"、"不会忽老忽少"）
  spatial: string[];          // 空间关系（如 "沈三笑站在门前，与门框高度比符合现实"）
  temporal: string[];         // 时间连续性（如 "不可时间跳跃"、"动作顺序不能颠倒"）
  cameraSafety: string[];     // 镜头安全规则（如 "不越过 180° 轴线"）
  visibility: string[];       // 可见性（如 "关键角色始终在画面内"、"不可遮挡脸部"）
  custom?: string[];          // 自定义约束
}

// ─── 引用资产 ───
export interface FilmIRReference {
  characterImages?: string[]; // 角色参考图 URL
  sceneImages?: string[];     // 场景参考图 URL
  propImages?: string[];      // 道具参考图 URL
  styleReference?: string;    // 风格参考图 URL
  keyframeImages?: string[];  // 关键帧参考图（首帧/中帧/尾帧）
  additionalRefs?: string[];  // 其他参考
}

// ─── FilmLanguageIR v0.1 完整结构 ───
export interface FilmLanguageIR {
  metadata: FilmIRMetadata;     // ⭐ 元数据（不可变标识）
  global: FilmIRGlobal;
  scene: FilmIRScene;
  characters: FilmIRCharacter[];
  camera: FilmIRCamera;
  lighting: FilmIRLighting;
  action: FilmIRAction[];
  environment: FilmIREnvironment;
  style: FilmIRStyle;
  constraints: FilmIRConstraint;
  references: FilmIRReference;
}

// ─── AI Optimize Shot 输出结构 ───
export interface OptimizeShotResult {
  narrative: string;              // 用户展示层（唯一可编辑文本，纯自然语言）
  dialogue: string;
  effects: string;
  negativePrompt: string | string[];
  optimizedShotes: any[];         // 逐秒镜头脚本（兼容旧格式）
  firstFrameDescription: string;
  lastFrameDescription: string;
  // ⭐ 新增：规范运行时
  filmIR?: FilmLanguageIR;        // Phase A: LLM 直接输出；Phase B: Compiler 编译
}

/** 返回空的 FilmLanguageIR 模板 */
export function emptyFilmIR(duration = 5, overrides?: Partial<FilmIRMetadata>): FilmLanguageIR {
  const meta = createFilmIRMetadata({ createdBy: 'empty-template', source: 'empty-template', ...overrides })
  return {
    metadata: meta,
    global: { duration, mood: '', narrativePurpose: '' },
    scene: { location: '', environment: '', timeOfDay: '', weather: '' },
    characters: [],
    camera: { shotType: '', movement: '', angle: '' },
    lighting: { keyLight: '', mood: '' },
    action: [],
    environment: { atmosphere: '' },
    style: { genre: '', texture: '' },
    constraints: {
      continuity: [],
      physics: [],
      identity: [],
      spatial: [],
      temporal: [],
      cameraSafety: [],
      visibility: [],
    },
    references: {},
  };
}


// ─── Immutable 工具 ───

/** 深冻结 FilmLanguageIR（递归 Object.freeze + 数组冻结） */
export function freezeFilmIR(ir: FilmLanguageIR): Readonly<FilmLanguageIR> {
  const freeze = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj
    // 先冻结自身
    Object.freeze(obj)
    const vals = Array.isArray(obj) ? obj : Object.values(obj)
    vals.forEach(v => {
      if (typeof v === 'object' && v !== null) {
        freeze(v)
      }
    })
    return obj
  }
  return freeze(ir) as Readonly<FilmLanguageIR>
}

/** 克隆 FilmLanguageIR（深拷贝，自动生成新 ID 并记录 parentId） */
export function cloneFilmIR(ir: Readonly<FilmLanguageIR>): FilmLanguageIR {
  const clone = JSON.parse(JSON.stringify(ir)) as FilmLanguageIR
  clone.metadata = {
    ...clone.metadata,
    id: generateFilmIRId(),
    parentId: ir.metadata.id,
    version: bumpVersion(ir.metadata.version, 'patch'),
    createdAt: new Date().toISOString(),
    createdBy: 'clone',
    source: 'clone',
  }
  return clone
}

/** 补丁版本号 */
function bumpVersion(v: string, type: 'major' | 'minor' | 'patch'): string {
  const parts = v.split('.').map(Number)
  if (type === 'major') { parts[0]++; parts[1] = 0; parts[2] = 0 }
  else if (type === 'minor') { parts[1]++; parts[2] = 0 }
  else parts[2]++
  return parts.join('.')
}
