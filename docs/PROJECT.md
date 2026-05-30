# Kenergy Loop

Kenergy Loop is a smart home energy-saving assistant. It helps households
build an energy profile, generate an Energy-Saving Plan, scan rooms for appliance
hotspots, monitor usage, and share savings results.

## Stack

- TanStack Start, TanStack Router, React, Vite
- Tailwind CSS and Radix-style UI components
- Supabase Auth, database, row-level security, and storage
- Google Gemini API for structured recommendation generation
- Recharts for monitoring dashboards
- Docker Compose for local development

## Model Provider

All app model-backed features call Gemini directly through the OpenAI-compatible Gemini
endpoint:

```text
https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
```

Required environment variables:

```env
GEMINI_API_KEY=
KENERGY_AI_MODEL=gemini-2.5-flash
```

The main energy insight server functions are:

- `src/lib/action-plan.functions.ts`
- `src/lib/deep-diagnosis.functions.ts`
- `src/lib/scan.functions.ts`

## Main Routes

| File | URL | Purpose |
| --- | --- | --- |
| `src/routes/index.tsx` | `/` | Landing page |
| `src/routes/login.tsx` | `/login` | Supabase email/password and Google login |
| `src/routes/profile.tsx` | `/profile` | Account dashboard |
| `src/routes/survey.tsx` | `/survey` | Quick energy survey |
| `src/routes/long-form.tsx` | `/long-form` | Paid deep analysis workspace |
| `src/routes/scan.tsx` | `/scan` | Room photo upload |
| `src/routes/scan_.result.tsx` | `/scan/result` | room analysis result |
| `src/routes/recommendations.tsx` | `/recommendations` | Energy-Saving Plan |
| `src/routes/monitoring.tsx` | `/monitoring` | Consumption dashboard |
| `src/routes/pricing.tsx` | `/pricing` | Pricing and waitlist |
| `src/routes/s.$slug.tsx` | `/s/:slug` | Public savings share card |
| `src/routes/k.$slug.tsx` | `/k/:slug` | Public smart kit page |

## Database

Supabase migrations define the product tables, including:

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

All user-owned tables should remain protected with row-level security.

## Local Development

Run with Docker:

```bash
docker compose up --build
```

Then open:

```text
http://localhost:3000
```

After dependency or Docker changes, rebuild. For normal source edits, keep the
container running and rely on Vite hot reload.
