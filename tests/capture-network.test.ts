import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CaptureError, isPublicAddress, isUrlInScope, normalizeUrl, resolvePublicAddress, safeRequest, validatePublicUrl } from '../src/network.js';
import { allowedByRobots, extractPageLinks, parseRobots, parseSitemap } from '../src/discovery.js';

test('rejects private, loopback, metadata and transition addresses', () => {
  for (const address of ['0.0.0.0', '127.0.0.1', '10.0.0.1', '172.16.1.1', '192.168.1.1', '169.254.169.254', '100.64.1.1', '198.18.0.1', '224.0.0.1', '::1', '::', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '64:ff9b::a00:1', '2002:7f00:1::', '2001:db8::1']) assert.equal(isPublicAddress(address), false, address);
  for (const address of ['1.1.1.1', '8.8.8.8', '93.184.215.14', '2606:4700:4700::1111', '2001:4860:4860::8888']) assert.equal(isPublicAddress(address), true, address);
});

test('URL normalization rejects credentials/protocols and keeps meaningful query variants', () => {
  assert.equal(normalizeUrl(' https://Example.com/a?variant=B&utm_campaign=spring#section '), 'https://example.com/a?variant=B&utm_campaign=spring');
  for (const value of ['file:///etc/passwd', 'ftp://example.com', 'javascript:alert(1)', 'https://name:pass@example.com']) assert.throws(() => normalizeUrl(value), CaptureError);
});

test('blocks encoded localhost and private domains before opening a socket', async () => {
  for (const value of ['http://2130706433', 'http://0x7f000001', 'http://127.1', 'http://[::ffff:127.0.0.1]', 'http://localhost.', 'http://umbrel.local', 'http://example.com:3000']) await assert.rejects(validatePublicUrl(value), CaptureError);
  await assert.rejects(safeRequest('http://169.254.169.254/latest/meta-data'), CaptureError);
});

test('DNS validation rejects mixed public/private answers and returns the validated address', async () => {
  await assert.rejects(resolvePublicAddress('https://example.com', async () => [{ address: '1.1.1.1', family: 4 }, { address: '127.0.0.1', family: 4 }]), CaptureError);
  const answer = await resolvePublicAddress('https://example.com', async () => [{ address: '1.1.1.1', family: 4 }]);
  assert.equal(answer.address.address, '1.1.1.1');
});

test('scope matches www alias and explicit subdomains, never suffix tricks', () => {
  assert.equal(isUrlInScope('https://www.example.com/a', 'https://example.com'), true);
  assert.equal(isUrlInScope('https://sale.example.com/a', 'https://example.com'), false);
  assert.equal(isUrlInScope('https://sale.example.com/a', 'https://example.com', true), true);
  assert.equal(isUrlInScope('https://example.com.attacker.org/a', 'https://example.com', true), false);
  assert.equal(isUrlInScope('https://notexample.com/a', 'https://example.com', true), false);
});

test('discovery extracts relative and encoded links without treating scripts or files as pages', () => {
  const links = extractPageLinks(`<a href='/launch?variant=A&amp;offer=1'>Offer</a><a href=/other>Other</a><a href='mailto:x@example.com'>Mail</a><a href='/file.pdf'>PDF</a><script>const html = '<a href="/fake">';</script><!-- <a href='/comment'> -->`, 'https://example.com');
  assert.deepEqual(links, ['https://example.com/launch?variant=A&offer=1', 'https://example.com/other']);
});

test('parses sitemap indexes and XML namespaces while rejecting entity declarations', () => {
  assert.deepEqual(parseSitemap('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/a?a=1&amp;b=2</loc></url></urlset>'), { pages: ['https://example.com/a?a=1&b=2'], indexes: [] });
  assert.deepEqual(parseSitemap('<sitemapindex><sitemap><loc>https://example.com/pages.xml</loc></sitemap></sitemapindex>'), { pages: [], indexes: ['https://example.com/pages.xml'] });
  assert.throws(() => parseSitemap('<!DOCTYPE foo [<!ENTITY x SYSTEM "file:///etc/passwd">]><urlset/>'), CaptureError);
});

test('robots chooses specific agent and longest applicable allow/disallow rule', () => {
  const robots = parseRobots('User-agent: *\nDisallow: /\nUser-agent: LandingArchive\nDisallow: /private\nAllow: /private/public\nSitemap: https://example.com/sitemap.xml');
  assert.equal(allowedByRobots('https://example.com/offer', robots.rules), true);
  assert.equal(allowedByRobots('https://example.com/private', robots.rules), false);
  assert.equal(allowedByRobots('https://example.com/private/public', robots.rules), true);
  assert.deepEqual(robots.sitemaps, ['https://example.com/sitemap.xml']);
});
