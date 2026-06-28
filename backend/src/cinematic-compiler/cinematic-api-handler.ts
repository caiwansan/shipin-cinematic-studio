/**
 * Cinematic Compiler API Handler
 */

import { CinematicCompiler } from './cinematic-compiler'
import { traceCollector } from '../replay-engine/director-trace-collector.js'

const compiler = new CinematicCompiler()

export function handleCompile(text: string) {
  try {
    const tid = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    traceCollector.emit('shot', 'SHOT_COMPILE_START', { text: text.slice(0, 50) }, tid)
    const result = compiler.compile(text)
    traceCollector.emit('shot', 'SHOT_COMPILED', { text: text.slice(0, 50), camera: result.camera }, tid)
    return { success: true, result }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export function handleBatchCompile(texts: string[]) {
  try {
    const tid = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    traceCollector.emit('shot', 'BATCH_COMPILE_START', { count: texts.length }, tid)
    const results = compiler.compileBatch(texts)
    results.forEach((r, i) => {
      traceCollector.emit('shot', 'SHOT_COMPILED', { index: i, text: texts[i].slice(0, 50), camera: r.camera }, tid)
    })
    return { success: true, results }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
