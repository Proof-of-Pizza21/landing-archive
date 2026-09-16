import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { capturePage, closeBrowser } from '../src/capture.js';

const picture = () => { const png = new PNG({ width: 30, height: 30 }); png.data.fill(255); return PNG.sync.write(png); };
const response = (url: string, body: string | Buffer, type = 'text/html', status = 200) => ({ url, status, headers: { 'content-type': type }, body: Buffer.isBuffer(body) ? body : Buffer.from(body) });

test('capture verifies deferred content, image bytes, backgrounds and isolated offline rendering', async () => {
  const transport = async (url: string) => url.endsWith('.png') ? response(url, picture(), 'image/png') : response(url, `<!doctype html><title>Offer fixture</title><style>#hero{width:100px;height:100px;background-image:url('/background.png')}</style><h1>Offer</h1><div id="hero"></div><img src="/creative.png" width="30" height="30"><div id="deferred"></div><script>setTimeout(()=>document.querySelector('#deferred').innerHTML='<p id="price">Price 149</p>', 4200)</script>`);
  try {
    const result = await capturePage({ url: 'https://1.1.1.1/', importantSelectors: ['#price'] }, transport);
    assert.equal(result.quality?.version, 2); assert.equal(result.quality?.status, 'complete', JSON.stringify(result.quality));
    assert.equal(result.quality?.stable, true); assert.equal(result.quality?.archiveStatus, 'complete');
    assert.match(result.text, /Price 149/); assert.match(result.html, /Price 149/);
    assert.equal(result.detection!.assets!.length, 2);
    assert.ok(result.detection!.assets!.every(asset => asset.status === 'loaded' && /^[a-f0-9]{64}$/.test(asset.hash!)));
    assert.ok(result.detection!.blocks!.some(block => block.text === 'Price 149'));
  } finally { await closeBrowser(); }
});

test('missing src, failed CSS background and invalid font are partial; important regions override ignored ancestors', async () => {
  const transport = async (url: string) => {
    if (url.endsWith('.woff2')) return response(url, 'invalid font bytes', 'font/woff2');
    if (url.endsWith('/broken.png')) return response(url, 'invalid image bytes', 'image/png');
    if (url.endsWith('.png')) return response(url, '', 'image/png', 404);
    return response(url, `<!doctype html><title>Incomplete fixture</title><style>@font-face{font-family:Fixture;src:url('/missing.woff2')}body{font-family:Fixture,serif}#background{width:100px;height:100px;background:url('/missing.png')}</style><h1>Offer</h1><div id="ignored"><div id="important"><p>Price 149</p><img width="50" height="50"><div id="background"></div><div style="width:50px;height:50px;background:url('/broken.png')"></div></div></div>`);
  };
  try {
    const result = await capturePage({ url: 'https://1.1.1.1/', ignoreSelectors: ['#ignored'], importantSelectors: ['#important'] }, transport);
    assert.equal(result.quality?.status, 'partial'); assert.equal(result.quality?.missingImages, 1);
    assert.ok(result.quality?.reasons.some(reason => /sfondo/.test(reason)));
    assert.ok(result.quality?.reasons.some(reason => /caratteri/.test(reason)));
    assert.ok(result.detection?.assets?.some(asset => asset.url.endsWith('/broken.png') && asset.status === 'failed'));
    assert.ok(result.detection?.assets?.some(asset => asset.url.endsWith('/missing.png') && asset.status === 'failed'));
    assert.ok(result.detection?.blocks?.some(block => block.text === 'Price 149'));
  } finally { await closeBrowser(); }
});

test('blocked telemetry and an unavailable known telemetry script do not make a complete landing partial', async () => {
  const transport = async (url: string) => {
    if (url.includes('www.google-analytics.com')) return response(url, '', 'application/javascript', 404);
    return response(url, '<!doctype html><title>Stable fixture</title><h1>Offer 100</h1><script src="https://www.google-analytics.com/optional.js"></script><script>fetch("https://www.google-analytics.com/collect",{method:"POST",body:"test"}).catch(()=>{})</script>');
  };
  try {
    const result = await capturePage({ url: 'https://1.1.1.1/' }, transport);
    assert.equal(result.quality?.status, 'complete', JSON.stringify(result.quality));
    assert.ok(result.warnings.some(warning => /invio dati bloccate/.test(warning)));
  } finally { await closeBrowser(); }
});
