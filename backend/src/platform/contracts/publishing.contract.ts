// 发布内容
export interface PublishContent {
  projectId: string;
  contentType: string;
  content: Record<string, any>;
  beforeContent?: Record<string, any>;
  afterContent?: Record<string, any>;
}

// 发布预览
export interface PublishPreview {
  diffSummary: string;
  beforeContent: Record<string, any>;
  afterContent: Record<string, any>;
}

// 发布结果
export interface PublishResult {
  publishId: string;
  platform: string;
  status: string;
  publishedAt?: Date;
  publishVersion: number;
}

// 回滚结果
export interface RollbackResult {
  publishId: string;
  rollbackVersion: number;
  status: string;
}

// 发布记录
export interface PublishingRecordDTO {
  id: string;
  projectId: string;
  executionId?: string;
  platform: string;
  adapterType: string;
  contentType: string;
  status: string;
  publishVersion: number;
  diffSummary?: string;
  createdAt: Date;
  publishedAt?: Date;
}
