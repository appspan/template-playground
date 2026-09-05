'use strict';
// The config file is the day-one checklist; index.html must agree with it
// so the deploy script's sed rebadging and the storage prefix never drift.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'template.config.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public', 'manifest.webmanifest'), 'utf8'));
const stage = JSON.parse(fs.readFileSync(path.join(root, 'public', 'manifest-stage.webmanifest'), 'utf8'));

test('config has every required key', () => {
  for (const k of ['appName', 'shortName', 'storagePrefix', 'productionUrl', 'vercelProject', 'vercelStagingProject']) {
    assert.ok(typeof cfg[k] === 'string' && cfg[k].length, `missing ${k}`);
  }
  assert.match(cfg.storagePrefix, /^[a-z0-9-]+$/);
});

test('index.html title and APP block agree with config', () => {
  assert.ok(html.includes(`<title>${cfg.appName}</title>`), 'title');
  assert.ok(html.includes(`content="${cfg.shortName}"`), 'apple-mobile-web-app-title');
  assert.ok(html.includes(`prefix: '${cfg.storagePrefix}'`), 'window.APP.prefix');
  assert.ok(html.includes(`name: '${cfg.appName}'`), 'window.APP.name');
});

test('manifests agree with config', () => {
  assert.strictEqual(manifest.name, cfg.appName);
  assert.strictEqual(manifest.short_name, cfg.shortName);
  assert.strictEqual(stage.name, `${cfg.appName} (stage)`);
  assert.strictEqual(stage.short_name, `${cfg.shortName} stage`);
});
