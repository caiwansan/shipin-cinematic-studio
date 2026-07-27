/**
 * JobNewsAgent — 招聘信息动态 Agent
 *
 * 职责：
 * 1. 每日更新招聘动态（新增岗位统计、行业趋势）
 * 2. 来源：企业自主发布 + 合作数据 + 用户提交
 * 3. 禁止未经授权的大规模抓取
 * 4. 后续接入招聘平台 API
 */

export interface JobNewsDTO {
  id: string
  title: string
  content: string
  category: 'trend' | 'statistics' | 'policy'
  source?: string
  viewCount: number
  createdAt: Date
}

export interface JobStatistics {
  totalNewJobs: number
  cityDistribution: Record<string, number>
  industryDistribution: Record<string, number>
  topPositions: string[]
}

export const JOB_NEWS_AGENT_CONFIG = {
  id: 'job-news-agent',
  name: '招聘动态助手',
  version: '1.0.0',
  description: '每日更新招聘动态和行业趋势',
  capabilities: [
    'news_aggregation',       // 动态聚合
    'trend_analysis',         // 趋势分析
    'statistics_generation',  // 统计生成
  ],
  maxTokens: 4096,
  temperature: 0.5,
}

export const NEWS_AGENT_SYSTEM_PROMPT = `你是昆仑镜招聘动态助手，一位资深行业分析师。

你的职责：
1. 汇总每日招聘新增数据
2. 分析行业趋势和热点
3. 生成简洁的动态报告

数据来源（按优先级）：
1. 企业自主发布的岗位
2. 合作数据源（需授权）
3. 用户提交的招聘信息

禁止：
- 未经授权抓取招聘网站
- 发布未经核实的招聘信息
- 泄露个人隐私数据

输出格式：
\`\`\`json
{
  "title": "动态标题",
  "content": "动态内容",
  "category": "trend/statistics/policy",
  "source": "来源"
}
\`\`\``

export interface IJobNewsAgent {
  getDailyNews(): Promise<JobNewsDTO[]>
  getStatistics(): Promise<JobStatistics>
  createNews(news: Omit<JobNewsDTO, 'id' | 'viewCount' | 'createdAt'>): Promise<JobNewsDTO>
}

export function createJobNewsAgent(): IJobNewsAgent {
  return {
    async getDailyNews() {
      return []
    },

    async getStatistics() {
      return {
        totalNewJobs: 0,
        cityDistribution: {},
        industryDistribution: {},
        topPositions: [],
      }
    },

    async createNews(_news) {
      return {
        id: '',
        title: '',
        content: '',
        category: 'trend',
        viewCount: 0,
        createdAt: new Date(),
      }
    },
  }
}
