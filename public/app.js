/* Template client. Every behavior here is generic to a local-only PWA:
 * theme, settings, install nudge, first-visit onboarding, share links via
 * the URL fragment, the app-changes panel, and service worker registration.
 * The counter is placeholder content showing the patterns working.
 * Lifted from Camp Constellation 2026 (issue numbers refer to that repo). */
'use strict';

const state = LocalState.create(APP.prefix);
const $ = sel => document.querySelector(sel);

/* ---- toast ------------------------------------------------------------ */
function showToast(text) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  document.body.append(t);
  t.addEventListener('animationend', () => t.remove());
}

function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches
    || navigator.standalone === true;
}

/* ---- appearance (system / light / dark) ------------------------------- */
const themeMq = matchMedia('(prefers-color-scheme: dark)');
const themeBtns = document.querySelectorAll('.themectl button[data-pref]');
let themePref = state.get('theme', 'system');
if (!['system', 'light', 'dark'].includes(themePref)) {
  themePref = 'system';   // heal a corrupted value rather than trusting it (#59)
  state.set('theme', themePref);
}
function applyTheme() {
  const dark = themePref === 'dark' || (themePref === 'system' && themeMq.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('meta[name="theme-color"]').content = dark ? '#17171b' : '#f5f5f7';
  for (const b of themeBtns) {
    const on = b.dataset.pref === themePref;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  }
}
for (const b of themeBtns) {
  b.addEventListener('click', () => {
    themePref = b.dataset.pref;
    state.set('theme', themePref);
    applyTheme();
  });
}
themeMq.addEventListener('change', () => { if (themePref === 'system') applyTheme(); });
applyTheme();

/* ---- settings subpage (URL-addressable: #settings, back button closes) - */
const settingshud = $('#settingshud');
function openSettings(push = true) {
  settingshud.hidden = false;
  if (push) history.pushState({ settings: true }, '', '#settings');
}
function closeSettings() {
  settingshud.hidden = true;
}
$('#gearBtn').addEventListener('click', () => openSettings());
$('#settingsClose').addEventListener('click', () => {
  if (history.state?.settings) history.back();
  else {
    closeSettings();
    history.replaceState(null, '', location.pathname);
  }
});
// The URL is the source of truth: back/forward (popstate), a typed or
// linked #settings (hashchange, same-document so boot doesn't re-run),
// and a fresh load all funnel through the same sync.
function syncSettingsToUrl() {
  if (location.hash === '#settings') openSettings(false);
  else closeSettings();
}
addEventListener('popstate', syncSettingsToUrl);
addEventListener('hashchange', syncSettingsToUrl);
syncSettingsToUrl();

/* ---- placeholder content: a local-only counter ------------------------ */
let count = state.get('count', 0);
function renderCount() { $('#count').textContent = String(count); }
$('#tapBtn').addEventListener('click', () => {
  count += 1;
  state.set('count', count);
  renderCount();
  maybeAskInstall();   // the first meaningful action is the moment install matters
});
renderCount();

/* ---- share via URL fragment (no server, no login) ---------------------- */
function shareUrl() {
  return ShareLink.link({ c: count }, location.origin);
}
const sharesheet = $('#sharesheet');
$('#shareBtn').addEventListener('click', () => {
  $('#shareUrl').value = shareUrl();
  $('#shareNative').hidden = !navigator.share;
  sharesheet.showModal();
});
$('#shareCopy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareUrl());
    showToast('Link copied');
  } catch (e) {
    $('#shareUrl').select();   // clipboard blocked: leave the link selected to copy by hand
    showToast('Select and copy the link');
  }
});
$('#shareNative').addEventListener('click', async () => {
  try { await navigator.share({ title: APP.name, url: shareUrl() }); }
  catch (e) { /* user cancelled the share sheet */ }
});
$('#shareClose').addEventListener('click', () => sharesheet.close());

// Receiving: a "#s=1.…" fragment on any load, or pasted text.
function receiveShare(text) {
  const data = ShareLink.decode(text);
  if (!data) return false;
  $('#received').textContent = `Received a count of ${data.c ?? '?'}.`;
  showToast('Share received');
  return true;
}
$('#pasteBtn').addEventListener('click', async () => {
  let text = '';
  try { text = await navigator.clipboard.readText(); }
  catch (e) { text = prompt('Paste the share link') || ''; }   // clipboard read denied: ask
  if (!receiveShare(text)) showToast('No share link found');
});

// iOS opens links in Safari, never in the installed app — so when we're
// NOT standalone, also offer copy-the-link guidance toward the PWA (whose
// storage is a separate silo).
function handleShareHash() {
  if (!/^#s=\d+\./.test(location.hash)) return false;
  const originalUrl = location.origin + '/' + location.hash;
  const ok = receiveShare(location.hash);
  history.replaceState(history.state, '', location.pathname);
  if (ok && !isStandalone()) showPwaHint(originalUrl);
  return ok;
}

/* ---- Safari → PWA handoff banner -------------------------------------- */
const pwahint = $('#pwahint');
let pwahintUrl = '';
function showPwaHint(url) {
  pwahintUrl = url;
  pwahint.hidden = false;
}
$('#pwahintClose').addEventListener('click', () => { pwahint.hidden = true; });
$('#pwahintCopy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(pwahintUrl);
    showToast('Link copied — paste it inside the app');
  } catch (e) {
    showToast(pwahintUrl);   // clipboard blocked: show it so it can be copied by hand
  }
});

/* ---- install nudge state machine (issue #51) ---------------------------
   Asked at the moment install starts mattering: the first meaningful action
   in a mobile browser. The answer persists — 'declined' ends the nagging;
   'installed' turns every later WEBSITE visit into a redirect toward the
   app, because the two keep separate data and quiet divergence is worse
   than a dialog. Opting back out passes through an explicit
   not-synchronized warning and resets to 'declined'. */
const installhint = $('#installhint');
const useapp = $('#useapp');
function installState() { return state.get('install-state', ''); }   // '' | declined | installed
function setInstallState(v) { state.set('install-state', v); }

function showInstallModal() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  $('#installIos').hidden = !ios;
  $('#installAndroid').hidden = ios;
  installhint.showModal();
}
function maybeAskInstall() {
  if (isStandalone()) return;
  if (!matchMedia('(pointer: coarse)').matches) return;  // phones/tablets only
  if (installState()) return;                            // already answered
  if (!state.sessionOnce('install-asked')) return;       // Esc ≠ answer, but don't re-nag this visit
  if (!installhint?.showModal) return;
  setTimeout(showInstallModal, 600);   // let the tap feedback land first
}
$('#installYes').addEventListener('click', () => {
  setInstallState('installed');
  installhint.close();
  showToast('Open the app from its Home Screen icon');
});
$('#installNo').addEventListener('click', () => {
  setInstallState('declined');
  installhint.close();
});

// returning website visit while 'installed': point back at the app
function maybeRedirectToApp() {
  if (isStandalone()) return;
  if (installState() !== 'installed') return;
  if (!useapp?.showModal) return;
  $('#useappMain').hidden = false;
  $('#useappWarn').hidden = true;
  useapp.showModal();
}
$('#useappSteps').addEventListener('click', () => { useapp.close(); showInstallModal(); });
$('#useappDismiss').addEventListener('click', () => {
  $('#useappMain').hidden = true;
  $('#useappWarn').hidden = false;
});
$('#useappBack').addEventListener('click', () => {
  $('#useappMain').hidden = false;
  $('#useappWarn').hidden = true;
});
$('#useappConfirm').addEventListener('click', () => {
  setInstallState('declined');
  useapp.close();
});

/* ---- first-visit onboarding ------------------------------------------- */
const onboard = $('#onboard');
if (!state.get('onboarded', false) && onboard?.showModal) {
  const dismissOnboarding = () => state.set('onboarded', true);
  onboard.showModal();
  onboard.addEventListener('close', dismissOnboarding);   // also covers Esc
  $('#onboardGo').addEventListener('click', () => { dismissOnboarding(); onboard.close(); });
}

/* ---- app changes panel ------------------------------------------------ */
async function loadChangeFeed(url, boxId) {
  const box = document.getElementById(boxId);
  if (!box) return;
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('history ' + r.status);
    const hist = await r.json();
    box.innerHTML = '';
    for (const rel of hist.releases.slice().reverse()) {
      const wrap = document.createElement('div');
      wrap.className = 'release';
      const h = document.createElement('h3'); h.textContent = rel.label; wrap.append(h);
      const meta = document.createElement('div'); meta.className = 'meta';
      meta.textContent = rel.publishedAt; wrap.append(meta);
      if (rel.baseline) {
        const p = document.createElement('div'); p.className = 'baseline';
        p.textContent = rel.note || ''; wrap.append(p);
      } else {
        const ul = document.createElement('ul');
        for (const c of (rel.changes || [])) {
          const li = document.createElement('li'); li.textContent = c; ul.append(li);
        }
        wrap.append(ul);
      }
      box.append(wrap);
    }
  } catch (e) {
    box.innerHTML = '<div class="baseline">Change history could not load.</div>';
  }
}

/* ---- build stamp in settings ------------------------------------------ */
async function loadBuildInfo() {
  try {
    const b = await fetch('/build.json', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null));
    if (b?.build) $('#buildinfo').textContent = `Build ${b.build} · ${b.commit} · ${b.stamped}`;
  } catch (e) { /* offline or unstamped local run: keep the default label */ }
}

/* ---- boot ------------------------------------------------------------ */
$('#appName').textContent = APP.name;
handleShareHash();
maybeRedirectToApp();
loadChangeFeed('/app-changes.json', 'apphistory');
loadBuildInfo();
window.__appBooted = true;

/* ---- service worker --------------------------------------------------- */
if ('serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  addEventListener('load', async () => {
    try {
      // per-deploy registration (#100): the ?v busts the SW script URL on
      // every build, so ANY deploy — SW bytes changed or not — installs a
      // new worker and rides the controllerchange reload at next launch.
      // Offline (or unstamped local) falls back to the bare URL, which is
      // a no-op against an existing registration.
      let v = '';
      try {
        const b = await fetch('/build.json', { cache: 'no-store' })
          .then(r => (r.ok ? r.json() : null));
        if (b?.build) v = '?v=' + b.build;
      } catch (e) { /* offline: keep the existing registration */ }
      const reg = await navigator.serviceWorker.register('/service-worker.js' + v, { updateViaCache: 'none' });
      await reg.update();
    } catch (e) { /* offline / unsupported */ }
  });
}
