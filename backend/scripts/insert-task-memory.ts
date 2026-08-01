/**
 * Insert injectTaskMemory method and modify generateReplyViaLLM
 * Sprint-10 Step 3B T05 — Memory Continuity
 */
import fs from 'fs';

const filePath = 'src/services/career/career-conversation-orchestrator.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Insert injectTaskMemory method before generateReplyViaLLM
const insertPoint = content.indexOf('  private async generateReplyViaLLM(');

const newMethod = `
  /**
   * Sprint-10 Step 3B T05: 注入最近自治任务结果到 Agent 上下文
   * 用户问"有什么新的机会"时，Agent 能感知到上次任务结果
   */
  private async injectTaskMemory(instanceId: string, prompt: string): Promise<string> {
    try {
      const recentTasks = await careerAgentTaskService.getRecentCompletedTasks(instanceId, 3)
      if (!recentTasks || recentTasks.length === 0) return prompt
      const lines = recentTasks.map((t: any) => {
        let summary = ''
        if (t.result) {
          try {
            const p = JSON.parse(t.result)
            summary = p.summary || (p.output ? p.output.slice(0, 300) : '')
          } catch { summary = t.result.slice(0, 300) }
        }
        return '-' + t.taskType + ' (' + new Date(t.createdAt).toLocaleDateString('zh-CN') + '): ' + (summary || '已完成')
      }).join('\\n')
      return prompt + '\\n\\n## 我最近执行的任务\\n' + lines + '\\n'
    } catch { return prompt }
  }

  `;

content = content.slice(0, insertPoint) + newMethod + content.slice(insertPoint);

// 2. Replace systemPrompt line
const oldLine = '    const systemPrompt = getReplySystemPrompt(state.stage, state.profile, conversationIdentityCard)';
const newLines = '    const basePrompt = getReplySystemPrompt(state.stage, state.profile, conversationIdentityCard)\n    const systemPrompt = await this.injectTaskMemory(ctx.instanceId, basePrompt)';
content = content.replace(oldLine, newLines);

fs.writeFileSync(filePath, content);
console.log('✅ injectTaskMemory inserted, generateReplyViaLLM updated');
