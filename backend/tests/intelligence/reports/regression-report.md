# Intelligence Regression Report

## Summary
- **Domain**: knowledge
- **Regression**: 31/31 PASS
- **Determinism**: 100%
- **Stability Score**: 100%
- **Risk Level**: NONE

## PASS / FAIL Detail

| Object | Status | Quality Score | Quality Label | Recommendation |
|--------|--------|--------------|---------------|----------------|
| high-quality-1 | ✓ PASS | 100 | A | High |
| high-quality-2 | ✓ PASS | 100 | A | High |
| high-quality-3 | ✓ PASS | 100 | A | High |
| high-quality-4 | ✓ PASS | 100 | A | High |
| high-quality-5 | ✓ PASS | 100 | A | High |
| moderate-quality-1 | ✓ PASS | 100 | A | High |
| moderate-quality-2 | ✓ PASS | 100 | A | High |
| moderate-quality-3 | ✓ PASS | 100 | A | High |
| moderate-quality-4 | ✓ PASS | 100 | A | High |
| moderate-quality-5 | ✓ PASS | 100 | A | High |
| low-quality-1 | ✓ PASS | 83.75 | A | High |
| low-quality-2 | ✓ PASS | 83.75 | A | High |
| low-quality-3 | ✓ PASS | 83.75 | A | High |
| low-quality-4 | ✓ PASS | 83.75 | A | High |
| fresh-content-1 | ✓ PASS | 100 | A | High |
| fresh-content-2 | ✓ PASS | 100 | A | High |
| fresh-content-3 | ✓ PASS | 100 | A | High |
| stale-content-1 | ✓ PASS | 95 | A | High |
| stale-content-2 | ✓ PASS | 95 | A | High |
| stale-content-3 | ✓ PASS | 95 | A | High |
| authoritative-1 | ✓ PASS | 100 | A | High |
| authoritative-2 | ✓ PASS | 100 | A | High |
| authoritative-3 | ✓ PASS | 97.5 | A | High |
| contradictory-1 | ✓ PASS | 92.5 | A | Medium |
| contradictory-2 | ✓ PASS | 88.75 | A | Medium |
| contradictory-3 | ✓ PASS | 83.75 | A | High |
| no-coverage-1 | ✓ PASS | 96.25 | A | High |
| no-coverage-2 | ✓ PASS | 93.75 | A | High |
| edge-empty-content | ✓ PASS | 91.25 | A | High |
| edge-very-long-content | ✓ PASS | 100 | A | High |
| unknown-freshness | ✓ PASS | 93.75 | A | High |


## Rule Coverage

| Rule ID | Triggered | Not Triggered | Coverage % |
|---------|-----------|---------------|------------|
| KR-COVERAGE-001 | 31 | 0 | 100% |
| KR-FRESHNESS-001 | 30 | 1 | 97% |
| KR-FRESHNESS-002 | 1 | 30 | 3% |
| KR-CITATION-001 | 31 | 0 | 100% |
| KR-CITATION-002 | 31 | 0 | 100% |
| KR-AUTHORITY-001 | 31 | 0 | 100% |
| KR-CONSISTENCY-001 | 31 | 0 | 100% |


## Score Diff (vs v1.0 expectation)

| Object | Before | After | Delta | Risk |
|--------|--------|-------|-------|------|
| high-quality-1 | 100 | 100 | 0 | None |
| high-quality-2 | 100 | 100 | 0 | None |
| high-quality-3 | 100 | 100 | 0 | None |
| high-quality-4 | 100 | 100 | 0 | None |
| high-quality-5 | 100 | 100 | 0 | None |
| moderate-quality-1 | 100 | 100 | 0 | None |
| moderate-quality-2 | 100 | 100 | 0 | None |
| moderate-quality-3 | 100 | 100 | 0 | None |
| moderate-quality-4 | 100 | 100 | 0 | None |
| moderate-quality-5 | 100 | 100 | 0 | None |
| low-quality-1 | 83.75 | 83.75 | 0 | None |
| low-quality-2 | 83.75 | 83.75 | 0 | None |
| low-quality-3 | 83.75 | 83.75 | 0 | None |
| low-quality-4 | 83.75 | 83.75 | 0 | None |
| fresh-content-1 | 100 | 100 | 0 | None |
| fresh-content-2 | 100 | 100 | 0 | None |
| fresh-content-3 | 100 | 100 | 0 | None |
| stale-content-1 | 95 | 95 | 0 | None |
| stale-content-2 | 95 | 95 | 0 | None |
| stale-content-3 | 95 | 95 | 0 | None |
| authoritative-1 | 100 | 100 | 0 | None |
| authoritative-2 | 100 | 100 | 0 | None |
| authoritative-3 | 97.5 | 97.5 | 0 | None |
| contradictory-1 | 92.5 | 92.5 | 0 | None |
| contradictory-2 | 88.75 | 88.75 | 0 | None |
| contradictory-3 | 83.75 | 83.75 | 0 | None |
| no-coverage-1 | 96.25 | 96.25 | 0 | None |
| no-coverage-2 | 93.75 | 93.75 | 0 | None |
| edge-empty-content | 91.25 | 91.25 | 0 | None |
| edge-very-long-content | 100 | 100 | 0 | None |
| unknown-freshness | 93.75 | 93.75 | 0 | None |


## Recommendation Diff

| Object | Before | After | Change |
|--------|--------|-------|--------|
| _(no changes)_ | — | — | — |


## Triggered Rule Matrix

Rows = Objects, Columns = Rules. ✓ = triggered, ─ = not triggered.

| Object | COV | FRESH | FRESH2 | CITE1 | CITE2 | AUTH | CONS |
|--------|---|---|---|---|---|---|---|
| high-quality-1 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| high-quality-2 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| high-quality-3 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| high-quality-4 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| high-quality-5 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| moderate-quality-1 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| moderate-quality-2 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| moderate-quality-3 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| moderate-quality-4 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| moderate-quality-5 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| low-quality-1 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| low-quality-2 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| low-quality-3 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| low-quality-4 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| fresh-content-1 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| fresh-content-2 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| fresh-content-3 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| stale-content-1 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| stale-content-2 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| stale-content-3 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| authoritative-1 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| authoritative-2 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| authoritative-3 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| contradictory-1 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| contradictory-2 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| contradictory-3 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| no-coverage-1 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| no-coverage-2 | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| edge-empty-content | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| edge-very-long-content | ✓ | ✓ | ─ | ✓ | ✓ | ✓ | ✓ |
| unknown-freshness | ✓ | ─ | ✓ | ✓ | ✓ | ✓ | ✓ |


## Architecture Impact
- **新增平台能力**: Intelligence Test Platform v1.0
- **可复用模块**: regression-suite, determinism-check, snapshot-manager, diff-engine, report-generator
- **后续可复用引擎**: Discovery, Packaging, Distribution, Observation, Adaptive
- **是否改变平台架构**: 是（新增平台级验证能力）
- **是否新增工程规范**: 是（IRG — Intelligence Regression Gate）

## IRG Checklist
- [x] Golden Replay: 31/31 PASS
- [x] Determinism: 100% PASS
- [x] Rule Coverage: 每条 Rule 有覆盖
- [x] Score Diff: 可解释
- [x] Recommendation Diff: 可解释
- [x] Stability Score: 100% ≥ 95%

---

*Generated: 2026-07-05T10:53:13.434Z*
*Engine: KnowledgeIntelligenceEngine v1.0*
