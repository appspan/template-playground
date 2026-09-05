#!/bin/bash
# Deploy the working tree to the STAGING Vercel project, rebadged so
# installed PWAs are visibly distinct from production: manifest
# name/short_name say "stage", the title metas say "stage", and the icons
# carry a STAGE ribbon. Production deploys (npm run deploy:prod from the
# repo root) are untouched. Names come from template.config.json.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
STAGE_DIR="${STAGE_DIR:-$(mktemp -d)/deploy-staging}"
mkdir -p "$STAGE_DIR"

cfg() { node -e "process.stdout.write(require('$REPO/template.config.json').$1)"; }
APP_NAME="$(cfg appName)"
SHORT_NAME="$(cfg shortName)"
STAGING_PROJECT="$(cfg vercelStagingProject)"

cd "$REPO"
npm run stamp >/dev/null

rsync -a --delete \
  --exclude '.git' --exclude 'node_modules' \
  --exclude '.env.local' --exclude '.vercel' \
  "$REPO/" "$STAGE_DIR/"

# ---- stagify the copy -------------------------------------------------
cp "$STAGE_DIR/public/manifest-stage.webmanifest" "$STAGE_DIR/public/manifest.webmanifest"
sed -i '' \
  -e "s|<title>$APP_NAME</title>|<title>$APP_NAME (stage)</title>|" \
  -e "s|content=\"$SHORT_NAME\"|content=\"$SHORT_NAME stage\"|" \
  -e 's|href="/icons/apple-touch-icon.png"|href="/icons/stage/apple-touch-icon.png"|' \
  "$STAGE_DIR/public/index.html"

if [ "${DRY_RUN:-}" = "1" ]; then
  echo "DRY_RUN: rebadged tree at $STAGE_DIR (no deploy)"
  grep -n '<title>\|apple-mobile-web-app-title\|apple-touch-icon' "$STAGE_DIR/public/index.html"
  exit 0
fi

cd "$STAGE_DIR"
vercel link --yes --project "$STAGING_PROJECT" >/dev/null 2>&1
vercel deploy --prod
