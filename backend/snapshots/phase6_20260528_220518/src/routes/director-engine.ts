// ════════════════════════════════════════════════════════════════
// 火麒麟AI导演系统 — Director Engine (导演级镜头决策引擎)
// @director-rule: AI acts as a film director, not a generator
// @director-rule: every shot must have narrative justification
// @director-rule: visual decisions must follow director style logic
// @director-rule: no random shot generation allowed
// ════════════════════════════════════════════════════════════════

import { FastifyInstance } from 'fastify'

// ─── Types ──────────────────────────────────────────────────────

interface DirectedShot {
  shotId: string
  originalShotId: string
  decidedType: 'wide' | 'medium' | 'close-up' | 'extreme_close' | 'over_shoulder' | 'tracking' | 'handheld' | 'aerial'
  cameraMovement: string
  composition: string
  duration: number
  emotionTag: string
  reasoning: string
  approved: boolean
  narrativeJustification: string
  styleInfluence: string
}

interface DirectorPlan {
  id: string
  graphId: string
  style: string
  shots: DirectedShot[]
  metadata: {
    totalDuration: number
    shotCount: number
    pacingProfile: string
  }
}

interface DirectorPlanWithReasoning extends DirectorPlan {
  reasoningChain: ShotReasoning[]
}

interface ShotReasoning {
  shotId: string
  emotionReasoning: string
  narrativeReasoning: string
  compositionReasoning: string
  styleInfluenceReasoning: string
  chain: string
}

// ─── In-memory store ────────────────────────────────────────────

const plans: Record<string, DirectorPlanWithReasoning> = {}
const planCounter = ref(0)

function ref(initial: number): { value: number } {
  return { value: initial }
}

// ─── Director Styles ────────────────────────────────────────────

const DIRECTOR_STYLES = [
  { id: 'realism', name: '现实主义', desc: '自然光效，手持摄影，沉浸纪实感' },
  { id: 'cinematic', name: '电影感', desc: '宽银幕构图，浅景深，史诗级运镜' },
  { id: 'documentary', name: '纪录片', desc: '客观纪实风格，长镜头，自然光影' },
  { id: 'hollywood', name: '好莱坞商业', desc: '快节奏剪辑，高对比度，冲击力强' },
  { id: 'noir', name: '黑色电影', desc: '高反差布光，阴影构图，忧郁氛围' },
  { id: 'commercial', name: '商业广告', desc: '高饱和色彩，精准打光，产品美学' },
  { id: 'anime-real', name: '二次元实拍', desc: '动漫色调，柔光滤镜，角色高亮' },
  { id: 'suspense', name: '悬疑惊悚', desc: '暗调低影，不安定构图，动态不稳' },
]

// ─── Shot Types ─────────────────────────────────────────────────

const SHOT_TYPES = ['wide', 'medium', 'close-up', 'extreme_close', 'over_shoulder', 'tracking', 'handheld', 'aerial'] as const

const SHOT_TYPE_DESCRIPTIONS: Record<string, { cn: string; useCase: string; composition: string; movement: string }> = {
  wide: {
    cn: '全景',
    useCase: '建立场景空间感，展示环境全貌',
    composition: '三分法构图，地平线位于下三分之一',
    movement: '横向 Pan 或慢速 Dolly',
  },
  medium: {
    cn: '中景',
    useCase: '角色对话与互动，肢体语言展示',
    composition: '腰部以上框架，人物置于画面中心',
    movement: '轻微推进或静态',
  },
  'close-up': {
    cn: '近景特写',
    useCase: '面部表情捕捉，情绪细腻传达',
    composition: '肩部以上，眼神位于上三分线',
    movement: '慢推强调情绪变化',
  },
  extreme_close: {
    cn: '极端特写',
    useCase: '眼睛、手指等细节，张力放大',
    composition: '局部画面充满，边缘有呼吸空间',
    movement: '极慢微距推进',
  },
  over_shoulder: {
    cn: '过肩镜头',
    useCase: '双人对话关系，空间位置确立',
    composition: '前景肩膀占据左/右1/3，主休居中',
    movement: '轻微跟随对话节奏晃动',
  },
  tracking: {
    cn: '跟拍',
    useCase: '角色移动，追逐场景，动态表现',
    composition: '角色保持画面固定位置，背景移动',
    movement: '平稳横向或纵向跟随',
  },
  handheld: {
    cn: '手持摄影',
    useCase: '紧张混乱场景，纪实感，主观视角',
    composition: '轻微不规则框架，呼吸感',
    movement: '不规则的肩扛晃动',
  },
  aerial: {
    cn: '航拍',
    useCase: '宏大场景，俯瞰转场，上帝视角',
    composition: '俯拍30-90度，地面纹理构成线',
    movement: '缓慢拉升或平移',
  },
}

// ─── Camera Movements ───────────────────────────────────────────

const CAMERA_MOVEMENTS = [
  '静态(Static)',
  '推进(Dolly In)',
  '后退(Pull Out)',
  '横向移动(Track Left/Right)',
  '摇摄(Pan)',
  '俯仰(Tilt)',
  '升降(Crane Up/Down)',
  '环绕(Arc)',
  '手持晃动(Handheld Shake)',
  '稳定跟拍(Steadicam)',
  '变焦推(Zoom In)',
  '变焦拉(Zoom Out)',
  '推拉变焦(Dolly Zoom)',
]

const COMPOSITION_RULES = [
  '三分法（Rule of Thirds）',
  '黄金螺旋（Golden Spiral）',
  '对称构图（Symmetry）',
  '引导线（Leading Lines）',
  '框架内框架（Frame within Frame）',
  '对角线构图（Diagonal Lines）',
  '负空间利用（Negative Space）',
  '三角形构图（Triangle）',
  '极简构图（Minimalist）',
  '色彩对比构图（Color Contrast）',
  '光影明暗构图（Chiaroscuro）',
  '节奏重复（Rhythm & Repetition）',
]

const EMOTION_TAGS = [
  'neutral', 'tension', 'surprise', 'sadness', 'joy', 'fear',
  'anger', 'calm', 'excitement', 'melancholy', 'dread', 'anticipation',
  'release', 'mystery', 'awe', 'nostalgia',
]

// ─── Style Influence Maps ──────────────────────────────────────

const STYLE_SHOT_PREFERENCES: Record<string, { preferred: string[]; avoid: string[]; movement: string; composition: string }> = {
  realism: {
    preferred: ['handheld', 'wide', 'medium'],
    avoid: ['extreme_close', 'aerial'],
    movement: '手持晃动(Handheld Shake)',
    composition: '自然光效构图',
  },
  cinematic: {
    preferred: ['wide', 'tracking', 'aerial', 'medium'],
    avoid: ['handheld'],
    movement: '稳定跟拍(Steadicam)',
    composition: '三分法（Rule of Thirds）',
  },
  documentary: {
    preferred: ['handheld', 'medium', 'wide'],
    avoid: ['extreme_close', 'aerial'],
    movement: '手持晃动(Handheld Shake)',
    composition: '纪实中心构图',
  },
  hollywood: {
    preferred: ['close-up', 'extreme_close', 'tracking', 'aerial'],
    avoid: ['handheld'],
    movement: '推进(Dolly In)',
    composition: '黄金螺旋（Golden Spiral）',
  },
  noir: {
    preferred: ['close-up', 'extreme_close', 'over_shoulder', 'medium'],
    avoid: ['aerial', 'handheld'],
    movement: '慢速推进(Dolly In)',
    composition: '光影明暗构图（Chiaroscuro）',
  },
  commercial: {
    preferred: ['close-up', 'extreme_close', 'tracking', 'medium'],
    avoid: ['handheld', 'aerial'],
    movement: '稳定跟拍(Steadicam)',
    composition: '色彩对比构图（Color Contrast）',
  },
  'anime-real': {
    preferred: ['wide', 'medium', 'close-up', 'tracking'],
    avoid: ['handheld'],
    movement: '横向移动(Track Left/Right)',
    composition: '对称构图（Symmetry）',
  },
  suspense: {
    preferred: ['close-up', 'extreme_close', 'handheld', 'over_shoulder'],
    avoid: ['aerial', 'wide'],
    movement: '手持晃动(Handheld Shake)',
    composition: '框架内框架（Frame within Frame）',
  },
}

// ─── Emotion ↔ Shot Type Mapping ────────────────────────────────

const EMOTION_SHOT_MAP: Record<string, { primary: string; secondary: string; reason: string }> = {
  happy: { primary: 'wide', secondary: 'medium', reason: '快乐情绪适合用全景展示开阔感或中景传递笑容' },
  sad: { primary: 'close-up', secondary: 'medium', reason: '悲伤情绪通过近景特写捕捉微表情细节' },
  angry: { primary: 'close-up', secondary: 'handheld', reason: '愤怒需要近景对焦面部张力或手持营造不安感' },
  calm: { primary: 'wide', secondary: 'tracking', reason: '平静适合全景慢速平移或平稳跟拍' },
  anxious: { primary: 'handheld', secondary: 'close-up', reason: '焦虑通过手持呼吸感和近景逼近营造紧张' },
  excited: { primary: 'tracking', secondary: 'aerial', reason: '兴奋感用动态跟拍或航拍释放能量' },
  fearful: { primary: 'close-up', secondary: 'handheld', reason: '恐惧靠极端特写和手持的不稳定传递' },
  neutral: { primary: 'medium', secondary: 'wide', reason: '中性情绪用中景建立观察视角' },
  tension: { primary: 'extreme_close', secondary: 'over_shoulder', reason: '紧张用极端特写放大细节，过肩制造压迫' },
  surprise: { primary: 'close-up', secondary: 'wide', reason: '惊讶先给特写捕捉反应，再切全景展示环境' },
  dread: { primary: 'handheld', secondary: 'extreme_close', reason: '厄运感用手持的不稳和极端特写的窒息' },
  anticipation: { primary: 'tracking', secondary: 'medium', reason: '期待用向前跟拍引导视线，中景交代人物' },
  release: { primary: 'wide', secondary: 'aerial', reason: '释放用全景或航拍拉开空间感' },
  mystery: { primary: 'over_shoulder', secondary: 'medium', reason: '神秘用过肩隐藏视角，中景保持距离' },
  awe: { primary: 'wide', secondary: 'aerial', reason: '敬畏用全景和航拍展示宏大' },
  melancholy: { primary: 'medium', secondary: 'wide', reason: '忧郁用中景的疏离感和全景的空旷' },
  // Director-engine specific emotion extensions
}

// ─── Narrative Stage ↔ Shot Decision ────────────────────────────

const NARRATIVE_SHOT_LOGIC: Record<string, { preferredTypes: string[]; pacing: string; justification: string }> = {
  beginning: {
    preferredTypes: ['wide', 'aerial'],
    pacing: '舒缓',
    justification: '开场需建立世界观空间关系，用全景/航拍交代环境',
  },
  development: {
    preferredTypes: ['medium', 'over_shoulder', 'tracking'],
    pacing: '中等',
    justification: '剧情发展以角色互动为主，中景+过肩确立对话关系',
  },
  conflict: {
    preferredTypes: ['close-up', 'handheld', 'extreme_close'],
    pacing: '急促',
    justification: '冲突阶段需要近景特写放大张力，手持营造不稳定感',
  },
  climax: {
    preferredTypes: ['tracking', 'aerial', 'wide'],
    pacing: '密集',
    justification: '高潮用跟拍+航拍+全景组合释放最大视觉能量',
  },
  resolution: {
    preferredTypes: ['wide', 'medium', 'tracking'],
    pacing: '舒缓',
    justification: '结局回归全景/中景，节奏放慢给观众消化空间',
  },
}

// ─── Mock Character States (for integrated decision making) ──────

const MOCK_CHARACTER_STATES: Record<string, { emotion: string; narrative: string }> = {
  'ch1': { emotion: 'excited', narrative: 'development' },
  'ch2': { emotion: 'calm', narrative: 'development' },
  'ch3': { emotion: 'neutral', narrative: 'beginning' },
}

// ─── Mock Lock Systems ──────────────────────────────────────────

const MOCK_CHARACTER_LOCKS: Record<string, { characterId: string; name: string; locked: boolean }> = {
  'ch1': { characterId: 'ch1', name: '火麒麟', locked: true },
  'ch2': { characterId: 'ch2', name: '玄女', locked: true },
  'ch3': { characterId: 'ch3', name: '剑圣', locked: false },
}

const MOCK_SCENE_LOCKS: Record<string, { sceneId: string; name: string; locked: boolean }> = {
  's1': { sceneId: 's1', name: '天山之巅', locked: true },
  's2': { sceneId: 's2', name: '幽谷密林', locked: true },
  's3': { sceneId: 's3', name: '古城遗迹', locked: false },
}

const MOCK_COSTUME_LOCKS: Record<string, { costumeId: string; characterId: string; name: string; locked: boolean }> = {
  'c1': { costumeId: 'c1', characterId: 'ch1', name: '火麒麟战甲', locked: true },
  'c2': { costumeId: 'c2', characterId: 'ch2', name: '玄女轻纱', locked: false },
}

// ─── Mock lock resolvers (to be replaced with real API calls) ────

function getCharacterLock(characterId: string) {
  return MOCK_CHARACTER_LOCKS[characterId] || { characterId, name: '未知角色', locked: false }
}

function getSceneLock(sceneId: string) {
  return MOCK_SCENE_LOCKS[sceneId] || { sceneId, name: '未知场景', locked: false }
}

function getCostumeLock(characterId: string) {
  return Object.values(MOCK_COSTUME_LOCKS).find(c => c.characterId === characterId && c.locked)
    || { costumeId: '', characterId, name: '无锁定服装', locked: false }
}

// ─── Director Decision Engine ────────────────────────────────────

// @director-rule: AI acts as a film director, not a generator
// @director-rule: every shot must have narrative justification
// @director-rule: visual decisions must follow director style logic
// @director-rule: no random shot generation allowed

function generateDirectorSuggestion(
  originalShot: any,
  index: number,
  emotionTag: string,
  narrativeStage: string,
  style: string,
  characterId?: string,
  sceneId?: string
): DirectedShot {
  // Get style preferences
  const stylePref = STYLE_SHOT_PREFERENCES[style] || STYLE_SHOT_PREFERENCES.cinematic

  // Get emotion-based shot recommendation
  const emotionRec = EMOTION_SHOT_MAP[emotionTag] || EMOTION_SHOT_MAP.neutral

  // Get narrative-based shot logic
  const narrativeLogic = NARRATIVE_SHOT_LOGIC[narrativeStage] || NARRATIVE_SHOT_LOGIC.development

  // Decide shot type using weighted logic
  let decidedType: string
  let reasoning: string

  // Style preference takes priority, then emotion, then narrative
  if (stylePref.preferred.includes(emotionRec.primary)) {
    decidedType = emotionRec.primary
    reasoning = `风格「${DIRECTOR_STYLES.find(s => s.id === style)?.name || style}」偏好与情绪「${emotionTag}」推荐一致，选用 ${SHOT_TYPE_DESCRIPTIONS[emotionRec.primary]?.cn || emotionRec.primary}`
  } else if (narrativeLogic.preferredTypes.includes(emotionRec.primary)) {
    decidedType = emotionRec.primary
    reasoning = `剧情阶段「${narrativeStage}」与情绪「${emotionTag}」共同推荐 ${SHOT_TYPE_DESCRIPTIONS[emotionRec.primary]?.cn || emotionRec.primary}`
  } else {
    // Compromise: pick from intersection of style & narrative
    const intersection = stylePref.preferred.filter(t => narrativeLogic.preferredTypes.includes(t))
    if (intersection.length > 0) {
      decidedType = intersection[0]
      reasoning = `风格与剧情阶段权衡，选择两者交集 ${SHOT_TYPE_DESCRIPTIONS[intersection[0]]?.cn || intersection[0]}`
    } else {
      // Use emotion secondary as fallback
      decidedType = emotionRec.secondary
      reasoning = `默认基于情绪推荐切换到 ${SHOT_TYPE_DESCRIPTIONS[emotionRec.secondary]?.cn || emotionRec.secondary}（风格与剧情未达成交集）`
    }
  }

  // Camera movement based on style
  const cameraMovement = STYLE_SHOT_PREFERENCES[style]?.movement || '静态(Static)'
  const movementReason = `${DIRECTOR_STYLES.find(s => s.id === style)?.name || style}风格推荐 "${cameraMovement}" 运镜方式`

  // Composition based on style
  const composition = STYLE_SHOT_PREFERENCES[style]?.composition || '三分法（Rule of Thirds）'
  const compositionReason = `${DIRECTOR_STYLES.find(s => s.id === style)?.name || style}风格默认构图规则: ${composition}`

  // Duration based on shot type
  const durationMap: Record<string, number> = {
    wide: 6,
    medium: 4,
    'close-up': 3,
    extreme_close: 2.5,
    over_shoulder: 4,
    tracking: 5,
    handheld: 3.5,
    aerial: 7,
  }
  const duration = durationMap[decidedType] || 4

  // Emotion tag
  const finalEmotionTag = emotionTag

  // Narrative justification
  const narrativeJustification = narrativeLogic.justification + `。当前剧情阶段「${narrativeStage}」，采用 ${SHOT_TYPE_DESCRIPTIONS[decidedType]?.cn || decidedType} 以${narrativeLogic.pacing}节奏推进剧情。${emotionRec.reason}`

  // Style influence
  const styleInfluence = `${DIRECTOR_STYLES.find(s => s.id === style)?.name || style}风格: ${movementReason}。${compositionReason}。${decidedType === emotionRec.primary ? '镜头类型选择受情绪推荐主导' : '镜头类型受风格与剧情加权影响'}`

  // Character lock binding
  let charLockNote = ''
  if (characterId) {
    const lock = getCharacterLock(characterId)
    if (lock.locked) {
      charLockNote = `（角色 "${lock.name}" 已锚定锁定）`
    }
  }

  // Scene lock binding
  let sceneLockNote = ''
  if (sceneId) {
    const lock = getSceneLock(sceneId)
    if (lock.locked) {
      sceneLockNote = `（场景 "${lock.name}" 已锚定锁定）`
    }
  }

  // Costume lock binding
  let costumeLockNote = ''
  if (characterId) {
    const lock = getCostumeLock(characterId)
    if (lock.locked) {
      costumeLockNote = `（服装 "${lock.name}" 已锁定）`
    }
  }

  const fullReasoning = `${reasoning}。${narrativeJustification} ${charLockNote} ${sceneLockNote} ${costumeLockNote}`.trim()

  // Shot ID
  const shotId = `directed-${index + 1}-${Date.now().toString(36)}`

  return {
    shotId,
    originalShotId: originalShot?.id || `orig-${index + 1}`,
    decidedType: decidedType as DirectedShot['decidedType'],
    cameraMovement,
    composition,
    duration,
    emotionTag: finalEmotionTag,
    reasoning: fullReasoning,
    approved: false,
    narrativeJustification,
    styleInfluence,
  }
}

function buildReasoningChain(shot: DirectedShot): ShotReasoning {
  return {
    shotId: shot.shotId,
    emotionReasoning: `情绪「${shot.emotionTag}」→ 推荐镜头类型 ${SHOT_TYPE_DESCRIPTIONS[shot.decidedType]?.cn || shot.decidedType}，因为${EMOTION_SHOT_MAP[shot.emotionTag]?.reason || '该情绪适合此镜头类型'}`,
    narrativeReasoning: `剧情状态 → ${shot.narrativeJustification}`,
    compositionReasoning: `构图规则: ${shot.composition}`,
    styleInfluenceReasoning: shot.styleInfluence,
    chain: `【决策链】情绪(${shot.emotionTag}) → 叙事(${shot.narrativeJustification.slice(0, 60)}...) → 构图(${shot.composition}) → 运镜(${shot.cameraMovement})`,
  }
}

// ─── Route Registration ─────────────────────────────────────────

export default async function directorEngineRoutes(fastify: FastifyInstance) {
  // ── GET /api/v1/director/styles ──────────────────────────────────
  fastify.get('/api/v1/director/styles', async (_request, reply) => {
    return reply.send({
      success: true,
      data: DIRECTOR_STYLES,
    })
  })

  // ── POST /api/v1/director/generate-plan ─────────────────────────
  fastify.post('/api/v1/director/generate-plan', async (request, reply) => {
    const { graphId, style, constraints } = request.body as any

    if (!graphId) {
      return reply.status(400).send({ success: false, message: '缺少 graphId' })
    }

    const selectedStyle = DIRECTOR_STYLES.find(s => s.id === style) ? style : 'cinematic'
    const styleInfo = DIRECTOR_STYLES.find(s => s.id === selectedStyle)!

    // Build mock shots based on style + emotion + narrative
    const mockShots = [
      { id: 'sh001', sceneId: 's1', label: '开场·全景', characters: ['ch1'] },
      { id: 'sh002', sceneId: 's1', label: '对话·近景', characters: ['ch1', 'ch2'] },
      { id: 'sh003', sceneId: 's1', label: '动作·中景', characters: ['ch1'] },
      { id: 'sh004', sceneId: 's1', label: '对峙·特写', characters: ['ch2', 'ch3'] },
      { id: 'sh005', sceneId: 's1', label: '爆发·全景', characters: ['ch1', 'ch2'] },
      { id: 'sh006', sceneId: 's1', label: '收尾·远景', characters: ['ch1'] },
    ]

    const plannedShots: DirectedShot[] = mockShots.map((shot, i) => {
      // Get character emotion for this shot
      const primaryChar = shot.characters[0] || 'ch1'
      const charState = MOCK_CHARACTER_STATES[primaryChar] || { emotion: 'neutral', narrative: 'development' }

      return generateDirectorSuggestion(
        shot,
        i,
        charState.emotion,
        charState.narrative,
        selectedStyle,
        primaryChar,
        shot.sceneId
      )
    })

    const totalDuration = plannedShots.reduce((acc, s) => acc + s.duration, 0)
    const pacingProfile = `节奏分布: ${styleInfo.name}风格主导, ${plannedShots.filter(s => s.duration <= 3).length}个短镜头(${'<'}3s), ${plannedShots.filter(s => s.duration > 3 && s.duration <= 5).length}个中镜头(3-5s), ${plannedShots.filter(s => s.duration > 5).length}个长镜头(>5s)`

    const planId = `plan-${Date.now().toString(36)}-${graphId}`

    const reasoningChain = plannedShots.map(buildReasoningChain)

    const plan: DirectorPlanWithReasoning = {
      id: planId,
      graphId,
      style: selectedStyle,
      shots: plannedShots,
      reasoningChain,
      metadata: {
        totalDuration,
        shotCount: plannedShots.length,
        pacingProfile,
      },
    }

    plans[planId] = plan

    return reply.send({
      success: true,
      data: plan,
    })
  })

  // ── GET /api/v1/director/plan/:planId ──────────────────────────
  fastify.get('/api/v1/director/plan/:planId', async (request, reply) => {
    const { planId } = request.params as any
    const plan = plans[planId]
    if (!plan) {
      return reply.status(404).send({ success: false, message: `导演计划 ${planId} 不存在` })
    }
    return reply.send({ success: true, data: plan })
  })

  // ── POST /api/v1/director/approve-shot ─────────────────────────
  fastify.post('/api/v1/director/approve-shot', async (request, reply) => {
    const { planId, shotId, approved } = request.body as any

    if (!planId || !shotId) {
      return reply.status(400).send({ success: false, message: '缺少 planId 或 shotId' })
    }

    const plan = plans[planId]
    if (!plan) {
      return reply.status(404).send({ success: false, message: `导演计划 ${planId} 不存在` })
    }

    const shot = plan.shots.find(s => s.shotId === shotId)
    if (!shot) {
      return reply.status(404).send({ success: false, message: `镜头 ${shotId} 不存在` })
    }

    shot.approved = approved

    return reply.send({
      success: true,
      data: {
        shotId,
        approved,
        message: approved ? '✅ 镜头已批准' : '❌ 镜头已拒绝',
      },
    })
  })

  // ── POST /api/v1/director/regenerate-shot ──────────────────────
  fastify.post('/api/v1/director/regenerate-shot', async (request, reply) => {
    const { planId, shotId, instructions } = request.body as any

    if (!planId || !shotId) {
      return reply.status(400).send({ success: false, message: '缺少 planId 或 shotId' })
    }

    const plan = plans[planId]
    if (!plan) {
      return reply.status(404).send({ success: false, message: `导演计划 ${planId} 不存在` })
    }

    const shotIndex = plan.shots.findIndex(s => s.shotId === shotId)
    if (shotIndex === -1) {
      return reply.status(404).send({ success: false, message: `镜头 ${shotId} 不存在` })
    }

    // Regenerate with optional constraints
    const alternativeStyles = HANDHELD_ALTERNATIVES[plan.style] || HANDHELD_ALTERNATIVES.cinematic
    const newStyle = alternativeStyles[Math.floor(Math.random() * alternativeStyles.length)]

    const newShot = generateDirectorSuggestion(
      plan.shots[shotIndex],
      shotIndex,
      plan.shots[shotIndex].emotionTag,
      'development',
      newStyle,
      'ch1',
      's1'
    )

    if (instructions) {
      newShot.reasoning += ` (根据用户指示调整: ${instructions})`
    }

    plan.shots[shotIndex] = newShot
    plan.reasoningChain[shotIndex] = buildReasoningChain(newShot)

    return reply.send({
      success: true,
      data: newShot,
      message: `镜头已重新生成，使用风格「${DIRECTOR_STYLES.find(s => s.id === newStyle)?.name || newStyle}」`,
    })
  })

  // ── POST /api/v1/director/switch-style ────────────────────────
  fastify.post('/api/v1/director/switch-style', async (request, reply) => {
    const { planId, style } = request.body as any

    if (!planId || !style) {
      return reply.status(400).send({ success: false, message: '缺少 planId 或 style' })
    }

    const styleInfo = DIRECTOR_STYLES.find(s => s.id === style)
    if (!styleInfo) {
      return reply.status(400).send({ success: false, message: `不支持的风格: ${style}` })
    }

    const plan = plans[planId]
    if (!plan) {
      return reply.status(404).send({ success: false, message: `导演计划 ${planId} 不存在` })
    }

    // Regenerate all shots with new style
    plan.style = style
    plan.shots = plan.shots.map((shot, i) => {
      const newShot = generateDirectorSuggestion(
        shot,
        i,
        shot.emotionTag,
        'development',
        style,
        'ch1',
        's1'
      )
      return newShot
    })

    plan.reasoningChain = plan.shots.map(buildReasoningChain)
    plan.metadata.pacingProfile = `风格切换为 ${styleInfo.name}，节奏已重新适配`

    return reply.send({
      success: true,
      data: plan,
      message: `导演计划已切换到风格「${styleInfo.name}」`,
    })
  })

  // ── POST /api/v1/director/adjust-pacing ────────────────────────
  fastify.post('/api/v1/director/adjust-pacing', async (request, reply) => {
    const { planId, segmentIndex, newPacing } = request.body as any

    if (!planId || segmentIndex === undefined || newPacing === undefined) {
      return reply.status(400).send({ success: false, message: '缺少 planId, segmentIndex 或 newPacing' })
    }

    const plan = plans[planId]
    if (!plan) {
      return reply.status(404).send({ success: false, message: `导演计划 ${planId} 不存在` })
    }

    if (segmentIndex < 0 || segmentIndex >= plan.shots.length) {
      return reply.status(400).send({ success: false, message: `无效 segmentIndex: ${segmentIndex}` })
    }

    // Adjust duration based on pacing factor (0.5 = half speed, 2.0 = double speed)
    const factor = Math.max(0.25, Math.min(4, newPacing / 50))
    const shot = plan.shots[segmentIndex]
    shot.duration = Math.round((shot.duration / factor) * 10) / 10

    // Recalculate total duration
    plan.metadata.totalDuration = plan.shots.reduce((acc, s) => acc + s.duration, 0)
    plan.metadata.pacingProfile = `手动调整节奏: segment ${segmentIndex} 节奏因子 ${factor.toFixed(2)}x`

    return reply.send({
      success: true,
      data: {
        shotId: shot.shotId,
        newDuration: shot.duration,
        factor,
      },
      message: `镜头 ${segmentIndex + 1} 节奏已调整，时长变为 ${shot.duration}s`,
    })
  })

  // ── GET /api/v1/director/plan/:planId/reasoning ──────────────
  fastify.get('/api/v1/director/plan/:planId/reasoning', async (request, reply) => {
    const { planId } = request.params as any
    const plan = plans[planId]
    if (!plan) {
      return reply.status(404).send({ success: false, message: `导演计划 ${planId} 不存在` })
    }

    return reply.send({
      success: true,
      data: {
        planId: plan.id,
        style: plan.style,
        reasoningChain: plan.reasoningChain,
      },
    })
  })
}

// ─── Helpers ─────────────────────────────────────────────────────

const HANDHELD_ALTERNATIVES: Record<string, string[]> = {
  noir: ['suspense', 'realism'],
  suspense: ['noir', 'documentary'],
  realism: ['documentary', 'cinematic'],
  cinematic: ['hollywood', 'commercial'],
  documentary: ['realism', 'suspense'],
  hollywood: ['cinematic', 'commercial'],
  commercial: ['hollywood', 'anime-real'],
  'anime-real': ['commercial', 'cinematic'],
}
