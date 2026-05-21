# Manna

A social platform for sharing scripture study experiences within The Church of Jesus Christ of Latter-day Saints.

Share the inspiration, insights, and reflections you feel while studying the scriptures. Rather than hosting scripture text directly, Manna links to the official site (churchofjesuschrist.org) via deep links.

> [日本語 README](README.ja.md)

---

## Tech Stack

| Role | Technology |
|---|---|
| Frontend | TanStack Start (TypeScript / Vite / SSR) |
| UI Components | shadcn/ui (Radix UI + Tailwind CSS v4) |
| Backend / DB | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Authentication | Google OAuth (via Supabase Auth) |
| Frontend Architecture | Feature Sliced Design (FSD) |
| Testing | Vitest + @testing-library/react |
| Dev Environment | devbox (Node.js 24 + pnpm 9 managed via Nix) |

---

## Directory Structure

```
manna/
├── apps/
│   └── pwa/              # TanStack Start PWA (@manna/pwa)
│       ├── pages/        # Route definitions (routesDirectory) and FSD pages layer
│       ├── widgets/      # Composite UI blocks
│       ├── features/     # User interactions and business logic
│       ├── entities/     # Business entities (post / user / scripture)
│       └── shared/       # Shared infrastructure (supabase / auth / shadcn/ui)
├── packages/
│   └── database/         # Supabase-generated TypeScript types (@manna/database)
└── supabase/
    └── migrations/       # Supabase CLI migrations
```

The `@/` alias points to `apps/pwa/`. Each slice exposes its public API via `index.ts`; all external imports must go through `index.ts`.

---

## Setup

### Prerequisites

- [devbox](https://www.jetify.com/devbox) installed
- Access to a Supabase project

### Environment Variables

Create `apps/pwa/.env.local` with the following:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Install and Start

```bash
# Install devbox if not already installed
curl -fsSL https://get.jetify.com/devbox | bash

# Install packages and start the dev server
devbox install
devbox run dev
```

To work directly inside the devbox shell:

```bash
devbox shell
pnpm install
pnpm dev
```

The development server starts at http://localhost:3000.

---

## Testing

```bash
# Run all tests
pnpm test

# Watch mode
pnpm --filter @manna/pwa test -- --watch
```

---

## Implementation Plan & Task Tracking

The detailed implementation plan is documented in [`docs/superpowers/plans/2026-05-19-manna-phase1.md`](docs/superpowers/plans/2026-05-19-manna-phase1.md).

Tasks are tracked via GitHub Issues and should be worked on in dependency order:

1. [#1 Project Setup](https://github.com/dashi296/manna/issues/1)
2. [#2 Supabase Schema + RLS + Triggers](https://github.com/dashi296/manna/issues/2)
3. [#3 Supabase Client + Authentication](https://github.com/dashi296/manna/issues/3)
4. [#4 Scripture Data + URL Builder](https://github.com/dashi296/manna/issues/4)
5. [#5 Scripture Navigator Screen](https://github.com/dashi296/manna/issues/5)
6. [#6 Post Creation Screen](https://github.com/dashi296/manna/issues/6)
7. [#7 Feed Screen + PostCard](https://github.com/dashi296/manna/issues/7)
8. [#9 Follow + Family Feature](https://github.com/dashi296/manna/issues/9)
9. [#10 Profile Screen](https://github.com/dashi296/manna/issues/10)
10. [#11 Notifications Screen](https://github.com/dashi296/manna/issues/11)
11. [#12 Post Detail Screen](https://github.com/dashi296/manna/issues/12)
12. [#13 PWA Configuration](https://github.com/dashi296/manna/issues/13)
