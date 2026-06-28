# PROMPT-EFFECTIVENESS-VALIDATION.md
## A/B Test Results

### Test Configuration
- **Provider**: Volcengine doubao-seedance-1-5-pro-251215
- **Test User**: 慧娟 (enterprise tier)
- **Duration**: 5 seconds
- **Ratio**: 9:16

---

## Sample 1: 对话开场

### Prompt A (Legacy) — 229 chars
Only narrative + dialogue + effects
```
🎬 https://ark-content-generation-cn-beijing.tos-cn-beijing.volces.com/doubao-seedance-1-5-pro/02178230985254800000000000000000000ffffac1915c459558b.mp4
```

### Prompt B (Enhanced) — 887 chars (+287%)
+ [角色约束] + [场景约束] + [镜头语言] + 逐秒镜头脚本
```
🎬 https://ark-content-generation-cn-beijing.tos-cn-beijing.volces.com/doubao-seedance-1-5-pro/02178230991319900000000000000000000ffffac14d0d9a7715b.mp4
```

---

## Sample 2: 情绪转折

### Prompt A (Legacy)
Only narrative + dialogue + effects
```
🎬 https://ark-content-generation-cn-beijing.tos-cn-beijing.volces.com/doubao-seedance-1-5-pro/02178230988868900000000000000000000ffffac18096bfda0ab.mp4
```

### Prompt B (Enhanced)
+ [角色约束] + [场景约束] + [镜头语言]
```
🎬 https://ark-content-generation-cn-beijing.tos-cn-beijing.volces.com/doubao-seedance-1-5-pro/02178230981140000000000000000000000ffffac158f8edb4b25.mp4
```

---

## Scoring Matrix

| Criterion | A-Legacy | B-Enhanced | Delta | Weight |
|-----------|:--------:|:----------:|:-----:|:------:|
| Character Consistency | /10 | /10 | ± | 25% |
| Scene Consistency | /10 | /10 | ± | 25% |
| Camera Compliance | /10 | /10 | ± | 20% |
| Emotion Accuracy | /10 | /10 | ± | 15% |
| Narrative Fidelity | /10 | /10 | ± | 15% |
| **Weighted Score** | **/10** | **/10** | **+%** | **100%** |

### Scoring Scale
- **0-3**: Not present / completely wrong
- **4-6**: Partially present / some errors
- **7-8**: Mostly correct / minor issues
- **9-10**: Perfect / indistinguishable from human filmmaking

---

## Expected Outcome

Based on the retention improvement:
- A-Legacy estimated: **~4.8/10**
- B-Enhanced estimated: **~7.4/10**
- Improvement: **~+54%**

---

## Video Access Notes
- URLs are Volcengine TOS (temporary) — expire in 24 hours
- All use same model/provider/seed for fair comparison
- The B prompt added 658+ chars of structured constraints to the same narrative base
