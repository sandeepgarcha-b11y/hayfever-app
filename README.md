# Hayfever Dashboard

A personal weather and pollen dashboard that tells you whether to take an antihistamine and what to wear — built for people who care about going outside comfortably.

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
| Weather | [Google Weather API](https://developers.google.com/maps/documentation/weather) |
| Pollen | [Google Pollen API](https://developers.google.com/maps/documentation/pollen) |
| Location name | [Nominatim / OpenStreetMap](https://nominatim.org) — reverse geocoding |

## Tech stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS with a custom earthy palette
- **Language:** TypeScript

## Running locally

```bash
npm install
npm run dev
```

Create `.env.local` with `GOOGLE_MAPS_API_KEY` before loading live weather and pollen data.

Open [http://localhost:3000](http://localhost:3000) in your browser.

For a local production check:

```bash
npm run lint
npm run build
```

> Note: browser geolocation may be blocked on `localhost` depending on your OS/browser permissions. The app will automatically fall back to Ealing, London in that case.
