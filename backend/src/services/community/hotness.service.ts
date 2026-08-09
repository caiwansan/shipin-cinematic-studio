// COMMUNITY-HOTNESS-V2 行业顶尖热度算法（掌柜 2026-08-07 指令：对标 Reddit Best / Hacker News / B站）
//
// 设计要点：
// 1. 对数缩放（Reddit Best 思想）：log₁₀(1+n)，互动边际递减，防止头部爆款永远霸榜
// 2. 时间衰减（Hacker News gravity 思想）：H = S / (ageHours+2)^1.5，新帖 2 小时内 1.5x 新帖红利
// 3. 打赏 ×K 强信号：真金白银远高于免费互动（1 次打赏 ≈ 11 次点赞）
// 4. 质量分 Q（精选榜）：收藏率/分享率/打赏率比率信号，区分「热闹」与「优质」
// 5. 热力构成 breakdown：可解释性——前端 tooltip 展示每一项贡献 + 衰减系数
//
// 反作弊由两层保证：
// - 数据层：community_likes/favorites/shares 均有 @@unique([postId, userId])，同用户只能互动一次
// - 接口层：互动路由拒绝注册 <24h 的新账号（防小号批量刷）

export interface HotnessInput {
  likeCount: number
  commentCount: number
  favoriteCount: number
  shareCount: number
  giftCount: number
  viewCount?: number
  createdAt: Date | string
}

export interface HotnessBreakdown {
  /** 对数缩放后各项互动分（无时间衰减） */
  giftScore: number
  likeScore: number
  commentScore: number
  shareScore: number
  favoriteScore: number
  /** 对数缩放后互动总分（raw） */
  raw: number
  /** 时间衰减系数 (ageHours+2)^gravity / 新帖红利 */
  decayFactor: number
  newPostBoost: number
  /** 最终热力值（列表 hot 排序用） */
  hotScore: number
  /** 质量分（精选榜 best 排序用，0-100） */
  qualityScore: number
}

// ─── 参数（可调，行业参考值） ───
const GIFT_K = 15 // 打赏信号强度倍数（真金白银）：1 次打赏 ≈ 11 次点赞
const W = {
  gift: 1.0, // 打赏权重
  like: 0.35,
  comment: 0.35,
  favorite: 0.3,
  share: 0.3,
}
const GRAVITY = 1.5 // 时间衰减重力：值越大老帖衰减越快
const NEW_POST_HOURS = 2 // 新帖红利窗口（小时）
const NEW_POST_BOOST = 1.5 // 红利倍数

const log1p = (n: number) => Math.log10(1 + Math.max(0, n))

export function calcHotness(input: HotnessInput): HotnessBreakdown {
  const ageMs = Date.now() - new Date(input.createdAt).getTime()
  const ageHours = Math.max(0, ageMs / 3600000)

  const giftScore = log1p(input.giftCount * GIFT_K) * W.gift
  const likeScore = log1p(input.likeCount) * W.like
  const commentScore = log1p(input.commentCount) * W.comment
  const favoriteScore = log1p(input.favoriteCount) * W.favorite
  const shareScore = log1p(input.shareCount) * W.share
  const raw = giftScore + likeScore + commentScore + favoriteScore + shareScore

  const decayFactor = Math.pow(ageHours + 2, GRAVITY)
  const newPostBoost = ageHours < NEW_POST_HOURS ? NEW_POST_BOOST : 1
  const hotScore = (raw / decayFactor) * newPostBoost

  // 质量分：比率信号（每浏览的收藏/转发/打赏），区分热闹与优质
  // 收藏×4 + 转发×3 + 打赏×20，除以浏览量归一化，×100 放大到 0-100 量级
  // 浏览量下限：<50 浏览的帖子分母太小，Q 值不可信（小样本噪声），不参与精选榜
  const MIN_QUALITY_VIEWS = 50
  const views = Math.max(input.viewCount || 0, 1)
  const qualityScore =
    views < MIN_QUALITY_VIEWS
      ? 0
      : Math.min(
          100,
          Math.round(
            ((input.favoriteCount * 4 + input.shareCount * 3 + input.giftCount * 20) / views) * 100 * 100
          ) / 100
        )

  return {
    giftScore: round3(giftScore),
    likeScore: round3(likeScore),
    commentScore: round3(commentScore),
    shareScore: round3(shareScore),
    favoriteScore: round3(favoriteScore),
    raw: round3(raw),
    decayFactor: round3(decayFactor),
    newPostBoost: round3(newPostBoost),
    hotScore: round3(hotScore),
    qualityScore,
  }
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

/** 互动冷却：注册不足 N 小时的账号禁止互动（防小号批量刷） */
export const INTERACTION_MIN_AGE_HOURS = 24

export function isInteractionAllowed(user?: { createdAt?: Date | string | null } | null): {
  allowed: boolean
  reason?: string
} {
  if (!user?.createdAt) return { allowed: true }
  const ageHours = (Date.now() - new Date(user.createdAt).getTime()) / 3600000
  if (ageHours < INTERACTION_MIN_AGE_HOURS) {
    return {
      allowed: false,
      reason: `新账号注册满 ${INTERACTION_MIN_AGE_HOURS} 小时才能点赞/收藏/转发（防刷）`,
    }
  }
  return { allowed: true }
}

// ─── 新用户评论限制（掌柜 2026-08-07 指令） ───
// 新用户（注册 <24h）可以发帖、可以评论，但评论最多 5 条；满 24h 恢复正常
// 点赞/收藏/转发仍由 isInteractionAllowed 完全禁止（比评论更严，防小号刷榜）
export const NEW_USER_COMMENT_LIMIT = 5

export function isNewUserCommentAllowed(
  user?: { createdAt?: Date | string | null } | null,
  commentCount = 0
): { allowed: boolean; reason?: string; remaining?: number } {
  if (!user?.createdAt) return { allowed: true }
  const ageHours = (Date.now() - new Date(user.createdAt).getTime()) / 3600000
  if (ageHours >= INTERACTION_MIN_AGE_HOURS) return { allowed: true }
  if (commentCount >= NEW_USER_COMMENT_LIMIT) {
    return {
      allowed: false,
      reason: `新账号评论上限 ${NEW_USER_COMMENT_LIMIT} 条，注册满 ${INTERACTION_MIN_AGE_HOURS} 小时自动解锁，明天再来吧～`,
    }
  }
  return { allowed: true, remaining: NEW_USER_COMMENT_LIMIT - commentCount }
}
