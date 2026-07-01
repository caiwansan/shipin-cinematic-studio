/**
 * benchmark/runner/benchmark-runner.ts — Benchmark Runner (Job-based)
 *
 * 职责：
 *   1. 接收 BenchmarkJob
 *   2. 遍历 Dataset 题目
 *   3. 调用 Provider 获取 Response
 *   4. 传递给 Judge 评分
 *   5. 更新 Job 进度
 *
 * 不负责：
 *   - 评分逻辑（Judge 负责）
 *   - Provider 适配（Provider 负责）
 *   - Dataset 管理（DatasetLoader 负责）
 *   - Job 持久化（外部调度器负责）
 */
import { ProviderRegistry } from '../provider/registry'
import { DatasetLoader } from '../dataset/loader'
import { BenchmarkJob, BenchmarkRequest, ChatMessage, JobStatus } from '../types'

export interface RunnerDelegate {
  onProgress(jobId: string, completed: number, total: number): void
  onComplete(jobId: string): void
  onError(jobId: string, error: string): void
  onResponse(jobId: string, questionId: string, response: string): void
}

export class BenchmarkRunner {
  private activeJobs = new Map<string, AbortController>()

  constructor(
    private providerRegistry: ProviderRegistry,
    private datasetLoader: DatasetLoader,
    private delegate?: RunnerDelegate,
  ) {}

  /**
   * 运行一个 Benchmark Job
   * 支持 cancel（通过 AbortController）
   */
  async run(job: BenchmarkJob): Promise<void> {
    const abortCtrl = new AbortController()
    this.activeJobs.set(job.id, abortCtrl)
    
    job.status = 'running'
    job.startedAt = new Date()
    
    try {
      const dataset = this.datasetLoader.load(job.datasetVersion)
      const provider = this.providerRegistry.get(job.providerName, job.model)
      
      const questions = dataset.questions
      job.progress.total = questions.length
      job.progress.completed = 0
      job.progress.failed = 0
      
      for (const question of questions) {
        if (abortCtrl.signal.aborted) {
          job.status = 'cancelled'
          return
        }
        
        try {
          const request: BenchmarkRequest = {
            messages: [
              { role: 'system', content: question.prompt.system ?? DEFAULT_SYSTEM_PROMPT },
              { role: 'user', content: question.prompt.user.replace(/\{entity\}/g, job.brandName).replace(/\{brand\}/g, job.brandName) },
            ],
            temperature: 0.3,
            maxTokens: 2048,
            timeout: 30000,
          }
          
          const response = await this.invokeWithRetry(provider, request, 2)
          job.progress.completed++
          
          this.delegate?.onResponse(job.id, question.id, response.content)
          this.delegate?.onProgress(job.id, job.progress.completed, job.progress.total)
        } catch (err) {
          job.progress.failed++
          console.error(`[benchmark-runner] ❌ Question ${question.id} failed:`, (err as Error).message)
          this.delegate?.onError(job.id, `Question ${question.id}: ${(err as Error).message}`)
        }
      }
      
      job.status = job.progress.failed === 0 ? 'completed' : 'completed_with_errors'
      job.completedAt = new Date()
      this.delegate?.onComplete(job.id)
    } catch (err) {
      job.status = 'failed'
      job.error = (err as Error).message
      this.delegate?.onError(job.id, job.error)
    } finally {
      this.activeJobs.delete(job.id)
    }
  }

  cancel(jobId: string): boolean {
    const ctrl = this.activeJobs.get(jobId)
    if (ctrl) {
      ctrl.abort()
      return true
    }
    return false
  }

  private async invokeWithRetry(
    provider: { invoke(request: BenchmarkRequest): Promise<{ content: string; model: string }> },
    request: BenchmarkRequest,
    retries: number,
  ): Promise<{ content: string; model: string }> {
    let lastError: Error | undefined
    
    for (let i = 0; i <= retries; i++) {
      try {
        return await provider.invoke(request)
      } catch (err) {
        lastError = err as Error
        if (i < retries) {
          const delay = Math.min(1000 * Math.pow(2, i), 8000)
          await new Promise(r => setTimeout(r, delay))
        }
      }
    }
    
    throw lastError
  }
}

const DEFAULT_SYSTEM_PROMPT = `你是一个中立的品牌知识问答助手。请基于你训练数据中掌握的知识，如实回答关于品牌的问题。

回答要求：
1. 如果你知道该品牌，请详细回答，包括品牌基本信息、核心业务、主要产品等。
2. 如果你不确定某些信息，请明确说明你的不确定性。
3. 不要编造不存在的品牌或信息。
4. 如果被问及推荐，请基于客观标准给出推荐理由。
5. 回答语言：简体中文。`
