# Christmas Secret Santa — Pick a Stick from the Pack

A festive Christmas Secret Santa web application built with **React 19, TypeScript, Vite, Tailwind CSS v4**, and **Vercel Storage (Upstash Redis)**.

## How It Works
1. **Welcome — Add Your Name:** Guests open the shared link, enter only their name, and drop their wooden stick into the Christmas tin.
2. **Waiting Dialogue:** Once a guest submits their name, they see a festive waiting room showing the tin filling up live as everyone else joins.
3. **Pick a Stick from the Pack:** When the organizer activates the draw, everyone's screen switches to an interactive bundle of painted Christmas sticks. Tapping any stick pulls it from the tin and reveals who they are gifting to (powered by a server-side randomized single-cycle derangement so nobody can draw themselves or get stuck at the end).

---

## Hidden Organizer Access

The Organizer Controls are hidden from regular guests. Open them using any of three secret triggers:

1. **5-Tap Crest Gesture (Mobile & Desktop):** Tap or click the crimson star crest in the top-left header **5 times within 2.5 seconds**.
2. **Direct URL Trigger:** Visit `https://your-site.vercel.app/?admin=1` or `/#admin` (automatically cleaned from the address bar on load).
3. **Keyboard Shortcut (Desktop):** Press **`Ctrl + Shift + A`** (or **`Cmd + Shift + A`** on macOS).

*Default initial Organizer PIN is `1234` (changeable inside **Christmas Event Settings** once unlocked).*

---

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite mounts `/api/event` locally with a temporary file fallback (`secret-santa-dev-state.json`).

---

## Deploy to Vercel + Vercel Storage

1. Import `Qualestrom/secret-santa` in Vercel (`Build Command`: `npm run build`, `Output Directory`: `dist`).
2. Under **Storage → Create Database → Upstash for Redis**, link a database to the project (select Frankfurt `eu-central-1` or Middle East for Kuwait traffic).
3. Redeploy once so Vercel injects `KV_REST_API_*` / `UPSTASH_REDIS_REST_*` environment variables.
