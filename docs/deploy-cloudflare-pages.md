# Deploying the web app — Cloudflare Pages (free), `gharsah.pages.dev`

No custom domain. Nothing here is run by Claude: these are the dashboard steps for the product owner.

## 1. Create the Pages project (dashboard)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pick GitHub → repository **A3zos/Gharsah** (private is fine) → branch **main**.
3. **Project name:** `gharsah` → the site becomes `https://gharsah.pages.dev`.
   If the name is taken, Cloudflare assigns another subdomain (e.g. `gharsah-xyz.pages.dev`) — use that
   value everywhere below and in the Supabase settings (§3).
4. **Build settings:**

   | Setting | Value |
   |---|---|
   | Framework preset | *None* (React Router framework mode, SPA + prerendered landing) |
   | Root directory (advanced) | `web` |
   | Build command | `npm run build` |
   | Build output directory | `build/client` ← not `dist` (React Router writes here) |

5. **Environment variables** (Production, and Preview if you use preview branches):

   | Name | Value |
   |---|---|
   | `NODE_VERSION` | `22` ← the app requires Node ≥ 22.22 (`web/package.json` engines); Node 20 fails |
   | `VITE_SUPABASE_URL` | `https://qtxxhfgqfyuiqflxtcol.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | *(the project's anon / publishable key — never the service_role key)* |
   | `VITE_TRIAL_SUBSCRIBE` | `1` (set `0` before launch: the web «اشترك» then shows «قريبًا من التطبيق») |
   | `VITE_PLAY_STORE_URL` | *(optional; empty = «قريبًا» store badges)* |

6. **Save and Deploy.** Every push to `main` then redeploys.

## 2. SPA routing (already in the repo)

`web/public/_redirects` is copied into `build/client/` and rewrites every app route
(`/login`, `/signup`, `/forgot-password`, `/legal`, `/parent/*`, `/child/*`) to the SPA fallback page
`__spa-fallback.html`. There is deliberately **no** `/* /index.html 200` rule:

- `/index.html` is the **prerendered landing page** — serving it for `/parent/…` would flash the landing
  page and mis-hydrate;
- a catch-all could also shadow `/assets/*` and `/audio/*` (Cloudflare's docs don't state whether a 200
  rewrite wins over an existing file), so only the app's own prefixes are rewritten.

Unknown paths fall back to Pages' default (the landing page).

## 3. Supabase Auth → URL Configuration (dashboard)

Supabase dashboard → project `qtxxhfgqfyuiqflxtcol` → **Authentication → URL Configuration**:

- **Site URL:** `https://gharsah.pages.dev`
- **Redirect URLs:**
  - `https://gharsah.pages.dev/**`
  - `https://*.gharsah.pages.dev/**` (preview deployments)
  - `http://localhost:5173/**`

Also in **Authentication → Sign In / Providers**:
- **Anonymous sign-ins: ON** (child devices sign in anonymously, then claim a pairing code).
- **Email → Confirm email:** decide. ON = a parent must click the email link before the first sign-in
  (the web shows «افتح رابط التأكيد…»); OFF matches the earlier behaviour (sign-in allowed while
  unverified).

Edge Function CORS: set the secret `ALLOWED_ORIGINS=https://gharsah.pages.dev,http://localhost:5173`
(comma-separated; `*` if unset).

## 4. Verify the build locally with production-like env

From `web/` (with `web/.env.local` holding the real URL + anon key):

```
npm run build
npm run preview
```

Open http://localhost:4173 → landing; `/login` → login page; `/parent` → redirects to the parent login.

## 5. Android (APK)

From `app/`, with `app/env/supabase.json` filled (copy of `app/env/supabase.example.json`):

```
flutter build apk --release --dart-define-from-file=env/supabase.json
```

Output: `app/build/app/outputs/flutter-apk/app-release.apk`.
