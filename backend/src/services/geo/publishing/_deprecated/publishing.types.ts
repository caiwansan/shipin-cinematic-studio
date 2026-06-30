// Publishing 适配器接口
export interface PublishingAdapter {
  platform: string
  supports(contentType: string): boolean
  health(): Promise<{ healthy: boolean; message?: string }>
  capabilities(): Promise<string[]>
  preview(content: PublishContent): Promise<PublishPreview>
  publish(projectId: string, content: PublishContent): Promise<PublishResult>
  rollback(projectId: string, version: number): Promise<RollbackResult>
  checkStatus(publishId: string): Promise<PublishStatus>
}

// 发布内容
export interface PublishContent {
  projectId: string
  contentType: string
  content: Record<string, any>
  beforeContent?: Record<string, any>
  afterContent?: Record<string, any>
}

// 发布预览
export interface PublishPreview {
  diffSummary: string
  beforeContent: Record<string, any>
  afterContent: Record<string, any>
  sideBySideDiff: Record<string, { before: any; after: any }>
  estimatedImpact?: string
  targetPlatform: string
  rollbackRisk?: string
}

// 发布结果
export interface PublishResult {
  publishId: string
  platform: string
  status: string
  publishedAt?: Date
  publishVersion: number
}

// 回滚结果
export interface RollbackResult {
  publishId: string
  rollbackVersion: number
  status: string
}

// 发布状态
export interface PublishStatus {
  publishId: string
  status: string
  publishedAt?: Date
  verifiedOnlineAt?: Date
  indexedAt?: Date
}

// 发布请求
export interface PublishRequest {
  projectId: string
  executionId: string
  platform: string
  contentType: string
  content: Record<string, any>
  beforeContent?: Record<string, any>
  afterContent?: Record<string, any>
}

// 审核请求
export interface PublishReview {
  publishId: string
  action: 'approve' | 'reject' | 'request_changes'
  reviewer: string
  note?: string
}
