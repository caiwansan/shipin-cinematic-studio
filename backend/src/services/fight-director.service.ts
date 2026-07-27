// ============================================================
// fight-director.service.ts — 打斗场景智能编排核心
// 双模式：LLM 模式（需用户 API Key） / 模板模式（免 Key）
// ============================================================

// ─── 内联类型 ───
type ActionPhase = 'buildup' | 'confront' | 'clash' | 'stalemate' | 'finish'

interface FightShot {
  id: string
  phase: ActionPhase
  phaseOrder: number
  camera: string
  action: string
  physics?: string
  chars: string[]
  duration: number
  positioning?: string
}

interface FightPhase {
  name: ActionPhase
  label: string
  shots: FightShot[]
}

interface FightStoryboard {
  fightType: string
  characters: string[]
  phases: FightPhase[]
  totalDuration: number
  templateName: string
}

interface CharacterInfo {
  name: string
  description: string
  physicalDescription: string
  clothing: string
  weapon?: string
  fightingStyle?: string
  imageUrl: string
}

interface SceneInfo {
  name: string
  description: string
  imageUrl?: string
}

interface FightDirectorInput {
  fightType: string
  storyText: string
  characters: CharacterInfo[]
  scene?: SceneInfo
  shotCount?: number
}

interface PhaseTemplate {
  phase: ActionPhase
  label: string
  cameraOptions: string[]
  actionTemplate: string
}

// ═══════════════════════════════════════════════════════════
// 模式1：模板模式 — 免 Key，基于规则组合出分镜
// ═══════════════════════════════════════════════════════════

const templates: Record<string, {
  phases: PhaseTemplate[]
  shotCountRange: [number, number]
  spacing: string
}> = {
  duel: {
    phases: [
      { phase: 'buildup', label: '蓄力', cameraOptions: ['低机位仰拍', '特写脸部表情', '背拍全身'], actionTemplate: '双腿分开微屈压低重心' },
      { phase: 'confront', label: '对峙', cameraOptions: ['水平中景双人同框', '侧向平移', '慢速环绕'], actionTemplate: '围绕对方缓步移动，视线锁定对手' },
      { phase: 'clash', label: '交锋', cameraOptions: ['侧向高速跟拍', '特写武器碰撞', '低机位跟随脚步'], actionTemplate: '爆发前冲，挥击/格挡，力量碰撞' },
      { phase: 'stalemate', label: '僵持', cameraOptions: ['环绕旋转镜', '特写手臂肌肉震颤', '侧拍重心角力'], actionTemplate: '兵器/拳脚相抵，身体颤抖发力' },
      { phase: 'finish', label: '决胜', cameraOptions: ['慢动作特写', '拉远全景', '升格慢镜'], actionTemplate: '决定性一击，胜负分明' },
    ],
    shotCountRange: [6, 10],
    spacing: '蓄力展现角色气势，对峙制造紧张感，交锋爆发动作高潮，决胜给出收束',
  },
  'group-fight': {
    phases: [
      { phase: 'buildup', label: '蓄力', cameraOptions: ['全景摇摄', '高空俯拍', '横移展示全场'], actionTemplate: '所有角色进入战斗位置，摆出架势' },
      { phase: 'confront', label: '对峙', cameraOptions: ['中景横移', '快速切换焦点', '旋转展示全景'], actionTemplate: '角色之间互相试探，寻找破绽' },
      { phase: 'clash', label: '交锋', cameraOptions: ['特写跟随主战角色', '全景展示混战格局', '侧向平移跟拍'], actionTemplate: '前冲锋，激烈打击，角色A vs 角色B' },
      { phase: 'stalemate', label: '僵持', cameraOptions: ['360度环绕全景', '中景多角色同框', '快速切换视角'], actionTemplate: '多方互相牵制，战局胶着' },
      { phase: 'finish', label: '决胜', cameraOptions: ['拉远全景', '升格慢镜头', '特写最后动作'], actionTemplate: '关键角色突围/击败对手，战局明朗' },
    ],
    shotCountRange: [8, 14],
    spacing: '全景交代→聚焦主战→多线展开→决胜收束',
  },
  chase: {
    phases: [
      { phase: 'buildup', label: '蓄力', cameraOptions: ['侧面跟拍', '前置镜头引导', '俯拍追踪'], actionTemplate: '追逐开始，追击者加速冲刺' },
      { phase: 'confront', label: '对峙', cameraOptions: ['前置+后置交替', '侧向横移', '穿越障碍低机位'], actionTemplate: '穿越环境障碍，追逃之间保持距离' },
      { phase: 'clash', label: '交锋', cameraOptions: ['推近镜头', '特写手脚动作', '快速摇摄转场'], actionTemplate: '追及/拦截发生，近身接触' },
      { phase: 'finish', label: '决胜', cameraOptions: ['拉远全景', '升格慢镜头', '特写胜负瞬间'], actionTemplate: '拦截成功或逃脱，追逐结束' },
    ],
    shotCountRange: [6, 10],
    spacing: '确立追逐→环境穿越→接触交锋→结局定论',
  },
  battle: {
    phases: [
      { phase: 'buildup', label: '蓄力', cameraOptions: ['高空俯拍', '广角全景', '横移展示阵型'], actionTemplate: '双方军队列阵，旗帜飘扬，气势凝重' },
      { phase: 'confront', label: '对峙', cameraOptions: ['水平中景', '推近特写指挥官', '旋转展示军队'], actionTemplate: '先锋部队前压，弓弩手/法师准备' },
      { phase: 'clash', label: '交锋', cameraOptions: ['全景冲锋线', '特写单兵战斗', '低机位跟随步兵'], actionTemplate: '全军冲锋，前锋碰撞，混战开始' },
      { phase: 'stalemate', label: '僵持', cameraOptions: ['高空俯拍全局', '中景展示胶着线', '快速切换战场焦点'], actionTemplate: '战线拉锯，伤亡增加，局势不明' },
      { phase: 'finish', label: '决胜', cameraOptions: ['拉远全景', '升格慢镜头', '定焦胜负手'], actionTemplate: '骑兵/精锐部队冲出，决定战局胜负' },
    ],
    shotCountRange: [10, 16],
    spacing: '列阵→前压→冲锋→拉锯→决胜',
  },
}

function templateGenerate(input: FightDirectorInput): FightStoryboard {
  const tpl = templates[input.fightType] || templates.duel
  const shotCount = input.shotCount || Math.round((tpl.shotCountRange[0] + tpl.shotCountRange[1]) / 2)
  const charNames = input.characters.map(c => c.name)

  // 按比例分配镜头到各阶段
  const phaseCounts: Record<string, number> = {}
  const totalPhases = tpl.phases.length
  let remaining = Math.floor(shotCount)
  for (let i = 0; i < totalPhases; i++) {
    if (i === totalPhases - 1) {
      phaseCounts[tpl.phases[i].phase] = remaining
    } else {
      const n = Math.max(1, Math.floor(shotCount / totalPhases))
      phaseCounts[tpl.phases[i].phase] = n
      remaining -= n
    }
  }

  let globalShotIdx = 0
  const phases: FightPhase[] = tpl.phases.map((pt) => {
    const count = phaseCounts[pt.phase] || 1
    const shots: FightShot[] = []
    for (let j = 0; j < count; j++) {
      const camera = pt.cameraOptions[j % pt.cameraOptions.length]
      const mainChars = charNames.slice(0, Math.min(charNames.length, 2))
      const physicsHints = ['肌肉紧绷颤抖', '重心压低', '脚步震颤', '呼吸急促', '力量贯穿全身']
      const physics = physicsHints[j % physicsHints.length]

      shots.push({
        id: `shot_${globalShotIdx}`,
        phase: pt.phase,
        phaseOrder: j + 1,
        camera,
        action: `${pt.actionTemplate}（镜头${globalShotIdx + 1}）`,
        physics,
        chars: j % 2 === 0 ? mainChars : charNames,
        duration: 3 + (j % 2),
        positioning: j % 2 === 0 ? `${charNames[0] || ''}左 ${charNames[1] || ''}右` : `${charNames.join('、')}占据画面`,
      })
      globalShotIdx++
    }
    return { name: pt.phase as ActionPhase, label: pt.label, shots }
  })

  const totalDuration = phases.reduce((sum, p) => sum + p.shots.reduce((s, sh) => s + sh.duration, 0), 0)

  return {
    fightType: input.fightType,
    characters: charNames,
    phases,
    totalDuration,
    templateName: `模板:${input.fightType}`,
  }
}

// ═══════════════════════════════════════════════════════════
// 模式2：LLM 模式 — 需要用户 API Key
// ═══════════════════════════════════════════════════════════

async function llmGenerate(input: FightDirectorInput, apiKey: string): Promise<FightStoryboard> {
  const tpl = templates[input.fightType] || templates.duel
  const charInfo = input.characters.map((c, i) =>
    `角色${String.fromCharCode(65 + i)}（${c.name}）：${c.description || ''}${c.physicalDescription ? `，外貌：${c.physicalDescription}` : ''}${c.clothing ? `，服装：${c.clothing}` : ''}${c.weapon ? `，武器：${c.weapon}` : ''}${c.fightingStyle ? `，风格：${c.fightingStyle}` : ''}`
  ).join('\n')

  const systemPrompt = `你是一个顶级动作片导演。任务：为以下场景设计打斗分镜图谱。

## 参数
- 战斗类型：${input.fightType}
- 故事：${input.storyText.slice(0, 300)}
- 角色：${input.characters.length} 位
${input.scene ? `- 场景：${input.scene.name} - ${input.scene.description}` : ''}

## 角色
${charInfo}

## 设计心法
1. 描述物理受力：蓄力、震颤、反弹、重心
2. 空间锚定：说清谁在左/右/前/后
3. 编号区分：提示词中用「角色A」「角色B」
4. 角色差异要大

## 输出 JSON（不要多余文字）
{ "phases": [{ "phase": "buildup|confront|clash|stalemate|finish", "shots": [{ "camera": "...", "action": "...", "physics": "...", "chars": ["角色A"], "duration": 3, "positioning": "..." }] }] }`

  const { genericLLM } = await import('./deepseek-llm.provider.js')
  const result = await genericLLM.chat({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `为 ${input.characters.map(c => c.name).join(' vs ')} 设计打斗分镜，${input.storyText.slice(0, 200)}` },
    ],
    model: 'deepseek-v4-flash',
    apiKey,
    provider: 'deepseek',
    temperature: 0.7,
    max_tokens: 4096,
  })

  let raw: string
  if (typeof result === 'string') {
    raw = result
  } else if (result && typeof result === 'object') {
    raw = (result as any).choices?.[0]?.message?.content || (result as any).content || JSON.stringify(result)
  } else {
    throw new Error('LLM 返回格式异常')
  }

  // 解析 JSON
  let parsed: any
  try {
    const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    parsed = JSON.parse(m ? m[1] : raw)
  } catch {
    throw new Error('LLM 返回格式异常')
  }

  const phases: FightPhase[] = (parsed.phases || []).map((p: any, pi: number) => ({
    name: p.phase,
    label: p.phase,
    shots: (p.shots || []).map((s: any, si: number) => ({
      id: `shot_${pi}_${si}`,
      phase: p.phase,
      phaseOrder: si + 1,
      camera: s.camera || '',
      action: s.action || '',
      physics: s.physics || '',
      chars: s.chars || [],
      duration: s.duration || 3,
      positioning: s.positioning || '',
    })),
  }))

  const totalDuration = phases.reduce((s, p) => s + p.shots.reduce((ss, sh) => ss + sh.duration, 0), 0)

  return {
    fightType: input.fightType,
    characters: input.characters.map(c => c.name),
    phases,
    totalDuration,
    templateName: `LLM:${input.fightType}`,
  }
}

// ═══════════════════════════════════════════════════════════
// 对外接口：自动选择模式
// ═══════════════════════════════════════════════════════════

export async function generateFightStoryboard(
  input: FightDirectorInput,
  apiKey?: string
): Promise<FightStoryboard> {
  if (apiKey) {
    try {
      const result = await llmGenerate(input, apiKey)
      return result
    } catch (e: any) {
      console.warn('[FightDirector] LLM 模式失败，回退模板模式:', e.message)
      return templateGenerate(input)
    }
  }
  return templateGenerate(input)
}

export { templates, templateGenerate }
