# GEO Engineering Baseline v1.0

**Status**: Canonical
**Established**: 2026-07-04
**Scope**: All GEO Workspace modules (Discovery, Recommendation, Mission, Verification, Knowledge, Publishing, Growth)
**Enforcement**: Any new module must complete all 4 baseline assets before entering development.

## The 4 Assets

Every GEO module must have these 4 documents committed before any code is written:

| # | Asset | Purpose | Template |
|---|-------|---------|----------|
| 1 | **API Contract** | Defines all endpoints, request/response shapes, error codes | `docs/API_CONTRACT.yaml` |
| 2 | **Repository Ownership** | Defines which Repository owns which Domain, consumer rules | `docs/REPOSITORY_OWNERSHIP.md` |
| 3 | **Event Sequence Diagram** | Defines which events the module emits/listens to, naming convention | `docs/EVENT_SEQUENCE_DIAGRAM.md` |
| 4 | **Golden User Journey** | Defines the standard acceptance path + Business Gate + Recovery Gate | `docs/GOLDEN_USER_JOURNEY.md` |

## Rationale

Before GEO Engineering Baseline:

- Each module started with code
- Architecture drifted over time
- Audit found issues late
- Cross-page integration was an afterthought

After GEO Engineering Baseline:

- Each module starts with a contract
- Architecture is agreed before implementation
- Audit is a formality, not a discovery
- Cross-page integration is designed upfront

## Adoption Rules

### For New Modules (Knowledge, Publishing, Growth, etc.)

1. Fork the template from an existing baseline module (e.g., Discovery)
2. Fill in all 4 assets
3. Submit as PR (title: `baseline: {module-name} engineering baseline`)
4. Merge only after all 4 documents are approved
5. Only then begin implementation

### For Existing Modules Already in Development

Existing modules (Discovery, Recommendation, Mission, Verification) must have their baseline documents verified during the next Sprint that touches them. If any of the 4 assets is missing, the Sprint must create it as a prerequisite.

This is not a documentation task. This is a **design gate**.

## Baseline vs. Sprint Scope

The Engineering Baseline is **not** a sprint artifact. It is a **permanent engineering asset** that lives as long as the module exists. It evolves, but only through explicit version bumps:

```
docs/API_CONTRACT.yaml       → versioned YAML
docs/REPOSITORY_OWNERSHIP.md → updated when ownership changes
docs/EVENT_SEQUENCE_DIAGRAM.md → updated when events change
docs/GOLDEN_USER_JOURNEY.md  → updated when flow changes
```

## Enforcement Point

The Engineering Baseline is enforced at **two gates**:

1. **Development Gate**: Before any code is written for a new module
2. **Audit Gate**: Before any RC audit scores a module, its baseline must be complete

If a module's baseline is incomplete at audit time, the audit scores that module as 0/100 regardless of code quality.

## Version History

| Date | Version | Change |
|------|---------|--------|
| 2026-07-04 | 1.0 | Initial — 4 assets defined, adoption rules, enforcement gates |
