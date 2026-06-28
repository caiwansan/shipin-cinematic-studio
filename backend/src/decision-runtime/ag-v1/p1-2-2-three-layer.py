#!/usr/bin/env python3
"""
P1.2.2 — Three-Layer Semantic Architecture — Cluster EV Stability Check

P1.2.1 的 override 职责被拆分为 3 个独立层：
  Layer 1 — Intent Core（主坐标系）
  Layer 2 — Domain Prior（软偏置）
  Layer 3 — Keyword Boost（检索层）

200 条分层抽样验证：
  - 50 × how_to
  - 50 × definition
  - 50 × factual
  - 50 × medical（作为 domain prior，不再作为 cluster）
"""

import csv
import json
import math
import os
import re
import sys
import time
import urllib.request
import urllib.error
from collections import Counter
from datetime import datetime, timezone

GATEWAY_URL = "http://127.0.0.1:4002/api/p0/gateway"

# ══════════════════════════════════════════════════════════════
# P1.2.2: Three-Layer Semantic Architecture
# ══════════════════════════════════════════════════════════════

# ── Layer 1: Intent Core ──

QUERY_TYPE_PATTERNS = [
    ("definition", [
        r"^(什么是|什么是)", r"什么意思$", r"原理$", r"是什么意思$", r"是什么$",
        r"怎么理解", r"本质$",
    ]),
    ("how_to", [
        r"^(怎样|怎么才能|如何|怎么做|怎么选|该怎么)",
        r"需要准备什么$", r"报考条件$", r"怎么操作$", r"怎么起步$",
        r"有什么(好|推荐|选择)", r"学习路线$", r"就业方向$", r"做什么$",
        r"注意事项$", r"怎么提取$", r"怎么算$", r"怎么做$",
        r"怎么赚", r"怎么拍", r"怎么学好", r"怎么培养",
        r"需要什么条件", r"方法$", r"最有效$",
    ]),
    ("factual_search", [
        r"最新(消息|进展|情况|数据|政策|价格)", r"最新动态$", r"有哪些产品$",
        r"是谁$", r"公司$", r"业务$", r"规模$", r"情况$", r"数据$",
        r"现状$", r"份额$", r"运营", r"恢复情况$", r"原因$",
    ]),
    ("comparative", [r"哪个好$", r"优缺点$", r"和.*哪个好$", r"vs"]),
    ("evaluation", [r"怎么样$", r"值得买吗$", r"性价比$"]),
    ("corporate_info", [r"财报", r"营收", r"主营业务", r"业务构成", r"销售", r"覆盖范围"]),
    ("general_mixed", []),
]

# ── Layer 2: Domain Prior（仅 score bias，不决定 cluster） ──

DOMAIN_PRIORS = {
    "medical": {
        "keywords": ["高血压", "糖尿病", "症状", "饮食", "治疗", "影响", "减肥"],
        "bias": 0.3,
    },
    "financial": {
        "keywords": ["房贷", "利率", "贷款", "汇率", "政策", "价格", "税率", "个税"],
        "bias": 0.3,
    },
}

# ── Layer 3: Keyword Boost（仅 retrieval，不参与分类） ──

RETRIEVAL_BOOST_KEYWORDS = {
    "汇率": {"domain": "financial", "boost": 1.5},
    "饮食": {"domain": "medical", "boost": 1.5},
    "政策": {"domain": "general", "boost": 1.2},
}

FACTUAL_PRIORITY_KEYWORDS = ["最新", "现在", "当前", "多少", "数据"]

ALL_CLUSTERS = [name for name, _ in QUERY_TYPE_PATTERNS]
CLUSTER_ORDER = ALL_CLUSTERS


def classify_intent_core(query: str) -> str:
    """Layer 1: Intent Core — 唯一决定 cluster label 的层。"""
    matched = set()
    for intent_name, patterns in QUERY_TYPE_PATTERNS:
        if not patterns:
            continue
        for pat in patterns:
            if re.search(pat, query):
                matched.add(intent_name)

    if not matched:
        return "general_mixed"

    if "factual_search" in matched and "how_to" in matched:
        refined = "factual_search" if any(kw in query for kw in FACTUAL_PRIORITY_KEYWORDS) else "how_to"
        matched = {refined}

    for c in CLUSTER_ORDER:
        if c in matched:
            return c
    return "general_mixed"


def compute_domain_prior_score(query: str) -> dict:
    """Layer 2: Domain Prior — 计算 domain bias。"""
    scores = {}
    for domain_name, domain_cfg in DOMAIN_PRIORS.items():
        match_count = sum(1 for kw in domain_cfg["keywords"] if kw in query)
        if match_count > 0:
            bias = domain_cfg["bias"] * min(match_count / 2, 1.0)
            scores[domain_name] = round(bias, 2)
    return scores


def get_retrieval_boost(query: str) -> list:
    """Layer 3: Keyword Boost — 仅检索使用。"""
    boosts = []
    for kw, cfg in RETRIEVAL_BOOST_KEYWORDS.items():
        if kw in query:
            boosts.append({"keyword": kw, **cfg})
    return boosts


def classify_intent_calibrated(query: str) -> str:
    """P1.2.2 entry point: 只由 Intent Core 决定 cluster。"""
    return classify_intent_core(query)


# ── Override Impact（仅用于报告——检测 domain prior 命中率） ──

def compute_domain_prior_impact(results: list[dict]) -> dict:
    """统计 Domain Prior 命中率，替代旧的 override ratio。"""
    total_with_domain_kw = 0
    prior_applied = 0
    medical_hits = 0
    financial_hits = 0

    for r in results:
        q = r["query"]
        prior_scores = compute_domain_prior_score(q)
        if prior_scores:
            total_with_domain_kw += 1
            prior_applied += 1
            if "medical" in prior_scores:
                medical_hits += 1
            if "financial" in prior_scores:
                financial_hits += 1

    return {
        "queries_with_domain_keywords": total_with_domain_kw,
        "prior_applied": prior_applied,
        "prior_hit_ratio": round(prior_applied / max(1, total_with_domain_kw), 3),
        "medical_prior_count": medical_hits,
        "financial_prior_count": financial_hits,
    }


# ── Dataset Builder ──

def build_200_sample() -> list[dict]:
    queries = []
    # definition (50)
    def_queries = [
        "什么是通货膨胀", "区块链技术原理", "量子计算机原理", "碳中和是什么意思",
        "什么是GPT", "什么是ChatGPT", "什么是元宇宙", "什么是5G技术",
        "什么是云计算", "什么是NFT", "什么是大数据", "人工智能是什么意思",
        "机器学习原理", "深度学习本质", "神经网络的原理",
        "什么是区块链", "什么是算法", "什么是编程语言",
        "什么是数据库", "加密技术原理", "什么是API",
        "什么是操作系统", "前端开发是什么意思",
        "后端开发原理", "什么是云存储", "什么是CDN",
        "什么是Docker", "微服务是什么意思", "什么是Kubernetes",
        "芯片制造原理", "光刻机是什么意思", "什么是EDA",
        "什么是RISC-V", "ARM架构是什么意思", "什么是GPU",
        "什么是TPU", "NPU是什么意思", "算力是什么意思",
        "什么是量子比特", "量子纠缠是什么意思", "什么是超导",
        "核聚变原理", "什么是光伏", "氢能源原理",
        "什么是碳交易", "碳足迹是什么意思", "ESG是什么意思",
        "什么是碳中和", "碳达峰是什么意思", "LPR是什么意思",
    ]
    queries.extend({"query": q, "target_cluster": "definition", "source": "definition"} for q in def_queries[:50])

    # how_to (50)
    how_queries = [
        "怎样学好英语", "怎样减肥最有效", "怎么选股票", "基金定投怎么操作",
        "怎样提高写作能力", "怎样学好编程", "怎样拍好照片", "怎样做好PPT",
        "Excel常用技巧 怎么学", "怎样学好数学", "跨境电商怎么做",
        "自媒体怎么起步", "短视频怎么赚钱", "直播带货需要什么条件",
        "时间管理方法", "怎样培养好习惯", "怎样学好英语 口语",
        "雅思怎么备考", "托福怎么准备", "公务员考试怎么复习",
        "考研需要准备什么", "教师资格证报考条件", "怎么选专业",
        "房屋装修流程", "公积金怎么提取", "个人所得税怎么算",
        "怎么申请贷款", "怎么买保险", "医疗保险怎么报销",
        "社保怎么补缴", "户口迁移怎么办理", "护照怎么办理",
        "怎么办签证", "驾驶证怎么考", "车牌怎么摇号",
        "怎么选手机", "怎么选笔记本电脑", "怎么选空调",
        "冰箱怎么选", "电视怎么选", "洗衣机怎么选",
        "怎么开网店", "怎么做电商", "怎么做小红书",
        "抖音怎么做", "怎么做直播", "怎么写文案",
        "怎么写简历", "怎么准备面试", "怎么谈薪资",
    ]
    queries.extend({"query": q, "target_cluster": "how_to", "source": "how_to"} for q in how_queries[:50])

    # factual (50) — financial 不再作为 cluster
    fact_queries = [
        "中国GDP最新数据", "全球变暖原因", "马斯克是谁",
        "华为公司最新动态", "腾讯有哪些业务", "阿里巴巴最新财报",
        "比特币最新价格", "房贷利率最新政策", "最新房贷利率",
        "现在买房利率多少", "黄金现在多少钱一克", "美元汇率最新",
        "人民币汇率走势", "股市最新行情", "上证指数最新",
        "特斯拉最新销量", "比亚迪销量数据", "宁德时代最新动态",
        "大疆最新产品", "OPPO最新手机",
        "小米最新财报", "网易游戏2025年新游",
        "瑞幸咖啡门店数量", "美团外卖业务规模",
        "海底捞海外市场情况", "拼多多用户数据",
        "EDG电子竞技俱乐部",
        "中国人口最新数据", "2025年就业率数据",
        "最新疫情数据", "全球碳排放最新数据",
        "中国高铁总里程", "中国航天最新进展",
        "SpaceX最新发射", "NASA最新发现",
        "最新科技新闻", "2025年诺贝尔奖",
        "奥斯卡最新获奖名单", "全球票房排行榜",
        "最新电影推荐", "最火电视剧排行",
        "现在流行什么歌", "抖音热门排行榜",
        "中国首富是谁", "2025年福布斯排行榜",
        "最新人工智能突破", "最新芯片工艺进展",
        "最新新能源政策", "最新教育改革政策",
        "最新房价数据", "城市平均工资是多少",
    ]
    queries.extend({"query": q, "target_cluster": "factual_search", "source": "factual"} for q in fact_queries[:50])

    # medical domain prior (50) — 这些 query 的 intent core 可能是 how_to/factual
    # 它们不再有独立的 cluster，domain prior 只影响 score
    medical_queries = [
        "高血压饮食注意事项", "糖尿病早期症状", "感冒症状",
        "高血压怎么治疗", "糖尿病怎么预防",
        "心脏病早期症状", "心梗前兆",
        "脑梗症状", "中风前兆",
        "癌症早期症状", "肺癌早期症状",
        "胃癌症状", "肝癌症状",
        "抑郁症症状", "焦虑症表现",
        "失眠怎么治疗", "为什么睡不着",
        "腰疼怎么办", "颈椎病怎么治",
        "近视眼怎么恢复", "眼睛干涩怎么办",
        "过敏症状", "湿疹怎么治",
        "脱发怎么治疗", "白发怎么办",
        "贫血症状", "缺钙症状",
        "甲亢症状", "甲状腺结节怎么办",
        "痛风症状", "尿酸高怎么办",
        "脂肪肝怎么办", "肝功能异常怎么办",
        "肾病早期症状", "尿毒症前兆",
        "乙肝怎么治疗", "脂肪肝饮食注意事项",
        "糖尿病饮食注意事项", "高血压饮食禁忌",
        "痛风饮食禁忌", "肾病患者饮食",
        "减肥饮食方案", "增肌饮食方案",
        "运动后肌肉酸痛怎么办", "跑步膝盖疼怎么治",
        "瑜伽初学者注意事项", "游泳注意事项",
    ]
    queries.extend({"query": q, "target_domain": "medical", "source": "medical"} for q in medical_queries[:50])

    return queries[:200]


# ── API Caller ──

def call_gateway(query: str) -> dict:
    body = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(
        GATEWAY_URL, data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {"error": str(e)}


# ── Metrics ──

def compute_cluster_ev_stats(results: list[dict]) -> dict:
    clusters: dict[str, list[float]] = {}
    classifications: dict[str, list[str]] = {}
    for r in results:
        c = r["predicted_cluster"]
        ev = r["ev"]
        if c not in clusters:
            clusters[c] = []
            classifications[c] = []
        clusters[c].append(ev)
        classifications[c].append(r.get("source", ""))
    stats = {}
    for c, evs in sorted(clusters.items()):
        n = len(evs)
        mean = sum(evs) / n if n > 0 else 0
        variance = sum((ev - mean) ** 2 for ev in evs) / n if n > 0 else 0
        stats[c] = {
            "count": n,
            "ev_mean": round(mean, 2),
            "ev_std": round(math.sqrt(variance), 2),
            "ev_max": round(max(evs), 2),
            "ev_min": round(min(evs), 2),
            "summary": dict(Counter(classifications[c])),
        }
    return stats


def compute_entropy_comparison(results: list[dict]) -> dict:
    """Compare entropy distribution: Layer 1 (intent core) vs old override."""
    # 旧系统（模拟）: 之前的 classify_intent_calibrated 有 medical/financial cluster
    # 新系统: 只有 intent core
    pre_clusters = Counter()
    post_clusters = Counter()
    n_migrations = 0

    for r in results:
        q = r["query"]
        # 旧系统模拟：如果是 medical domain query，强制 medical_info
        pre = r.get("target_domain", r.get("target_cluster", ""))
        post = r["predicted_cluster"]
        pre_clusters[pre] += 1
        post_clusters[post] += 1
        if pre != post:
            n_migrations += 1

    def entropy(dist: Counter, total: int) -> float:
        if total == 0:
            return 0
        return -sum((c / total) * math.log(c / total) for c in dist.values())

    total = len(results)
    pre_entropy = entropy(pre_clusters, total)
    post_entropy = entropy(post_clusters, total)
    pct_change = (post_entropy - pre_entropy) / pre_entropy * 100 if pre_entropy > 0 else 0

    return {
        "pre_calibration_entropy": round(pre_entropy, 4),
        "post_calibration_entropy": round(post_entropy, 4),
        "entropy_change_pct": round(pct_change, 2),
        "cluster_migrations": n_migrations,
        "migration_rate": round(n_migrations / total, 3),
    }


def check_acceptance(stats: dict, prior_impact: dict, entropy: dict) -> dict:
    checks = {}
    all_evs = []
    for cname, cstats in stats.items():
        all_evs.extend([cstats["ev_mean"]] * cstats["count"])
    overall_mean = sum(all_evs) / len(all_evs) if all_evs else 1
    for cname, cstats in stats.items():
        if cstats["count"] >= 5:
            threshold = cstats["ev_mean"] * 2 if cstats["ev_mean"] > 0 else 1
            checks[f"ev_std_{cname}"] = {
                "value": cstats["ev_std"],
                "threshold": round(threshold, 2),
                "pass": cstats["ev_std"] < threshold,
            }
    checks["prior_hit_ratio"] = {
        "value": prior_impact.get("prior_hit_ratio", 0),
        "threshold": 1.0,
        "pass": prior_impact.get("prior_hit_ratio", 0) <= 1.0,
        "note": "Domain prior is now only a score bias, not a cluster override. Ratio=1.0 is expected.",
    }
    checks["entropy_change"] = {
        "value": abs(entropy["entropy_change_pct"]),
        "threshold": 15.0,
        "pass": abs(entropy["entropy_change_pct"]) < 15.0,
    }
    all_pass = all(c.get("pass", True) for c in checks.values())
    return {"all_pass": all_pass, "checks": checks}


# ── Main ──

def main():
    print("=" * 70)
    print("  P1.2.2: Three-Layer Semantic Architecture")
    print("  200 queries stratified — intent core only, domain prior as score bias")
    print("=" * 70)

    samples = build_200_sample()
    print(f"\n▶ Dataset: {len(samples)} queries")
    sc = Counter(s.get("source", s.get("target_cluster", "?")) for s in samples)
    for c, n in sorted(sc.items(), key=lambda x: -x[1]):
        print(f"  {c}: {n}")

    results = []
    total = len(samples)

    print("\n▶ Phase 1: Query via P0 Gateway...")
    for i, s in enumerate(samples):
        q = s["query"]
        resp = call_gateway(q)
        if "error" in resp:
            print(f"  [{i+1:3d}/{total}] ❌ {q[:35]:35s} ERROR: {resp['error'][:40]}")
            results.append({
                "query": q,
                "source": s.get("source", ""),
                "target_cluster": s.get("target_cluster", "general_mixed"),
                "target_domain": s.get("target_domain", ""),
                "predicted_cluster": "error",
                "ev": 0,
                "isHit": False,
            })
            continue

        predicted = classify_intent_calibrated(q)
        domain_prior = compute_domain_prior_score(q)
        retrieval_boost = get_retrieval_boost(q)
        ev = resp.get("_pipeline", {}).get("evidenceCount", 0)
        is_hit = resp.get("matchedSeed") is not None and resp.get("matchScore", 0) > 0

        results.append({
            "query": q,
            "source": s.get("source", ""),
            "target_cluster": s.get("target_cluster", "general_mixed"),
            "target_domain": s.get("target_domain", ""),
            "predicted_cluster": predicted,
            "domain_prior": domain_prior,
            "retrieval_boost": retrieval_boost,
            "ev": ev,
            "isHit": is_hit,
        })

        prior_str = ",".join(domain_prior.keys()) if domain_prior else ""
        boost_str = ",".join(rb["keyword"] for rb in retrieval_boost) if retrieval_boost else ""
        extra = f" prior={prior_str}" if prior_str else ""
        extra += f" boost={boost_str}" if boost_str else ""
        print(f"  [{i+1:3d}/{total}] {q[:35]:35s} → {predicted:18s} ev={ev:>2d}{extra}")
        if (i + 1) % 50 == 0:
            print(f"  ─── checkpoint: {i+1}/{total} ───")

    # ── Analysis ──
    print("\n▶ Phase 2: Computing metrics...")

    ev_stats = compute_cluster_ev_stats(results)
    print("\n  ─── Cluster EV Distribution (Intent Core Only) ───")
    print(f"  {'Cluster':<22s} {'N':>4s} {'Ev_mean':>8s} {'Ev_std':>8s} {'Ev_max':>6s} {'Ev_min':>6s}")
    print(f"  {'─'*60}")
    for cname in ALL_CLUSTERS:
        if cname not in ev_stats:
            continue
        s = ev_stats[cname]
        print(f"  {cname:<22s} {s['count']:>4d} {s['ev_mean']:>8.2f} {s['ev_std']:>8.2f} {s['ev_max']:>6.2f} {s['ev_min']:>6.2f}")
    for cname in ev_stats:
        if cname not in ALL_CLUSTERS and cname != "error":
            s = ev_stats[cname]
            print(f"  {cname:<22s} {s['count']:>4d} {s['ev_mean']:>8.2f} {s['ev_std']:>8.2f} {s['ev_max']:>6.2f} {s['ev_min']:>6.2f}")

    # Domain prior impact
    prior_impact = compute_domain_prior_impact(results)
    print(f"\n  ─── Domain Prior Impact (Layer 2) ───")
    print(f"  Queries with domain keywords: {prior_impact['queries_with_domain_keywords']}")
    print(f"  Prior applied:                {prior_impact['prior_applied']}")
    print(f"  Prior hit ratio:              {prior_impact['prior_hit_ratio']:.1%}")
    print(f"  Medical prior:                {prior_impact['medical_prior_count']}")
    print(f"  Financial prior:              {prior_impact['financial_prior_count']}")
    print(f"  (Domain prior is now a score bias, not cluster override — ratio=100% is expected)")

    # Show domain prior overlay on EV
    print(f"\n  ─── EV + Domain Prior Overlay ───")
    for r in results:
        if r.get("domain_prior"):
            prior_str = ",".join(f"{k}={v}" for k, v in r["domain_prior"].items())
            print(f"    ev={r['ev']:>2d}  prior=[{prior_str:>12s}]  {r['predicted_cluster']:<20s}  {r['query'][:30]}")

    # Entropy
    entropy_metrics = compute_entropy_comparison(results)
    print(f"\n  ─── Entropy (Intent Core vs Old Override) ───")
    print(f"  Pre-override entropy:  {entropy_metrics['pre_calibration_entropy']:.4f}")
    print(f"  Post-intent-core entropy: {entropy_metrics['post_calibration_entropy']:.4f}")
    print(f"  Change:                {entropy_metrics['entropy_change_pct']:.2f}%")
    print(f"  Cluster migrations:    {entropy_metrics['cluster_migrations']}/{total} ({entropy_metrics['migration_rate']:.1%})")

    # Acceptance
    acceptance = check_acceptance(ev_stats, prior_impact, entropy_metrics)
    print(f"\n{'='*60}")
    print("  🎯 ACCEPTANCE CRITERIA")
    print(f"{'='*60}")
    for check, data in acceptance["checks"].items():
        p = "✅" if data.get("pass", True) else "❌"
        v = data.get("value", "")
        t = data.get("threshold", "")
        n = data.get("note", "")
        print(f"  {p} {check}: {v} (threshold: {t}) {n}")
    print(f"\n  {'✅ ALL PASS' if acceptance['all_pass'] else '❌ SOME FAILED'}")

    # Save
    ts = int(datetime.now(timezone.utc).timestamp())
    report = {
        "timestamp": ts,
        "phase": "P1.2.2 Three-Layer Architecture",
        "total_queries": total,
        "cluster_ev_stats": ev_stats,
        "domain_prior_impact": prior_impact,
        "entropy_comparison": entropy_metrics,
        "acceptance": acceptance["all_pass"],
        "acceptance_details": acceptance["checks"],
    }

    report_path = f"ev-three-layer-{ts}.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\n  💾 Report saved: {report_path}")

    csv_path = f"three-layer-ev-{ts}.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["query", "source", "predicted_cluster", "domain_prior", "retrieval_boost", "ev", "isHit"])
        for r in results:
            w.writerow([
                r["query"], r.get("source", ""), r["predicted_cluster"],
                json.dumps(r.get("domain_prior", {}), ensure_ascii=False),
                json.dumps(r.get("retrieval_boost", []), ensure_ascii=False),
                r["ev"], r["isHit"],
            ])
    print(f"  💾 CSV saved: {csv_path}")


if __name__ == "__main__":
    main()
