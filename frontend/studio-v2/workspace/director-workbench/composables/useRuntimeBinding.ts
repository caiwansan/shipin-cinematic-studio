/**
 * Runtime Binding Adapter
 * Runtime Binding Layer — 运行时绑定适配器
 *
 * 负责调用后端 API 并将结果映射到 DirectorRuntimeStore。
 * 是 UI 和后端五根支柱之间的桥梁。
 */

import { useDirectorRuntimeStore } from '../stores/director-runtime-store'

const API_BASE = 'https://aigc.fushtn.com/api/workbench'

export function useRuntimeBinding() {
  const store = useDirectorRuntimeStore()

  /**
   * 执行完整的导演分析流程
   * 1. compile-shot — 单镜头电影感
   * 2. temporal-analyze — 时间连续性
   * 3. persistence-analyze — 角色一致性
   * 4. grammar-analyze — 镜头语法结构
   * 5. motion-plan — 运动规划
   */
  async function analyzeShots(shotTexts: string[], character?: any) {
    const results: Record<string, any> = {}

    // Step 1: Cinematic Compiler（单镜头）
    try {
      const res = await fetch(`${API_BASE}/compile-shot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shots: shotTexts }),
      })
      const json = await res.json()
      results.compile = json.payload
    } catch (e) {
      console.error('compile-shot failed:', e)
    }

    // Step 2: Temporal Consistency（连续性）
    try {
      const res = await fetch(`${API_BASE}/temporal-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shotTexts }),
      })
      const json = await res.json()
      results.temporal = json.payload
    } catch (e) {
      console.error('temporal-analyze failed:', e)
    }

    // Step 3: Character Persistence（角色一致性）
    if (character) {
      try {
        const res = await fetch(`${API_BASE}/persistence-analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shotTexts, character }),
        })
        const json = await res.json()
        results.persistence = json.payload
      } catch (e) {
        console.error('persistence-analyze failed:', e)
      }
    }

    // Step 4: Grammar（语法结构）
    try {
      const res = await fetch(`${API_BASE}/grammar-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shotTexts }),
      })
      const json = await res.json()
      results.grammar = json.payload
    } catch (e) {
      console.error('grammar-analyze failed:', e)
    }

    // Step 5: Motion Plan（运动规划）
    if (results.grammar?.result?.annotatedShots) {
      const grammarTypes = results.grammar.result.annotatedShots.map((s: any) => s.grammarType)
      const intensities = shotTexts.map(() => 0.5)
      const tensions = results.grammar.result.emotionalArc?.tensionCurve?.map((p: any) => p.tension / 100) ?? shotTexts.map(() => 0.5)

      try {
        const res = await fetch(`${API_BASE}/motion-plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grammarTypes, intensities, tensions, shotTexts }),
        })
        const json = await res.json()
        results.motion = json.payload
      } catch (e) {
        console.error('motion-plan failed:', e)
      }
    }

    // 映射到 store
    if (results.temporal?.result?.injected) {
      const motionEvents = results.motion?.result?.events ?? []
      store.loadFromApi(
        results.temporal.result.injected.map((item: any, i: number) => ({
          ...item,
          motionStyle: motionEvents[i]?.motionStyle,
          motionDirective: motionEvents[i]?.motionDirective,
          intent: motionEvents[i]?.intent,
          emotionalTension: results.grammar?.result?.emotionalArc?.tensionCurve?.[i]?.tension ?? 50,
          mood: results.grammar?.result?.emotionalArc?.tensionCurve?.[i]?.mood ?? 'calm',
        })),
      )
    }

    // 更新摘要
    store.state.summary = [
      results.grammar?.result?.summary,
      results.temporal?.result?.summary,
      results.motion?.result?.timeline,
      results.persistence?.result?.summary,
    ].filter(Boolean).join('\n\n')

    return results
  }

  /**
   * 仅分析语法 + 运动（快速版本）
   */
  async function quickAnalyze(shotTexts: string[]) {
    return analyzeShots(shotTexts)
  }

  return { analyzeShots, quickAnalyze }
}
