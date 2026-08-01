// ============================================================
// Studio v2 — 全局状态管理（Phase 2: Workspace Runtime）
// Store → Runtime → UI 单向数据流
// Phase 7A: 使用原子类型 factory 函数，消灭 as any
// ============================================================

import { reactive, computed, readonly } from 'vue'
import type {
  PipelineRuntime, PipelineStageId, WorkspaceRuntime, SegmentRuntime, TimelineFrame,
  AssetRuntime, AssetType, AssetEntry,
  NarrativeRuntime, CharacterRuntime, SceneRuntime,
} from '~/studio-v2/types/runtime/index'
import { createEmptyCharacter } from '~/studio-v2/types/runtime/character-runtime'
import { createEmptyScene } from '~/studio-v2/types/runtime/scene-runtime'
import type { PromptRuntime } from '~/studio-v2/runtime/execution/execution-types'
import { createPipelineRuntime, setStageStatus, setActiveStage } from '~/studio-v2/pipeline/studio-pipeline'
import { createEmptyNarrative } from '~/studio-v2/workspace/script-analysis/narrative-types'

// ─── Token helpers ───
function getAuthToken(): string {
  try {
    const nuxtToken = (window as any).__NUXT__?.token
    if (nuxtToken) return nuxtToken
    // Check localStorage under all possible keys (auth_token, accessToken, token)
    const ls = (window as any).localStorage
    if (ls) {
      for (const key of ['auth_token', 'accessToken', 'token']) {
        const val = ls.getItem(key)
        if (val) return val
      }
    }
    return ''
  } catch { return '' }
}

function authHeaders(): Record<string, string> {
  const t = getAuthToken()
  return t ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` } : { 'Content-Type': 'application/json' }
}

/** HTTP 错误码 → 用户友好消息 */
function httpErrorMessage(status: number, defaultMsg: string): string {
  const map: Record<number, string> = {
    400: '请求参数有误，请检查输入',
    401: '登录已过期，请重新登录',
    403: '权限不足',
    404: '请求的资源不存在',
    429: '请求过于频繁，请稍后重试',
    500: '服务器内部错误',
    502: '网关异常',
    503: '服务暂时不可用',
  }
  return map[status] || defaultMsg
}

// ─── State ───

const state = reactive<{
  pipeline: PipelineRuntime
  workspace: WorkspaceRuntime
  assets: AssetRuntime
  activeSegmentIndex: number
  projectId: string
  execution: {
    compiledPrompts: PromptRuntime[]
  }
}>({
  pipeline: createPipelineRuntime(),
  workspace: {
    activeWorkspaceId: 'script-analysis',
    narrative: createEmptyNarrative(),
    characters: [],
    scenes: [],
    segments: [],
  },
  assets: {
    assets: [],
    activeCategory: 'all',
    collapsed: false,
  },
  activeSegmentIndex: -1,
  projectId: '',
  execution: {
    compiledPrompts: [],
  },
})
console.log("[PHASE2] store state.workspace:", state.workspace?.activeWorkspaceId, "narrative:", state.workspace?.narrative?.projectName)

console.log("[PHASE2] store init check: state.workspace?", !!state.workspace, "narrative?", !!state.workspace?.narrative, "projectName:", state.workspace?.narrative?.projectName)
// ─── Getters ───

const activeStage = computed(() =>
  state.pipeline.stages.find(s => s.id === state.pipeline.activeStageId)
)

const activeWorkspace = computed(() => state.workspace.activeWorkspaceId)

// 🟢 PHASE2: verify store init immediately after reactive
console.log("[PHASE2] store state.workspace:", state.workspace)
console.log("[PHASE2] store projectName:", state.workspace?.narrative?.projectName)

// ─── (keep existing getter)
const filteredAssets = computed

export function useStudioStore() {
  // Pipeline
  function goToStage(stageId: PipelineStageId) {
    state.pipeline = setActiveStage(state.pipeline, stageId)
    state.workspace.activeWorkspaceId = stageId
  }

  async function updateStageStatus(
    stageId: PipelineStageId,
    status: 'idle' | 'running' | 'completed' | 'error',
    extra?: { progress?: number; error?: string }
  ) {
    state.pipeline = setStageStatus(state.pipeline, stageId, status, extra)

    // ⚠️ 同步到后端 pipeline_stages 表
    // 带 3 次重试，成功前持续等待
    if (state.projectId) {
      const token = getAuthToken()
      if (token) {
        const body = JSON.stringify({
          status: status === 'completed' ? 'done' :
                  status === 'error' ? 'error' :
                  status === 'running' ? 'running' :
                  status === 'idle' ? 'pending' : status,
          ...(extra?.error ? { error: extra.error } : {}),
        })
        // 幂等重试：最多 3 次，间隔 500ms
        for (let retry = 0; retry < 3; retry++) {
          try {
            const res = await fetch(`/api/pipeline/stage/${state.projectId}/${stageId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body,
            })
            if (res.ok) break
            throw new Error(`status=${res.status}`)
          } catch (e: any) {
            if (retry < 2) {
              await new Promise(r => setTimeout(r, 500 * (retry + 1)))
            } else {
              console.warn(`[StageSync] ${stageId}: 同步失败（重试3次）`, e.message)
            }
          }
        }
      }
    }
  }

  // Narrative
  function updateNarrative(patch: Partial<NarrativeRuntime>) {
    Object.assign(state.workspace.narrative, patch)
  }

  function setNarrative(narrative: NarrativeRuntime) {
    state.workspace.narrative = narrative
  }

  // 视频风格 & 画面比例
  const videoStyle = computed(() => state.workspace.narrative.videoStyle || '3d')
  const aspectRatio = computed(() => state.workspace.narrative.aspectRatio || '9:16')
  const styleLocked = computed(() => state.workspace.narrative.styleLocked === true)

  function setVideoStyle(style: string) {
    state.workspace.narrative.videoStyle = style
  }
  function setAspectRatio(ratio: string) {
    state.workspace.narrative.aspectRatio = ratio
  }
  function toggleStyleLock() {
    state.workspace.narrative.styleLocked = !state.workspace.narrative.styleLocked
  }

  // Characters
  function setCharacters(characters: CharacterRuntime[]) {
    state.workspace.characters = characters
  }

  function addCharacter(seed?: Partial<CharacterRuntime>) {
    const ch = createEmptyCharacter(seed)
    state.workspace.characters.push(ch)
    return ch.id
  }

  function updateCharacter(id: string, patch: Partial<CharacterRuntime>) {
    const idx = state.workspace.characters.findIndex(c => c.id === id)
    if (idx >= 0) {
      state.workspace.characters[idx] = { ...state.workspace.characters[idx], ...patch }
    }
  }

  // Scenes
  function setScenes(scenes: SceneRuntime[]) {
    state.workspace.scenes = scenes
  }

  function addScene(seed?: Partial<SceneRuntime>) {
    const sc = createEmptyScene(seed)
    state.workspace.scenes.push(sc)
    return sc.id
  }

  function updateScene(id: string, patch: Partial<SceneRuntime>) {
    const idx = state.workspace.scenes.findIndex(s => s.id === id)
    if (idx >= 0) {
      state.workspace.scenes[idx] = { ...state.workspace.scenes[idx], ...patch }
    }
  }

  // Segments
  function setActiveSegment(index: number) {
    state.activeSegmentIndex = index
  }

  function setSegments(segments: SegmentRuntime[]) {
    state.workspace.segments = segments
  }

  function updateSegment(segmentId: string, patch: Partial<SegmentRuntime>) {
    const idx = state.workspace.segments.findIndex(s => s.id === segmentId)
    if (idx >= 0) {
      state.workspace.segments[idx] = { ...state.workspace.segments[idx], ...patch }
    }
  }

  function updateTimelineFrame(segmentId: string, second: number, field: keyof TimelineFrame, value: any) {
    const seg = state.workspace.segments.find(s => s.id === segmentId)
    if (!seg) return
    const frame = seg.timeline.find(t => t.second === second)
    if (frame) {
      ;(frame as any)[field] = value
    }
  }

  // Assets
  function setAssets(assets: AssetEntry[]) {
    state.assets.assets = assets
  }

  function addAsset(asset: AssetEntry) {
    state.assets.assets.push(asset)
  }

  function removeAsset(assetId: string) {
    state.assets.assets = state.assets.assets.filter(a => a.id !== assetId)
  }

  function setAssetCategory(category: AssetType | 'all') {
    state.assets.activeCategory = category
  }

  function toggleAssetSidebar() {
    state.assets.collapsed = !state.assets.collapsed
  }

  // Execution
  function setCompiledPromptSegments(prompts: PromptRuntime[]) {
    state.execution.compiledPrompts = prompts
  }

  function addCompiledPrompt(prompt: PromptRuntime) {
    const idx = state.execution.compiledPrompts.findIndex(p => p.segmentId === prompt.segmentId)
    if (idx >= 0) {
      state.execution.compiledPrompts[idx] = prompt
    } else {
      state.execution.compiledPrompts.push(prompt)
    }
  }

  // Project
  function setProjectId(id: string) {
    state.projectId = id
  }

  // ─── Saving Lock ───
  // 防止并发 saveToServer/loadFromServer 写覆盖
  let _savingLock = false
  let _savingQueue: Array<() => void> = []

  /** 保存当前项目到服务器（新建或更新） */
  async function saveToServer(): Promise<string | null> {
    const narr = state.workspace.narrative
    if (!narr.projectName?.trim() && !narr.script?.trim()) {
      console.warn('[saveToServer] 项目名称和剧本都为空，跳过')
      return null
    }

    // ⭐ 保存锁：排队等待，避免竞态
    if (_savingLock) {
      console.warn('[saveToServer] ⏳ 等待上一次保存完成...')
      await new Promise<void>(resolve => _savingQueue.push(resolve))
    }
    _savingLock = true

    try {
      // ⭐ 生成快照（在异步前捕获当前状态，保证一致性）
      const snapshot = {
        projectName: narr.projectName,
        projectDesc: narr.projectDesc,
        script: narr.script,
        segments: JSON.parse(JSON.stringify(state.workspace.segments)),
        scenes: JSON.parse(JSON.stringify(state.workspace.scenes)),
        videoStyle: state.workspace.narrative.videoStyle,
        aspectRatio: state.workspace.narrative.aspectRatio,
        styleLocked: state.workspace.narrative.styleLocked,
        completedStages: state.pipeline.stages
          .filter(s => s.status === 'completed')
          .map(s => s.id),
      }

      if (state.projectId) {
        // 更新已有项目
        const res = await fetch(`/api/v2/workbench/project/${state.projectId}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({
            projectName: snapshot.projectName,
            projectDesc: snapshot.projectDesc,
            script: snapshot.script,
            executionResults: {
              // ⭐ SSOT 契约（SHORTDRAMA-DATA-SSOT）：
              //    AI 分析事实 → ai_video_segments 表（后端 artifact-sync 写入）
              //    用户编辑事实 → executionResults.userEdits（此处写入，刷新后 loadFromServer 合并）
              userEdits: {
                segments: snapshot.segments,
              },
              workspaceScenes: snapshot.scenes,
              videoStyle: snapshot.videoStyle,
              aspectRatio: snapshot.aspectRatio,
              styleLocked: snapshot.styleLocked,
              pipelineCompletedStages: snapshot.completedStages,
            },
          }),
        })
        if (!res.ok) throw new Error(`更新项目失败: ${res.status} - ${httpErrorMessage(res.status, '')}`)
        const json = await res.json()
        return json.data?.id || state.projectId
      } else {
        // 新建项目
        const res = await fetch('/api/v2/workbench/project', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            projectName: snapshot.projectName || '未命名项目',
            projectDesc: snapshot.projectDesc || '',
            script: snapshot.script || '',
          }),
        })
        if (!res.ok) throw new Error(`创建项目失败: ${res.status} - ${httpErrorMessage(res.status, '')}`)
        const json = await res.json()
        if (json.data?.id) {
          state.projectId = json.data.id
        }
        return state.projectId
      }
    } catch (err: any) {
      console.error('[saveToServer]', err.message)
      return null
    } finally {
      _savingLock = false
      // ⭐ 唤醒排队中的下一次保存
      const next = _savingQueue.shift()
      if (next) next()
    }
  }

  /** 从服务器全量加载项目 */
  async function loadFromServer(projectId: string): Promise<boolean> {
    // ⭐ Fetch-First-Then-Commit 模式
    // 1. 先 fetch
    // 2. 验证数据完整性
    // 3. 将数据解析到临时变量
    // 4. 最后一次性 commit 到 state
    // 避免旧代码先 Clear() 后 fetch() 导致的空白页风险

    try {
      const res = await fetch(`/api/v2/workbench/project/${projectId}`, {
        headers: authHeaders(),
      })
      if (res.status === 404) {
        // ⭐ 404 时才清除 projectId，不影响当前工作区
        console.warn('[loadFromServer] 项目不存在:', projectId)
        state.projectId = ''
        return false
      }
      if (!res.ok) throw new Error(`加载项目失败: ${res.status} - ${httpErrorMessage(res.status, '')}`)
      const json = await res.json()
      if (!json.success || !json.data) throw new Error('加载数据为空')

      const p = json.data
      state.projectId = p.id

      // 回填剧本
      const rawScript = p.script || p.executionResults?.rawScript || ''

      // ─── 从 aiCharacterSpecs 恢复角色引用信息 ───
      const charRefs: any[] = []
      if (p.aiCharacterSpecs?.length) {
        for (const spec of p.aiCharacterSpecs) {
          charRefs.push({
            id: spec.characterName,
            name: spec.characterName,
            description: spec.physicalDescription || '',
            imagePrompt: spec.imagePrompt || '',
            appearance: spec.physicalDescription || '',
            clothing: spec.clothing || '',
            gender: spec.gender || '',
            age: spec.age || '',
            role: p.executionResults?.analyzeV2Data?.normalized?.characters?.find((c: any) => c.name === spec.characterName)?.role || '',
            voiceType: p.executionResults?.analyzeV2Data?.normalized?.characters?.find((c: any) => c.name === spec.characterName)?.voiceType || '',
          })
        }
      }
      // ⭐ 统一提取 executionResults 中的角色数据（在函数作用域声明，后续多处使用）
      const erChars = p.executionResults?.characters || p.executionResults?.characterSpecs || []

      // ⭐ fallback: 从 executionResults.characters 恢复（当 artifact sync 未完成时）
      if (charRefs.length === 0 && erChars.length > 0) {
        for (const ch of erChars) {
          charRefs.push({
            id: ch.name || ch.characterName || `char_${charRefs.length}`,
            name: ch.name || ch.characterName || '',
            description: ch.description || ch.personality || ch.physicalDescription || '',
            imagePrompt: ch.imagePrompt || '',
            appearance: ch.physicalDescription || ch.description || '',
            clothing: ch.clothing || ch.costume || '',
            gender: ch.gender || '',
            age: ch.age || '',
            role: ch.role || '',
            voiceType: ch.voiceType || '',
          })
        }
      }

      // ─── 从 aiSceneSpecs 恢复场景引用信息 ───
      const sceneRefs: any[] = []
      if (p.aiSceneSpecs?.length) {
        // ⭐ 从 analyzeV2Data.normalized 获取场景的补充字段（environment/lighting/colorTone/mood/timeOfDay）
        const v2SceneMap = new Map<string, any>()
        const v2Scenes = p.executionResults?.analyzeV2Data?.normalized?.scenes || []
        for (const s of v2Scenes) {
          if (s.name) v2SceneMap.set(s.name, s)
        }
        for (const spec of p.aiSceneSpecs) {
          const v2 = v2SceneMap.get(spec.sceneName)
          sceneRefs.push({
            id: spec.sceneId || spec.sceneName,
            name: spec.sceneName || '',
            description: spec.description || '',
            imagePrompt: spec.imagePrompt || '',
            localImagePrompt: spec.imagePrompt || spec.description || '',
            environment: v2?.environment || spec.environment || '',
            lighting: v2?.lighting || spec.lighting || '',
            colorTone: v2?.colorTone || spec.colorTone || '',
            mood: v2?.mood || spec.mood || '',
            timeOfDay: v2?.timeOfDay || spec.timeOfDay || '',
          })
        }
      }
      // ⭐ fallback: 从 executionResults.sceneSpecs 恢复（当 artifact sync 未完成时）
      if (sceneRefs.length === 0 && p.executionResults?.sceneSpecs?.length) {
        for (const sc of p.executionResults.sceneSpecs) {
          sceneRefs.push({
            id: sc.name || `scene_${sceneRefs.length}`,
            name: sc.name || '',
            description: sc.visualDescription || sc.description || sc.mood || '',
            imagePrompt: sc.visualDescription || '',
            localImagePrompt: '',
            environment: sc.environment?.location || sc.environment || sc.name || '',
            lighting: sc.lighting || sc.environment?.lighting || '',
            colorTone: sc.colorPalette || sc.colorTone || '',
            mood: sc.mood || sc.atmosphere || '',
            timeOfDay: sc.environment?.timeOfDay || sc.timeOfDay || '',
          })
        }
      }

      // ─── 从 aiVideoSegments 恢复 beats（分镜段落） ───
      const beats: any[] = []
      if (p.aiVideoSegments?.length) {
        for (const seg of p.aiVideoSegments) {
          let scenes: string[] = []
          try {
            if (seg.associatedScenes) scenes = JSON.parse(seg.associatedScenes)
          } catch {}
          beats.push({
            id: seg.segmentId,
            index: seg.sortOrder,
            title: seg.title || `段落 ${seg.sortOrder + 1}`,
            subject: '',
            action: '',
            emotion: seg.emotionArc || 'calm',
            intensity: 0.5,
            summary: seg.title || '',
            duration: seg.duration || 10,
            scenes,
            masterBeat: seg.emotionArc || '',
            narrativePurpose: seg.narrativePurpose || '',
            fullText: seg.fullText || '',
          })
        }
      }
      // ⭐ fallback: aiVideoSegments 为空时从 plotBlueprint.segments 恢复
      if (beats.length === 0 && p.executionResults?.plotBlueprint?.segments?.length) {
        for (const seg of p.executionResults.plotBlueprint.segments) {
          let scenes: string[] = []
          try {
            if (seg.associatedScenes) scenes = JSON.parse(seg.associatedScenes)
          } catch {}
          beats.push({
            id: seg.segmentId,
            index: seg.sortOrder || beats.length,
            title: seg.title || `段落 ${beats.length + 1}`,
            subject: '',
            action: '',
            emotion: seg.emotionArc || 'calm',
            intensity: 0.5,
            summary: seg.title || '',
            duration: seg.duration || 10,
            scenes,
            masterBeat: seg.emotionArc || '',
            narrativePurpose: seg.narrativePurpose || '',
            fullText: seg.script || seg.visualContent || seg.fullText || '',
          })
        }
      }

      // ⭐ SSOT 契约（SHORTDRAMA-DATA-SSOT）:
      //    用户编辑事实 executionResults.userEdits.segments 覆盖 AI 表数据（按 id/segmentId 匹配）
      const userEdits = p.executionResults?.userEdits?.segments
      if (Array.isArray(userEdits) && userEdits.length > 0) {
        for (const edit of userEdits) {
          const editId = edit.id || edit.segmentId
          const idx = beats.findIndex(b => b.id === editId)
          if (idx >= 0) {
            // 合并用户编辑到 AI 段落（用户修改优先，但保留 AI 基础字段）
            beats[idx] = {
              ...beats[idx],
              ...edit,
              id: beats[idx].id,
              index: beats[idx].index,
            }
          } else {
            // 表数据不存在但用户编辑过（如 AI 重分析后表被重建）→ 直接恢复用户编辑段落
            beats.push({
              id: editId || `seg_${Date.now()}`,
              index: edit.index ?? beats.length,
              title: edit.title || `段落 ${beats.length + 1}`,
              subject: edit.subject || '',
              action: edit.action || '',
              emotion: edit.emotion || 'calm',
              intensity: edit.intensity ?? 0.5,
              summary: edit.summary || edit.title || '',
              duration: edit.duration || 10,
              scenes: edit.scenes || [],
              masterBeat: edit.masterBeat || edit.emotionArc || '',
              narrativePurpose: edit.narrativePurpose || '',
              fullText: edit.fullText || '',
              videoUrl: edit.videoUrl || '',
            })
          }
        }
      }

      // ⭐ 从 aiVideoSegments 回填视频/帧 URL（worker 完成后写入表，刷新后必须恢复）
      if (p.aiVideoSegments?.length) {
        const segUrlMap = new Map<string, any>()
        for (const seg of p.aiVideoSegments) {
          segUrlMap.set(seg.segmentId, seg)
        }
        for (const b of beats) {
          const segRow = segUrlMap.get(b.id)
          if (segRow) {
            if (segRow.videoUrl) b.videoUrl = segRow.videoUrl
            if (segRow.firstFrameUrl) b.firstFrameUrl = segRow.firstFrameUrl
            if (segRow.midFrameUrl) b.midFrameUrl = segRow.midFrameUrl
            if (segRow.lastFrameUrl) b.lastFrameUrl = segRow.lastFrameUrl
          }
        }
      }

      // ─── 恢复 narrative（保留已有 videoStyle / aspectRatio）───
      state.workspace.narrative = {
        script: rawScript,
        title: p.name || '',
        projectName: p.name || '',
        projectDesc: p.description || '',
        characters: charRefs,
        scenes: sceneRefs,
        emotionCurve: beats.length > 0
          ? beats.map((b: any, i: number) => ({
              timeIndex: i,
              emotion: b.emotion || 'calm',
              intensity: b.intensity || 0.5,
            }))
          : (p.executionResults?.effectSpecs || []).map((ef: any, i: number) => ({
              timeIndex: i,
              emotion: ef.effectName || ef.notes?.substring(0,30) || `特效 ${i+1}`,
              intensity: 1.0,
              effectType: ef.transition || ef.shotType || ef.vfxRequired || '',
              visualDescription: ef.vfxDescription || ef.composition || ef.notes || '',
              colorPalette: ef.lighting || '',
            })),
        beats,
        // ⭐ 从 executionResults 恢复道具/音色/特效/情绪/对白数据
        props: (function mergeProps() {
          // 优先用 propImages（有 imageUrl）
          const pImgs: any[] = p.propImages || []
          // 从 executionResults.propSpecs 获取 character/characterName 信息
          const propSpecs: any[] = (p.executionResults && p.executionResults.propSpecs) || []
          const specMap = new Map<string, any>()
          for (const ps of propSpecs) {
            const key = ps.propName || ps.name || ''
            if (key) specMap.set(key, ps)
          }
          if (pImgs.length > 0) {
            return pImgs.map(function(pi: any, i: number) {
              const spec = specMap.get(pi.propName) || {}
              return {
                id: 'prop_load_' + i,
                name: pi.propName || '道具 ' + (i + 1),
                category: pi.category || '通用',
                description: pi.description || spec.description || '',
                imageUrl: pi.imageUrl || '',
                imagePrompt: spec.imagePrompt || {},
                character: spec.character || (Array.isArray(spec.character_names) ? spec.character_names.join(', ') : '') || (Array.isArray(pi.character_names) ? pi.character_names.join(', ') : '') || '',
                characterName: spec.characterName || spec.character || (Array.isArray(spec.character_names) ? spec.character_names.join(', ') : '') || '',
              }
            })
          }
          // Fallback: 从 propSpecs 恢复（无 imageUrl）
          return propSpecs.map(function(pr: any, i: number) {
            return {
              id: 'pr_load_' + i,
              name: pr.propName || pr.name || '道具 ' + (i + 1),
              category: pr.category || '通用',
              description: pr.description || '',
              imageUrl: '',
              character: pr.character || (Array.isArray(pr.character_names) ? pr.character_names.join(', ') : '') || '',
              characterName: pr.characterName || pr.character || '',
            }
          })
        })(),
        voices: (p.executionResults?.voiceConfigs || []).map((vc: any, i: number) => ({
          id: `vc_load_${i}`,
          characterName: vc.characterName || vc.character || `角色 ${i + 1}`,
          voiceType: vc.voiceType || '默认',
          pitch: vc.pitch || 1.0,
          speed: vc.speed || 1.0,
          description: vc.description || '',
        })),
        effects: (p.executionResults?.effectSpecs || []).map((ef: any, i: number) => ({
          id: `ef_load_${i}`,
          name: ef.effectName || ef.name || `特效 ${i + 1}`,
          type: ef.type || 'visual',
          description: ef.description || '',
          intensity: ef.intensity || 0.5,
          timing: ef.timing || '',
        })),
        emotionSpecs: ((() => { 
          const er_es = p.executionResults?.emotionSpecs || []; 
          if (er_es.length) return er_es; 
          const pb_segs = p.executionResults?.plotBlueprint?.segments || []; 
          const pb_es = pb_segs.flatMap((s: any) => (s.emotionSpecs || []).map((es: any, ei: number) => ({ segmentIndex: ei, segmentName: s.title, ...es }))); 
          if (pb_es.length) return pb_es
          // ⭐ fallback: 从 videoSegments 提取 emotionArc
          const vs = p.executionResults?.videoSegments || []
          return vs.map((seg: any, i: number) => ({
            segmentIndex: i,
            segmentName: seg.title || seg.segmentId || `段落 ${i+1}`,
            emotion: seg.emotionArc || seg.emotionalTone || '',
            intensity: seg.emotionIntensity || 0.5,
          }))
        })()).map((es: any, i: number) => ({
          id: `es_load_${i}`,
          characterName: es.characterName || `角色 ${i + 1}`,
          emotion: es.emotion || 'calm',
          intensity: es.intensity || 0.5,
          duration: es.duration || 0,
          transition: es.transition || 'fade',
        })),
        dialogues: ((() => { const d = p.executionResults?.dialogues || p.executionResults?.dialogueSpecs || []; if (d.length) return d; const pb = p.executionResults?.plotBlueprint?.segments || []; return pb.flatMap((s: any) => (s.dialogues || []).map((dl: any, di: number) => ({ ...dl, segmentId: dl.segmentId || s.segmentId }))); })()).map((dl: any, i: number) => ({
          id: `dl_load_${i}`,
          segmentId: dl.segmentId || '',
          lineIndex: dl.lineIndex || i,
          speaker: dl.speaker || '',
          text: dl.text || '',
          tone: dl.tone || 'normal',
          timing: dl.timing || 0,
        })),
        // ⭐ 从 aiVideoSegments 表恢复 videoSegments（分镜维度的渲染数据）
        videoSegments: p.aiVideoSegments?.length
          ? p.aiVideoSegments.map((seg: any, i: number) => ({
              segmentId: seg.segmentId,
              title: seg.title || `段落 ${i + 1}`,
              duration: seg.duration || 8,
              narrativePurpose: seg.narrativePurpose || seg.narrative || '',
              fullText: seg.fullText || seg.narrative || '',
              shotPattern: seg.shotPattern || '',
              emotionArc: seg.emotionArc || seg.emotionalTone || '',
              backgroundMusic: seg.backgroundMusic || '',
              sortOrder: seg.sortOrder || i,
            }))
          : p.executionResults?.videoSegments?.length
            ? p.executionResults.videoSegments.map((seg: any, i: number) => ({
                segmentId: seg.segmentId || `seg_${i}`,
                title: seg.title || `段落 ${i + 1}`,
                duration: seg.duration || 8,
                narrativePurpose: seg.narrativePurpose || seg.narrative || '',
                fullText: seg.fullText || seg.narrative || '',
                shotPattern: seg.shotPattern || seg.cameraAngle || '',
                emotionArc: seg.emotionArc || seg.emotionalTone || '',
                backgroundMusic: '',
                sortOrder: seg.sortOrder || seg.segmentNumber || i,
              }))
            : [],
      }

      // ⭐ 从 executionResults 恢复视频风格（优先于内存默认值）
      const er = p.executionResults || {}
      if (er.videoStyle) state.workspace.narrative.videoStyle = er.videoStyle
      if (er.aspectRatio) state.workspace.narrative.aspectRatio = er.aspectRatio
      if (er.styleLocked !== undefined) state.workspace.narrative.styleLocked = er.styleLocked === true

      // ⭐ fallback: 从 executionResults.characterSpecs 恢复（当 DB 表为空时）
      if (!p.characterImages?.length && !p.aiCharacterSpecs?.length && erChars.length > 0) {
        state.workspace.characters = erChars.map((c: any) => {
          const app = c.appearance || {}
          const desc = [
            app.height,
            app.build,
            app.hairStyle,
            app.eyeColor ? app.eyeColor + '眼睛' : '',
            app.clothing,
            app.distinctiveFeatures,
          ].filter(Boolean).join('，')
          return {
            id: `char_er_${c.name}`,
            name: c.name || '',
            description: desc || c.description || '',
            personality: Array.isArray(c.personality) ? c.personality.slice(0, 3).join('，') : '',
            clothing: app.clothing || '',
            props: '',
            appearance: desc,
            physicalDescription: desc,
            expressionSet: [],
            locked: false,
            voiceRef: '',
            relationships: c.relationships || [],
            imageUrl: '',
            imagePrompt: '',
          }
        })
      } else if (p.characterImages?.length) {
        const charMap = new Map(p.aiCharacterSpecs?.map((s: any) => [s.characterName, s]) || [])
        // ⭐ 按角色分组，优先取 front > face_ref > null/其它 > makeup 的图片
        const bestPerChar = new Map<string, any>()
        const variantPriority: Record<string, number> = { 'front': 0, 'face_ref': 1, '': 2, 'null': 2 }
        for (const ci of p.characterImages) {
          const name = ci.characterName
          const existing = bestPerChar.get(name)
          const curPriority = variantPriority[ci.variant || ''] ?? (ci.variant === 'makeup' ? 10 : 3)
          const exPriority = existing ? (variantPriority[existing.variant || ''] ?? (existing.variant === 'makeup' ? 10 : 3)) : 99
          if (!existing || curPriority < exPriority) {
            bestPerChar.set(name, ci)
          }
        }
        const imaged = new Set(p.characterImages.map((ci: any) => ci.characterName))
        const fromImages = Array.from(bestPerChar.values()).map((ci: any) => {
          const spec = charMap.get(ci.characterName)
          const imgUrl = ci.imageUrl?.includes('volces.com') ? '/api/proxy/image?url=' + encodeURIComponent(ci.imageUrl) : ci.imageUrl
          return {
            id: `char_cos_${ci.characterName}_${ci.id}`,
            name: ci.characterName,
            description: spec?.physicalDescription || '',
            personality: '',
            clothing: spec?.clothing || '',
            props: '',
            appearance: spec?.physicalDescription || '',
            physicalDescription: spec?.physicalDescription || '',
            gender: spec?.gender || '',
            age: spec?.age || '',
            expressionSet: [],
            locked: false,
            voiceRef: '',
            relationships: [],
            imageUrl: imgUrl,
            imagePrompt: spec?.imagePrompt || '',
          }
        })
        // ⭐ 补充 aiCharacterSpecs 中未生成图片的角色
        const fromSpecs: any[] = []
        if (p.aiCharacterSpecs) {
          for (const spec of p.aiCharacterSpecs) {
            if (!imaged.has(spec.characterName)) {
              fromSpecs.push({
                id: `char_spec_${spec.characterName}`,
                name: spec.characterName,
                description: spec.physicalDescription || '',
                personality: '',
                clothing: spec.clothing || '',
                props: '',
                appearance: spec.physicalDescription || '',
                physicalDescription: spec.physicalDescription || '',
                gender: spec.gender || '',
                age: spec.age || '',
                expressionSet: [],
                locked: false,
                voiceRef: '',
                relationships: [],
                imageUrl: '',
                imagePrompt: spec.imagePrompt || '',
              })
            }
          }
        }
        state.workspace.characters = [...fromImages, ...fromSpecs]
      } else {
        state.workspace.characters = charRefs.map((r: any) => ({
          id: r.id,
          name: r.name,
          description: r.description || '',
          personality: '',
          clothing: r.clothing || '',
          props: '',
          appearance: r.description || '',
          physicalDescription: r.description || '',
          expressionSet: [],
          locked: false,
          voiceRef: '',
          relationships: [],
          imageUrl: '',
          imagePrompt: r.imagePrompt || '',
          localImagePrompt: r.imagePrompt || '',
        }))
      }

      // ─── 回填场景图片（带 spec 信息） ───
      const sceneMap = new Map(p.aiSceneSpecs?.map((s: any) => [s.sceneName, s]) || [])
      if (p.sceneImages?.length) {
        state.workspace.scenes = p.sceneImages.map((si: any) => {
          const spec = sceneMap.get(si.sceneName)
          const imgUrl = si.imageUrl?.includes('volces.com') ? '/api/proxy/image?url=' + encodeURIComponent(si.imageUrl) : si.imageUrl
          return {
            id: `scene_cos_${si.sceneName}_${si.id}`,
            name: si.sceneName || '',
            environment: spec?.environment || spec?.description || '',
            lighting: spec?.lighting || '',
            weather: spec?.weather || '',
            timeOfDay: spec?.timeOfDay || '',
            colorTone: spec?.colorTone || spec?.colorPalette || '',
            mood: spec?.mood || '',
            description: spec?.description || '',
            locked: false,
            imageUrl: imgUrl,
            imagePrompt: spec?.imagePrompt || '',
            localImagePrompt: spec?.imagePrompt || spec?.description || '',
            type: '',
          }
        })
      } else {
        state.workspace.scenes = sceneRefs.map((r: any) => {
          const spec = sceneMap.get(r.name)
          return {
            id: r.id,
            name: r.name,
            environment: spec?.environment || r.description || '',
            lighting: spec?.lighting || '',
            weather: spec?.weather || '',
            timeOfDay: spec?.timeOfDay || '',
            colorTone: spec?.colorTone || spec?.colorPalette || '',
            mood: spec?.mood || '',
            description: r.description || '',
            locked: false,
            imageUrl: '',
            imagePrompt: r.imagePrompt || '',
            localImagePrompt: r.imagePrompt || r.description || '',
            type: '',
          }
        })
      }

      // ⭐ 合并 workspaceScenes（保留用户编辑，但不覆盖 V3 拆解的六维字段）
      if (er.workspaceScenes?.length) {
        const wsScenes = er.workspaceScenes.map((ws: any) => {
          // 查找对应的 V3 拆解场景数据
          const spec = sceneMap.get(ws.name) || sceneMap.get(ws.sceneName)
          return {
            id: ws.id,
            name: ws.name || '',
            environment: ws.environment || spec?.environment || '',
            lighting: ws.lighting || spec?.lighting || '',
            weather: ws.weather || spec?.weather || '',
            timeOfDay: ws.timeOfDay || spec?.timeOfDay || '',
            colorTone: ws.colorTone || spec?.colorTone || spec?.colorPalette || ws.atmosphere || '',
            mood: ws.mood || spec?.mood || '',
            description: ws.description || spec?.description || '',
            locked: ws.locked || false,
            imageUrl: ws.imageUrl || '',
            imagePrompt: ws.imagePrompt || spec?.imagePrompt || '',
            localImagePrompt: ws.localImagePrompt || ws.imagePrompt || spec?.imagePrompt || spec?.description || '',
            type: ws.type || '',
          }
        })
        state.workspace.scenes = wsScenes
      }

      // ─── 回填 segments（优先用 aiVideoSegments，没有则从 executionResults.videoSegments 读取） ───
      const rawSegments = (p.aiVideoSegments?.length ? p.aiVideoSegments : p.executionResults?.videoSegments) || []
      if (rawSegments.length) {
        // ⭐ 从 aiFrameDesigns 提取 firstFramePrompt（如果有）
        const framePrompt = p.aiFrameDesigns?.[0]?.firstFramePrompt || ''
        state.workspace.segments = rawSegments.map((seg: any, idx: number) => {
          let scenes: string[] = []
          try { if (seg.associatedScenes) scenes = JSON.parse(seg.associatedScenes) } catch {}
          return {
            id: seg.segmentId,
            title: seg.title || `段落 ${seg.sortOrder + 1}`,
            masterBeat: seg.emotionArc || '',
            duration: seg.duration || 10,
            timeline: [],
            characters: [],
            scenes,
            narrativePurpose: seg.fullText || seg.narrativePurpose || seg.narrative || seg.description || '',
            fullText: seg.fullText || seg.narrative || '',  // ⭐ 保留完整文本
            // ⭐ visualDesc 兼容（旧项目 V2 字段）→ 统一 visualDescription
            visualDescription: seg.visualDescription || seg.visualDesc || seg.fullText || seg.narrative || seg.narrativePurpose || '',
            shotPattern: seg.shotPattern || '',
            emotionArc: seg.emotionArc || seg.emotionalTone || '',
            // ⭐ 回填 imagePrompt（优先使用 seg 自带的，否则用 frameDesign 的 firstFramePrompt 填到第一个 segment）
            imagePrompt: seg.imagePrompt || (idx === 0 ? framePrompt : ''),
            negativePrompt: seg.negativePrompt || '',
          }
        })
      }

      // ⭐ 从 executionResults.segments 恢复导演编辑结果（优先于 videoSegments）
      if (er.segments?.length) {
        state.workspace.segments = er.segments.map((seg: any, idx: number) => ({
          id: seg.id || seg.segmentId || `seg_${idx}`,
          title: seg.title || '',
          masterBeat: seg.masterBeat || seg.emotionArc || '',
          duration: seg.duration || 10,
          timeline: seg.timeline || [],
          characters: seg.characters || [],
          scenes: seg.scenes || [],
          narrativePurpose: seg.narrativePurpose || seg.visualDescription || seg.visualDesc || '',
          fullText: seg.fullText || seg.visualDescription || seg.visualDesc || '',
          // ⭐ visualDesc 兼容（旧项目 V2 字段）→ 统一 visualDescription
          visualDescription: seg.visualDescription || seg.visualDesc || seg.fullText || seg.narrativePurpose || '',
          shotPattern: seg.shotPattern || '',
          emotionArc: seg.emotionArc || '',
          imagePrompt: seg.imagePrompt || '',
          negativePrompt: seg.negativePrompt || '',
        }))
      }

      // ⭐ SSOT（SHORTDRAMA-DATA-SSOT）: 阶段状态唯一事实源 = 后端 pipeline_stages 表
      //    前端只读 stage，不自行维护完成状态（Phase 3 统一）
      const serverStages = p.pipelineStages || []
      if (serverStages.length > 0) {
        const stageStatusMap = new Map<string, string>()
        for (const st of serverStages) {
          stageStatusMap.set(st.stageKey, st.status)
        }
        for (const stage of state.pipeline.stages) {
          const st = stageStatusMap.get(stage.id)
          if (st === 'done' || st === 'completed') {
            stage.status = 'completed'
          } else if (st === 'running') {
            stage.status = 'running'
          } else if (st === 'error') {
            stage.status = 'error'
          } else {
            stage.status = 'idle'
          }
        }
      } else {
        // ⭐ fallback: 旧项目无 pipeline_stages，从 executionResults 恢复
        const completedIds = new Set(er.pipelineCompletedStages || [])
        for (const stage of state.pipeline.stages) {
          if (completedIds.has(stage.id)) {
            stage.status = 'completed'
          }
        }
      }

      // ⭐ 恢复 storyboardImages（用于分镜页面恢复生成结果）
      if (p.storyboardImages?.length) {
        state.workspace.storyboardImages = p.storyboardImages.map((sbi: any) => ({
          id: sbi.id,
          segmentId: sbi.segmentId,
          imageUrl: sbi.imageUrl,
          prompt: sbi.prompt || '',
          negativePrompt: sbi.negativePrompt || '',
          createdAt: sbi.createdAt || new Date().toISOString(),
        }))
      }

      // ─── 回填素材库（角色图 + 场景图 + 分镜图） ───
      const assets: AssetEntry[] = []
      if (p.characterImages?.length) {
        for (const ci of p.characterImages) {
          assets.push({
            id: `asset_char_${ci.id}`,
            type: 'character',
            name: ci.characterName || '角色图',
            url: ci.imageUrl,
            thumbnail: ci.imageUrl,
            prompt: ci.characterName ? `角色：${ci.characterName}` : '角色图',
            tags: ['角色', ci.characterName || ''],
            version: 1,
            createdAt: ci.createdAt || new Date().toISOString(),
          })
        }
      }
      if (p.sceneImages?.length) {
        for (const si of p.sceneImages) {
          assets.push({
            id: `asset_scene_${si.id}`,
            type: 'scene',
            name: si.sceneName || '场景图',
            url: si.imageUrl,
            thumbnail: si.imageUrl,
            prompt: si.sceneName ? `场景：${si.sceneName}` : '场景图',
            tags: ['场景', si.sceneName || ''],
            version: 1,
            createdAt: si.createdAt || new Date().toISOString(),
          })
        }
      }
      if (p.storyboardImages?.length) {
        for (const sbi of p.storyboardImages) {
          assets.push({
            id: `asset_sb_${sbi.id}`,
            type: 'storyboard',
            name: sbi.segmentId || '分镜图',
            url: sbi.imageUrl,
            thumbnail: sbi.imageUrl,
            prompt: sbi.segmentId || '分镜图',
            tags: ['分镜', sbi.segmentId || ''],
            version: 1,
            createdAt: sbi.createdAt || new Date().toISOString(),
          })
        }
      }
      // ─── 回填道具图到素材库 ───
      if (p.propImages?.length) {
        for (const pi of p.propImages) {
          assets.push({
            id: `asset_prop_${pi.id}`,
            type: 'prop',
            name: pi.propName || '道具图',
            url: pi.imageUrl,
            thumbnail: pi.imageUrl,
            prompt: pi.description || pi.propName || '道具图',
            tags: ['道具', pi.category || '', pi.propName || ''].filter(Boolean),
            version: 1,
            createdAt: pi.createdAt || new Date().toISOString(),
          })
        }
      }
      if (assets.length > 0) {
        state.assets.assets = assets
      }

      // ─── 从 Asset 表加载视频素材 ───
      try {
        const assetRes = await fetch(`/api/projects/${projectId}/assets`, {
          headers: authHeaders(),
        })
        if (assetRes.ok) {
          const assetJson = await assetRes.json()
          if (assetJson.success && assetJson.assets?.length) {
            for (const a of assetJson.assets) {
              // 去重：避免和上面的 assets 重复
              const exists = state.assets.assets.some(e => e.dbId === a.id || e.url === a.filePath)
              if (!exists) {
                state.assets.assets.push({
                  id: `asset_db_video_${a.id}`,
                  dbId: a.id,
                  type: 'video',
                  name: a.fileName || '生成视频',
                  url: a.filePath,
                  thumbnail: a.thumbnailPath || '',
                  prompt: `视频片段 ${a.taskId || ''}`,
                  tags: ['视频'],
                  version: 1,
                  createdAt: a.createdAt || new Date().toISOString(),
                })
              }
            }
          }
        }
      } catch (e) {
        console.warn('[loadFromServer] ⚠️ 加载视频素材失败:', e)
      }

      // ─── 恢复 segments（分镜段编辑数据） ───
      const savedSegments = (p.executionResults as any)?.segments
      if (Array.isArray(savedSegments) && savedSegments.length > 0) {
        state.workspace.segments = savedSegments
      }

      // ─── 恢复视频风格和画幅比例 ───
      const savedStyle = (p.executionResults as any)?.videoStyle
      const savedRatio = (p.executionResults as any)?.aspectRatio
      const savedLocked = (p.executionResults as any)?.styleLocked
      if (savedStyle) state.workspace.narrative.videoStyle = savedStyle
      if (savedRatio) state.workspace.narrative.aspectRatio = savedRatio
      if (savedLocked !== undefined) state.workspace.narrative.styleLocked = savedLocked === true

      // ─── 恢复流水线阶段状态（仅当后端 pipeline_stages 表无数据时兜底，避免覆盖 SSOT） ───
      const serverStagesArr: any[] = (p as any).pipelineStages || []
      if (serverStagesArr.length === 0) {
        const completedStages: string[] = (p.executionResults as any)?.pipelineCompletedStages || []
        if (completedStages.length > 0) {
          for (const stage of state.pipeline.stages) {
            if (completedStages.includes(stage.id)) {
              stage.status = 'completed'
            }
          }
        }
      }

      return true
    } catch (err: any) {
      console.error('[loadFromServer]', err.message)
      return false
    }
  }

  /** 保存图片到 COS */
  async function saveImageToCos(params: {
    sourceUrl: string
    characterName?: string
    sceneName?: string
    segmentId?: string
  }): Promise<string | null> {
    if (!state.projectId) return null
    try {
      const res = await fetch(`/api/v2/workbench/project/${state.projectId}/save-image`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(params),
      })
      if (!res.ok) throw new Error(`保存图片到 COS 失败: ${res.status}`)
      const json = await res.json()
      return json.data?.cosUrl || null
    } catch (err: any) {
      console.error('[saveImageToCos]', err.message)
      return null
    }
  }

  /** 保存视频到 COS */
  async function saveVideoToCos(params: {
    sourceUrl: string
    segmentId: string
  }): Promise<string | null> {
    if (!state.projectId) return null
    try {
      const res = await fetch(`/api/v2/workbench/project/${state.projectId}/save-video`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(params),
      })
      if (!res.ok) throw new Error(`保存视频到 COS 失败: ${res.status}`)
      const json = await res.json()
      return json.data?.cosUrl || null
    } catch (err: any) {
      console.error('[saveVideoToCos]', err.message)
      return null
    }
  }

  /** 获取用户项目列表 */
  async function fetchProjectList(): Promise<any[]> {
    try {
      const res = await fetch('/api/v2/workbench/projects', {
        headers: authHeaders(),
      })
      if (!res.ok) return []
      const json = await res.json()
      return json.data || []
    } catch {
      return []
    }
  }

  /** 删除项目（清空剧本数据，保留已生成文件） */
  async function deleteProject(projectId: string): Promise<boolean> {
    try {
      const token = getAuthToken()
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      // DELETE 不传 Content-Type（避免 Fastify 空 JSON body 拒绝）
      const res = await fetch(`/api/v2/workbench/project/${projectId}`, {
        method: 'DELETE',
        headers,
      })
      if (!res.ok) throw new Error(`删除项目失败: ${res.status}`)
      if (state.projectId === projectId) {
        state.projectId = ''
        state.workspace.narrative = createEmptyNarrative()
        state.workspace.characters = []
        state.workspace.scenes = []
      }
      return true
    } catch (err: any) {
      console.error('[deleteProject]', err.message)
      return false
    }
  }

  return {
    state,
    activeStage,
    activeWorkspace,
    filteredAssets: computed(() => {
      const ac = state.assets.activeCategory
      if (ac === 'all') return state.assets.assets
      return state.assets.assets.filter(a => a.type === ac)
    }),
    activeSegmentIndex: computed(() => state.activeSegmentIndex),
    compiledPromptSegments: computed(() => state.execution.compiledPrompts),
    projectId: computed(() => state.projectId),
    goToStage,
    updateStageStatus,
    updateNarrative,
    setNarrative,
    videoStyle,
    aspectRatio,
    styleLocked,
    setVideoStyle,
    setAspectRatio,
    toggleStyleLock,
    setCharacters,
    addCharacter,
    updateCharacter,
    setScenes,
    addScene,
    updateScene,
    setActiveSegment,
    setSegments,
    updateSegment,
    updateTimelineFrame,
    setAssets,
    addAsset,
    removeAsset,
    setAssetCategory,
    toggleAssetSidebar,
    setCompiledPromptSegments,
    addCompiledPrompt,
    setProjectId,
    // Server persistence
    saveToServer,
    loadFromServer,
    saveImageToCos,
    saveVideoToCos,
    fetchProjectList,
    deleteProject,
  }
}
