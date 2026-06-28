#!/usr/bin/env python3
"""
P0.9 Re-baseline Runner — BASELINE V2
200 query | 4 domains × 50 | driven from baseline-queries.json
"""

import json, time, urllib.request, urllib.error, sys, os

GATEWAY = "http://127.0.0.1:4002/api/p0/gateway"
TIMEOUT = 25

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(SCRIPT_DIR, "baseline-queries.json")) as f:
    ALL_QUERIES = json.load(f)

DOMAIN_MARKS = ['local']*50 + ['enterprise']*50 + ['product']*50 + ['general']*50

assert len(ALL_QUERIES) == 200, f"Expected 200 queries, got {len(ALL_QUERIES)}"
assert len(DOMAIN_MARKS) == 200, f"Expected 200 marks, got {len(DOMAIN_MARKS)}"

def call_gateway(q):
    try:
        body = json.dumps({"query": q}).encode()
        req = urllib.request.Request(GATEWAY, data=body,
            headers={"Content-Type": "application/json"},
            method="POST")
        resp = urllib.request.urlopen(req, timeout=TIMEOUT)
        return json.loads(resp.read().decode())
    except Exception as e:
        return {"_error": str(e)}

print("=" * 70)
print("  P0.9 — BASELINE V2 (Post-Domain-Stabilization)")
print("  200 queries | 4 domains x 50")
print("  旧 baseline 已失效 — 此为新测量基准")
print("=" * 70)

results = []
start_ts = time.time()

for idx, q in enumerate(ALL_QUERIES):
    raw = call_gateway(q)
    pipe = raw.get('_pipeline', {})
    error_detail = raw.get('_error', '')

    # 重试一次
    if error_detail:
        time.sleep(1)
        raw2 = call_gateway(q)
        if not raw2.get('_error'):
            raw = raw2
            pipe = raw.get('_pipeline', {})
            error_detail = ''

    results.append({
        'idx': idx,
        'query': q,
        'expectedDomain': DOMAIN_MARKS[idx],
        'matchedSeed': raw.get('matchedSeed'),
        'matchLevel': raw.get('matchLevel', 'none'),
        'matchScore': round(raw.get('matchScore', 0) or 0, 3),
        'evidenceCount': pipe.get('evidenceCount', 0),
        'coverageGap': pipe.get('coverageGap', True) if not error_detail else True,
        'error': error_detail,
    })

    if (idx + 1) % 10 == 0:
        elapsed = time.time() - start_ts
        rate = (idx + 1) / elapsed if elapsed > 0 else 0
        gap_pct = sum(1 for r in results if r['coverageGap']) * 100 // (idx + 1)
        ev_avg = sum(r['evidenceCount'] for r in results) / (idx + 1)
        remaining = 200 - idx - 1
        eta_m = remaining / rate / 60 if rate > 0 else 0
        errs = sum(1 for r in results if r['error'])
        sys.stdout.write(f"\r  [{idx+1}/200] ev={ev_avg:.1f} gap={gap_pct}% err={errs} rate={rate:.1f}q/s eta={eta_m:.0f}m")
        sys.stdout.flush()

    time.sleep(0.15)

print()
total_time = time.time() - start_ts
print(f"\n  完成: 200/200 | {total_time:.0f}s")

# ===== REPORT =====
print(f"\n{'=' * 70}")
print(f"  BASELINE V2 REPORT")
print(f"  post-domain-stabilization")
print(f"{'=' * 70}")

n = len(results)
global_gap = sum(1 for r in results if r['coverageGap'])
global_ev = sum(r['evidenceCount'] for r in results) / n
global_zero = sum(1 for r in results if r['evidenceCount'] == 0)
global_seed = sum(1 for r in results if r['matchedSeed'] and r['matchedSeed'] != 'fallback')
global_err = sum(1 for r in results if r['error'])

print(f"\n  GLOBAL")
print(f"  {'avgEvidence':20s}: {global_ev:.1f}")
print(f"  {'zeroEvidence%':20s}: {global_zero * 100 // n}%")
print(f"  {'coverageGap%':20s}: {global_gap * 100 // n}%")
print(f"  {'seedHit%':20s}: {global_seed * 100 // n}%")
print(f"  {'error%':20s}: {global_err * 100 // n}%")

print(f"\n  PER-DOMAIN (n=50 each)")
print(f"  {'Domain':15s} {'EvAvg':7s} {'Zero%':7s} {'Gap%':7s} {'Seed%':7s} {'Err%':7s}")
print(f"  {'-'*59}")
for d in ['local','enterprise','product','general']:
    items = [r for r in results if r['expectedDomain'] == d]
    n_d = len(items)
    ev = sum(r['evidenceCount'] for r in items) / max(n_d, 1)
    zero = sum(1 for r in items if r['evidenceCount'] == 0) * 100 // max(n_d, 1)
    gap = sum(1 for r in items if r['coverageGap']) * 100 // max(n_d, 1)
    seed = sum(1 for r in items if r['matchedSeed'] and r['matchedSeed'] != 'fallback') * 100 // max(n_d, 1)
    err = sum(1 for r in items if r['error']) * 100 // max(n_d, 1)
    print(f"  {d:15s} {ev:7.1f} {zero:7d}% {gap:7d}% {seed:7d}% {err:7d}%")

print(f"\n  SEED HIT DISTRIBUTION")
seed_counts = {}
for r in results:
    s = r['matchedSeed']
    if s and s != 'fallback':
        seed_counts[s] = seed_counts.get(s, 0) + 1
for s, c in sorted(seed_counts.items(), key=lambda x: -x[1]):
    pct = c * 100 // n
    print(f"  {s:45s}: {c:3d}次 ({pct}%)")

print(f"\n  MATCH LEVEL DISTRIBUTION")
for level in ['strong', 'acceptable', 'weak', 'none']:
    cnt = sum(1 for r in results if r['matchLevel'] == level)
    print(f"  {level:15s}: {cnt:3d}条 ({cnt*100//n}%)")

print(f"\n  ROUTING PURITY (per-domain seed alignment)")
for d in ['local','enterprise','product','general']:
    items = [r for r in results if r['expectedDomain'] == d]
    d_hits = {}
    for r in items:
        s = r['matchedSeed']
        if s and s != 'fallback':
            d_hits[s] = d_hits.get(s, 0) + 1
    top3 = sorted(d_hits.items(), key=lambda x: -x[1])[:3]
    if top3:
        seeds_str = ' | '.join(f"{s}({c})" for s, c in top3)
        print(f"  {d:15s}: {seeds_str}")

print(f"\n{'=' * 70}")
print(f"  NOTICE: METRIC DISCONTINUITY")
print(f"  此 BASELINE V2 之前的所有 benchmark 数据均已作废")
print(f"  V2 = post-domain-stabilization 首版可信测量基准")
print(f"{'=' * 70}")

# Save
ts = int(time.time())
report_path = os.path.join(SCRIPT_DIR, f"baseline-v2-{ts}.json")
saved = {
    'timestamp': ts,
    'type': 'BASELINE_V2',
    'totalQueries': n,
    'errors': global_err,
    'global': {
        'avgEvidence': round(global_ev, 2),
        'zeroEvidencePct': round(global_zero * 100 / n, 1),
        'coverageGapPct': round(global_gap * 100 / n, 1),
        'seedHitPct': round(global_seed * 100 / n, 1),
    },
    'perDomain': {},
    'seedHits': seed_counts,
    'matchLevelDist': {l: sum(1 for r in results if r['matchLevel'] == l) for l in ['strong','acceptable','weak','none']},
}
for d in ['local','enterprise','product','general']:
    items = [r for r in results if r['expectedDomain'] == d]
    saved['perDomain'][d] = {
        'avgEvidence': round(sum(r['evidenceCount'] for r in items) / 50, 2),
        'zeroEvidencePct': round(sum(1 for r in items if r['evidenceCount']==0) * 100 / 50, 1),
        'coverageGapPct': round(sum(1 for r in items if r['coverageGap']) * 100 / 50, 1),
        'seedHitPct': round(sum(1 for r in items if r['matchedSeed'] and r['matchedSeed']!='fallback') * 100 / 50, 1),
    }

with open(report_path, 'w') as f:
    json.dump(saved, f, ensure_ascii=False, indent=2)
print(f"\n  报告已保存: {report_path}")
print(f"  文件大小: {os.path.getsize(report_path)} bytes")
