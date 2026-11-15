# Secret Santa Name Draw (React + Vite + Vercel Storage)

A refined two-phase Secret Santa name drawing web application built with **React 19, TypeScript, Vite, Tailwind CSS v4**, and **Vercel Storage (Upstash Redis)**.

## Features
- **Phase 1 — Guest Registry:** Participants open the shared link on their phone or computer, enter their name, and create a private 4-digit PIN. The guest ledger updates live across devices.
- **Phase 2 — Sealed Correspondence Draw:** Once everyone has joined, the organizer locks registration and generates a randomized single-cycle derangement (nobody can draw themselves, and nobody gets stuck at the end). Each participant selects their envelope and verifies with their 4-digit PIN to unseal their match.
- **Hidden Organizer Console:** No visible admin button appears in the public UI. Organizers open the console secretly via any of three triggers (see below) and verify with the Organizer PIN (default `1234`, changeable in settings).
- **Zero-dependency Serverless Storage:** `api/event.js` connects to Vercel Storage / Upstash Redis (`KV_REST_API_URL` & `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`) via native `fetch`, with an automatic local temp-file fallback during local `npm run dev`.

---

## Hidden Organizer Access

The Organizer Console is intentionally hidden from guests. Open it using any of these three methods:

1. **5-Tap Crest Gesture (Mobile & Desktop):** Tap or click the crimson wax seal emblem in the top-left header **5 times within 2.5 seconds**.
2. **Direct URL Trigger:** Visit `https://your-site.vercel.app/?admin=1` or `/#admin` (the query/hash is automatically cleared from the address bar on load).
3. **Keyboard Shortcut (Desktop):** Press **`Ctrl + Shift + A`** (or **`Cmd + Shift + A`** on macOS).

*Default initial Organizer PIN is `1234`. Change it inside **Exchange Settings** once unlocked.*

---

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite automatically mounts `/api/event` via `vite.config.ts`.

---

## Deploy to Vercel + Connect Vercel Storage

1. **Import to Vercel:** Import `Qualestrom/secret-santa` in Vercel. Leave Build Command as `npm run build` and Output Directory as `dist` (`vercel.json` configures both plus `/api` routing).
2. **Connect Upstash Redis:** Go to your Vercel project's **Storage** tab → **Create Database** → **Upstash** → **Upstash for Redis** (select Frankfurt `eu-central-1` or Middle East if available for Kuwait clients).
3. **Redeploy:** Redeploy once after linking storage so Vercel injects the `KV_REST_API_*` / `UPSTASH_REDIS_REST_*` environment variables.
