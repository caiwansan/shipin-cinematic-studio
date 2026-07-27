# ADR-001: Build Recovery — Client-only SPA Deployment

**Status**: Accepted (Temporary)
**Date**: 2026-07-23
**Context**: Phase 5-A3 frontend build recovery

## 1. Problem

`nuxt build` hangs indefinitely during SSR bundle compilation. Client build succeeds (1.5s), but server build fails with:

```
RollupError: Invalid substitution "../../../../nuxt_3.16.2__parcel_watcher_2.5.6__...__/node_modules/nuxt/dist/app/nuxt" 
for placeholder "[name]" in "output.entryFileNames" pattern
```

## 2. Root Cause

**Nitro 2.13.4 + Rollup 4 + pnpm content-addressable storage incompatibility**

- pnpm uses content-addressable storage paths with hashes as directory names
- Nitro's Rollup config uses `[name]` placeholder in `output.entryFileNames`
- When pnpm's long hash-based paths are substituted into `[name]`, Rollup 4 rejects them as invalid (neither absolute nor relative)
- This is a known bug in the Nitro/Rollup/pnpm integration, not a project-specific issue

### Failed Fix Attempts
| Attempt | Result |
|---------|--------|
| Kill TS Server (2.7GB) | ❌ Build still hangs |
| Disable `experimental.node` | ❌ No change |
| Change preset `node-server` → `static` | ❌ Nuxt overrides (server routes exist) |
| Override `rollupConfig.output.entryFileNames` | ❌ Nitro ignores external config |
| Move server routes away | ❌ Still fails (not route-related) |
| `shamefully-hoist=true` | ❌ Already installed, no effect |
| `nuxi generate` | ❌ Still tries SSR bundle |
| Update Nuxt to 4.5.0 | ❌ autoprefixer version conflict |

## 3. Decision

**Deploy as Client-only SPA** (workaround, not permanent fix)

### Rationale
- `ssr: false` was already set in nuxt.config.ts
- The application is a SPA that consumes REST APIs (backend on :4002)
- No SEO requirements (enterprise internal tool)
- Client build succeeds perfectly (1.5s, 0 errors)

### Implementation
1. Run `nuxt build` (ignore SSR failure with `|| true`)
2. Manually create `.output/public/index.html` with entry.js + CSS references
3. rsync `_nuxt/` to nginx webroot
4. nginx serves SPA with history mode fallback

## 4. Consequences

### Positive
- ✅ Build succeeds in 1.5s
- ✅ Frontend deploys and runs correctly
- ✅ No impact on user experience (SPA mode)
- ✅ Backend APIs unaffected

### Negative
- ⚠️ No SSR (acceptable for enterprise internal tool)
- ⚠️ Initial page load slightly slower (no server-rendered HTML)
- ⚠️ Manual index.html creation required in deploy script

## 5. Revertion Conditions

**This workaround should be reverted when:**
- [ ] Nitro is upgraded to 3.x (fixes Rollup/pnpm integration)
- [ ] Nuxt is upgraded to a version that includes the fix
- [ ] `nuxt build` SSR completes successfully with updated dependencies

**To revert:**
1. Remove `|| true` from deploy.sh
2. Remove manual index.html creation
3. Restore full Nitro server deployment

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SSR never works with current deps | Medium | Low | SPA is acceptable for internal tool |
| Future Nuxt upgrade breaks SPA | Low | Medium | Standard upgrade testing |
| SEO requirements emerge | Very low | Low | Can add prerendering later |

## 7. References

- Nitro issue: github.com/nuxt/nitro (Rollup/pnpm path substitution)
- Rollup 4 entryFileNames validation
- pnpm content-addressable storage design
