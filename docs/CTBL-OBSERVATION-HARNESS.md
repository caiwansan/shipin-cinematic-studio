# CTBL Observation Harness

## Purpose
Monitor CTBL stability in production before layering CSIP.

## Metrics

### 1. Generation Success Rate (GSR)
`successful_generations / total_requests`

### 2. Constraint Satisfaction Rate (CSR)
Random sample of generated videos → check if CTBL section is obeyed (human evaluation)

### 3. Temporal Drift Index (TDI)
Per-shot comparison: does state drift from what CTBL specified?

### 4. Failure Classification
| Failure Type | Symptom | Detection |
|-------------|---------|-----------|
| Rejection | Model returns error | `task.error` contains rejection |
| Truncation | Prompt cut off | Log analysis of request body |
| Hallucinated continuity | Fake temporal links | Human evaluation |

## Monitoring Setup

### Log-Based Monitoring
```bash
# Check CTBL injection in logs
grep "时间连续性约束" /root/.pm2/logs/api-server-aigc-out.log | wc -l

# Check generation failures
grep "error\|failed\|reject" /root/.pm2/logs/api-server-aigc-error.log | tail -20

# Track GSR
tail -f /root/.pm2/logs/api-server-aigc-out.log | grep --line-buffered "completed\|failed"
```

### Database-Based Monitoring
```sql
-- Generation success rate by date
SELECT DATE(createdAt), status, COUNT(*)
FROM VideoTask
WHERE createdAt > NOW() - INTERVAL '7 days'
GROUP BY DATE(createdAt), status;

-- Tasks with CTBL payload (check error field contains section marker)
SELECT COUNT(*) FROM VideoTask
WHERE error LIKE '%时间连续性约束%';
```

## A/B Test Script
```bash
# Run CTBL ON vs OFF comparison
# Modify: set input.storyboard to empty to disable CTBL
# Monitor: compare GSR and TCS between ON/OFF groups
```

## Decision Gate
After 3-7 days:
- If GSR > 95% AND no CTBL-specific failures → safe to consider CSIP
- If GSR < 90% OR CTBL-specific failures detected → analyze failure modes first
- If GSR < 80% → rollback CTBL, diagnose
