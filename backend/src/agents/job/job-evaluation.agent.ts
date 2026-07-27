/**
 * JobEvaluationAgent — 岗位分析 Agent
 *
 * 职责：
 * 1. 分析企业发布的岗位质量
 * 2. 评估薪资竞争力、技术要求、发展空间
 * 3. 生成岗位质量评分
 * 4. 将分析结果存入 JobKnowledgeBase
 */

export interface JobEvaluationResult {
  overallScore: number        // 综合评分 0-100
  salaryScore: number         // 薪资竞争力 0-100
  stabilityScore: number      // 企业稳定性 0-100
  growthScore: number         // 成长空间 0-100
  analysis: string            // 分析摘要
  suggestions: string[]       // 改进建议
}

export interface EnterpriseEvaluation {
  scale: string               // 企业规模
  industry: string            // 所属行业
  establishedYears: number    // 成立年限
  creditRating: string        // 信用评级
}

export const JOB_EVALUATION_AGENT_CONFIG = {
  id: 'job-evaluation-agent',
  name: '岗位分析助手',
  version: '1.0.0',
  description: '分析岗位质量，生成综合评分',
  capabilities: [
    'job_quality_analysis',     // 岗位质量分析
    'enterprise_evaluation',    // 企业评估
    'salary_benchmarking',      // 薪资对标
  ],
  maxTokens: 4096,
  temperature: 0.3,
}

export const EVALUATION_AGENT_SYSTEM_PROMPT = `你是昆仑镜岗位分析助手，一位资深 HR 专家。

你的职责：
1. 分析企业发布的岗位信息（薪资、要求、描述）
2. 评估岗位的真实性和吸引力
3. 生成 0-100 分的综合评分
4. 给出改进建议

评分维度：
- 综合评分：整体吸引力
- 薪资评分：薪资竞争力（对比同行业同地区）
- 稳定评分：企业稳定性和信誉
- 成长评分：技术发展空间和晋升机会

输出格式：
\`\`\`json
{
  "overallScore": 92,
  "salaryScore": 95,
  "stabilityScore": 90,
  "growthScore": 93,
  "analysis": "分析摘要",
  "suggestions": ["建议1", "建议2"]
}
\`\`\`

安全规范：
- 不泄露企业商业机密
- 不发布未经核实的企业负面信息
- 评分需有客观依据`

export interface IJobEvaluationAgent {
  evaluateJob(jobInfo: {
    title: string
    salary: string
    requirements: string
    description: string
    enterpriseInfo?: EnterpriseEvaluation
  }): Promise<JobEvaluationResult>

  evaluateEnterprise(enterpriseInfo: {
    name: string
    industry: string
    scale: string
    establishedYears: number
  }): Promise<EnterpriseEvaluation>
}

export function createJobEvaluationAgent(): IJobEvaluationAgent {
  return {
    async evaluateJob(_jobInfo) {
      return {
        overallScore: 0,
        salaryScore: 0,
        stabilityScore: 0,
        growthScore: 0,
        analysis: '待接入 Hermes Runtime',
        suggestions: [],
      }
    },

    async evaluateEnterprise(_enterpriseInfo) {
      return {
        scale: '',
        industry: '',
        establishedYears: 0,
        creditRating: 'N/A',
      }
    },
  }
}
