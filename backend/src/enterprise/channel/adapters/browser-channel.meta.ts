/**
 * ChannelPlatformDefinition — 浏览器渠道平台定义中心（配置驱动，零平台分支）
 * SPRINT-MEDIA-CHANNEL-ADAPTER-EXPANSION-01 Task01 平台接入标准化
 *
 * ── 掌柜蓝图 ──
 * 一个平台 = 一个 Browser Workspace 模板。禁止复制抖音代码、禁止 if(platform==="douyin")。
 * 新渠道接入 = 在此加一条配置 + 工厂注册 + 前端点亮卡片，适配器/探针零改动。
 *
 * ── 结构说明 ──
 * - loginMethods: 平台支持的登录方式（qr 扫码 / sms 短信），不再用 boolean
 * - selectors:    CSS 选择器级定位（登录页输入框/工作台容器/账号信息节点）
 * - identityRules:
 *     cookies         平台关键 cookie 名（登录态核心；仅 cookie 残留不算登录）
 *     pageSignals     工作台 URL 片段 + 页面 markers（页面特征信号）
 *     loginPageMarkers 登录页标记（命中 → 明确未登录，防止误判）
 *     extractionRules 身份提取规则（userId/nickname/avatar/accountType 全字段，
 *                     method: hydration=前端状态树 / regex=页面文本 / url=URL 正则）
 *
 * ⚠️ 只做配置，不含业务逻辑。禁止在配置里写平台分支。
 */
export type LoginMethod = 'qr' | 'sms'
export type IdentityField = 'userId' | 'nickname' | 'avatar' | 'accountType'

export interface ExtractionRule {
  /** 提取目标身份字段 */
  field: IdentityField
  /** 提取方式：hydration=前端状态树 / regex=页面 body 文本 / url=当前 URL */
  method: 'hydration' | 'regex' | 'url'
  /** method=regex|url 时的正则（取 group 捕获组，默认 1） */
  pattern?: RegExp
  /** method=hydration 时的字段名候选（按序取第一个命中；支持嵌套路径 a.b.c） */
  hydrationKeys?: string[]
  /** 捕获组下标（默认 1） */
  group?: number
}

export interface ChannelPlatformDefinition {
  platform: string
  displayName: string
  /** 登录/首页 URL（连接时打开） */
  loginUrl: string
  /** 工作台主 URL（导航/数据页基址） */
  workspaceUrl: string
  /** 支持的登录方式（qr 扫码 / sms 短信） */
  loginMethods: LoginMethod[]
  /** 短信 tab 标签文案（平台差异：小红书「短信登录」vs 抖音「验证码登录」） */
  smsTabLabel?: string
  /** CSS 选择器级定位（各平台 DOM 差异；探针/适配器兜底用） */
  selectors: {
    /** 登录页特征选择器（命中 → 明确未登录） */
    loginPage?: string
    /** 工作台容器选择器（命中 → 已在工作台） */
    workspace?: string
    /** 账号信息节点选择器（身份提取锚点） */
    accountInfo?: string
  }
  /** 身份识别规则（探针唯一数据源） */
  identityRules: {
    /** 平台关键 cookie 名（登录态核心；≥2 命中算 cookie 信号） */
    cookies: string[]
    /** 工作台 URL 片段（命中任一 → 页面已进工作台） */
    urlFragments: string[]
    /** 排除 URL 正则（命中 → 明确非工作台；如快手普通用户主页 v.kuaishou.com/profile） */
    excludeUrlPatterns?: RegExp[]
    /** 页面 markers（登录后页面出现的文本特征，≥2 命中视为已登录） */
    markers: string[]
    /** 登录页标记（命中 → 明确未登录；优先于 markers 判断） */
    loginPageMarkers: string[]
    /** 身份提取规则（userId/nickname/avatar/accountType） */
    extractionRules: ExtractionRule[]
  }
  /** 登录入口确认（SPRINT-MEDIA-LOGIN-REALITY-FIX-01 Task03/04）：
   *  打开 loginUrl 后可能落到游客首页/普通用户端（如 www.xiaohongshu.com、www.kuaishou.com），
   *  此时必须回退导航到真正的登录入口，禁止停留在非登录面。 */
  loginEntry?: {
    /** navigate 后当前 URL 必须匹配（否则视为未进入登录入口） */
    mustMatch: RegExp
    /** 不匹配时回退导航的 URL（默认 loginUrl） */
    fallbackUrl?: string
    /** 等待登录入口渲染的毫秒数（默认 3000） */
    waitMs?: number
    /** 进入登录面的按钮点击序列（如快手：先点「立即登录」进 passport，再点「扫码登录」tab）；找不到的标签自动跳过 */
    clickSteps?: string[]
  }
  /** 精确二维码元素选择器（如小红书 img.qrcode-img）；配置后 Detector A0 通道优先命中 */
  qrImgSelector?: string
  /** 数据读取配置（fetchMetrics 通用实现；未配置 → 诚实报未实现） */
  metricsExtraction?: {
    /** 数据中心页 URL（连接后打开抓取） */
    dataUrl: string
    /** 指标规则：页面文本 label → ChannelMetrics 字段（数字 + 万/w 单位自动解析） */
    rules: { label: string; field: 'followerCount' | 'videoCount' | 'totalLikes' | 'totalViews' | 'totalComments' | 'totalShares' }[]
    /** 最近内容列表选择器（最近笔记/作品标题，rawData.recentContent） */
    recentContentSelector?: string
  }
}

export const CHANNEL_META: Record<string, ChannelPlatformDefinition> = {
  douyin: {
    platform: 'douyin',
    displayName: '抖音',
    loginUrl: 'https://creator.douyin.com/',
    workspaceUrl: 'https://creator.douyin.com/creator-micro',
    loginMethods: ['qr', 'sms'],
    smsTabLabel: '验证码登录',
    selectors: {
      loginPage: 'input[type="tel"], [class*="login"]',
      workspace: '[class*="creator-micro"]',
    },
    identityRules: {
      cookies: ['sessionid', 'sid_guard', 'uid_tt', 'passport_csrf_token'],
      urlFragments: ['creator.douyin.com/creator-micro'],
      markers: ['创作者中心', '作品管理', '内容管理', '数据概览', '创作灵感'],
      loginPageMarkers: ['扫码登录', '验证码登录', '密码登录'],
      extractionRules: [
        { field: 'nickname', method: 'regex', pattern: /抖音号[：:]\s*([0-9A-Za-z_]{4,})/ },
        { field: 'userId', method: 'regex', pattern: /抖音号[：:]\s*([0-9A-Za-z_]{4,})/ },
        { field: 'nickname', method: 'hydration', hydrationKeys: ['user.nickname', 'userInfo.nickname', 'user_info.nickname'] },
        { field: 'userId', method: 'hydration', hydrationKeys: ['user.sec_uid', 'userInfo.sec_uid', 'user.uid'] },
        { field: 'avatar', method: 'hydration', hydrationKeys: ['user.avatar_larger.url_list.0', 'userInfo.avatar_larger.url_list.0', 'user.avatar_thumb.url_list.0'] },
        { field: 'accountType', method: 'hydration', hydrationKeys: ['user.user_type', 'userInfo.user_type'] },
      ],
    },
  },

  kuaishou: {
    platform: 'kuaishou',
    displayName: '快手',
    loginUrl: 'https://cp.kuaishou.com/',
    workspaceUrl: 'https://cp.kuaishou.com/article',
    loginMethods: ['qr', 'sms'],
    smsTabLabel: '手机号登录',
    // Task04：cp.kuaishou.com 未登录可能落到普通用户端/其他域 → 必须确认创作者登录入口
    loginEntry: {
      mustMatch: /cp\.kuaishou\.com/,
      fallbackUrl: 'https://cp.kuaishou.com/',
      waitMs: 4000,
      // Reality 验证：立即登录 → passport.kuaishou.com → 扫码登录 tab → 真二维码（jsQR ✅）
      clickSteps: ['立即登录', '扫码登录'],
    },
    selectors: {
      loginPage: 'input[type="tel"], [class*="login"]',
      workspace: '[class*="workbench"], [class*="article"]',
    },
    identityRules: {
      // ⚠️ 登录页 URL 也是 cp.kuaishou.com（未登录跳 /profile），须用工作台专属路径片段
      cookies: ['kuaishou.api_st', 'kuaishou.server_st', 'userId'],
      urlFragments: ['cp.kuaishou.com/article', 'cp.kuaishou.com/workbench', 'cp.kuaishou.com/data', 'cp.kuaishou.com/live', 'cp.kuaishou.com/workspace'],
      // Task04：登录成功但停留在普通用户主页（v.kuaishou.com/profile 等）≠ 创作者工作台，必须排除
      excludeUrlPatterns: [/v\.kuaishou\.com\/profile/, /www\.kuaishou\.com\/profile/, /v\.kuaishou\.com\/u\//],
      markers: ['作品管理', '数据中心', '快手小店', '创作服务', '视频管理', '数据分析'],
      loginPageMarkers: ['扫码登录', '手机号登录', '扫一扫'],
      extractionRules: [
        { field: 'nickname', method: 'regex', pattern: /快手号[：:]\s*([0-9A-Za-z_]{4,})/ },
        { field: 'userId', method: 'regex', pattern: /快手号[：:]\s*([0-9A-Za-z_]{4,})/ },
        { field: 'nickname', method: 'regex', pattern: /(?:昵称|账号)[：:]\s*([^\s|，,]{2,20})/ },
        { field: 'nickname', method: 'hydration', hydrationKeys: ['user.user_name', 'userInfo.user_name', 'user.nickname'] },
        { field: 'userId', method: 'hydration', hydrationKeys: ['user.id', 'userInfo.id', 'user.principalId'] },
        { field: 'avatar', method: 'hydration', hydrationKeys: ['user.headurl', 'userInfo.headurl', 'user.avatar'] },
        { field: 'accountType', method: 'hydration', hydrationKeys: ['user.userType', 'userInfo.userType'] },
      ],
    },
    metricsExtraction: {
      dataUrl: 'https://cp.kuaishou.com/data',
      rules: [
        { label: '粉丝', field: 'followerCount' },
        { label: '作品', field: 'videoCount' },
        { label: '获赞', field: 'totalLikes' },
        { label: '播放', field: 'totalViews' },
      ],
    },
  },

  xiaohongshu: {
    platform: 'xiaohongshu',
    displayName: '小红书',
    // SPRINT-MEDIA-LOGIN-REALITY-FIX-01 Hotfix：小红书真·扫码登录入口 = 主站弹窗
    // 实测（2026-08-03）：creator.xiaohongshu.com/login 只有短信登录面（无扫码 tab，唯一 64x64 图是损坏 PNG）；
    // 主站 www.xiaohongshu.com/explore 点「登录」→ 弹窗内 img.qrcode-img 即实时扫码登录二维码
    // （jsQR 验证：https://www.xiaohongshu.com/mobile/login?qrId=...&ruleId=4&xhs_code=...&timestamp=...）
    loginUrl: 'https://www.xiaohongshu.com/explore',
    workspaceUrl: 'https://creator.xiaohongshu.com/new/home',
    loginMethods: ['qr', 'sms'],
    smsTabLabel: '短信登录',
    // 登录入口：主站 → 点「登录」按钮 → 弹窗（qrcode-img 二维码与短信表单共存于 DOM）
    loginEntry: {
      mustMatch: /xiaohongshu\.com/,
      fallbackUrl: 'https://www.xiaohongshu.com',
      waitMs: 4000,
      clickSteps: ['登录'],
    },
    // 二维码提取：img.qrcode-img（class 含 qrcode → Detector img 通道关键词命中）
    qrImgSelector: 'img.qrcode-img',
    selectors: {
      loginPage: 'input[type="tel"], [class*="login"]',
      workspace: '[class*="creator"]',
      accountInfo: '[class*="user-info"], [class*="avatar"]',
    },
    identityRules: {
      // ⚠️ /login 也在 creator.xiaohongshu.com 域下，工作台 URL 命中前必须先排除登录路径
      cookies: ['web_session', 'customerClientId', 'gid'],
      urlFragments: ['creator.xiaohongshu.com/publish', 'creator.xiaohongshu.com/new', 'creator.xiaohongshu.com/data', 'creator.xiaohongshu.com/creator'],
      markers: ['创作中心', '笔记管理', '数据中心', '粉丝', '蒲公英'],
      loginPageMarkers: ['扫码登录', '手机号登录', '登录小红书', '短信登录'],
      extractionRules: [
        { field: 'nickname', method: 'regex', pattern: /小红书号[：:]\s*([0-9A-Za-z_]{4,})/ },
        { field: 'userId', method: 'regex', pattern: /小红书号[：:]\s*([0-9A-Za-z_]{4,})/ },
        { field: 'nickname', method: 'hydration', hydrationKeys: ['user.nickname', 'userInfo.nickname', 'user.nickName', 'user.userName'] },
        { field: 'userId', method: 'hydration', hydrationKeys: ['user.userId', 'user.user_id', 'userInfo.userId', 'user.id'] },
        { field: 'avatar', method: 'hydration', hydrationKeys: ['user.avatar', 'userInfo.avatar', 'user.imageb', 'user.avatar_url'] },
        { field: 'accountType', method: 'hydration', hydrationKeys: ['user.userType', 'userInfo.userType', 'user.user_type'] },
        { field: 'userId', method: 'url', pattern: /creator\.xiaohongshu\.com\/user\/profile\/([0-9a-zA-Z]+)/ },
      ],
    },
    metricsExtraction: {
      // 小红书创作者中心数据概览：粉丝/笔记/获赞与收藏（Task02 数据读取：粉丝、笔记数量、点赞收藏、最近内容）
      dataUrl: 'https://creator.xiaohongshu.com/new/home',
      rules: [
        { label: '粉丝', field: 'followerCount' },
        { label: '笔记', field: 'videoCount' },
        { label: '获赞', field: 'totalLikes' },
        { label: '收藏', field: 'totalShares' },
      ],
      recentContentSelector: '[class*="note"] [class*="title"], [class*="note-item"]',
    },
  },

  channels_wechat: {
    platform: 'channels_wechat',
    displayName: '视频号',
    loginUrl: 'https://channels.weixin.qq.com/login.html',
    workspaceUrl: 'https://channels.weixin.qq.com/platform',
    loginMethods: ['qr'],
    selectors: {
      loginPage: '[class*="login"], iframe[src*="qrconnect"]',
      workspace: '[class*="platform"]',
    },
    identityRules: {
      // ⚠️ 二维码成功 ≠ 登录成功：微信扫码后需手机确认，确认后才跳工作台（Task03）
      cookies: ['wxuin', 'wxsid', 'rand_info', 'mm_lang'],
      urlFragments: ['channels.weixin.qq.com/platform'],
      markers: ['视频号助手', '发布动态', '数据中心', '发表视频', '视频号'],
      loginPageMarkers: ['微信扫一扫', '扫码登录'],
      extractionRules: [
        { field: 'nickname', method: 'regex', pattern: /视频号[：:]\s*([^\s|，,]{2,20})/ },
        { field: 'userId', method: 'regex', pattern: /gh_[0-9a-f]{10,}/ },
        { field: 'nickname', method: 'hydration', hydrationKeys: ['user.nickname', 'finderInfo.nickname', 'finder_info.nickname'] },
        { field: 'userId', method: 'hydration', hydrationKeys: ['finderInfo.finder_uin', 'finderInfo.uin', 'user.uin'] },
        { field: 'avatar', method: 'hydration', hydrationKeys: ['finderInfo.head_url', 'finderInfo.headUrl', 'user.head_url'] },
        { field: 'accountType', method: 'hydration', hydrationKeys: ['finderInfo.type', 'user.type'] },
      ],
    },
    metricsExtraction: {
      dataUrl: 'https://channels.weixin.qq.com/platform',
      rules: [
        { label: '粉丝', field: 'followerCount' },
        { label: '作品', field: 'videoCount' },
        { label: '获赞', field: 'totalLikes' },
        { label: '播放', field: 'totalViews' },
      ],
    },
  },

  wechat_mp: {
    platform: 'wechat_mp',
    displayName: '微信公众号',
    loginUrl: 'https://mp.weixin.qq.com/',
    workspaceUrl: 'https://mp.weixin.qq.com/',
    loginMethods: ['qr'],
    selectors: {
      loginPage: '[class*="login"], iframe[src*="open.weixin"]',
      workspace: '#js_mp_content',
    },
    identityRules: {
      cookies: ['slave_sid', 'slave_user', 'data_ticket'],
      urlFragments: ['mp.weixin.qq.com'],
      markers: ['公众号', '图文消息', '素材管理', '内容与互动', '数据'],
      loginPageMarkers: ['微信扫一扫', '扫码登录', '请使用微信扫一扫'],
      extractionRules: [
        { field: 'nickname', method: 'regex', pattern: /公众号[：:]\s*([^\s|，,]{2,20})/ },
        { field: 'userId', method: 'regex', pattern: /gh_[0-9a-f]{10,}/ },
        { field: 'nickname', method: 'hydration', hydrationKeys: ['user.nickname', 'accountInfo.nickname'] },
        { field: 'userId', method: 'hydration', hydrationKeys: ['user.user_name', 'accountInfo.user_name'] },
        { field: 'avatar', method: 'hydration', hydrationKeys: ['user.head_url', 'accountInfo.head_url'] },
      ],
    },
  },

  weibo: {
    platform: 'weibo',
    displayName: '微博',
    loginUrl: 'https://weibo.com/login.php',
    workspaceUrl: 'https://weibo.com/',
    loginMethods: ['qr', 'sms'],
    smsTabLabel: '手机号登录',
    selectors: {
      loginPage: 'input[type="tel"], [class*="login"]',
    },
    identityRules: {
      cookies: ['SUB', 'SUBP', 'WBPSESS'],
      urlFragments: ['weibo.com/u/'],
      markers: ['微博', '首页', '热门', '超话'],
      loginPageMarkers: ['扫码登录', '账号登录', '手机号登录'],
      extractionRules: [
        { field: 'nickname', method: 'regex', pattern: /(?:昵称|微博名)[：:]\s*([^\s|，,]{2,20})/ },
        { field: 'userId', method: 'url', pattern: /weibo\.com\/u\/(\d{8,})/ },
        { field: 'userId', method: 'hydration', hydrationKeys: ['user.id', 'userInfo.id'] },
        { field: 'nickname', method: 'hydration', hydrationKeys: ['user.screen_name', 'userInfo.screen_name'] },
        { field: 'avatar', method: 'hydration', hydrationKeys: ['user.avatar_hd', 'userInfo.avatar_hd'] },
      ],
    },
  },

  toutiao: {
    platform: 'toutiao',
    displayName: '今日头条',
    loginUrl: 'https://mp.toutiao.com/',
    workspaceUrl: 'https://mp.toutiao.com/',
    loginMethods: ['qr', 'sms'],
    smsTabLabel: '验证码登录',
    selectors: {
      loginPage: 'input[type="tel"], [class*="login"]',
    },
    identityRules: {
      cookies: ['sessionid', 'sid_guard', 'uid_tt'],
      urlFragments: ['mp.toutiao.com'],
      markers: ['内容管理', '创作中心', '数据中心', '发布作品', '头条号'],
      loginPageMarkers: ['扫码登录', '验证码登录', '密码登录'],
      extractionRules: [
        { field: 'nickname', method: 'regex', pattern: /头条号[：:]\s*([^\s|，,]{2,20})/ },
        { field: 'userId', method: 'hydration', hydrationKeys: ['user.id', 'userInfo.id'] },
        { field: 'nickname', method: 'hydration', hydrationKeys: ['user.name', 'userInfo.name', 'user.screen_name'] },
      ],
    },
  },

  baijiahao: {
    platform: 'baijiahao',
    displayName: '百家号',
    loginUrl: 'https://baijiahao.baidu.com/',
    workspaceUrl: 'https://baijiahao.baidu.com/',
    loginMethods: ['qr', 'sms'],
    smsTabLabel: '验证码登录',
    selectors: {
      loginPage: 'input[type="tel"], [class*="login"]',
    },
    identityRules: {
      cookies: ['BDUSS', 'BDUSS_BFESS', 'STOKEN'],
      urlFragments: ['baijiahao.baidu.com'],
      markers: ['百家号', '内容管理', '发布', '数据'],
      loginPageMarkers: ['扫码登录', '百度账号登录', '登录'],
      extractionRules: [
        { field: 'nickname', method: 'regex', pattern: /(?:百家号|昵称)[：:]\s*([^\s|，,]{2,20})/ },
        { field: 'userId', method: 'hydration', hydrationKeys: ['user.uid', 'userInfo.uid'] },
        { field: 'nickname', method: 'hydration', hydrationKeys: ['user.name', 'userInfo.name'] },
      ],
    },
  },
}

/** 前端渠道中心可用（connectable）的平台列表 */
export const CONNECTABLE_PLATFORMS: string[] = ['douyin', 'kuaishou', 'xiaohongshu', 'channels_wechat', 'wechat_mp']
