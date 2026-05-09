# Email Automation Frontend

Vite + React 19 + Tailwind v3 + shadcn/ui dashboard for the Email Automation System.

## Stack

- **Vite** for the dev server and production build.
- **Tailwind v3** + **shadcn/ui** primitives in `src/components/ui/`.
- **sonner** for toasts, **framer-motion** for transitions, **lucide-react** for icons, **canvas-confetti** for milestone celebrations.
- **TipTap** powers the rich text template editor.
- **Vitest** for tests (replaces Jest/CRA).

## Local development

1. Install dependencies (Node 18+):

   ```bash
   npm install
   ```

2. Create your env file from the example:

   ```bash
   cp .env.example .env.local
   ```

   Both `VITE_API_URL` and `VITE_TRACKING_PIXEL_URL` should point at your live backend (default values in `.env.example` already point at the Render deployment).

3. Start the dev server:

   ```bash
   npm run dev
   ```

   Vite serves the app at <http://localhost:5173>. Hot reload is on.

## Verify a production build locally before deploying

To save Netlify build minutes, always smoke-test a real production bundle on your machine first:

```bash
npm run build      # writes to dist/
npm run preview    # serves dist/ at http://localhost:4173
```

Only push to Netlify once `npm run preview` looks correct in the browser.

## Tests

```bash
npm test           # interactive watch
npm run test:run   # one-shot CI mode
```

## Conventions

- All backend writes flow through `useAction` (`src/lib/useAction.js`) for a uniform loading toast → success/error toast → button-disabled lifecycle.
- All HTTP requests go through `apiClient` (`src/lib/apiClient.js`). It manages the `session_token` cookie via `credentials: "include"` and surfaces a "Server waking up..." banner if the backend takes longer than 2.5s to respond (Render free-tier cold start).
- shadcn primitives live under `src/components/ui/` and are imported via the `@/` alias.

## Environment variables

| Variable                  | Purpose                                                    |
| ------------------------- | ---------------------------------------------------------- |
| `VITE_API_URL`            | Base URL for the FastAPI backend (no trailing slash).      |
| `VITE_TRACKING_PIXEL_URL` | Public URL of the open-tracking pixel route.               |

> Vite only exposes variables prefixed with `VITE_`. The legacy `REACT_APP_*` names from CRA are no longer recognized.

## Pointing local dev at the live Render backend

If you're previewing the frontend against the deployed Render backend, the backend must allowlist your local origin or the browser will block the cookie-bearing requests with a CORS error.

The FastAPI app reads its primary origin from `FRONTEND_URL` and accepts a comma-separated `CORS_EXTRA_ORIGINS` for additional dev origins. On Render, set:

```
CORS_EXTRA_ORIGINS=http://localhost:5173,http://localhost:4173
```

Google OAuth still redirects to `FRONTEND_URL` after the callback, so signing in locally will land you back on the production app — finish testing the post-login flow either by running the backend locally too, or by signing in once in production and then reusing the dev server (the `session_token` cookie is HTTP-only and `SameSite=lax`, so cross-origin flows are constrained by design).

## Deployment

Netlify build settings (already wired in `netlify.toml`):

- Base directory: `frontend`
- Build command: `npm run build`
- Publish directory: `frontend/dist`

Mirror the `VITE_API_URL` and `VITE_TRACKING_PIXEL_URL` values into the Netlify dashboard before the first deploy.
