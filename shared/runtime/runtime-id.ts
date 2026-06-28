/**
 * Runtime ID Constitution
 *
 * 全系统运行时唯一标识符生成规则。
 * 规则：可读前缀 + 三位数字序号
 *
 * 禁止 UUID。
 * 禁止随机字符串。
 * 保证可读性。
 */

let charCounter = 0
let sceneCounter = 0
let segmentCounter = 0
let propCounter = 0
let storyboardCounter = 0

export function resetCounters(): void {
  charCounter = 0
  sceneCounter = 0
  segmentCounter = 0
  propCounter = 0
  storyboardCounter = 0
}

export function generateCharacterId(): string {
  charCounter++
  return `char_${String(charCounter).padStart(3, '0')}`
}

export function generateSceneId(): string {
  sceneCounter++
  return `scene_${String(sceneCounter).padStart(3, '0')}`
}

export function generateSegmentId(): string {
  segmentCounter++
  return `seg_${String(segmentCounter).padStart(3, '0')}`
}

export function generatePropId(): string {
  propCounter++
  return `prop_${String(propCounter).padStart(3, '0')}`
}

export function generateStoryboardId(): string {
  storyboardCounter++
  return `sb_${String(storyboardCounter).padStart(3, '0')}`
}

/**
 * 从脚本内容解析后批量生成 ID。
 * 每次调用 generateAllIds 会重置计数器。
 */
export function generateAllIds(
  charCount: number,
  sceneCount: number,
  segmentCount: number,
  propCount: number
): {
  characterIds: string[]
  sceneIds: string[]
  segmentIds: string[]
  propIds: string[]
} {
  resetCounters()
  return {
    characterIds: Array.from({ length: charCount }, () => generateCharacterId()),
    sceneIds: Array.from({ length: sceneCount }, () => generateSceneId()),
    segmentIds: Array.from({ length: segmentCount }, () => generateSegmentId()),
    propIds: Array.from({ length: propCount }, () => generatePropId()),
  }
}
