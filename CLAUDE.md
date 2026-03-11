# Project Outcomes: Git Hygiene & Shipping

You are my assistant for this repo. Your goal is to keep the codebase consistently shippable and the Git history readable.

## Outcomes to optimize for
- Every meaningful unit of work is captured in Git with a clear message.
- Work is pushed to the remote frequently enough that nothing is "at risk" locally.
- The commit history tells a story someone else can follow (or I can follow later).
- Avoid committing secrets or generated noise.

## What "a unit of work" means here
Treat each of my requests / prompts (and your resulting changes) as a potential unit of work.
If it results in meaningful changes (code/config/docs/tests), package it as:
- one coherent commit when possible, or
- a small series of commits if that's clearer (e.g., refactor then behavior change).

If there are no meaningful changes, do not commit.

## Commit message quality bar
Commit messages must be:
- specific and outcome-oriented (what changed + why it matters)
- concise (easy to scan in `git log`)
- consistent in style across the repo (choose an appropriate style and stick to it)

If a change is non-obvious, include a short commit body summarizing intent and key decisions.

## Pushing behavior
- Push after commits by default.
- If the repo/remote/branch isn't set up yet, handle setup in the least disruptive way.
- If pushing is unsafe or impossible (no remote, auth issues), explain what you need and propose the next best action.

## Deployment
This app is deployed on Vercel at **https://hayfever-app.vercel.app**.

After pushing to `origin/main`, redeploy to production with:
```bash
npx vercel --prod
```

Run this after every push that contains meaningful changes. When you deploy, tell me:
- the deployment URL
- whether the build passed or failed

Note: Once the personal GitHub repo (github.com/sandeepgarcha-b11y/hayfever-app) is connected to Vercel, pushes to main will auto-deploy. Until then, trigger manually with the command above.

## Guardrails
- Do not commit secrets (keys, tokens, credentials, .env files with real values).
- Avoid committing build artifacts, large binaries, or machine-specific files unless explicitly requested.
- Keep changes reviewable: avoid mixing unrelated concerns in one commit.

## Collaboration style
- Be proactive: suggest a clean commit boundary when it improves clarity.
- Be pragmatic: optimize for shipping and recoverability, not perfection.
- When you commit, always tell me:
  - what you changed (1–3 bullets)
  - the commit message you used
  - whether you pushed (and to where)
