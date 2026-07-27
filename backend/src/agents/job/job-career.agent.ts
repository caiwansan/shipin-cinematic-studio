/**
 * JobCareerAgent — AI 求职助手
 *
 * 职责：
 * 1. 与用户聊天，理解学历、技能、经历、城市、薪资、职业目标
 * 2. 生成职业画像（CandidateProfile）
 * 3. 基于画像推荐匹配岗位
 *
 * 接入 Hermes Agent Runtime：
 * - 使用 Hermes 的 Memory 存储对话历史
 * - 使用 Hermes 的 Tool 调用岗位匹配 API
 * - 使用 Hermes 的 Workflow 管理求职流程
 */

// ─── 类型定义 ───

export interface CandidateProfile {
  name?: string
  education: string
  skills: string[]
  experience: string
  city: string
  salaryRange: string
  careerGoal: string
}

export interface JobRecommendationDTO {
  jobId: string
  title: string
  company: string
  salary: string
  location: string
  matchScore: number
  reason: string
  companyRating: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// ─── Agent 配置 ───

export const JOB_CAREER_AGENT_CONFIG = {
  id: 'job-career-agent',
  name: 'AI 求职助手',
  version: '1.0.0',
  description: '聊天式求职顾问，生成职业画像，推荐匹配岗位',
  capabilities: [
    'career_chat',           // 聊天交流
    'profile_generation',    // 职业画像生成
    'job_matching',          // 岗位匹配
    'resume_analysis',       // 简历分析（Phase 2）
  ],
  maxTokens: 4096,
  temperature: 0.7,
}

// ─── 系统提示词 ───

export const CAREER_AGENT_SYSTEM_PROMPT = `你是昆仑镜 AI 求职助手，一位专业的职业顾问。

你的职责：
1. 与用户自然聊天，了解他们的学历、技能、工作经历、目标城市和薪资期望
2. 根据用户信息生成结构化的职业画像
3. 为用户推荐匹配的岗位，说明匹配原因

交流风格：
- 专业但亲切，像一位有经验的朋友
- 主动引导用户提供关键信息（学历、技能、城市、薪资）
- 不要一次问太多问题，循序渐进
- 根据用户回答动态调整问题方向

输出格式：
当收集到足够信息时，生成 JSON 格式的职业画像：
\`\`\`json
{
  "name": "用户姓名（如有）",
  "education": "学历",
  "skills": ["技能1", "技能2"],
  "experience": "工作经验描述",
  "city": "目标城市",
  "salaryRange": "期望薪资",
  "careerGoal": "职业目标"
}
\`\`\`

安全规范：
- 不收集用户身份证号、银行卡号等敏感信息
- 不向用户推荐需要付费的第三方服务
- 不代替用户做最终求职决定
- 所有建议仅供参考`

// ─── Agent 接口 ───

export interface IJobCareerAgent {
  /**
   * 处理用户消息，返回 Agent 回复
   */
  chat(message: string, history: ChatMessage[]): Promise<{
    reply: string
    profile?: CandidateProfile
    recommendations?: JobRecommendationDTO[]
  }>

  /**
   * 生成职业画像
   */
  generateProfile(messages: ChatMessage[]): CandidateProfile

  /**
   * 匹配推荐岗位
   */
  matchJobs(profile: CandidateProfile): Promise<JobRecommendationDTO[]>
}

// ─── 导出工厂函数 ───

export function createJobCareerAgent(): IJobCareerAgent {
  return {
    async chat(message: string, _history: ChatMessage[]) {
      // Phase 1: 返回占位响应，Phase 2 接入 Hermes Runtime
      return {
        reply: '感谢你的信息！我正在分析你的职业画像，请稍候...',
      }
    },

    generateProfile(_messages: ChatMessage[]): CandidateProfile {
      return {
        education: '',
        skills: [],
        experience: '',
        city: '',
        salaryRange: '',
        careerGoal: '',
      }
    },

    async matchJobs(_profile: CandidateProfile): Promise<JobRecommendationDTO[]> {
      return []
    },
  }
}
