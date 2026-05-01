# Hayfever

An iOS-first allergy coach with a companion web dashboard and a small backend API for weather, pollen, and recommendation logic.

## Workspace

```text
apps/
  api/      Cloud Run backend for conditions data
  mobile/   Expo React Native iOS app
  web/      Existing Next.js dashboard
packages/
  core/     Shared types and recommendation rules
```

## Local Setup

```bash
npm install
```

For the web app, create `apps/web/.env.local` with:

```bash
GOOGLE_MAPS_API_KEY=...
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

For the API app, set `GOOGLE_MAPS_API_KEY` in your shell or pass it from Google Secret Manager when deployed.

For the mobile app, create `apps/mobile/.env.local` with:

```bash
EXPO_PUBLIC_API_BASE_URL=https://hayfever-api-a72dzg4upq-nw.a.run.app
```

## Development

```bash
npm run dev:web
npm run dev:api
npm run mobile
```

The mobile app reads `EXPO_PUBLIC_API_BASE_URL` when you want it to call a live backend. Without that value, it shows sample conditions so the UI can still be developed.

## Checks

```bash
npm run lint
npm run build
```

## Cloud Setup

The Google Cloud project is `hayfever-ios-sg`.

The production API key is stored in Secret Manager as `google-maps-api-key`, and the Cloud Run runtime service account is `hayfever-api-sa@hayfever-ios-sg.iam.gserviceaccount.com`.

The Cloud Run API is deployed as:

```text
https://hayfever-api-a72dzg4upq-nw.a.run.app
```

The Expo/EAS project is `@hayfever-sg/hayfever`.
