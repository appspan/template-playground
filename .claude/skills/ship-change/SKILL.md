---
name: ship-change
description: Use when changing this app and deploying it — any edit under public/, adding a what's-new entry, deploying to staging or production.
---

# Ship a change

Follow `docs/ship-runbook.md` exactly. In short:

1. Issue + branch first. Commit with `(#NNN)` in the subject.
2. Edit under `public/` only. New/renamed core files go in the service
   worker `CORE` list; bump `CACHE`.
3. Append the `public/app-changes.json` entry in the same commit.
4. `npm test` and check it in `npm run serve`.
5. `npm run deploy:staging`, verify on a phone.
6. After approval: `npm run deploy:prod`, verify, merge, close the issue.

| Mistake | Reality |
|---|---|
| Deploying without a what's-new entry | Users never learn what changed |
| Adding a file without touching the service worker | Offline copies miss it |
| `vercel deploy` to test | That's a protected preview of prod, not staging |
| Bare `localStorage.getItem` | Throws in private mode; use `LocalState` |
