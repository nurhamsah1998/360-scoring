# 360 Scoring

Multi-organization 360° performance feedback app: a person is reviewed by their manager, peers, direct reports and themselves, and the report compares how each group rates the same skills — with peer and direct-report groups kept anonymous.

See [docs/PRD.md](docs/PRD.md) for the full product spec.

## Stack

React + Vite + TypeScript · Tailwind CSS v4 · TanStack Query · react-i18next (EN/ID) · Supabase (Postgres + RLS, Auth) · Netlify

## Local development

```bash
cp .env.example .env   # fill in your Supabase URL and publishable key
npm install
npm run dev
```

Database migrations live in `supabase/migrations/` and are applied in order.
Edge functions live in `supabase/functions/` (`invite-members` sends invitations with the service role).

## Status

- [x] Phase 1 — Foundation: auth, organizations, base schema + RLS
- [x] Phase 2 — Members, invitations, CSV import
- [x] Phase 3 — Templates, cycles, nominations
- [x] Phase 4 — Reviews
- [x] Phase 5 — Reports
- [ ] Phase 6 — Demo mode & polish
