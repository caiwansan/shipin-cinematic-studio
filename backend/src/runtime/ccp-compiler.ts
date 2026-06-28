/**
 * CCP — Cinematic Compiler（主入口）
 *
 * 四层编译器：CIR → Semantic IR → Provider IR → Prompt
 * 输出 CompileResult（含 Capability Diff、Loss、Score）
 */

import type { CirV1, CompileResult as CR } from './cir-v1.js'
import { compileToSemanticIr } from './ccp-semantic-ir.js'
import { compileToProviderIr } from './ccp-provider-ir.js'
import { renderPrompt, optimizePrompt, buildCompileReport } from './ccp-render.js'
import { VOLCENGINE_CAPS } from './ccp-provider-ir.js'
import type { ProviderCapability, CompileResult } from './ccp-types.js'
import type { CinematicCompiler } from './ccp-types.js'

/**
 * 默认 Volcengine Compiler
 */
export class VolcengineCompiler implements CinematicCompiler {
  capabilities = VOLCENGINE_CAPS

  compile(cir: CirV1): CompileResult {
    // Layer 1: Semantic IR（Provider 无关）
    const semir = compileToSemanticIr(cir)

    // Layer 2: Provider IR（能力映射与降级）
    const providerIR = compileToProviderIr(semir, this.capabilities)

    // Layer 3: Render Prompt
    const { prompt, negativePrompt } = renderPrompt(providerIR, this.capabilities.maxPromptLength)

    // Layer 4: Optimize
    const optimizedPrompt = optimizePrompt(prompt, this.capabilities.maxPromptLength)

    // Build Report
    const report = buildCompileReport(providerIR, cir.shots.length, this.capabilities.maxPromptLength)

    return {
      semanticIR: semir,
      providerIR,
      prompt,
      negativePrompt,
      optimizedPrompt,
      report,
    }
  }
}

/**
 * CIR 编译入口（自动选择 Provider Compiler）
 * 后续可扩展为 Compiler Registry，按 Provider 分发
 */
export function compileCir(cir: CirV1, caps?: ProviderCapability): CompileResult {
  const compiler = new VolcengineCompiler()
  return compiler.compile(cir)
}
