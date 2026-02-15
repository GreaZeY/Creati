---
trigger: always_on
---

# 🤖 GLOBAL ENGINEERING RULES & AI AGENT GUIDELINES (Creati Project)

This document serves as the **Permanent System Contract** for all development within the Creati ecosystem. It combines global engineering excellence with project-specific architectural standards.

---

## 1. Core Development Philosophy

- **Think Before Coding**: Never jump straight into implementation. Analyze existing architecture and abstractions first.
- **Zero Duplication (DRY)**: Absolutely no copy-paste logic. Extract, generalize, and extend existing code. Prefer **composition over duplication**.
- **SOLID Methodology**: Implement Single Responsibility (S), Open/Closed (O), Liskov Substitution (L), Interface Segregation (I), and Dependency Inversion (D).
- **Search-First**: Always search for existing utilities, components, or services (e.g., the `Platform` interface) before creating new ones.
- **Framework-First Design**: Design features as a framework or library whenever possible. Build reusable primitives that can be extended.
- **Scalability First**: Design for **10,000+ concurrent users** from day one. Assume horizontal scaling and high traffic.

---

## ⚙️ BACKEND RULES (Go & Hexagonal Architecture)

### Architecture Patterns

Follow the established layer structure in `backend/internal/`:

- **`/api` (Interfaces)**: HTTP transport layer (routers, handlers). Orchestration only; no business logic.
- **`/services` (Application)**: Business logic layer. Must be stateless and inject dependencies.
- **`/db/repositories` (Infrastructure)**: Adapters for data access. Handles SQL and mapping.
- **`/db/models` (Domain)**: Business entities and logic.
- **`/workers`**: CPU-heavy or long-running work (video processing/bulk uploads) MUST be offloaded here.

### Business Logic & Concurrency

- Business logic **never** lives in Controllers, Handlers, or DB queries.
- **Context Management**: Use `context.Context` for all DB and network calls to handle timeouts/cancellations.
- **Error Handling**: Use `fmt.Errorf("context: %w", err)` for meaningful traces.
- **No Global State**: Ensure services are stateless.

---

## 🗄️ DATABASE RULES (PostgreSQL)

### Schema & Queries

- **Normalize by default**. Denormalize only with measured justification.
- **Explicit Constraints**: Use PKs, FKs, and Unique constraints rigorously.
- **No `SELECT *`**: Always specify columns. Use pagination for all lists.
- **Avoid N+1 queries** at all costs. Use batching or JOINs.

### Indexing & Load Strategy

- Every query path must be indexed based on `WHERE`, `JOIN`, and `ORDER BY` usage.
- Use **GIN/B-Tree** appropriately for JSONB data.
- **Transactions**: Keep them short; never mix business logic inside.

---

## 🎨 FRONTEND RULES (React & TypeScript)

### Architecture & Components

- **Feature-based folder structure**: Group related logic within `frontend/src/components`.
- **Small, Focused Components**: One responsibility per component. Never dump everything in one single component/file. Use atomic UI patterns in `/components/ui`.
- **Decoupled Logic**: Business logic and UI must never be tightly coupled. Extract transitions and API calls into custom hooks or services.
- Prefer **composition over props explosion**.
- **Modern Patterns**: Always use the latest and most standard-compliant patterns of TypeScript and React 19.

### State & Logic

- **Local state by default**: Lift state only when truly needed.
- **Hooks & Services**: Extract logic, API calls, and transitions into custom Hooks (`src/hooks`) or Utility Services (`src/lib`).
- **Main Thread Preservation**: Long-running or CPU-heavy logic must never block the main thread. Offload to workers or optimize.
- **Normalized Server Data**: Cache server state using `@tanstack/react-query` and handle loading/error/retry states gracefully.

### UI & UX (Cyber-Premium)

- **Glassmorphism**: Use the `.glass-panel` and `shadow-glass` tokens from `index.css`.
- **Standard Sizing**: Use consistent, standard sizing tokens. Sidebar/Header height is `3.5rem` (56px).
- **Accessibility (ARIA)**: Prioritize semantic HTML and ARIA labels. Ensure all interactive elements are fully keyboard navigable.
- **Performance**: Use `DataTable` or `VirtualList` (powered by `@tanstack/react-virtual`) for large datasets.
- **Optimistic UI**: Implement optimistic updates where safe to enhance perceived speed.

---

## 🔒 SECURITY RULES (Non-Negotiable)

### Auth & Data Protection

- **Zero Trust**: Always validate and sanitize client-side data on the server.
- **JWT**: Use for authentication with short expiration. Use HTTP-only, Secure, SameSite cookies.
- **Hashing**: Use **bcrypt** or **Argon2** for passwords.
- **Encryption**: Encrypt sensitive data (tokens) at rest and in transit.

### API & External Integrations

- **Rate Limiting**: Implement on all public endpoints.
- **Validation**: Validate all inputs (length, type, format) before processing.
- **Secrets**: NEVER expose API keys in code or logs. Use environment variables via `os.Getenv`.
- **Webhook Security**: Validate payloads and use signature verification.

---

## �️ CLI & DEVOPS

- **The `creati` Tool**: AI agents should use the CLI (`creati start`, `creati doctor`, `creati migrate`) for orchestration and environment health.
- **Smart Rebuilds**: Ensure `creati self-update` is called after modifying CLI source code.

---

## 🤖 AI OPERATING INSTRUCTIONS

- **Phase-Based Workflow**: Always: **Research -> Planning -> Implementation -> Verification**.
- **Least Code Possible**: Minimize codebase bloat by using existing sub-logic and patterns.
- **Documentation First**: Update `task.md` and Implementation Plans before making changes.
- **Production-Ready Assets**: Generate real UI assets (images/icons) using tools; no placeholders.
- **Standard Output**: Never use emojis or language that identifies the app as AI-built.

---

## ⚖️ Scalability Checklist

- [ ] Is this query indexed and free of N+1?
- [ ] Is the frontend list virtualized?
- [ ] Is heavy work offloaded to a worker pool?
- [ ] Are external API calls context-aware with timeouts?
- [ ] Does the UI maintain "Cyber-Premium" design parity?
