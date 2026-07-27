/**
 * interview.mapper.ts — 面试数据组装（UX-03C 扩展）
 *
 * 扩展 DTO：加入评估详情（strengths, risks, summary, 维度分数）
 * 支持"面试决策中心"产品需求
 */

import type { InterviewRawData } from '../../repositories/recruitment/interview.repository.js'

// ─── DTO 定义 ───

export interface InterviewDTO {
  id: string
  candidateName: string
  jobTitle: string
  status: string
  overallScore: number | null
  recommendation: string | null
  technicalScore: number | null
  communicationScore: number | null
  cultureScore: number | null
  strengths: string[] | null
  risks: string[] | null
  summary: string | null
  createdAt: string
}

// ─── Mapper ───

export function mapInterviewListToDTOList(rawList: InterviewRawData[]): InterviewDTO[] {
  return rawList.map((item) => ({
    id: item.id,
    candidateName: item.candidateName,
    jobTitle: item.jobTitle,
    status: item.status,
    overallScore: item.overallScore,
    recommendation: item.recommendation,
    technicalScore: item.technicalScore,
    communicationScore: item.communicationScore,
    cultureScore: item.cultureScore,
    strengths: item.strengths,
    risks: item.risks,
    summary: item.summary,
    createdAt: new Date(item.createdAt).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
  }))
}
