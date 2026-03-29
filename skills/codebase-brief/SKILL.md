---
name: codebase-brief
description: Generate a compressed context summary of the current project's patterns, APIs, and structure. Use at session start or before implementing features to avoid reading many files individually in the main context.
allowed-tools: Read, Grep, Glob, Bash
---

# Codebase Brief

Generate a compressed summary of the current project's volatile state — the things that change between sessions and can't be reliably stored in memory. This replaces reading 10-15 individual files in the main context.

## Discovery strategy

For every section below, follow this fallback chain. Stop at the first level that gives a clear answer:

1. **CLAUDE.md** — read it first. If it documents where things live, use that.
2. **Directory structure** — `ls` / glob the project. If directory names make the purpose obvious, use that.
3. **Code analysis** — grep for imports, decorators, or patterns to derive what the structure doesn't make clear.

## What to detect

### 1. Tech Stack
- CLAUDE.md usually documents this
- Fallback: detect from `package.json`, `requirements.txt`, `pyproject.toml`, `*.csproj`, `go.mod`, etc.
- Note: framework, ORM, test framework, styling, state management, data fetching library

### 2. Shared UI Components (frontend only)
- **CLAUDE.md** — check if it documents where shared components live
- **Directory structure** — look for directories whose names suggest reusability (`shared/`, `common/`, `ui/`, `lib/`, `components/`)
- **Import frequency** — if the structure is flat or ambiguous, grep for component files imported by 3+ other files
- For each: extract the props interface/type only (not implementation)

### 3. Data Models (backend only)
- **CLAUDE.md** — check if it documents where models live
- **Directory structure** — look for `models/`, `entities/`, `domain/`, `schema/`
- **Code analysis** — grep for ORM base class inheritance or decorator patterns (e.g., `class.*Base`, `@Entity`, `type.*struct`)
- For each: list field names and types. Note relationships.

### 4. API Routes
- **CLAUDE.md** — check if it documents route structure
- **Directory structure** — look for `routes/`, `api/`, `controllers/`, `handlers/`
- **Code analysis** — grep for route decorators (`@router`, `@app.`, `[HttpGet]`, `r.GET`, `router.get`, `@Controller`)
- List: HTTP method, path, brief purpose. Group by resource.

### 5. Store/State Management (frontend only)
- **CLAUDE.md** — check if it documents state management approach
- **Directory structure** — look for `store/`, `state/`, `api/`, `queries/`, `composables/`
- **Code analysis** — grep for data fetching patterns (`createApi`, `useQuery`, `defineStore`, `createSlice`)
- List existing query/mutation hooks and their endpoints.

### 6. Test Patterns
- **CLAUDE.md** — check if it documents test conventions
- **Directory structure** — look for `tests/`, `__tests__/`, `spec/`, `e2e/`, `*.test.*`, `*.spec.*`
- **Code analysis** — read 1 backend test and 1 frontend test to extract: framework, mocking approach, fixture patterns, naming convention

### 7. Naming Conventions
- **CLAUDE.md** — check if it documents conventions
- **Directory structure** — observe file naming patterns from discovered files
- **Code analysis** — observe import style (absolute paths, aliases, relative) from a few files

## Output format

Output a structured brief. Be concise — this is a reference card, not documentation.

```
## Project Brief: <name>

### Stack
Frontend: <framework> + <state mgmt> + <styling> + <data fetching>
Backend: <framework> + <ORM> + <database>
Testing: <unit> + <E2E>

### UI Components
- ComponentName(prop: type, prop: type)
- ComponentName(prop: type, prop: type)

### Models
- ModelName: field(type), field(type), field(type)
- ModelName: field(type), field(type) → relates to ModelName

### Routes
GET  /resource          — list (filters: x, y, z)
POST /resource          — create
GET  /resource/{id}     — get by id
...

### Store Endpoints
- useListResourceQuery(params) → Resource[]
- useCreateResourceMutation() → Resource
...

### Test Patterns
Backend: <framework>, mock with <approach>, fixtures via <method>
Frontend: <framework>, mock with <approach>
E2E: <framework>, auth via <method>

### Conventions
Files: <naming pattern>
Dirs: by feature at <path>
Imports: <alias pattern>
```

## Rules

- **Be concise** — one line per component/model/route. No implementation details.
- **Read minimally** — glob and grep first, only read files when you need the exact interface
- **Skip what CLAUDE.md already documents** — don't repeat architecture decisions that are in CLAUDE.md
- **Focus on what changes** — component APIs evolve, routes get added, models gain fields. That's what this brief captures.
- **Output to the user** — this is NOT saved to a file. It's returned as conversation context for the current session.
