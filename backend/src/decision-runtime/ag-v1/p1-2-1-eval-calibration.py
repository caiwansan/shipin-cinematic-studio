#!/usr/bin/env python3
"""
P1.2.1 — Evaluation Calibration Layer: Intent Clusterer v1 + Normalized Metrics

不修系统，只改评测建模。
让 General 域的 Ev 变得可比——别再用同一把尺子量不同性质的问题。

用法:
  1. 确保 api-server-0 在 4002 运行
  2. python3 p1-2-1-eval-calibration.py
  3. 输出: calibration-report-N.json + ab-comparison-N.csv

输出包含:
  - Query Intent Classification（每个 query mapping 到 cluster）
  - Per-cluster ev_norm（标准化 Ev）
  - P1.1 vs P1.2 对比（per cluster normalized）
"""

import json
import re
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone

GATEWAY_URL = "http://127.0.0.1:4002/api/p0/gateway"

# ──────────────────────────────────────────────
# Step 1: Intent Clusterer v1（纯规则，无 AI）
# ──────────────────────────────────────────────

# Query type pattern map
QUERY_TYPE_PATTERNS = [
    # definition — "什么是X", "X是什么意思", "X原理"
    ("definition", [
        r'^(什么是|什么是)',
        r'什么意思$',
        r'原理$',
        r'是什么意思$',
        r'是什么$',
        r'怎么理解',
        r'本质$',
        r'什么是',
    ]),
    # how_to — "怎样做", "如何", "需要什么", "该怎么"
    ("how_to", [
        r'^(怎样|怎么才能|如何|怎么做|怎么选|该怎么)',
        r'需要准备什么$',
        r'报考条件$',
        r'怎么操作$',
        r'怎么起步$',
        r'有什么(好|推荐|选择)',
        r'学习路线$',
        r'就业方向$',
        r'做什么$',
        r'注意事项$',
        r'怎么提取$',
        r'怎么算$',
        r'怎么做$',
        r'怎么赚',
        r'怎么拍',
        r'怎么学好',
        r'怎么培养',
        r'需要什么条件',
        r'方法$',  # 时间管理方法→how_to
    ]),
    # factual_search — "最新", "有哪些", "是谁", "发展", "历史数据"
    # P1.2.1 Calibration: financial subtype receives override below
    ("factual_search", [
        r'最新(消息|进展|情况|数据|政策|价格)',
        r'最新动态$',
        r'有哪些产品$',
        r'是谁$',
        r'公司$',
        r'业务$',
        r'规模$',
        r'情况$',
        r'数据$',
        r'现状$',
        r'市场份额$',
        r'市场情况$',
        r'运营情况$',
        r'恢复情况$',
        r'原因$',  # 全球变暖原因→factual_search
    ]),
    # medical_info — "症状", "饮食", "注意事项", "副作用"
    ("medical_info", [
        r'症状$',
        r'饮食注意事项$',
        r'早期症状$',
        r'高血压',       # P1.2.1 Calibration: domain override
        r'糖尿病',       # P1.2.1 Calibration: domain override
        r'治疗$',        # P1.2.1 Calibration: domain override
        r'有什么影响$',
        r'怎么减肥',     # 单独匹配，"最有效"移入 how_to
    ]),
    # comparative — "哪个好", "和比起来", "对比"
    ("comparative", [
        r'哪个好$',
        r'优缺点$',
        r'和.*哪个好$',
        r'有什么优缺点',
        r'vs',
    ]),
    # evaluation — "怎么样", "好不好"
    ("evaluation", [
        r'怎么样$',
        r'值得买吗$',
        r'性价比$',
    ]),
    # financial — "利率", "税率", "个税", "房价"
    # P1.2.1 Calibration: domain override, these override factual_search
    ("financial", [
        r'房贷',         # P1.2.1 Calibration: domain override
        r'利率',         # P1.2.1 Calibration: domain override
        r'个税',
        r'税率',
        r'贷款',
        r'市场价格$',
        r'最新价格$',
    ]),
    # corporate_info — "财报", "营收", "主营业务"
    ("corporate_info", [
        r'财报',
        r'营收',
        r'主营业务',
        r'业务构成',
        r'经营状况',
        r'销售',
        r'覆盖范围',
    ]),
    # mixed — catch-all for queries that don't fit above
    ("general_mixed", []),  # always matches last
]


# ═══════════════════════════════════════════════════════════════
# P1.2.1 Calibration Layer: Domain Override + Confidence Calibration
# ═══════════════════════════════════════════════════════════════

# Domain Override Rules: medical/financial specific terms
# These override the raw pattern match when detected.
DOMAIN_OVERRIDE = {
    "medical": {
        "keywords": ["高血压", "糖尿病", "症状", "饮食", "治疗", "影响"],
        "intent": "medical_info",
    },
    "financial": {
        "keywords": ["房贷", "利率", "贷款", "汇率", "政策", "价格", "税率", "个税"],
        "intent": "financial",
    },
}

# ──────────────────────────────────────────────
# How-to vs Factual Boundary Refinement
# ──────────────────────────────────────────────
# 当 query 同时匹配 how_to 和 factual_search 时：
#   含 "最新/现在/当前/多少" → factual_search
#   否则 → how_to

FACTUAL_PRIORITY_KEYWORDS = ["最新", "现在", "当前", "多少", "数据"]


def domain_override(query: str, raw_intent: str) -> str | None:
    """P1.2.1 Calibration: domain-aware override.
    Returns overridden intent or None (no override)."""
    # medical override
    if any(kw in query for kw in DOMAIN_OVERRIDE["medical"]["keywords"]):
        return "medical_info"
    # financial override
    if any(kw in query for kw in DOMAIN_OVERRIDE["financial"]["keywords"]):
        return "financial"
    return None


def how_to_vs_factual_refinement(query: str, raw_intent: str, matched_intents: set[str]) -> str | None:
    """P1.2.1 Calibration: resolve how_to vs factual boundary.
    Returns refined intent or None (keep raw)."""
    if "factual_search" in matched_intents and "how_to" in matched_intents:
        if any(kw in query for kw in FACTUAL_PRIORITY_KEYWORDS):
            return "factual_search"
        return "how_to"
    return None

def calibrate_confidence(query: str, matched_intents: set[str]) -> float:
    """P1.2.1 Calibration: entropy-based confidence.

    公式:
      base = 0.5 + 0.08 * len(matched_intents)
      cluster_entropy = -sum(p * log(p)) for each matched intent
      confidence = base * (1 - cluster_entropy / log(N))

    效果：单一 cluster 匹配 → 高置信度
           多 cluster 摇摆 → 低置信度（语义模糊）
    """
    if not matched_intents:
        return 0.0

    import math
    n = len(matched_intents)
    base = min(0.5 + 0.08 * n, 0.92)

    # Entropy: assume uniform distribution across matched intents
    p = 1.0 / n
    entropy = -n * p * math.log(p) if n > 1 else 0
    max_entropy = math.log(n) if n > 1 else 1
    entropy_penalty = entropy / max_entropy if n > 1 else 0

    confidence = round(base * (1 - entropy_penalty), 2)
    return confidence
    """P1.2.1 Calibration: classify query with domain override + boundary refinement.

    三层判断（优先级递减）：
    1. Domain Override（medical/financial 硬编码纠错）
    2. Pattern Match + Boundary Refinement（how_to vs factual）
    3. Fallback → general_mixed
    """
    # Layer 1: Domain Override 先走
    override = domain_override(query, "")
    if override:
        return override

    # Layer 2: Pattern Match
    matched_intents = set()
    for intent_name, patterns in QUERY_TYPE_PATTERNS:
        if not patterns:
            continue
        for pat in patterns:
            if re.search(pat, query):
                matched_intents.add(intent_name)

    if not matched_intents:
        return "general_mixed"

    # Layer 2.5: how_to vs factual boundary refinement
    boundary_refine = how_to_vs_factual_refinement(query, "", matched_intents)
    if boundary_refine:
        return boundary_refine

    # Winner selection: pick highest priority by order in QUERY_TYPE_PATTERNS
    order = [name for name, _ in QUERY_TYPE_PATTERNS]
    for candidate in order:
        if candidate in matched_intents:
            return candidate

    return "general_mixed"


# ──────────────────────────────────────────────
# Step 2: Query dataset（从 P1.1 完整复制）
# ──────────────────────────────────────────────

ENTERPRISE_QUERIES = [
    "华为公司最新动态", "阿里巴巴2025年财报", "腾讯现在有哪些核心业务",
    "字节跳动旗下有哪些产品", "比亚迪新能源汽车销量", "宁德时代最新电池技术",
    "小米集团主营业务构成", "特斯拉上海工厂产能", "美团公司最新财报分析",
    "拼多多用户增长情况", "京东物流覆盖范围", "百度AI业务最新进展",
    "网易游戏2025年新游", "快手电商业务规模", "滴滴出行恢复情况",
    "大疆无人机新品发布", "小红书商业化进展", "B站用户活跃数据",
    "蚂蚁集团上市最新消息", "中兴通讯5G业务", "联想集团全球化布局",
    "格力电器营收情况", "美的集团智能家居战略", "海尔智家海外市场",
    "中国平安保险业务", "招商银行数字化转型", "工商银行最新理财产品",
    "中芯国际芯片制造进展", "隆基绿能光伏技术", "药明康德CXO业务",
    "OPPO手机海外市场", "VIVO影像技术进展", "荣耀手机市场份额",
    "理想汽车交付数据", "蔚来汽车换电站布局", "小鹏汽车自动驾驶技术",
    "科大讯飞AI大模型", "海康威视安防业务", "牧原股份养殖规模",
    "万华化学主营业务", "福耀玻璃全球份额", "中国中免免税业务",
    "石头科技扫地机器人新品", "安踏体育品牌矩阵", "李宁公司年轻化战略",
    "农夫山泉水源分布", "海底捞海外业务", "茅台酒市场价格",
    "瑞幸咖啡门店数量", "OpenAI公司最新融资",
]

GENERAL_QUERIES = [
    "碳中和是什么意思", "区块链技术原理", "量子计算机原理",
    "什么是通货膨胀", "马斯克是谁", "怎样学好英语",
    "什么是GPT", "EDG电子竞技俱乐部", "比特币最新价格",
    "房贷利率最新政策", "个人所得税怎么算", "社保断缴有什么影响",
    "公积金怎么提取", "高血压饮食注意事项", "糖尿病早期症状",
    "怎样减肥最有效", "大学生就业前景分析", "考研需要准备什么",
    "公务员考试科目", "教师资格证报考条件", "房屋装修流程",
    "怎么选股票", "基金定投怎么操作", "什么是ChatGPT",
    "Python和Java哪个好", "前端开发学习路线", "人工智能就业方向",
    "新能源汽车有什么优缺点", "iPhone和安卓哪个好", "怎样提高写作能力",
    "时间管理方法", "怎样学好编程", "中国GDP最新数据",
    "全球变暖原因", "什么是元宇宙", "跨境电商怎么做",
    "自媒体怎么起步", "短视频怎么赚钱", "直播带货需要什么条件",
    "怎样拍好照片", "怎样做好PPT", "Excel常用技巧",
    "怎样学好数学", "什么是5G技术", "电动车充电注意事项",
    "什么是云计算", "大数据技术应用", "怎样培养好习惯",
    "网络安全基础知识", "什么是NFT",
]


# ──────────────────────────────────────────────
# Step 3: Gateway caller
# ──────────────────────────────────────────────

def call_gateway(query: str) -> dict:
    body = json.dumps({"query": query}).encode('utf-8')
    req = urllib.request.Request(
        GATEWAY_URL, data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        return {"error": str(e)}


# ──────────────────────────────────────────────
# Step 4: Metrics per cluster
# ──────────────────────────────────────────────

def compute_cluster_metrics(results: list[dict], cluster_field: str = "intent") -> dict:
    """Compute per-cluster metrics from results list."""
    clusters: dict[str, list[dict]] = {}
    for r in results:
        c = r.get(cluster_field, "unknown")
        if c not in clusters:
            clusters[c] = []
        clusters[c].append(r)

    cluster_metrics = {}
    for cname, entries in sorted(clusters.items()):
        n = len(entries)
        hits = [e for e in entries if e.get("isHit")]
        misses = [e for e in entries if not e.get("isHit")]
        evs = [e.get("ev", 0) for e in entries]
        hit_evs = [e.get("ev", 0) for e in hits]
        miss_evs = [e.get("ev", 0) for e in misses]

        cluster_metrics[cname] = {
            "count": n,
            "ratio": n / len(results),
            "seed_hit": len(hits),
            "seed_miss": len(misses),
            "hit_rate": len(hits) / n if n > 0 else 0,
            "avg_ev": sum(evs) / n if n > 0 else 0,
            "avg_ev_hit": sum(hit_evs) / len(hits) if hits else 0,
            "avg_ev_miss": sum(miss_evs) / len(misses) if misses else 0,
            "ev_gap": (sum(hit_evs) / len(hits) if hits else 0)
                      - (sum(miss_evs) / len(misses) if misses else 0),
            "sample_hit_queries": [e.get("query", "")[:20] for e in hits[:3]],
            "sample_miss_queries": [e.get("query", "")[:20] for e in misses[:3]],
        }
    return cluster_metrics


def normalize_ev(results: list[dict], cluster_field: str = "intent") -> list[dict]:
    """Add ev_norm field to each result based on cluster mean."""
    cluster_evs: dict[str, list[float]] = {}
    for r in results:
        c = r.get(cluster_field, "unknown")
        if c not in cluster_evs:
            cluster_evs[c] = []
        cluster_evs[c].append(r["ev"])

    cluster_mean = {}
    for c, evs in cluster_evs.items():
        cluster_mean[c] = sum(evs) / len(evs) if evs else 1.0

    for r in results:
        c = r.get(cluster_field, "unknown")
        mean = cluster_mean.get(c, 1.0)
        r["ev_norm"] = r["ev"] / mean if mean > 0 else 0
        r["cluster_mean_ev"] = mean

    return results


# ──────────────────────────────────────────────
# Step 5: Main runner
# ──────────────────────────────────────────────

def classify_and_measure(queries: list[str], domain_label: str) -> list[dict]:
    """Classify queries and measure each."""
    results = []
    total = len(queries)

    print(f"\n{'='*60}")
    print(f"  {domain_label} — Classifying & Measuring ({total} queries)")
    print(f"{'='*60}")

    for i, q in enumerate(queries):
        intent = classify_intent(q)
        resp = call_gateway(q)
        if "error" in resp:
            print(f"  [{i+1:3d}/{total}] ❌ {q[:25]:25s} ERROR: {resp['error'][:40]}")
            results.append({
                "query": q, "domain": domain_label,
                "intent": intent, "matchedSeed": None,
                "score": 0, "level": "none", "ev": 0,
                "isHit": False, "error": resp["error"],
                "ev_norm": 0, "cluster_mean_ev": 0,
            })
            continue

        matched_seed = resp.get("matchedSeed")
        score = resp.get("matchScore", 0)
        level = resp.get("matchLevel", "none")
        ev = resp.get("_pipeline", {}).get("evidenceCount", 0)
        is_hit = matched_seed is not None and str(matched_seed) != "None" and score > 0

        results.append({
            "query": q,
            "domain": domain_label,
            "intent": intent,
            "matchedSeed": matched_seed,
            "score": score,
            "level": level,
            "ev": ev,
            "isHit": is_hit,
        })

        hit_sym = "✔" if is_hit else "○"
        print(f"  [{i+1:3d}/{total}] {hit_sym} {q[:30]:30s} → {intent:18s} ev={ev:3d} {matched_seed or '':12s}")

        if (i + 1) % 10 == 0 and i + 1 < total:
            print(f"  ─── {i+1}/{total} complete ───")

    return results


def print_comparison(enterprise, general):
    """Print structured comparison."""
    print("\n" + "="*70)
    print("  P1.2.1 EVALUATION CALIBRATION REPORT")
    print("="*70)

    for domain_label, results in [("ENTERPRISE", enterprise), ("GENERAL", general)]:
        print(f"\n{'─'*70}")
        print(f"  📊 {domain_label} — Raw Metrics by Intent Cluster")
        print(f"{'─'*70}")

        # Raw metrics
        raw_clusters = compute_cluster_metrics(results, "intent")

        # Normalize
        normalized = normalize_ev(results, "intent")
        norm_clusters = compute_cluster_metrics(normalized, "intent")

        print(f"  {'Intent Cluster':<22s} {'Count':>5s} {'Ratio':>6s} {'Hit%':>6s} {'Ev':>5s} {'Ev_Hit':>6s} {'Ev_Miss':>6s} {'Gap':>6s} {'Ev_Norm_H':>8s} {'Ev_Norm_M':>8s}")
        print(f"  {'─'*80}")

        for cname in sorted(raw_clusters.keys()):
            r = raw_clusters[cname]
            n = norm_clusters.get(cname, {})
            print(f"  {cname:<22s} {r['count']:>5d} {r['ratio']:>6.1%} {r['hit_rate']:>6.1%} "
                  f"{r['avg_ev']:>5.1f} {r['avg_ev_hit']:>6.1f} {r['avg_ev_miss']:>6.1f} {r['ev_gap']:>6.1f} "
                  f"{n.get('avg_ev_hit', 0):>8.3f} {n.get('avg_ev_miss', 0):>8.3f}")

        print(f"\n  ⚠️  Key finding:")
        worst_gap = min(raw_clusters.items(), key=lambda x: x[1]['ev_gap'])
        best_gap = max(raw_clusters.items(), key=lambda x: x[1]['ev_gap'])

        if worst_gap[1]['count'] >= 2:
            print(f"  • Worst ev_gap: {worst_gap[0]} ({worst_gap[1]['ev_gap']:.1f}) — seed may be over-constraining this type")
        if best_gap[1]['count'] >= 2:
            print(f"  • Best ev_gap:  {best_gap[0]} ({best_gap[1]['ev_gap']:.1f}) — seed bias working well for this type")

        if raw_clusters.get("general_mixed", {}).get("count", 0) > 5:
            print(f"  • ⚠️  general_mixed 占比 {raw_clusters['general_mixed']['ratio']:.1%} — 分类器有 gap")

    # ── Overall summary ──
    print(f"\n{'═'*70}")
    print(f"  📋 OVERALL SUMMARY (Normalized)")
    print(f"{'═'*70}")

    all_results = enterprise + general
    for domain_label, results in [("ENTERPRISE", enterprise), ("GENERAL", general)]:
        n_results = normalize_ev(results, "intent")
        hits = [r for r in n_results if r.get("isHit")]
        misses = [r for r in n_results if not r.get("isHit")]

        hit_norm = [r["ev_norm"] for r in hits]
        miss_norm = [r["ev_norm"] for r in misses]

        print(f"\n  {domain_label}:")
        print(f"    Seed Hit Rate: {len(hits):3d}/{len(results):3d} = {len(hits)/len(results)*100:.0f}%")
        print(f"    avg Ev_norm (Hit):  {sum(hit_norm)/len(hit_norm):.3f}" if hit_norm else "    avg Ev_norm (Hit):  N/A")
        print(f"    avg Ev_norm (Miss): {sum(miss_norm)/len(miss_norm):.3f}" if miss_norm else "    avg Ev_norm (Miss): N/A")

    # ── Intent distribution ──
    print(f"\n{'─'*70}")
    print(f"  📊 INTENT DISTRIBUTION (All Queries)")
    print(f"{'─'*70}")

    intent_counts: dict[str, dict] = {}
    for r in all_results:
        i = r["intent"]
        if i not in intent_counts:
            intent_counts[i] = {"total": 0, "enterprise": 0, "general": 0}
        intent_counts[i]["total"] += 1
        intent_counts[i][r["domain"].lower()] += 1

    print(f"  {'Intent':<22s} {'Total':>6s} {'Enterprise':>10s} {'General':>8s}")
    print(f"  {'─'*48}")
    for i in sorted(intent_counts.keys()):
        c = intent_counts[i]
        print(f"  {i:<22s} {c['total']:>6d} {c['enterprise']:>10d} {c['general']:>8d}")

    # ── Save results ──
    ts = int(datetime.now(timezone.utc).timestamp())
    output = {
        "timestamp": ts,
        "generated_by": "P1.2.1 Evaluation Calibration Layer",
        "enterprise": {
            "queries": len(enterprise),
            "raw_clusters": {k: {sk: sv for sk, sv in v.items() if sk != "sample_hit_queries" and sk != "sample_miss_queries"} for k, v in compute_cluster_metrics(enterprise, "intent").items()},
            "normalized_clusters": {k: {sk: sv for sk, sv in v.items() if sk != "sample_hit_queries" and sk != "sample_miss_queries"} for k, v in compute_cluster_metrics(normalize_ev(enterprise, "intent"), "intent").items()},
        },
        "general": {
            "queries": len(general),
            "raw_clusters": {k: {sk: sv for sk, sv in v.items() if sk != "sample_hit_queries" and sk != "sample_miss_queries"} for k, v in compute_cluster_metrics(general, "intent").items()},
            "normalized_clusters": {k: {sk: sv for sk, sv in v.items() if sk != "sample_hit_queries" and sk != "sample_miss_queries"} for k, v in compute_cluster_metrics(normalize_ev(general, "intent"), "intent").items()},
        },
    }

    report_path = f"calibration-report-{ts}.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\n  💾 Report saved: {report_path}")

    # ── Save CSV ──
    csv_path = f"ab-comparison-{ts}.csv"
    with open(csv_path, "w", encoding="utf-8") as f:
        f.write("domain,query,intent,matchedSeed,score,level,ev,isHit,ev_norm\n")
        for r in all_results:
            n_results = normalize_ev(all_results, "intent")
        for r in all_results:
            # after normalization, need to recompute per-result
            pass
        # simpler: write raw data
        for r in all_results:
            f.write(f"{r['domain']},{r['query']},{r['intent']},{r.get('matchedSeed','')},{r['score']:.3f},{r['level']},{r['ev']},{r['isHit']},{r.get('ev_norm', 0):.3f}\n")
    print(f"  💾 CSV saved: {csv_path}")

    return output


def main():
    print("=" * 70)
    print("  P1.2.1: Evaluation Calibration Layer — Intent Stratification")
    print("  Target: 修复 General 域评测的不可比性问题")
    print("=" * 70)
    print()

    print("▶ Phase 1: Classify & Measure Enterprise Queries")
    enterprise = classify_and_measure(ENTERPRISE_QUERIES, "ENTERPRISE")

    print()
    print("▶ Phase 2: Classify & Measure General Queries")
    general = classify_and_measure(GENERAL_QUERIES, "GENERAL")

    print()
    print("▶ Phase 3: Normalize & Compare")
    print_comparison(enterprise, general)


if __name__ == "__main__":
    main()
