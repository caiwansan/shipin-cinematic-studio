// sensitive-word-seed.ts — 内置敏感词库（SPRINT-IM-CHA-03 M3）
// 掌柜 2026-08-06 指令：国家领导人姓名 / 政治 / 宗教 / 色情 / 毒品 / 赌博 / 性器官 等列入敏感词
// level: 4 高敏（替换+审计+踢出）/ 3 中敏（替换+审计+警告）/ 2 常规（替换+审计）
// 原则：精确匹配、克制防误伤（单字/常用词/医学词/正常宗教词不列）
import { prisma } from '../utils/index.js'

export interface SeedWord {
  word: string
  category: 'leader' | 'politics' | 'religion' | 'porn' | 'drug' | 'gambling' | 'body' | 'other'
  level: 2 | 3 | 4
}

const L4 = 4 as const
const L3 = 3 as const
const L2 = 2 as const

// ── 国家领导人姓名（精确全名，level 4）──────────────────────
const leaders: SeedWord[] = [
  // 现任（二十届政治局常委 + 政治局委员 + 主要国务领导）
  '习近平', '李强', '赵乐际', '王沪宁', '蔡奇', '丁薛祥', '李希',
  '马兴瑞', '王毅', '尹力', '石泰峰', '刘国中', '李干杰', '李书磊',
  '李鸿忠', '何卫东', '何立峰', '张又侠', '张国清', '陈文清', '陈吉宁',
  '陈敏尔', '袁家军', '黄坤明', '刘金国', '王小洪',
  '谌贻琴', '吴政隆', '信长星', '彭清华', '易炼红', '王忠林', '罗文',
  // 历史主要领导人
  '毛泽东', '周恩来', '刘少奇', '朱德', '邓小平', '陈云',
  '江泽民', '胡锦涛', '温家宝', '李克强', '华国锋', '胡耀邦', '赵紫阳',
  '李鹏', '朱镕基', '乔石', '李瑞环', '宋平', '尉健行', '李岚清',
  '吴邦国', '贾庆林', '李长春', '贺国强', '吴官正', '曾庆红', '黄菊',
  '罗干', '张德江', '俞正声', '刘云山', '王岐山', '张高丽', '栗战书',
  '汪洋', '韩正', '宋庆龄', '彭真', '万里', '荣毅仁', '李先念',
].map((word) => ({ word, category: 'leader' as const, level: L4 }))

// ── 政治类（非法组织/分裂/颠覆/敏感事件，level 4）────────────
const politics: SeedWord[] = [
  '台独', '港独', '藏独', '疆独', '东突厥斯坦', '西藏独立', '台湾独立',
  '香港独立', '新疆独立', '颠覆国家', '分裂国家', '煽动分裂', '颠覆国家政权',
  '分裂国家政权', '推翻社会主义', '反革命', '反动', '六四', '天安门事件',
  '学运', '民运分子', '邪教组织', '黑社会性质组织', '恐怖组织', '恐怖分子',
  '极端主义', '极端分子', '暴恐', '制爆', '圣战', '东伊运', '伊斯兰国',
  '基地组织', '达赖', '世维会', '民阵', '大法', '退党', '天安门广场事件',
  '法轮大法', '政治避难', '颜色革命', '和平演变',
].map((word) => ({ word, category: 'politics' as const, level: L4 }))

// ── 宗教类（邪教组织/极端宗教，level 4）──────────────────────
const religion: SeedWord[] = [
  '法轮功', '全能神', '门徒会', '呼喊派', '灵灵教', '观音法门', '主神教',
  '统一教', '三班仆人派', '灵仙真佛宗', '被立王', '血水圣灵', '全范围教会',
  '常受教', '新约教会', '东方闪电', '中华大陆行政执事站', '华南教会',
  '邪教', '异端邪说', '极端宗教', '宗教极端', '伊斯兰圣战', '吉哈德',
  '殉教', '人肉炸弹', '自杀式袭击',
].map((word) => ({ word, category: 'religion' as const, level: L4 }))

// ── 毒品类（毒品名/黑话/涉毒行为，level 4）───────────────────
const drug: SeedWord[] = [
  '海洛因', '白粉', '冰毒', '甲基苯丙胺', '摇头丸', '麻古', 'k粉', 'k仔',
  '氯胺酮', '可卡因', '古柯碱', '吗啡', '鸦片', '大麻', '大麻烟', '大麻油',
  '笑气', '氟胺酮', '丧尸浴盐', '甲卡西酮', '迷幻蘑菇', '麦角酸', 'lsd',
  'ghb', 'y-羟丁酸', '神仙水', '开心水', '冰壶', '麻果', '红冰', '安非他命',
  '苯丙胺', '摇脚丸', '大麻叶', '吸毒', '贩毒', '制毒', '毒品', '毒贩',
  '运毒', '藏毒', '吸毒工具', '注射毒品',
].map((word) => ({ word, category: 'drug' as const, level: L4 }))

// ── 色情类（level 3）────────────────────────────────────────
const porn: SeedWord[] = [
  '性交', '做爱', '口交', '肛交', '乳交', '足交', '手淫', '自慰',
  '嫖娼', '卖淫', '买春', '援交', '一夜情', '约炮', '裸聊', '裸照',
  '裸体', '全裸', '露点', '三级片', '黄片', '黄图', '黄色小说', '色情',
  '情色', '淫秽', '春宫图', '强奸', '迷奸', '轮奸', '猥亵', '恋童',
  '儿童色情', '口爆', '颜射', '内射', '催情药', '春药', '跳蛋', '充气娃娃',
  '飞机杯', '成人影片', 'av女优', 'av资源', '黄播', '色情直播', '直播福利',
  '福利姬', '胸贴', '透视装', '偷拍', '裙底', '成人网站', '黄色网站',
].map((word) => ({ word, category: 'porn' as const, level: L3 }))

// ── 赌博类（level 3）────────────────────────────────────────
const gambling: SeedWord[] = [
  '百家乐', '老虎机', '时时彩', '六合彩', '赌球', '赌马', '外围赌博',
  '网络赌博', '网赌', '私彩', '博彩', '赌场', '赌博', '梭哈', '牌九',
  '诈金花', '炸金花', '澳门赌场', '真人赌场', '真人视讯', '真钱游戏',
  '赌博网站', '博彩网站', '投注站', '洗码', '叠码仔', '赌徒', '烂赌',
  '赌债', '北京赛车', '幸运飞艇', '五分彩', '三公', '赌狗', '赌局',
  '赌资', '赌具', '百家乐代理', '赌场代理', '外围盘', '时时彩平台',
].map((word) => ({ word, category: 'gambling' as const, level: L3 }))

// ── 性器官/粗俗（level 3）───────────────────────────────────
const body: SeedWord[] = [
  '鸡巴', '屌', '龟头', '阴蒂', '阴唇', '阴道', '阴茎', '睾丸', '精液',
  '淫水', '屁眼', '奶子', '阳具', '阴毛', '阴囊', '淫娃', '骚货',
  '婊子', '娼妇', '荡妇', '骚逼', '大奶', '巨乳', '大屌', '阳物',
  '生殖器', '阴部',
].map((word) => ({ word, category: 'body' as const, level: L3 }))

export const SENSITIVE_WORD_SEED: SeedWord[] = [
  ...leaders,
  ...politics,
  ...religion,
  ...drug,
  ...porn,
  ...gambling,
  ...body,
]

export const SENSITIVE_CATEGORIES = [
  { key: 'leader', label: '领导人姓名', level: 4 },
  { key: 'politics', label: '政治', level: 4 },
  { key: 'religion', label: '宗教', level: 4 },
  { key: 'drug', label: '毒品', level: 4 },
  { key: 'porn', label: '色情', level: 3 },
  { key: 'gambling', label: '赌博', level: 3 },
  { key: 'body', label: '性器官', level: 3 },
  { key: 'other', label: '其他', level: 2 },
] as const

/** 表为空时导入内置词库（幂等：按 word 去重） */
export async function seedSensitiveWordsIfEmpty() {
  const count = await prisma.chatSensitiveWord.count()
  if (count > 0) return { seeded: 0, total: count }
  let inserted = 0
  for (const w of SENSITIVE_WORD_SEED) {
    try {
      await prisma.chatSensitiveWord.create({
        data: { word: w.word, category: w.category, level: w.level, isActive: true },
      })
      inserted++
    } catch {
      // 唯一键冲突忽略
    }
  }
  return { seeded: inserted, total: await prisma.chatSensitiveWord.count() }
}
