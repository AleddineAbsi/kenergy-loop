# Kenergy Loop

Kenergy Loop is a hackathon prototype for renter-first energy savings. It was built during a hackathon sprint around a simple problem: renters pay energy bills, but most energy tools assume home ownership, renovations, smart meters, or expensive upgrades.

Kenergy Loop starts with low-friction inputs, then turns them into practical saving actions, product suggestions, and monitoring.

## What It Does

- Scan a room photo and estimate visible appliance energy load.
- Run a free 60-second Energy Profile survey.
- Generate an Energy-Saving Plan ranked by friction, cost, permission, confidence, and yearly saving.
- Offer deeper analysis with product recommendations, landlord email previews, technician flow mockups, and smart-home bundle suggestions.
- Show a monitoring dashboard with simulated appliance loads, weekly trends, alerts, recent readings, and replacement suggestions.
- Support light and dark mode.

## How Decisions Work

The product is designed to avoid vague advice:

1. Collect: room photos, survey answers, optional bills, notes, readings, and appliance clues.
2. Estimate: benchmark current usage and visible device load.
3. Rank: sort actions from easiest to hardest, cheapest to most expensive, and renter-controlled to landlord/technician-required.
4. Explain: show savings, confidence, sources, and next steps.
5. Improve: more data increases confidence and makes recommendations sharper.

Rule of thumb:

```text
Rules rank. Models explain. User data improves confidence.
```

## Business Model

Free:

- Room scan
- 60-second Energy Profile
- Basic Energy-Saving Plan

Paid or monetized:

- Deeper Energy Check
- Monitoring history and alerts
- Monthly reports
- Landlord/technician support packs
- Sponsored product bundles or affiliate marketplace revenue

## Stack

- React 19, TanStack Start, TanStack Router
- Tailwind CSS, Recharts, lucide-react
- Supabase Auth, Postgres, Storage, RLS
- TanStack server functions
- Gemini API for model-backed structured estimates
- Docker Compose and Bun

## Environment

Create `.env` from the example:

```bash
cp .env.example .env
```

Required values:

```env
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
GEMINI_API_KEY=
KENERGY_AI_MODEL=gemini-2.5-flash
```

Each tester should use their own Supabase project and Gemini key.

## Run The Demo

From the project folder:

```bash
docker compose up --build
```

Open:

```text
http://localhost:3000
```

For normal UI/code edits, keep Docker running and let Vite hot reload. If you change `.env`, restart:

```bash
docker compose restart app
```

Without Docker:

```bash
bun install
bun run dev --host 0.0.0.0 --port 3000
```

## Approximate Credit Usage

Actual usage depends on image size and response length, but typical successful calls are:

| Flow | Approx. usage |
| --- | ---: |
| Room scan | image + ~700-1,200 output tokens |
| 60-second survey | ~500-900 input, ~400-900 output tokens |
| Energy-Saving Plan | ~700-1,500 input, ~1,000-2,000 output tokens |
| Deep Energy Check | ~1,500-4,000 input, ~1,500-3,500 output tokens |

The app keeps calls separated so a quick survey does not pay for the deeper analysis flow. Some demo UI, such as technician selection and email previews, is mocked and does not spend credits.

## Main Pages

- `/` landing page
- `/scan` room scan
- `/survey` quick Energy Profile
- `/recommendations` Energy-Saving Plan
- `/long-form` Deep Analysis workspace
- `/monitoring` monitoring dashboard
- `/pricing` monetization page

## License

MIT License. Use it, fork it, modify it, reuse the idea, or build something commercial from it. No permission needed.

## Disclaimer

Kenergy Loop is a hackathon MVP, not a certified audit. Photo scans are estimates, savings are approximate, and electrical/heating/building work should be handled by qualified professionals.
