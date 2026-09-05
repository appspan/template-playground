/* Local-only state: thin wrappers over localStorage / sessionStorage.
 *
 * Storage can be missing or throw (private mode, quota, disabled). Every
 * access here degrades to a fallback instead of crashing the page — that
 * is the whole reason callers must go through these helpers rather than
 * touching localStorage directly. Keys are prefixed so two apps built from
 * this template never collide on the same origin during local dev.
 *
 * Node + browser: tests inject fake storages; the page uses the globals. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LocalState = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function create(prefix, storage, session) {
    storage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    session = session || (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
    const key = name => prefix + '-' + name;

    function get(name, fallback) {
      try {
        const raw = storage.getItem(key(name));
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;   // unavailable storage or corrupt value: use the default
      }
    }
    function set(name, value) {
      try { storage.setItem(key(name), JSON.stringify(value)); return true; }
      catch (e) { return false; }   // quota / private mode: state simply doesn't persist
    }
    function remove(name) {
      try { storage.removeItem(key(name)); } catch (e) { /* nothing to remove from */ }
    }
    function sessionGet(name) {
      try { return session.getItem(key(name)); } catch (e) { return null; }
    }
    function sessionSet(name, value) {
      try { session.setItem(key(name), String(value)); return true; }
      catch (e) { return false; }
    }
    // Ask-once-per-visit flags. Unavailable sessionStorage returns false so a
    // prompt is never shown at all rather than shown on every load.
    function sessionOnce(name) {
      if (sessionGet(name)) return false;
      return sessionSet(name, '1');
    }

    return { key, get, set, remove, sessionGet, sessionSet, sessionOnce };
  }

  return { create };
});
