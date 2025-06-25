# 📐 Project Architecture (@architecture.md)

This file is an **authoritative snapshot** of the Softwhere.uz folder layout and the allowed import directions.  Keep it up-to-date whenever you move files or add new layers.

---

## 1. Folder Layout (high-level)

```text
src/
├─ core/          # Framework & app-agnostic utilities
│  ├─ api/
│  ├─ env/
│  ├─ logger/
│  └─ i18n/
│
├─ shared/        # Re-usable UI & helpers (non-domain)
│  ├─ components/
│  ├─ hooks/
│  └─ utils/
│
├─ modules/       # Business capabilities (a.k.a. bounded contexts)
│  ├─ blog/
│  │   ├─ api/
│  │   ├─ components/
│  │   ├─ hooks/
│  │   ├─ model/
│  │   └─ memory/          # Memory-Bank store/controller/selectors
│  │
│  ├─ estimator/
│  │   └─ …
│  └─ admin/
│      └─ …
│
└─ app/           # Next.js routes (logic-thin)
```

> Detailed breakdown lives in `docs/architecture.md` but the tree above is the quick reference.

---

## 2. Import Direction Rules

| Layer   | Allowed Dependencies          | Forbidden |
|---------|--------------------------------|-----------|
| `core`  | —                              | Everyone  |
| `shared`| `core`, `shared`               | `modules`, `app` |
| `modules/*` | `core`, `shared`, own module | Other `modules/*` directly, `app` |
| `app`   | All layers                     | Cannot be imported by others |

Enforced by `eslint-plugin-boundaries` (see `.eslintrc.js`).

---

## 3. Memory Bank Pattern (per module)

```
modules/<feature>/memory/
├─ store.ts        # Zustand/Redux style state holder
├─ controller.ts   # Mutations, async flows
└─ selectors.ts    # Pure derived-state helpers
```

Principles:
1. Serializable state only.
2. No React imports inside memory.
3. Automatic cleanup on navigation when appropriate.

---

## 4. Update workflow

1. Change code / move folders.
2. Update this file **and** `docs/architecture.md`.
3. Run `yarn lint` – boundary checks must still pass.
4. Commit. 