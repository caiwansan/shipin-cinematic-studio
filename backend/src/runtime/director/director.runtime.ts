/**
 * backend/src/runtime/director/director.runtime.ts
 *
 * Director Runtime — Sprint 1 (打磨版)
 *
 * 职责只有一条：文本 → ShotGraph
 * 不碰 Camera/VFX/Video/Motion
 * 规则驱动，不上 AI Agent
 * 
 * v2 改进：
 *   1. 角色提取：更精确的命名实体识别，排除环境词误判
 *   2. 环境提取：优先级排序，从文本中准确找到场景名而非随机匹配
 *   3. impact 注入：控制在模式模板已有 impact 时不额外追加
 *   4. 镜头描述：基于场景类型差异化，战斗/对白/灾难各有特色
 *   5. 镜头时长：根据模式类型整体调整节奏
 */

import { createRequire } from 'module'
const _require = createRequire(import.meta.url)
const _ns = _require('../../../../shared/runtime/narrative-schema')

import type {
  NarrativeProjectSnapshot,
  NarrativeVideoSegment,
} from '../../../../shared/runtime/narrative-schema.js'

import type {
  ShotNode,
  ShotGraph,
  ShotType,
  ShotMood,
  SceneType,
} from '../../../../shared/runtime/shot-graph.js'

import {
  inferSceneType,
  SHOT_PATTERNS,
} from '../../../../shared/runtime/shot-graph.js'

// ============================================================
// 命名实体词表（角色名、环境名、动作动词）
// ============================================================

/** 常见角色名后缀 */
const CHAR_TITLES = ['神尊', '魔神', '尊者', '上仙', '仙子', '仙君', '魔帝', '战神', '剑仙', '剑圣', '天王',
  '大帝', '圣皇', '妖王', '魔尊', '真人', '道人', '和尚', '侠客', '剑客', '武士', '忍者',
  '骑士', '法师', '精灵', '巨人', '僵尸', '分身', '化身']

/** 环境/场景词（按优先级排序——先匹配高特异性词） */
const ENV_PATTERNS: [RegExp, string][] = [
  // 神话级
  [/九重天/g, '九重天'], [/天庭/g, '天庭'], [/南天门/g, '南天门'],
  [/凌霄宝殿/g, '凌霄宝殿'], [/灵山/g, '灵山'],
  // 超凡空间
  [/虚空/g, '虚空'], [/混沌/g, '混沌'], [/洪荒/g, '洪荒'],
  [/深渊/g, '深渊'], [/魔界/g, '魔界'], [/仙界/g, '仙界'], [/神界/g, '神界'],
  [/地狱/g, '地狱'], [/冥界/g, '冥界'],
  // 自然场景
  [/山峰/g, '山峰'], [/山顶/g, '山顶'], [/山巅/g, '山巅'],
  [/大海/g, '大海'], [/海底/g, '海底'], [/海面/g, '海面'],
  [/森林/g, '森林'], [/丛林/g, '丛林'],
  [/沙漠/g, '沙漠'], [/草原/g, '草原'], [/极地/g, '极地'],
  [/天空/g, '天空'], [/云端/g, '云端'], [/苍穹/g, '苍穹'],
  [/月球/g, '月球'], [/火星/g, '火星'],
  // 人间场景
  [/宫殿/g, '宫殿'], [/皇宫/g, '皇宫'], [/祭坛/g, '祭坛'],
  [/塔楼/g, '塔楼'], [/高塔/g, '高塔'], [/城堡/g, '城堡'],
  [/小镇/g, '小镇'], [/城市/g, '城市'], [/街道/g, '街道'],
  [/茶馆/g, '茶馆'], [/酒馆/g, '酒馆'], [/客栈/g, '客栈'],
  [/庭院/g, '庭院'], [/花园/g, '花园'], [/花园/g, '花园'],
  [/战场/g, '战场'], [/擂台/g, '擂台'], [/竞技场/g, '竞技场'],
  [/废墟/g, '废墟'], [/遗迹/g, '遗迹'], [/古墓/g, '古墓'],
  [/洞穴/g, '洞穴'], [/山洞/g, '山洞'],
  [/河流/g, '河流'], [/瀑布/g, '瀑布'], [/湖畔/g, '湖畔'],
  // 英文
  [/summit/gi, 'summit'], [/palace/gi, 'palace'], [/temple/gi, 'temple'],
  [/forest/gi, 'forest'], [/ocean/gi, 'ocean'], [/void/gi, 'void'],
  [/city/gi, 'city'], [/mountain/gi, 'mountain'], [/desert/gi, 'desert'],
]

/** 战斗关键词 */
const BATTLE_KEYWORDS = ['大战', '战斗', '对决', '对战', '厮杀', '交锋', '搏斗', '争斗', '激战', '决战',
  'fight', 'battle', 'war', 'combat', 'clash', 'duel']

/** 对白关键词 */
const DIALOGUE_KEYWORDS = ['说', '道', '问', '答', '告诉', '解释', '讨论', '商量',
  'say', 'talk', 'speak', 'tell', 'ask', 'answer', 'reply']

/** 冲击/爆发类关键词 */
const IMPACT_KEYWORDS = ['碰撞', '爆炸', '撞击', '崩塌', '撕裂', '破碎', '爆发', '对撞',
  '冲击', '轰击', '爆炸', '崩裂', '碎裂', '毁灭', '炸裂']

/** 亮相/显现类关键词 */
const REVEAL_KEYWORDS = ['降临', '登场', '现身', '出现', '降临', '来到', '出现', '显现',
  'reveal', 'appear', 'arrive', 'enter', 'emerge']

/** 情绪反应关键词 */
const REACTION_KEYWORDS = ['震惊', '惊讶', '愤怒', '恐惧', '悲伤', '绝望', '狂喜', '哭泣',
  'shock', 'surprise', 'anger', 'fear', 'sad', 'despair', 'joy', 'cry']

// ============================================================
// 转场映射
// ============================================================

const TRANSITION_TEMPLATES: Record<ShotType, string> = {
  establishing:  '渐入',
  reveal:        '淡入',
  dialogue:      '切',
  confrontation: '切',
  action:        '快速切',
  impact:        '闪白',
  climax:        '慢放+闪白',
  transition:    '叠化',
  reaction:      '缓切',
  detail:        '推',
  ending:        '渐黑',
}

// ============================================================
// Director Runtime
// ============================================================

export class DirectorRuntime {
  /**
   * 从 Narrative Spec 生成 Shot Graph
   */
  generateShotPlan(spec: NarrativeProjectSnapshot): ShotGraph {
    const allShots: ShotNode[] = []
    const segments = spec.videoSegments || []

    if (segments.length === 0) {
      return this.generateFromSynopsis(spec)
    }

    for (const segment of segments) {
      const segmentShots = this.planSegment(segment, spec)
      allShots.push(...segmentShots)
    }

    const totalDuration = allShots.reduce((sum, s) => sum + s.duration, 0)
    const energyArc = this.inferEnergyArc(allShots)

    return {
      title: spec.title || '未命名场景',
      synopsis: spec.synopsis || undefined,
      shots: allShots,
      totalDuration,
      energyArc,
    }
  }

  /**
   * 纯文本 → Shot Graph（无 Narrative Spec 时的降级路径）
   * 这是 Sprint 1 的核心入口
   */
  generateFromText(text: string, title?: string): ShotGraph {
    const sceneType = inferSceneType(text)
    const pattern = SHOT_PATTERNS[sceneType]
    const mood = this.inferMood(text)
    const environment = this.extractEnvironment(text)
    const characters = this.extractCharacters(text)
    const hasAction = BATTLE_KEYWORDS.some(k => text.includes(k))
    const hasDialogue = DIALOGUE_KEYWORDS.some(k => text.includes(k))
    const hasImpact = IMPACT_KEYWORDS.some(k => text.includes(k))

    // 根据场景类型和内容动态调整模式
    let finalPattern: ShotType[]
    if (hasDialogue && !hasAction) {
      // 纯对话：Establishing → Reveal → Dialogue × N → Ending
      finalPattern = this.adjustDialoguePattern(pattern, text)
    } else if (hasAction && hasImpact) {
      // 战斗+冲击：可能需要更多 action/impact
      finalPattern = this.adjustBattlePattern(pattern, text)
    } else {
      finalPattern = pattern
    }

    // 生成镜头
    const shots: ShotNode[] = finalPattern.map((shotType, i) => {
      return this.buildShot(shotType, i, text, characters, environment, mood, sceneType, finalPattern.length)
    })

    // 冲击补充：如果模式里没覆盖到文本中的冲击词，加一个
    // 但不超过1个额外镜头
    let extraCount = 0
    const existingImpacts = shots.filter(s => s.shotType === 'impact').length
    const impactWords = text.match(/(碰撞|爆炸|撞击|崩塌|撕裂|破碎|爆发|对撞|冲击|轰击)/g)
    if (impactWords && existingImpacts < 1 && extraCount === 0) {
      shots.push({
        id: String(shots.length + 1).padStart(3, '0'),
        shotType: 'impact',
        description: `${impactWords[0]}瞬间，震撼全场`,
        visual: `${this.describeEnvironment(environment)}中爆发出剧烈的${impactWords[0]}，能量四射`,
        subject: characters,
        environment,
        action: impactWords[0],
        mood: 'chaotic',
        duration: 4,
        transition: '闪白',
      })
      extraCount++
    }

    // 如果有 reaction 关键词但模式里没有 reaction，加一个
    if (REACTION_KEYWORDS.some(k => text.includes(k)) && !shots.some(s => s.shotType === 'reaction')) {
      shots.splice(shots.length - 1, 0, {
        id: String(shots.length).padStart(3, '0'),
        shotType: 'reaction',
        description: `${characters.join('、')}对眼前的景象露出强烈反应`,
        visual: `${characters[0] || '众人'}的震惊表情，瞳孔放大`,
        subject: characters,
        environment,
        action: '震惊',
        mood: 'tense',
        duration: 3,
        transition: '缓切',
      })
    }

    return {
      title: title || text.slice(0, 25) + (text.length > 25 ? '...' : ''),
      synopsis: text,
      shots,
      totalDuration: shots.reduce((s, n) => s + n.duration, 0),
      energyArc: this.inferEnergyArc(shots),
    }
  }

  // ─────────────────────────────────────────────────
  // Pattern Adjustment
  // ─────────────────────────────────────────────────

  /**
   * 对话场景：在对话前后加 reveal, 最后加 reaction
   */
  private adjustDialoguePattern(pattern: ShotType[], text: string): ShotType[] {
    const adjusted = [...pattern]
    // 如果角色 >1 且有登场动作，在第一个 dialogue 后插入第二个 reveal
    const chars = this.extractCharacters(text)
    if (chars.length >= 2) {
      const firstDialogue = adjusted.indexOf('dialogue')
      if (firstDialogue > 0 && adjusted[firstDialogue - 1] !== 'reveal') {
        adjusted.splice(firstDialogue, 0, 'reveal')
      }
    }
    return adjusted
  }

  /**
   * 战斗场景：增加 action 密度
   */
  private adjustBattlePattern(pattern: ShotType[], text: string): ShotType[] {
    const adjusted: ShotType[] = []
    for (const t of pattern) {
      adjusted.push(t)
      // 在 confrontation 后面多补一个 action
      if (t === 'confrontation') {
        adjusted.push('action')
      }
      // 在 impact 后面多补一个 action
      if (t === 'impact') {
        adjusted.push('action')
      }
    }
    return adjusted
  }

  // ─────────────────────────────────────────────────
  // Shot Building
  // ─────────────────────────────────────────────────

  private buildShot(
    shotType: ShotType,
    index: number,
    context: string,
    characters: string[],
    environment: string,
    mood: ShotMood,
    sceneType: SceneType,
    totalShots: number,
  ): ShotNode {
    const charStr = this.smartFormatChars(shotType, index, characters)
    const envStr = environment || this.extractEnvironment(context)
    // 如果传入的 sceneType 是 'battle' 但没有战斗关键词，重新推断
    let sceneTypeDerived = sceneType || inferSceneType(context)
    if (sceneTypeDerived === 'battle' && !BATTLE_KEYWORDS.some(k => context.includes(k))) {
      sceneTypeDerived = inferSceneType(context)
    }
    // 如果角色数为0且场景类型为battle，降级为exploration（无角色不能有动作）
    if (sceneTypeDerived === 'battle' && characters.length === 0) {
      sceneTypeDerived = 'exploration'
    }

    return {
      id: String(index + 1).padStart(3, '0'),
      shotType,
      description: this.describeShot(shotType, context, charStr, envStr, sceneTypeDerived, index, totalShots),
      visual: this.generateVisual(shotType, context, charStr, envStr, mood, sceneTypeDerived),
      subject: characters,
      environment: envStr,
      action: this.extractAction(context, shotType),
      mood,
      duration: this.estimateDuration(shotType, sceneTypeDerived, index, totalShots),
      transition: TRANSITION_TEMPLATES[shotType],
    }
  }

  /**
   * 描述镜头
   */
  private describeShot(
    shotType: ShotType,
    context: string,
    charStr: string,
    envStr: string,
    sceneType: SceneType,
    index: number,
    totalShots: number,
  ): string {
    // 对战斗/灾难场景用更具动态感的描述
    if (sceneType === 'battle' || sceneType === 'disaster' || sceneType === 'chase') {
      return this.describeActionShot(shotType, charStr, envStr)
    }
    if (sceneType === 'dialogue' || sceneType === 'romance' || sceneType === 'suspense') {
      return this.describeDramaticShot(shotType, charStr, envStr)
    }

    // 通用描述
    const templates: Record<ShotType, string> = {
      establishing:  `展现${envStr}的全景，氛围铺垫`,
      reveal:        `${charStr}登场，第一次进入画面`,
      dialogue:      `${charStr}之间的对话交流`,
      confrontation: `${charStr}正面对峙，剑拔弩张`,
      action:        `${charStr}之间的激烈动作`,
      impact:        `关键事件爆发，冲击力十足`,
      climax:        `全段最高潮，决定性的时刻`,
      transition:    `时空切换，转接下一场景`,
      reaction:      `${charStr}对事件的情绪反应`,
      detail:        `关键细节特写，暗示重要信息`,
      ending:        `收束，余韵渐隐`,
    }
    return templates[shotType]
  }

  /** 动作场景的镜头描述 */
  private describeActionShot(shotType: ShotType, charStr: string, envStr: string): string {
    const templates: Record<ShotType, string> = {
      establishing:  `${envStr}的宏大场景，能量涌动，大战一触即发`,
      reveal:        `${charStr}强势入场，威压四方`,
      dialogue:      `${charStr}在激战中短暂交流`,
      confrontation: `${charStr}对峙，空气凝固，能量蓄积`,
      action:        `${charStr}激烈交锋，招招致命`,
      impact:        `惊天动地的碰撞，${envStr}为之震动`,
      climax:        `决定胜负的终极一击，乾坤逆转`,
      transition:    `场景切换，战局转移`,
      reaction:      `${charStr}承受冲击，露出震惊之色`,
      detail:        `致命的伤口/碎裂的武器特写`,
      ending:        `尘埃落定，${envStr}恢复死寂`,
    }
    return templates[shotType]
  }

  /** 戏剧/情感场景的镜头描述 */
  private describeDramaticShot(shotType: ShotType, charStr: string, envStr: string): string {
    const templates: Record<ShotType, string> = {
      establishing:  `${envStr}的宁静氛围，故事悄然展开`,
      reveal:        `${charStr}缓步走入画面，神情复杂`,
      dialogue:      `${charStr}的对话，暗流涌动`,
      confrontation: `${charStr}对视，无声的压力在蔓延`,
      action:        `${charStr}的细微动作，情绪在肢体间流动`,
      impact:        `关键信息的揭露，震撼全场`,
      climax:        `情感爆发的高潮时刻`,
      transition:    `思绪流转，场景切换`,
      reaction:      `${charStr}听到消息后的情绪变化`,
      detail:        `眼神/手部特写，暗示内心波动`,
      ending:        `${envStr}渐暗，余韵悠长`,
    }
    return templates[shotType]
  }

  /**
   * 生成画面描述
   */
  private generateVisual(
    shotType: ShotType,
    context: string,
    charStr: string,
    envStr: string,
    mood: ShotMood,
    sceneType: SceneType,
  ): string {
    const isAction = ['battle', 'chase', 'disaster', 'war'].includes(sceneType)
    const isDrama = ['dialogue', 'romance', 'suspense', 'ceremony'].includes(sceneType)

    if (isAction) {
      return this.generateActionVisual(shotType, charStr, envStr, mood)
    }
    if (isDrama) {
      return this.generateDramaVisual(shotType, charStr, envStr, mood)
    }

    const visuals: Record<ShotType, string> = {
      establishing:  `${envStr}的全景，${mood}的氛围笼罩一切`,
      reveal:        `${charStr}出现在${envStr}中，气场强大`,
      dialogue:      `${charStr}在${envStr}中交谈，${mood}的气氛`,
      confrontation: `${charStr}在${envStr}中对峙，空气凝固`,
      action:        `${charStr}在${envStr}中激烈交锋，动作迅猛`,
      impact:        `巨大的冲击在${envStr}中爆发，震撼天地`,
      climax:        `在${envStr}中达到最高潮，一切在此刻决定`,
      transition:    `${envStr}的画面逐渐模糊，转场`,
      reaction:      `${charStr}在${envStr}中展现出强烈的情绪反应`,
      detail:        `${envStr}中的关键细节特写，暗藏玄机`,
      ending:        `${envStr}恢复平静，余韵犹存`,
    }
    return visuals[shotType]
  }

  private generateActionVisual(shotType: ShotType, charStr: string, envStr: string, mood: ShotMood): string {
    const visuals: Record<ShotType, string> = {
      establishing:  `${envStr}的毁灭性全景，硝烟弥漫，能量残余在空中闪烁`,
      reveal:        `${charStr}从光芒/黑暗中现身，气势滔天，周围空气震颤`,
      dialogue:      `${charStr}在战场中央吼出对话，风声掩盖了一切`,
      confrontation: `${charStr}相对而立，能量场互相冲击，地面龟裂`,
      action:        `${charStr}以肉眼难以捕捉的速度交锋，火花四溅`,
      impact:        `两股能量对撞，${envStr}空间扭曲，冲击波横扫一切`,
      climax:        `终极一击！所有的力量汇聚一点，时间仿佛静止，然后轰然爆发`,
      transition:    `战场烟尘弥漫，视角切换至另一处`,
      reaction:      `${charStr}被余波震飞，脸上满是不可思议`,
      detail:        `崩裂的大地、飞散的碎石、滴落的鲜血特写`,
      ending:        `浓烟散去，${envStr}满目疮痍，只剩寂静`,
    }
    return visuals[shotType]
  }

  private generateDramaVisual(shotType: ShotType, charStr: string, envStr: string, mood: ShotMood): string {
    const visuals: Record<ShotType, string> = {
      establishing:  `${envStr}的柔和光线，${mood}的微风吹过，时间缓慢流淌`,
      reveal:        `${charStr}的身影出现在${envStr}的光影中，画面唯美`,
      dialogue:      `${charStr}的眼神交汇，话语间暗藏深意，氛围${mood}`,
      confrontation: `${charStr}之间的距离感，沉默比对话更有力量`,
      action:        `${charStr}的握手/拥抱/诀别，情感浓度极高`,
      impact:        `真相揭晓的瞬间，${charStr}的表情凝固`,
      climax:        `压抑已久的情感在这一刻彻底释放，感动/震撼/悲痛交织`,
      transition:    `回忆与现实交错，画面缓缓叠化`,
      reaction:      `${charStr}的泪水/微笑/颤抖，内心波澜映射在脸上`,
      detail:        `照片/信件/信物的特写，承载着深厚的情感`,
      ending:        `余晖洒在${envStr}上，一切归于宁静，故事告一段落`,
    }
    return visuals[shotType]
  }

  // ─────────────────────────────────────────────────
  // 实体提取
  // ─────────────────────────────────────────────────

  /**
   * 从文本中提取角色名
   * 改进：排除环境词，优先匹配含称号的实体
   */
  private extractCharacters(text: string): string[] {
    if (!text) return []
    const names = new Set<string>()
    const envList = ENV_PATTERNS.map(p => p[1])

    // 策略1：称号+名词模式（如 上古神尊、深渊魔神）
    const titlePattern = /(?:[\u4e00-\u9fa5]{2,4})(?:神尊|魔神|尊者|上仙|仙子|仙君|魔帝|战神|剑仙|剑圣|天王|大帝|圣皇|妖王|魔尊|真人|剑客|骑士|法师|精灵|巨人|和尚|傀儡|分身|化身|魔王|魔头|妖兽|神兽|巨龙|凤凰|剑士|刀客|枪手|狙击手|驾驶员|宇航员)/g
    let match: RegExpExecArray | null
    while ((match = titlePattern.exec(text)) !== null) {
      const name = match[0]
      // 排除纯环境词
      if (name.length === 2 && /[两两三三个个各各双双]/.test(name[0])) continue
      if (envList.includes(name) || ['两位的朋友'].includes(name)) continue
      // 排除纯环境词和数量描述
      if (/^位/.test(name) || /^[两两三三四四五六七八九十]/.test(name)) continue
      // 排除含连接词的结果（"与深渊" 残留）
      if (name.includes('与') || name.includes('和')) continue
      // 排除纯动作动词
      if (['大战', '对决', '对峙', '对话', '战斗'].includes(name)) continue
      names.add(name)
    }

    // 策略2：与和跟模式（神尊与魔神、剑客与侠客）
    const pairPattern = /([\u4e00-\u9fa5]{2,4})(?:与|和|跟)([\u4e00-\u9fa5]{2,4})/g
    while ((match = pairPattern.exec(text)) !== null) {
      for (let i = 1; i <= 2; i++) {
        const name = match[i]
        if (name.length === 2 && /[两两三三个个各各双双]/.test(name[0])) continue
        // 环境词排除：只有当 name 本身就是纯环境词时才跳过
        if (envList.includes(name) || ['两位的朋友'].includes(name)) continue
        // 跳过含连接词的结果
        if (name.includes('与') || name.includes('和')) continue
        if (['大战', '对决', '对峙', '对话', '战斗'].includes(name)) continue
        names.add(name)
      }
    }

    // 策略3：动作主体（剑客对决、侠客来到）
    const verbPattern = /([\u4e00-\u9fa5]{2,4})(?:在此|来到|进入|冲向|站在|身处|与|和)/g
    while ((match = verbPattern.exec(text)) !== null) {
      const name = match[1]
      if (name.length === 2 && /[两两三三个个]/.test(name[0])) continue
      if (['大战', '对决', '对峙', '对话', '战斗', '两位', '落日'].includes(name)) continue
      if (envList.includes(name)) continue
      names.add(name)
    }

    // 策略4：通用名词角色（职业/身份 + 位置）
    const commonNouns = /([\u4e00-\u9fa5]{2,3}(?:在|来到|进入|冲向|站在|身处|与|和|跟|大战|对决|对话))/g
    while ((match = commonNouns.exec(text)) !== null) {
      const name = match[1].slice(0, -1)  // 去掉最后一个字（介词）
      if (name.length < 2) continue
      if (/^[两两三三四四五六七八九十这位各位]/.test(name)) continue
      if (['大战', '对决', '对峙', '对话', '战斗', '落日', '夕阳', '天空'].includes(name)) continue
      if (envList.includes(name)) continue
      names.add(name)
    }

    // 策略5：常见命名角色
    const knownNames = /(黑神话|白骨精|孙悟空|唐僧|八戒|沙僧|哪吒|杨戬|妲己|伏羲|女娲|盘古|共工|祝融|蚩尤|黄帝|炎帝|老朋友|小伙伴们)/g
    while ((match = knownNames.exec(text)) !== null) {
      names.add(match[0])
    }

    // 去重：如果一个名字是另一个名字的子串，删掉短的
    const nameArray = Array.from(names)
    const filtered = nameArray.filter((n, i) => {
      // 保留如果不存在其他更长的名字包含它
      if (nameArray.some((other, j) => i !== j && other.length > n.length && other.includes(n))) return false
      // 排除以动作词结尾的残余（"山巅对" → "对" 是动作词残留）
      if (/^.{2,3}[对决对峙对话大战战斗打压]$$/.test(n)) {
        // 如果有其他相同来源的名字，跳过这个
        return false
      }
      return true
    })
    return filtered
  }

  /**
   * 从文本中提取环境名（高优先级优先）
   */
  private extractEnvironment(text: string): string {
    if (!text) return '未知场景'

    // 先找最高优先级的匹配
    for (const [pattern, name] of ENV_PATTERNS) {
      const match = text.match(pattern)
      if (match) return name
    }

    return '未知场景'
  }

  /**
   * 描述环境
   */
  private describeEnvironment(env: string): string {
    // 为环境加上修饰
    const adjectives: Record<string, string> = {
      '九重天': '九天之上',
      '天庭': '巍峨天庭',
      '深渊': '无尽深渊',
      '魔界': '暗黑魔界',
      '虚空': '浩瀚虚空',
      '战场': '苍茫战场',
      '山峰': '险峻山峰',
      '山巅': '孤绝山巅',
      '大海': '苍茫大海',
      '森林': '幽暗森林',
      '沙漠': '荒芜沙漠',
      '宫殿': '雄伟宫殿',
    }
    return adjectives[env] || env
  }

  /**
   * 提取动作
   */
  private extractAction(text: string, shotType: ShotType): string {
    // 不同类型的镜头尝试找对应的动作动词
    if (shotType === 'impact') {
      for (const kw of IMPACT_KEYWORDS) {
        if (text.includes(kw)) return kw
      }
      return '冲击'
    }
    if (shotType === 'reveal') {
      for (const kw of REVEAL_KEYWORDS) {
        if (text.includes(kw)) return kw
      }
      return '登场'
    }
    if (shotType === 'reaction') {
      for (const kw of REACTION_KEYWORDS) {
        if (text.includes(kw)) return kw
      }
      return '反应'
    }
    if (shotType === 'action' || shotType === 'confrontation') {
      // 找战斗动作词
      for (const kw of ['挥剑', '出拳', '踢', '砍', '刺', '挡', '闪', '攻击', '冲锋', '追击']) {
        if (text.includes(kw)) return kw
      }
      return shotType === 'action' ? '激烈交锋' : '对峙'
    }

    return `${shotType}镜头`
  }

  /**
   * 格式化角色列表
   */
  private formatCharacterList(characters: string[]): string {
    if (characters.length === 0) return '未知角色'
    if (characters.length === 1) return characters[0]
    if (characters.length === 2) return `${characters[0]}与${characters[1]}`
    return `${characters.slice(0, 2).join('、')}等人`
  }

  /**
   * 智能格式化角色名：多 reveal 镜头时分配不同角色
   * 第一个 reveal → 角色0，第二个 reveal → 角色1，以此类推
   */
  private smartFormatChars(shotType: ShotType, index: number, characters: string[]): string {
    if (characters.length <= 1) return this.formatCharacterList(characters)
    if (shotType === 'reveal') {
      const charIdx = index % characters.length
      return characters[charIdx]
    }
    if (shotType === 'confrontation') {
      return this.formatCharacterList(characters)  // 对峙两人都在
    }
    return this.formatCharacterList(characters)
  }

  /**
   * 推断情绪基调
   */
  private inferMood(text: string): ShotMood {
    if (!text) return 'epic'
    for (const [keyword, mood] of Object.entries({
      '悲壮': 'tragic', '牺牲': 'tragic', '壮烈': 'tragic', '牺牲': 'tragic',
      '紧张': 'tense', '危急': 'tense', '紧迫': 'tense',
      '神秘': 'mysterious', '诡异': 'mysterious', '未知': 'mysterious',
      '神圣': 'solemn', '庄严': 'solemn', '肃穆': 'solemn',
      '快乐': 'joyful', '温暖': 'joyful', '温馨': 'joyful',
      '宁静': 'peaceful', '平静': 'peaceful', '安详': 'peaceful',
      '混乱': 'chaotic', '疯狂': 'chaotic',
      '梦幻': 'dreamy', '仙境': 'dreamy', '缥缈': 'dreamy',
      '恐怖': 'horror', '可怕': 'horror',
      '震撼': 'awe', '敬畏': 'awe',
    })) {
      if (text.includes(keyword)) return mood as ShotMood
    }
    if (text.match(/(大战|战斗|对决|神魔|天地|洪荒|宇宙|星辰|史诗|壮阔|宏大)/)) return 'epic'
    return 'peaceful'
  }

  /**
   * 推断能量弧
   */
  private inferEnergyArc(shots: ShotNode[]): string {
    const types = shots.map(s => s.shotType)
    if (types.includes('climax')) {
      if (types.includes('impact') && types.includes('confrontation')) {
        return '蓄势 → 爆发 → 高潮 → 余韵'
      }
      return '渐进 → 高潮 → 收束'
    }
    if (types.filter(t => t === 'action' || t === 'impact').length >= 3) {
      return '逐步升级 → 持续爆发 → 收束'
    }
    if (types.includes('dialogue')) {
      return '平静开局 → 暗流 → 收束'
    }
    return '渐进式'
  }

  /**
   * 估算镜头时长（根据场景类型和镜头位置微调）
   */
  private estimateDuration(shotType: ShotType, sceneType: SceneType, index: number, totalShots: number): number {
    const base: Record<ShotType, number> = {
      establishing:  5, reveal: 4, dialogue: 4, confrontation: 4,
      action: 3, impact: 3, climax: 5, transition: 2,
      reaction: 3, detail: 3, ending: 4,
    }

    let duration = base[shotType]

    // 战斗场景：动作/冲击更快
    if ((sceneType === 'battle' || sceneType === 'chase') && (shotType === 'action' || shotType === 'impact')) {
      duration = Math.max(duration - 1, 2)
    }

    // 结尾留白
    if (shotType === 'ending' && totalShots > 5) {
      duration += 1
    }

    return duration
  }
}

// Singleton
export const directorRuntime = new DirectorRuntime()
