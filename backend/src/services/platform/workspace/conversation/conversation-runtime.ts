// ============================================================
// Conversation Runtime — AI 对话记录管理
// 每个 Workspace 自动维护 AI 对话记录
// ============================================================

import { conversationRepository } from '../repositories/conversation.repository.js'
import type { WorkspaceConversationDTO } from '../types.js'

export const conversationRuntime = {
  /**
   * Log a message in a workspace's conversation session.
   * Supports user, assistant, and system roles.
   */
  async logMessage(
    workspaceId: string,
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    context?: Record<string, unknown>,
  ): Promise<WorkspaceConversationDTO> {
    const tokenCount = this._estimateTokens(content)

    return conversationRepository.create({
      workspaceId,
      sessionId,
      role,
      content,
      context,
      tokenCount,
    })
  },

  /**
   * Get the full conversation context for a session.
   * Returns all messages for AI context building.
   */
  async getContext(
    workspaceId: string,
    sessionId: string,
  ): Promise<WorkspaceConversationDTO[]> {
    return conversationRepository.findBySession(workspaceId, sessionId)
  },

  /**
   * Get just the messages in a format suitable for LLM context.
   * Returns { role, content }[] array.
   */
  async getMessagesForLLM(
    workspaceId: string,
    sessionId: string,
  ): Promise<Array<{ role: string; content: string }>> {
    const messages = await this.getContext(workspaceId, sessionId)
    return messages.map(m => ({ role: m.role, content: m.content }))
  },

  /**
   * Summarize a conversation session.
   * Returns the last message's summary or generates a basic one.
   */
  async summarize(
    workspaceId: string,
    sessionId: string,
  ): Promise<string> {
    const messages = await this.getContext(workspaceId, sessionId)
    if (messages.length === 0) return 'No messages'

    // Use the most recent summary if available
    const lastWithSummary = [...messages].reverse().find(m => m.summary)
    if (lastWithSummary?.summary) return lastWithSummary.summary

    // Generate a simple summary from message count and roles
    const userMessages = messages.filter(m => m.role === 'user').length
    const assistantMessages = messages.filter(m => m.role === 'assistant').length
    const totalTokens = messages.reduce((sum, m) => sum + (m.tokenCount ?? 0), 0)

    const summary = `Conversation in session ${sessionId}: ${messages.length} messages ` +
      `(${userMessages} user, ${assistantMessages} assistant), ~${totalTokens} tokens`

    return summary
  },

  /**
   * Update the summary for the latest message in a session.
   */
  async updateLatestSummary(
    workspaceId: string,
    sessionId: string,
    summary: string,
  ): Promise<void> {
    const messages = await this.getContext(workspaceId, sessionId)
    if (messages.length > 0) {
      const latest = messages[messages.length - 1]
      await conversationRepository.updateSummary(latest.id, summary)
    }
  },

  /**
   * Get the latest context object from a session.
   * Useful for resuming AI state.
   */
  async getLatestContext(
    workspaceId: string,
    sessionId: string,
  ): Promise<Record<string, unknown> | null> {
    return conversationRepository.getLatestContext(workspaceId, sessionId)
  },

  /**
   * Count messages in a session.
   */
  async countMessages(
    workspaceId: string,
    sessionId: string,
  ): Promise<number> {
    return conversationRepository.countBySession(workspaceId, sessionId)
  },

  /**
   * Estimate token count from string content.
   * Rough approximation: ~4 chars per token.
   */
  _estimateTokens(content: string): number {
    return Math.ceil(content.length / 4)
  },
}
