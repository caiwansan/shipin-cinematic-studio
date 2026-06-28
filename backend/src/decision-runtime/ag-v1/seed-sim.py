#!/usr/bin/env python3
"""seed-sim.py — Seed Simulation: 模拟新 seed 对 gap queries 的命中率"""

import json, re

# ====== 加载 raw results ======
raw = json.load(open("/tmp/ag-v1-raw-results.json"))
gaps = [r for r in raw if r.get("coverageGap")]

# ====== 定义新 seed 的 queryPatterns 匹配规则 ======
# 用正则模拟 slot filling
NEW_SEEDS = [
    {
        "id": "local_food_recommendation",
        "domain": "local",
        "patterns": [
            r"(.+)有什么好吃的(.+)",
            r"(.+)推荐餐厅",
            r"(.+)必吃美食",
            r"(.+)哪里吃(.+)比较划算",
            r"(.+)附近有什么好吃的",
            r"(.+)哪家最正宗",
            r"(.+)推荐$",
            r"(.+)夜市必吃",
            r"(.+)好吃的(.+)推荐",
            r"(.+)哪里吃(.+)",
            r"(.+)值得吃吗",
            r"(.+)附近的美食",
            r"(.+)哪家(.+)最好",
            r"(.+)哪家(.+)好吃",
        ],
        "expected_gap_clusters": ["local_food_recommendation"],
    },
    {
        "id": "local_travel_attraction",
        "domain": "local",
        "patterns": [
            r"(.+)旅游景点",
            r"(.+)有什么好玩的",
            r"(.+)必去景点",
            r"(.+)攻略$",
            r"(.+)门票",
            r"(.+)最佳路线",
            r"(.+)值得去吗",
            r"(.+)骑行路线",
            r"(.+)漂流$",
        ],
        "expected_gap_clusters": ["local_travel_attraction"],
    },
    {
        "id": "local_travel_accommodation",
        "domain": "local",
        "patterns": [
            r"(.+)住宿推荐",
            r"(.+)住宿哪里好",
            r"(.+)民宿推荐",
            r"(.+)旅游多少钱",
            r"(.+)自由行攻略",
            r"(.+)签证",
            r"旅游保险",
            r"出国旅游",
            r"(.+)海滩",
            r"高原反应",
        ],
        "expected_gap_clusters": ["local_travel_accommodation"],
    },
    {
        "id": "local_service_recommendation",
        "domain": "local",
        "patterns": [
            r"(.+)哪家(.+)比较好",
            r"(.+)哪个(.+)好",
            r"(.+)推荐(.+)$",
            r"(.+)排名",
        ],
        "expected_gap_clusters": ["local_service_recommendation"],
    },
    {
        "id": "general_concept_explain",
        "domain": "general",
        "patterns": [
            r"什么是(.+)",
            r"(.+)是什么意思",
            r"(.+)是(.+)",
            r"什么是(.+)和(.+)的区别",
            r"(.+)和(.+)有什么区别",
            r"(.+)怎么算",
            r"(.+)怎么用",
            r"(.+)条件",
            r"(.+)有什么影响",
            r"(.+)走势",
            r"(.+)流程",
            r"(.+)注意事项",
        ],
        "expected_gap_clusters": ["general_concept_explain"],
    },
]

# ====== Simulation ======

sim = {}  # seed_id -> matched_queries
for seed in NEW_SEEDS:
    sim[seed["id"]] = {"matched": [], "missed": []}
    for r in gaps:
        q = r.get("query", "")
        domain = r.get("expectedDomain", "")
        if domain != seed["domain"]:
            continue
        matched = False
        for pat in seed["patterns"]:
            if re.search(pat, q):
                matched = True
                break
        if matched:
            sim[seed["id"]]["matched"].append(q)
        else:
            sim[seed["id"]]["missed"].append(q)

# ====== Report ======

print("=" * 65)
print("  Seed Simulation: Gap Query 命中率")
print("=" * 65)

total_gap = len(gaps)
total_matched = 0
total_unique = set()

for seed_id in [s["id"] for s in NEW_SEEDS]:
    m = sim[seed_id]
    matched_count = len(m["matched"])
    total_matched += matched_count
    for q in m["matched"]:
        total_unique.add(q)

    pct = matched_count * 100 / total_gap if total_gap else 0

    # 对比预期
    seed_def = [s for s in NEW_SEEDS if s["id"] == seed_id][0]
    exp_count = sum(
        1 for r in gaps
        for ec in seed_def["expected_gap_clusters"]
        if any(cl in (r.get("query", "") or "") for cl in seed_def["expected_gap_clusters"]) is not False
        and r.get("expectedDomain", "") == seed_def["domain"]
    )

    print(f"\n{'🟢' if pct > 10 else '🔴'} [{seed_id}]")
    print(f"  Domain:       {seed_def['domain']}")
    print(f"  Matched:      {matched_count} / {total_gap} gaps ({pct:.0f}%)")
    for q in m["matched"][:5]:
        print(f"    ✓ {q}")
    if len(m["matched"]) > 5:
        print(f"    ... 还有 {len(m['matched'])-5} 条")
    if m["missed"]:
        print(f"  ❌ 未命中 ({len(m['missed'])}):")
        for q in m["missed"][:3]:
            print(f"    ✗ {q}")

# 汇总
print("\n" + "=" * 65)
print("  汇总")
print("=" * 65)
print(f"  总 gap queries:   {total_gap}")
overlap = sum(1 for q in total_unique if len([s for s in NEW_SEEDS if q in sim[s["id"]]["matched"]]) > 1)
print(f"  去重命中:         {len(total_unique)} ({len(total_unique)*100//total_gap}%)")
print(f"  seed 间重叠:      {overlap}")
print(f"  仍无覆盖:         {total_gap - len(total_unique)} ({ (total_gap - len(total_unique))*100//total_gap }%)")

# 按领域
by_domain = {}
for r in gaps:
    d = r.get("expectedDomain", "unknown")
    by_domain.setdefault(d, {"total": 0, "matched": 0, "unmatched": []})
    by_domain[d]["total"] += 1
    q = r.get("query", "")
    if q in total_unique:
        by_domain[d]["matched"] += 1
    else:
        by_domain[d]["unmatched"].append(q)

print(f"\n  按领域:")
for d in ["local", "enterprise", "product", "general"]:
    if d in by_domain:
        t = by_domain[d]
        pct = t["matched"] * 100 // t["total"]
        print(f"    {d:15s} {t['matched']:3d}/{t['total']:3d} ({pct:2d}%) remaining: {t['total']-t['matched']}")
        if t["unmatched"]:
            for q in t["unmatched"][:5]:
                print(f"      ✗ [{d}] {q}")

print(f"\n  Gap Reduction Estimate: {len(total_unique)}/{total_gap} = {len(total_unique)*100//total_gap}%")
print(f"  当前 gap = 62.5% → 预计降至 {(total_gap-len(total_unique))/200*100:.0f}%" if len(total_unique) else "  无法计算")
