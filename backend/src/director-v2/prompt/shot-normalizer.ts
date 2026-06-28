/**
 * prompt/shot-normalizer.ts — Phase 0 DirectorIR 兼容层
 *
 * 职责（严格）: PURE DATA SANITIZER
 *   ✅ string/object 统一
 *   ✅ fallback 补齐
 *   ❌ 不做任何"理解"（情绪/镜头推断）
 *
 * 宪法：
 *   1. normalizeShot 是纯函数，不调 LLM
 *   2. 不修改输入对象（immutable）
 *   3. 输出结构必须能被 DirectorIR 消费
 */

// ─── 类型 ─────────────────────────────────────────────────────────

export interface NormalizedShot {
  subject: NormalizedSubject[]
  action: string
  camera?: NormalizedCamera
  environment?: NormalizedEnvironment
  vfx?: string[]
  style?: string[]
}

export interface NormalizedSubject {
  id: string
  name: string
  raw: unknown  // 保留原始数据供 trace
}

export interface NormalizedCamera {
  shotType?: string
  movement?: string
  lens?: string
}

export interface NormalizedEnvironment {
  location?: string
  atmosphere?: string
  timeOfDay?: string
}

// ─── 常量映射表 ─────────────────────────────────────────────────

const CAMERA_DEFAULTS: Record<string, NormalizedCamera> = {
  indoor_low_light: {
    shotType: 'medium close-up',
    movement: 'static',
    lens: '35mm f/1.8',
  },
  outdoor_daylight: {
    shotType: 'wide shot',
    movement: 'pan',
    lens: '24mm f/8',
  },
  outdoor_night: {
    shotType: 'medium shot',
    movement: 'static',
    lens: '50mm f/1.4',
  },
  action: {
    shotType: 'dynamic shot',
    movement: 'handheld',
    lens: '35mm f/2.8',
  },
  close_up: {
    shotType: 'close-up',
    movement: 'static',
    lens: '85mm f/1.8',
  },
}

// ─── normalizeShot（核心入口） ─────────────────────────────────

/**
 * 清洗并补全 shot 数据，输出标准化结构
 *
 * 输入：任意 shot 对象（shot.graph 的旧结构）
 * 输出：NormalizedShot（纯数据，不含理解）
 */
export function normalizeShot(shot: any): NormalizedShot {
  return {
    subject: normalizeSubjects(shot?.subject),
    action: String(shot?.action ?? ''),
    camera: normalizeCamera(shot?.camera),
    environment: normalizeEnvironment(shot?.environment || shot?.spatialFrame),
    vfx: normalizeStringArray(shot?.vfx),
    style: normalizeStringArray(shot?.styleKeywords || shot?.style?.keywords),
  }
}

// ─── 内部归一化函数 ────────────────────────────────────────────

/**
 * subject 数组归一化：string / { name, id } → NormalizedSubject[]
 */
function normalizeSubjects(subject: any): NormalizedSubject[] {
  if (!Array.isArray(subject) || subject.length === 0) {
    return [{ id: 'unknown', name: 'main character', raw: subject }]
  }

  return subject.map((s: unknown, i: number) => {
    if (typeof s === 'string') {
      return { id: s.toLowerCase().replace(/\s+/g, '_'), name: s, raw: s }
    }
    if (s && typeof s === 'object') {
      const obj = s as Record<string, unknown>
      const name = String(obj.name || obj.id || `character_${i}`)
      const id = String(obj.id || obj.name || `char_${i}`)
      return { id, name, raw: s }
    }
    return { id: `char_${i}`, name: String(s), raw: s }
  })
}

/**
 * camera 归一化：对象或字符串 → NormalizedCamera（rule-based fallback）
 */
function normalizeCamera(camera: any): NormalizedCamera {
  if (!camera) return {}

  if (typeof camera === 'string') {
    return CAMERA_DEFAULTS[camera] || { shotType: camera, movement: 'static' }
  }

  return {
    shotType: String(camera.shot_type || camera.type || camera.shotType || ''),
    movement: String(camera.movement || ''),
    lens: String(camera.lens || ''),
  }
}

/**
 * environment 归一化
 */
function normalizeEnvironment(env: any): NormalizedEnvironment {
  if (!env) return {}

  if (typeof env === 'string') {
    return { location: env }
  }

  return {
    location: String(env.location || env.spatialFrame || env.name || ''),
    atmosphere: String(env.atmosphere || ''),
    timeOfDay: String(env.time_of_day || env.timeOfDay || ''),
  }
}

/**
 * 确保数组每一项都是字符串
 */
function normalizeStringArray(arr: any): string[] {
  if (!Array.isArray(arr)) return []
  return arr.map(s => String(s)).filter(Boolean)
}

export default normalizeShot
