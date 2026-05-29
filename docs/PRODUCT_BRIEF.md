# Kenergy Product Brief

This document captures the product direction behind the app and should be used together with `docs/ARCHITECTURE.md` when changing code.

## One-Line Pitch

Kenergy is a renter-first energy savings web app that turns a room photo into a shareable energy score, then helps users build a progressive energy profile, get free energy-saving recommendations, and optionally monitor consumption over time.

## Core Idea

Most energy tools target homeowners, renovations, solar panels, or heat pumps. Kenergy focuses on renters and apartment dwellers who pay energy bills but often cannot renovate, do not know what saves money, and may not have smart meters.

The entry point is intentionally low-friction:

> Take a picture of your room. Get a visible energy footprint estimate. See what makes your room energy-heavy.

Then the app converts curiosity into action:

1. Room photo scan
2. Shareable energy score
3. 60-second energy profile
4. Free recommendations
5. Add more data for better accuracy
6. Consumption dashboard
7. Alerts, reports, and paid monitoring

## Product Differentiators

| Differentiator | Meaning |
| --- | --- |
| Renter-first | Prioritize reversible actions and tenant-safe advice. |
| Photo-first hook | Start with a room scan instead of a long audit form. |
| Free suggestions | Recommendations should build trust and not be hidden behind payment. |
| Progressive profile | Accuracy improves as users add bills, readings, photos, and completed actions. |
| Explainable AI | Every suggestion should say why it applies and how confident it is. |
| Manual-first monitoring | Meter readings and bills work before smart-meter integrations. |
| Paid monitoring, not paid advice | Monetize ongoing tracking, alerts, reports, integrations, and product offers. |

## User Journey

### 1. Viral Room Scan

The user uploads a room photo. The scan estimates visible energy clues, not exact consumption.

Possible detected clues:

| Clue | Interpretation |
| --- | --- |
| Gaming PC | Potentially high electricity load depending on usage hours. |
| Multiple monitors | Medium additional electricity load. |
| Electric heater | High electricity risk. |
| Blocked radiator | Heating inefficiency. |
| Old radiator valve | Control upgrade opportunity. |
| Large window | Possible heat loss or overheating risk. |
| LED lighting | Lower lighting consumption. |
| Window condensation | Humidity or mold risk clue. |
| Air conditioner | Seasonal electricity risk. |
| Dehumidifier | Comfort/mold clue and electricity load. |

Required wording:

> This is a visible energy footprint estimate, not a real meter reading.

### 2. Shareable Result

The result should feel concrete and shareable:

- visible energy score
- country/peer comparison
- confidence level
- detected contributors
- missing information
- CTA to the 60-second profile

Potential score labels:

| Score | Label |
| ---: | --- |
| 0-25 | Energy Monk |
| 26-45 | Pretty Chill |
| 46-65 | Average Power Enjoyer |
| 66-80 | Watt Goblin |
| 81-100 | Grid Final Boss |

Tone note: playful labels are good for demo/shareability, but pair them with honest caveats.

### 3. 60-Second Energy Profile

CTA:

> Want to know what to do about it? Get your personal saving plan in 60 seconds.

Core fields:

| Field | Why |
| --- | --- |
| Country / postal code / city | Climate, benchmarks, subsidies later. |
| Rent or own | Permission-aware recommendations. |
| Living area | Heating multiplier. |
| Household size | Electricity and hot water estimate. |
| Building type | Apartment, house, room, dorm, shared flat. |
| Building age | Archetype and heating intensity. |
| Heating type | Gas, district heating, electric, oil, heat pump, unknown. |
| Hot water type | Central, electric boiler, unknown. |
| Biggest issue | High bill, cold room, drafts, mold, overheating. |
| Monthly cost | Calibration. |
| Budget | Prioritize realistic actions. |

### 4. Free Recommendations

Recommendations are grouped by friction:

| Category | Meaning |
| --- | --- |
| Do now | Free or almost free, no landlord needed. |
| Small helper | Cheap product/action such as smart plug, thermo-hygrometer, LED, sealing tape. |
| Add more info | Upload bill, add meter reading, add usage hours, take another photo. |
| Needs landlord | Window repair, insulation, hydraulic balancing, major building fixes. |
| Monitor | Track usage, set reminders, watch anomalies. |

Each recommendation should include:

- title
- category
- cost or cost range
- effort
- savings potential
- permission requirement
- confidence
- why this applies
- next step
- data that would improve accuracy

## Product Principle

Free advice, paid monitoring.

### Free Tier

- room photo scan
- energy score
- 60-second profile
- free recommendations
- basic product suggestions
- basic landlord/email drafting later

### Paid Tier

- consumption history
- meter reading history
- monthly report
- alerts
- bill upload analysis
- detailed product payback
- landlord proposal pack
- smart plug / smart-home integrations

Suggested pricing direction:

| Plan | Price idea |
| --- | ---: |
| Free | 0 EUR |
| Plus monthly | 2.99 EUR/month |
| Plus yearly | 19.99 EUR/year |
| One-time advanced report | 4.99-9.99 EUR |
| Marketplace revenue | Affiliate/product commission |

## Technical Direction

Use this stack:

| Layer | Tool |
| --- | --- |
| Frontend/server app | TanStack Start + React + Vite |
| Auth | Supabase Auth |
| Database | Supabase Postgres |
| File storage | Supabase Storage |
| Backend logic | TanStack Start server functions |
| RAG/vector search | Supabase pgvector utilities |
| AI provider | Gemini API |
| Charts | Recharts |
| Payments later | Stripe |
| Local dev | Docker Compose |

AI keys must stay server-side. The browser must never receive provider API keys.

## AI Architecture

The AI should not be one giant black box. Keep focused functions:

| Function concept | Current code owner |
| --- | --- |
| room_scan_agent | `src/lib/scan.functions.ts` |
| profile_builder | survey/long-form response helpers and routes |
| generate_recommendations | `src/lib/action-plan.functions.ts` |
| rag_search | `src/lib/rag.server.ts`, `src/lib/rag.functions.ts` |
| bill_parser_agent | future work, probably upload/report path |
| monthly_report_agent | `src/lib/report.functions.ts` |
| landlord_email_agent | future work |
| alert_explainer | monitoring alert helpers |

Main rule:

> Rules decide. RAG supports. LLM explains.

For MVP, do not train a model. Use rules, curated knowledge, and Gemini explanations. Keep mock/demo fallback available where practical to protect presentations.

## RAG Knowledge Strategy

Use curated trusted summaries, not random scraped blogs.

Starter source types:

- DWD heating degree days
- Heizspiegel benchmarks
- Destatis household electricity benchmarks
- Eurostat household energy context
- Verbraucherzentrale practical advice
- EPREL appliance efficiency data
- BAFA/KfW subsidy info later
- Product catalog for plugs, thermostats, humidity meters, sealing products

For MVP, 10-30 manually curated chunks are enough. Full ingestion can come later.

## Reliable Data Strategy

Always show confidence.

| Data available | Accuracy level |
| --- | --- |
| Location only | Very rough |
| Photo only | Visible energy footprint only |
| 60-second form | Useful estimate |
| Form + bill | Good estimate |
| Form + meter readings | Trend tracking |
| Form + readings + products/actions | Personalized optimization |
| Smart plug / smart-home data | More automatic monitoring |

Use careful wording:

> This is an estimate. Add your bill or meter reading to improve accuracy.

## Monitoring Dashboard Direction

Do not depend on universal smart-home compatibility. The MVP should be manual-first.

Tracking levels:

| Level | Method | MVP |
| --- | --- | --- |
| 1 | Manual meter reading | Yes |
| 2 | Meter photo upload | Prototype |
| 3 | Bill upload | Prototype |
| 4 | Smart plug data | Demo/mock |
| 5 | Home Assistant integration | Later |
| 6 | Matter energy devices | Later |
| 7 | Smart meter gateway | Later |

Dashboard cards:

- energy score
- consumption trend
- monthly estimate
- action progress
- alerts
- product suggestions
- accuracy meter

Alert examples:

- consumption spike over previous average by 20 percent
- missing reading for 30 days
- heating season reminder
- high base load
- possible appliance issue
- mold risk from humidity + low temperature

## Minimum Hackathon MVP

Priority order:

1. Landing page
2. Room photo upload
3. Mock or real room scan result
4. Shareable energy score
5. 60-second profile form
6. Free recommendations dashboard
7. Basic monitoring dashboard with mock/manual data
8. Pricing page
9. Architecture explanation

## Demo Script

1. Show landing page: take a picture of your room.
2. Upload room photo.
3. Show playful score: Watt Goblin, 72/100.
4. Explain detected clues: gaming PC, monitors, radiator, window.
5. Click: get saving plan in 60 seconds.
6. Fill profile form.
7. Show free recommendations grouped by friction.
8. Add a meter reading.
9. Show dashboard and alert.
10. Show pricing: free suggestions, paid monitoring.

## Required Disclaimers

- A photo scan is not a real meter reading.
- Rankings are estimates unless based on real Kenergy user data.
- Energy savings are approximate.
- Electrical/heating work should be done by professionals.
- Legal/tenant-right advice is non-legal guidance.
- More data improves confidence.

## Positioning

Best sentence:

> Kenergy starts with a viral Room Energy Scan, then turns curiosity into free energy-saving actions and a paid monitoring loop for renters.

Short version:

> Scan your room. See your energy score. Get your saving plan. Track your progress.
