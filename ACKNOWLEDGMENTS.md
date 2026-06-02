# Acknowledgments

Kenergy Loop stands on the shoulders of open-source work, cloud services, and model providers. This file credits the projects and services used by this repository and notes their licenses where relevant.

If something is mis-attributed or missing, please open an issue or pull request and it will be corrected.

## Adapted Or Borrowed Code

No third-party repository code is intentionally copied or adapted into this project beyond normal package usage through `package.json`, Docker images, and public APIs.

If future code is adapted from another project, list the original source, copyright holder, license, and affected files here.

## Runtime And Framework Libraries

Installed through `package.json`:

| Project | Purpose | License |
| --- | --- | --- |
| React / React DOM | UI rendering | MIT |
| TanStack Start, Router, Query | Application framework, routing, data fetching | MIT |
| Vite | Development server and build tooling | MIT |
| TypeScript | Type checking | Apache-2.0 |
| Tailwind CSS | Styling system | MIT |
| tw-animate-css | Animation utilities | MIT |
| Radix UI React packages | Accessible UI primitives | MIT |
| lucide-react | Icons | ISC |
| Recharts | Charts and monitoring visuals | MIT |
| Supabase JS | Auth, database, and storage client | MIT |
| Zod | Runtime validation | MIT |
| React Hook Form / resolvers | Form handling | MIT |
| date-fns | Date helpers | MIT |
| Sonner | Toast notifications | MIT |
| clsx, class-variance-authority, tailwind-merge | Class and variant utilities | MIT |
| cmdk | Command/menu primitive | MIT |
| Embla Carousel React | Carousel behavior | MIT |
| react-day-picker | Date picker UI | MIT |
| react-resizable-panels | Resizable panel UI | MIT |
| Vaul | Drawer UI | MIT |

Development dependencies include ESLint, Prettier, TypeScript ESLint, Vite React plugin, and related type packages.

## Docker Images

Used by `Dockerfile` and `docker-compose.yml`:

| Image | Purpose | License |
| --- | --- | --- |
| `oven/bun:1-alpine` | Bun runtime for development, build, and preview containers | MIT for Bun; Alpine packages keep their own licenses |

The Docker Compose setup only runs the Kenergy Loop app containers. It does not bundle extra database, search, vector-store, or notification services.

## Cloud Services And APIs

Kenergy Loop interoperates with these services through user-provided credentials. They are not distributed with this repository:

| Service | Purpose |
| --- | --- |
| Supabase | Auth, Postgres database, row-level security, file storage |
| Google Gemini API | Model-backed room scans, survey estimates, and Energy Checks |
| Resend | Optional email capability if enabled by deployment |

## Assets, Fonts, And CDN Libraries

This repository does not intentionally vendor third-party font files, CDN libraries, or static asset bundles. UI icons come from `lucide-react`; product and placeholder imagery is generated or linked at runtime where applicable.

## License Compatibility Notes

The project itself is released under the MIT License. Its direct frontend/runtime dependencies are generally permissive licenses such as MIT, ISC, BSD-style, or Apache-2.0.

Dependencies keep their own license terms. If you deploy or redistribute a modified version, verify the exact transitive dependency licenses produced by your package manager.

## Thanks

This prototype was generated and iterated with AI-assisted development tools, especially OpenAI Codex and Lovable. Codex was used for code edits, debugging, Docker setup, copy cleanup, and repository preparation. Lovable helped shape the early application structure and product UI direction.

And thanks to the teammates who helped debug the demo under hackathon pressure.
