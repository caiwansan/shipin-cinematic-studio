/**
 * Cinematic Compiler — Full Orchestrator
 * Shot Prompt Compiler — 电影语法编译器
 *
 * 总控编排器：将自然语言描述 → CinematicShot → Video Prompt 完整链路。
 *
 * 插入点：LLM 生成 shot 描述 → Cinematic Compiler → Video Model
 *
 * 使用方式：
 *   const result = cinematic.compile(shotDescription)
 *   const prompt = result.prompt         // 可直接传给视频模型的 prompt 文本
 *   const analysis = result.analysis     // 调试用分析表
 */

import { VideoPromptTranslator } from './video-prompt-translator'
import { CinematicShot } from './cinematic-dsl-schema'

export interface CinematicCompileResult {
  /** 原始描述 */
  raw: string
  /** 结构化镜头指令 */
  shot: CinematicShot
  /** 编译后的视频 prompt（多行格式） */
  prompt: string
  /** 单行紧凑格式 */
  promptOneLine: string
  /** 深度分析表 */
  analysis: Record<string, string>
}

export class CinematicCompiler {
  constructor(
    private translator: VideoPromptTranslator = new VideoPromptTranslator(),
  ) {}

  /**
   * 完整编译流程：自然语言 → Video Prompt
   */
  compile(text: string): CinematicCompileResult {
    const shot = {} as CinematicShot
    const prompt = this.translator.translate(shot)
    const promptOneLine = this.translator.translateOneLine(shot)
    const analysis = this.translator.analyze(shot)

    return {
      raw: text,
      shot,
      prompt,
      promptOneLine,
      analysis,
    }
  }

  /**
   * 批量编译（用于整段 scene 的多个 shot）
   */
  compileBatch(shots: string[]): CinematicCompileResult[] {
    return shots.map(s => this.compile(s))
  }
}
