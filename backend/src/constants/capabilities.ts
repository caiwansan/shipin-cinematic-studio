/**
 * Capability Registry — 唯一能力注册表
 * 规范来源：P1-Capability-Model-v1.0（FROZEN）
 * 
 * 命名规范：UPPER_SNAKE_CASE，前缀体现业务域
 * 一个 Capability 只代表一种业务能力，不绑定页面/按钮
 */

// ── 企业招聘域：岗位管理 ──
export const JOB_CREATE = 'JOB_CREATE';
export const JOB_MANAGE = 'JOB_MANAGE';
export const JOB_PUBLISH = 'JOB_PUBLISH';

// ── 企业招聘域：人才发现 ──
export const CANDIDATE_SEARCH = 'CANDIDATE_SEARCH';
export const CANDIDATE_VIEW = 'CANDIDATE_VIEW';
export const CANDIDATE_CONTACT = 'CANDIDATE_CONTACT';

// ── 企业招聘域：AI 招聘服务 ──
export const AI_JD_GENERATE = 'AI_JD_GENERATE';
export const AI_RESUME_MATCH = 'AI_RESUME_MATCH';
export const AI_CANDIDATE_RECOMMEND = 'AI_CANDIDATE_RECOMMEND';
export const AI_HEADHUNT = 'AI_HEADHUNT';
export const AI_INTERVIEW = 'AI_INTERVIEW';
export const AI_INTERVIEW_SUMMARY = 'AI_INTERVIEW_SUMMARY';

// ── 企业招聘域：Offer ──
export const OFFER_CREATE = 'OFFER_CREATE';
export const OFFER_SEND = 'OFFER_SEND';
export const OFFER_TRACK = 'OFFER_TRACK';

// ── 企业招聘域：团队协作 ──
export const TEAM_MEMBER = 'TEAM_MEMBER';
export const TEAM_ANALYTICS = 'TEAM_ANALYTICS';
export const EXPORT_DATA = 'EXPORT_DATA';
export const API_ACCESS = 'API_ACCESS';

// ── 企业招聘域：通知（预留） ──
export const NOTIFICATION_SEND = 'NOTIFICATION_SEND';

// ── 求职者域：档案与简历 ──
export const PROFILE_BUILD = 'PROFILE_BUILD';
export const RESUME_UPLOAD = 'RESUME_UPLOAD';
export const RESUME_MANAGE = 'RESUME_MANAGE';

// ── 求职者域：求职行为 ──
export const JOB_APPLY = 'JOB_APPLY';
export const JOB_VIEW = 'JOB_VIEW';
export const JOB_SEARCH = 'JOB_SEARCH';

// ── 求职者域：AI 求职服务 ──
export const AI_RESUME_OPTIMIZE = 'AI_RESUME_OPTIMIZE';
export const AI_RESUME_REWRITE = 'AI_RESUME_REWRITE';
export const AI_CAREER_COACH = 'AI_CAREER_COACH';
export const AI_INTERVIEW_PRACTICE = 'AI_INTERVIEW_PRACTICE';
export const AI_JOB_RECOMMEND = 'AI_JOB_RECOMMEND';
export const AI_SALARY_ANALYSIS = 'AI_SALARY_ANALYSIS';
export const AI_OFFER_ANALYSIS = 'AI_OFFER_ANALYSIS';

// ── 求职者域：Agent 权益 ──
export const CAREER_AGENT_PROVISION = 'CAREER_AGENT_PROVISION';

/**
 * 全部 Capability 集合
 */
export const ALL_CAPABILITIES = {
  // 企业招聘
  JOB_CREATE,
  JOB_MANAGE,
  JOB_PUBLISH,
  CANDIDATE_SEARCH,
  CANDIDATE_VIEW,
  CANDIDATE_CONTACT,
  AI_JD_GENERATE,
  AI_RESUME_MATCH,
  AI_CANDIDATE_RECOMMEND,
  AI_HEADHUNT,
  AI_INTERVIEW,
  AI_INTERVIEW_SUMMARY,
  OFFER_CREATE,
  OFFER_SEND,
  OFFER_TRACK,
  TEAM_MEMBER,
  TEAM_ANALYTICS,
  EXPORT_DATA,
  API_ACCESS,
  NOTIFICATION_SEND,
  // 求职者
  PROFILE_BUILD,
  RESUME_UPLOAD,
  RESUME_MANAGE,
  JOB_APPLY,
  JOB_VIEW,
  JOB_SEARCH,
  AI_RESUME_OPTIMIZE,
  AI_RESUME_REWRITE,
  CAREER_AGENT_PROVISION,
  AI_CAREER_COACH,
  AI_INTERVIEW_PRACTICE,
  AI_JOB_RECOMMEND,
  AI_SALARY_ANALYSIS,
  AI_OFFER_ANALYSIS,
} as const;

export type Capability = typeof ALL_CAPABILITIES[keyof typeof ALL_CAPABILITIES];

/**
 * Constitution PC-01 保护的永久免费能力
 * 任何版本不得收费，除非升级 Constitution
 */
export const CONSTITUTION_FREE_CAPABILITIES: Capability[] = [
  // 企业侧
  JOB_CREATE,
  JOB_MANAGE,
  JOB_PUBLISH,
  CANDIDATE_SEARCH,
  CANDIDATE_VIEW,
  CANDIDATE_CONTACT,
  OFFER_CREATE,
  OFFER_SEND,
  OFFER_TRACK,
  // 求职者侧
  PROFILE_BUILD,
  RESUME_UPLOAD,
  RESUME_MANAGE,
  JOB_APPLY,
  JOB_VIEW,
  JOB_SEARCH,
  // 通知
  NOTIFICATION_SEND,
];

/**
 * PC-02 AI 收费能力
 */
export const AI_PAID_CAPABILITIES: Capability[] = [
  // 企业侧 AI
  AI_JD_GENERATE,
  AI_RESUME_MATCH,
  AI_CANDIDATE_RECOMMEND,
  AI_HEADHUNT,
  AI_INTERVIEW,
  AI_INTERVIEW_SUMMARY,
  // 求职者侧 AI
  AI_RESUME_OPTIMIZE,
  AI_RESUME_REWRITE,
  AI_CAREER_COACH,
  AI_INTERVIEW_PRACTICE,
  AI_JOB_RECOMMEND,
  AI_SALARY_ANALYSIS,
  AI_OFFER_ANALYSIS,
];

/**
 * 套餐能力矩阵
 * 套餐按 AI 自动化程度递增
 */
export const PLAN_CAPABILITY_MATRIX: Record<string, Capability[]> = {
  recruitment_free: [
    JOB_CREATE, JOB_MANAGE, JOB_PUBLISH,
    CANDIDATE_SEARCH, CANDIDATE_VIEW, CANDIDATE_CONTACT,
    OFFER_CREATE, OFFER_SEND, OFFER_TRACK,
    NOTIFICATION_SEND,
  ],
  recruitment_pro: [
    JOB_CREATE, JOB_MANAGE, JOB_PUBLISH,
    CANDIDATE_SEARCH, CANDIDATE_VIEW, CANDIDATE_CONTACT,
    OFFER_CREATE, OFFER_SEND, OFFER_TRACK,
    NOTIFICATION_SEND,
    AI_JD_GENERATE, AI_RESUME_MATCH, AI_CANDIDATE_RECOMMEND,
    TEAM_ANALYTICS,
  ],
  recruitment_team: [
    JOB_CREATE, JOB_MANAGE, JOB_PUBLISH,
    CANDIDATE_SEARCH, CANDIDATE_VIEW, CANDIDATE_CONTACT,
    OFFER_CREATE, OFFER_SEND, OFFER_TRACK,
    NOTIFICATION_SEND,
    AI_JD_GENERATE, AI_RESUME_MATCH, AI_CANDIDATE_RECOMMEND,
    TEAM_ANALYTICS,
    AI_HEADHUNT, AI_INTERVIEW, AI_INTERVIEW_SUMMARY,
    TEAM_MEMBER, EXPORT_DATA,
  ],
  recruitment_enterprise: [
    JOB_CREATE, JOB_MANAGE, JOB_PUBLISH,
    CANDIDATE_SEARCH, CANDIDATE_VIEW, CANDIDATE_CONTACT,
    OFFER_CREATE, OFFER_SEND, OFFER_TRACK,
    NOTIFICATION_SEND,
    AI_JD_GENERATE, AI_RESUME_MATCH, AI_CANDIDATE_RECOMMEND,
    TEAM_ANALYTICS,
    AI_HEADHUNT, AI_INTERVIEW, AI_INTERVIEW_SUMMARY,
    TEAM_MEMBER, EXPORT_DATA,
    API_ACCESS,
  ],
  career_agent: [
    CAREER_AGENT_PROVISION,
    PROFILE_BUILD, RESUME_UPLOAD, RESUME_MANAGE,
    JOB_APPLY, JOB_VIEW, JOB_SEARCH,
    AI_RESUME_OPTIMIZE, AI_RESUME_REWRITE,
    AI_CAREER_COACH, AI_INTERVIEW_PRACTICE,
    AI_JOB_RECOMMEND, AI_SALARY_ANALYSIS, AI_OFFER_ANALYSIS,
  ],
};

/**
 * 套餐元数据（名称与描述，价格留待后续冻结）
 */
export const PLAN_METADATA: Record<string, { name: string; description: string }> = {
  recruitment_free: {
    name: 'Free',
    description: '基础招聘能力，永久免费',
  },
  recruitment_pro: {
    name: 'Pro',
    description: 'AI Assist：JD 生成、简历匹配、人才推荐',
  },
  recruitment_team: {
    name: 'Team',
    description: 'AI Automation：猎聘、面试、团队协作',
  },
  recruitment_enterprise: {
    name: 'Enterprise',
    description: '企业治理：API 访问、高级权限、无限额度',
  },
  career_agent: {
    name: '镜心职业助理',
    description: '你的 AI 职业伙伴。认识自己、规划方向、寻找机会、提升竞争力。',
  },
};
