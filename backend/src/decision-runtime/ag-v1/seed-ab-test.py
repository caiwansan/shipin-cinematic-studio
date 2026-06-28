#!/usr/bin/env python3
"""seed-ab-test.py — A/B 对照实验：seed-enabled vs seed-disabled

对比 AG-V1 Benchmark 在两种条件下的 seed hit rate / evidence change

用法:
  python3 seed-ab-test.py

不需要改代码/重启，直接模拟 U-0 match 逻辑。
"""

import json, re, os

# ====== 加载 benchmark 数据集和原始结果 ======
dataset_path = "/root/shipin-cinematic-studio/backend/src/decision-runtime/ag-v1/benchmark-dataset.ts"
results_path = "/tmp/ag-v1-raw-results.json"

raw_results = json.load(open(results_path)) if os.path.exists(results_path) else []

# ====== 提取 benchmark queries（从 TS 文件） ======
def extract_queries(path):
    queries = []
    with open(path) as f:
        content = f.read()
    for m in re.finditer(r"query:\s*'([^']+)'", content):
        queries.append(m.group(1))
    return queries

queries = extract_queries(dataset_path)
print(f"提取 query 数: {len(queries)}")

# ====== 如果 raw results 不足 200 条，先跑一遍 benchmark ======
if len(raw_results) < 200:
    print(f"[WARN] 只有 {len(raw_results)} 条原始结果。benchmark 需要先完成。")
    print("请先跑 python3 bench-run.py")
    # fallback: 用 queries 直接跑
    raw_results = [{"query": q, "matchedSeed": None, "evidenceCount": 0, "coverageGap": True} for q in queries[:200]]

# ====== 定义 seed 集 ======
# Before: 只有旧 seed（前 15 个）
# After: 旧 seed + 新 4 个 local seeds

# 从 raw_results 已有数据提取 domain 标记
def guess_domain(q):
    local_kw = ['餐厅', '美食', '吃', '好吃', '菜馆', '景点', '旅游', '酒店', '住宿',
                '门票', '攻略', '民宿', '小吃', '哪里', '推荐服务', '附近', '哪家']
    enterprise_kw = ['公司', '企业', '集团', '融资', '上市', '财报', 'CEO', '创始人',
                     '业务', '营收', '利润', '产品线', '竞争对手']
    product_kw = ['推荐', '哪个好', '牌子', '品牌', '型号', '对比', 'pro', 'max', '版',
                  '手机', '电脑', '笔记本', '耳机', '相机', '扫地机器人']
    general_kw = ['什么是', '是什么意思', '怎么算', '怎么用', '怎么治疗', '原因',
                  '症状', '有效期', '有效期', '流程', '条件', '政策']

    cleaned = re.sub(r'[^\u4e00-\u9fa5a-zA-Z0-9]', '', q)

    # 算权重
    local_score = sum(1 for k in local_kw if k in cleaned)
    enterprise_score = sum(1 for k in enterprise_kw if k in cleaned)
    product_score = sum(1 for k in product_kw if k in cleaned)
    general_score = sum(1 for k in general_kw if k in cleaned)

    scores = [
        ('local', local_score),
        ('enterprise', enterprise_score),
        ('product', product_score),
        ('general', general_score),
    ]
    best = max(scores, key=lambda x: x[1])
    return best[0] if best[1] > 0 else 'general'

# ====== 旧 seed 的 queryPatterns（前 15 个现有 seed） ======
OLD_PATTERNS = {
    'consumer_electronics': [
        '怎么买', '值得买', '性价比', '参数对比', '哪个好', '买哪个', '推荐 手机',
        '手机 推荐', '笔记本 推荐', '耳机 推荐', '求推荐', '差价', '值不值得',
        'pro', 'max', 'ultra', '芯片', '处理器', '内存', '电池', '续航',
        '屏幕', '相机', '拍照', '操作系统', '安利', '种草',
        '手机', '笔记本', '耳机', '手表', '平板', '电脑', '键盘', '鼠标',
    ],
    'lifestyle': [
        '书', '阅读', '读', '看', '作者', '小说', '治愈', '推荐 书',
        '书籍', '经典', '好读', '文笔', '畅销', '豆瓣',
        '电影', '评分', '值得看', '观影', '电视剧', '剧',
        '运动', '健身', '跑步', '减肥', '饮食', '吃', '做法', '食谱',
        '旅游', '旅行', '攻略', '推荐 地方', '音乐', '游戏', '爱好',
        '推荐', '建议', '怎么样',
    ],
    'business_intel': [
        '公司', '企业', '靠谱吗', '背景', '融资', '上市',
        '估值', '行业', '市场', '产品线', '技术', '客户', '营收',
        '利润', '团队', '竞争对手', '财报', '业务',
    ],
    'general_knowledge': [
        '天气', '下雨', '温度', '气温', '几度',
        '时间', '日期', '几点了',
        '哪里', '位置', '在哪', '怎么去', '地址',
        '计算', '换算', '多少', '是什么', '意思',
        '怎么办', '怎么处理', '怎么解决',
    ],
    'diet': ['吃', '饮食', '营养', '热量', '卡路里', '食物', '食品'],
}

# 展开为统一 pattern 列表
def flatten_patterns(domain_map):
    patterns = []
    for domain, pats in domain_map.items():
        for p in pats:
            patterns.append((domain, p))
    return patterns

OLD_ALL = flatten_patterns(OLD_PATTERNS)

# 新 seed 的 queryPatterns
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
        '哪家', '哪个', '怎么去',
        '附近', '排名', '靠谱', '好不好',
        '哪里找', '推荐服务', '推荐一个',
        '找修', '找医生', '找律师', '找师傅',
    ],
}

def match_any(query, patterns_with_domain):
    """返回匹配的 domain 列表"""
    matched = []
    for domain, pat in patterns_with_domain:
        if pat in query:
            if domain not in matched:
                matched.append(domain)
    return matched

def match_new_local(query):
    """返回匹配的新 seed id 列表"""
    matched = []
    for seed_id, pats in NEW_LOCAL.items():
        for p in pats:
            if p in query:
                matched.append(seed_id)
                break
    return matched

# ====== 运行对比 ======

print("\n" + "="*70)
print("  A/B 对照实验 — Seed-Enabled vs Seed-Disabled")
print("="*70)

# 分组统计
A = {'label': 'Seed-Disabled (仅旧 seed)', 'results': []}
B = {'label': 'Seed-Enabled (旧 seed + 4 new seeds)', 'results': []}

for r in raw_results[:200]:
    q = r.get('query', '')
    ev = r.get('evidenceCount', 0) or 0
    gap = r.get('coverageGap', True)

    # A: 仅旧 seed
    old_matched = match_any(q, OLD_ALL)
    old_domain = guess_domain(q)

    # B: 旧 + 新
    new_matched_seeds = match_new_local(q)
    all_matched = list(set(old_matched) | set(new_matched_seeds))

    # 实际检测：新 seed 是否改进了域向量？
    old_local_hit = 'local' in old_matched
    new_local_hit = bool(new_matched_seeds)
    old_local_hit_any = any('local' in d for d in old_matched)

    A['results'].append({
        'query': q,
        'matched': old_matched,
        'domain': old_domain,
        'local_hit': old_local_hit or old_local_hit_any,
        'ev': ev,
        'gap': gap,
        'new_seeds_hit': [],
    })
    B['results'].append({
        'query': q,
        'matched': all_matched,
        'domain': old_domain,
        'local_hit': new_local_hit or old_local_hit or old_local_hit_any,
        'ev': ev,
        'gap': gap,
        'new_seeds_hit': new_matched_seeds,
    })


# ====== 报告 ======

def report(label, results):
    total = len(results)
    seed_hit = sum(1 for r in results if r['matched'])
    no_seed = total - seed_hit
    local_hit = sum(1 for r in results if r['local_hit'])
    avg_ev = sum(r['ev'] for r in results) / total if total else 0
    gap_count = sum(1 for r in results if r['gap'])
    local_group = [r for r in results if r['domain'] == 'local']
    enterprise_group = [r for r in results if r['domain'] == 'enterprise']
    product_group = [r for r in results if r['domain'] == 'product']
    general_group = [r for r in results if r['domain'] == 'general']

    new_seeds_used = sum(1 for r in results if r.get('new_seeds_hit', []))
    new_seed_details = {}
    for r in results:
        for s in r.get('new_seeds_hit', []):
            new_seed_details[s] = new_seed_details.get(s, 0) + 1

    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    print(f"  总查询:                   {total}")
    print(f"  Seed 命中率:              {seed_hit}/{total} = {seed_hit*100//total}%")
    print(f"  未命中 seed:              {no_seed}")
    print(f"  Local 域命中:             {local_hit}/{total} = {local_hit*100//total}%")
    print(f"  平均 evidence:            {avg_ev:.2f}")
    print(f"  Gap queries:              {gap_count}/{total} = {gap_count*100//total}%", " 🔴" if gap_count > 100 else "")

    if new_seeds_used:
        print(f"  新 seed 激活:              {new_seeds_used}")
        print(f"  新 seed 详情:")
        for sid, cnt in sorted(new_seed_details.items(), key=lambda x: -x[1]):
            print(f"    {sid:45s}: {cnt:3d}次")

    print(f"\n  按领域:")
    for name, grp in [('local', local_group), ('enterprise', enterprise_group),
                      ('product', product_group), ('general', general_group)]:
        if grp:
            g_ev = sum(r['ev'] for r in grp) / len(grp)
            g_gap = sum(1 for r in grp if r['gap'])
            g_hit = sum(1 for r in grp if r['matched'])
            g_local_hit = sum(1 for r in grp if r['local_hit'])
            print(f"    {name:15s}: {len(grp):3d}个 | seed命中 {g_hit*100//len(grp):2d}% | local域 {g_local_hit*100//len(grp):2d}% | avgEv {g_ev:.2f} | gap {g_gap*100//len(grp):2d}%")

    return {
        'seed_hit_rate': seed_hit / total,
        'local_hit_rate': local_hit / total,
        'avg_ev': avg_ev,
        'gap_rate': gap_count / total,
    }

A_stats = report(A['label'], A['results'])
B_stats = report(B['label'], B['results'])

# ====== 对比总结 ======
print("\n" + "="*70)
print("  🆚 对比总结")
print("="*70)

def delta(val, baseline):
    if baseline == 0:
        return f"+{val*100:.1f}pp" if val else "0"
    return f"{(val-baseline)*100:+.1f}pp" if abs(val-baseline) > 0.001 else "0"

print(f"{'指标':<25s} {'Seed-Disabled':<18s} {'Seed-Enabled':<18s} {'变化':<15s}")
print(f"{'-'*25} {'-'*18} {'-'*18} {'-'*15}")
print(f"{'Seed 命中率':<25s} {A_stats['seed_hit_rate']*100:>8.1f}%{'':>8s} {B_stats['seed_hit_rate']*100:>8.1f}%{'':>8s} {delta(A_stats['seed_hit_rate'], A_stats['seed_hit_rate']):<10s} B→A")
print(f"{'Local 域命中':<25s} {A_stats['local_hit_rate']*100:>8.1f}%{'':>8s} {B_stats['local_hit_rate']*100:>8.1f}%{'':>8s} {delta(B_stats['local_hit_rate'], A_stats['local_hit_rate']):<10s}")
print(f"{'平均 Evidence':<25s} {A_stats['avg_ev']:>11.2f}{'':>5s} {B_stats['avg_ev']:>11.2f}{'':>5s} {('+' if B_stats['avg_ev']>A_stats['avg_ev'] else '')+(B_stats['avg_ev']-A_stats['avg_ev']):>7.2f}")
print(f"{'Gap 率':<25s} {A_stats['gap_rate']*100:>8.1f}%{'':>8s} {B_stats['gap_rate']*100:>8.1f}%{'':>8s} {delta(A_stats['gap_rate'], B_stats['gap_rate']):<10s}")

# Simulated Gap
# 用 gap 作为 agent pipeline 独立输出（新 seed 不影响它），所以 gap 不变
# 但 seed hit 和 local hit 的变化是真实收益

print(f"\n  结论：")
seed_hit_uplift = (B_stats['seed_hit_rate'] - A_stats['seed_hit_rate']) * 100
local_hit_uplift = (B_stats['local_hit_rate'] - A_stats['local_hit_rate']) * 100
print(f"  • Seed 命中率 {'↑' if seed_hit_uplift > 0 else '↓'} {seed_hit_uplift:.1f}pp" if abs(seed_hit_uplift) > 1 else f"  • Seed 命中率 ~0 (新 seed 是 local 专用，不影响整体 hit)")
print(f"  • Local 域命中 {'↑' if local_hit_uplift > 0 else '↓'} {local_hit_uplift:.1f}pp" if abs(local_hit_uplift) > 1 else f"  • Local 域命中 ~0")
uplift_threshold = 15
if local_hit_uplift >= uplift_threshold:
    print(f"  • ✅ LOCAL_SEED_V1 有效 — 确认进入 P1 准备阶段")
else:
    print(f"  • ⚠️ LOCAL_SEED_V1 效果有限 — 需要检查 queryPatterns 覆盖面")

import os
print(f"\n  Raw data: {results_path}")
