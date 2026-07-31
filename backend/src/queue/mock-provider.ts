/**
 * @deprecated
 * Reality Recovery Phase5
 * Production path unused — mockProviderCall 全仓 0 引用，Worker 从未调用。
 * 保留：测试可能依赖，勿删除。
 *
 * queue/mock-provider.ts — Worker 内部的 Mock Provider
 *
 * 当真实 provider 不可用时，提供模拟响应
 * 确保 Worker 始终能返回结果
 */

export async function mockProviderCall(taskType: string, input: any): Promise<any> {
  const seed = Date.now()

  switch (taskType) {
    case 'image':
      return {
        image_url: `https://picsum.photos/seed/${seed}/1024x1024`,
        style: 'default',
        resolution: '1024x1024',
        seed,
        provider: 'mock-worker',
      }
    case 'video':
      return {
        video_url: null,
        status: 'generating',
        task_id: `mock-video-${seed}`,
        estimated_duration: 30,
        provider: 'mock-worker',
      }
    case 'tts':
      return {
        audio_url: null,
        text_length: input?.text?.length || 0,
        estimated_duration: 5,
        provider: 'mock-worker',
      }
    case 'llm':
      return {
        content: `[Mock LLM Response] This is a simulated response for: ${JSON.stringify(input).slice(0, 100)}...`,
        model: 'mock-llm',
        provider: 'mock-worker',
      }
    default:
      return { status: 'ok', provider: 'mock-worker', timestamp: new Date().toISOString() }
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "queue-legacy",
  "mode": "SHADOW"
};

