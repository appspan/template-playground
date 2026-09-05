'use strict';
const test = require('node:test');
const assert = require('node:assert');
const LocalState = require('../public/local-state.js');

function fakeStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    _map: m,
  };
}
function throwingStorage() {
  const boom = () => { throw new Error('QuotaExceeded / private mode'); };
  return { getItem: boom, setItem: boom, removeItem: boom };
}

test('keys are prefixed; values round-trip as JSON', () => {
  const st = LocalState.create('bob', fakeStorage(), fakeStorage());
  assert.strictEqual(st.key('count'), 'bob-count');
  assert.strictEqual(st.get('count', 0), 0);
  assert.strictEqual(st.set('count', 5), true);
  assert.strictEqual(st.get('count', 0), 5);
  st.set('list', ['a', 'b']);
  assert.deepStrictEqual(st.get('list', []), ['a', 'b']);
  st.remove('count');
  assert.strictEqual(st.get('count', 0), 0);
});

test('corrupt JSON returns the fallback', () => {
  const s = fakeStorage();
  s.setItem('bob-count', '{not json');
  const st = LocalState.create('bob', s, fakeStorage());
  assert.strictEqual(st.get('count', 9), 9);
});

test('throwing storage degrades to fallbacks and false', () => {
  const st = LocalState.create('bob', throwingStorage(), throwingStorage());
  assert.strictEqual(st.get('count', 1), 1);
  assert.strictEqual(st.set('count', 2), false);
  assert.doesNotThrow(() => st.remove('count'));
  assert.strictEqual(st.sessionOnce('asked'), false);
});

test('sessionOnce is true exactly once per session', () => {
  const st = LocalState.create('bob', fakeStorage(), fakeStorage());
  assert.strictEqual(st.sessionOnce('asked'), true);
  assert.strictEqual(st.sessionOnce('asked'), false);
  assert.strictEqual(st.sessionOnce('other'), true);
});

test('sessionGet/sessionSet are raw strings', () => {
  const st = LocalState.create('bob', fakeStorage(), fakeStorage());
  assert.strictEqual(st.sessionGet('x'), null);
  st.sessionSet('x', 'y');
  assert.strictEqual(st.sessionGet('x'), 'y');
});
