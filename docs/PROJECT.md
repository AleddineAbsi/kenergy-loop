# Kenergy Loop — Project Structure & Logic

## What Kenergy is

Kenergy is an **AI energy optimizer for smart home appliances**. It is NOT a
"scan-your-room challenge". The product helps households (renters first)
lower their electricity bill and CO₂ footprint by:

1. Building a lightweight **energy profile** of the home and its smart
   appliances (heating, hot water, lighting, fridge, washer, dryer, AC,
   standby devices, EV charger, etc.).
2. Running an **AI action plan** that ranks personalized optimizations
   (schedules, setpoints, standby cuts, tariff-aware usage) by € saved
   and kg CO₂ avoided.
3. Letting the user **monitor** consumption over time and **share** results.

### Core terminology (use consistently in copy)

- **Smart home appliances** — connected devices we optimize.
- **AI action plan** — personalized list of optimizations.
- **Energy profile** — the household data we collect.
- **Quick survey** — the 60-second onboarding form.
- **Long-form profile** — the detailed multi-step appliance questionnaire.
- **Scan-a-Room** — optional photo scan to spot appliance hotspots.
- **Estimated savings** — €/year and kWh/year projection.
- **Energy score** — A–G grade for the home.

## Routes (file-based, TanStack Start)

| File                          | URL                | Purpose                                    |
| ----------------------------- | ------------------ | ------------------------------------------ |
| `src/routes/__root.tsx`       | layout shell       | Wraps app in QueryClient + AuthProvider    |
| `src/routes/index.tsx`        | `/`                | Landing — value prop + savings estimator   |
| `src/routes/login.tsx`        | `/login`           | Email/password + Google sign-in            |
| `src/routes/profile.tsx`      | `/profile`         | Authenticated account + profile dashboard  |
| `src/routes/survey.tsx`       | `/survey`          | 60-second Quick survey (autosaved if auth) |
| `src/routes/long-form.tsx`    | `/long-form`       | Deep questionnaire (autosaved if auth)     |
| `src/routes/scan.tsx`         | `/scan`            | Scan-a-Room upload                         |
| `src/routes/scan.result.tsx`  | `/scan/result`     | Energy score + share card                  |
| `src/routes/recommendations.tsx` | `/recommendations` | AI action plan with category filters    |
| `src/routes/monitoring.tsx`   | `/monitoring`      | Weekly consumption + anomaly alerts        |
| `src/routes/pricing.tsx`      | `/pricing`         | Free / Monitor / Household tiers           |
| `src/routes/settings.tsx`     | `/settings`        | Account & preferences                      |

## Page flow

```
Landing (/)
  ├─► Sign in (/login) ─► Profile (/profile)
  ├─► Quick survey (/survey, 60s) ─┐
  │     └─► AI action plan (/recommendations)
  ├─► Long-form profile (/long-form) ─┘
  ├─► Scan-a-Room (/scan) ─► /scan/result ─► /recommendations
  └─► Monitoring (/monitoring)
```

Every page (except /login) is wrapped by `SiteNav` (top bar) and `SiteFooter`.

## Auth (Phase 2)

- **Provider stack**: Lovable Cloud (Supabase) — email/password + managed
  Google OAuth via `@/integrations/lovable/index` (`lovable.auth.signInWithOAuth`).
- **Client**: `src/integrations/supabase/client.ts` (auto-generated, never edit).
- **Auth context**: `src/hooks/use-auth.tsx` exposes `useAuth()` returning
  `{ user, session, loading, signOut }`. Mounted via `<AuthProvider>` in
  `src/routes/__root.tsx`. Listens to `onAuthStateChange`.
- **Server-side**: `src/start.ts` registers `attachSupabaseAuth` global
  function middleware so future server fns receive the user bearer token.
- Auth state is **soft-gated**: surveys and long-form work for guests too,
  but show a "Sign in to save" CTA. Only `/profile` redirects to `/login`
  if unauthenticated (client-side redirect).

## Database (Lovable Cloud)

Tables (all RLS-protected, `auth.uid()` scoped):

| Table                  | Purpose                                       |
| ---------------------- | --------------------------------------------- |
| `profiles`             | display_name, avatar_url. Auto-created on signup via `handle_new_user` trigger. |
| `survey_responses`     | `answers jsonb`, `seconds_taken`. One row per user, upserted by `saveSurveyResponse`. |
| `long_form_responses`  | `answers jsonb`, `progress int`. Debounced autosave from `/long-form`. |

Helper: `src/lib/responses.ts` exposes `saveSurveyResponse`,
`loadSurveyResponse`, `saveLongFormResponse`, `loadLongFormResponse`. All
no-op silently when the user is not signed in.

Internal SQL helpers:
- `handle_new_user()` — SECURITY DEFINER trigger on `auth.users` insert.
- `set_updated_at()` — BEFORE UPDATE trigger on all tables.

## Shared components

- `src/components/site-nav.tsx` — top nav + footer. Nav links: Scan-a-Room,
  Quick Survey, Long-form, Actions, Monitor, Pricing, Settings. Shows
  Sign in / Sign out + email based on `useAuth()`. Mobile hamburger sheet.
- `src/lib/mock-data.ts` — mock recommendations & weekly readings (used
  until Phase 3 wires the real AI plan).

## Design system

- Tokens live in `src/styles.css` (oklch). Use semantic tokens only:
  `bg-primary`, `text-foreground`, `border-border`, etc.
- Gradients/shadows: `--gradient-hero`, `--shadow-soft`, `--shadow-glow`.

## Quick survey result screen (`/survey` after completion)

After the 6 questions, `ResultScreen` renders three blocks:

1. **Hero estimate** — large `€/year savings` headline (5xl–6xl), plus
   `kWh saved` and `kg CO₂ avoided`. Computed by `estimateFromAnswers()`
   which maps size band → rooms/windows/heating points/base bill, then
   applies a 14–24% savings rate based on heating type, winter temp and
   standby behavior. NO countdown timer is shown anywhere in the survey —
   only the progress bar tracks completion. Elapsed seconds are still
   recorded into `survey_responses.seconds_taken` for analytics.
2. **Deeper analysis tease** — short card linking to `/long-form` with copy:
   "Continue with our deeper analysis to unlock our most advanced
   custom-fitted smart home systems, designed specifically for your space."
3. **AI-curated smart home kit preview** — itemized list (smart TRVs,
   motion/presence sensors, energy-metering plugs, Zigbee/Matter hub)
   sized from the survey-derived rooms/windows/heating points and standby
   count. Each line shows qty, example compatible brands, indicative price,
   and rationale. Subtotal at the bottom. A dashed-border footer reminds
   the user this is a quick AI sketch and that the deeper profile lets the
   LLM cross-check compatibility, budget and promos to assemble an
   orderable multi-brand kit (no vendor lock-in). Soft framing — never
   aggressive upsell.

Kit estimator lives inline in `src/routes/survey.tsx` (`estimateFromAnswers`
+ `kit` useMemo). When Phase 3 wires the real Lovable AI Gateway, the kit
generation should move to a server fn that consumes both `survey_responses`
and `long_form_responses` and returns the same shape.

## Phases

- **Phase 1 (done)** — UI scaffold, mock data, routing, design system,
  landing savings estimator.
- **Phase 2 (done)** — Lovable Cloud + auth (email + Google), `profiles`,
  `survey_responses`, `long_form_responses` tables with RLS, autosave from
  survey/long-form, `/profile` dashboard, sign in/out in nav.
- **Phase 2.1 (done)** — Survey result screen redesign: removed 60s
  countdown, added hero savings headline, deeper-analysis tease, and
  AI-curated smart home kit preview sized from survey answers.
- **Phase 3 (done)** — Real AI action plan via Lovable AI Gateway. Server fn
  `generateActionPlan` in `src/lib/action-plan.functions.ts` reads the user's
  `survey_responses` + `long_form_responses` (RLS-scoped via
  `requireSupabaseAuth`), calls `google/gemini-3-flash-preview` through
  `https://ai.gateway.lovable.dev/v1/chat/completions` with a forced
  `return_action_plan` tool call (structured output), and caches the result in
  the new `ai_action_plans` table keyed by `inputs_hash` (sha256 of the
  inputs). The cache busts automatically when survey/long-form answers change;
  the Regenerate button on `/recommendations` calls the fn with `force: true`.
  `/recommendations` uses TanStack Query (`["ai-action-plan", userId]`,
  `staleTime` 5 min) to fetch the plan, falls back to `mockRecommendations`
  for signed-out guests, and renders the AI's `recommendations` + curated
  `smart_home_kit` (compatibility-checked multi-brand). 402/429 from the
  gateway surface as friendly toasts via the error banner.
- **Phase 4 (done)** — Monitoring with reading/bill ingest, public share cards,
  pricing waitlist.
  - New tables (`supabase/migrations/...phase4...sql`):
    - `energy_readings` — per-user RLS, owner-only. Columns: `reading_date`,
      `kwh`, `cost_eur?`, `source` (`manual` | `bill`), `note?`.
    - `share_cards` — public read (anon + authenticated), owner-only writes.
      Columns: `slug` (unique), `display_name?`, `savings_eur`, `kwh_saved`,
      `co2_saved_kg`, `headline?`.
    - `pricing_intents` — owner-only RLS. Columns: `tier`.
  - Client helpers in `src/lib/phase4.ts`: `listReadings`, `addReading`,
    `deleteReading`, `createShareCard` (8-char slug from `crypto.getRandomValues`),
    `getShareCardBySlug`, `recordPricingIntent`.
  - `/monitoring` (`src/routes/monitoring.tsx`): real persistence — log a reading
    (date, kWh, optional €, source), inline form, weekly aggregation by ISO
    week, week-over-week delta + anomaly alerts (≥20% spike = warn, ≤−10% drop
    = info), recent readings list with delete. Empty/guest states included.
  - `/s/$slug` (`src/routes/s.$slug.tsx`): public share-card page. Loader fetches
    by slug (no auth needed because of the public-read RLS policy). `head()`
    sets per-card OG/Twitter meta from loaderData (title = "€X/yr saved",
    description includes kWh + CO₂). CTA back to `/survey` + native
    `navigator.share` (fallback: clipboard).
  - `/recommendations`: added "Share my plan" button (auth-only) that calls
    `createShareCard` with yearly savings from the AI plan and navigates to
    `/s/$slug`.
  - `/pricing` (`src/routes/pricing.tsx`): CTAs on paid tiers record a
    `pricing_intents` row (Stripe is deferred — built-in Lovable Payments
    needs a Pro plan; this is a waitlist for now). Free tier CTA goes to
    `/survey`.
  - Global `Toaster` from `sonner` mounted in `src/routes/__root.tsx` inside
    `AuthProvider` for cross-page feedback (saved/copied/errors).


## Rules for the agent

- Never rename Kenergy as "room scanner". Lead with "AI energy optimizer
  for smart home appliances".
- The 60-second flow on the landing CTA is `/survey`, not `/scan`.
- `Scan-a-Room` is a secondary nav link, not a hero CTA.
- Keep `SiteNav` mobile-friendly (hamburger under `md`).
- Use design tokens, never hardcoded colors.
- Never edit `src/integrations/supabase/{client,client.server,auth-middleware,auth-attacher,types}.ts`
  or `src/integrations/lovable/index.ts` — auto-generated.
- All new tables must have RLS policies and explicit GRANTs to `authenticated`.
- Google sign-in must go through `lovable.auth.signInWithOAuth("google", ...)`,
  NOT `supabase.auth.signInWithOAuth`.

## Phase 5 — Vision scan, shoppable kit, monthly report

### New tables / storage
- `room_scans` — owner-only. Stores `image_path`, `analysis` (JSON), `model`. Drives the rebuilt Scan-a-Room flow.
- `smart_kits` — public read by slug, owner write. Stores `items` + `subtotal_eur` so users can save and share an AI-curated kit.
- Storage bucket `room-scans` — private, RLS scoped to `auth.uid()::text = (storage.foldername(name))[1]`.

### Files
- `src/lib/scan.functions.ts` — `analyzeRoomScan(image_path)` server fn. Signs the storage URL, calls `google/gemini-2.5-flash` with tool-calling (`return_room_analysis`), persists to `room_scans`.
- `src/lib/kits.ts` — `saveKit` / `getKitBySlug` client helpers (8-char URL-safe slug).
- `src/lib/affiliates.ts` — `AFFILIATE_TAG` constant + `amazonSearchUrl(q)` builder + `formatEur`.
- `src/lib/report.functions.ts` — `buildMonthlyReport` (DTO of last 30d) and `emailMonthlyReport` (Resend via `connector-gateway.lovable.dev/resend`, gated on `RESEND_API_KEY`).
- `src/routes/scan.tsx` — rewritten upload UI: file → Supabase Storage → `analyzeRoomScan` → `/scan/result?id=…`.
- `src/routes/scan.result.tsx` — reads `room_scans` row (most recent or `?id=`), shows detected appliances, heating points, standby total, signed preview, top action.
- `src/routes/k.$slug.tsx` — public kit share page with per-item affiliate "View options" links + OG metadata.
- `src/routes/report.tsx` — printable A4 report; "Download PDF" uses `window.print()`; "Email me" calls `emailMonthlyReport`.
- `src/components/site-nav.tsx` — added `/report` link between Monitor and Pricing.

### Notes / follow-ups
- Email path requires `RESEND_API_KEY` runtime secret + the Resend connector enabled in the workspace. Until then, the button shows a toast explaining how to enable it.
- Action-plan cache (`ai_action_plans.inputs_hash`) does NOT yet include the latest `room_scans.id`. Wiring scans into the action-plan prompt + hash is the natural next iteration so a fresh scan auto-regenerates the plan.
- Recommendations page kit list is unchanged; persisting the kit + per-item affiliate buttons there is the next small follow-up using `saveKit` + `amazonSearchUrl`.

## Phase 6 — Roles, paywall & Deep Analysis workspace

- **Roles**: `user_roles` table with `admin | paid | free` enum + `has_role()` SECURITY DEFINER.
- **Entitlements**: `entitlements` table tracks one-time `deep_analysis` purchases with `credits_remaining`.
- **Access hook**: `src/hooks/use-access.tsx` → `useAccess()` returns `{ roles, isAdmin, hasDeepAnalysis, hasMonitorSubscription, diagnosisCredits }`.
- **Demo accounts**: `seedDemoAccounts` server fn provisions `admin@kenergy.demo` (admin+paid, unlimited credits) and `user@kenergy.demo` (free). Two quick-login buttons on `/login`.
- **Paywall**: `/long-form` now shows a rich `PaywallShell` (feature grid + blurred sample diagnosis preview) when the user lacks `hasDeepAnalysis`. `/checkout/deep-analysis` simulates the €19 purchase via `grantDeepAnalysis`.
- **Custom per-section notes**: every long-form accordion section has an extra free-text input (`{sectionId}_custom`) the AI reads verbatim.
- **Generate confirmation**: clicking "Generate diagnosis" opens an "are you sure?" modal warning the user that 1 purchased analysis will be spent and cannot be undone. Admin (`isAdmin === true`) bypasses the modal and has effectively unlimited credits (999 sentinel).
- **Deep diagnosis AI**: `generateDeepDiagnosis` server fn uses `google/gemini-3-flash-preview` with a forced `return_deep_diagnosis` tool call. Output includes 3-tier `product_picks` (budget/balanced/integrated) + optional `ecosystem_kit`. Stored in `deep_diagnoses` so `listMyDiagnoses` can re-render old results without re-spending a credit.
- **Storage**: private `bill-uploads` bucket with per-user folder RLS; `long_form_uploads` table tracks bill/appliance photo metadata.

## Phase 7 — Monitor subscription + simulated fleet

- **Monitor paywall**: `/monitoring` is now gated by `hasMonitorSubscription` (admin OR `paid` role). Free users see a marketing-style paywall: feature grid + blurred sample dashboard (live draw, 24h kWh, deprecated count, 4 simulated device mini-cards).
- **Simulated home for admin/paid**: a "Live appliance fleet" block lists 7 devices (Daikin heat pump, Liebherr 2014 fridge, Bosch washer, Miele dishwasher, LG B7 OLED, go-eCharger EV, home server rack). Three are deliberately deprecated (fridge, OLED, server) with status badges, drift notes, and an inline collapsible "View replacement kit" panel showing the suggested swap + compatible accessory kit (energy meter, sensors, sub-circuit clamp, etc.).
- **Admin parity with `/admin/monitoring`**: the existing admin fleet page stays for the side-panel deep view; `/monitoring` now also surfaces the same simulated household so admins can demo both flows without switching pages.
- **Below the fleet**: the existing reading log / weekly trend / alerts UI is unchanged — admins/paid users still get the original tracker beneath the live fleet.
