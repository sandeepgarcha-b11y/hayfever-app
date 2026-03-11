# 🌿 Hayfever Dashboard

A personal weather and pollen dashboard that tells you whether to take an antihistamine and what to wear — built for people who care about going outside comfortably.

**Live app → [hayfever-app-ochre.vercel.app](https://hayfever-app-ochre.vercel.app)**

---

## What it does

- Detects your location (or falls back to Ealing, London)
- Shows current weather conditions: temperature, feels-like, UV, wind, rain probability
- Shows real-time pollen levels for grass, tree, and weed with a visual scale
- Recommends whether to take an antihistamine based on combined pollen load
- Suggests what to wear for the day based on temperature and conditions
- Supports dark mode with an earthy, classic feel

## Data sources

| Data | Source |
|------|--------|
| Weather | [Open-Meteo Forecast API](https://open-meteo.com) — free, no API key required |
| Pollen | [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) — species-level pollen counts |
| Location name | [Nominatim / OpenStreetMap](https://nominatim.org) — reverse geocoding |

## Tech stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS with a custom earthy palette
- **Language:** TypeScript
- **Deployment:** Vercel

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> Note: browser geolocation may be blocked on `localhost` depending on your OS/browser permissions. The app will automatically fall back to Ealing, London in that case.

## Deployment

The app is deployed on Vercel. To push a new production release:

```bash
git push origin main
npx vercel --prod
```
