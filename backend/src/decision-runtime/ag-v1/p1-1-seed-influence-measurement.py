#!/usr/bin/env python3
"""
P1.1 — Seed Influence Measurement
不是跑"系统好不好"，而是跑"seed 是否改变了系统行为"

3 个核心指标：
1. Seed → Query Influence Rate  — seed 是否 match 到（semantic影响）
2. Search Input Divergence      — seed match 时的 search query vs no-seed 的差异
3. Evidence Density Change      — Ev 是否因 seed 而变（不是绝对值）

用法:
  python3 p1-1-seed-influence-measurement.py
"""

import json
import sys
import time
import urllib.request
import urllib.error

GATEWAY_URL = "http://127.0.0.1:4002/api/p0/gateway"

# Benchmark queries（enterprise + general 域）
ENTERPRISE_QUERIES = [
    "华为公司最新动态",
    "阿里巴巴2025年财报",
    "腾讯现在有哪些核心业务",
    "字节跳动旗下有哪些产品",
    "比亚迪新能源汽车销量",
    "宁德时代最新电池技术",
    "小米集团主营业务构成",
    "特斯拉上海工厂产能",
    "美团公司最新财报分析",
    "拼多多用户增长情况",
    "京东物流覆盖范围",
    "百度AI业务最新进展",
    "网易游戏2025年新游",
    "快手电商业务规模",
    "滴滴出行恢复情况",
    "大疆无人机新品发布",
    "小红书商业化进展",
    "B站用户活跃数据",
    "蚂蚁集团上市最新消息",
    "中兴通讯5G业务",
    "联想集团全球化布局",
    "格力电器营收情况",
    "美的集团智能家居战略",
    "海尔智家海外市场",
    "中国平安保险业务",
    "招商银行数字化转型",
    "工商银行最新理财产品",
    "中芯国际芯片制造进展",
    "隆基绿能光伏技术",
    "药明康德CXO业务",
    "OPPO手机海外市场",
    "VIVO影像技术进展",
    "荣耀手机市场份额",
    "理想汽车交付数据",
    "蔚来汽车换电站布局",
    "小鹏汽车自动驾驶技术",
    "科大讯飞AI大模型",
    "海康威视安防业务",
    "牧原股份养殖规模",
    "万华化学主营业务",
    "福耀玻璃全球份额",
    "中国中免免税业务",
    "石头科技扫地机器人新品",
    "安踏体育品牌矩阵",
    "李宁公司年轻化战略",
    "农夫山泉水源分布",
    "海底捞海外业务",
    "茅台酒市场价格",
    "瑞幸咖啡门店数量",
    "OpenAI公司最新融资",
]

GENERAL_QUERIES = [
    "碳中和是什么意思",
    "区块链技术原理",
    "量子计算机原理",
    "什么是通货膨胀",
    "马斯克是谁",
    "怎样学好英语",
    "什么是GPT",
    "EDG电子竞技俱乐部",
    "比特币最新价格",
    "房贷利率最新政策",
    "个人所得税怎么算",
    "社保断缴有什么影响",
    "公积金怎么提取",
    "高血压饮食注意事项",
    "糖尿病早期症状",
    "怎样减肥最有效",
    "大学生就业前景分析",
    "考研需要准备什么",
    "公务员考试科目",
    "教师资格证报考条件",
    "房屋装修流程",
    "怎么选股票",
    "基金定投怎么操作",
    "什么是ChatGPT",
    "Python和Java哪个好",
    "前端开发学习路线",
    "人工智能就业方向",
    "新能源汽车有什么优缺点",
    "iPhone和安卓哪个好",
    "怎样提高写作能力",
    "时间管理方法",
    "怎样学好编程",
    "中国GDP最新数据",
    "全球变暖原因",
    "什么是元宇宙",
    "跨境电商怎么做",
    "自媒体怎么起步",
    "短视频怎么赚钱",
    "直播带货需要什么条件",
    "怎样拍好照片",
    "怎样做好PPT",
    "Excel常用技巧",
    "怎样学好数学",
    "什么是5G技术",
    "电动车充电注意事项",
    "什么是云计算",
    "大数据技术应用",
    "怎样培养好习惯",
    "网络安全基础知识",
    "什么是NFT",
]

def call_gateway(query):
    """Call the gateway and return parsed response."""
    body = json.dumps({"query": query}).encode('utf-8')
    req = urllib.request.Request(GATEWAY_URL, data=body,
                                 headers={"Content-Type": "application/json"},
                                 method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        return {"error": str(e)}


def measure_seed_influence(queries, domain_label):
    """
    测量 seed influence 的 3 个指标:
    1. Seed Hit Rate — semantic layer 是否命中
    2. Seed Influence Rate — seed 是否改变了 search query 内容（通过 seedQueryPrefix 判断）
    3. Evidence Count 分布

    因为无 template 的 seed 在 search.agent.ts 中 fallback 到 domain keywords，
    所以 "search query divergence" 不能基于 template 是否存在判断。
    我们记录： matchedSeed != None → seed hit; seed 所属 domain 是否为预期 domain
    """
    results = []
    stats = {
        "total": len(queries),
        "seed_hit": 0,         # matchedSeed is not None and not "None"
        "seed_miss": 0,
        "ev_sum": 0,
        "ev_by_seed": 0,       # avg ev when seed hit
        "ev_by_miss": 0,       # avg ev when seed miss
        "ev_by_seed_sum": 0,
        "ev_by_miss_sum": 0,
        "ev_by_seed_count": 0,
        "ev_by_miss_count": 0,
        "match_levels": {"strong": 0, "acceptable": 0, "weak": 0, "none": 0},
        "seed_hit_scores": [],
        "seed_miss_queries": [],
    }

    for i, q in enumerate(queries):
        resp = call_gateway(q)
        if "error" in resp:
            print(f"[{i+1}/{len(queries)}] ERROR {q[:20]}: {resp['error']}")
            continue

        matched_seed = resp.get("matchedSeed")
        score = resp.get("matchScore", 0)
        level = resp.get("matchLevel", "none")
        ev = resp.get("_pipeline", {}).get("evidenceCount", 0)
        search_queries = resp.get("_pipeline", {}).get("searchQueries", 0)

        is_hit = matched_seed is not None and str(matched_seed) != "None" and score > 0

        record = {
            "query": q,
            "matchedSeed": matched_seed,
            "score": score,
            "level": level,
            "ev": ev,
            "searchQueries": search_queries,
            "isHit": is_hit,
        }
        results.append(record)

        if is_hit:
            stats["seed_hit"] += 1
            stats["ev_by_seed_sum"] += ev
            stats["ev_by_seed_count"] += 1
            stats["seed_hit_scores"].append(score)
        else:
            stats["seed_miss"] += 1
            stats["ev_by_miss_sum"] += ev
            stats["ev_by_miss_count"] += 1
            stats["seed_miss_queries"].append(q)

        stats["ev_sum"] += ev

        level_key = level if level in stats["match_levels"] else "none"
        stats["match_levels"][level_key] += 1

        if (i + 1) % 10 == 0:
            print(f"[{domain_label}] {i+1}/{len(queries)} — seed_hit={stats['seed_hit']}, avgEv={stats['ev_sum']/(i+1):.2f}")

    # 计算指标
    total = len(queries)
    stats["seed_hit_rate"] = stats["seed_hit"] / total if total > 0 else 0
    stats["avg_ev"] = stats["ev_sum"] / total if total > 0 else 0
    stats["avg_ev_seed_hit"] = stats["ev_by_seed_sum"] / stats["ev_by_seed_count"] if stats["ev_by_seed_count"] > 0 else 0
    stats["avg_ev_seed_miss"] = stats["ev_by_miss_sum"] / stats["ev_by_miss_count"] if stats["ev_by_miss_count"] > 0 else 0

    return results, stats


def main():
    print("=" * 60)
    print("P1.1 — Seed Influence Measurement")
    print("=" * 60)
    print()

    # 1. Enterprise domain
    print(">>> Enterprise Domain")
    print(f"Total queries: {len(ENTERPRISE_QUERIES)}")
    print("-" * 40)
    e_results, e_stats = measure_seed_influence(ENTERPRISE_QUERIES, "ENTERPRISE")

    print()
    print(">>> General Domain")
    print(f"Total queries: {len(GENERAL_QUERIES)}")
    print("-" * 40)
    g_results, g_stats = measure_seed_influence(GENERAL_QUERIES, "GENERAL")

    # 报告
    print()
    print("=" * 60)
    print("P1.1 SEED INFLUENCE REPORT")
    print("=" * 60)
    print()

    for label, stats, results in [("ENTERPRISE", e_stats, e_results), ("GENERAL", g_stats, g_results)]:
        print(f"--- {label} ---")
        print(f"  总查询:          {stats['total']}")
        print(f"  Seed Hit:        {stats['seed_hit']} ({stats['seed_hit_rate']*100:.1f}%)")
        print(f"  Seed Miss:       {stats['seed_miss']}")
        print(f"  平均 Ev (全部):  {stats['avg_ev']:.2f}")
        print(f"  平均 Ev (Hit):   {stats['avg_ev_seed_hit']:.2f}")
        print(f"  平均 Ev (Miss):  {stats['avg_ev_seed_miss']:.2f}")
        print(f"  Match Levels:")
        for k, v in stats["match_levels"].items():
            pct = v / stats["total"] * 100
            print(f"    {k}: {v} ({pct:.1f}%)")
        print(f"  平均 Score (Hit): {sum(stats['seed_hit_scores'])/len(stats['seed_hit_scores']):.3f}" if stats['seed_hit_scores'] else "  平均 Score (Hit): N/A")

        # Seed influence: 看哪些 query 的 matched seed 属于新 P1 seeds
        p1_seed_hits = sum(1 for r in results if r["isHit"] and r["matchedSeed"] in
                          ["enterprise-company", "enterprise-product",
                           "general-concept", "general-skill", "general-fact",
                           "general-policy", "general-health"])
        p1_total = sum(1 for r in results if r["isHit"])
        print(f"  P1 Seed Hit:     {p1_seed_hits}/{p1_total} (of total hits)")
        print(f"  P1 Influence Rate: {p1_seed_hits/stats['total']*100:.1f}%")

        # 展示 5 个具体的命中与未匹配
        print(f"  --- Sample Hits (first 5) ---")
        shown = 0
        for r in results:
            if r["isHit"] and shown < 5:
                print(f"    \"{r['query'][:20]}...\" → {r['matchedSeed']} (sc={r['score']:.3f}, ev={r['ev']})")
                shown += 1

        print(f"  --- Sample Misses (first 5) ---")
        shown = 0
        for r in results:
            if not r["isHit"] and shown < 5:
                print(f"    \"{r['query'][:20]}...\" → {r['level']} (sc={r['score']:.3f}, ev={r['ev']})")
                shown += 1

        print()

    # 全局指标
    total_all = e_stats["total"] + g_stats["total"]
    total_hit = e_stats["seed_hit"] + g_stats["seed_hit"]
    print(f"--- GLOBAL ---")
    print(f"  总查询: {total_all}")
    print(f"  总 Seed Hit: {total_hit} ({total_hit/total_all*100:.1f}%)")
    print(f"  总 Ev 平均: {(e_stats['ev_sum']+g_stats['ev_sum'])/total_all:.2f}")

    # P1 seed influence rate（关键指标）
    all_results = e_results + g_results
    p1_seeds = {"enterprise-company", "enterprise-product",
                "general-concept", "general-skill", "general-fact",
                "general-policy", "general-health"}
    p1_influenced = sum(1 for r in all_results
                       if r["isHit"] and r["matchedSeed"] in p1_seeds)
    old_seed_influenced = sum(1 for r in all_results
                             if r["isHit"] and r["matchedSeed"] not in p1_seeds)

    print(f"  P1 Seed Influenced: {p1_influenced} ({p1_influenced/total_all*100:.1f}%)")
    print(f"  Old Seed Influenced: {old_seed_influenced} ({old_seed_influenced/total_all*100:.1f}%)")
    print(f"  No Seed Influence: {total_all - total_hit} ({(total_all-total_hit)/total_all*100:.1f}%)")
    print()

    # 保存结果
    output = {
        "enterprise": {"stats": e_stats, "results": e_results},
        "general": {"stats": g_stats, "results": g_results},
        "global": {
            "total": total_all,
            "seedHit": total_hit,
            "seedHitRate": total_hit / total_all,
            "p1Influenced": p1_influenced,
            "p1InfluenceRate": p1_influenced / total_all,
            "oldSeedInfluenced": old_seed_influenced,
            "oldSeedRate": old_seed_influenced / total_all,
        }
    }
    with open("p1-1-seed-influence.json", "w") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("Report saved to p1-1-seed-influence.json")


if __name__ == "__main__":
    main()
