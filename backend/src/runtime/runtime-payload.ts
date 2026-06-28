export interface RuntimePayload {
  requestId?: string
  traceId?: string

  userId: string

  provider: string
  model: string
  taskType: string

  apiKey: string

  baseURL?: string
  region?: string

  metadata?: Record<string, unknown>
}
