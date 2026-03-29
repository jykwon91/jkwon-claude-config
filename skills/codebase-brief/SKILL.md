---
name: codebase-brief
description: Generate a compressed context summary of the current project's patterns, APIs, and structure. Use at session start or before implementing features to avoid reading many files individually in the main context.
allowed-tools: Read, Grep, Glob, Bash
---

# Codebase Brief

Generate a compressed summary of the current project's volatile state — the things that change between sessions and can't be reliably stored in memory. This replaces reading 10-15 individual files in the main context.

## What to detect

### 1. Tech Stack (from project files)
- Read `CLAUDE.md` first — it documents the stack and conventions
- Detect from `package.json`, `requirements.txt`, `pyproject.toml`, `*.csproj`, `go.mod`, etc.
- Note: framework, ORM, test framework, styling, state management, data fetching library

### 2. Shared UI Components (frontend only)
- Glob for shared/reusable component files (e.g., `**/shared/components/**/*.{tsx,vue,svelte}`, `**/components/ui/**/*`)
- For each component: extract the props interface/type (just the type definition, not the implementation)
- Keep it concise — component name + props only

### 3. Data Models (backend only)
- Glob for model files (e.g., `**/models/**/*.py`, `**/entities/**/*.cs`, `**/models/**/*.go`)
- For each model: list field names and types (just the schema, not methods)
- Note relationships between models

### 4. API Routes
- Grep for route/endpoint definitions
- List: HTTP method, path, brief purpose
- Group by resource/domain

### 5. Store/State Management (frontend only)
- Identify the data fetching pattern (RTK Query, React Query, SWR, Pinia, etc.)
- List existing query/mutation hooks and their endpoints
- Note the pattern for adding new endpoints

### 6. Test Patterns
- Read 1 backend test and 1 frontend test to extract:
  - Test framework and assertion style
  - Mocking approach (how are APIs/DB mocked?)
  - Fixture patterns
  - File naming convention

### 7. Naming Conventions
- File naming (kebab-case, PascalCase, snake_case)
- Directory structure pattern (by feature? by type?)
- Import style (absolute paths, aliases like `@/`)

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
