/**
 * Phase 3-B2: Career Knowledge Repository v1.0
 * 
 * 升级 Schema：
 * 1. Skill → Competency（技能只是能力的一种）
 * 2. Career 新增：Transition / Fit / Trend / Salary / Learning Link
 * 3. 所有知识对象强制 Metadata
 * 4. Learning Repository（学习资源）
 */

import type { CareerCanonicalObject, SkillCanonicalObject } from '../../canonical/schemas'

// ─── 职业ID常量 ───

export const CAREER_IDS = {
  // AI
  ai_engineer: 'cco_ai_engineer',
  ai_pm: 'cco_ai_product_manager',
  ai_algorithm: 'cco_ai_algorithm',
  ai_trainer: 'cco_ai_trainer',
  prompt_engineer: 'cco_prompt_engineer',
  agent_engineer: 'cco_agent_engineer',
  
  // 软件
  frontend: 'cco_frontend_engineer',
  backend: 'cco_backend_engineer',
  fullstack: 'cco_fullstack_engineer',
  qa: 'cco_qa_engineer',
  devops: 'cco_devops',
  
  // 内容
  new_media: 'cco_new_media',
  short_video: 'cco_short_video',
  ad_planner: 'cco_ad_planner',
  ecommerce: 'cco_ecommerce',
  
  // 创意
  screenwriter: 'cco_screenwriter',
  director: 'cco_director',
  video_editor: 'cco_video_editor',
  music_producer: 'cco_music_producer',
  
  // 商业
  product_manager: 'cco_product_manager',
  project_manager: 'cco_project_manager',
} as const

// ─── Career Fit 权重 ───

export interface CareerFit {
  logicalThinking: number    // 逻辑思维 1-5
  communication: number      // 沟通能力 1-5
  creativity: number         // 创造力 1-5
  execution: number          // 执行力 1-5
  leadership: number         // 领导力 1-5
  analyticalSkill: number    // 分析能力 1-5
}

// ─── Career Transition ───

export interface CareerTransition {
  fromCareer: string
  toCareer: string
  difficulty: 1 | 2 | 3 | 4 | 5     // 学习成本 ★~★★★★★
  successRate: number               // 0-100%
  estimatedMonths: number           // 预计时间（月）
  keyGapSkills: string[]            // 需要补充的关键技能ID
}

// ─── Learning Link ───

export interface LearningLink {
  type: 'course' | 'book' | 'project' | 'practice' | 'certification'
  name: string
  url?: string
  level: 'beginner' | 'intermediate' | 'advanced'
  free: boolean
  duration?: string
  description: string
}

// ─── Salary Reference ───

export interface SalaryReference {
  level: 'entry' | 'mid' | 'senior' | 'lead'
  range: string           // e.g. "25K~35K"
  cityTier: 'tier1' | 'new-tier1' | 'tier2' | 'tier3'
  source: string
  confidence: number
  updatedAt: string
}

// ─── Growth Trend ───

export interface GrowthTrend {
  year: number
  quarter: number
  demandIndex: number     // 需求指数 0-100
  salaryGrowth: number    // 薪资增长率 %
  source: string
}

// ─── 20个核心职业定义 ───

export const CORE_CAREERS: CareerCanonicalObject[] = [
  // ========== AI ==========
  {
    id: CAREER_IDS.ai_engineer,
    version: '1.0.0',
    name: 'AI应用工程师',
    aliases: ['AI应用开发', 'AI Engineer', 'LLM Engineer', '大模型应用工程师'],
    category: '技术',
    subcategory: 'AI工程',
    description: '构建基于大语言模型的应用系统，包括 RAG、Agent、Prompt Engineering 等',
    requiredSkills: [
      { skillId: 'sco_ai_fundamentals', weight: 1.0 },
      { skillId: 'sco_prompt_engineering', weight: 1.0 },
      { skillId: 'sco_langchain', weight: 0.9 },
      { skillId: 'sco_rag', weight: 0.9 },
      { skillId: 'sco_agent_design', weight: 0.8 },
      { skillId: 'sco_python', weight: 0.9 },
      { skillId: 'sco_vector_database', weight: 0.7 },
      { skillId: 'sco_docker', weight: 0.5 },
    ],
    relatedCareers: [
      { careerId: CAREER_IDS.ai_pm, weight: 0.7, type: "related" as const },
      { careerId: CAREER_IDS.agent_engineer, weight: 0.9, type: "related" as const },
      { careerId: CAREER_IDS.backend, weight: 0.7, type: "related" as const },
    ],
    salaryByLevel: [
      { level: 'entry', range: '15K~25K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.85, updatedAt: '2026-04-01' },
      { level: 'mid', range: '25K~40K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.85, updatedAt: '2026-04-01' },
      { level: 'senior', range: '40K~70K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.85, updatedAt: '2026-04-01' },
    ],
    growthTrend: [
      { year: 2026, quarter: 2, demandIndex: 95, salaryGrowth: 18.5, source: '2026Q2 AI人才报告' },
      { year: 2026, quarter: 1, demandIndex: 90, salaryGrowth: 15.0, source: '2026Q1 AI人才报告' },
    ],
    fitProfile: {
      logicalThinking: 5,
      communication: 3,
      creativity: 4,
      execution: 4,
      leadership: 3,
      analyticalSkill: 5,
    },
    transitions: [
      { fromCareer: CAREER_IDS.backend, toCareer: CAREER_IDS.ai_engineer, difficulty: 4, successRate: 78, estimatedMonths: 6, keyGapSkills: ['sco_prompt_engineering', 'sco_langchain', 'sco_rag'] },
      { fromCareer: CAREER_IDS.frontend, toCareer: CAREER_IDS.ai_engineer, difficulty: 5, successRate: 65, estimatedMonths: 9, keyGapSkills: ['sco_python', 'sco_ai_fundamentals', 'sco_langchain'] },
      { fromCareer: CAREER_IDS.ai_algorithm, toCareer: CAREER_IDS.ai_engineer, difficulty: 2, successRate: 92, estimatedMonths: 3, keyGapSkills: ['sco_langchain', 'sco_docker'] },
    ],
    learningLinks: [
      { type: 'course', name: 'LangChain for LLM Application Development', level: 'intermediate', free: false, duration: '20小时', description: 'DeepLearning.AI 出品，系统学习 LangChain 框架' },
      { type: 'course', name: 'Building Systems with ChatGPT API', level: 'intermediate', free: false, duration: '10小时', description: '从零构建生产级 AI 应用' },
      { type: 'project', name: '构建个人知识库 RAG 系统', level: 'intermediate', free: true, duration: '2周', description: '使用 LangChain + Milvus 搭建个人知识库' },
      { type: 'book', name: 'Build a Large Language Model (From Scratch)', level: 'advanced', free: false, description: 'Sebastian Raschka 著，深入理解 LLM 原理' },
    ],
    status: 'active',
    evidence: [{ type: 'expert', source: '人工维护', date: '2026-01-01', confidence: 0.95 }],
    source: '人工维护',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: CAREER_IDS.ai_pm,
    version: '1.0.0',
    name: 'AI产品经理',
    aliases: ['AI PM', '智能产品经理', '大模型产品经理', 'AIPM'],
    category: '产品',
    subcategory: 'AI产品',
    description: '负责人工智能产品的规划、设计和落地，连接技术与用户需求',
    requiredSkills: [
      { skillId: 'sco_prompt_engineering', weight: 0.9 },
      { skillId: 'sco_product_thinking', weight: 1.0 },
      { skillId: 'sco_user_research', weight: 0.8 },
      { skillId: 'sco_data_driven', weight: 0.9 },
      { skillId: 'sco_communication', weight: 0.9 },
      { skillId: 'sco_ai_fundamentals', weight: 0.7 },
    ],
    relatedCareers: [
      { careerId: CAREER_IDS.ai_engineer, weight: 0.7, type: "related" as const },
      { careerId: CAREER_IDS.product_manager, weight: 0.8, type: "related" as const },
    ],
    salaryByLevel: [
      { level: 'entry', range: '18K~28K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.85, updatedAt: '2026-04-01' },
      { level: 'mid', range: '28K~45K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.85, updatedAt: '2026-04-01' },
      { level: 'senior', range: '45K~80K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.85, updatedAt: '2026-04-01' },
    ],
    growthTrend: [
      { year: 2026, quarter: 2, demandIndex: 92, salaryGrowth: 22.0, source: '2026Q2 AI人才报告' },
    ],
    fitProfile: {
      logicalThinking: 4,
      communication: 5,
      creativity: 5,
      execution: 4,
      leadership: 4,
      analyticalSkill: 4,
    },
    transitions: [
      { fromCareer: CAREER_IDS.product_manager, toCareer: CAREER_IDS.ai_pm, difficulty: 2, successRate: 88, estimatedMonths: 3, keyGapSkills: ['sco_prompt_engineering', 'sco_ai_fundamentals'] },
      { fromCareer: CAREER_IDS.ai_engineer, toCareer: CAREER_IDS.ai_pm, difficulty: 3, successRate: 72, estimatedMonths: 6, keyGapSkills: ['sco_product_thinking', 'sco_user_research'] },
    ],
    learningLinks: [
      { type: 'course', name: 'AI Product Management Specialization', level: 'intermediate', free: false, duration: '40小时', description: '学习 AI 产品从0到1的全流程' },
      { type: 'book', name: 'AI Product Management', level: 'intermediate', free: false, description: '系统学习 AI PM 方法论' },
    ],
    status: 'active',
    evidence: [{ type: 'expert', source: '人工维护', date: '2026-01-01', confidence: 0.9 }],
    source: '人工维护',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: CAREER_IDS.ai_algorithm,
    version: '1.0.0',
    name: 'AI算法工程师',
    aliases: ['算法工程师', 'ML Engineer', '机器学习工程师', '深度学习工程师'],
    category: '技术',
    subcategory: 'AI算法',
    description: '设计和优化机器学习/深度学习算法，解决计算机视觉、NLP、推荐等问题',
    requiredSkills: [
      { skillId: 'sco_ai_fundamentals', weight: 1.0 },
      { skillId: 'sco_python', weight: 1.0 },
      { skillId: 'sco_pandas', weight: 0.7 },
      { skillId: 'sco_numpy', weight: 0.8 },
      { skillId: 'sco_statistics', weight: 0.9 },
      { skillId: 'sco_llm_fine_tuning', weight: 0.8 },
    ],
    relatedCareers: [
      { careerId: CAREER_IDS.ai_engineer, weight: 0.8, type: "related" as const },
    ],
    salaryByLevel: [
      { level: 'entry', range: '20K~35K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.85, updatedAt: '2026-04-01' },
      { level: 'mid', range: '35K~60K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.85, updatedAt: '2026-04-01' },
      { level: 'senior', range: '60K~100K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.85, updatedAt: '2026-04-01' },
    ],
    growthTrend: [
      { year: 2026, quarter: 2, demandIndex: 85, salaryGrowth: 12.0, source: '2026Q2 AI人才报告' },
    ],
    fitProfile: {
      logicalThinking: 5,
      communication: 2,
      creativity: 3,
      execution: 4,
      leadership: 2,
      analyticalSkill: 5,
    },
    transitions: [
      { fromCareer: CAREER_IDS.ai_engineer, toCareer: CAREER_IDS.ai_algorithm, difficulty: 3, successRate: 75, estimatedMonths: 6, keyGapSkills: ['sco_llm_fine_tuning', 'sco_statistics'] },
    ],
    learningLinks: [
      { type: 'course', name: 'Machine Learning Specialization (Andrew Ng)', level: 'intermediate', free: false, duration: '60小时', description: '斯坦福经典 ML 课程' },
      { type: 'book', name: 'Hands-On Machine Learning', level: 'intermediate', free: false, description: 'Aurélien Géron 著，实战 ML 经典' },
    ],
    status: 'active',
    evidence: [{ type: 'expert', source: '人工维护', date: '2026-01-01', confidence: 0.9 }],
    source: '人工维护',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: CAREER_IDS.ai_trainer,
    version: '1.0.0',
    name: 'AI训练师',
    aliases: ['数据标注', 'AI Data Trainer', '模型训练师', 'AI标注工程师'],
    category: '技术',
    subcategory: 'AI训练',
    description: '负责 AI 模型的数据标注、训练、评估和优化，提升模型效果',
    requiredSkills: [
      { skillId: 'sco_python', weight: 0.7 },
      { skillId: 'sco_data_analysis', weight: 0.8 },
      { skillId: 'sco_prompt_engineering', weight: 0.6 },
      { skillId: 'sco_statistics', weight: 0.5 },
    ],
    relatedCareers: [
      { careerId: CAREER_IDS.ai_algorithm, weight: 0.7, type: "related" as const },
      { careerId: CAREER_IDS.ai_engineer, weight: 0.6, type: "related" as const },
    ],
    salaryByLevel: [
      { level: 'entry', range: '8K~15K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.8, updatedAt: '2026-04-01' },
      { level: 'mid', range: '15K~25K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.8, updatedAt: '2026-04-01' },
    ],
    growthTrend: [
      { year: 2026, quarter: 2, demandIndex: 70, salaryGrowth: 8.0, source: '2026Q2 AI人才报告' },
    ],
    fitProfile: {
      logicalThinking: 4,
      communication: 2,
      creativity: 2,
      execution: 5,
      leadership: 2,
      analyticalSkill: 4,
    },
    transitions: [
      { fromCareer: CAREER_IDS.ai_engineer, toCareer: CAREER_IDS.ai_trainer, difficulty: 2, successRate: 85, estimatedMonths: 3, keyGapSkills: ['sco_data_analysis'] },
      { fromCareer: CAREER_IDS.qa, toCareer: CAREER_IDS.ai_trainer, difficulty: 3, successRate: 70, estimatedMonths: 6, keyGapSkills: ['sco_python', 'sco_prompt_engineering'] },
    ],
    learningLinks: [
      { type: 'course', name: 'AI Data Annotation Masterclass', level: 'beginner', free: false, duration: '20小时', description: '系统学习数据标注方法论' },
    ],
    status: 'active',
    evidence: [{ type: 'expert', source: '人工维护', date: '2026-01-01', confidence: 0.85 }],
    source: '人工维护',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: CAREER_IDS.prompt_engineer,
    version: '1.0.0',
    name: 'Prompt Engineer',
    aliases: ['提示词工程师', 'Prompt Designer', '提示工程师', 'PE'],
    category: '技术',
    subcategory: 'AI应用',
    description: '专门设计和优化 LLM 提示词，提升模型输出质量和稳定性',
    requiredSkills: [
      { skillId: 'sco_prompt_engineering', weight: 1.0 },
      { skillId: 'sco_ai_fundamentals', weight: 0.8 },
      { skillId: 'sco_communication', weight: 0.7 },
      { skillId: 'sco_data_analysis', weight: 0.5 },
    ],
    relatedCareers: [
      { careerId: CAREER_IDS.ai_engineer, weight: 0.8, type: "related" as const },
      { careerId: CAREER_IDS.ai_pm, weight: 0.7, type: "related" as const },
    ],
    salaryByLevel: [
      { level: 'entry', range: '12K~20K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.8, updatedAt: '2026-04-01' },
      { level: 'mid', range: '20K~35K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.8, updatedAt: '2026-04-01' },
    ],
    growthTrend: [
      { year: 2026, quarter: 2, demandIndex: 88, salaryGrowth: 25.0, source: '2026Q2 AI人才报告' },
    ],
    fitProfile: {
      logicalThinking: 4,
      communication: 4,
      creativity: 5,
      execution: 4,
      leadership: 2,
      analyticalSkill: 3,
    },
    transitions: [
      { fromCareer: CAREER_IDS.ai_engineer, toCareer: CAREER_IDS.prompt_engineer, difficulty: 1, successRate: 95, estimatedMonths: 1, keyGapSkills: [] },
      { fromCareer: CAREER_IDS.new_media, toCareer: CAREER_IDS.prompt_engineer, difficulty: 3, successRate: 65, estimatedMonths: 4, keyGapSkills: ['sco_ai_fundamentals', 'sco_prompt_engineering'] },
    ],
    learningLinks: [
      { type: 'course', name: 'Prompt Engineering for ChatGPT', level: 'beginner', free: false, duration: '10小时', description: 'Coursera 热门课程' },
      { type: 'practice', name: 'Prompt Engineering Guide (GitHub)', level: 'intermediate', free: true, description: '开源提示词工程指南' },
    ],
    status: 'active',
    evidence: [{ type: 'expert', source: '人工维护', date: '2026-01-01', confidence: 0.85 }],
    source: '人工维护',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: CAREER_IDS.agent_engineer,
    version: '1.0.0',
    name: 'Agent Engineer',
    aliases: ['AI Agent工程师', '智能体工程师', 'Agent开发', 'Multi-Agent Engineer'],
    category: '技术',
    subcategory: 'AI工程',
    description: '设计和实现 AI Agent 系统，包括规划、记忆、工具调用、多 Agent 协作',
    requiredSkills: [
      { skillId: 'sco_agent_design', weight: 1.0 },
      { skillId: 'sco_langchain', weight: 0.9 },
      { skillId: 'sco_langgraph', weight: 0.9 },
      { skillId: 'sco_mcp', weight: 0.8 },
      { skillId: 'sco_rag', weight: 0.7 },
      { skillId: 'sco_python', weight: 0.8 },
      { skillId: 'sco_docker', weight: 0.6 },
    ],
    relatedCareers: [
      { careerId: CAREER_IDS.ai_engineer, weight: 0.9, type: "related" as const },
    ],
    salaryByLevel: [
      { level: 'entry', range: '20K~35K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.8, updatedAt: '2026-04-01' },
      { level: 'mid', range: '35K~60K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.8, updatedAt: '2026-04-01' },
      { level: 'senior', range: '60K~100K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.8, updatedAt: '2026-04-01' },
    ],
    growthTrend: [
      { year: 2026, quarter: 2, demandIndex: 97, salaryGrowth: 28.0, source: '2026Q2 AI人才报告' },
    ],
    fitProfile: {
      logicalThinking: 5,
      communication: 3,
      creativity: 5,
      execution: 4,
      leadership: 3,
      analyticalSkill: 5,
    },
    transitions: [
      { fromCareer: CAREER_IDS.ai_engineer, toCareer: CAREER_IDS.agent_engineer, difficulty: 2, successRate: 90, estimatedMonths: 3, keyGapSkills: ['sco_langgraph', 'sco_mcp'] },
      { fromCareer: CAREER_IDS.backend, toCareer: CAREER_IDS.agent_engineer, difficulty: 4, successRate: 70, estimatedMonths: 6, keyGapSkills: ['sco_agent_design', 'sco_langgraph'] },
    ],
    learningLinks: [
      { type: 'course', name: 'AI Agents: Multi-Agent Systems', level: 'advanced', free: false, duration: '30小时', description: '深入学习 Agent 架构设计' },
      { type: 'project', name: '构建 AutoGPT 类 Agent', level: 'advanced', free: true, duration: '3周', description: '从零实现一个自主 Agent' },
    ],
    status: 'active',
    evidence: [{ type: 'expert', source: '人工维护', date: '2026-01-01', confidence: 0.85 }],
    source: '人工维护',
    updatedAt: '2026-01-01T00:00:00Z',
  },

  // ========== 软件 ==========
  {
    id: CAREER_IDS.frontend,
    version: '1.0.0',
    name: '前端工程师',
    aliases: ['Web前端', 'Frontend Developer', '前端开发', 'Web Developer'],
    category: '技术',
    subcategory: '前端',
    description: '构建 Web 用户界面，掌握 HTML/CSS/JS 和现代前端框架',
    requiredSkills: [
      { skillId: 'sco_html_css', weight: 1.0 },
      { skillId: 'sco_javascript', weight: 1.0 },
      { skillId: 'sco_typescript', weight: 0.8 },
      { skillId: 'sco_react', weight: 0.8 },
      { skillId: 'sco_vue', weight: 0.8 },
      { skillId: 'sco_tailwind', weight: 0.6 },
    ],
    relatedCareers: [
      { careerId: CAREER_IDS.fullstack, weight: 0.9, type: "related" as const },
      { careerId: CAREER_IDS.backend, weight: 0.6, type: "related" as const },
    ],
    salaryByLevel: [
      { level: 'entry', range: '10K~18K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.9, updatedAt: '2026-04-01' },
      { level: 'mid', range: '18K~30K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.9, updatedAt: '2026-04-01' },
      { level: 'senior', range: '30K~50K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.9, updatedAt: '2026-04-01' },
    ],
    growthTrend: [
      { year: 2026, quarter: 2, demandIndex: 75, salaryGrowth: 5.0, source: '2026Q2 互联网人才报告' },
    ],
    fitProfile: {
      logicalThinking: 4,
      communication: 3,
      creativity: 5,
      execution: 4,
      leadership: 2,
      analyticalSkill: 3,
    },
    transitions: [
      { fromCareer: CAREER_IDS.backend, toCareer: CAREER_IDS.frontend, difficulty: 3, successRate: 75, estimatedMonths: 4, keyGapSkills: ['sco_react', 'sco_vue'] },
      { fromCareer: CAREER_IDS.fullstack, toCareer: CAREER_IDS.frontend, difficulty: 1, successRate: 95, estimatedMonths: 1, keyGapSkills: [] },
    ],
    learningLinks: [
      { type: 'course', name: 'React - The Complete Guide', level: 'intermediate', free: false, duration: '50小时', description: 'Udemy 畅销 React 课程' },
      { type: 'project', name: '构建个人作品集网站', level: 'beginner', free: true, duration: '1周', description: '使用 Next.js + Tailwind 搭建' },
    ],
    status: 'active',
    evidence: [{ type: 'expert', source: '人工维护', date: '2026-01-01', confidence: 0.95 }],
    source: '人工维护',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: CAREER_IDS.backend,
    version: '1.0.0',
    name: '后端工程师',
    aliases: ['Backend Developer', '后端开发', '服务端工程师', 'Server Developer'],
    category: '技术',
    subcategory: '后端',
    description: '构建服务端应用和 API，掌握数据库、缓存、消息队列等技术',
    requiredSkills: [
      { skillId: 'sco_nodejs', weight: 0.8 },
      { skillId: 'sco_python', weight: 0.7 },
      { skillId: 'sco_java', weight: 0.6 },
      { skillId: 'sco_postgresql', weight: 0.8 },
      { skillId: 'sco_redis', weight: 0.7 },
      { skillId: 'sco_docker', weight: 0.6 },
      { skillId: 'sco_sql', weight: 0.9 },
    ],
    relatedCareers: [
      { careerId: CAREER_IDS.fullstack, weight: 0.9, type: "related" as const },
      { careerId: CAREER_IDS.devops, weight: 0.7, type: "related" as const },
      { careerId: CAREER_IDS.ai_engineer, weight: 0.6, type: "related" as const },
    ],
    salaryByLevel: [
      { level: 'entry', range: '12K~20K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.9, updatedAt: '2026-04-01' },
      { level: 'mid', range: '20K~35K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.9, updatedAt: '2026-04-01' },
      { level: 'senior', range: '35K~60K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.9, updatedAt: '2026-04-01' },
    ],
    growthTrend: [
      { year: 2026, quarter: 2, demandIndex: 78, salaryGrowth: 6.0, source: '2026Q2 互联网人才报告' },
    ],
    fitProfile: {
      logicalThinking: 5,
      communication: 3,
      creativity: 2,
      execution: 4,
      leadership: 2,
      analyticalSkill: 4,
    },
    transitions: [
      { fromCareer: CAREER_IDS.frontend, toCareer: CAREER_IDS.backend, difficulty: 3, successRate: 75, estimatedMonths: 4, keyGapSkills: ['sco_nodejs', 'sco_postgresql'] },
      { fromCareer: CAREER_IDS.fullstack, toCareer: CAREER_IDS.backend, difficulty: 1, successRate: 95, estimatedMonths: 1, keyGapSkills: [] },
      { fromCareer: CAREER_IDS.devops, toCareer: CAREER_IDS.backend, difficulty: 2, successRate: 82, estimatedMonths: 3, keyGapSkills: ['sco_nodejs', 'sco_postgresql'] },
    ],
    learningLinks: [
      { type: 'course', name: 'Node.js: The Complete Guide', level: 'intermediate', free: false, duration: '40小时', description: '深入学习 Node.js 后端开发' },
      { type: 'book', name: 'Designing Data-Intensive Applications', level: 'advanced', free: false, description: '后端架构必读经典' },
    ],
    status: 'active',
    evidence: [{ type: 'expert', source: '人工维护', date: '2026-01-01', confidence: 0.95 }],
    source: '人工维护',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: CAREER_IDS.fullstack,
    version: '1.0.0',
    name: '全栈工程师',
    aliases: ['Full Stack Developer', '全栈开发', 'Fullstack Engineer'],
    category: '技术',
    subcategory: '全栈',
    description: '前后端全能，能够独立交付完整产品',
    requiredSkills: [
      { skillId: 'sco_html_css', weight: 0.9 },
      { skillId: 'sco_javascript', weight: 1.0 },
      { skillId: 'sco_typescript', weight: 0.8 },
      { skillId: 'sco_nodejs', weight: 0.8 },
      { skillId: 'sco_react', weight: 0.7 },
      { skillId: 'sco_vue', weight: 0.7 },
      { skillId: 'sco_postgresql', weight: 0.7 },
      { skillId: 'sco_docker', weight: 0.5 },
    ],
    relatedCareers: [
      { careerId: CAREER_IDS.frontend, weight: 0.9, type: "related" as const },
      { careerId: CAREER_IDS.backend, weight: 0.9, type: "related" as const },
    ],
    salaryByLevel: [
      { level: 'entry', range: '12K~22K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.85, updatedAt: '2026-04-01' },
      { level: 'mid', range: '22K~40K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.85, updatedAt: '2026-04-01' },
      { level: 'senior', range: '40K~70K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.85, updatedAt: '2026-04-01' },
    ],
    growthTrend: [
      { year: 2026, quarter: 2, demandIndex: 72, salaryGrowth: 7.0, source: '2026Q2 互联网人才报告' },
    ],
    fitProfile: {
      logicalThinking: 4,
      communication: 3,
      creativity: 4,
      execution: 5,
      leadership: 3,
      analyticalSkill: 4,
    },
    transitions: [
      { fromCareer: CAREER_IDS.frontend, toCareer: CAREER_IDS.fullstack, difficulty: 2, successRate: 88, estimatedMonths: 3, keyGapSkills: ['sco_nodejs', 'sco_postgresql'] },
      { fromCareer: CAREER_IDS.backend, toCareer: CAREER_IDS.fullstack, difficulty: 2, successRate: 88, estimatedMonths: 3, keyGapSkills: ['sco_react', 'sco_vue'] },
    ],
    learningLinks: [
      { type: 'course', name: 'The Complete Web Developer Bootcamp', level: 'beginner', free: false, duration: '60小时', description: '全栈开发入门到精通' },
    ],
    status: 'active',
    evidence: [{ type: 'expert', source: '人工维护', date: '2026-01-01', confidence: 0.9 }],
    source: '人工维护',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: CAREER_IDS.qa,
    version: '1.0.0',
    name: '测试工程师',
    aliases: ['QA Engineer', '软件测试', '测试开发', 'QA', 'SDET'],
    category: '技术',
    subcategory: '质量保障',
    description: '保障软件质量，掌握自动化测试、性能测试、测试开发等技能',
    requiredSkills: [
      { skillId: 'sco_python', weight: 0.6 },
      { skillId: 'sco_javascript', weight: 0.6 },
      { skillId: 'sco_docker', weight: 0.5 },
      { skillId: 'sco_ci_cd', weight: 0.7 },
    ],
    relatedCareers: [
      { careerId: CAREER_IDS.backend, weight: 0.6, type: "related" as const },
      { careerId: CAREER_IDS.devops, weight: 0.7, type: "related" as const },
    ],
    salaryByLevel: [
      { level: 'entry', range: '8K~15K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.85, updatedAt: '2026-04-01' },
      { level: 'mid', range: '15K~25K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.85, updatedAt: '2026-04-01' },
      { level: 'senior', range: '25K~40K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.85, updatedAt: '2026-04-01' },
    ],
    growthTrend: [
      { year: 2026, quarter: 2, demandIndex: 55, salaryGrowth: 3.0, source: '2026Q2 互联网人才报告' },
    ],
    fitProfile: {
      logicalThinking: 4,
      communication: 3,
      creativity: 2,
      execution: 5,
      leadership: 2,
      analyticalSkill: 4,
    },
    transitions: [
      { fromCareer: CAREER_IDS.backend, toCareer: CAREER_IDS.qa, difficulty: 2, successRate: 85, estimatedMonths: 3, keyGapSkills: ['sco_ci_cd'] },
      { fromCareer: CAREER_IDS.devops, toCareer: CAREER_IDS.qa, difficulty: 2, successRate: 80, estimatedMonths: 3, keyGapSkills: ['sco_python', 'sco_javascript'] },
    ],
    learningLinks: [
      { type: 'course', name: 'Software Testing Masterclass', level: 'intermediate', free: false, duration: '30小时', description: '系统学习软件测试方法论' },
    ],
    status: 'active',
    evidence: [{ type: 'expert', source: '人工维护', date: '2026-01-01', confidence: 0.85 }],
    source: '人工维护',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: CAREER_IDS.devops,
    version: '1.0.0',
    name: 'DevOps工程师',
    aliases: ['SRE', '平台工程师', '运维开发', 'DevOps', '基础设施工程师'],
    category: '技术',
    subcategory: '基础设施',
    description: '搭建和维护 CI/CD、容器编排、云基础设施、监控告警等',
    requiredSkills: [
      { skillId: 'sco_linux', weight: 1.0 },
      { skillId: 'sco_docker', weight: 1.0 },
      { skillId: 'sco_kubernetes', weight: 0.9 },
      { skillId: 'sco_ci_cd', weight: 0.9 },
      { skillId: 'sco_aws', weight: 0.8 },
      { skillId: 'sco_nginx', weight: 0.7 },
      { skillId: 'sco_go', weight: 0.5 },
    ],
    relatedCareers: [
      { careerId: CAREER_IDS.backend, weight: 0.7, type: "related" as const },
      { careerId: CAREER_IDS.qa, weight: 0.6, type: "related" as const },
    ],
    salaryByLevel: [
      { level: 'entry', range: '12K~20K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.85, updatedAt: '2026-04-01' },
      { level: 'mid', range: '20K~35K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.85, updatedAt: '2026-04-01' },
      { level: 'senior', range: '35K~60K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.85, updatedAt: '2026-04-01' },
    ],
    growthTrend: [
      { year: 2026, quarter: 2, demandIndex: 70, salaryGrowth: 8.0, source: '2026Q2 互联网人才报告' },
    ],
    fitProfile: {
      logicalThinking: 5,
      communication: 3,
      creativity: 2,
      execution: 5,
      leadership: 3,
      analyticalSkill: 4,
    },
    transitions: [
      { fromCareer: CAREER_IDS.backend, toCareer: CAREER_IDS.devops, difficulty: 3, successRate: 78, estimatedMonths: 4, keyGapSkills: ['sco_kubernetes', 'sco_ci_cd'] },
      { fromCareer: CAREER_IDS.qa, toCareer: CAREER_IDS.devops, difficulty: 3, successRate: 72, estimatedMonths: 5, keyGapSkills: ['sco_docker', 'sco_kubernetes'] },
    ],
    learningLinks: [
      { type: 'course', name: 'Docker & Kubernetes: The Practical Guide', level: 'intermediate', free: false, duration: '30小时', description: '深入学习容器化和编排' },
      { type: 'certification', name: 'CKA (Certified Kubernetes Administrator)', level: 'advanced', free: false, duration: '3个月', description: 'Kubernetes 官方认证' },
    ],
    status: 'active',
    evidence: [{ type: 'expert', source: '人工维护', date: '2026-01-01', confidence: 0.9 }],
    source: '人工维护',
    updatedAt: '2026-01-01T00:00:00Z',
  },

  // ========== 内容 ==========
  {
    id: CAREER_IDS.new_media,
    version: '1.0.0',
    name: '新媒体运营',
    aliases: ['新媒体', '内容运营', 'Social Media Manager', '新媒体编辑'],
    category: '内容',
    subcategory: '运营',
    description: '负责微信公众号、抖音、小红书等平台的内容策划和运营',
    requiredSkills: [
      { skillId: 'sco_communication', weight: 0.9 },
      { skillId: 'sco_data_analysis', weight: 0.6 },
      { skillId: 'sco_product_thinking', weight: 0.5 },
    ],
    relatedCareers: [
      { careerId: CAREER_IDS.short_video, weight: 0.8, type: "related" as const },
      { careerId: CAREER_IDS.ad_planner, weight: 0.7, type: "related" as const },
    ],
    salaryByLevel: [
      { level: 'entry', range: '6K~12K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.8, updatedAt: '2026-04-01' },
      { level: 'mid', range: '12K~20K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.8, updatedAt: '2026-04-01' },
      { level: 'senior', range: '20K~35K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.8, updatedAt: '2026-04-01' },
    ],
    growthTrend: [
      { year: 2026, quarter: 2, demandIndex: 65, salaryGrowth: 5.0, source: '2026Q2 内容人才报告' },
    ],
    fitProfile: {
      logicalThinking: 3,
      communication: 5,
      creativity: 5,
      execution: 4,
      leadership: 3,
      analyticalSkill: 3,
    },
    transitions: [
      { fromCareer: CAREER_IDS.short_video, toCareer: CAREER_IDS.new_media, difficulty: 1, successRate: 92, estimatedMonths: 1, keyGapSkills: [] },
      { fromCareer: CAREER_IDS.ad_planner, toCareer: CAREER_IDS.new_media, difficulty: 2, successRate: 85, estimatedMonths: 2, keyGapSkills: [] },
    ],
    learningLinks: [
      { type: 'course', name: '新媒体运营实战课程', level: 'beginner', free: false, duration: '20小时', description: '从0到1学会新媒体运营' },
    ],
    status: 'active',
    evidence: [{ type: 'expert', source: '人工维护', date: '2026-01-01', confidence: 0.8 }],
    source: '人工维护',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: CAREER_IDS.short_video,
    version: '1.0.0',
    name: '短视频运营',
    aliases: ['抖音运营', '短视频', 'Short Video', 'TikTok运营'],
    category: '内容',
    subcategory: '短视频',
    description: '负责短视频平台的内容策划、拍摄、剪辑和运营',
    requiredSkills: [
      { skillId: 'sco_communication', weight: 0.8 },
      { skillId: 'sco_creativity', weight: 0.9 },
      { skillId: 'sco_data_analysis', weight: 0.5 },
    ],
    relatedCareers: [
      { careerId: CAREER_IDS.new_media, weight: 0.8, type: "related" as const },
      { careerId: CAREER_IDS.video_editor, weight: 0.7, type: "related" as const },
    ],
    salaryByLevel: [
      { level: 'entry', range: '6K~12K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.8, updatedAt: '2026-04-01' },
      { level: 'mid', range: '12K~22K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.8, updatedAt: '2026-04-01' },
      { level: 'senior', range: '22K~40K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.8, updatedAt: '2026-04-01' },
    ],
    growthTrend: [
      { year: 2026, quarter: 2, demandIndex: 75, salaryGrowth: 10.0, source: '2026Q2 内容人才报告' },
    ],
    fitProfile: {
      logicalThinking: 3,
      communication: 4,
      creativity: 5,
      execution: 4,
      leadership: 3,
      analyticalSkill: 3,
    },
    transitions: [
      { fromCareer: CAREER_IDS.new_media, toCareer: CAREER_IDS.short_video, difficulty: 1, successRate: 90, estimatedMonths: 1, keyGapSkills: [] },
      { fromCareer: CAREER_IDS.video_editor, toCareer: CAREER_IDS.short_video, difficulty: 2, successRate: 82, estimatedMonths: 3, keyGapSkills: ['sco_data_analysis'] },
    ],
    learningLinks: [
      { type: 'course', name: '短视频运营与变现', level: 'beginner', free: false, duration: '15小时', description: '抖音/快手运营实战' },
    ],
    status: 'active',
    evidence: [{ type: 'expert', source: '人工维护', date: '2026-01-01', confidence: 0.8 }],
    source: '人工维护',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: CAREER_IDS.ad_planner,
    version: '1.0.0',
    name: '广告策划',
    aliases: ['广告', 'Planner', '广告策划师', '品牌策划'],
    category: '内容',
    subcategory: '广告',
    description: '负责广告创意策划、媒介投放、效果分析',
    requiredSkills: [
      { skillId: 'sco_communication', weight: 0.9 },
      { skillId: 'sco_creativity', weight: 0.9 },
      { skillId: 'sco_data_analysis', weight: 0.7 },
      { skillId: 'sco_product_thinking', weight: 0.6 },
    ],
    relatedCareers: [
      { careerId: CAREER_IDS.new_media, weight: 0.7, type: "related" as const },
      { careerId: CAREER_IDS.product_manager, weight: 0.6, type: "related" as const },
    ],
    salaryByLevel: [
      { level: 'entry', range: '8K~15K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.8, updatedAt: '2026-04-01' },
      { level: 'mid', range: '15K~28K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.8, updatedAt: '2026-04-01' },
      { level: 'senior', range: '28K~50K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.8, updatedAt: '2026-04-01' },
    ],
    growthTrend: [
      { year: 2026, quarter: 2, demandIndex: 60, salaryGrowth: 4.0, source: '2026Q2 内容人才报告' },
    ],
    fitProfile: {
      logicalThinking: 3,
      communication: 5,
      creativity: 5,
      execution: 4,
      leadership: 3,
      analyticalSkill: 4,
    },
    transitions: [
      { fromCareer: CAREER_IDS.new_media, toCareer: CAREER_IDS.ad_planner, difficulty: 2, successRate: 82, estimatedMonths: 3, keyGapSkills: ['sco_data_analysis'] },
    ],
    learningLinks: [
      { type: 'course', name: '广告策划与创意', level: 'intermediate', free: false, duration: '25小时', description: '系统学习广告策划方法论' },
    ],
    status: 'active',
    evidence: [{ type: 'expert', source: '人工维护', date: '2026-01-01', confidence: 0.8 }],
    source: '人工维护',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: CAREER_IDS.ecommerce,
    version: '1.0.0',
    name: '电商运营',
    aliases: ['电商', 'E-commerce', '淘宝运营', '天猫运营', '京东运营'],
    category: '商业',
    subcategory: '电商',
    description: '负责电商平台的店铺运营、活动策划、数据分析',
    requiredSkills: [
      { skillId: 'sco_data_analysis', weight: 0.9 },
      { skillId: 'sco_communication', weight: 0.7 },
      { skillId: 'sco_product_thinking', weight: 0.6 },
    ],
    relatedCareers: [
      { careerId: CAREER_IDS.new_media, weight: 0.6, type: "related" as const },
      { careerId: CAREER_IDS.product_manager, weight: 0.5, type: "related" as const },
    ],
    salaryByLevel: [
      { level: 'entry', range: '6K~12K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.8, updatedAt: '2026-04-01' },
      { level: 'mid', range: '12K~22K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.8, updatedAt: '2026-04-01' },
      { level: 'senior', range: '22K~40K', cityTier: 'tier1', source: '2026Q2 Salary Salary Survey', confidence: 0.8, updatedAt: '2026-04-01' },
    ],
    growthTrend: [
      { year: 2026, quarter: 2, demandIndex: 68, salaryGrowth: 6.0, source: '2026Q2 电商人才报告' },
    ],
    fitProfile: {
      logicalThinking: 4,
      communication: 4,
      creativity: 3,
      execution: 5,
      leadership: 3,
      analyticalSkill: 5,
    },
    transitions: [
      { fromCareer: CAREER_IDS.new_media, toCareer: CAREER_IDS.ecommerce, difficulty: 2, successRate: 80, estimatedMonths: 3, keyGapSkills: ['sco_data_analysis'] },
    ],
    learningLinks: [
      { type: 'course', name: '电商运营全能班', level: 'beginner', free: false, duration: '30小时', description: '淘宝/天猫/京东运营实战' },
    ],
    status: 'active',
    evidence: [{ type: 'expert', source: '人工维护', date: '2026-01-01', confidence: 0.8 }],
    source: '人工维护',
    updatedAt: '2026-01-01T00:00:00Z',
  },

  // ========== 创意 ==========
  {
    id: CAREER_IDS.screenwriter,
    version: '1.0.0',
    name: '编剧',
    aliases: ['Scriptwriter', '剧本创作', '影视编剧', '故事创作'],
    category: '创意',
    subcategory: '影视',
    description: '创作影视剧本、短剧剧本、广告剧本等',
    requiredSkills: [
      { skillId: 'sco_communication', weight: 0.9 },
      { skillId: 'sco_creativity', weight: 1.0 },
    ],
    relatedCareers: [
      { careerId: CAREER_IDS.director, weight: 0.8, type: "related" as const },
      { careerId: CAREER_IDS.ad_planner, weight: 0.6, type: "related" as const },
    ],
    salaryByLevel: [
      { level: 'entry', range: '8K~15K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.75, updatedAt: '2026-04-01' },
      { level: 'mid', range: '15K~30K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.75, updatedAt: '2026-04-01' },
      { level: 'senior', range: '30K~60K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.75, updatedAt: '2026-04-01' },
    ],
    growthTrend: [
      { year: 2026, quarter: 2, demandIndex: 50, salaryGrowth: 5.0, source: '2026Q2 创意人才报告' },
    ],
    fitProfile: {
      logicalThinking: 3,
      communication: 5,
      creativity: 5,
      execution: 3,
      leadership: 2,
      analyticalSkill: 2,
    },
    transitions: [
      { fromCareer: CAREER_IDS.director, toCareer: CAREER_IDS.screenwriter, difficulty: 2, successRate: 85, estimatedMonths: 3, keyGapSkills: [] },
    ],
    learningLinks: [
      { type: 'book', name: '故事：材质、结构、风格和银幕剧作的原理', level: 'intermediate', free: false, description: 'Robert McKee 著，编剧必读经典' },
    ],
    status: 'active',
    evidence: [{ type: 'expert', source: '人工维护', date: '2026-01-01', confidence: 0.75 }],
    source: '人工维护',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: CAREER_IDS.director,
    version: '1.0.0',
    name: '导演',
    aliases: ['影视导演', 'Film Director', '视频导演', '短片导演'],
    category: '创意',
    subcategory: '影视',
    description: '负责影视作品的导演工作，包括镜头语言、表演指导、后期制作',
    requiredSkills: [
      { skillId: 'sco_communication', weight: 0.9 },
      { skillId: 'sco_creativity', weight: 1.0 },
      { skillId: 'sco_leadership', weight: 0.8 },
    ],
    relatedCareers: [
      { careerId: CAREER_IDS.screenwriter, weight: 0.8, type: "related" as const },
      { careerId: CAREER_IDS.video_editor, weight: 0.7, type: "related" as const },
    ],
    salaryByLevel: [
      { level: 'entry', range: '10K~20K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.75, updatedAt: '2026-04-01' },
      { level: 'mid', range: '20K~40K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.75, updatedAt: '2026-04-01' },
      { level: 'senior', range: '40K~80K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.75, updatedAt: '2026-04-01' },
    ],
    growthTrend: [
      { year: 2026, quarter: 2, demandIndex: 45, salaryGrowth: 4.0, source: '2026Q2 创意人才报告' },
    ],
    fitProfile: {
      logicalThinking: 3,
      communication: 5,
      creativity: 5,
      execution: 4,
      leadership: 5,
      analyticalSkill: 2,
    },
    transitions: [
      { fromCareer: CAREER_IDS.screenwriter, toCareer: CAREER_IDS.director, difficulty: 3, successRate: 70, estimatedMonths: 6, keyGapSkills: ['sco_leadership'] },
      { fromCareer: CAREER_IDS.video_editor, toCareer: CAREER_IDS.director, difficulty: 3, successRate: 65, estimatedMonths: 6, keyGapSkills: ['sco_communication', 'sco_leadership'] },
    ],
    learningLinks: [
      { type: 'book', name: '电影艺术：形式与风格', level: 'intermediate', free: false, description: '电影导演入门经典' },
    ],
    status: 'active',
    evidence: [{ type: 'expert', source: '人工维护', date: '2026-01-01', confidence: 0.75 }],
    source: '人工维护',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: CAREER_IDS.video_editor,
    version: '1.0.0',
    name: '视频剪辑',
    aliases: ['剪辑师', 'Video Editor', '后期制作', '剪辑'],
    category: '创意',
    subcategory: '后期',
    description: '负责视频剪辑、调色、特效、音频处理等后期制作',
    requiredSkills: [
      { skillId: 'sco_creativity', weight: 0.8 },
      { skillId: 'sco_execution', weight: 0.9 },
    ],
    relatedCareers: [
      { careerId: CAREER_IDS.director, weight: 0.7, type: "related" as const },
      { careerId: CAREER_IDS.short_video, weight: 0.7, type: "related" as const },
    ],
    salaryByLevel: [
      { level: 'entry', range: '6K~12K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.8, updatedAt: '2026-04-01' },
      { level: 'mid', range: '12K~22K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.8, updatedAt: '2026-04-01' },
      { level: 'senior', range: '22K~40K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.8, updatedAt: '2026-04-01' },
    ],
    growthTrend: [
      { year: 2026, quarter: 2, demandIndex: 70, salaryGrowth: 8.0, source: '2026Q2 创意人才报告' },
    ],
    fitProfile: {
      logicalThinking: 3,
      communication: 2,
      creativity: 5,
      execution: 5,
      leadership: 2,
      analyticalSkill: 2,
    },
    transitions: [
      { fromCareer: CAREER_IDS.short_video, toCareer: CAREER_IDS.video_editor, difficulty: 2, successRate: 85, estimatedMonths: 3, keyGapSkills: [] },
    ],
    learningLinks: [
      { type: 'course', name: 'Premiere Pro / DaVinci Resolve 完全指南', level: 'beginner', free: false, duration: '25小时', description: '主流剪辑软件系统学习' },
    ],
    status: 'active',
    evidence: [{ type: 'expert', source: '人工维护', date: '2026-01-01', confidence: 0.8 }],
    source: '人工维护',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: CAREER_IDS.music_producer,
    version: '1.0.0',
    name: '音乐制作',
    aliases: ['音乐制作人', 'Music Producer', '编曲', 'Beatmaker'],
    category: '创意',
    subcategory: '音乐',
    description: '负责音乐创作、编曲、录音、混音、母带处理',
    requiredSkills: [
      { skillId: 'sco_creativity', weight: 1.0 },
      { skillId: 'sco_execution', weight: 0.7 },
    ],
    relatedCareers: [
      { careerId: CAREER_IDS.video_editor, weight: 0.5, type: "related" as const },
    ],
    salaryByLevel: [
      { level: 'entry', range: '6K~12K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.7, updatedAt: '2026-04-01' },
      { level: 'mid', range: '12K~25K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.7, updatedAt: '2026-04-01' },
      { level: 'senior', range: '25K~50K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.7, updatedAt: '2026-04-01' },
    ],
    growthTrend: [
      { year: 2026, quarter: 2, demandIndex: 40, salaryGrowth: 3.0, source: '2026Q2 创意人才报告' },
    ],
    fitProfile: {
      logicalThinking: 2,
      communication: 2,
      creativity: 5,
      execution: 4,
      leadership: 2,
      analyticalSkill: 2,
    },
    transitions: [
      { fromCareer: CAREER_IDS.video_editor, toCareer: CAREER_IDS.music_producer, difficulty: 3, successRate: 60, estimatedMonths: 6, keyGapSkills: [] },
    ],
    learningLinks: [
      { type: 'course', name: 'Ableton Live / Logic Pro 音乐制作', level: 'beginner', free: false, duration: '30小时', description: '主流 DAW 软件学习' },
    ],
    status: 'active',
    evidence: [{ type: 'expert', source: '人工维护', date: '2026-01-01', confidence: 0.7 }],
    source: '人工维护',
    updatedAt: '2026-01-01T00:00:00Z',
  },

  // ========== 商业 ==========
  {
    id: CAREER_IDS.product_manager,
    version: '1.0.0',
    name: '产品经理',
    aliases: ['PM', 'Product Manager', '产品策划', '产品负责人'],
    category: '商业',
    subcategory: '产品',
    description: '负责产品规划、需求分析、项目管理、跨部门协调',
    requiredSkills: [
      { skillId: 'sco_product_thinking', weight: 1.0 },
      { skillId: 'sco_user_research', weight: 0.9 },
      { skillId: 'sco_data_driven', weight: 0.8 },
      { skillId: 'sco_communication', weight: 0.9 },
      { skillId: 'sco_agile', weight: 0.7 },
    ],
    relatedCareers: [
      { careerId: CAREER_IDS.ai_pm, weight: 0.8, type: "related" as const },
      { careerId: CAREER_IDS.project_manager, weight: 0.7, type: "related" as const },
    ],
    salaryByLevel: [
      { level: 'entry', range: '12K~22K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.9, updatedAt: '2026-04-01' },
      { level: 'mid', range: '22K~40K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.9, updatedAt: '2026-04-01' },
      { level: 'senior', range: '40K~70K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.9, updatedAt: '2026-04-01' },
    ],
    growthTrend: [
      { year: 2026, quarter: 2, demandIndex: 75, salaryGrowth: 6.0, source: '2026Q2 产品人才报告' },
    ],
    fitProfile: {
      logicalThinking: 4,
      communication: 5,
      creativity: 4,
      execution: 4,
      leadership: 4,
      analyticalSkill: 4,
    },
    transitions: [
      { fromCareer: CAREER_IDS.project_manager, toCareer: CAREER_IDS.product_manager, difficulty: 2, successRate: 82, estimatedMonths: 3, keyGapSkills: ['sco_user_research'] },
      { fromCareer: CAREER_IDS.ai_pm, toCareer: CAREER_IDS.product_manager, difficulty: 1, successRate: 92, estimatedMonths: 1, keyGapSkills: [] },
    ],
    learningLinks: [
      { type: 'book', name: '启示录：打造用户喜爱的产品', level: 'beginner', free: false, description: '产品经理入门必读' },
      { type: 'course', name: '产品经理实战训练营', level: 'intermediate', free: false, duration: '40小时', description: '从0到1学会产品管理' },
    ],
    status: 'active',
    evidence: [{ type: 'expert', source: '人工维护', date: '2026-01-01', confidence: 0.9 }],
    source: '人工维护',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: CAREER_IDS.project_manager,
    version: '1.0.0',
    name: '项目经理',
    aliases: ['PM', 'Project Manager', '项目管理', 'PMP'],
    category: '商业',
    subcategory: '管理',
    description: '负责项目计划、执行、监控、收尾，确保项目按时按质交付',
    requiredSkills: [
      { skillId: 'sco_communication', weight: 0.9 },
      { skillId: 'sco_leadership', weight: 0.8 },
      { skillId: 'sco_agile', weight: 0.8 },
      { skillId: 'sco_problem_solving', weight: 0.7 },
    ],
    relatedCareers: [
      { careerId: CAREER_IDS.product_manager, weight: 0.7, type: "related" as const },
    ],
    salaryByLevel: [
      { level: 'entry', range: '10K~18K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.85, updatedAt: '2026-04-01' },
      { level: 'mid', range: '18K~30K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.85, updatedAt: '2026-04-01' },
      { level: 'senior', range: '30K~50K', cityTier: 'tier1', source: '2026Q2 Salary Survey', confidence: 0.85, updatedAt: '2026-04-01' },
    ],
    growthTrend: [
      { year: 2026, quarter: 2, demandIndex: 65, salaryGrowth: 5.0, source: '2026Q2 管理人才报告' },
    ],
    fitProfile: {
      logicalThinking: 4,
      communication: 5,
      creativity: 2,
      execution: 5,
      leadership: 5,
      analyticalSkill: 3,
    },
    transitions: [
      { fromCareer: CAREER_IDS.product_manager, toCareer: CAREER_IDS.project_manager, difficulty: 2, successRate: 85, estimatedMonths: 3, keyGapSkills: ['sco_agile'] },
    ],
    learningLinks: [
      { type: 'certification', name: 'PMP (Project Management Professional)', level: 'intermediate', free: false, duration: '3个月', description: '项目管理领域黄金认证' },
    ],
    status: 'active',
    evidence: [{ type: 'expert', source: '人工维护', date: '2026-01-01', confidence: 0.85 }],
    source: '人工维护',
    updatedAt: '2026-01-01T00:00:00Z',
  },
]

// ─── Career Repository 统计 ───

export const CAREER_STATS = {
  totalCareers: CORE_CAREERS.length,
  categories: {
    'AI': CORE_CAREERS.filter(c => c.subcategory === 'AI工程' || c.subcategory === 'AI产品' || c.subcategory === 'AI算法' || c.subcategory === 'AI训练' || c.subcategory === 'AI应用').length,
    '软件': CORE_CAREERS.filter(c => c.subcategory === '前端' || c.subcategory === '后端' || c.subcategory === '全栈' || c.subcategory === '质量保障' || c.subcategory === '基础设施').length,
    '内容': CORE_CAREERS.filter(c => c.subcategory === '运营' || c.subcategory === '短视频' || c.subcategory === '广告').length,
    '创意': CORE_CAREERS.filter(c => c.subcategory === '影视' || c.subcategory === '后期' || c.subcategory === '音乐').length,
    '商业': CORE_CAREERS.filter(c => c.subcategory === '产品' || c.subcategory === '管理').length,
  },
  totalTransitions: CORE_CAREERS.reduce((sum, c) => sum + c.transitions.length, 0),
  totalLearningLinks: CORE_CAREERS.reduce((sum, c) => sum + c.learningLinks.length, 0),
}
