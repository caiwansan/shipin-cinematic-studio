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
  /**
   * LOGIN-CAPABILITY-V2 — 扫码后页面行为（Login Capability Model v2，掌柜蓝图）
   * 不同平台扫码确认后的页面表现不同，探针/轮询据此调整行为：
   *   redirect       扫码确认后自动跳转工作台（如抖音 creator.douyin.com）
   *   stay_page      扫码后停留在登录/Passport 页面，session 在后台建立（如快手 passport）
   *   manual_confirm 扫码后需手机端二次确认，页面等待确认结果（如视频号）
   */
  postScanBehavior?: 'redirect' | 'stay_page' | 'manual_confirm'
  /**
   * MEDIA-LOGIN-CAPABILITY-V3 Task03 — 登录后导航（post-login navigation）
   * afterSessionAuthenticated=true：探针发现 session 成立（loginPage=false + credential ✓）
   * 但尚未进入工作台（workspace ✗）时，自动导航到 workspaceUrl，然后重新探针。
   * 解决「平台扫码后停留原页（stay_page）」与「认证要求工作台 URL」的冲突：
   *   - 快手 passport 登录后停留 /profile（非工作台）→ 导航 cp.kuaishou.com/article
   *   - 小红书扫码确认后停留主站 → 导航 creator.xiaohongshu.com/new/home
   * 触发时机严格：session 首次成立才导航（不打断扫码确认窗口期——确认窗口期 session 未成立）
   */
  navigation?: { afterSessionAuthenticated?: boolean }
  /**
   * LOGIN-CAPABILITY-V2 — 身份探测策略（Identity Probe Strategy）
   * 显式声明该平台的探测通道，禁止运行时 if(platform) 分支：
   *   pageProbe      页面特征信号（工作台 URL 片段 + markers）
   *   cookieProbe    关键登录 cookie 信号
   *   networkCapture 刷新页面监听内部 API 响应提取官方身份（需签名平台，如快手）
   *   allowReload    是否允许探针主动 reload 页面触发网络捕获。
   *                  ⚠️ 扫码确认窗口期（扫码成功→手机确认→session 建立）reload 会把
   *                  passport「已扫码待确认」状态刷掉 → 确认结果丢失 → 扫码成功不登录。
   *                  所有平台默认 false；true 仅用于登录态稳定后（如恢复验证）
   */
  identityStrategy?: {
    pageProbe: boolean
    cookieProbe: boolean
    networkCapture: boolean
    allowReload: boolean
  }
  /** KUAISHOU-QR-FIX-02 — 连接时清理残留缓存的平台域（cookie/localStorage 按域清，防旧会话干扰新扫码） */
  cookieDomains: string[]
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
    /** IDENTITY-V2-HARDENING-01 — 安全验证页标记（命中 → 非普通登录页，是平台安全验证：
     *  身份验证/风控/刷脸/短信确认。区别于登录页：用户可能已登录，只是被要求二次验证。
     *  供 SECURITY_CHECK / NEEDS_REAUTH 状态判定，不直接算未登录） */
    securityCheckMarkers?: string[]
    /** 安全验证页 URL 正则（如抖音 /verify、安全验证路径） */
    securityCheckUrlPatterns?: RegExp[]
    /** 身份提取规则（userId/nickname/avatar/accountType） */
    extractionRules: ExtractionRule[]
    /** network 捕获（SPRINT-MEDIA-KUAISHOU-FIX-01）：页面 body 无 UID 明文时，
     *  刷新页面监听内部 API 响应提取官方身份（快手 cp.kuaishou.com 需 __NS_sig3 签名，
     *  探针无法直接 fetch；监听页面自身发起的请求最可靠）。
     *  userApis: URL 片段白名单；xxxKeys: 响应内字段名（递归查找） */
    networkApis?: {
      userApis: string[]
      userIdKeys: string[]
      nicknameKeys: string[]
      avatarKeys?: string[]
    }
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
    cookieDomains: ['douyin.com', 'iesdouyin.com'],
    loginMethods: ['qr', 'sms'],
    // LOGIN-CAPABILITY-V2 — 抖音扫码确认后自动跳转工作台；页面特征+凭证双信号足够，无需网络捕获
    postScanBehavior: 'redirect',
    identityStrategy: { pageProbe: true, cookieProbe: true, networkCapture: false, allowReload: false },
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
      securityCheckMarkers: ['身份验证', '为保障账号安全', '安全验证', '请完成验证', '人脸验证'],
      securityCheckUrlPatterns: [/\/verify|\/security|safe_verify|security_check/i],
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
    cookieDomains: ['kuaishou.com', 'gifshow.com'],
    loginMethods: ['qr', 'sms'],
    smsTabLabel: '手机号登录',
    // LOGIN-CAPABILITY-V2 — 快手扫码后停留 passport（stay_page），session 后台建立；
    // body 无 UID 明文 + 内部 API 需 __NS_sig3 签名 → 必须 networkCapture；
    // allowReload=false：扫码确认窗口期 reload 会把 passport「已扫码待确认」刷掉 → 确认丢失。
    // networkCapture 在 passive 模式（只监听自然请求，不主动 reload）下工作。
    postScanBehavior: 'stay_page',
    identityStrategy: { pageProbe: true, cookieProbe: true, networkCapture: true, allowReload: false },
    // MEDIA-LOGIN-CAPABILITY-V3 Task03 — 快手 passport 登录后停留 /profile（非工作台）→
    // session 成立后自动导航 cp.kuaishou.com/article（工作台）再探针（身份/工作台信号才成立）
    navigation: { afterSessionAuthenticated: true },
    // Task04：cp.kuaishou.com 未登录可能落到普通用户端/其他域 → 必须确认创作者登录入口
    loginEntry: {
      // KUAISHOU-QR-FIX-01：cp.kuaishou.com 未登录会自动 302 到 passport.kuaishou.com，
      // mustMatch 只认 cp 会把 passport 误判为未命中 → 回退导航死循环 + clickSteps 时序错乱
      mustMatch: /(cp|passport)\.kuaishou\.com/,
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
      // KUAISHOU-QR-FIX-01：快手实际登录 cookie 是 bUserId + kwssectoken（passport 会话），
      // 旧配置 kuaishou.api_st/server_st 永不命中 → cookie 信号永远 false → 扫码成功也无法认证
      cookies: ['bUserId', 'kwssectoken', 'did'],
      urlFragments: ['cp.kuaishou.com/article', 'cp.kuaishou.com/workbench', 'cp.kuaishou.com/data', 'cp.kuaishou.com/live', 'cp.kuaishou.com/workspace'],
      // Task04：登录成功但停留在普通用户主页（v.kuaishou.com/profile 等）≠ 创作者工作台，必须排除
      excludeUrlPatterns: [/v\.kuaishou\.com\/profile/, /www\.kuaishou\.com\/profile/, /v\.kuaishou\.com\/u\//],
      markers: ['作品管理', '数据中心', '快手小店', '创作服务', '视频管理', '数据分析'],
      loginPageMarkers: ['扫码登录', '手机号登录', '扫一扫'],
      securityCheckMarkers: ['安全验证', '身份验证', '账号存在风险', '短信验证'],
      extractionRules: [
        { field: 'nickname', method: 'regex', pattern: /快手号[：:]\s*([0-9A-Za-z_]{4,})/ },
        { field: 'userId', method: 'regex', pattern: /快手号[：:]\s*([0-9A-Za-z_]{4,})/ },
        { field: 'nickname', method: 'regex', pattern: /(?:昵称|账号)[：:]\s*([^\s|，,]{2,20})/ },
        // KUAISHOU-FIX-01：创作者中心导航栏昵称（「4 | 骏霄数字科技 | 发布作品」）
        { field: 'nickname', method: 'regex', pattern: /\d+\s*\|\s*([^|]+?)\s*\|\s*发布作品/ },
        { field: 'nickname', method: 'hydration', hydrationKeys: ['user.user_name', 'userInfo.user_name', 'user.nickname'] },
        { field: 'userId', method: 'hydration', hydrationKeys: ['user.id', 'userInfo.id', 'user.principalId'] },
        { field: 'avatar', method: 'hydration', hydrationKeys: ['user.headurl', 'userInfo.headurl', 'user.avatar'] },
        { field: 'accountType', method: 'hydration', hydrationKeys: ['user.userType', 'userInfo.userType'] },
      ],
      // KUAISHOU-FIX-01：创作者中心 body 无 UID 明文 + API 需 __NS_sig3 签名 →
      // 刷新页面监听内部 API 响应捕获官方 userId/userName（页面自身请求自带签名）
      networkApis: {
        userApis: ['/rest/cp/creator/pc/home/', '/rest/v2/creator/pc/authority/account/current'],
        userIdKeys: ['userId', 'user_id', 'id', 'principalId'],
        nicknameKeys: ['userName', 'user_name', 'name', 'nickname'],
        avatarKeys: ['headUrl', 'headurl', 'avatar', 'headImg'],
      },
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
    cookieDomains: ['xiaohongshu.com', 'xhscdn.com'],
    loginMethods: ['qr', 'sms'],
    smsTabLabel: '短信登录',
    // 登录入口：主站 → 点「登录」按钮 → 弹窗（qrcode-img 二维码与短信表单共存于 DOM）
    loginEntry: {
      mustMatch: /xiaohongshu\.com/,
      fallbackUrl: 'https://www.xiaohongshu.com',
      waitMs: 4000,
      clickSteps: ['登录'],
    },
    // LOGIN-CAPABILITY-V2 — 小红书主站弹窗扫码（stay_page）；凭证 cookie + 页面特征双信号
    postScanBehavior: 'stay_page',
    identityStrategy: { pageProbe: true, cookieProbe: true, networkCapture: false, allowReload: false },
    // MEDIA-LOGIN-CAPABILITY-V3 Task03 — 小红书扫码确认后停留主站（www.xiaohongshu.com）→
    // web_session 成立后自动导航 creator.xiaohongshu.com/new/home（工作台）再探针
    navigation: { afterSessionAuthenticated: true },
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
      securityCheckMarkers: ['安全验证', '身份验证', '账号存在风险'],
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
    cookieDomains: ['weixin.qq.com', 'qq.com'],
    loginMethods: ['qr'],
    // LOGIN-CAPABILITY-V2 — 视频号扫码后需手机端确认（manual_confirm），确认后跳工作台；
    // 页面特征（视频号助手/发布动态）+ 凭证 cookie 双信号足够
    postScanBehavior: 'manual_confirm',
    identityStrategy: { pageProbe: true, cookieProbe: true, networkCapture: false, allowReload: false },
    selectors: {
      loginPage: '[class*="login"], iframe[src*="qrconnect"]',
      workspace: '[class*="platform"]',
    },
    identityRules: {
      // ⚠️ 二维码成功 ≠ 登录成功：微信扫码后需手机确认，确认后才跳工作台（Task03）
      // WECHAT-VIDEO-G6-DEBUG-01 Task04 — 真实登录 cookie 实测（2026-08-03 直测）：
      //   channels.weixin.qq.com 登录态 = sessionid + wxuin（2 个），
      //   旧配置 wxsid/rand_info/mm_lang 是公众号 mp.weixin.qq.com 的 cookie（张冠李戴）→
      //   只命中 wxuin 1 个永远凑不齐 ≥2 → 扫码成功永不认证（+ connect 误判未登录→清掉真实 cookie）。
      cookies: ['wxuin', 'sessionid'],
      urlFragments: ['channels.weixin.qq.com/platform'],
      markers: ['视频号助手', '发布动态', '数据中心', '发表视频', '视频号'],
      loginPageMarkers: ['微信扫一扫', '扫码登录'],
      securityCheckMarkers: ['安全验证', '身份验证', '账号存在风险'],
      extractionRules: [
        // LOGIN-REALITY-FIX-01 — 实测视频号 ID 格式为 sphpfkmVO5uy6NF（非公众号 gh_ 格式）：
        // 工作台 DOM 展示「视频号ID: <id>」，直接按该标签提取，同时兼容 gh_ 历史格式
        { field: 'userId', method: 'regex', pattern: /(?:视频号ID|视频号 ID)[：:]\s*([A-Za-z0-9_-]{6,32})/ },
        { field: 'userId', method: 'regex', pattern: /gh_[0-9a-f]{10,}/ },
        { field: 'nickname', method: 'regex', pattern: /([\u4e00-\u9fa5A-Za-z0-9·]{2,30})\s*视频号ID[：:]/ },
        { field: 'nickname', method: 'regex', pattern: /视频号[：:]\s*([^\s|，,]{2,20})/ },
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
    cookieDomains: ['weixin.qq.com', 'qq.com'],
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
    cookieDomains: ['weibo.com', 'sina.com.cn'],
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
    cookieDomains: ['toutiao.com'],
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
    cookieDomains: ['baidu.com'],
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
