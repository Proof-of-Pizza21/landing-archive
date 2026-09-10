import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offlineDocument, offlineMaxBytes, offlinePolicy } from '../src/offline.js';
import { parse } from 'parse5';

test('offline copies neutralize active content and map links without changing stored HTML', () => {
  const source = `<html manifest="https://outside.example/cache"><head><meta http-equiv="refresh" content="0;url=https://outside.example"><base href="https://outside.example"><script>parent.pwned=1</script><style>body{background:url(https://outside.example/pixel)}</style><link rel="preload" href="https://outside.example/preload"></head><body onload="parent.pwned=1"><a href="/offer/#price" target="_top" ping="https://outside.example/ping" data-archive-target="999">Offer</a><a href="https://outside.example/">Outside</a><a href="#section">Section</a><a href="javascript:alert(1)">Code</a><img src="https://outside.example/pixel" srcset="https://outside.example/pixel 2x" onerror="alert(1)"><img src="data:image/png;base64,AA=="><form action="/api/auth/logout"><button formaction="/api/auth/logout">Send</button></form><svg><a href="https://outside.example/"><animate attributeName="href" to="https://outside.example">bad</animate>SVG link</a><foreignObject><iframe src="/api/export"></iframe></foreignObject><use href="https://outside.example/icon.svg#icon"/></svg></body></html>`;
  const html = offlineDocument(source, 'https://1.1.1.1/', [{ id: 'offer', url: 'https://1.1.1.1/offer/', finalUrl: 'https://1.1.1.1/offer/', title: 'Offer', capturedAt: '2026-09-01T00:00:00.000Z', later: false }]);
  assert.match(html, /data-archive-target="offer"/); assert.match(html, /data-archive-fragment="price"/);
  assert.match(html, /data-archive-target="missing"/); assert.match(html, /href="#section"/);
  assert.match(html, /src="data:image\/png/); assert.match(html, /<button disabled/);
  const pending: any[] = [parse(html)];
  while (pending.length) {
    const node = pending.pop(); pending.push(...(node.childNodes || []));
    assert.ok(!['script', 'meta', 'base', 'iframe', 'foreignObject', 'animate'].includes(node.tagName));
    for (const attr of node.attrs || []) {
      assert.ok(!/^on|^(target|ping|srcset|action|formaction|manifest)$/.test(attr.name));
      if (attr.name === 'href') assert.ok(attr.value.startsWith('#'));
      if (attr.name === 'src') assert.ok(attr.value.startsWith('data:image/'));
    }
  }
  assert.match(offlinePolicy, /script-src 'none'/); assert.match(offlinePolicy, /connect-src 'none'/);
  assert.match(source, /parent.pwned/);
});

test('offline rendering bounds bytes, element count and nesting before serialization', () => {
  assert.throws(() => offlineDocument('x'.repeat(offlineMaxBytes + 1), 'https://1.1.1.1/', []), { statusCode: 413 });
  assert.throws(() => offlineDocument('<i></i>'.repeat(25001), 'https://1.1.1.1/', []), { statusCode: 413 });
  assert.throws(() => offlineDocument('<div>'.repeat(160), 'https://1.1.1.1/', []), { statusCode: 413 });
});
