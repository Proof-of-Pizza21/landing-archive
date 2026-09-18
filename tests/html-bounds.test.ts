import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanHtml } from '../src/html-bounds.js';
import { extractPageLinks } from '../src/discovery.js';
import { sanitizeArchiveDocument, htmlTransformLimits } from '../src/html-transform.js';

test('linear scanner handles quoted delimiters, raw content and Unicode without changing offsets', () => {
  const source = `İstanbul<script>"<a href='/script/'>"</ScRiPtX><a href='/still-script/'>\n</SCRIPT ><style>.test:after{content:"<a href='/style/'>"}</style><textarea><a href='/textarea/'>ignored</textarea><!-- <a href='/comment/'> --><A title=">" HREF="/offer/?a=1&amp;b=2">Offer</A><a HREF='/first/' href='/duplicate/'>First wins</a>`;
  assert.deepEqual(extractPageLinks(source, 'https://example.com/'), ['https://example.com/offer/?a=1&b=2', 'https://example.com/first/']);
});

test('guard accepts ordinary omitted end tags and self-closing SVG shapes while rejecting true deep nesting', async () => {
  const source = '<!doctype html><html><head><title>Ordinary markup</title></head><body>' +
    '<ul>' + '<li><span>Item</span>'.repeat(200) + '</ul>' +
    '<dl>' + '<dt>Term<dd>Definition'.repeat(200) + '</dl>' +
    '<table><tbody>' + '<tr><td>Left<td>Right'.repeat(200) + '</table>' +
    '<svg>' + '<path d="M 0 0 L 10 10"/>'.repeat(200) + '</svg>' +
    '<constructor>Neutral custom tag</constructor></body></html>';
  assert.doesNotThrow(() => scanHtml(source));
  assert.match(await sanitizeArchiveDocument(source, 'https://example.com/'), /Ordinary markup/);
  assert.throws(() => scanHtml('<div>'.repeat(151)), { code: 'HTML_LIMIT' });
  assert.throws(() => scanHtml('<div />'.repeat(151)), { code: 'HTML_LIMIT' }, 'HTML non-void self-closing syntax must not evade the nesting guard');
});

test('large embedded assets survive the guard and trusted transform without whole-document case folding', async () => {
  const image = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.repeat(131072);
  const source = `<h1>Embedded asset</h1><img src="data:image/png;base64,${image}">`;
  const result = await sanitizeArchiveDocument(source, 'https://example.com/');
  assert.ok(result.includes(image));
  assert.match(result, /Content-Security-Policy/);
});

test('a cancelled child keeps its concurrency slot until process exit', async () => {
  assert.equal(htmlTransformLimits.concurrency, 1);
  const first = new AbortController();
  const pending = sanitizeArchiveDocument('<h1>Cancelled</h1>', 'https://example.com/', { signal: first.signal }).catch(error => error);
  first.abort();
  await pending;
  // Promise continuations run before the OS child-exit event. All remaining
  // capacity is the waiting queue; starting a replacement immediately would
  // temporarily overlap processes and incorrectly accept one extra request.
  const waiting = Array.from({ length: htmlTransformLimits.waiting }, () => sanitizeArchiveDocument('<p>Next</p>', 'https://example.com/'));
  await assert.rejects(sanitizeArchiveDocument('<p>Over limit</p>', 'https://example.com/'), { code: 'HTML_BUSY' });
  await Promise.all(waiting);
});
