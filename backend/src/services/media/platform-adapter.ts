/**
 * Platform Adapter Interface — BETA-06.6 Phase 3.1
 * 
 * 平台适配器接口：抽象不同新媒体平台的操作
 * 未来支持：小红书、抖音、微博、公众号、视频号...
 */

import { Page } from 'playwright'

export interface PlatformAdapter {
  readonly platform: string
  readonly name: string

  /**
   * 登录平台
   * @param page Playwright Page 实例
   * @param credentials 登录凭证（Cookie、账号密码等）
   */
  login(page: Page, credentials: PlatformCredentials): Promise<LoginResult>

  /**
   * 检查登录状态
   */
  checkLoginStatus(page: Page): Promise<LoginStatus>

  /**
   * 创建内容（图文/视频）
   */
  createPost(page: Page, content: PostContent): Promise<PostResult>

  /**
   * 上传媒体文件（图片/视频）
   */
  uploadMedia(page: Page, filePaths: string[]): Promise<UploadResult>

  /**
   * 发布内容
   */
  publish(page: Page, content: PostContent): Promise<PublishResult>

  /**
   * 获取账号数据
   */
  fetchMetrics(page: Page): Promise<MetricsResult>

  /**
   * 获取评论列表
   */
  fetchComments(page: Page, postId: string): Promise<Comment[]>

  /**
   * 回复评论
   */
  replyComment(page: Page, commentId: string, reply: string): Promise<boolean>
}

// ─── Types ───

export interface PlatformCredentials {
  type: 'cookie' | 'phone' | 'qrcode'
  cookieData?: string
  phone?: string
  code?: string
}

export interface LoginResult {
  success: boolean
  message?: string
}

export interface LoginStatus {
  isLoggedIn: boolean
  username?: string
  avatar?: string
  followerCount?: number
}

export interface PostContent {
  title: string
  body: string
  images?: string[]
  video?: string
  tags?: string[]
  location?: string
}

export interface PostResult {
  success: boolean
  postId?: string
  url?: string
  error?: string
}

export interface PublishResult {
  success: boolean
  platformPostId?: string
  platformUrl?: string
  publishedAt?: Date
  error?: string
}

export interface UploadResult {
  success: boolean
  urls: string[]
  error?: string
}

export interface MetricsResult {
  followerCount: number
  notesCount: number
  likesCount: number
  commentsCount: number
}

export interface Comment {
  id: string
  userId: string
  username: string
  content: string
  likes: number
  replies: number
  createdAt: Date
}
