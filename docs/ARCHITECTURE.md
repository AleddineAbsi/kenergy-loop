# Kenergy Loop Architecture Reference

Companion product strategy: `docs/PRODUCT_BRIEF.md`. Use that file for product positioning, demo priorities, recommendation principles, and confidence/disclaimer rules.

This file is the working map for future changes. It reflects the current direction: Supabase for auth/data/storage, Gemini for model-backed recommendations, Docker Compose for local dev.

## Product Identity

Kenergy Loop is a smart home energy-saving assistant. The app should be described as:

- Smart home energy-saving assistant
- home energy profile builder
- Energy-Saving Plan generator
- room/appliance scan assistant
- monitoring and savings dashboard

Avoid framing it as only a room scanner. Scan-a-Room is a secondary feature that feeds the broader energy plan.

## Runtime Stack

- Frontend/server framework: TanStack Start, TanStack Router, React
- Build/dev server: Vite
- Styling: Tailwind CSS v4, Radix-style UI components
- Auth/data/storage: Supabase
- Model provider: Google Gemini API through OpenAI-compatible chat completions
- Charts: Recharts
- Local runtime: Docker Compose

## Environment Variables

Required for normal app runtime:

```env
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
GEMINI_API_KEY=
KENERGY_AI_MODEL=gemini-2.5-flash
```

Optional:

```env
RESEND_API_KEY=
```

Do not add provider-specific gateway keys or legacy gateway URLs. The app should use `GEMINI_API_KEY` for model calls.

## Energy Insight Dependency Map

### Quick Survey Estimate

File: `src/lib/survey-estimate.functions.ts`

Purpose: Generates a structured estimate from guest or signed-in quick survey answers.

Depends on:

- `GEMINI_API_KEY`
- `KENERGY_AI_MODEL`
- Gemini OpenAI-compatible endpoint

Used by:

- `src/routes/survey.tsx`

Change here when:

- Survey result estimates are wrong
- Estimate tool schema changes
- You want to adjust conservative savings assumptions

### Energy-Saving Plan

File: `src/lib/action-plan.functions.ts`

Purpose: Reads signed-in user's survey and long-form data, asks Gemini for structured recommendations and a smart-home kit, then caches the plan in Supabase.

Depends on:

- `requireSupabaseAuth`
- `survey_responses`
- `long_form_responses`
- `ai_action_plans`
- `GEMINI_API_KEY`
- `KENERGY_AI_MODEL`

Used by:

- `src/routes/recommendations.tsx`

Change here when:

- Recommendation schema changes
- Prompt logic changes
- Cache invalidation changes
- You want scan results to influence saving plans

### Deep Energy Check

File: `src/lib/deep-diagnosis.functions.ts`

Purpose: Paid/deep Energy Check with concrete product picks, tiers, ecosystem kit, and saved history.

Depends on:

- `requireSupabaseAuth`
- `consumeDiagnosisCredit` from `src/lib/access.functions.ts`
- `survey_responses`
- `long_form_responses`
- `long_form_uploads`
- `deep_diagnoses`
- `GEMINI_API_KEY`
- `KENERGY_AI_MODEL`

Used by:

- `src/routes/long-form.tsx`

Change here when:

- Deep Analysis product output changes
- Credit-spend behavior changes
- Product tier schema changes

### Room Scan

File: `src/lib/scan.functions.ts`

Purpose: Takes a private Supabase Storage room image path, signs it, sends image + prompt to Gemini, stores structured scan analysis.

Depends on:

- `requireSupabaseAuth`
- Supabase Storage bucket `room-scans`
- `room_scans` table
- `GEMINI_API_KEY`
- `KENERGY_AI_MODEL`

Used by:

- `src/routes/scan.tsx`
- `src/routes/scan.result.tsx`

Change here when:

- Image analysis schema changes
- Appliance detection prompt changes
- Storage path/security behavior changes

### RAG Helpers

File: `src/lib/rag.server.ts`

Purpose: Local deterministic embedding helper for knowledge table utilities. It no longer calls an external embedding gateway.

Depends on:

- `supabaseAdmin`
- `knowledge_chunks`
- Postgres RPC `match_knowledge_chunks`

Used by:

- `src/lib/rag.functions.ts`
- Future action-plan grounding if re-enabled

Change here when:

- You add a real embedding provider
- You change the vector dimensions in Supabase
- You change the knowledge retrieval RPC

## Auth And Access Map

### Auth Provider

File: `src/hooks/use-auth.tsx`

Purpose: Client auth context around Supabase session and sign-out.

Used by most routes and `SiteNav`.

### Server Auth Middleware

File: `src/integrations/supabase/auth-middleware.ts`

Purpose: Reads bearer token from server function request, creates RLS-scoped Supabase client, exposes `userId` and claims.

Used by all protected server functions.

### Access / Roles / Credits

File: `src/lib/access.functions.ts`

Purpose: Reads roles/entitlements, grants demo deep analysis, consumes analysis credits, seeds demo accounts.

Depends on:

- `user_roles`
- `entitlements`
- `survey_responses`
- `supabaseAdmin` for demo account creation

Used by:

- `src/hooks/use-access.tsx`
- `src/routes/login.tsx`
- `src/routes/long-form.tsx`
- `src/routes/monitoring.tsx`
- `src/routes/checkout.deep-analysis.tsx`
- `src/lib/deep-diagnosis.functions.ts`

## Route Map

- `/`: `src/routes/index.tsx` landing page
- `/login`: `src/routes/login.tsx` Supabase email/password + Google OAuth + demo accounts
- `/profile`: `src/routes/profile.tsx` signed-in profile page
- `/survey`: `src/routes/survey.tsx` quick survey and estimate
- `/long-form`: `src/routes/long-form.tsx` deep analysis workspace/paywall
- `/checkout/deep-analysis`: `src/routes/checkout.deep-analysis.tsx` simulated one-time purchase
- `/recommendations`: `src/routes/recommendations.tsx` Energy-Saving Plan
- `/scan`: `src/routes/scan.tsx` private image upload
- `/scan/result`: `src/routes/scan.result.tsx` room scan results
- `/monitoring`: `src/routes/monitoring.tsx` paid/admin monitoring dashboard
- `/admin/monitoring`: `src/routes/admin.monitoring.tsx` admin fleet view
- `/pricing`: `src/routes/pricing.tsx` pricing/waitlist intents
- `/settings`: `src/routes/settings.tsx` account/settings
- `/s/:slug`: `src/routes/s.$slug.tsx` public savings card
- `/k/:slug`: `src/routes/k.$slug.tsx` public smart kit page

## Data Helpers

- `src/lib/responses.ts`: save/load survey and long-form responses
- `src/lib/phase4.ts`: readings, share cards, pricing intents
- `src/lib/kits.ts`: save/load public smart kits
- `src/lib/long-form-uploads.ts`: private upload metadata and storage helpers
- `src/lib/affiliates.ts`: affiliate URL helpers

## Supabase Tables

Core tables:

- `profiles`
- `survey_responses`
- `long_form_responses`
- `ai_action_plans`
- `room_scans`
- `smart_kits`
- `energy_readings`
- `share_cards`
- `pricing_intents`
- `knowledge_chunks`
- `user_roles`
- `entitlements`
- `long_form_uploads`
- `deep_diagnoses`

Storage buckets:

- `room-scans`
- `bill-uploads`

Rules:

- User-owned tables should be RLS protected by `auth.uid()`.
- Public share tables need explicit public read policy but owner-only writes.
- Private storage paths should start with the user ID.

## Docker Map

- `Dockerfile`: Bun-based dev/build/preview stages
- `docker-compose.yml`: runs dev server on port 3000 and reads `.env`
- `.dockerignore`: excludes secrets, local cache, node modules, build output, and git metadata
- `DOCKER.md`: command reference

Normal dev command:

```bash
docker compose up --build
```

After source-only changes, keep Compose running and rely on Vite hot reload. Rebuild after dependency, Docker, or env-shape changes.

## Change Checklist

When changing model-backed behavior:

1. Identify which server function owns the feature.
2. Update the tool schema and TypeScript type together.
3. Update the route rendering that consumes the type.
4. Make sure errors surface as friendly messages.
5. Rebuild Docker if dependencies or environment variable names changed.

When changing auth/access:

1. Check `use-auth.tsx`, `use-access.tsx`, and `access.functions.ts`.
2. Confirm server functions use `requireSupabaseAuth` when user data is touched.
3. Confirm guest paths still work where intended.

When changing database shape:

1. Add a Supabase migration.
2. Add RLS policies and grants.
3. Update helper functions in `src/lib`.
4. Update route UI and loading/error states.

When removing provider-specific code:

1. Search all source/docs/config for provider name and env var.
2. Check `package.json`, lockfiles, Dockerfile, env examples, and docs.
3. Rebuild Docker with `--no-cache`.
