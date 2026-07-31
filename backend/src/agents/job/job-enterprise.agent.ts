/**
 * EnterpriseRecruitAgent — 企业招聘助手
 *
 * 职责：
 * 1. 自动生成招聘需求（JD）
 * 2. 简历分析，输出 TOP 候选人
 * 3. 面试辅助（生成面试问题、评价报告）
 * 4. 招聘数据分析
 *
 * 商业模式：
 * - 企业招聘版：299元/月
 * - 高级版：999元/月
 */

// ⚠️ DEPRECATED — Sprint-RECRUITMENT-REALITY-04 T04 审计确认：全仓 0 外部引用（死代码）
// 保留原因：Phase5 治理原则（不删除文件，只标记），清理前需掌柜批准

export interface JobDescriptionDTO {
  title: string
  department: string
  salary: string
  location: string
  responsibilities: string[]
  requirements: string[]
  benefits: string[]
  companyIntro: string
}

export interface ResumeAnalysisResult {
  candidateId: string
  name: string
  matchScore: number
  strengths: string[]
  weaknesses: string[]
  recommendation: string
  rank: number
}

export interface InterviewGuide {
  candidateId: string
  questions: string[]
  evaluationCriteria: string[]
  notes: string
}

export const ENTERPRISE_RECRUIT_AGENT_CONFIG = {
  id: 'enterprise-recruit-agent',
  name: '企业招聘助手',
  version: '1.0.0',
  description: 'AI 驱动的企业招聘全流程助手',
  capabilities: [
    'jd_generation',          // 自动生成JD
    'resume_screening',       // 简历筛选
    'candidate_matching',     // 人才匹配
    'interview_assistant',    // 面试助手
    'recruitment_analytics',  // 招聘分析
  ],
  maxTokens: 8192,
  temperature: 0.6,
}

export const RECRUIT_AGENT_SYSTEM_PROMPT = `你是昆仑镜企业招聘助手，一位资深 HR 总监。

你的职责：
1. 根据企业需求自动生成专业的 JD
2. 分析简历，筛选 TOP 候选人
3. 生成面试问题和评价标准
4. 提供招聘数据分析

JD 生成规范：
- 岗位描述清晰、专业
- 要求分"必备"和"加分项"
- 薪资范围符合市场水平
- 突出企业优势

简历分析规范：
- 基于岗位要求匹配技能
- 评估经验相关性
- 识别潜在风险
- 不歧视任何群体

面试助手规范：
- 问题需与岗位相关
- 包含技术面和行为面
- 提供评价标准和参考答案
- 遵守劳动法相关规定

安全规范：
- 不基于性别、年龄、民族等因素歧视候选人
- 不泄露候选人隐私信息
- 不向企业推荐未经核实的候选人`

export interface IEnterpriseRecruitAgent {
  generateJD(request: {
    position: string
    department?: string
    salaryRange?: string
    requirements?: string[]
    companyInfo?: string
  }): Promise<JobDescriptionDTO>

  analyzeResumes(
    jobId: string,
    resumes: Array<{ candidateId: string; name: string; profile: string }>
  ): Promise<ResumeAnalysisResult[]>

  generateInterviewGuide(jobId: string, candidateId: string): Promise<InterviewGuide>
}

export function createEnterpriseRecruitAgent(): IEnterpriseRecruitAgent {
  return {
    async generateJD(_request) {
      return {
        title: '',
        department: '',
        salary: '',
        location: '',
        responsibilities: [],
        requirements: [],
        benefits: [],
        companyIntro: '',
      }
    },

    async analyzeResumes(_jobId, _resumes) {
      return []
    },

    async generateInterviewGuide(_jobId, _candidateId) {
      return {
        candidateId: '',
        questions: [],
        evaluationCriteria: [],
        notes: '',
      }
    },
  }
}
