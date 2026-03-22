# Stack Profiles

## When to use this file

**ONLY for greenfield projects** — an empty or near-empty directory with no existing code, no package.json, no requirements.txt, no CLAUDE.md, no go.mod, nothing that indicates a tech stack.

**Do NOT use this file when:**
- The project already has code — detect the stack from existing files
- CLAUDE.md exists — follow whatever it says
- The user has already specified a tech stack — use what they asked for
- Adding a feature to an existing app — use the existing stack

If there is ANY existing context to infer the stack from, skip discovery questions entirely and use what's there. These questions are a one-time conversation at the start of a brand new project.

## Discovery Questions

Ask these conversationally — all at once, not one at a time. These are business questions, not technical ones. Skip any question whose answer is obvious from the user's initial description.

### 1. What are you building?
**Ask:** "What does this app do? Describe it in a sentence or two."
**Why:** Determines the core domain and app type (web, mobile, CLI, desktop, API).

### 2. Who is it for?
**Ask:** "Is this just for you, for a small group (team/family), or are you planning to sell it to real users?"
**Maps to:**
- **Just me** → local-first, simple deployment, SQLite, no auth needed
- **Small group** → basic auth, simple deployment (single VPS), PostgreSQL
- **Real users / selling** → production-grade auth, scalable deployment, PostgreSQL, monitoring, CI/CD

### 3. Will other people use this at the same time?
**Ask:** "Will multiple people be using this simultaneously, or is it one person at a time?"
**Maps to:**
- **Concurrent users** → needs a database server (PostgreSQL/MySQL), proper session handling, potential WebSocket for real-time
- **Single user** → SQLite is fine, simpler architecture

### 4. How will people use it?
**Ask:** "Will people use this in a web browser, on their phone, or both?"
**Maps to:**
- **Browser** → web app
- **Phone** → PWA (if simple) or native app (if complex native features needed)
- **Both** → responsive web app or PWA
- **Neither / just me on my computer** → CLI or desktop app

### 5. Does it need user accounts?
**Ask:** "Will people need to sign up and log in, or is it open/single-user?"
**Maps to:**
- **Yes** → auth system
- **No** → skip auth entirely

### 6. Do you want this to be free to run, or are you okay paying for hosting?
**Ask:** "Should this cost nothing to keep running, or is a small monthly hosting cost okay?"
**Maps to:**
- **Free** → Vercel/Netlify free tier, SQLite, static hosting, serverless
- **Small budget okay** → VPS ($5-10/mo), managed database, PaaS (Railway, Render, Fly.io)
- **Budget not a concern** → cloud provider (AWS/GCP), managed services, CDN

## Stack Profiles

Based on answers, select the closest profile. Each profile recommends the simplest stack that meets the requirements — not a specific ecosystem.

### Personal Tool (Web)
**When:** Just for me, browser-based, no auth, no integrations
**Stack:**
- **Fullstack:** Next.js, TypeScript, TailwindCSS, SQLite (via Prisma or Drizzle)
- **Deployment:** Local dev server or Vercel (free tier)
- **Why one framework:** Next.js handles frontend and API routes in a single project. One language (TypeScript), one deploy, minimal config. SQLite needs no database server — it's just a file.
- **Alternative if user prefers Python:** Django with built-in templates + SQLite. Also one framework, batteries-included.

### Personal Tool (CLI)
**When:** Command-line utility, runs locally
**Stack options (pick based on task):**
- **Data processing, scripting, automation:** Python with Typer (simple) or Click (complex)
- **Fast CLI with cross-platform binary:** Go with Cobra
- **Node ecosystem / npm distribution:** Node.js with Commander
- **Data:** SQLite or JSON files for local storage
- **Why:** Pick the language that matches the task. Python for data/scripting, Go for performance/distribution, Node for JS ecosystem integration.

### Small Group App
**When:** Small team/family, needs auth, basic deployment
**Stack options:**
- **Fastest to build (fullstack JS):** Next.js, TypeScript, TailwindCSS, PostgreSQL (Prisma), NextAuth.js
- **Fastest to build (Python):** Django, PostgreSQL, django-allauth, HTMX or Django templates
- **More control over API (separate frontend/backend):** React/Vue + FastAPI/Express + PostgreSQL
- **Deployment:** Single VPS (Caddy/Nginx + systemd) or PaaS (Railway, Render, Fly.io)
- **Why:** Fullstack frameworks (Next.js, Django) minimize the number of moving parts. A separate frontend/backend is better when the API needs to serve multiple clients (web + mobile + third-party).

### Production SaaS
**When:** Real users, selling it, needs scalability and reliability
**Stack options:**
- **JS/TS ecosystem:** Next.js (frontend + SSR) + separate Node.js API (Express/Fastify/Hono) + PostgreSQL + Redis
- **Python ecosystem:** React/Vue + Django REST Framework or FastAPI + PostgreSQL + Celery/Redis
- **Go ecosystem:** React/Vue + Go (Chi/Echo/Fiber) + PostgreSQL + Redis
- **Auth:** Auth.js, Clerk, Supabase Auth, or framework-native (depends on stack choice)
- **Background jobs:** BullMQ (Node), Celery/Dramatiq (Python), native goroutines (Go)
- **Deployment:** Docker + cloud provider (Railway/Render/Fly.io/AWS)
- **Monitoring:** Sentry (errors), PostHog or Plausible (analytics)
- **Why:** Production SaaS needs a separate API layer for scalability, background job processing for async work, Redis for caching/queues, and monitoring to catch issues before users do.

### API / Backend Only
**When:** No frontend needed, just an API for other services or mobile apps
**Stack options:**
- **High productivity + auto-docs:** FastAPI (Python) or Django REST Framework
- **High performance + low latency:** Go (Chi/Echo) or Rust (Actix/Axum)
- **JS/TS ecosystem:** Express, Fastify, or Hono (Node.js/Bun)
- **Database:** PostgreSQL (relational) or MongoDB (document-oriented, if data is truly unstructured)
- **Docs:** OpenAPI/Swagger (auto-generated by FastAPI, or via swagger-jsdoc for Node)
- **Why:** Pick based on the priority — FastAPI for developer speed and auto-docs, Go for performance and simple deployment (single binary), Node for JS ecosystem alignment.

### Mobile App
**When:** Native mobile experience needed (camera, push notifications, offline-first)
**Stack options:**
- **Cross-platform (JS/TS):** React Native with Expo, TypeScript
- **Cross-platform (Dart):** Flutter
- **iOS only:** Swift/SwiftUI
- **Android only:** Kotlin/Jetpack Compose
- **Backend:** Any backend stack above — mobile apps are API consumers
- **Push notifications:** Expo Push (React Native), Firebase Cloud Messaging (any)
- **Deployment:** App Store / Google Play
- **Why:** React Native if the team knows JS/TS. Flutter for pixel-perfect custom UI. Native (Swift/Kotlin) for maximum platform integration. Backend choice is independent of mobile framework.

### Desktop App
**When:** Native desktop experience, offline-capable, system integration
**Stack options:**
- **Cross-platform with web tech:** Electron (JS/TS) or Tauri (Rust + web frontend)
- **Cross-platform native:** .NET MAUI (C#) or Qt (C++/Python)
- **macOS only:** Swift/SwiftUI
- **Windows only:** WPF/WinUI (.NET)
- **Why:** Tauri for small bundle size and performance. Electron for maximum web ecosystem compatibility. Native for best OS integration.

## Decision Tree for Non-Technical Users

When the user hasn't specified a tech stack, use this tree to pick ONE stack — don't present options. The decision is based on what the app DOES, not on any default ecosystem preference.

```
What type of app?
├── Web app (browser)
│   ├── Mostly content, pages, marketing, SEO matters
│   │   → Next.js fullstack + PostgreSQL
│   ├── Mostly data management / CRUD (forms, tables, admin)
│   │   → Django + PostgreSQL
│   ├── Interactive UI, real-time updates, dashboards
│   │   → Next.js fullstack + PostgreSQL
│   ├── AI / ML / data processing + web UI
│   │   → FastAPI (Python) backend + React frontend + PostgreSQL
│   └── Simple personal tool, no concurrent users
│       → Next.js fullstack + SQLite
├── Mobile app
│   → React Native (Expo) + TypeScript + backend from web app tree
├── CLI tool
│   ├── Data processing, scripting, automation
│   │   → Python + Typer
│   └── Needs cross-platform binary distribution
│       → Go + Cobra
├── Desktop app
│   → Tauri + TypeScript frontend
└── API only (no UI)
    ├── Productivity priority (auto-docs, fast development)
    │   → FastAPI (Python) + PostgreSQL
    └── Performance priority (high throughput, low latency)
        → Go + PostgreSQL
```

**Complexity scales with audience:**
- **Just me** → SQLite, no auth, local/free hosting
- **Small group** → PostgreSQL, basic auth, single VPS
- **Real users** → PostgreSQL, production auth, cloud deploy, monitoring

## Presenting the recommendation

After asking discovery questions, present the stack recommendation and give the user a chance to weigh in:

**For non-technical users:**
> "Based on what you've described, I'd recommend building this as a web app with a database and user accounts. I'll handle all the technical setup — you don't need to worry about the details. Sound good, or is there anything you'd like to change?"

**For technical users** (they mention specific technologies, frameworks, or architectural patterns):
> "Based on what you've described, here's what I'd recommend:
> - Frontend: [framework] + TypeScript + TailwindCSS
> - Backend: [framework] + [database]
> - Auth: [solution]
> - Deployment: [platform]
>
> Want to swap anything out, or should I go with this?"

**How to detect technical vs non-technical:** If the user mentions ANY specific technology by name ("use Go", "I want Next.js", "can we use MongoDB?"), they're technical — show the full stack breakdown and let them customize. If they only describe business needs, they're non-technical — keep it simple.

## Rules

- **Start with business questions** — "Do you want React or Vue?" is wrong. "Will people use this in a browser?" is right. Technical users will volunteer their preferences without being asked.
- **Don't overwhelm** — ask 3-4 questions max. Skip questions when the answer is obvious from context.
- **Respect explicit overrides** — if the user says "I want to use Go" or "use Next.js," respect that immediately. These profiles are defaults, not mandates. A technical user's stack preference overrides any profile recommendation.
- **Existing project always wins** — if there's already a package.json or CLAUDE.md, use whatever stack is already there. Never suggest switching stacks on an existing project.
- **Don't gatekeep** — if a technical user picks a stack you think is suboptimal, mention the tradeoff once but proceed with their choice. They may have reasons you don't know about.
- **No ecosystem bias** — don't default to the same language/framework across all profiles. Pick the best fit for each use case. A CLI tool, a SaaS app, and a mobile app have different needs and may warrant different languages.
- **Simplicity scales with scope** — a personal tool should use the fewest moving parts possible. A production SaaS can justify more complexity. Don't give a solo hobbyist a microservices architecture.
