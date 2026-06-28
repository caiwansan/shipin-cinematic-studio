#!/usr/bin/env python3
"""seed-full-coverage.py — 全量 200 Query Seed Coverage Report

测量 seed-enabled 系统下的 semantic coverage
输出: 全局 + 按领域的 seed hit rate, matchedSeed 分布
"""

import json, re, os, sys
sys.path.insert(0, os.path.dirname(__file__))

QUERIES = [
    # Local 50
    "郑州哪家律师事务所比较好", "杭州西湖区最好吃的杭帮菜馆", "成都春熙路附近的火锅店推荐",
    "上海浦东三甲医院哪家好", "深圳南山区幼儿园排名", "广州天河区好吃的粤菜餐厅",
    "北京海淀区哪个牙科诊所好", "武汉热干面哪家最正宗", "南京新街口有什么好吃的",
    "西安回民街必吃的美食有哪些", "深圳福田区哪个驾校好", "成都比较好的装修公司推荐",
    "长沙臭豆腐哪家最好吃", "青岛海鲜哪里吃比较划算", "苏州园林附近有什么好吃的",
    "昆明比较好吃的过桥米线", "大连海鲜自助餐厅推荐", "厦门鼓浪屿民宿推荐",
    "哈尔滨冰雪大世界门票怎么买", "重庆解放碑附近住宿推荐", "三亚海滩哪个人少",
    "天津狗不理包子值得吃吗", "洛阳龙门石窟附近有啥好吃的", "合肥哪家小龙虾好吃",
    "济南哪家烧烤最好", "福州三坊七巷附近的美食", "沈阳故宫附近有啥好玩的",
    "武汉户部巷有什么好吃的", "南宁哪家肠粉好吃", "贵阳酸汤鱼哪家正宗",
    "兰州拉面哪里好吃", "拉萨高原反应怎么预防", "大理洱海骑行路线",
    "敦煌莫高窟门票预约", "珠海长隆海洋王国攻略", "张家界玻璃桥攻略",
    "桂林阳朔漂流", "厦门曾厝垵住宿推荐", "黄山旅游最佳路线",
    "成都大熊猫基地门票", "上海迪士尼攻略", "北京故宫门票预约",
    "西安大唐不夜城值得去吗", "南京夫子庙附近住宿", "杭州西湖一日游攻略",
    "成都锦里附近民宿", "西安旅游攻略", "重庆旅游攻略三日游",
    "泰国有哪些海滩值得去", "旅游保险有必要买吗",
    # Enterprise 50
    "华为公司最新动态", "字节跳动旗下有哪些产品", "比亚迪新能源汽车销量",
    "宁德时代最新电池技术", "小米集团主营业务构成", "腾讯最新游戏业务",
    "阿里巴巴云计算市场份额", "特斯拉在中国的主要竞争对手", "拼多多跨境电商业务",
    "京东物流最新布局", "中芯国际芯片制程进展", "台积电最新3nm工艺",
    "三星半导体市场份额", "英特尔最新处理器性能", "AMD与NVIDIA显卡对比",
    "美团外卖市场份额", "抖音电商GMV数据", "快手直播电商趋势",
    "小红书电商策略", "B站用户增长数据", "理想汽车交付量",
    "蔚来汽车最新车型", "小鹏汽车自动驾驶技术", "华为鸿蒙系统装机量",
    "苹果iPhone在中国市场份额", "OpenAI最新融资估值", "微软Copilot定价策略",
    "谷歌Gemini大模型进展", "Meta元宇宙业务亏损", "百度文心一言用户数",
    "科大讯飞在教育领域的布局", "商汤科技最新技术突破", "旷视科技IPO进展",
    "大疆无人机最新产品", "海康威视安防市场份额", "药明康德最新财报",
    "迈瑞医疗海外业务", "恒瑞医药创新药研发", "贵州茅台股价走势",
    "中国平安保险业务转型", "招商银行零售业务", "工商银行不良贷款率",
    "建设银行数字人民币", "农业银行乡村振兴", "中国银行跨境业务",
    "中信证券投行业务排名", "华泰证券资管业务", "中国人寿保费收入",
    "中国移动5G用户数", "中国电信云业务收入", "中国联通混改进展",
    # Product 50
    "家用咖啡机哪个牌子好", "扫地机器人买哪个好", "空气炸锅哪个品牌好",
    "机械键盘入门推荐", "婴儿奶粉推荐", "笔记本电脑推荐3000左右",
    "手机拍照哪个好", "蓝牙耳机推荐500以内", "华为Mate60和iPhone15对比",
    "戴森吸尘器值得买吗", "小米空调质量怎么样", "格力空调和美的空调哪个好",
    "海尔冰箱哪款性价比高", "索尼电视和三星电视哪个好", "Switch OLED值得买吗",
    "PS5和Xbox Series X对比", "iPad Air和iPad Pro区别", "MacBook Air M3值得买吗",
    "佳能R50和索尼A6400哪个好", "大疆Air 3值得买吗", "坚果投影仪和极米投影仪对比",
    "漫步者蓝牙音箱推荐", "华为FreeBuds Pro 3评测", "Apple Watch Ultra值得买吗",
    "小米手环和华为手环哪个好", "飞利浦电动牙刷推荐", "戴森吹风机值得买吗",
    "九阳破壁机怎么样", "美的电饭煲哪款好", "苏泊尔炒锅推荐",
    "网易严选人体工学椅", "赫曼米勒和冈村哪个好", "升降桌推荐",
    "明基显示器推荐设计", "戴尔显示器哪个好", "罗技鼠标推荐办公",
    "Cherry机械键盘和雷蛇对比", "西昊电竞椅值得买吗", "小米汽车SU7值得买吗",
    "特斯拉Model 3和Model Y对比", "BYD海豹和汉哪个好", "理想L7和问界M7对比",
    "小鹏G6值得买吗", "蔚来ET5和ET7区别", "五菱宏光Mini值得买吗",
    "Model Y长续航版续航", "比亚迪海豚怎么样", "AITO问界M5和M7区别",
    "极氪001值得买吗", "小牛电动车和九号电动车对比",
    # General 50
    "什么是通货膨胀", "碳中和是什么意思", "个人所得税怎么算",
    "社保断缴有什么影响", "高血压饮食注意事项", "医保报销比例",
    "限购政策最新消息", "怎样学好英语", "存款保险制度",
    "意外险值得买吗", "退休金怎么计算", "公积金贷款额度",
    "什么是元宇宙", "区块链技术原理", "AI人工智能对就业的影响",
    "京东白条和花呗哪个划算", "基金定投怎么选", "股票开户流程",
    "房贷利率下调了吗", "二手房交易流程", "新房和二手房哪个划算",
    "什么是量化交易", "比特币挖矿原理", "NFT数字藏品是什么",
    "Web3.0是什么", "5G和4G有什么区别", "云计算是什么",
    "什么是量子计算", "自动驾驶L1到L5等级", "VR和AR区别",
    "怎么选择信用卡", "个人征信怎么查", "ETC办理流程",
    "etc节假日免费政策", "2024年节假日安排", "离职社保怎么处理",
    "加班费怎么算", "年终奖怎么扣税", "劳务报酬个税",
    "城乡居民医保怎么交", "异地就医报销流程", "交通事故处理流程",
    "租房合同注意事项", "房产证办理流程", "过户费用怎么算",
    "装修贷款怎么申请", "新能源车充电桩安装", "小区停车费收费标准",
    "暖气费怎么算", "物业服务费包含哪些",
]

# 当前 seed 的 queryPatterns（完整版）
NEW_LOCAL = {
    'local_food_recommendation': [
        '好吃的', '推荐餐厅', '必吃美食', '美食推荐', '夜市必吃',
        '好吃', '最正宗', '哪家好吃', '哪里吃', '值得吃',
        '美食攻略', '必吃', '特色美食', '当地美食',
        '好吃的菜', '特色小吃', '地道美食',
        '自助餐', '小龙虾', '烧烤', '臭豆腐', '鱼', '面',
        '菜馆', '餐厅推荐', '美食', '去哪吃', '吃东西',
    ],
    'local_travel_attraction': [
        '攻略', '门票', '旅游景点', '好玩的', '必去', '打卡',
        '最佳路线', '风景', '值得去', '游玩', '景点推荐',
        '旅游攻略', '一日游', '骑行路线', '景点预约', '漂流',
    ],
    'local_travel_accommodation': [
        '酒店', '住宿', '民宿', '住', '哪里住', '住宿推荐',
        '酒店推荐', '房间', '旅馆', '入住',
        '签证', '自由行', '旅游多少钱', '旅游保险',
        '出国', '高原反应', '海滩',
    ],
    'local_service_recommendation': [
        '哪家', '另一个', '怎么去',
        '附近', '排名', '靠谱', '好不好',
        '哪里找', '推荐服务', '推荐一个',
        '找修', '找医生', '找律师', '找师傅',
    ],
}

OLD_PATTERNS = {
    'consumer_electronics': [
        '怎么买', '值得买', '性价比', '参数对比', '哪个好', '买哪个', '值得买',
        'pro', 'max', 'ultra', '芯片', '处理器', '内存', '电池', '续航',
        '手机', '笔记本', '耳机', '手表', '平板', '电脑', '键盘', '鼠标',
        '耳机', '降噪', '音响', '相机', '拍照', '投影仪', '电动', '牙刷',
    ],
    'lifestyle': [
        '书', '阅读', '读', '看', '作者', '小说', '治愈',
        '书籍', '经典', '畅销',
        '电影', '电视剧', '评分', '值得看', '推荐',
        '运动', '健身', '跑步', '减肥',
        '饮食', '吃', '做法', '食谱',
        '旅游', '旅行', '攻略', '地方',
        '音乐', '游戏', '爱好',
        '怎么样', '建议',
    ],
    'business_intel': [
        '公司', '企业', '靠谱吗', '背景', '融资', '上市',
        '估值', '行业', '市场', '产品', '技术', '客户', '营收',
        '利润', '竞争对手', '财报', '业务',
    ],
    'general_knowledge': [
        '天气', '下雨', '温度', '气温', '几度',
        '时间', '日期', '几点了', '什么时候',
        '哪里', '位置', '在哪', '怎么去', '地址',
        '计算', '换算', '多少', '是什么', '意思',
        '怎么办', '怎么处理', '怎么解决',
    ],
    'diet': ['吃', '饮食', '营养', '热量', '卡路里', '食物', '食品'],
}

# 领域标签（用于 domain hint）
DOMAIN_TAGS = {
    'local': ['餐厅', '酒店', '景点', '美食', '旅游', '票', '好吃', '住宿', '民宿', '哪里', '哪家', '附近', '攻略'],
    'consumer_electronics': ['手机', '电脑', '耳机', '相机', '平板', '笔记本', '数码', '电子'],
    'lifestyle': ['书', '电影', '运动', '健身', '吃', '旅游', '音乐', '游戏', '推荐'],
    'business_intel': ['公司', '企业', '融资', '上市', '财报'],
    'general_knowledge': ['天气', '时间', '日期', '是什么', '什么意思', '定义', '原理'],
}

def detect_domain(query):
    q = query.replace(' ', '')
    scores = {}
    for domain, tags in DOMAIN_TAGS.items():
        scores[domain] = sum(1 for t in tags if t in q)
    return max(scores, key=scores.get) if any(s != 0 for s in scores.values()) else 'general'

def match_old(query):
    matched = []
    for domain, patterns in OLD_PATTERNS.items():
        for p in patterns:
            if p in query:
                matched.append(domain)
                break
    return matched

def match_new_local(query):
    matched = []
    for seed_id, patterns in NEW_LOCAL.items():
        for p in patterns:
            if p in query:
                matched.append(seed_id)
                break
    return matched

def get_best_match(query, old_only=False):
    old_matched = match_old(query)
    if old_only:
        return old_matched[:1]  # 只取 top 1 domain
    new_matched = match_new_local(query)
    all_matched = list(set(old_matched + new_matched))
    return all_matched[:1]  # 取 top 1

# 跑全量
print("=" * 70)
print("  Seed Full Coverage Report — 全量 200 Query")
print("=" * 70)

# 按原始域分类
domains = ['local', 'enterprise', 'product', 'general']
by_domain = {d: [] for d in domains}
for q in QUERIES:
    d = detect_domain(q)
    by_domain.setdefault(d, []).append(q)

# 统计
old_hits = {d: 0 for d in domains}
new_hits = {d: 0 for d in domains}
for d in domains:
    for q in by_domain.get(d, []):
        if get_best_match(q, old_only=True):
            old_hits[d] += 1
        if get_best_match(q, old_only=False):
            new_hits[d] += 1

print(f"\n{'领域':<15s} {'总数':<6s} {'旧seed':<10s} {'+新seed':<10s} {'提升':<10s}")
print("-" * 55)

total_old = 0
total_new = 0
total_q = 0
for d in domains:
    qs = by_domain.get(d, [])
    n = len(qs)
    total_q += n
    total_old += old_hits[d]
    total_new += new_hits[d]
    o_pct = old_hits[d] * 100 // n if n else 0
    n_pct = new_hits[d] * 100 // n if n else 0
    delta = n_pct - o_pct
    arrow = "↑" if delta > 5 else ("=" if delta >= 0 else "↓")
    print(f"{d:<15s} {n:<6d} {o_pct:<7d}% {n_pct:<7d}% {delta:+3d}pp {arrow}")

print("-" * 55)
print(f"{'总计':<15s} {total_q:<6d} {total_old*100//total_q:<7d}% {total_new*100//total_q:<7d}% {total_new*100//total_q - total_old*100//total_q:+3d}pp")

# 新 seed 命中详情
print(f"\n{'='*70}")
print("  新 Seed 命中详情")
print(f"{'='*70}")
for seed_id in ['local_food_recommendation', 'local_travel_attraction', 'local_travel_accommodation', 'local_service_recommendation']:
    patterns = NEW_LOCAL[seed_id]
    hits = []
    for q in QUERIES:
        for p in patterns:
            if p in q:
                hits.append(q)
                break
    print(f"  {seed_id:45s}: {len(hits):3d}次")
    for q in hits[:5]:
        print(f"    ✓ {q}")
    if len(hits) > 5:
        print(f"    ... 还有 {len(hits)-5} 条")

# 无覆盖的查询
print(f"\n{'='*70}")
print("  新 seed 未覆盖的查询")
print(f"{'='*70}")
uncovered = [q for q in QUERIES if not get_best_match(q, old_only=False)]
print(f"  总计: {len(uncovered)}/{total_q} = {len(uncovered)*100//total_q}%")

# 按类别分析
for d in domains:
    uc = [q for q in by_domain.get(d, []) if not get_best_match(q, old_only=False)]
    if uc:
        print(f"\n  [{d}] {len(uc)}条未覆盖:")
        for q in uc[:10]:
            print(f"    ✗ {q}")
        if len(uc) > 10:
            print(f"    ... 还有 {len(uc)-10} 条")
