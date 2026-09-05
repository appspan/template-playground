/* Share state between devices with no server and no login.
 *
 * The payload travels in the URL FRAGMENT (#s=1.…), which browsers never
 * send to any server — so a share link is private by construction. The
 * "1." prefix is a format version: bump it if the payload shape changes
 * and keep decoding old versions for as long as old links may circulate.
 * (Pattern lifted from Camp Constellation 2026 schedule sharing, #37.)
 *
 * Node + browser: tests require() this file; the page loads it as a global. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ShareLink = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSION = '1';
  const PAYLOAD_RE = /s=(\d+)\.([A-Za-z0-9_-]+)/;

  function b64url(bytes) {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64url(text) {
    const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - b64.length % 4) % 4));
    return Uint8Array.from(bin, ch => ch.charCodeAt(0));
  }

  function encode(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    return VERSION + '.' + b64url(bytes);
  }

  // Find "s=<version>.<payload>" in a fragment, a full URL, or pasted text.
  function extract(text) {
    const m = String(text ?? '').match(PAYLOAD_RE);
    return m ? m[0] : null;
  }

  function decode(text) {
    if (text == null) return null;
    const s = String(text);
    // bare "1.xxx" is allowed too — normalize to the s= form
    const m = (/^\d+\./.test(s) ? 's=' + s : s).match(PAYLOAD_RE);
    if (!m) return null;
    if (m[1] !== VERSION) return null;   // unknown format version
    try {
      const json = new TextDecoder().decode(unb64url(m[2]));
      const obj = JSON.parse(json);
      return obj && typeof obj === 'object' ? obj : null;
    } catch (e) {
      return null;   // malformed payload: a bad link is "no share", not a crash
    }
  }

  function link(obj, origin) {
    return origin + '/#s=' + encode(obj);
  }

  return { encode, decode, extract, link, VERSION };
});
