import { Industry, Scenario } from './types';

/**
 * Seed data for Scenario Library
 * 5 industries × 5 scenarios, each with at least 1 intent (3+ expressions, 2+ questions)
 */

export const seedIndustries: Industry[] = [
  { id: 'brand', name: 'brand', displayName: '品牌' },
  { id: 'product', name: 'product', displayName: '产品' },
  { id: 'hotel', name: 'hotel', displayName: '酒店/旅游' },
  { id: 'ecommerce', name: 'ecommerce', displayName: '电商店铺' },
  { id: 'restaurant', name: 'restaurant', displayName: '餐饮' },
];

export const seedScenarios: Scenario[] = [
  // ── Industry 1: brand ──────────────────────────────────────────
  {
    id: 'brand-discovery',
    industryId: 'brand',
    name: '品牌发现',
    description: '用户想了解或发现一个新品牌的背景、理念和故事',
    intents: [
      {
        id: 'brand-discovery-know',
        name: '品牌基本信息',
        description: '用户想了解品牌的基本信息',
        naturalExpressions: [
          '我想了解一下这个品牌的背景故事',
          '这个品牌是怎么创立的？',
          '跟我说说这个品牌的创始人和历史吧',
        ],
        representativeQuestions: [
          '这个品牌是哪一年成立的？创始人是谁？',
          '品牌的核心价值观是什么？',
        ],
      },
    ],
  },
  {
    id: 'brand-comparison',
    industryId: 'brand',
    name: '品牌对比',
    description: '用户想比较不同品牌之间的差异',
    intents: [
      {
        id: 'brand-comparison-diff',
        name: '品牌差异对比',
        description: '用户想比较两个或多个品牌的不同之处',
        naturalExpressions: [
          'A品牌和B品牌有什么区别？',
          '帮我对比一下这几个品牌的不同之处',
          '哪个品牌更好？我想知道它们的优缺点',
        ],
        representativeQuestions: [
          'Nike 和 Adidas 在产品定位上有什么不同？',
          '从性价比来看，小米和华为哪个更值得选？',
        ],
      },
    ],
  },
  {
    id: 'brand-trust',
    industryId: 'brand',
    name: '品牌信任评估',
    description: '用户想评估一个品牌是否值得信赖',
    intents: [
      {
        id: 'brand-trust-eval',
        name: '品牌可信度',
        description: '用户想判断品牌是否可靠',
        naturalExpressions: [
          '这个品牌靠谱吗？有没有什么负面新闻？',
          '这个牌子信誉怎么样？值得信赖吗？',
          '我想确认一下这个品牌的口碑好不好',
        ],
        representativeQuestions: [
          '这个品牌有没有被曝出过质量安全问题？',
          '用户的评价总体来说是正面的还是负面的？',
        ],
      },
    ],
  },
  {
    id: 'brand-history',
    industryId: 'brand',
    name: '品牌历史',
    description: '用户想深入了解一个品牌的发展历程',
    intents: [
      {
        id: 'brand-history-timeline',
        name: '发展历程',
        description: '用户想了解品牌的发展里程碑',
        naturalExpressions: [
          '这个品牌是怎么一步步走到今天的？',
          '能讲讲品牌的发展历程吗？',
          '品牌的重大里程碑事件有哪些？',
        ],
        representativeQuestions: [
          '可口可乐在历史上经历过哪些重要的转型？',
          '这个品牌从创立到现在经历了几个关键阶段？',
        ],
      },
    ],
  },
  {
    id: 'brand-positioning',
    industryId: 'brand',
    name: '品牌定位',
    description: '用户想了解品牌在市场中的定位和目标人群',
    intents: [
      {
        id: 'brand-positioning-market',
        name: '市场定位',
        description: '用户想了解品牌的市场定位',
        naturalExpressions: [
          '这个品牌的目标人群是哪些？',
          '它定位在高端还是大众市场？',
          '这个品牌和竞品相比有什么独特的卖点？',
        ],
        representativeQuestions: [
          '特斯拉的品牌定位和传统车企有什么不同？',
          '这个品牌主打的是性价比还是高端体验？',
        ],
      },
    ],
  },

  // ── Industry 2: product ────────────────────────────────────────
  {
    id: 'product-research',
    industryId: 'product',
    name: '产品调研',
    description: '用户想对一个产品做全面的了解和研究',
    intents: [
      {
        id: 'product-research-specs',
        name: '产品规格',
        description: '用户想了解产品的详细规格参数',
        naturalExpressions: [
          '这个产品的详细参数是什么？',
          '我想全面了解一下这款产品的功能',
          '能不能帮我查一下这个产品的配置信息？',
        ],
        representativeQuestions: [
          'iPhone 16 Pro 的屏幕尺寸和处理器型号是什么？',
          '这款产品的电池续航能力怎么样？',
        ],
      },
    ],
  },
  {
    id: 'product-comparison',
    industryId: 'product',
    name: '产品对比',
    description: '用户想比较不同产品之间的差异以做出选择',
    intents: [
      {
        id: 'product-comparison-features',
        name: '功能对比',
        description: '用户想比较不同产品的功能差异',
        naturalExpressions: [
          '这两个产品哪个功能更强？',
          '帮我对比一下这几款产品的优缺点',
          'A产品和B产品在性能上有什么差别？',
        ],
        representativeQuestions: [
          'iPhone 和 Android 旗舰机在拍照方面哪个更好？',
          '这款笔记本电脑和同价位的竞品相比有哪些优势？',
        ],
      },
    ],
  },
  {
    id: 'product-purchase',
    industryId: 'product',
    name: '购买决策',
    description: '用户在做购买决策前需要更多信息',
    intents: [
      {
        id: 'product-purchase-value',
        name: '购买价值',
        description: '用户想判断产品是否值得购买',
        naturalExpressions: [
          '这个产品值得买吗？',
          '现在买这款产品划算吗？',
          '用户的评价怎么样？推荐购买吗？',
        ],
        representativeQuestions: [
          '这款产品的性价比如何？相比同价位产品值得入手吗？',
          '有没有什么常见的质量问题或者缺陷？',
        ],
      },
    ],
  },
  {
    id: 'product-safety',
    industryId: 'product',
    name: '产品安全性',
    description: '用户关注产品的安全性问题',
    intents: [
      {
        id: 'product-safety-cert',
        name: '安全认证',
        description: '用户想了解产品的安全认证和检测情况',
        naturalExpressions: [
          '这个产品安全吗？有没有什么安全隐患？',
          '有没有通过什么安全认证？',
          '这个产品在使用过程中需要注意什么？',
        ],
        representativeQuestions: [
          '这款儿童玩具的材质是否安全无毒？有没有相关认证？',
          '这款电器产品有没有过安全问题召回记录？',
        ],
      },
    ],
  },
  {
    id: 'product-alternative',
    industryId: 'product',
    name: '寻找替代品',
    description: '用户想寻找某个产品的替代方案',
    intents: [
      {
        id: 'product-alternative-find',
        name: '替代方案',
        description: '用户想找功能或定位相似的替代产品',
        naturalExpressions: [
          '有没有和这个产品类似的替代品？',
          '如果不买这个，还有什么其他选择？',
          '推荐一些功能差不多的其他产品吧',
        ],
        representativeQuestions: [
          '除了 AirPods，还有哪些好用的真无线耳机推荐？',
          '有没有价格更实惠但功能差不多的替代品？',
        ],
      },
    ],
  },

  // ── Industry 3: hotel ──────────────────────────────────────────
  {
    id: 'hotel-booking',
    industryId: 'hotel',
    name: '酒店预订决策',
    description: '用户在预订酒店前想了解住宿信息',
    intents: [
      {
        id: 'hotel-booking-info',
        name: '预订信息',
        description: '用户想了解酒店的基本预订信息',
        naturalExpressions: [
          '这家酒店的价格和房型怎么样？',
          '我想订个房间，帮我看看有什么选择？',
          '这家酒店现在有优惠活动吗？',
        ],
        representativeQuestions: [
          '这家酒店的标准间和套房价格分别是多少？',
          '取消订单的政策是什么？可以免费取消吗？',
        ],
      },
    ],
  },
  {
    id: 'hotel-location',
    industryId: 'hotel',
    name: '位置评价',
    description: '用户关心酒店的地理位置和周边环境',
    intents: [
      {
        id: 'hotel-location-access',
        name: '位置交通',
        description: '用户想知道酒店的地理位置是否便利',
        naturalExpressions: [
          '这家酒店的位置方便吗？离市中心远不远？',
          '附近有什么交通站点？出门方便吗？',
          '从机场到酒店怎么走最方便？',
        ],
        representativeQuestions: [
          '这家酒店距离最近的地铁站有多远？步行需要多久？',
          '酒店周边有哪些景点或者商业区？',
        ],
      },
    ],
  },
  {
    id: 'hotel-experience',
    industryId: 'hotel',
    name: '住客体验',
    description: '用户想了解其他住客的真实入住体验',
    intents: [
      {
        id: 'hotel-experience-review',
        name: '入住评价',
        description: '用户想参考其他人的评价',
        naturalExpressions: [
          '住过的人评价怎么样？',
          '这家酒店的服务和卫生情况好吗？',
          '大家说这家酒店怎么样？有什么优缺点？',
        ],
        representativeQuestions: [
          '住客普遍反映这家酒店的早餐怎么样？',
          '这家酒店的床品和隔音效果好不好？',
        ],
      },
    ],
  },
  {
    id: 'hotel-value',
    industryId: 'hotel',
    name: '性价比评估',
    description: '用户想评估酒店的性价比',
    intents: [
      {
        id: 'hotel-value-price',
        name: '价格价值比',
        description: '用户判断价格是否合理',
        naturalExpressions: [
          '这家酒店性价比怎么样？值这个价吗？',
          '和同价位的其他酒店相比怎么样？',
          '这个价格住这家划算吗？',
        ],
        representativeQuestions: [
          '这家酒店和附近同星级的酒店相比性价比如何？',
          '它的设施和服务对得起这个价格吗？',
        ],
      },
    ],
  },
  {
    id: 'hotel-suitability',
    industryId: 'hotel',
    name: '适合特定人群',
    description: '用户想确认酒店是否适合自己这类人群',
    intents: [
      {
        id: 'hotel-suitability-group',
        name: '人群适配',
        description: '用户判断酒店是否适合自己的出行需求',
        naturalExpressions: [
          '这家酒店适合带小孩去住吗？',
          '情侣去住这家酒店合适吗？',
          '商务出差住这里方便吗？',
        ],
        representativeQuestions: [
          '这家酒店有没有亲子设施？适合家庭出游吗？',
          '酒店有没有商务中心和会议室？适合商务旅客吗？',
        ],
      },
    ],
  },

  // ── Industry 4: ecommerce ──────────────────────────────────────
  {
    id: 'shop-trust',
    industryId: 'ecommerce',
    name: '店铺可信度评估',
    description: '用户想判断一家电商店铺是否可信',
    intents: [
      {
        id: 'shop-trust-reliable',
        name: '店铺可信度',
        description: '用户想确认店铺是否靠谱',
        naturalExpressions: [
          '这家店铺靠谱吗？会不会是假的？',
          '这家店的信誉怎么样？有人买过吗？',
          '怎么判断这家店是不是骗人的？',
        ],
        representativeQuestions: [
          '这家店的评分和开店时长是多少？粉丝多不多？',
          '有没有用户反映这家店卖假货或者发货慢？',
        ],
      },
    ],
  },
  {
    id: 'shop-quality',
    industryId: 'ecommerce',
    name: '商品质量评估',
    description: '用户关心店铺出售的商品质量',
    intents: [
      {
        id: 'shop-quality-goods',
        name: '商品品质',
        description: '用户想了解商品的质量情况',
        naturalExpressions: [
          '这家店的东西质量好吗？',
          '买过的人说质量怎么样？',
          '这家店的商品跟描述一致吗？',
        ],
        representativeQuestions: [
          '这家店的退货率高不高？次品多吗？',
          '用户普遍反映商品质量如何？实物和图片差距大吗？',
        ],
      },
    ],
  },
  {
    id: 'shop-service',
    industryId: 'ecommerce',
    name: '售后服务评估',
    description: '用户关心店铺的客服和售后服务质量',
    intents: [
      {
        id: 'shop-service-after',
        name: '售后服务',
        description: '用户想了解售后政策和客服质量',
        naturalExpressions: [
          '这家店的售后服务怎么样？',
          '客服态度好吗？处理问题快不快？',
          '退换货方便吗？流程复杂不？',
        ],
        representativeQuestions: [
          '这家店的退换货政策是什么？多久能退款到账？',
          '客服的响应速度和解决问题的态度怎么样？',
        ],
      },
    ],
  },
  {
    id: 'shop-reputation',
    industryId: 'ecommerce',
    name: '店铺口碑',
    description: '用户想了解店铺的整体口碑和用户评价',
    intents: [
      {
        id: 'shop-reputation-overall',
        name: '整体口碑',
        description: '用户想了解大家对这家店的总体评价',
        naturalExpressions: [
          '这家店的口碑怎么样？大家怎么说？',
          '看看这家店的评价吧，好评多还是差评多？',
          '这家店在行业里的声誉如何？',
        ],
        representativeQuestions: [
          '这家店的好评率大概是多少？主要差评集中在哪些方面？',
          '有没有哪个自媒体或者大V推荐过这家店？',
        ],
      },
    ],
  },
  {
    id: 'shop-recommendation',
    industryId: 'ecommerce',
    name: '店铺推荐',
    description: '用户希望获得靠谱的店铺推荐',
    intents: [
      {
        id: 'shop-recommendation-find',
        name: '推荐好店',
        description: '用户想找到值得信赖的店铺',
        naturalExpressions: [
          '推荐几个靠谱的店铺吧？',
          '哪家店买这个比较放心？',
          '有没有口碑特别好的店铺推荐？',
        ],
        representativeQuestions: [
          '买电子产品你推荐哪家店？性价比高的？',
          '哪家母婴用品店比较靠谱？正品保障好的？',
        ],
      },
    ],
  },

  // ── Industry 5: restaurant ─────────────────────────────────────
  {
    id: 'restaurant-recommendation',
    industryId: 'restaurant',
    name: '餐厅推荐',
    description: '用户想获得餐厅推荐',
    intents: [
      {
        id: 'restaurant-recommendation-suggest',
        name: '推荐餐厅',
        description: '用户希望根据需求获得餐厅推荐',
        naturalExpressions: [
          '这附近有什么好吃的餐厅推荐吗？',
          '推荐一家口味不错的餐厅吧',
          '有没有适合约会去的餐厅？',
        ],
        representativeQuestions: [
          '这附近评分最高的餐厅是哪家？人均多少钱？',
          '推荐一家适合家庭聚餐的餐厅，有什么好选择？',
        ],
      },
    ],
  },
  {
    id: 'restaurant-cuisine',
    industryId: 'restaurant',
    name: '菜系口味',
    description: '用户想了解餐厅的菜系和口味特点',
    intents: [
      {
        id: 'restaurant-cuisine-type',
        name: '菜系特色',
        description: '用户了解餐厅做什么菜、口味如何',
        naturalExpressions: [
          '这家餐厅主打什么菜系？',
          '他们家的招牌菜是什么？好吃吗？',
          '口味偏辣还是不辣？适合我的口味吗？',
        ],
        representativeQuestions: [
          '这家餐厅是正宗川菜吗？辣度可以选择吗？',
          '有没有素食或者清真餐的选择？',
        ],
      },
    ],
  },
  {
    id: 'restaurant-ambiance',
    industryId: 'restaurant',
    name: '环境氛围',
    description: '用户关注餐厅的就餐环境和氛围',
    intents: [
      {
        id: 'restaurant-ambiance-decor',
        name: '餐厅环境',
        description: '用户想了解餐厅的装修和氛围',
        naturalExpressions: [
          '这家餐厅的环境怎么样？适合拍照吗？',
          '餐厅的氛围好不好？安静吗？',
          '有没有包间？适合商务宴请吗？',
        ],
        representativeQuestions: [
          '这家餐厅的装修风格是什么样的？灯光和音乐氛围如何？',
          '餐厅人多的时候会不会很吵？座位间距大吗？',
        ],
      },
    ],
  },
  {
    id: 'restaurant-value',
    industryId: 'restaurant',
    name: '性价比',
    description: '用户想评估餐厅的性价比',
    intents: [
      {
        id: 'restaurant-value-price',
        name: '价格评价',
        description: '用户想知道价格是否合理',
        naturalExpressions: [
          '这家餐厅贵不贵？人均大概多少？',
          '菜量怎么样？性价比高吗？',
          '这个价格对得起它的环境和服务吗？',
        ],
        representativeQuestions: [
          '这家餐厅人均消费大概在什么范围？性价比如何？',
          '它和同档次的餐厅相比价格合理吗？',
        ],
      },
    ],
  },
  {
    id: 'restaurant-suitable',
    industryId: 'restaurant',
    name: '适合特定场合',
    description: '用户想确认餐厅是否适合特定场合',
    intents: [
      {
        id: 'restaurant-suitable-occasion',
        name: '场合适配',
        description: '用户判断餐厅是否适合特定的用餐场景',
        naturalExpressions: [
          '这家餐厅适合过生日吗？',
          '适合带客户去吃饭吗？档次够不够？',
          '带爸妈去这家餐厅合适吗？',
        ],
        representativeQuestions: [
          '这家餐厅有适合庆祝生日的套餐或者服务吗？',
          '商务宴请去这家餐厅得体吗？有没有私密包间？',
        ],
      },
    ],
  },
];
