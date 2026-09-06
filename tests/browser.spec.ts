import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { metadataScript } from '../src/page-metadata.js';

test('rendered metadata excludes randomized invisible traps but retains real content and links', async () => {
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (process.platform === 'darwin' && existsSync(chrome) ? chrome : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, chromiumSandbox: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.abort());
    const render = async (random: string) => {
      await page.setContent(`<base href="https://example.com/"><title>Landing</title><body>
        <div style="display:contents"><h1>Offerta reale</h1><a href="/offer">Scopri</a></div>
        <div style="display:none">display ${random}</div>
        <div style="visibility:hidden">visibility ${random}</div>
        <div style="position:absolute;overflow:hidden;display:inline;height:1px;width:1px;z-index:-1000;padding:0"><label>trap ${random}</label><input></div>
        <div style="opacity:0">opacity ${random}</div><div style="position:absolute;left:-9000px">offscreen ${random}</div>
        <div class="ignore"><a href="/random-${random}">Ignored ${random}</a><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"></div>
        <div><label>Nome *</label>${random === 'A' ? '<div hidden>random field</div>\n ' : ''}<label>Email *</label>${random === 'B' ? '<div hidden>random field</div>\n ' : ''}<label>Messaggio</label></div>
        <div style="margin-top:2000px"><h2>Contenuto in fondo</h2></div>
      </body>`);
      return await page.evaluate(`${metadataScript}([".ignore"])`) as any;
    };
    const a = await render('A'), b = await render('B');
    assert.equal(a.text.replace(/\s+/g, ' '), b.text.replace(/\s+/g, ' '));
    assert.match(a.text, /Offerta reale/); assert.match(a.text, /Contenuto in fondo/);
    assert.equal(/trap|opacity|offscreen|Ignored/.test(a.text), false);
    assert.deepEqual(a.links, [{ url: 'https://example.com/offer', text: 'Scopri' }]);
    assert.deepEqual(a.headings, ['Offerta reale', 'Contenuto in fondo']);
    assert.deepEqual(a.imageUrls, []);
  } finally { await browser.close(); }
});
