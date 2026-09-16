---
name: wareops-backend
description: Implement, review, or document WareOps backend, API, database, Docker, observability, testing, and backend CI work. Do not use for frontend-only work.
---

# WareOps Backend

Work only on the backend and its supporting data, infrastructure, CI, tests, and documentation. Do not modify `wareops-web` or other frontend code unless the user explicitly authorizes it.

Before changing behavior:

1. Read the relevant material in the sibling `wareops-docs` vault, including accepted ADRs and its `AGENTS.md` when editing documentation.
2. Check the current official documentation for every framework, library, service, or tool involved.
3. Reconcile implementation with the documented architecture and API contracts. If the requested behavior is new or changes a decision, update the appropriate existing documentation, OpenAPI contract, README, roadmap, or ADR in the same task.

Keep Prisma Client as the only PostgreSQL data-access API and never introduce raw SQL unless the user explicitly changes the documented decision. Do not expose secrets, tokens, SQL, stack traces, or sensitive request bodies in responses, logs, examples, or documentation.

Treat later user instructions as higher priority than this skill. Do not infer permission for frontend work or broader external changes from a backend request.
