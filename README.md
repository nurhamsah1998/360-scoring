# 360 Scoring

A multi-organization **360° performance feedback** app. Each person is reviewed by their manager, peers, direct reports and themselves; the report compares how each group rates the same skills — while keeping peer and direct-report answers anonymous.

**Live demo:** https://360-scoring.netlify.app — open it as an Admin, a Manager or an Employee in one click (data resets daily at 03:00 WIB).

## What it does

| Area | Highlights |
|---|---|
| Organizations | Sign up, create an organization, switch between several. Bilingual UI (English / Indonesian). |
| People | Invite by email or import a CSV (with a validated preview), set each person's manager, roles, deactivate. |
| Templates | Default 5-skill template per organization; editor for skills and 1–5 statements. |
| Cycles | Draft → Nominations → Reviews → Closed → Released. The template and reporting lines are frozen when a cycle starts. |
| Nominations | Participants pick peers (min/max), their manager approves; managers and direct reports review automatically. |
| Reviews | 1–5 or “not able to rate” per statement, optional comments, autosave, submit when complete. |
| Reports | Self vs. others, radar by skill, per-statement scores, blind spots / hidden strengths, anonymous comments, print. |
| Notifications | In-app bell for stage changes and nomination decisions. |

## Privacy model

Enforced in Postgres (Row Level Security + `SECURITY DEFINER` functions), not just in the UI:

- Raw answers are readable only by the person who wrote them — not by admins, not by the person being reviewed.
- Reports come from `get_report`, which returns aggregates only, and only to admins / the participant's manager once a cycle is closed, or to the participant after release.
- Peer and direct-report groups are omitted entirely (scores **and** comments) until at least 3 people in that group have submitted.
- “Others” combines the manager with *visible* anonymous groups only, so a hidden group can't be worked out by subtraction.
- Comments carry their group, never their author.

## Stack

React 19 + Vite + TypeScript · Tailwind CSS v4 · TanStack Query · react-i18next · Supabase (Postgres, RLS, Auth, Edge Functions, pg_cron) · Netlify

## Project layout

```
src/
  pages/        route components (Landing, Cycles, ReviewForm, Report, …)
  components/   UI pieces (RadarChart, NominationPanels, NotificationBell, …)
  lib/          data hooks per area (cycles, reviews, report, members, …)
  i18n/         en.json, id.json
supabase/
  migrations/   0001–0008, applied in order
  functions/    invite-members (service-role invitations)
docs/PRD.md     product requirements
```

## Local development

```bash
cp .env.example .env   # Supabase URL + publishable key
npm install
npm run dev
```

Apply `supabase/migrations/*` in order to a fresh Supabase project and deploy `supabase/functions/invite-members`. In Supabase → Authentication → URL Configuration, set the Site URL to your app's URL and add `<your-url>/**` to the redirect URLs.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@demo.360scoring.app | demo-360-scoring |
| Manager | manager@demo.360scoring.app | demo-360-scoring |
| Employee | employee@demo.360scoring.app | demo-360-scoring |

They only belong to the demo organization, which can't send emails and is rebuilt every day by `private.reset_demo()` (pg_cron).

## Status

- [x] Phase 1 — Foundation: auth, organizations, base schema + RLS
- [x] Phase 2 — Members, invitations, CSV import
- [x] Phase 3 — Templates, cycles, nominations
- [x] Phase 4 — Reviews and notifications
- [x] Phase 5 — Reports
- [x] Phase 6 — Demo mode & polish
