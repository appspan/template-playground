'use strict';
const test = require('node:test');
const assert = require('node:assert');
const ShareLink = require('../public/share-link.js');

test('encode round-trips through decode', () => {
  const state = { c: 42, n: 'Bobby ✨' };
  const code = ShareLink.encode(state);
  assert.match(code, /^1\.[A-Za-z0-9_-]+$/);
  assert.deepStrictEqual(ShareLink.decode(code), state);
});

test('decode accepts fragment, query-ish, and full-URL forms', () => {
  const code = ShareLink.encode({ c: 1 });
  assert.deepStrictEqual(ShareLink.decode('#s=' + code), { c: 1 });
  assert.deepStrictEqual(ShareLink.decode('s=' + code), { c: 1 });
  assert.deepStrictEqual(ShareLink.decode('https://example.com/#s=' + code), { c: 1 });
});

test('unknown version and garbage return null, never throw', () => {
  assert.strictEqual(ShareLink.decode('2.eyJjIjoxfQ'), null);
  assert.strictEqual(ShareLink.decode('1.!!!not-base64!!!'), null);
  assert.strictEqual(ShareLink.decode('1.bm90IGpzb24'), null);   // "not json"
  assert.strictEqual(ShareLink.decode(''), null);
  assert.strictEqual(ShareLink.decode(null), null);
});

test('extract finds a payload inside pasted text', () => {
  const code = ShareLink.encode({ c: 7 });
  assert.strictEqual(ShareLink.extract('look: https://x.y/#s=' + code + ' ok'), 's=' + code);
  assert.strictEqual(ShareLink.extract('nothing here'), null);
});

test('link builds a fragment URL on the given origin', () => {
  const url = ShareLink.link({ c: 3 }, 'https://example.com');
  assert.ok(url.startsWith('https://example.com/#s=1.'));
  assert.deepStrictEqual(ShareLink.decode(url), { c: 3 });
});
