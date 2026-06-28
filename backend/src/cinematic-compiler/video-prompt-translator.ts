/**
 * Video Prompt Translator
 * Shot Prompt Compiler — 电影语法编译器
 *
 * 将 CinematicShot 编译为视频模型可理解的统一 prompt 文本。
 * 不同视频模型对 prompt 格式要求不同，此层作为统一输出格式。
 *
 * 输出风格：
 *   - 摄影语言优先（camera → framing → lighting → motion）
 *   - 每个维度一行，格式统一
 *   - 不包含 LLM 风格的文学性描述
 *   - 保持原始场景描述作为基础
 */

import { CinematicShot } from './cinematic-dsl-schema'

export class VideoPromptTranslator {
  /**
   * 将 CinematicShot 编译为统一文本 prompt
   */
  translate(shot: CinematicShot): string {
    const parts: string[] = []

    // 1. 场景描述（原始）
    parts.push(`Scene: ${shot.raw}`)

    // 2. 摄影指令
    parts.push(`Camera: ${shot.camera.type}, ${shot.camera.lens} lens, ${shot.camera.movement}`)

    // 3. 构图
    parts.push(`Framing: ${shot.composition.framing} — ${shot.composition.depth} depth, ${shot.composition.symmetry} composition`)

    // 4. 光照
    parts.push(`Lighting: ${shot.lighting.type}, ${shot.lighting.direction} light, ${shot.lighting.colorTone} tone`)

    // 5. 运动
    const motionStr = shot.motion.handheld
      ? `${shot.motion.speed}, handheld, subject ${shot.motion.subjectMotion}`
      : `${shot.motion.speed}, subject ${shot.motion.subjectMotion}`
    parts.push(`Motion: ${motionStr}`)

    // 6. 氛围
    parts.push(`Mood: ${shot.mood}`)

    return parts.join('\n')
  }

  /**
   * 编译为单行长文本（适用于某些模型对换行敏感的情况）
   */
  translateOneLine(shot: CinematicShot): string {
    return [
      shot.raw,
      `[camera:${shot.camera.type}/${shot.camera.lens}/${shot.camera.movement}]`,
      `[framing:${shot.composition.framing}/${shot.composition.depth}]`,
      `[lighting:${shot.lighting.type}/${shot.lighting.direction}/${shot.lighting.colorTone}]`,
      `[motion:${shot.motion.speed}/${shot.motion.subjectMotion}${shot.motion.handheld ? '/handheld' : ''}]`,
      `[mood:${shot.mood}]`,
    ].join(' ')
  }

  /**
   * 获取深度分析（用于日志/调试）
   */
  analyze(shot: CinematicShot): Record<string, string> {
    return {
      '原始描述': shot.raw,
      '摄影机类型': shot.camera.type,
      '焦距': shot.camera.lens,
      '运镜': shot.camera.movement,
      '机位高度': shot.camera.height,
      '景别': shot.composition.framing,
      '景深': shot.composition.depth,
      '构图': shot.composition.symmetry,
      '光照类型': shot.lighting.type,
      '光照方向': shot.lighting.direction,
      '色温': shot.lighting.colorTone,
      '运动速度': shot.motion.speed,
      '被摄体运动': shot.motion.subjectMotion,
      '手持': shot.motion.handheld ? '是' : '否',
      '情绪': shot.mood,
    }
  }
}
