# ADR-002: Repository Pattern

## Decision
All database access must go through a Repository. No Runtime or Service code may import or call `prisma` directly. Repositories are responsible for:
1. Mapping between database rows and domain types
2. Encapsulating Prisma query logic
3. Providing a consistent CRUD interface
4. Managing transaction boundaries

## Context
The audit found 19 repository files across 4 Runtimes. Most followed the pattern correctly, but there were violations:
- `asset.service.ts:168` uses dynamic `import('../../utils/index.js')` to access Prisma directly for `addTag`/`removeTag`
- `semantic.runtime.ts:61-72` accesses `(onSemanticEvent as any).listeners` directly (leaky event abstraction)
- Scanner Runtime (`geo/scanner/`) has no repositories at all — it reads/writes nothing to DB directly

## Alternatives
1. **Active Record** — let domain objects handle persistence; rejected to maintain separation of concerns
2. **Raw Prisma everywhere** — rejected; would couple business logic to database schema
3. **DAO pattern** — equivalent to Repository; naming chosen for broad platform familiarity

## Consequences
- **Positive**: Consistent data access semantics across all Runtimes; easy to swap databases or add caching
- **Negative**: Boilerplate for simple queries (create/read/update/delete)
- **Standard interface**: All repositories should implement `BaseRepository<T>` (see ARCH-001-B)
