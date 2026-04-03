---
name: codebase-brief
description: "Generate a compressed context summary of the current project's patterns, APIs, and structure. Use at session start or before implementing features to avoid reading many files individually in the main context."
---

# Codebase Brief

Generate a compressed summary of the current project's volatile state — the things that change between sessions and can't be reliably stored in memory. This replaces reading 10-15 individual files in the main context.

## Discovery strategy

For every section below, follow this fallback chain. Stop at the first level that gives a clear answer:

1. **Project instructions** — read them first. If they document where things live, use that.
2. **Directory structure** — glob the project. If directory names make the purpose obvious, use that.
3. **Code analysis** — grep for imports, decorators, or patterns to derive what the structure doesn't make clear.

## What to detect

### 1. Tech Stack
- Project instructions usually documents this
- Fallback: detect from `package.json`, `requirements.txt`, `pyproject.toml`, `*.csproj`, `go.mod`, etc.
- Note: framework, ORM, test framework, styling, state management, data fetching library

### 2. Shared UI Components (frontend only)
- Look for directories suggesting reusability (`shared/`, `common/`, `ui/`, `lib/`, `components/`)
- For each: extract the props interface/type only (not implementation)

### 3. Data Models (backend only)
- Look for `models/`, `entities/`, `domain/`, `schema/`
- For each: list field names and types. Note relationships.

### 4. API Routes
- Look for `routes/`, `api/`, `controllers/`, `handlers/`
- List: HTTP method, path, brief purpose. Group by resource.

### 5. Store/State Management (frontend only)
- Look for `store/`, `state/`, `api/`, `queries/`, `composables/`
- List existing query/mutation hooks and their endpoints.

### 6. Test Patterns
- Read 1 backend test and 1 frontend test to extract: framework, mocking approach, fixture patterns, naming convention

### 7. Naming Conventions
- Observe file naming patterns and import style from discovered files

## Output format

```
## Project Brief: <name>

### Stack
Frontend: <framework> + <state mgmt> + <styling> + <data fetching>
Backend: <framework> + <ORM> + <database>
Testing: <unit> + <E2E>

### UI Components
- ComponentName(prop: type, prop: type)

### Models
- ModelName: field(type), field(type) -> relates to ModelName

### Routes
GET  /resource          — list (filters: x, y, z)
POST /resource          — create
GET  /resource/{id}     — get by id

### Store Endpoints
- useListResourceQuery(params) -> Resource[]

### Test Patterns
Backend: <framework>, mock with <approach>, fixtures via <method>
Frontend: <framework>, mock with <approach>

### Conventions
Files: <naming pattern>
Dirs: by feature at <path>
Imports: <alias pattern>
```

## Rules

- **Be concise** — one line per component/model/route. No implementation details.
- **Read minimally** — glob and grep first, only read files when you need the exact interface
- **Skip what project instructions already documents** — don't repeat architecture decisions
- **Focus on what changes** — component APIs evolve, routes get added, models gain fields
- **Output to the user** — this is NOT saved to a file. It's returned as conversation context.
