---
trigger: always_on
---

# 🧠 GLOBAL ENGINEERING RULES (Permanent System Contract)

These rules apply to every line of code written or modified in this codebase. They take precedence over speed or "MVP" shortcuts.

## 1. Core Development Philosophy

- **Think Before Coding**: Never jump straight into implementation. Analyze existing architecture and abstractions first.
- **Zero Duplication (DRY)**: Absolutely no copy-paste logic. Extract, generalize, and extend existing code. Prefer **composition over duplication**.
- **SOLID Methodology**:
  - **S**ingle Responsibility: One reason to change.
  - **O**pen for extension, closed for modification.
  - **L**iskov substitution: No surprises in derived logic.
  - **I**nterface segregation: Small, focused interfaces.
  - **D**ependency inversion: Depend on abstractions.
- **Search-First**: Always search for existing utilities/helpers before creating new ones.
- **Framework-First Design**: Always design features as a framework or library whenever possible. Never repeat code; build reusable primitives that can be extended.
- **Scalability First**: Design for 10,000+ concurrent users from day one. Assume horizontal scaling and high traffic.

---

## ⚙️ BACKEND RULES (Go & Node.js)

### Architecture

- Use **Clean/Hexagonal Architecture** patterns.
- **Mandatory Layers**:
  - `/domain`: Business entities and logic.
  - `/application`: Use cases and orchestration.
  - `/infrastructure`: Adapters, DB, and external service clients.
  - `/interfaces`: Controllers, Handlers, and API definitions.

### Business Logic

- Business logic **never** lives in Controllers, Handlers, or DB queries.
- Controllers are for orchestration and transport only.
- Services must be **stateless** and inject dependencies.

### Concurrency & Go

- Use **Context** (`context.Context`) for all DB and network calls.
- Utilize worker pools for concurrency; control goroutine lifecycles.
- No global state.

### Node.js (TypeScript)

- Type safety is mandatory.
- Async/await only (no raw promises).
- CPU-heavy work must be offloaded to workers or separate services.

---

## 🗄️ DATABASE RULES (PostgreSQL)

### Schema & Queries

- **Normalize by default**. Denormalize only with measured justification.
- **Explicit Constraints**: Use PKs, FKs, and Unique constraints rigorously.
- **No `SELECT *`**: Always limit result sets and use pagination for lists.
- **Avoid N+1 queries** at all costs.

### Indexing

- Every query path must be indexed based on `WHERE`, `JOIN`, and `ORDER BY` usage.
- Use **GIN/B-Tree** appropriately for JSONB data.

### Heavy Load Strategy

- Use **Read Replicas** for scaling reads.
- Connection pooling and query timeouts are mandatory.
- **Transactions**: Keep them short; never mix business logic inside.

---

## 🎨 FRONTEND RULES (React & TypeScript)

### Architecture & Components

- **Feature-based folder structure**.
- **Small, Focused Components**: One responsibility per component. Never dump everything in one single component/file.
- **Decoupled Logic**: Business logic and UI must never be tightly coupled.
- Prefer **composition over props explosion**.
- **Modern Patterns**: Always use the latest and most standard-compliant patterns of TypeScript, JavaScript, and React.

### State & Logic

- **Local state by default**. Lift state only when truly needed.
- **Hooks & Services**: Extract logic, API calls, and transitions into custom Hooks (`src/hooks`) or Utility Services (`src/lib`).
- **Main Thread Preservation**: Long-running or CPU-heavy logic must never block the main thread. Offload to workers or optimize.
- **Normalized Server Data**: Cache server state and handle loading/error/retry states gracefully.

### UI & UX

- Maintain the Project's UI/UX design and aesthetic defined.
- **Standard Sizing**: Use consistent, standard sizing tokens for text, padding, borders, and margins.
- Adopt the project's **existing styling patterns** (e.g., Tailwind, CSS-in-JS, or Vanilla CSS).
- **Keyboard Navigation**: All interactive elements (inputs, menus, buttons) must be fully keyboard navigable.
- Prioritize **Accessibility (ARIA)** and semantic HTML.
- Implement **Optimistic UI** where safe.

---

## 🤖 AI OPERATING INSTRUCTIONS

- **Phase-Based Workflow**: Always: **Research -> Planning -> Implementation -> Verification**.
- **Least Code Possible**: Minimize codebase bloat by using existing sub-logic.
- **Documentation First**: Update `task.md` and Implementation Plans before making changes.
- **Production-Ready Assets**: Generate real UI assets (images/icons) using tools; no placeholders.
