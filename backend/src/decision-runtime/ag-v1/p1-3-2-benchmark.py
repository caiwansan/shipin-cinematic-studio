#!/usr/bin/env python3
"""
P1.3.2 — Geometry Impact Benchmark

验证 Geometry 是否真正改变决策。

构造 100 条查询，运行两套路径：
  Baseline:  Candidate → weighted score → best
  Geometry:  Candidate → frontier → recommendation

记录：
  sameRecommendationRate
  alternativeExposureRate
  contrarianExposureRate
  frontierAvgSize
  dominanceRatio
  scoreEntropy
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime

GATEWAY = 'http://127.0.0.1:4002/api/p0/gateway'
RESULTS_DIR = os.path.expanduser('~/shipin-cinematic-studio/backend')

# 100 条查询 — 混合意图（40% how_to, 25% factual, 15% definition, 10% medical, 10% financial）
QUERIES = [
    # how_to (40 条)
    "怎样让皮肤变白",
    "如何做红烧排骨",
    "怎么开通微信支付",
    "电动车充电要注意什么",
    "如何去除衣服上的油渍",
    "怎么在家做蛋糕",
    "如何提高睡眠质量",
    "怎样才能快速减肥",
    "怎么办理港澳通行证",
    "如何选一款好用的手机",
    "怎样清除手机内存",
    "怎么在淘宝退货",
    "如何保养汽车发动机",
    "怎样煮鸡蛋更好吃",
    "怎么给猫洗澡",
    "如何设置路由器",
    "怎样让头发长得更快",
    "怎么用Excel做数据透视表",
    "如何判断鸡蛋是否新鲜",
    "怎样收纳小户型房间",
    "怎么挑选西瓜",
    "如何在家锻炼腹肌",
    "怎样给文件加密",
    "如何办理社保转移",
    "怎么注销信用卡",
    "如何在阳台种菜",
    "怎样清洁油烟机",
    "怎么给狗狗打疫苗",
    "如何查自己的征信",
    "怎样预防感冒",
    "如何做PPT演示",
    "怎么用筷子开啤酒瓶",
    "怎样快速入睡",
    "如何给手机省电",
    "怎样理清公司财务",
    "怎么做水果沙拉",
    "怎样在官网买火车票",
    "如何修复破损的墙面",
    "怎样挑选新鲜的鱼",
    "如何给孩子选兴趣班",

    # factual (25 条)
    "深圳今天天气怎样",
    "北京故宫什么时候建的",
    "中国有多少个省份",
    "鲸鱼是鱼吗",
    "地球到月球有多远",
    "人的正常体温是多少",
    "飞机为什么能飞起来",
    "长城有多长",
    "太阳系有几大行星",
    "手机辐射对人体有害吗",
    "什么是碳中和",
    "GDP是什么意思",
    "人民币汇率现在多少",
    "高血压的标准是多少",
    "一天应该喝多少水",
    "春节是哪天",
    "珠穆朗玛峰多高",
    "什么是区块链",
    "维生素C有什么作用",
    "龙眼和桂圆的区别",
    "咖啡和茶哪个提神",
    "米饭的热量是多少",
    "熊猫是猫科还是熊科",
    "怎么区分感冒和流感",
    "5G和4G有什么区别",

    # definition (15 条)
    "什么是人工智能",
    "什么是通货膨胀",
    "什么是元宇宙",
    "什么是碳中和",
    "什么是云计算",
    "什么是量子计算",
    "什么是大数据",
    "什么是物联网",
    "什么是区块链",
    "什么是ETF",
    "什么是机器学习",
    "什么是股票分红",
    "什么是期货",
    "什么是基金定投",
    "什么是可转债",

    # medical (10 条)
    "高血压吃什么食物好",
    "感冒了吃什么药",
    "发烧多少度要就医",
    "被猫抓了要打狂犬疫苗吗",
    "近视会遗传吗",
    "痛风不能吃什么",
    "吃太咸对身体有什么危害",
    "腰疼应该挂什么科",
    "失眠怎么办",
    "打了疫苗多久产生抗体",

    # financial (10 条)
    "现在买基金合适吗",
    "房贷利率怎么算",
    "工资多少要交个税",
    "股票手续费是多少",
    "信用卡利息怎么算",
    "什么是小额贷款",
    "首套房首付比例是多少",
    "美元升值对炒股有影响吗",
    "支付宝理财安全吗",
    "住房公积金怎么提取",

    # 额外 10 条填补到 110（保留冗余）
    "怎么挑选洗面奶",
    "怎样让冰箱更省电",
    "怎么在闲鱼卖东西",
    "什么是企业微信",
    "什么是ChatGPT",
    "糖尿病能吃什么水果",
    "经常熬夜对身体有哪些危害",
    "基金和股票哪个风险大",
    "房贷提前还款划算吗",
    "怎么选择防晒霜",
]

assert len(QUERIES) == 110, f"Expected 110 queries, got {len(QUERIES)}"


def call_gateway(query: str, timeout: int = 15) -> dict:
    data_bytes = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(GATEWAY, data=data_bytes, headers={"Content-Type": "application/json"})
    resp = urllib.request.urlopen(req, timeout=timeout)
    return json.loads(resp.read().decode("utf-8"))


def compare_decisions():
    """For each query, run 1 call and extract both baseline and geometry decisions from _recommendation."""
    results = []

    print(f"P1.3.2 Geometry Impact Benchmark — {len(QUERIES)} queries\n")
    print(f"{'#':>4}  {'Result':>30}  {'Same?':>6}  {'Frontier':>8}  {'Baseline':>10}  {'Geometry':>10}")
    print("-" * 80)

    same_count = 0
    total_with_candidates = 0
    frontier_sizes = []
    dominance_ratios = []
    score_entropies = []
    alternative_exposed = 0
    contrarian_exposed = 0
    errors = 0

    for i, query in enumerate(QUERIES):
        try:
            resp = call_gateway(query)
        except Exception as e:
            print(f"{i+1:>4}  {'ERROR: ' + str(e)[:40]:>30}  {'ERROR':>6}")
            errors += 1
            continue

        rec = resp.get("_recommendation", {})
        geo_metrics = rec.get("geometry")
        geo_full = resp.get("_geometry", {})
        pipeline = resp.get("_pipeline", {})

        geo_frontier = geo_full.get("frontier", [])
        geo_recommended = geo_full.get("recommended")
        geo_alternative = geo_full.get("alternative")

        ranked = rec.get("rankedCandidates", [])
        frontier_size = pipeline.get("frontierSize", 0)
        dominance_ratio = pipeline.get("dominanceRatioGeometry", 0)
        score_entropy = pipeline.get("scoreEntropy", 0)

        candidate_count = pipeline.get("candidateCount", 0)
        duration_ms = pipeline.get("durationMs", 0)

        # Baseline best (by weighted score) = ranked[0]
        baseline_best = ranked[0] if ranked else None
        # Geometry best = geo_recommended.id
        geometry_best = geo_recommended["id"] if geo_recommended else None
        geo_alt = geo_alternative["id"] if geo_alternative else None

        same = (baseline_best == geometry_best) if (baseline_best and geometry_best) else None

        # Summary
        candidate_str = f"cand={candidate_count},fr={frontier_size}"
        bl_str = baseline_best[-15:] if baseline_best else "none"
        geo_str = geometry_best[-15:] if geometry_best else "none"

        if same is not None:
            same_str = "✅ SAME" if same else "🔄 DIFF"
            if same: same_count += 1
        else:
            same_str = "N/A"

        if candidate_count > 0:
            total_with_candidates += 1
            if frontier_size > 0:
                frontier_sizes.append(frontier_size)
                dominance_ratios.append(dominance_ratio)
                score_entropies.append(score_entropy)
                if geo_alt: alternative_exposed += 1
                if geo_full.get("contrarian"): contrarian_exposed += 1

        print(f"{i+1:>4}  {query[:28]:>30}  {same_str:>6}  {frontier_size:>3}/{candidate_count:<3}  {bl_str:>10}  {geo_str:>10}")

        results.append({
            "index": i,
            "query": query,
            "candidateCount": candidate_count,
            "frontierSize": frontier_size,
            "dominanceRatio": dominance_ratio,
            "scoreEntropy": score_entropy,
            "baselineBest": baseline_best,
            "geometryBest": geometry_best,
            "sameDecision": same,
            "hadAlternative": geo_alt is not None,
            "hadContrarian": geo_full.get("contrarian") is not None,
            "durationMs": duration_ms,
            "recommendationGeo": geo_metrics,
        })

    # ── Summary ──
    print("\n" + "=" * 70)
    print(f"  P1.3.2 Geometry Impact Benchmark — Summary")
    print("=" * 70)

    valid = total_with_candidates
    same_rate = same_count / valid * 100 if valid > 0 else 0
    alt_rate = alternative_exposed / valid * 100 if valid > 0 else 0
    con_rate = contrarian_exposed / valid * 100 if valid > 0 else 0

    avg_frontier = sum(frontier_sizes) / len(frontier_sizes) if frontier_sizes else 0
    avg_dominance = sum(dominance_ratios) / len(dominance_ratios) if dominance_ratios else 0
    avg_entropy = sum(score_entropies) / len(score_entropies) if score_entropies else 0

    print(f"\n  总查询: {len(QUERIES)}")
    print(f"  有效(有候选): {valid}")
    print(f"  错误: {errors}")
    print(f"\n  ┌─ 核心指标 ─────────────────────────────┐")
    print(f"  │ sameRecommendationRate:  {same_rate:5.1f}%  {'🔥 Geometry影响决策' if 60 <= same_rate <= 85 else '⚠️ 检查'}")
    print(f"  │ alternativeExposureRate: {alt_rate:5.1f}%")
    print(f"  │ contrarianExposureRate:  {con_rate:5.1f}%")
    print(f"  │ frontierAvgSize:         {avg_frontier:5.2f}")
    print(f"  │ avgDominanceRatio:       {avg_dominance:5.3f}")
    print(f"  │ avgScoreEntropy:         {avg_entropy:5.3f}")
    print(f"  └─────────────────────────────────────────┘")

    # 结论
    print(f"\n  评估:")
    if same_rate > 95:
        print(f"    ❌ Geometry 仅是包装层 (same={same_rate:.1f}% > 95%)")
    elif same_rate < 50:
        print(f"    ⚠️  Geometry 过于激进 (same={same_rate:.1f}% < 50%)")
    elif 60 <= same_rate <= 85:
        print(f"    ✅ Geometry 有效影响决策 (same={same_rate:.1f}%)")
    else:
        print(f"    🔶 Geometry 部分影响决策 (same={same_rate:.1f}%)")

    # Save
    report = {
        "generatedAt": datetime.now().isoformat(),
        "totalQueries": len(QUERIES),
        "validCases": valid,
        "errors": errors,
        "metrics": {
            "sameRecommendationRate": round(same_rate, 2),
            "alternativeExposureRate": round(alt_rate, 2),
            "contrarianExposureRate": round(con_rate, 2),
            "frontierAvgSize": round(avg_frontier, 2),
            "avgDominanceRatio": round(avg_dominance, 4),
            "avgScoreEntropy": round(avg_entropy, 4),
        },
        "results": results,
    }

    os.makedirs(RESULTS_DIR, exist_ok=True)
    report_path = os.path.join(RESULTS_DIR, "p1-3-2-geometry-impact.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\n  报告已写入: {report_path}")
    return report


if __name__ == "__main__":
    print("P1.3.2 Geometry Impact Benchmark")
    print("=" * 50)
    compare_decisions()
