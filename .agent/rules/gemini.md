---
trigger: always_on
---

# 🤖 GLOBAL ENGINEERING RULES & AI AGENT GUIDELINES (Creati Project)

This document serves as the **Permanent System Contract** for all development within the Creati ecosystem. It combines global engineering excellence with project-specific architectural standards and strict AI operating instructions.

---

## 0. Rule Hierarchy (Non-Negotiable Order of Authority)

1. **Creati Project Rules (Highest Priority)**
2. Clean/Hexagonal Architecture Principles
3. Security Requirements
4. Scalability & Performance Standards
5. Language & Framework Best Practices
6. Developer Convenience (Lowest Priority)

If a best practice conflicts with a Creati rule, **Creati rule wins**.

---

## 🚀 About Creati

**Creati** is a high-performance content orchestration platform designed for creators and agencies. It centralizes content creation, distribution, and automation across major social platforms (YouTube, Instagram, Facebook, X, LinkedIn, Reddit, Discord).

### Core Features

- **Unified Distribution**: Multi-platform video and post uploading with a single click.
- **AI-Powered Workflows**: Integrated AI for content generation and optimization.
- **Smart Automations**: Event-driven posting and platform-to-platform content syncing.
- **Centralized Analytics**: Aggregated performance metrics across all connected accounts.
- **Workspace Management**: Multi-user and multi-workspace support for scaling agencies.

---

## 🏗️ System Overview

### Backend (Go & PostgreSQL/Redis)

The backend is built with **Clean/Hexagonal Architecture** to ensure long-term maintainability.

- **Purpose**: Handles OAuth authentication, platform-specific API integrations, video processing, and asynchronous job scheduling.
- **Scalability**: Uses Redis-backed worker pools for heavy lifting (video uploads/processing) to keep the API responsive.
- **Key Interface**: The [Platform interface](file:///d:/Projects/Creati/backend/internal/services/platform.go) is the central contract for adding new social integrations.

### Frontend (React 19 & TypeScript)

A "Cyber-Premium" dashboard with high-fidelity glass-morphism and smooth animations.

- **Stack**: Vite, TypeScript, Tailwind CSS, Framer Motion, TanStack Query/Virtual.
- **Routing**: Managed via `react-router-dom`.

#### Frontend Routes & Pages

| Path                   | Page           | Description                                      |
| :--------------------- | :------------- | :----------------------------------------------- |
| `/`                    | `Landing`      | Public marketing page.                           |
| `/login` / `/register` | `Auth`         | Security gateways for user accounts.             |
| `/dashboard`           | `Dashboard`    | Overview of performance and recent activity.     |
| `/platforms`           | `Platforms`    | Manage connected social accounts.                |
| `/platforms/connect`   | `Connect`      | OAuth gateway to add new accounts.               |
| `/analytics`           | `Analytics`    | Detailed cross-platform performance data.        |
| `/upload`              | `Upload`       | Bulk video and media uploader.                   |
| `/create/:actor`       | `PostComposer` | AI-assisted post creation and scheduling.        |
| `/automations`         | `Automations`  | List and manage automated workflows.             |
| `/automations/new`     | `Builder`      | Create new triggers and actions.                 |
| `/push`                | `BlastBuilder` | Multi-channel Content distribution.              |
| `/queued`              | `QueuedJobs`   | Monitoring for background distribution tasks.    |
| `/pricing`             | `Pricing`      | Subscription and plan management.                |
| `/settings`            | `Settings`     | Profile, workspace, and security configurations. |

---

# 1. Global Engineering Principles

## 1.1 Architectural Discipline

- Architecture must be **intentional**, not accidental.
- All new features must:
  - Fit existing abstractions (e.g., `Platform`, `Worker`).
  - Extend interfaces — never bypass them.
  - Avoid cross-layer leakage (e.g., no DB models in API responses).
- Domain logic must remain independent from frameworks.

## 1.2 Change Strategy

Before writing code:

1. Identify the abstraction that should own the behavior (e.g., `AutomationService`, `PlatformAccountRepository`).
2. Evaluate if the change:
   - Extends an interface.
   - Requires a new adapter.
   - Belongs in a worker (CPU-heavy/I/O heavy).
3. Document in `task.md`.
4. Only then implement. **No speculative coding.**

---

# 2. Advanced Go Best Practices (Creati Backend)

## 2.1 Project Structure Integrity

Follow the established layer structure in `backend/internal/`:

```
internal/
  api/          -- (Interfaces) HTTP transport layer (routers, handlers). Orchestration only; no business logic.
  services/     -- (Application) Business logic layer. Must be stateless and inject dependencies.
  db/
    models/       -- (Domain) Business entities and logic.
    repositories/ -- (Infrastructure) Adapters for data access. Handles SQL and mapping.
  workers/      -- Background job processing (Redis-backed).
```

### Additional Rules:

- **No circular dependencies**: Use interfaces to break cycles.
- **Dependency Inversion**: Services must depend on interfaces, not concrete implementations.
- **Repositories First**: Repositories must not import services.
- **Least Duplication**: Workers must call existing services — never duplicate business logic.

---

## 2.2 Interface Design (Interface Segregation)

Keep interfaces small and focused. Prefer granular interfaces that can be composed.

```go
type PlatformAccountStore interface {
    UpsertAccount(ctx context.Context, account *models.PlatformAccount) error
    ListAccounts(ctx context.Context, userID int) ([]models.PlatformAccount, error)
}
```

---

## 2.3 Dependency Injection

- Use **constructor injection** exclusively.
- No service should create its own dependencies (e.g., DB connections).
- Avoid global singletons and hidden side effects in `init()`.

Example:

```go
func NewAutomationService(db *sql.DB, queue *QueueService) *AutomationService
```

---

## 2.4 Context Discipline (Critical)

Every DB call, external API call, worker dispatch, and Redis operation **MUST** accept `context.Context`.

- Never use `context.Background()` inside business logic; pass it from the API layer downward.
- Always implement timeouts for platform API calls and external HTTP requests.

---

## 2.5 Error Handling Standards

- **Wrap Errors**: Use `fmt.Errorf("context: %w", err)` to provide meaningful traces.
- **Never discard errors**: Log them or return them.
- **No Panic**: Panics are only allowed during boot failure or corrupted invariant state.

---

## 2.6 Database Layer Excellence

- **No `SELECT *`**: Always specify columns explicitly.
- **Avoid N+1 Queries**: Use batching, JOINs, or subqueries.
- **Performance**: Every query path must be indexed based on `WHERE`, `JOIN`, and `ORDER BY` usage.
- **Transactions**: Keep them short; never mix business logic or external API calls inside.

---

# 3. Advanced React 19 + TypeScript Best Practices

## 3.1 Component Design & Modularity

- **Size Limit**: No component should exceed 300 lines. If it does, break it down into sub-components or hooks.
- **Layer Separation**: Separate UI (JSX), logic (Custom Hooks), and data fetching (React Query).
- **Library-First Design**: Design complex features (like the `VideoEditor`) as self-contained modules/libraries with clear interfaces, prioritizing composition over props explosion.

---

## 3.2 TypeScript Standards

- **Strict Mode**: No `any`, no non-null assertions unless guaranteed.
- **Discriminated Unions**: Use for complex state (e.g., job status, upload states).
- **Validation**: Define API response types explicitly; do not trust backend shapes blindly.

Example:

```ts
type UploadStatus =
  | { type: "idle" }
  | { type: "uploading"; progress: number }
  | { type: "processing"; step: string }
  | { type: "success"; url: string }
  | { type: "error"; message: string };
```

---

## 3.3 State & Performance

- **Hierarchy**: Local state -> React Query (Server state) -> Context (Global UI state) -> External (Rare).
- **Virtualization**: Use `VirtualList` or `DataTable` for datasets > 50 items to ensure "Cyber-Premium" performance.
- **Optimistic UI**: Implement optimistic updates where safe to enhance perceived speed.

---

## 3.4 UI & UX (Cyber-Premium Aesthetic)

- **Design System**: Use the `.glass-panel` and `shadow-glass` tokens from `index.css`.
- **Standard Sizing**: Consistent tokens only; sidebar/header height is `3.5rem` (56px).
- **Accessibility (ARIA)**: Prioritize semantic HTML and keyboard navigation. No feature ships without an accessibility pass.
- **Animation**: Use Framer Motion sparingly; prefer transform/opacity animations to avoid layout thrashing.

---

# 4. Security & DevOps (Non-Negotiable)

## 4.1 Security Baseline

- **Zero Trust**: Always validate/sanitize data on the server.
- **Auth**: Use HTTP-only, Secure, SameSite cookies for JWT. **Never store JWT in localStorage.**
- **Protection**: Parameterized queries only (No XSS/SQLi). Implement rate limiting on all public endpoints.
- **Secrets**: Use `os.Getenv` for all sensitive configuration; never log secrets.

## 4.2 CLI & CI/CD

- **The `creati` Tool**: Use the CLI (`creati start`, `creati doctor`, `creati migrate`) for all orchestration tasks.
- **CI Enforcement**: Linting (Go/TS), static analysis, and test coverage are required.
- **No Direct Pushes**: All changes must go through PRs; migrations must run in CI.

---

# 5. AI Operating Instructions

- **Phase-Based Workflow**: Always: **Research -> Planning -> Implementation -> Verification**.
- **Minimal Code**: Minimize codebase bloat by using existing sub-logic and patterns.
- **Documentation First**: Update `task.md` and Implementation Plans before making changes.
- **Zero Placeholders**: Generate real UI assets (images/icons) using tools.
- **Standard Output**: Maintain professional language; do not identify as AI-built.

---

## ⚖️ Scalability Checklist

- [ ] Is this query indexed and free of N+1?
- [ ] Is heavy work offloaded to a worker pool?
- [ ] Are external API calls context-aware with timeouts?
- [ ] Is the UI virtualized and keyboard navigable?
- [ ] Does the implementation avoid "God Service" or "Massive Component" patterns?

---

**This is the Creati Engineering Contract. Every line of code must justify its existence.**
