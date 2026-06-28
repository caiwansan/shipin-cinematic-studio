#!/usr/bin/env python3
"""
stress-run.py — AG-V1.2 Distribution Stress Test (300条)

用法:
  python3 stress-run.py            # 全量300条
  python3 stress-run.py --resume   # 续跑

输出:
  /root/shipin-cinematic-studio/backend/stress-test-report.json
  /root/shipin-cinematic-studio/backend/stress-test-leakage.csv
"""

import json, os, sys, time, urllib.request, urllib.error, csv
from collections import defaultdict

GATEWAY = "http://127.0.0.1:4002/api/p0/gateway"
TOTAL = 300
CHECKPOINT = "/tmp/ag-v1-stress-checkpoint.json"
RESULTS_FILE = "/tmp/ag-v1-stress-results.json"
REPORT_FILE = os.path.expanduser("~/shipin-cinematic-studio/backend/stress-test-report.json")
LEAKAGE_FILE = os.path.expanduser("~/shipin-cinematic-studio/backend/stress-test-leakage.csv")

# Load queries from JSON
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(SCRIPT_DIR, "stress-queries.json")) as f:
    data = json.load(f)

STRESS_QUERIES = data["queries"]
STRESS_INTENTS = data["intents"]
STRESS_DOMAINS = data["domains"]

assert len(STRESS_QUERIES) == TOTAL, f"Expected {TOTAL}, got {len(STRESS_QUERIES)}"
print(f"Dataset loaded: {len(STRESS_QUERIES)} queries")
dist = defaultdict(int)
for i in STRESS_INTENTS: dist[i] += 1
print(f"Distribution: {dict(dist)}")


def call_gateway(query: str, timeout: int = 30) -> dict:
    data = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(GATEWAY, data=data, headers={"Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {"error": str(e), "_pipeline": {}, "_explanation": {}, "_reasoning": {}, "metrics": {}}


def parse_result(raw: dict) -> dict:
    p = raw.get("_pipeline", {})
    ex = raw.get("_explanation", {})
    rs = raw.get("_reasoning", {})
    return {
        "evidenceCount": p.get("evidenceCount", 0),
        "clusterCount": p.get("clusterCount", 0),
        "dominanceScore": rs.get("primaryScore", 0),
        "confidenceLabel": ex.get("confidenceLabel", "low"),
        "coverageGap": bool(p.get("coverageGap", False)),
        "budgetExhausted": bool(p.get("budgetExhausted", False)),
        "coverageConfidence": p.get("coverageConfidence", 0),
        "durationMs": p.get("durationMs", 0),
        "timeout": False,
        "error": raw.get("error"),
    }


def print_snapshot(results: list, total: int, elapsed: int):
    valid = [r for r in results if not r.get("timeout") and not r.get("error")]
    nv = len(valid)
    if nv == 0:
        print(f"  [snap] 0 valid / {len(results)} total")
        return
    avg_ev = sum(r.get("evidenceCount", 0) for r in valid) / nv
    avg_cl = sum(r.get("clusterCount", 0) for r in valid) / nv
    gap = sum(1 for r in valid if r.get("coverageGap")) / nv
    hi_conf = sum(1 for r in valid if r.get("confidenceLabel") in ("high","medium")) / nv
    cl_le2 = sum(1 for r in valid if r.get("clusterCount", 5) <= 2) / nv
    intent_map = defaultdict(list)
    for r in valid:
        intent_map[r.get("expectedIntent","?")].append(r)
    parts = []
    for intent, cases in sorted(intent_map.items()):
        n = len(cases)
        ev = sum(c.get("evidenceCount",0) for c in cases) / n
        parts.append(f"{intent}:{n} ev={ev:.1f}")
    print(f"  [snap] {len(results)}/{total} | {elapsed}s | evAvg={avg_ev:.1f} purity={cl_le2*100:.0f}% gap={gap*100:.0f}% hiConf={hi_conf*100:.0f}%")
    print(f"  [intent] {' | '.join(parts)}")


def compute_summary(results: list) -> dict:
    valid = [r for r in results if not r.get("timeout") and not r.get("error")]
    nv = len(valid)
    if nv == 0:
        return {"intentAccuracy": 0, "avgEvidenceCount": 0}
    avg_ev = sum(r.get("evidenceCount",0) for r in valid) / nv
    avg_cl = sum(r.get("clusterCount",0) for r in valid) / nv
    cov_gap = sum(1 for r in valid if r.get("coverageGap")) / nv
    budget_ex = sum(1 for r in valid if r.get("budgetExhausted")) / nv
    hi_conf = sum(1 for r in valid if r.get("confidenceLabel") in ("high","medium")) / nv
    cl_le2 = sum(1 for r in valid if r.get("clusterCount",5) <= 2) / nv
    avg_cov_conf = sum(r.get("coverageConfidence",0) for r in valid) / nv
    avg_dom = sum(r.get("dominanceScore",0) for r in valid) / nv

    intent_stats = {}
    for intent in sorted(set(STRESS_INTENTS)):
        cases = [r for r in valid if r.get("expectedIntent") == intent]
        if not cases: continue
        intent_stats[intent] = {
            "count": len(cases),
            "avgEvidenceCount": round(sum(c.get("evidenceCount",0) for c in cases) / len(cases), 2),
            "coverageGapRate": round(sum(1 for c in cases if c.get("coverageGap")) / len(cases), 4),
            "highConfRate": round(sum(1 for c in cases if c.get("confidenceLabel") in ("high","medium")) / len(cases), 4),
        }

    return {
        "totalCases": len(results),
        "validCases": nv,
        "avgEvidenceCount": round(avg_ev, 2),
        "avgClusterCount": round(avg_cl, 1),
        "clusterPurity": round(cl_le2, 4),
        "coverageGapRate": round(cov_gap, 4),
        "budgetExhaustionRate": round(budget_ex, 4),
        "highConfidenceRate": round(hi_conf, 4),
        "avgCoverageConfidence": round(avg_cov_conf, 4),
        "avgDominanceScore": round(avg_dom, 4),
        "intentBreakdown": intent_stats,
    }


def generate_leakage_csv(results: list):
    rows = []
    for i, r in enumerate(results):
        rows.append({
            "index": i,
            "query": STRESS_QUERIES[i] if i < len(STRESS_QUERIES) else "?",
            "intent": r.get("expectedIntent", "?"),
            "domain": r.get("expectedDomain", "?"),
            "evidenceCount": r.get("evidenceCount", 0),
            "clusterCount": r.get("clusterCount", 0),
            "coverageGap": r.get("coverageGap", False),
            "confidenceLabel": r.get("confidenceLabel", "low"),
            "error": str(r.get("error", "")),
        })
    with open(LEAKAGE_FILE, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=rows[0].keys())
        w.writeheader()
        w.writerows(rows)
    print(f"  [CSV] -> {LEAKAGE_FILE}")


def main():
    # Wrap entire run in try/except to survive crashes
    while True:
        try:
            _run()
            break  # completed successfully
        except SystemExit:
            break
        except Exception as e:
            print(f"[FATAL] crashed: {type(e).__name__}: {e}", file=sys.stderr)
            # Try resume on next loop
            continue

def _run():
    # disable buffering
    sys.stdout.reconfigure(line_buffering=True)
    sys.stderr.reconfigure(line_buffering=True)
    resume = "--resume" in sys.argv
    last_completed = 0
    results = []

    if resume and os.path.exists(CHECKPOINT):
        with open(CHECKPOINT) as f:
            cp = json.load(f)
        last_completed = cp.get("lastCompleted", 0)
        print(f"Mode: resume (completed {last_completed}/{TOTAL})")
        if os.path.exists(RESULTS_FILE) and last_completed > 0:
            with open(RESULTS_FILE) as f:
                results = json.load(f)
            print(f"Loaded {len(results)} results")
    else:
        print(f"Mode: full Stress Test ({TOTAL} queries)")

    start_time = int(time.time())

    for i in range(TOTAL):
        if i < last_completed:
            continue

        sys.stdout.flush()
        sys.stderr.flush()

        query = STRESS_QUERIES[i]
        t0 = time.time()
        raw = call_gateway(query)
        ms = int((time.time() - t0) * 1000)

        r = parse_result(raw)
        r["expectedIntent"] = STRESS_INTENTS[i]
        r["expectedDomain"] = STRESS_DOMAINS[i]
        results.append(r)

        # 每10条写一次checkpoint减少I/O
        if (i + 1) % 10 == 0 or i == TOTAL - 1:
            with open(CHECKPOINT, "w") as f:
                json.dump({"lastCompleted": i+1, "results": results, "startTime": start_time}, f)
            with open(RESULTS_FILE, "w") as f:
                json.dump(results, f)

        out = f"  #{i+1}/{TOTAL} | ev={r['evidenceCount']} cl={r['clusterCount']} gap={r['coverageGap']} dur={ms}ms conf={r['confidenceLabel']} [{STRESS_INTENTS[i]}]"
        print(out)

        idx = i + 1
        if idx % 20 == 0 or idx == TOTAL:
            elapsed = int(time.time()) - start_time
            print(f"\n  === {idx}/{TOTAL} ({elapsed}s) ===")
            print_snapshot(results, TOTAL, elapsed)
            print()

    print("\nAll done! Generating report...")
    summary = compute_summary(results)
    report = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "totalCases": len(results),
        "validCases": len([r for r in results if not r.get("timeout") and not r.get("error")]),
        "timeoutCount": sum(1 for r in results if r.get("timeout")),
        "errorCount": sum(1 for r in results if r.get("error")),
        "summary": summary,
        "results": results,
    }

    os.makedirs(os.path.dirname(REPORT_FILE), exist_ok=True)
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    generate_leakage_csv(results)

    total_time = int(time.time()) - start_time
    print(f"\n=== Final Stress Test Report ===")
    print(f"Total time: {total_time}s")
    print(f"Report: {REPORT_FILE}")
    print(f"Leakage heatmap: {LEAKAGE_FILE}")
    print(json.dumps(summary, indent=2))
    try: os.remove(CHECKPOINT)
    except: pass


if __name__ == "__main__":
    main()
