/**
 * Action Plan Engine — Templates
 *
 * P0-T007 — Action Plan Engine
 *
 * 30+ action plan templates, each mapped to an opportunity type.
 * Templates are parameterized at runtime with entity/scenario names.
 */

import { ActionPlanTemplate, ActionStep } from './types';

function step(id: string, title: string, description: string, order: number): ActionStep {
  return { id, title, description, order };
}

function t(
  templateId: string,
  title: string,
  description: string,
  steps: ActionStep[],
  estimatedEffort: 'easy' | 'medium' | 'hard',
  estimatedTime: string,
  tags: string[],
  opportunityType: string,
  scenarioMatch?: string[],
): ActionPlanTemplate {
  return {
    templateId,
    title,
    description,
    steps,
    estimatedEffort,
    estimatedTime,
    tags,
    matchCondition: { opportunityType, scenarioMatch },
  };
}

/**
 * All 32 action plan templates.
 *
 * Each template defines:
 *  - What the plan is about (title, description)
 *  - Concrete steps (actionable checklist)
 *  - Effort estimate (easy/medium/hard)
 *  - Time estimate
 *  - Tags for filtering/categorization
 *  - matchCondition: maps to opportunity types from Opportunity Engine
 */
export const ACTION_PLAN_TEMPLATES: ActionPlanTemplate[] = [
  // ── 1. missing-faq ─────────────────────────────────────────────
  t(
    'missing-faq',
    '创建常见问题 FAQ',
    '为 {entityName} 的 {scenarioName} 场景创建 FAQ 内容，提升用户需求覆盖率和搜索可见性。',
    [
      step('mf-1', '分析现有内容是否包含 FAQ', '检查当前页面/内容中是否已有 FAQ 板块', 1),
      step('mf-2', '整理用户常见问题', '收集该场景下用户最常问的 5-10 个问题', 2),
      step('mf-3', '创建 FAQ 内容', '为每个问题撰写清晰、准确的答案', 3),
      step('mf-4', '添加 FAQ Schema 结构化数据', '使用 JSON-LD 标记 FAQ 内容，帮助搜索引擎直接展示', 4),
      step('mf-5', '重新扫描验证覆盖率变化', '再次运行发现扫描，确认 FAQ 对覆盖率的影响', 5),
    ],
    'easy',
    '30 min',
    ['faq', 'content', 'quick-win'],
    'missing-faq',
  ),

  // ── 2. missing-pricing ─────────────────────────────────────────
  t(
    'missing-pricing',
    '补充定价信息',
    '在 {entityName} 的 {scenarioName} 场景中补充完整透明的定价信息，减少用户决策障碍。',
    [
      step('mp-1', '梳理定价策略', '确定需要展示的定价层级和套餐结构', 1),
      step('mp-2', '创建定价页面/区域', '在网站中创建或优化定价展示区域', 2),
      step('mp-3', '添加价格对比表', '用表格或卡片形式对比不同套餐', 3),
      step('mp-4', '添加 Pricing Schema', '使用 Product + Offer 结构化数据标记价格', 4),
      step('mp-5', '验证定价信息可见性', '确认搜索引擎能正确索引价格信息', 5),
    ],
    'medium',
    '1 hour',
    ['pricing', 'conversion', 'medium-effort'],
    'missing-pricing',
  ),

  // ── 3. missing-comparison ──────────────────────────────────────
  t(
    'missing-comparison',
    '创建竞品对比',
    '为 {entityName} 创建与主要竞品的对比内容，帮助用户做出更明智的选择。',
    [
      step('mc-1', '识别主要竞品', '确定 {scenarioName} 场景下的 3-5 个主要竞品', 1),
      step('mc-2', '梳理对比维度', '列出功能、价格、用户体验等对比维度', 2),
      step('mc-3', '创建对比页面', '制作竞品对比表或对比文章', 3),
      step('mc-4', '添加对比 Schema', '使用表格结构化数据标记', 4),
      step('mc-5', '发布并推广', '通过社交媒体和邮件推广对比内容', 5),
    ],
    'medium',
    '2 hours',
    ['comparison', 'competitive', 'medium-effort'],
    'missing-comparison',
  ),

  // ── 4. missing-case-study ──────────────────────────────────────
  t(
    'missing-case-study',
    '编写案例研究',
    '为 {entityName} 创建客户案例研究，增强信任度和说服力。',
    [
      step('cs-1', '确认客户案例来源', '联系成功客户获取案例授权', 1),
      step('cs-2', '收集数据和结果', '获取可量化的成果数据（增长百分比等）', 2),
      step('cs-3', '撰写案例故事', '结构化描述：背景→挑战→方案→结果', 3),
      step('cs-4', '添加引用和推荐', '嵌入客户原话引用', 4),
      step('cs-5', '发布并添加结构化数据', '使用 Article Schema 标记', 5),
    ],
    'hard',
    '4 hours',
    ['case-study', 'trust', 'testimonial'],
    'missing-case-study',
  ),

  // ── 5. missing-author ──────────────────────────────────────────
  t(
    'missing-author',
    '补充作者信息',
    '为 {entityName} 的内容补充作者/创作者信息，提升 E-E-A-T 信号。',
    [
      step('ma-1', '创建作者简介页面', '为每个内容创作者建立带照片和资历简介的页面', 1),
      step('ma-2', '添加 Author Schema', '使用 Person 结构化数据标记作者', 2),
      step('ma-3', '关联作者到内容', '在每篇文章/内容中明确标注作者并链接到作者页', 3),
      step('ma-4', '补充作者社交资料', '链接到作者 LinkedIn、Twitter 等专业社交账号', 4),
      step('ma-5', '验证作者标记', '使用 Rich Results 测试工具验证标记正确性', 5),
    ],
    'easy',
    '30 min',
    ['author', 'eeat', 'trust', 'quick-win'],
    'missing-author',
  ),

  // ── 6. weak-eeat ───────────────────────────────────────────────
  t(
    'weak-eeat',
    '提升 E-E-A-T 信号',
    '全面提升 {entityName} 在 {scenarioName} 场景中的 Experience-Expertise-Authoritativeness-Trustworthiness 信号。',
    [
      step('ee-1', '审核当前 E-E-A-T 信号', '检查网站中展示经验、专业度、权威性和可信度的元素', 1),
      step('ee-2', '补充专家资历信息', '添加团队成员的资质证书、行业经验、出版物', 2),
      step('ee-3', '获取外部权威引用', '链接到行业权威机构的引用和认可', 3),
      step('ee-4', '添加用户评价和证书', '展示客户评价、行业认证、奖项', 4),
      step('ee-5', '定期更新内容', '建立内容定期审核更新机制，保持信息时效性', 5),
    ],
    'hard',
    '4 hours',
    ['eeat', 'trust', 'authority', 'seo'],
    'weak-eeat',
  ),

  // ── 7. no-structured-data ──────────────────────────────────────
  t(
    'no-structured-data',
    '添加结构化数据',
    '为 {entityName} 的 {scenarioName} 场景添加 JSON-LD 结构化数据标记。',
    [
      step('ns-1', '确定 Schema 类型', '根据内容类型选择最相关的 Schema.org 类型', 1),
      step('ns-2', '生成 JSON-LD', '编写符合 Schema.org 规范的 JSON-LD 脚本', 2),
      step('ns-3', '嵌入到页面', '将 JSON-LD 添加到对应页面的 <head> 中', 3),
      step('ns-4', '使用 Rich Results 测试', '通过 Google 富媒体测试工具验证', 4),
      step('ns-5', '监控搜索展示变化', '观察搜索展现中富媒体片段的出现情况', 5),
    ],
    'easy',
    '20 min',
    ['structured-data', 'schema', 'seo', 'quick-win'],
    'no-structured-data',
  ),

  // ── 8. no-citation ─────────────────────────────────────────────
  t(
    'no-citation',
    '添加引用来源',
    '为 {entityName} 的 {scenarioName} 内容添加可靠的引用来源，增强内容可信度和 E-E-A-T。',
    [
      step('nc-1', '梳理需要引用的声明', '找出内容中需要外部来源支持的事实性声明', 1),
      step('nc-2', '寻找权威来源', '从行业报告、学术论文、政府数据中查找引用', 2),
      step('nc-3', '嵌入引用链接', '在内容中添加超链接引用和脚注', 3),
      step('nc-4', '创建参考来源页面', '集中展示所有引用来源的参考页面', 4),
      step('nc-5', '添加 Citation Schema', '使用 ScholarlyArticle 等 Schema 标记引用', 5),
    ],
    'medium',
    '1 hour',
    ['citation', 'trust', 'eeat'],
    'no-citation',
  ),

  // ── 9. thin-content ────────────────────────────────────────────
  t(
    'thin-content',
    '扩充内容深度',
    '扩充 {entityName} 在 {scenarioName} 场景中的内容深度，从表层信息升级为全面的指南级内容。',
    [
      step('tc-1', '评估当前内容深度', '分析现有内容的长度、覆盖面和信息密度', 1),
      step('tc-2', '研究用户深层需求', '通过搜索查询和用户反馈了解用户的深层问题', 2),
      step('tc-3', '扩展内容结构', '添加子主题、示例数据、最佳实践等深度内容', 3),
      step('tc-4', '添加多媒体元素', '融入图表、截图、视频等丰富内容形式', 4),
      step('tc-5', '内部链接优化', '将深度内容与其他相关内容建立链接网络', 5),
    ],
    'medium',
    '2 hours',
    ['content', 'depth', 'quality'],
    'thin-content',
  ),

  // ── 10. no-update-date ─────────────────────────────────────────
  t(
    'no-update-date',
    '添加更新日期',
    '为 {entityName} 的 {scenarioName} 内容添加明确的最后更新日期标记，提升时效性信令。',
    [
      step('ud-1', '添加最后更新日期', '在页面顶部或底部显眼位置显示最后更新日期', 1),
      step('ud-2', '添加 DateModified Schema', '在 JSON-LD 中添加 dateModified 字段', 2),
      step('ud-3', '建立定期审核日历', '创建内容审核日历，确保定期更新', 3),
      step('ud-4', '更新内容并刷新日期', '每次实质性更新后刷新日期标记', 4),
      step('ud-5', '验证日期显示', '检查搜索引擎片段中是否显示更新日期', 5),
    ],
    'easy',
    '15 min',
    ['freshness', 'update', 'quick-win'],
    'no-update-date',
  ),

  // ── 11. missing-basic-info ─────────────────────────────────────
  t(
    'missing-basic-info',
    '补充品牌基本信息',
    '为 {entityName} 补充最基础的品牌描述和信息，让用户和搜索引擎快速了解你是谁、做什么。',
    [
      step('bi-1', '撰写品牌简介', '用 2-3 句话清晰说明品牌核心价值和业务范围', 1),
      step('bi-2', '添加 Organization Schema', '使用 Organization 结构化数据提供品牌信息', 2),
      step('bi-3', '完善品牌核心页面', '确保品牌核心信息在首页、关于页等关键位置一致', 3),
      step('bi-4', '添加同义词和替代名', '标记品牌别称、曾用名、简称等', 4),
      step('bi-5', '验证品牌信息一致性', '确保品牌信息在各平台保持一致', 5),
    ],
    'easy',
    '20 min',
    ['brand', 'basic-info', 'quick-win'],
    'missing-basic-info',
  ),

  // ── 12. position-low ───────────────────────────────────────────
  t(
    'position-low',
    '提升搜索排名',
    '针对 {entityName} 在 {scenarioName} 场景中搜索排名较低的问题，制定综合排名提升方案。',
    [
      step('pl-1', '分析当前排名和竞品', '了解当前排名位置和竞争对手的排名因素', 1),
      step('pl-2', '优化页面 Title 和 Meta', '重写 SEO 标题和 Meta Description', 2),
      step('pl-3', '提升内容质量和长度', '扩写内容，增加深度和原创性', 3),
      step('pl-4', '建设高质量外链', '通过 Guest Post、合作等方式获取高质量外链', 4),
      step('pl-5', '监控排名变化', '使用 SEO 工具跟踪排名变化并调整策略', 5),
    ],
    'hard',
    '8 hours',
    ['seo', 'ranking', 'position'],
    'position-low',
  ),

  // ── 13. no-social-proof ────────────────────────────────────────
  t(
    'no-social-proof',
    '添加社交证据',
    '为 {entityName} 的 {scenarioName} 场景添加社交证据元素，提升用户信任和转化率。',
    [
      step('sp-1', '收集社交媒体数据', '收集粉丝数、分享数、点赞数等社交指标', 1),
      step('sp-2', '添加社交分享计数', '在内容中展示社交分享数量', 2),
      step('sp-3', '嵌入实时社交动态', '展示实时的社交媒体提及和用户生成内容', 3),
      step('sp-4', '添加使用量统计数据', '展示用户数、下载量等权威数据', 4),
      step('sp-5', '整合评价平台评分', '展示 G2、Capterra 等平台的评分', 5),
    ],
    'medium',
    '1 hour',
    ['social-proof', 'trust', 'conversion'],
    'no-social-proof',
  ),

  // ── 14. bad-mobile ─────────────────────────────────────────────
  t(
    'bad-mobile',
    '优化移动端体验',
    '优化 {entityName} 在 {scenarioName} 场景中的移动端展示和交互体验。',
    [
      step('bm-1', '进行移动端审计', '使用 Mobile-Friendly Test 检查移动端兼容性', 1),
      step('bm-2', '优化触控目标大小', '确保按钮和链接在移动端易于点击（≥48px）', 2),
      step('bm-3', '优化字体和排版', '确保移动端文字大小可读，行距舒适', 3),
      step('bm-4', '简化导航结构', '压缩菜单层次，适合单手操作', 4),
      step('bm-5', '测试页面加载速度', '确保移动端加载时间 < 3 秒', 5),
    ],
    'medium',
    '2 hours',
    ['mobile', 'ux', 'responsive'],
    'bad-mobile',
  ),

  // ── 15. slow-loading ───────────────────────────────────────────
  t(
    'slow-loading',
    '提升页面加载速度',
    '优化 {entityName} 的 {scenarioName} 页面加载速度，降低跳出率并提升搜索排名。',
    [
      step('sl-1', '测量当前加载时间', '使用 PageSpeed Insights 获取基准数据', 1),
      step('sl-2', '优化图片和资源', '压缩图片、启用懒加载、使用 WebP 格式', 2),
      step('sl-3', '启用浏览器缓存', '配置合理的缓存策略（Cache-Control 等）', 3),
      step('sl-4', '减少 JavaScript 阻塞', '延迟加载非关键 JS、代码分割', 4),
      step('sl-5', '验证加载速度改善', '重新测试并确认 Core Web Vitals 达标', 5),
    ],
    'medium',
    '2 hours',
    ['performance', 'speed', 'cWV'],
    'slow-loading',
  ),

  // ── 16. missing-video ──────────────────────────────────────────
  t(
    'missing-video',
    '添加视频内容',
    '为 {entityName} 的 {scenarioName} 场景创建或嵌入视频内容，提升用户参与度和内容丰富度。',
    [
      step('mv-1', '确定视频主题', '根据场景需求确定视频内容和形式', 1),
      step('mv-2', '制作或录制视频', '拍摄/动画制作或录制屏幕演示', 2),
      step('mv-3', '编辑和优化视频', '添加字幕、封面、品牌水印', 3),
      step('mv-4', '上传并嵌入页面', '上传到视频平台，嵌入到相关页面', 4),
      step('mv-5', '添加 Video Schema', '使用 VideoObject 结构化数据标记', 5),
    ],
    'hard',
    '4 hours',
    ['video', 'multimedia', 'engagement'],
    'missing-video',
  ),

  // ── 17. missing-images ─────────────────────────────────────────
  t(
    'missing-images',
    '优化图片内容',
    '为 {entityName} 的 {scenarioName} 内容添加和优化图片，提升视觉吸引力和信息传达效果。',
    [
      step('mi-1', '确定需要的图片类型', '产品图、流程图、截图、信息图等', 1),
      step('mi-2', '创建或获取图片', '设计或拍摄高质量的图片', 2),
      step('mi-3', '优化图片大小和格式', '压缩至适当大小，使用 WebP 格式', 3),
      step('mi-4', '添加 Alt 文本', '为每张图片编写描述性 Alt 文本', 4),
      step('mi-5', '添加 Image Schema', '使用 ImageObject 结构化数据标记', 5),
    ],
    'medium',
    '1 hour',
    ['images', 'visual', 'engagement'],
    'missing-images',
  ),

  // ── 18. no-testimonials ────────────────────────────────────────
  t(
    'no-testimonials',
    '添加用户评价',
    '在 {entityName} 的 {scenarioName} 场景中添加用户评价展示，建立社交证明和信任。',
    [
      step('nt-1', '征集用户评价', '联系满意客户征集文字或视频评价', 1),
      step('nt-2', '筛选和整理评价', '选择最有说服力和代表性的评价', 2),
      step('nt-3', '设计评价展示区域', '在关键页面设计醒目的评价展示模块', 3),
      step('nt-4', '添加评价 Schema', '使用 Review 结构化数据标记评价', 4),
      step('nt-5', '定期更新评价', '建立评价收集和更新机制', 5),
    ],
    'medium',
    '2 hours',
    ['testimonials', 'trust', 'social-proof'],
    'no-testimonials',
  ),

  // ── 19. insufficient-reviews ───────────────────────────────────
  t(
    'insufficient-reviews',
    '增加用户评论',
    '增加 {entityName} 在 {scenarioName} 场景中的用户评论数量和覆盖度。',
    [
      step('ir-1', '简化评论流程', '降低用户发表评论的门槛和步骤', 1),
      step('ir-2', '发送评论邀请', '通过邮件和应用提醒邀请用户发表评论', 2),
      step('ir-3', '激励评论行为', '提供积分、折扣等激励', 3),
      step('ir-4', '回复现有评论', '积极回复用户评论，形成互动循环', 4),
      step('ir-5', '展示评论数据', '显示评论总数和平均评分', 5),
    ],
    'medium',
    '2 hours',
    ['reviews', 'user-generated', 'trust'],
    'insufficient-reviews',
  ),

  // ── 20. competitors-ahead ──────────────────────────────────────
  t(
    'competitors-ahead',
    '分析竞品差距',
    '系统分析 {entityName} 与竞品在 {scenarioName} 场景中的差距，制定赶超策略。',
    [
      step('ca-1', '识别关键竞品', '确定 {scenarioName} 场景中的 Top 3 竞品', 1),
      step('ca-2', '竞品内容审计', '分析竞品的内容策略、覆盖面和深度', 2),
      step('ca-3', '差距分析报告', '输出差距矩阵（覆盖范围、质量、深度）', 3),
      step('ca-4', '制定赶超计划', '按优先级列出需要补充的内容和功能', 4),
      step('ca-5', '执行并跟踪', '按计划执行内容补充并追踪效果变化', 5),
    ],
    'hard',
    '3 hours',
    ['competitive', 'analysis', 'gap'],
    'competitors-ahead',
  ),

  // ── 21. no-blog ────────────────────────────────────────────────
  t(
    'no-blog',
    '建立博客内容',
    '为 {entityName} 建立博客内容体系，持续产出自媒体内容覆盖 {scenarioName} 场景。',
    [
      step('nb-1', '确定博客主题策略', '规划与 {scenarioName} 相关的博客主题方向', 1),
      step('nb-2', '设置博客平台', '搭建或配置博客系统', 2),
      step('nb-3', '撰写前 5 篇文章', '按规划主题撰写至少 5 篇高质量的博客文章', 3),
      step('nb-4', '优化博客 SEO', '为每篇文章做好关键词、内部链接优化', 4),
      step('nb-5', '制定发布日历', '规划每周/每月的连续发布计划', 5),
    ],
    'hard',
    '8 hours',
    ['blog', 'content', 'long-term'],
    'no-blog',
  ),

  // ── 22. poor-cta ───────────────────────────────────────────────
  t(
    'poor-cta',
    '优化行动号召',
    '优化 {entityName} 在 {scenarioName} 场景中的 CTA（Call-to-Action）设计，提升转化率。',
    [
      step('pc-1', '审计现有 CTA', '检查当前页面中所有 CTA 的设计和文案', 1),
      step('pc-2', '设计新的 CTA 文案', '撰写具有行动导向和紧迫感的 CTA 文案', 2),
      step('pc-3', '优化 CTA 视觉效果', '调整颜色、大小、位置使其更醒目', 3),
      step('pc-4', 'A/B 测试', '对不同版本 CTA 进行 A/B 测试对比', 4),
      step('pc-5', '实施最优版本', '部署测试胜出版本并持续监控', 5),
    ],
    'easy',
    '30 min',
    ['cta', 'conversion', 'optimization', 'quick-win'],
    'poor-cta',
  ),

  // ── 23. no-schema-breadcrumb ───────────────────────────────────
  t(
    'no-schema-breadcrumb',
    '添加面包屑导航',
    '为 {entityName} 的 {scenarioName} 相关页面添加面包屑导航和 BreadcrumbList Schema。',
    [
      step('sb-1', '设计面包屑路径', '确定网站各页面的层级结构和面包屑路径', 1),
      step('sb-2', '实现面包屑 UI', '在页面顶部区域添加可视面包屑导航', 2),
      step('sb-3', '添加 BreadcrumbList Schema', '使用 JSON-LD 标记面包屑结构化数据', 3),
      step('sb-4', '测试面包屑导航', '验证所有页面的面包屑路径正确性和可用性', 4),
      step('sb-5', '验证搜索展示效果', '检查谷歌搜索结果中面包屑的显示', 5),
    ],
    'easy',
    '20 min',
    ['breadcrumb', 'navigation', 'ux', 'quick-win'],
    'no-schema-breadcrumb',
  ),

  // ── 24. missing-faq-schema ─────────────────────────────────────
  t(
    'missing-faq-schema',
    '添加 FAQ Schema',
    '为 {entityName} 的 {scenarioName} 内容添加 FAQPage 结构化数据，提升搜索结果展示效果。',
    [
      step('fs-1', '整理 FAQ 列表', '汇总该场景下最常见的 3-5 条 FAQ', 1),
      step('fs-2', '撰写问答内容', '为每个 FAQ 撰写清晰准确的问答', 2),
      step('fs-3', '生成 FAQPage Schema', '使用 JSON-LD 格式编写 FAQPage 标记', 3),
      step('fs-4', '嵌入页面', '将 Schema 嵌入对应页面 <head>', 4),
      step('fs-5', '测试富媒体展示', '使用 Rich Results Test 工具验证', 5),
    ],
    'easy',
    '15 min',
    ['faq', 'schema', 'rich-results', 'quick-win'],
    'missing-faq-schema',
  ),

  // ── 25. no-local-seo ───────────────────────────────────────────
  t(
    'no-local-seo',
    '优化本地 SEO',
    '优化 {entityName} 的本地搜索可见性，提升在本地化 {scenarioName} 场景中的曝光。',
    [
      step('ls-1', '完善 Google Business Profile', '创建或优化 Google 商家信息', 1),
      step('ls-2', '添加 LocalBusiness Schema', '使用 LocalBusiness 结构化数据标记', 2),
      step('ls-3', '优化本地关键词', '在内容中加入城市名、区域名等本地化关键词', 3),
      step('ls-4', '获取本地外链', '与本地网站、商会等建立链接关系', 4),
      step('ls-5', '管理本地评价', '积极管理各地评价平台的评分和回复', 5),
    ],
    'medium',
    '2 hours',
    ['local-seo', 'local', 'maps'],
    'no-local-seo',
  ),

  // ── 26. missing-about-page ─────────────────────────────────────
  t(
    'missing-about-page',
    '创建关于页面',
    '为 {entityName} 创建完整、专业的关于页面，强化品牌故事和 E-E-A-T。',
    [
      step('ap-1', '梳理品牌故事', '整理品牌历史、使命、愿景和核心团队信息', 1),
      step('ap-2', '撰写关于页面内容', '按时间线或主题结构撰写品牌故事', 2),
      step('ap-3', '添加团队信息', '展示核心团队成员的照片和简介', 3),
      step('ap-4', '添加 AboutPage Schema', '使用 AboutPage 结构化数据标记', 4),
      step('ap-5', '链接到其他核心页面', '在关于页面中链路到产品、联系等页面', 5),
    ],
    'medium',
    '2 hours',
    ['about', 'brand', 'trust'],
    'missing-about-page',
  ),

  // ── 27. no-privacy-policy ──────────────────────────────────────
  t(
    'no-privacy-policy',
    '添加隐私政策',
    '为 {entityName} 创建完整的隐私政策页面，满足合规要求并增强用户信任。',
    [
      step('pp-1', '了解隐私法规要求', '根据 GDPR/CCPA 等法规梳理隐私政策必备内容', 1),
      step('pp-2', '撰写隐私政策', '涵盖数据收集、使用、存储、共享等核心条款', 2),
      step('pp-3', '更新 Cookie 同意机制', '配置 Cookie 同意弹窗和管理设置', 3),
      step('pp-4', '添加隐私政策链接', '在网站页脚和注册表单处添加隐私政策链接', 4),
      step('pp-5', '定期审阅更新', '每 6 个月审阅并更新隐私政策', 5),
    ],
    'medium',
    '1 hour',
    ['privacy', 'legal', 'trust', 'compliance'],
    'no-privacy-policy',
  ),

  // ── 28. missing-product-demo ───────────────────────────────────
  t(
    'missing-product-demo',
    '创建产品演示',
    '为 {entityName} 的 {scenarioName} 场景创建产品演示内容，帮助用户直观了解产品价值。',
    [
      step('pd-1', '确定演示内容范围', '确定演示涵盖的功能和使用场景', 1),
      step('pd-2', '制作演示视频或交互 Demo', '录制视频或构建可交互的产品演示', 2),
      step('pd-3', '添加演示申请表单', '设置预约演示的表单流程', 3),
      step('pd-4', '嵌入到相关页面', '在产品页和场景页嵌入演示入口', 4),
      step('pd-5', '跟踪演示转化率', '分析演示带来的转化效果并优化', 5),
    ],
    'hard',
    '6 hours',
    ['demo', 'product', 'conversion'],
    'missing-product-demo',
  ),

  // ── 29. poor-navigation ────────────────────────────────────────
  t(
    'poor-navigation',
    '优化网站导航',
    '优化 {entityName} 网站的整体导航结构，提升用户体验和信息查找效率。',
    [
      step('pn-1', '审计当前导航结构', '分析现有导航菜单的层次和使用痛点', 1),
      step('pn-2', '设计导航信息架构', '重新规划菜单结构和分类标签', 2),
      step('pn-3', '实现新导航', '开发新的导航菜单和面包屑路径', 3),
      step('pn-4', '添加搜索功能', '实现站内搜索功能', 4),
      step('pn-5', '用户测试和迭代', '收集用户反馈并持续优化导航', 5),
    ],
    'hard',
    '6 hours',
    ['navigation', 'ux', 'ia'],
    'poor-navigation',
  ),

  // ── 30. no-contact-info ────────────────────────────────────────
  t(
    'no-contact-info',
    '添加联系信息',
    '为 {entityName} 提供清晰、完整的联系信息，降低用户触达门槛。',
    [
      step('ci-1', '确定联系渠道', '电话、邮箱、在线聊天、联系表单等', 1),
      step('ci-2', '创建联系页面', '集中展示所有联系方式和回复时间', 2),
      step('ci-3', '在页脚显示基本信息', '在网站页脚展示电话和邮箱', 3),
      step('ci-4', '添加 ContactPoint Schema', '使用 ContactPoint 结构化数据标记', 4),
      step('ci-5', '测试联系渠道可用性', '确保所有联系渠道正常工作', 5),
    ],
    'easy',
    '30 min',
    ['contact', 'trust', 'accessibility', 'quick-win'],
    'no-contact-info',
  ),

  // ── 31. customer-support ───────────────────────────────────────
  t(
    'customer-support',
    '完善客户支持',
    '为 {entityName} 的 {scenarioName} 场景建立完善的支持体系，提升客户满意度。',
    [
      step('cs-1', '确定支持渠道', '在线聊天、客服邮箱、知识库、FAQ 等', 1),
      step('cs-2', '建立知识库', '创建自助服务知识库页面', 2),
      step('cs-3', '配置在线客服', '接入在线聊天或客服机器人', 3),
      step('cs-4', '设置 SLA 和响应时间', '明确定义各渠道的响应时间承诺', 4),
      step('cs-5', '收集客户反馈', '建立满意度评分和反馈收集机制', 5),
    ],
    'hard',
    '4 hours',
    ['support', 'customer-service', 'trust'],
    'customer-support',
  ),

  // ── 32. missing-mobile-app ─────────────────────────────────────
  t(
    'missing-mobile-app',
    '补充移动应用信息',
    '为 {entityName} 的移动应用添加完整的应用商店信息和下载入口，覆盖移动端用户需求。',
    [
      step('ma-1', '准备应用商店信息', '截图、描述、关键词等 ASO 素材', 1),
      step('ma-2', '优化 App Store / Play Store 页面', '完善应用商店列表信息', 2),
      step('ma-3', '添加应用下载入口', '在网站中添加明显的下载按钮和二维码', 3),
      step('ma-4', '添加 MobileApplication Schema', '使用 MobileApplication 标记应用信息', 4),
      step('ma-5', '跟踪下载转化', '监控下载渠道的转化效果', 5),
    ],
    'medium',
    '2 hours',
    ['mobile-app', 'app-store', 'download'],
    'missing-mobile-app',
  ),
];

/** Template lookup by templateId */
export function getTemplate(templateId: string): ActionPlanTemplate | undefined {
  return ACTION_PLAN_TEMPLATES.find((tpl) => tpl.templateId === templateId);
}

/** Get all unique opportunity types from templates */
export function getTemplateOpportunityTypes(): string[] {
  return [...new Set(ACTION_PLAN_TEMPLATES.map((tpl) => tpl.matchCondition.opportunityType))];
}
