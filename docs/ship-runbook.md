# Ship runbook (for any Claude session)

This is a static, local-only PWA. Production is whatever
`productionUrl` in `template.config.json` says; real phones update from it
automatically via the service worker. Verify everything; never guess.

## The flow for any change

1. **Issue + branch first.** `gh issue create`, then `git checkout -b <slug> main`.
2. **Make the change under `public/`.** There is no build; what's in the tree
   is what ships. If you add or rename a core file, add it to `CORE` in
   `public/service-worker.js` and bump `CACHE`.
3. **Log it for users, in the same commit.** Append an entry to
   `public/app-changes.json`: `revision` (date-slug), `label`, `publishedAt`
   ("Sep 5, 2026 · 1:00 PM ET" format), `changes` (plain-language bullets,
   written for users, not developers). Newest last in the file; the panel
   reverses it.
4. **Test.** `npm test`, then `npm run serve` and check the change in a browser.
5. **Stage.** `npm run deploy:staging`. Open the staging URL on a real phone.
6. **Promote.** After approval, `npm run deploy:prod`. Do not change anything
   between staging and prod; the same bytes get promoted.
7. **Verify prod** in a browser, then merge the branch and close the issue with
   a thorough comment.

## Gotchas

- Vercel Hobby blocks deploys from unrecognized commit authors (hangs at
  "Building…"). Fix the author; waiting doesn't help.
- `vercel deploy` without `--prod` makes an auth-protected preview of the
  production project. That is not staging. Staging is its own project.
- Never bypass `local-state.js` for storage. Bare `localStorage` calls throw
  in private mode and take the page down with them.
