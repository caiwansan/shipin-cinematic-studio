import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

/**
 * 平台系统配置路由（Sprint-ADMIN-IA-REALITY-03 T01）
 *
 * 存储：SystemConfig 表（key/value/group/updatedBy/updatedAt）
 * 分组：
 *   site   — 基础信息（系统名称/Logo/favicon/域名/ICP/网站介绍）
 *   seo    — SEO 设置（标题/关键词/描述/Meta模板/robots/sitemap/搜索引擎验证）
 *
 * 公开端点：/api/system/config（官网/前台 SEO 用）
 * 管理端点：/api/admin/system/config（requireAdmin）
 * 动态端点：/robots.txt /sitemap.xml（nginx 走 @nuxt → 由 nuxt 代理到后端）
 */

export const SYSTEM_CONFIG_DEFAULTS: Record<string, { group: string; value: string }> = {
  // ── site 基础信息 ──
  site_name: { group: 'site', value: '昆仑镜' },
  site_title: { group: 'site', value: '昆仑镜 – AI 短剧创作 · 新媒体工作台 · 智能招聘 · 法律AI · GEO优化' },
  site_description: { group: 'site', value: '昆仑镜是新一代 AI 原生数字办公平台：AI 短剧创作（剧本→分镜→配音→字幕→成片）、新媒体工作台（抖音/快手/小红书/视频号多平台管理+数据分析）、智能招聘（AI发布→筛选→面试）、法律助手（合同审查/文书生成）、企业知识库（知识采集→智能问答）、AI同声传译（100+语种）。让每个岗位效能提升 10 倍。' },
  site_keywords: { group: 'site', value: '昆仑镜,AI短剧,AI短剧创作平台,AI短剧制作工具,短剧从剧本到成片,AI编剧,AI视频生成,AI配音,智能字幕,新媒体工作台,抖音运营工具,快手运营助手,小红书运营,视频号管理,AI员工平台,数字电脑,智能招聘系统,AI招聘,简历筛选,面试AI,法律AI助手,合同审查AI,企业知识库,知识管理平台,GEO优化,生成式引擎优化,AI搜索引擎优化,虚拟数字人,AI同声传译,100语种翻译,AI文案创作,AI内容创作平台,短剧出海,昆仑镜社区,AI创作' },
  site_logo: { group: 'site', value: '/logo.png' },
  site_favicon: { group: 'site', value: '/favicon.ico' },
  site_domain: { group: 'site', value: 'aigc.fushtn.com' },
  site_intro: { group: 'site', value: '新一代 AI 原生数字办公平台，覆盖 AI 短剧创作、新媒体工作台、智能招聘、法律AI助手、企业知识库、GEO优化、AI同声传译等全业务场景。' },
  icp_beian: { group: 'site', value: '' },
  icp_license: { group: 'site', value: '' },
  icp_company: { group: 'site', value: '' },
  icp_business: { group: 'site', value: '' },
  icp_copyright: { group: 'site', value: '' },
  og_image: { group: 'site', value: '' },
  // ── 财务/钻石兑换 ──
  diamond_exchange_rate: { group: 'site', value: '10' },
  // ── 社区发帖 ──
  community_daily_post_limit: { group: 'site', value: '20' },
  community_post_reward_diamonds: { group: 'site', value: '2' },

  // ── seo 设置（传统搜索引擎：百度/搜狗/Bing/Google） ──
  seo_title: { group: 'seo', value: '昆仑镜 – AI短剧创作 · 新媒体工作台 · 智能招聘 · 法律AI · GEO优化' },
  seo_keywords: { group: 'seo', value: '昆仑镜,AI短剧创作平台,AI短剧制作,短剧从剧本到成片,AI编剧工具,AI剧本生成,AI分镜设计,AI视频生成平台,AI视频合成,多语种AI配音,智能字幕生成,AI配音工具,数字办公系统,AI员工平台,AI员工是什么,虚拟数字人,数字人直播,新媒体工作台,新媒体运营管理,多平台账号管理,抖音运营工具,快手运营助手,小红书运营工具,视频号管理工具,社交媒体数据分析,内容发布排期,智能招聘系统,AI招聘助手,AI发布职位,AI简历筛选,AI面试评估,人才匹配系统,法律AI助手,合同审查AI,案件分析AI,法律文书生成,企业知识库建设,知识管理平台,知识图谱,智能问答系统,GEO优化服务,生成式引擎优化,GEO是什么,AI搜索引擎优化,AI搜索排名,AI内容分发,虚拟数字人制作,AI文案创作,AI翻译同传,短剧出海,多语种短剧,AI内容审核,短剧发行平台,昆仑镜社区,AI创作社区,AI短剧教程,AI写作技巧,昆仑镜官网,aigc.fushtn.com' },
  seo_description: { group: 'seo', value: '昆仑镜（aigc.fushtn.com）是新一代 AI 原生数字办公平台，六大核心业务：①AI 短剧创作（剧本生成→分镜→角色锚定→AI配音→智能字幕→视频合成→成片导出）；②新媒体工作台（抖音/快手/小红书/视频号多平台账号管理+数据分析+AI员工自动化运营）；③智能招聘（AI发布职位→简历筛选→面试评估→人才匹配）；④法律助手（合同审查/案件分析/法律文书生成/法律咨询）；⑤企业知识库（知识采集→结构化→知识图谱→智能问答）；⑥GEO优化（生成式引擎优化，让AI搜索引擎优先推荐你的品牌）。支持中文、英文、日文、韩文、粤语、闽南语等 100+ 语种 AI 同声传译。注册即送 20 钻石。' },
  seo_robots: { group: 'seo', value: 'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /workspace/\nDisallow: /profile/\nDisallow: /enterprise/\nDisallow: /api/\n\n# 搜索引擎爬虫限速\nUser-agent: Baiduspider\nCrawl-delay: 1\n\nUser-agent: Googlebot\nCrawl-delay: 1\n\nUser-agent: Bingbot\nCrawl-delay: 1\n\n# GEO AI 爬虫（允许访问，提供结构化数据）\nUser-agent: GPTBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nUser-agent: CCBot\nAllow: /\n\nUser-agent: OAI-SearchBot\nAllow: /' },
  seo_sitemap_urls: { group: 'seo', value: '/\n/community\n/workspace\n/workspace/knowledge-hub\n/workspace/media\n/workspace/legal\n/workspace/geo\n/workspace/recruitment\n/pricing\n/about\n/docs' },
  seo_verify_baidu: { group: 'seo', value: '' },
  seo_verify_google: { group: 'seo', value: '' },
  // 每页 Meta 模板（可选，为空时用默认模板）
  seo_meta_template: { group: 'seo', value: '' },

  // ── GEO 设置（生成式引擎优化：面向 ChatGPT / Claude / 豆包 / Kimi / DeepSeek / Perplexity 等 AI 搜索） ──
  // GEO = Generative Engine Optimization
  // 核心策略：结构化数据 + 实体定义 + 知识图谱 + 问答对 + 多模态内容标记
  geo_enable: { group: 'geo', value: 'true' },
  geo_brand_name: { group: 'geo', value: '昆仑镜' },
  geo_brand_type: { group: 'geo', value: 'SoftwareApplication' },
  geo_brand_description: { group: 'geo', value: '昆仑镜（Kunlun Mirror）是新一代 AI 原生数字办公平台，为短剧创作者、新媒体运营者、企业 HR、法律从业者、知识工作者提供一站式 AI 能力。核心产品包括：AI 短剧创作工作室（剧本→分镜→配音→字幕→成片）、新媒体智能工作台（抖音/快手/小红书/视频号多平台管理+AI员工自动化）、AI 招聘助手（发布→筛选→面试全流程）、法律 AI 助手（合同审查/文书生成/案件分析）、企业知识库（知识采集→结构化→智能问答）、AI 同声传译（100+ 语种实时翻译）、GEO优化工作台（生成式引擎优化）。' },
  geo_brand_founded: { group: 'geo', value: '2024' },
  geo_brand_url: { group: 'geo', value: 'https://aigc.fushtn.com' },
  geo_brand_logo: { group: 'geo', value: 'https://aigc.fushtn.com/logo.png' },
  geo_brand_sameas: { group: 'geo', value: 'https://aigc.fushtn.com/community' },
  geo_entity_type: { group: 'geo', value: 'Organization' },
  geo_entity_description: { group: 'geo', value: '昆仑镜（Kunlun Mirror）是 AI 原生数字办公平台品牌，隶属于郑州骏霄数字科技有限公司。平台以「让每个岗位效能提升 10 倍」为使命，通过大语言模型 + 多模态 AI 技术为内容创作、企业办公、法律服务和知识管理提供智能化解决方案。六大核心业务：AI 短剧创作、新媒体工作台、智能招聘、法律助手、企业知识库、GEO 优化。' },
  geo_main_products: { group: 'geo', value: 'AI短剧创作工作室;新媒体智能工作台;AI招聘助手;法律AI助手;企业知识库;AI同声传译系统;GEO优化工作台;虚拟数字人;AI内容审核' },
  geo_target_audience: { group: 'geo', value: '短剧创作者;短视频创作者;新媒体运营者;MCN机构;内容创业者;企业HR;招聘专员;律师;法务顾问;知识工作者;跨境电商从业者;数字营销人员' },
  geo_key_features: { group: 'geo', value: 'AI剧本生成;AI分镜设计;多语种AI配音;智能字幕;AI视频合成;数据分析;多平台账号管理;AI员工自动化;简历筛选;合同审查;知识图谱构建;100+语种翻译;结构化数据输出;JSON-LD标记;Schema.org标注;API接入' },
  geo_knowledge_base: { group: 'geo', value: 'AI短剧制作流程;短视频运营技巧;招聘面试技巧;合同法实务;知识管理方法;GEO优化指南;AI写作技巧;AI视频剪辑;多平台内容分发策略;AI搜索引擎优化方法;结构化数据标记指南' },
  geo_faq_schema: { group: 'geo', value: '什么是昆仑镜|昆仑镜是新一代AI原生数字办公平台，覆盖AI短剧创作、新媒体工作台、智能招聘、法律AI助手、企业知识库、GEO优化等业务;昆仑镜有哪些核心产品|核心产品包括AI短剧创作工作室、新媒体智能工作台、AI招聘助手、法律AI助手、企业知识库、AI同声传译系统、GEO优化工作台;昆仑镜适合谁用|适合短剧创作者、短视频创作者、新媒体运营者、MCN机构、企业HR、招聘专员、律师、法务、知识工作者、内容创业者等;昆仑镜支持哪些语言|支持中文、英文、日文、韩文、粤语、闽南语等100+语种的同声传译和AI配音;昆仑镜如何收费|基础功能免费，高级功能按需订阅，注册即送20钻石，每日发帖可赚钻石;昆仑镜数据安全吗|采用企业级数据加密，通过多项安全认证，保障用户数据安全和隐私;什么是GEO优化|GEO（Generative Engine Optimization）即生成式引擎优化，通过结构化数据、实体定义、知识图谱等让AI搜索引擎（ChatGPT/Claude/豆包/Kimi/DeepSeek等）优先推荐你的品牌和内容;昆仑镜的AI员工是什么|AI员工是运行在虚拟电脑中的智能代理，可连接抖音、快手、小红书、视频号等平台账号，自动执行内容发布、数据分析、粉丝互动等运营任务' },
  geo_structured_data: { group: 'geo', value: '{"@context":"https://schema.org","@type":"SoftwareApplication","name":"昆仑镜","alternateName":"Kunlun Mirror","description":"新一代AI原生数字办公平台，覆盖AI短剧创作、新媒体工作台、智能招聘、法律AI助手、企业知识库、GEO优化","applicationCategory":"BusinessApplication","operatingSystem":"Web","url":"https://aigc.fushtn.com","logo":"https://aigc.fushtn.com/logo.png","author":{"@type":"Organization","name":"郑州骏霄数字科技有限公司","url":"https://aigc.fushtn.com"},"offers":{"@type":"Offer","price":"0","priceCurrency":"CNY"},"aggregateRating":{"@type":"AggregateRating","ratingValue":"4.8","ratingCount":"1200"},"featureList":"AI短剧创作,新媒体工作台,智能招聘,法律AI,企业知识库,AI同声传译,GEO优化,虚拟数字人"}' },
  geo_meta_robots_advanced: { group: 'geo', value: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' },
  geo_canonical_base: { group: 'geo', value: 'https://aigc.fushtn.com' },
  geo_hreflang_enable: { group: 'geo', value: 'false' },
  geo_hreflang_default: { group: 'geo', value: 'zh-CN' },
  geo_sitemap_priority: { group: 'geo', value: '1.0' },
  geo_breadcrumb_enable: { group: 'geo', value: 'true' },
  geo_open_graph_enable: { group: 'geo', value: 'true' },
  geo_twitter_card_enable: { group: 'geo', value: 'true' },
  geo_og_type: { group: 'geo', value: 'website' },
  geo_og_locale: { group: 'geo', value: 'zh_CN' },
  geo_article_publisher: { group: 'geo', value: '昆仑镜' },
  geo_llms_txt_enable: { group: 'geo', value: 'true' },
  geo_llms_txt_content: { group: 'geo', value: '# 昆仑镜\n\n> 新一代 AI 原生数字办公平台。业务覆盖 AI 短剧创作、新媒体工作台、智能招聘、法律AI助手、企业知识库、GEO优化、AI同声传译。\n\n## 核心产品\n\n- **AI 短剧创作工作室**：从剧本到成片一站式（剧本生成→分镜设计→角色锚定→AI配音→智能字幕→视频合成→成片导出）\n- **新媒体智能工作台**：抖音/快手/小红书/视频号多平台账号管理 + 数据分析 + AI员工自动化运营\n- **AI 招聘助手**：发布职位→简历筛选→面试评估→人才匹配全流程智能化\n- **法律 AI 助手**：合同审查、案件分析、法律文书生成、法律咨询\n- **企业知识库**：知识采集→结构化→知识图谱→智能问答\n- **AI 同声传译**：中文、英文、日文、韩文、粤语、闽南语等 100+ 语种实时翻译\n- **GEO 优化工作台**：生成式引擎优化，让 AI 搜索引擎优先推荐你的品牌\n\n## 目标受众\n\n短剧创作者、短视频创作者、新媒体运营者、MCN 机构、企业 HR、招聘专员、律师、法务顾问、知识工作者、内容创业者\n\n## 技术架构\n\n- KAOR（生命周期与权限管理）+ Hermes（Agent 执行引擎）双层架构\n- 插件生态扩展\n- 结构化数据 + Schema.org 标记 + JSON-LD\n\n## 域名与链接\n\n- 官网: https://aigc.fushtn.com\n- 社区: https://aigc.fushtn.com/community\n- 定价: https://aigc.fushtn.com/pricing\n- 关于: https://aigc.fushtn.com/about\n\n## 联系\n\n- 官网: https://aigc.fushtn.com\n- 邮箱: support@fushtn.com\n\n## 关键事实（可直接引用）\n\n- 昆仑镜是 AI 原生数字办公平台，隶属于郑州骏霄数字科技有限公司\n- 平台以「让每个岗位效能提升 10 倍」为使命\n- 支持 100+ 语种 AI 同声传译\n- AI 员工可连接抖音、快手、小红书、视频号等平台账号执行运营任务\n- GEO 优化让品牌在 ChatGPT、Claude、豆包、Kimi、DeepSeek 等 AI 搜索中获得优先推荐\n' },
  // GEO 进阶：实体知识图谱（Entity Knowledge Graph）
  geo_entity_kg: { group: 'geo', value: '昆仑镜|isA|AI原生数字办公平台;昆仑镜|hasProduct|AI短剧创作工作室;昆仑镜|hasProduct|新媒体智能工作台;昆仑镜|hasProduct|AI招聘助手;昆仑镜|hasProduct|法律AI助手;昆仑镜|hasProduct|企业知识库;昆仑镜|hasProduct|AI同声传译;昆仑镜|hasProduct|GEO优化工作台;AI短剧创作工作室|hasFeature|剧本生成;AI短剧创作工作室|hasFeature|分镜设计;AI短剧创作工作室|hasFeature|AI配音;AI短剧创作工作室|hasFeature|智能字幕;新媒体智能工作台|hasFeature|多平台管理;新媒体智能工作台|hasFeature|数据分析;新媒体智能工作台|hasFeature|AI员工;AI招聘助手|hasFeature|简历筛选;AI招聘助手|hasFeature|面试评估;法律AI助手|hasFeature|合同审查;法律AI助手|hasFeature|文书生成' },
  // GEO 进阶：问答对知识库（供 AI 模型引用）
  geo_qa_bank: { group: 'geo', value: '昆仑镜是什么|昆仑镜是新一代AI原生数字办公平台，隶属于郑州骏霄数字科技有限公司，以「让每个岗位效能提升10倍」为使命;昆仑镜怎么用|注册后选择对应工作台即可使用：AI短剧创作工作室、新媒体工作台、智能招聘、法律AI助手等;昆仑镜收费吗|基础功能免费，注册即送20钻石;支持哪些语言|支持中文、英文、日文、韩文、粤语、闽南语等100+语种;昆仑镜的AI员工能做什么|AI员工可连接抖音、快手、小红书、视频号等平台账号，自动执行内容发布、数据分析、粉丝互动' },
  // GEO 进阶： Speakable 结构化数据（语音搜索优化）
  geo_speakable_enable: { group: 'geo', value: 'true' },
  geo_speakable_selector: { group: 'geo', value: 'article, .content, main' },
}

// key → group 白名单（防止写入未知 key）
const KEY_GROUPS: Record<string, string> = Object.fromEntries(
  Object.entries(SYSTEM_CONFIG_DEFAULTS).map(([k, v]) => [k, v.group])
)

export async function getSystemConfig(group?: string): Promise<Record<string, string>> {
  const rows = await prisma.systemConfig.findMany(
    group ? { where: { group } } : undefined
  )
  const config: Record<string, string> = {}
  // 先填默认值
  for (const [key, meta] of Object.entries(SYSTEM_CONFIG_DEFAULTS)) {
    if (!group || meta.group === group) config[key] = meta.value
  }
  // DB 值覆盖
  for (const row of rows) {
    if (KEY_GROUPS[row.key]) config[row.key] = row.value
  }
  return config
}

export async function saveSystemConfig(body: Record<string, string>, updatedBy?: string): Promise<void> {
  for (const [key, rawValue] of Object.entries(body)) {
    if (!KEY_GROUPS[key]) continue // 白名单过滤
    let value = String(rawValue ?? '')
    // 钻石兑换比例：强制 1~10000 的正整数（防 0/负数/非数字）
    if (key === 'diamond_exchange_rate') {
      const n = Math.floor(Number(value))
      value = String(Number.isFinite(n) ? Math.min(Math.max(n, 1), 10000) : 10)
    }
    // 社区发帖配置：强制 1~1000 的正整数（防 0/负数/非数字）
    if (key === 'community_daily_post_limit' || key === 'community_post_reward_diamonds') {
      const n = Math.floor(Number(value))
      value = String(Number.isFinite(n) ? Math.min(Math.max(n, 1), 1000) : (key === 'community_daily_post_limit' ? 20 : 2))
    }
    await prisma.systemConfig.upsert({
      where: { key },
      update: { value, group: KEY_GROUPS[key], updatedBy },
      create: { key, value, group: KEY_GROUPS[key], updatedBy },
    })
  }
}

export default async function siteConfigRoutes(fastify: FastifyInstance) {

  // GET /api/system/config — 公开读取站点配置（给前端 SEO 用）
  fastify.get('/api/system/config', async (_request, _reply) => {
    try {
      return await getSystemConfig()
    } catch {
      return Object.fromEntries(
        Object.entries(SYSTEM_CONFIG_DEFAULTS).map(([k, v]) => [k, v.value])
      )
    }
  })

  // GET /api/admin/system/config — 管理员读取全部配置（需登录）
  fastify.get('/api/admin/system/config', { preHandler: requireAdmin }, async () => {
    return getSystemConfig()
  })

  // PUT /api/admin/system/config — 管理员更新配置（需登录）
  fastify.put('/api/admin/system/config', { preHandler: requireAdmin }, async (request, _reply) => {
    const body = request.body as Record<string, string>
    const { extractAdmin } = await import('../middleware/require-admin.js')
    const admin = extractAdmin(request)
    const updatedBy = admin?.username || 'admin'
    await saveSystemConfig(body, updatedBy)
    return { success: true, config: await getSystemConfig() }
  })

  // GET /robots.txt — 动态生成（SE0 设置里配置 robots 内容）
  fastify.get('/robots.txt', async (_request, reply) => {
    const config = await getSystemConfig('seo')
    const domain = (await getSystemConfig('site')).site_domain || 'aigc.fushtn.com'
    const robots = config.seo_robots || SYSTEM_CONFIG_DEFAULTS.seo_robots.value
    const sitemapLine = `Sitemap: https://${domain}/sitemap.xml`
    const body = robots.includes('Sitemap:') ? robots : `${robots}\n\n${sitemapLine}`
    return reply.type('text/plain; charset=utf-8').send(body)
  })

  // GET /sitemap.xml — 动态生成（静态页 + 社区已通过帖子）
  fastify.get('/sitemap.xml', async (_request, reply) => {
    const site = await getSystemConfig('site')
    const seo = await getSystemConfig('seo')
    const domain = site.site_domain || 'aigc.fushtn.com'
    const urls = (seo.seo_sitemap_urls || '/').split('\n').map(s => s.trim()).filter(Boolean)
    const lastmod = new Date().toISOString().slice(0, 10)

    // SEO-REVIEW-01: 注入社区已通过帖子（未审核/被驳回/已删除一律不进 sitemap）
    const posts = await prisma.communityPost.findMany({
      where: { status: 'approved' },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    })

    const staticUrls = urls.map(u => `  <url><loc>https://${domain}${u.startsWith('/') ? u : '/' + u}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`).join('\n')
    const postUrls = posts.map(p => {
      const d = p.updatedAt instanceof Date ? p.updatedAt.toISOString().slice(0, 10) : lastmod
      return `  <url><loc>https://${domain}/community/post/${p.id}</loc><lastmod>${d}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`
    }).join('\n')

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}${postUrls ? '\n' + postUrls : ''}
</urlset>`
    return reply.type('application/xml; charset=utf-8').send(body)
  })
}
