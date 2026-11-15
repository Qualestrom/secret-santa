# Secret Santa Name Draw (Vercel + Vercel Storage)

A simple, mobile-friendly two-phase Secret Santa website designed for hosting on **Vercel** with **Vercel Storage (Upstash Redis)** so nothing is stored on your computer.

## Features
- **Phase 1 — Self-Registration:** Everyone opens the shared link on their own phone or computer, enters their name, and sets a 4-digit PIN. The participant lobby updates live.
- **Phase 2 — Private Hat Draw:** Once everyone is in, the organizer locks registration and generates a randomized single-cycle derangement (nobody can draw themselves, and nobody gets stuck at the end). Participants tap their name and enter their 4-digit PIN to reveal who they are gifting to.
- **Spoiler-Free Organizer Controls:** Protected by an Organizer PIN (default `1234`, changeable in settings). View how many people have drawn without seeing any matches, add/remove participants, reset forgotten PINs, re-shuffle, or reset the event.
- **Zero-dependency Serverless Backend:** `api/event.js` uses native `fetch` against Vercel Storage / Upstash Redis REST environment variables (`KV_REST_API_URL` / `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`), with an automatic local temp-file fallback for testing on your machine.

---

## Run Locally

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.
*(When running locally without Vercel Storage environment variables, state is stored in your OS temp folder so you can test the full flow right away.)*

---

## Deploy to Vercel + Connect Vercel Storage

1. **Push or import this folder to Vercel**
   - Create a GitHub repo (or deploy directly using `npx vercel`) and import the project into [Vercel](https://vercel.com).
   - Leave the Framework Preset as **Other** (the included `vercel.json` sets `"outputDirectory": "public"` and mounts `/api/event`).
2. **Add Vercel Storage (Upstash Redis)**
   - Open your project in the **Vercel Dashboard**.
   - Go to the **Storage** tab → **Create Database** → select **Upstash** → **Upstash for Redis** (free tier is plenty).
   - Connect it to your project. Vercel automatically adds `KV_REST_API_URL` & `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`) to your project's Environment Variables.
3. **Redeploy**
   - Trigger one redeploy in Vercel (Deployments → Redeploy) so the live deployment picks up the new storage environment variables.
   - Check the footer on your live site—it will display **`Synced via Vercel Storage`**.
4. **Customize for Your Client**
   - Click **Organizer / Admin** (top right), enter the default PIN `1234`, and update the **Event Title**, **Gift Budget/Date Note**, and **Organizer PIN** before sharing the link with participants.
