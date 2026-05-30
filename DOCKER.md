# Docker

Run the development server with one command:

```bash
docker compose up --build
```

Then open:

```text
http://localhost:3000
```

The image installs dependencies with Bun. The compose setup reads environment
variables from `.env`, so keep your Supabase and Gemini keys there locally. The
file is ignored by Git and not copied into the Docker image build context.

For the real model-backed demo path, add a free Google AI Studio key:

```env
GEMINI_API_KEY=your_google_ai_studio_key
KENERGY_AI_MODEL=gemini-2.5-flash
```

Kenergy Loop's energy insight server functions call Gemini directly.

For a production-style local build:

```bash
docker compose --profile preview up --build app-preview
```
