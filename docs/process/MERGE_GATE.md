# Merge Gate Checklist

## Overview
The Merge Gate ensures all contributions pass architecture compliance checks before merging. This is a mandatory step for any P0 architecture changes.

## Mandatory（必须通过）
- [ ] Build passes (0 error)
- [ ] TypeScript type check passes (0 error)
- [ ] No new P0 Technical Debt
- [ ] ADR updated (if architecture change)
- [ ] Runtime boundary compliance — all Runtimes conform to RuntimeLifecycle
- [ ] Repository pattern compliance — no direct Prisma access from services
- [ ] Platform context compliance — all Runtime methods use PlatformContext
- [ ] Event model compliance — all events use PlatformEvent via IEventBus
- [ ] Error model compliance — all throws use PlatformError subclasses
- [ ] Plugin registry compliance — no switch/case dispatch in core Runtimes

## Recommend（建议通过）
- [ ] Dependency matrix no new violations
- [ ] Freeze checklist all green
- [ ] Architecture Health Dashboard updated
- [ ] TypeScript strict mode passes
- [ ] Unit tests for all new Runtime lifecycle methods

## Process
1. Run `npm run build && npm run typecheck`
2. Review against this checklist
3. Get architecture review (if P0 change)
4. Run compliance audit scripts
5. Update Architecture Health Dashboard
6. Merge

## Compliance Audit Scripts

```bash
# Check for private Context definitions
grep -rn "interface.*Context" backend/src/services/ --include="*.ts" | grep -v "PlatformContext\|platform-context" | grep -v "__tests__"

# Check for new EventEmitter
grep -rn "new EventEmitter" backend/src/services/ --include="*.ts"

# Check for bare throws
grep -rn "throw new Error(" backend/src/services/ --include="*.ts" | grep -v test | grep -v "__tests__" | grep -v "PlatformError"

# Check for switch dispatch in core Runtimes
grep -rn "switch\|case " backend/src/services/goal/planner/ --include="*.ts" | grep -v test
grep -rn "switch\|case " backend/src/services/platform/capability/resolver/ --include="*.ts" | grep -v test
```

## Exceptions
- Non-Runtime services (image pipeline, provider integrations) may retain legacy patterns
- Third-party integrations are exempt from error model compliance
- All exemptions must be documented in TECH_DEBT/
