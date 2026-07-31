// ─── Sprint-10C: CareerFactExtractor ───
// 从用户自然语言输入中提取职业信息，输出 Profile 增量更新
// LLM 不参与提取。所有字段由正则+规则提取

import {
  CareerIdentityProfile,
  IdentityProfileSkill,
  IdentityProfileWorkExperience,
  IdentityProfileConfirmedFact,
  SkillLevel,
} from './types'

/** 提取结果：可以 merge 到 Profile 的增量 */
export interface FactExtractionResult {
  identity?: { name?: string | null; age?: number | null; gender?: string | null }
  location?: { currentCity?: string | null; preferredCities?: string[] }
  education?: { degree?: string | null; school?: string | null; major?: string | null }
  career?: {
    currentStatus?: string | null
    targetPosition?: string | null
    targetIndustry?: string | null
    yearsExperience?: number | null
    careerDirection?: string | null
  }
  skills?: IdentityProfileSkill[]
  workExperience?: IdentityProfileWorkExperience[]
  projects?: Array<{ name: string; description: string; technology: string }>
  jobPreference?: { salary?: string | null; location?: string | null; remote?: boolean }
  /** 新增的 confirmedFacts */
  newFacts: IdentityProfileConfirmedFact[]
  /** 识别到的缺失字段提示 */
  detectedMissingHints: string[]
}

/**
 * 从用户消息中提取职业事实
 *
 * @param message 用户原始消息
 * @param currentProfile 当前 Profile（用于跳过已有字段）
 * @returns 增量更新
 */
export function extractFacts(
  message: string,
  currentProfile: CareerIdentityProfile
): FactExtractionResult {
  const newFacts: IdentityProfileConfirmedFact[] = []
  const detectedMissingHints: string[] = []
  const result: FactExtractionResult = { newFacts, detectedMissingHints }
  const now = new Date()

  // 1. 姓名
  if (!currentProfile.identity.name) {
    const name = extractName(message)
    if (name) {
      result.identity = { ...result.identity, name }
      newFacts.push({ field: 'name', value: name, source: 'user', createdAt: now })
    }
  }

  // 2. 年龄
  if (!currentProfile.identity.age) {
    const age = extractAge(message)
    if (age !== null) {
      result.identity = { ...result.identity, age }
      newFacts.push({ field: 'age', value: String(age), source: 'user', createdAt: now })
    }
  }

  // 3. 城市
  if (!currentProfile.location.currentCity) {
    const city = extractCity(message)
    if (city) {
      result.location = { ...result.location, currentCity: city }
      newFacts.push({ field: 'city', value: city, source: 'user', createdAt: now })
    }
  }

  // 4. 工作年限
  if (!currentProfile.career.yearsExperience) {
    const exp = extractExperienceYears(message)
    if (exp !== null) {
      result.career = { ...result.career, yearsExperience: exp }
      newFacts.push({ field: 'yearsExperience', value: String(exp), source: 'user', createdAt: now })
    }
  }

  // 5. 教育背景
  if (!currentProfile.education.school && !currentProfile.education.degree) {
    const edu = extractEducation(message)
    if (edu) {
      result.education = { ...(result.education || {}), ...edu }
      const parts = [edu.degree, edu.school, edu.major].filter(Boolean).join(' ')
      newFacts.push({ field: 'education', value: parts, source: 'user', createdAt: now })
    }
  }

  // 6. 技能
  const existingSkillNames = new Set(currentProfile.skills.map(s => s.name))
  const extractedSkills = extractSkills(message)
  const newSkills = extractedSkills.filter(s => !existingSkillNames.has(s.name))
  if (newSkills.length > 0) {
    result.skills = newSkills
    for (const s of newSkills) {
      newFacts.push({ field: 'skill', value: `${s.name} (${s.level})`, source: 'user', createdAt: now })
    }
  }

  // 7. 行业
  if (!currentProfile.career.targetIndustry) {
    const industry = extractIndustry(message)
    if (industry) {
      result.career = { ...(result.career || {}), targetIndustry: industry }
      newFacts.push({ field: 'industry', value: industry, source: 'user', createdAt: now })
    }
  }

  // 8. 目标岗位
  if (!currentProfile.career.targetPosition) {
    const position = extractTargetPosition(message)
    if (position) {
      result.career = { ...(result.career || {}), targetPosition: position }
      newFacts.push({ field: 'targetPosition', value: position, source: 'user', createdAt: now })
    }
  }

  // 9. 职业方向
  if (!currentProfile.career.careerDirection) {
    const direction = extractCareerDirection(message)
    if (direction) {
      result.career = { ...(result.career || {}), careerDirection: direction }
      newFacts.push({ field: 'careerDirection', value: direction, source: 'user', createdAt: now })
    }
  }

  // 10. 工作经历
  const extractedWork = extractWorkExperience(message)
  if (extractedWork.length > 0) {
    const existingKeys = new Set(
      currentProfile.workExperience.map(w => `${w.company}:${w.position}`)
    )
    const newWork = extractedWork.filter(w => !existingKeys.has(`${w.company}:${w.position}`))
    if (newWork.length > 0) {
      result.workExperience = newWork
      for (const w of newWork) {
        newFacts.push({
          field: 'workExperience',
          value: `${w.company} ${w.position} ${w.years ? w.years + '年' : ''}`.trim(),
          source: 'user',
          createdAt: now,
        })
      }
    }
  }

  // 11. 薪资期望
  if (!currentProfile.jobPreference.salary) {
    const salary = extractSalary(message)
    if (salary) {
      result.jobPreference = { ...(result.jobPreference || {}), salary }
      newFacts.push({ field: 'salary', value: salary, source: 'user', createdAt: now })
    }
  }

  // 检测提示词（用户暗示缺少什么信息）
  if (/适合什么岗位|能做什么|方向|转行/i.test(message) && !currentProfile.career.careerDirection) {
    detectedMissingHints.push('careerDirection')
  }
  if (/能去哪|哪个城市|工作地点/i.test(message) && !currentProfile.location.currentCity) {
    detectedMissingHints.push('city')
  }
  if (/还差什么|还需要什么|不够/i.test(message)) {
    detectedMissingHints.push('completeness')
  }

  return result
}

// ─── 提取器函数 ─────────────────────────────

/** 姓名提取 */
function extractName(message: string): string | null {
  // "我叫李雷" "我是李雷" "名字是李雷" "李雷"
  const patterns = [
    /我(?:叫|是|名字是|姓名是)([\u4e00-\u9fa5]{2,4})/,
    /(?:我叫|我是)([\u4e00-\u9fa5]{2,4})[，,。\s]*(?:今年|\d|岁|做|在|来自|来)/,
  ]
  for (const p of patterns) {
    const m = message.match(p)
    if (m && m[1]) return m[1]
  }
  return null
}

/** 年龄提取 */
function extractAge(message: string): number | null {
  const m = message.match(/(?:今年|我|已)?(\d{2})(?:岁|周岁|岁了)/)
  if (m) {
    const age = parseInt(m[1])
    if (age >= 15 && age <= 80) return age
  }
  return null
}

/** 城市提取 */
function extractCity(message: string): string | null {
  // 中国主要城市
  const cities = [
    '北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京',
    '重庆', '天津', '苏州', '西安', '长沙', '郑州', '东莞', '青岛',
    '合肥', '佛山', '宁波', '昆明', '沈阳', '大连', '厦门', '福州',
    '哈尔滨', '济南', '温州', '南宁', '长春', '泉州', '石家庄',
    '贵阳', '太原', '南昌', '无锡', '常州', '嘉兴', '珠海', '中山',
    '兰州', '海口', '三亚', '呼和浩特', '乌鲁木齐', '贵阳',
  ]
  const triggerPatterns = [
    /(?:在|期望|想在|打算去|目标|希望)(?:在|去)?(北京|上海|广州|深圳|[A-Za-z\u4e00-\u9fa5]{2,3}(?:市)?)(?:上班|工作|就业|发展|找工作)/,
    /(?:在|期望|想在|打算去|目标|希望)(?:在|去)?(北京|上海|广州|深圳|[A-Za-z\u4e00-\u9fa5]{2,3}(?:市)?)/,
    /(?:目前|现在)(?:在|位于|住)(北京|上海|广州|深圳|[A-Za-z\u4e00-\u9fa5]{2,4}(?:市)?)/,
  ]
  for (const p of triggerPatterns) {
    const m = message.match(p)
    if (m && m[1]) {
      const raw = m[1].replace(/市$/, '')
      if (cities.includes(raw)) return raw
    }
  }
  // 直接匹配城市名
  for (const city of cities) {
    if (message.includes(city)) return city
  }
  return null
}

/** 工作年限提取 */
function extractExperienceYears(message: string): number | null {
  // 优先级 1: 精确模式（工作 + 数字 + 年）
  const exactPatterns = [
    /(?:工作|从业|做[^，,。]{0,10}?)(?:经验|经历|年限)?[的]?(\d{1,2})(?:年|年多)/,
    /(\d{1,2})(?:年|年多)(?:工作|从业|经验|经历)/,
    /工作[了]?(\d{1,2})年/,
  ]
  for (const p of exactPatterns) {
    const m = message.match(p)
    if (m) {
      const exp = parseInt(m[1])
      if (exp >= 1 && exp <= 60) return exp
    }
  }

  // 优先级 2: 通用模式（任何数字+年，排除年龄上下文）
  const yearMatches = message.matchAll(/(\d{1,2})年/g)
  for (const m of yearMatches) {
    const num = parseInt(m[1])
    if (num < 1 || num > 60) continue
    const idx = m.index!
    const prefix5 = message.slice(Math.max(0, idx - 5), idx)
    const suffix10 = message.slice(idx, Math.min(message.length, idx + 15))
    const ctx = prefix5 + suffix10
    // 排除年龄: "XX岁" "今年XX" "快XX"
    if (/岁/.test(ctx) && !/工作/.test(ctx)) continue
    if (/今年|我\d+岁|快\d+/.test(ctx)) continue
    // 确认是工作年限: 包含工作/开发/做/经验等关键词
    if (/工作|开发|做|从业|经验|经历|年架构|年设计|年管理|年产品/.test(ctx)) {
      return num
    }
  }

  return null
}

/** 教育背景提取 */
function extractEducation(message: string): { degree?: string; school?: string; major?: string } | null {
  const result: { degree?: string; school?: string; major?: string } = {}
  let found = false

  // 大学/学校
  const schoolPatterns = [
    /(清华大学|北京大学|复旦大学|上海交通大学|浙江大学|南京大学|武汉大学|中山大学|华中科技大学|西安交通大学|四川大学|哈尔滨工业大学|北京航空航天大学|同济大学|南开大学|天津大学|山东大学|东南大学|吉林大学|厦门大学|华南理工大学|大连理工大学|西北工业大学|华东师范大学|中国科学技术大学|北京理工大学|中南大学|湖南大学|重庆大学|电子科技大学|兰州大学|东北大学|中国农业大学|北京师范大学|中国人民大学|苏州大学|郑州大学|深圳大学|南方科技大学|香港大学|香港中文大学|香港科技大学|中国科学院大学)/,
    /([\u4e00-\u9fa5]{2,20}(?:大学|学院|学校|技术学院|职业技术学院))/,
  ]
  for (const p of schoolPatterns) {
    const m = message.match(p)
    if (m && m[1]) {
      result.school = m[1]
      found = true
      break
    }
  }

  // 学位
  const degreePattern = /(博士|硕士|本科|大专|中专|高中|初中|研究生|学士)/
  const dm = message.match(degreePattern)
  if (dm) {
    result.degree = dm[1]
    found = true
  }

  // 专业
  const majorPattern = /(?:学的是|读的是|专业[是：:]|主修)([\u4e00-\u9fa5a-zA-Z]{2,20}(?:专业|工程|科学|学))/
  const mm = message.match(majorPattern)
  if (mm) {
    result.major = mm[1]
    found = true
  }

  // "XXX专业" 模式（独立出现）
  if (!result.major) {
    const mm2 = message.match(/([\u4e00-\u9fa5a-zA-Z]{2,20})专业/)
    if (mm2 && result.school) {
      result.major = mm2[1] + '专业'
      found = true
    }
  }

  return found ? result : null
}

/** 技能提取 */
function extractSkills(message: string): IdentityProfileSkill[] {
  const skills: IdentityProfileSkill[] = []

  // 触发词模式
  const triggerRegex = /(?:会|懂|擅长|做过|用过|熟悉|了解|掌握|精通|熟练|做|搞|负责)([^，,。]{2,30})/g
  let match: RegExpExecArray | null
  while ((match = triggerRegex.exec(message)) !== null) {
    const phrase = match[1].trim()
    // 分解短语中的技能
    const parts = phrase.split(/[,，、/&\s+]/).filter(Boolean)
    for (const part of parts) {
      if (part.length >= 2 && part.length <= 30 && !isNonSkillWord(part)) {
        const level = detectSkillLevel(phrase, part)
        if (!skills.some(s => s.name === part)) {
          skills.push({ name: part, level, evidence: match[0] })
        }
      }
    }
  }

  // 技术栈模式（"Python开发" "AI大模型"等）
  const techPatterns = [
    /(Java|Python|JavaScript|TypeScript|Go|Rust|C\+\+|C#|PHP|Ruby|Swift|Kotlin|Scala)/g,
    /(AI|人工智能|大模型|机器学|深度学习|NLP|自然语言|计算机视觉|CV|强化学习)/g,
    /(前端|后端|全栈|移动端|桌面端|嵌入式|架构|运维|DevOps|测试)/g,
    /(React|Vue|Angular|Node\.?js|Spring|Django|Flask|FastAPI|PyTorch|TensorFlow)/g,
    /(Docker|Kubernetes|K8s|AWS|Azure|GCP|阿里云|腾讯云)/g,
    /(MySQL|PostgreSQL|MongoDB|Redis|Elasticsearch|Kafka)/g,
  ]
  for (const pattern of techPatterns) {
    while ((match = pattern.exec(message)) !== null) {
      const name = match[1]
      if (!skills.some(s => s.name === name)) {
        skills.push({ name, level: detectSkillLevel(message, name), evidence: match[0] })
      }
    }
  }

  // 去重：如果某个技能是另一个技能的子串，则去掉（"AI" ⊆ "AI大模型" → 去"AI"）
  return deduplicateSkills(skills)
}

/** 技能去重：移除子串重叠项 */
function deduplicateSkills(skills: IdentityProfileSkill[]): IdentityProfileSkill[] {
  const sorted = [...skills].sort((a, b) => b.name.length - a.name.length)
  const result: IdentityProfileSkill[] = []
  for (const skill of sorted) {
    // 如果已有技能包含当前技能名，跳过
    if (result.some(s => s.name.includes(skill.name) && s.name !== skill.name)) {
      continue
    }
    // 如果当前技能名包含已有技能，替换
    const existingIdx = result.findIndex(s => skill.name.includes(s.name))
    if (existingIdx >= 0) {
      result[existingIdx] = skill
    } else {
      result.push(skill)
    }
  }
  return result
}

/** 非技能词过滤 */
function isNonSkillWord(word: string): boolean {
  const stopWords = new Set([
    '这个', '那个', '什么', '怎么', '这么', '那么', '哪个', '那些',
    '这些', '很多', '一些', '几个', '各种', '相关', '方面', '领域',
    '事情', '工作', '东西', '时候', '的话', '还是', '就是', '可以',
    '比较', '非常', '还是', '有点', '肯定', '确实', '完全', '刚刚',
  ])
  return stopWords.has(word)
}

/** 技能等级检测（基于上下文关键词） */
function detectSkillLevel(message: string, skillName: string): SkillLevel {
  if (new RegExp(`精通.*${skillName}|${skillName}.*精通|非常熟练`).test(message)) return 'expert'
  if (new RegExp(`擅长.*${skillName}|${skillName}.*擅长|熟悉`).test(message)) return 'intermediate'
  if (new RegExp(`了解.*${skillName}|${skillName}.*了解|接触过|用过|做过`).test(message)) return 'beginner'
  return 'intermediate'
}

/** 行业提取 */
function extractIndustry(message: string): string | null {
  const industries = [
    '互联网', '金融', '医疗', '教育', '电商', '游戏', 'AI', '人工智能',
    '区块链', '物联网', '云计算', '大数据', '安全', '企业服务', 'SaaS',
    '消费', '零售', '房地产', '建筑', '制造', '能源', '交通', '物流',
    '媒体', '广告', '娱乐', '文化', '旅游', '餐饮', '农业', '军工',
  ]
  for (const ind of industries) {
    if (message.includes(ind) || message.includes(ind + '行业') || message.includes(ind + '领域')) {
      return ind
    }
  }
  // 模式匹配
  const m = message.match(/(?:从事|做|在|进入|深耕)(.*?)(?:行业|领域)/)
  if (m && m[1].length >= 2 && m[1].length <= 10) return m[1]
  return null
}

/** 目标岗位提取 */
function extractTargetPosition(message: string): string | null {
  const patterns = [
    /(?:想|要|去|打算|希望)(?:做|当|搞|成为|找)(.*?)(?:的?[工作岗职位])/,
    /(?:目标|期望|求职)(?:方向|岗位|职位)[：:是]*(.*?)(?:[，,。]|$)/,
    /(?:目标|梦想|理想)是(?:做|当|成为|做)(.*?)(?:[，,。]|$)/,
    /(?:找|寻求|求)(.*?)(?:工作|岗位|职位|机会)/,
  ]
  // 常见的职位
  const positions = [
    '技术总监', 'CTO', '技术经理', '架构师', '技术负责人',
    '产品经理', '产品总监', '产品负责人',
    '前端开发', '后端开发', '全栈', '运维', '测试',
    'AI工程师', '算法工程师', '数据科学家', '数据工程师',
    '项目经理', '运营', '市场', '销售', 'HR',
    'PHP开发', 'Java开发', 'Python开发', 'Go开发',
    'UI设计', 'UX设计', '视觉设计', '产品设计',
  ]
  for (const p of patterns) {
    const m = message.match(p)
    if (m && m[1]) {
      const pos = m[1].trim()
      if (positions.includes(pos)) return pos
      // 模糊匹配
      for (const known of positions) {
        if (pos.includes(known) || known.includes(pos)) return known
      }
      if (pos.length >= 2 && pos.length <= 15) return pos
    }
  }
  // 直接职位检测
  for (const pos of positions) {
    if (message.includes(pos)) return pos
  }
  return null
}

/** 职业方向提取 */
function extractCareerDirection(message: string): string | null {
  // "做XX方向" "XX方向" "偏向XX"
  const patterns = [
    /(?:做|搞|从事|偏向|想)(.*?)(?:方向|开发的|工程|设计)/,
    /(?:方向是|方向[：:])(.*?)(?:[，,。]|$)/,
  ]
  for (const p of patterns) {
    const m = message.match(p)
    if (m && m[1]) {
      const d = m[1].trim()
      if (d.length >= 2 && d.length <= 20) return d
    }
  }
  return null
}

/** 工作经历提取 */
function extractWorkExperience(message: string): Array<{
  company: string; position: string; years: number; description: string; achievements: string[]
}> {
  const entries: Array<{
    company: string; position: string; years: number; description: string; achievements: string[]
  }> = []

  // "在XX公司做YY（Z年）" 模式
  const pattern1 = /在([\u4e00-\u9fa5a-zA-Z]{2,20})(?:公司|企业|集团|单位)?(?:做|担任|干了|工作了|负责|任职)?\s*([\u4e00-\u9fa5a-zA-Z]{2,20})?(?:的)?(?:工作|岗位|职位)?(?:[，,])?(?:干了)?(\d{1,2})?(?:年|年多)?/
  let m = message.match(pattern1)
  if (m) {
    entries.push({
      company: m[1] + (m[1].includes('公司') ? '' : '公司'),
      position: m[2] || '',
      years: m[3] ? parseInt(m[3]) : 0,
      description: '',
      achievements: [],
    })
  }

  return entries
}

/** 薪资提取 */
function extractSalary(message: string): string | null {
  const patterns = [
    // "期望薪资60万" "期望待遇80W" "期望年薪100万"
    /(?:期望|希望|想要|目标)(?:薪资|待遇|薪酬|工资|年薪|月薪)[：:〜\-\u2014\s]*(\d{2,8})(?:[万wW千kK])?(?:[以/]?(?:上|月|年))?/,
    // "月薪/年薪/薪资 XX万" 模式
    /(?:月薪|年薪|薪资)(?:是|在|：|:)?[的]?(\d{2,8})([万wW千kK]?)(?:[以/]?(?:上|下|月|年))?/,
    // "60万年薪" "100万薪资"
    /(\d{2,8})([万wW])[元]?(?:年薪|月薪|薪资|每年|每月)/,
    // "XX万"
    /(\d{2,8})万(?:元)?(?:年薪|月薪|薪资)?/,
  ]
  for (const p of patterns) {
    const m = message.match(p)
    if (m) {
      const num = parseInt(m[1])
      if (num >= 5 && num <= 999) return m[0].trim() // 5-999万
    }
  }
  return null
}
