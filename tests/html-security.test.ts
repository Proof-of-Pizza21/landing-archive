import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { parse } from 'parse5';
import { offlineDocumentIsolated, sanitizeArchiveDocument, htmlTransformLimits } from '../src/html-transform.js';
import { archivePolicy } from '../src/offline.js';

test('trusted sanitation rejects page-controlled active content and preserves archival navigation metadata', async () => {
  const source = `<head><meta http-equiv="refresh" content="0;url=https://outside.example"><meta http-equiv="Content-Security-Policy" content="script-src *"></head><body onload="alert(1)"><script>fetch('/api/export')</script><a href="/offer/#price" target="_top">Offer</a><img src="data:image/png;base64,AA==" onerror="alert(1)"><form action="https://outside.example"><button>Send</button></form><svg><a href="javascript:alert(1)">SVG</a><foreignObject><script>alert(1)</script></foreignObject></svg>`;
  const clean = await sanitizeArchiveDocument(source, 'https://example.com/');
  assert.match(source, /onload/);
  assert.match(clean, /data-archive-href="https:\/\/example.com\/offer\/#price"/);
  const stack: any[] = [parse(clean)];
  let policies = 0;
  while (stack.length) {
    const node = stack.pop(); stack.push(...(node.childNodes || []));
    assert.ok(!['script', 'iframe', 'foreignObject', 'object', 'embed'].includes(node.tagName));
    for (const attribute of node.attrs || []) {
      assert.ok(!/^on|^(target|action|srcdoc|formaction)$/.test(attribute.name));
      if (attribute.name === 'href') assert.ok(attribute.value.startsWith('#'));
    }
    if (node.tagName === 'meta' && node.attrs.some((a: any) => a.name === 'http-equiv')) {
      assert.equal(node.attrs.find((a: any) => a.name === 'content').value, archivePolicy); policies++;
    }
  }
  assert.equal(policies, 1);
  const replay = await offlineDocumentIsolated(clean, 'https://example.com/', [{ id: 'offer', url: 'https://example.com/offer/', finalUrl: 'https://example.com/offer/', title: '', capturedAt: '', later: false }]);
  assert.match(replay, /data-archive-target="offer"/);
  assert.match(replay, /data-archive-fragment="price"/);
});

test('attribute floods and deep trees are rejected while the parent event loop remains responsive', async () => {
  const inputs = ['<div ' + Array.from({ length: 120000 }, (_, i) => `a${i}=""`).join(' ') + '>', '<div>'.repeat(24000) + '</div>'.repeat(24000)];
  for (const input of inputs) {
    let heartbeats = 0;
    const timer = setInterval(() => { heartbeats++; }, 5);
    try { await assert.rejects(sanitizeArchiveDocument(input, 'https://example.com/'), { code: 'HTML_LIMIT' }); }
    finally { clearInterval(timer); }
    assert.ok(heartbeats > 0, 'Untrusted parsing must not run on the parent event loop');
  }
  assert.match(await sanitizeArchiveDocument('<h1>Still available</h1>', 'https://example.com/'), /Still available/);
});

test('queued transformations are bounded and cancellation does not leave occupied slots', async () => {
  const controllers = Array.from({ length: htmlTransformLimits.concurrency + htmlTransformLimits.waiting }, () => new AbortController());
  const pending = controllers.map(controller => sanitizeArchiveDocument('<h1>Queued page</h1>', 'https://example.com/', { signal: controller.signal }).catch(error => error));
  await assert.rejects(sanitizeArchiveDocument('<p>Excess</p>', 'https://example.com/'), { code: 'HTML_BUSY' });
  controllers.forEach(controller => controller.abort());
  await Promise.all(pending);
  assert.match(await sanitizeArchiveDocument('<p>Recovered</p>', 'https://example.com/'), /Recovered/);
});

test('unclosed script and comment floods are scanned in bounded linear time', () => {
  // A separate process enforces a real deadline even if a regression blocks JS.
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { extractPageLinks } from './src/discovery.ts';
    for (const repeated of ['<script a>', '<!--']) {
      const input = '<a href="/offer/">Offer</a>' + repeated.repeat(Math.floor(3000000 / repeated.length));
      assert.deepEqual(extractPageLinks(input, 'https://example.com/'), ['https://example.com/offer/']);
    }
  `], { timeout: 4000, encoding: 'utf8' });
  assert.equal(result.error, undefined, 'Link discovery exceeded its external deadline');
  assert.equal(result.status, 0, result.stderr);
});
