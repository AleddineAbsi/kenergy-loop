# Kenergy

Kenergy is a hackathon prototype for a renter-first energy saving assistant. It helps people understand the energy footprint of a room or home, get realistic saving actions, and track improvements over time without needing to own the building or install expensive infrastructure.

## Hackathon Problem

Most energy tools are built for homeowners, renovation projects, solar panels, heat pumps, or users who already have smart meters. Renters have a different problem:

- They pay electricity and heating bills, but often cannot renovate.
- They do not know which actions actually save money.
- Landlord approval can be slow or unclear.
- Many homes do not have smart meters or smart-home dashboards.
- Energy advice is often generic, technical, or not actionable.

Kenergy tries to solve this by acting like a digital energy consultant:

1. Collect simple user data, photos, bills, or meter readings.
2. Analyze visible devices, heating context, home profile, and consumption clues.
3. Identify practical saving opportunities.
4. Recommend actions sorted by friction, cost, ownership constraints, and saving potential.
5. Help users follow through with landlord emails, technician context, product documentation, and monitoring.

## What The App Does

- Room photo scan: upload a room photo and get a visible energy footprint estimate.
- Germany comparison: see whether the room appears more energy-heavy than typical comparable rooms.
- 60-second survey: answer a short free profile survey and get immediate AI recommendations.
- Free action plan: get low-friction saving actions first, before paid or complex actions.
- Deep analysis: generate a more complete AI diagnosis with product picks and a compatible smart-home kit.
- Landlord and technician workflow: preview landlord emails, choose fake demo technicians, and access technical documentation previews.
- Monitoring dashboard: simulate manual readings, appliance usage, alerts, weekly trends, and monthly estimates.
- Shareable pages: show savings and kit previews in a judge/demo-friendly way.

## Technology Stack

Frontend:

- React
- TanStack Start
- Vite
- Tailwind CSS
- Recharts
- lucide-react icons

Backend and data:

- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Supabase Row Level Security
- TanStack server functions

AI:

- Google Gemini API
- Image analysis for room scans
- Structured AI output for survey estimates and deep diagnosis
- Mock/demo fallbacks in some UI areas to keep the hackathon demo understandable

DevOps:

- Docker
- Docker Compose
- Bun runtime inside the container

## AI Architecture

Kenergy does not rely on one giant prompt. The product is split into focused AI and rules-driven flows:

- Room scan agent: reads a room image and extracts visible energy clues.
- Survey estimate: uses 6 quick answers to estimate current usage and saving potential.
- Recommendation logic: sorts actions by cost, effort, permission, and expected impact.
- Deep diagnosis: produces product picks, a compatible ecosystem kit, and follow-up steps.
- Demo support workflows: generate landlord email previews, technician context, and product documentation previews.

The guiding principle is:

```text
Rules decide. AI explains. More data improves confidence.
```

## Requirements

- Docker Desktop
- Google Gemini API key from Google AI Studio
- Supabase project
- Bun, only if running without Docker

## Environment Variables

Create a local `.env` file:

```bash
cp .env.example .env
```

Fill in the required values:

```env
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
GEMINI_API_KEY=
KENERGY_AI_MODEL=gemini-2.5-flash
```

Optional:

```env
RESEND_API_KEY=
```

Do not commit `.env`. Each person testing the project should add their own API keys locally.

## Run With Docker

From the project folder:

```bash
cd kenergy-launchpad
docker compose up --build
```

Open:

```text
http://localhost:3000
```

For normal frontend edits, keep Docker running and let Vite hot reload the app. If you change dependencies, Docker files, or environment configuration, rebuild:

```bash
docker compose up --build
```

If the container is already running and you only changed `.env`:

```bash
docker compose restart app
```

## Run Without Docker

```bash
cd kenergy-launchpad
bun install
bun run dev --host 0.0.0.0 --port 3000
```

Then open:

```text
http://localhost:3000
```

## Useful Pages

- `/` — main product landing page
- `/scan` — room scan upload
- `/scan/result` — room scan result
- `/survey` — free 60-second energy profile
- `/recommendations` — AI action plan
- `/long-form` — deeper analysis workspace
- `/monitoring` — monitoring dashboard
- `/pricing` — pricing and monetization page

## Project Documentation

- `docs/PRODUCT_BRIEF.md` — product vision and MVP scope
- `docs/ARCHITECTURE.md` — technical architecture
- `docs/PROJECT.md` — compact project notes
- `DOCKER.md` — Docker-specific setup notes

## Important Disclaimer

Kenergy is a hackathon prototype, not a certified energy audit. Photo-based analysis is only a visible estimate, not a real meter reading. Savings are approximate and should become more accurate when users add bills, meter readings, photos, and completed actions. Electrical, heating, or building work should be handled by qualified professionals.
