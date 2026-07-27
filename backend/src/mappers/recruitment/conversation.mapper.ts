/**
 * conversation.mapper.ts — RecruitmentConversation → ConversationDTO 映射
 *
 * AR-01 Phase 3: Relationship Domain
 * DP-4: Mapper 是唯一允许跨 Domain 组装数据的地方。
 *
 * 数据路径（Repository 已执行查询，Mapper 只做字段映射）：
 *   Conversation.candidateId → JobCandidate → profileJson.name → candidateName
 *   JobCandidate.userId → User.email → candidateEmail
 *
 * 注意：candidateId 可能为 null → candidateName/candidateEmail 返回 null。
 *       这是正确行为，不代表 Bug。
 */

export interface ConversationDTO {
  id: string
  candidateName: string | null
  candidateEmail: string | null
  status: string
  createdAt: Date
  updatedAt: Date
}

/**
 * 将 Repository 返回的 ConversationRow 映射为 ConversationDTO
 *
 * 输入：RecruitmentConversation + 手动关联的 Candidate Name/Email
 * 注意：Mapper 不执行任何查询，只做字段映射。
 */
export function mapConversationToDTO(row: {
  id: string
  status: string
  createdAt: Date
  updatedAt: Date
  candidateName: string | null
  candidateEmail: string | null
}): ConversationDTO {
  return {
    id: row.id,
    candidateName: row.candidateName,
    candidateEmail: row.candidateEmail,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function mapConversationListToDTOList(
  rows: Parameters<typeof mapConversationToDTO>[0][]
): ConversationDTO[] {
  return rows.map(mapConversationToDTO)
}
