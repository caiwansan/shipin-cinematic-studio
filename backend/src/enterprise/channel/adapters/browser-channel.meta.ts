/**
 * BrowserChannelMeta — 浏览器自动化渠道平台元数据（多平台配置中心）
 * 2026-08-02 — 抖音打通后按同范式铺开其他新媒体渠道
 *
 * 每个平台 = 登录 URL + 工作台特征（URL 片段 + 页面 markers）+ 账号名/ID 提取正则
 * 探针用这些配置做「登录态检测 + 身份提取」，Adapter 用登录 URL 做扫码入口。
 *
 * ⚠️ 只做配置，不含业务逻辑。新渠道接入 = 在此加一条 + 注册 Adapter + 前端点亮卡片。
 */
export interface BrowserChannelMeta {
  platform: string
  displayName: string
  /** 登录/首页 URL（连接时打开） */
  loginUrl: string
  /** 工作台 URL 片段（命中任一 → 页面已进工作台） */
  workspaceUrlFragments: string[]
  /** 页面 markers（登录后页面出现的文本特征，≥2 命中视为已登录；探针兜底） */
  pageMarkers: string[]
  /** 账号名提取正则（页面 body 文本扫描，取第一个命中组） */
  accountNamePatterns: RegExp[]
  /** 账号 ID 提取正则（抖音号/快手号等） */
  accountIdPatterns: RegExp[]
  /** 登录页 markers（命中 → 明确未登录） */
  loginPageMarkers: string[]
  /** 是否支持短信验证码登录（默认仅扫码） */
  smsLogin?: boolean
  /** 平台 App 名（扫码提示文案用） */
  appName: string
}

export const CHANNEL_META: Record<string, BrowserChannelMeta> = {
  douyin: {
    platform: 'douyin',
    displayName: '抖音',
    loginUrl: 'https://creator.douyin.com/',
    workspaceUrlFragments: ['creator.douyin.com/creator-micro'],
    pageMarkers: ['创作者中心', '作品管理', '内容管理', '数据概览', '创作灵感'],
    accountNamePatterns: [/抖音号[：:]\s*([0-9A-Za-z_]{4,})/],
    accountIdPatterns: [/抖音号[：:]\s*([0-9A-Za-z_]{4,})/],
    loginPageMarkers: ['扫码登录', '验证码登录', '密码登录'],
    smsLogin: true,
    appName: '抖音',
  },
  kuaishou: {
    platform: 'kuaishou',
    displayName: '快手',
    loginUrl: 'https://cp.kuaishou.com/',
    // ⚠️ 登录页 URL 也是 cp.kuaishou.com（/profile 未登录也跳转），须用工作台专属路径片段
    workspaceUrlFragments: ['cp.kuaishou.com/article', 'cp.kuaishou.com/workbench', 'cp.kuaishou.com/data', 'cp.kuaishou.com/live', 'cp.kuaishou.com/workspace'],
    pageMarkers: ['作品管理', '数据中心', '快手小店', '创作服务', '视频管理', '数据分析'],
    accountNamePatterns: [/快手号[：:]\s*([0-9A-Za-z_]{4,})/, /(?:昵称|账号)[：:]\s*([^\s|，,]{2,20})/],
    accountIdPatterns: [/快手号[：:]\s*([0-9A-Za-z_]{4,})/],
    loginPageMarkers: ['扫码登录', '手机号登录', '扫一扫'],
    smsLogin: true,
    appName: '快手',
  },
  xiaohongshu: {
    platform: 'xiaohongshu',
    displayName: '小红书',
    loginUrl: 'https://creator.xiaohongshu.com/',
    // ⚠️ /login 也在 creator.xiaohongshu.com 域下，须排除登录路径
    workspaceUrlFragments: ['creator.xiaohongshu.com/publish', 'creator.xiaohongshu.com/new', 'creator.xiaohongshu.com/home', 'creator.xiaohongshu.com/data', 'creator.xiaohongshu.com/creator'],
    pageMarkers: ['创作中心', '笔记管理', '数据中心', '粉丝', '蒲公英'],
    accountNamePatterns: [/小红书号[：:]\s*([0-9A-Za-z_]{4,})/, /@([0-9a-zA-Z]{5,})/],
    accountIdPatterns: [/小红书号[：:]\s*([0-9A-Za-z_]{4,})/],
    loginPageMarkers: ['扫码登录', '手机号登录', '登录小红书'],
    smsLogin: true,
    appName: '小红书',
  },
  channels_wechat: {
    platform: 'channels_wechat',
    displayName: '视频号',
    loginUrl: 'https://channels.weixin.qq.com/',
    workspaceUrlFragments: ['channels.weixin.qq.com/platform'],
    pageMarkers: ['视频号助手', '发布动态', '数据中心', '视频号', '发表视频'],
    accountNamePatterns: [/视频号[：:]\s*([^\s|，,]{2,20})/],
    accountIdPatterns: [/gh_[0-9a-f]{10,}/],
    loginPageMarkers: ['微信扫一扫', '扫码登录'],
    smsLogin: false,
    appName: '微信',
  },
  wechat_mp: {
    platform: 'wechat_mp',
    displayName: '微信公众号',
    loginUrl: 'https://mp.weixin.qq.com/',
    workspaceUrlFragments: ['mp.weixin.qq.com'],
    pageMarkers: ['公众号', '图文消息', '素材管理', '内容与互动', '数据'],
    accountNamePatterns: [/公众号[：:]\s*([^\s|，,]{2,20})/, /微信号[：:]\s*([0-9A-Za-z_-]{6,})/],
    accountIdPatterns: [/gh_[0-9a-f]{10,}/],
    loginPageMarkers: ['微信扫一扫', '扫码登录', '请使用微信扫一扫'],
    smsLogin: false,
    appName: '微信',
  },
  weibo: {
    platform: 'weibo',
    displayName: '微博',
    loginUrl: 'https://weibo.com/login.php',
    workspaceUrlFragments: ['weibo.com/u/', 'weibo.com/'],
    pageMarkers: ['微博', '首页', '热门', '超话'],
    accountNamePatterns: [/(?:昵称|微博名)[：:]\s*([^\s|，,]{2,20})/],
    accountIdPatterns: [/weibo\.com\/u\/(\d{8,})/],
    loginPageMarkers: ['扫码登录', '账号登录', '手机号登录'],
    smsLogin: true,
    appName: '微博',
  },
  toutiao: {
    platform: 'toutiao',
    displayName: '今日头条',
    loginUrl: 'https://mp.toutiao.com/',
    workspaceUrlFragments: ['mp.toutiao.com'],
    pageMarkers: ['内容管理', '创作中心', '数据中心', '发布作品', '头条号'],
    accountNamePatterns: [/头条号[：:]\s*([^\s|，,]{2,20})/],
    accountIdPatterns: [/头条号[：:]\s*([^\s|，,]{2,20})/],
    loginPageMarkers: ['扫码登录', '验证码登录', '密码登录'],
    smsLogin: true,
    appName: '抖音',
  },
  baijiahao: {
    platform: 'baijiahao',
    displayName: '百家号',
    loginUrl: 'https://baijiahao.baidu.com/',
    workspaceUrlFragments: ['baijiahao.baidu.com'],
    pageMarkers: ['百家号', '内容管理', '发布', '数据'],
    accountNamePatterns: [/(?:百家号|昵称)[：:]\s*([^\s|，,]{2,20})/],
    accountIdPatterns: [/[0-9]{10,}/],
    loginPageMarkers: ['扫码登录', '百度账号登录', '登录'],
    smsLogin: true,
    appName: '百度',
  },
}

/** 前端渠道中心可用（connectable）的平台列表 */
export const CONNECTABLE_PLATFORMS: string[] = ['douyin', 'kuaishou', 'xiaohongshu', 'channels_wechat', 'wechat_mp']
