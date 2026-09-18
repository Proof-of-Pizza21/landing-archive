import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync,mkdtempSync,mkdirSync,rmSync,writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { zipEntries } from './zip-helper.js';

test('research UI opens exact evidence, saves notes, previews restore and browses portable pages without live traffic',async()=> {
  const directory=mkdtempSync(join(tmpdir(),'landing-research-ui-'));
  process.env.DATA_DIR=directory;process.env.MIN_FREE_GIB='0';process.env.SCHEDULER_ENABLED='false';
  const { createApp }=await import('../src/server.js');const { db,get,addPage,now }=await import('../src/db.js');const { recordCapture }=await import('../src/history.js');
  const app=await createApp();let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
  try {
    const setup=await app.inject({method:'POST',url:'/api/auth/setup',payload:{username:'research-test',password:'temporary-test-password'}});const authorization=`Bearer ${setup.json().token}`;
    const call=(url:string)=>app.inject({url,headers:{authorization}});
    const site=(await app.inject({method:'POST',url:'/api/sites',headers:{authorization},payload:{name:'Campaign notes',url:'https://1.1.1.1/',maxPages:10}})).json().site;
    const root=get('SELECT * FROM pages WHERE site_id=?',site.id)!;const png=new PNG({width:20,height:20});png.data.fill(255);
    const save=async(url:string,title:string,when:string)=>{const p=addPage(site.id,url).page;const v=await recordCapture(p,get('SELECT * FROM sites WHERE id=?',site.id)!,{requestedUrl:url,finalUrl:url,title,text:title,statusCode:200,links:[],headings:[],imageUrls:[],warnings:[], quality: { version: 2, stable: true, renderStatus: 'complete', archiveStatus: 'complete', status: 'complete', missingImages: 0, reasons: [] }, screenshot:PNG.sync.write(png),capturedAt:when,html:`<html><head data-check="yes"><style>@import url('https://outside.example/style');body{font:20px system-ui;padding:30px}</style><script>window.compromised=true;fetch('https://outside.example/script')</script></head><body><h1>${title}</h1><a href="/offer/">Secondary page</a><img src="https://outside.example/image" onerror="window.compromised=true"><a href="https://outside.example/live">Live link</a><form action="https://outside.example/send"><button>Send</button></form></body></html>`});return v.versionId;};
    const old=await save(root.url,'First campaign',new Date(Date.now()-3600000).toISOString());
    await save('https://1.1.1.1/offer/','Archived offer',new Date(Date.now()-3500000).toISOString());
    const latest=await save(root.url,'Updated campaign',now());
    await app.listen({host:'127.0.0.1',port:0});const origin=`http://127.0.0.1:${(app.server.address() as {port:number}).port}`;
    const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(process.platform==='darwin'&&existsSync(chrome)?chrome:undefined)});
    const context=await browser.newContext({viewport:{width:1440,height:1100}});await context.addInitScript(({ origin, token }) => { if (location.origin === origin) sessionStorage.setItem('landing-archive.session.v2', token); }, { origin, token: authorization.slice(7) });
    const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${origin}/#/inbox`);await page.getByRole('heading',{name:'Novità da leggere',exact:true}).waitFor();
    await page.getByRole('link',{name:'Apri questa versione',exact:true}).click();
    assert.ok(page.url().endsWith('/'+latest));await page.frameLocator('iframe[title="Pagina archiviata offline"]').getByRole('heading',{name:'Updated campaign'}).waitFor();
    await page.goto(`${origin}/#/page/${root.id}/${old}`);await page.frameLocator('iframe[title="Pagina archiviata offline"]').getByRole('heading',{name:'First campaign'}).waitFor();
    await page.getByLabel('Tag',{exact:true}).fill('Webinar, lancio');await page.getByLabel('Annotazione',{exact:true}).fill('Lead magnet: <script> remains plain text');await page.getByLabel('Preferita',{exact:true}).check();await page.getByRole('button',{name:'Salva appunti',exact:true}).click();await page.getByText('Appunti salvati nella raccolta',{exact:true}).waitFor();
    await page.getByRole('link',{name:'Apri raccolta',exact:true}).click();await page.getByRole('heading',{name:'Raccolta',exact:true}).waitFor();await page.getByText('Lead magnet: <script> remains plain text',{exact:true}).waitFor();
    await page.getByLabel('Cerca negli appunti').fill('Lead magnet');await page.getByRole('link',{name:'Apri versione e appunti'}).waitFor();
    await page.getByRole('link',{name:'Apri versione e appunti'}).click();assert.ok(page.url().endsWith('/'+old));
    await page.getByRole('link',{name:'Novità da leggere',exact:true}).click();await page.getByRole('link',{name:'Apri questa versione',exact:true}).waitFor();await page.getByRole('button',{name:'Segna questi eventi come letti'}).click();await page.getByRole('heading',{name:'Nessuna novità con questi filtri'}).waitFor();await page.getByLabel('Solo da leggere').uncheck();await page.getByRole('button',{name:'Segna da leggere',exact:true}).first().waitFor();
    const shots=process.env.UI_SCREENSHOT_DIR;if(shots){mkdirSync(shots,{recursive:true});await page.screenshot({path:join(shots,'inbox-desktop.png'),fullPage:true});}
    const backup=(await call('/api/export')).rawPayload;
    await page.getByRole('link',{name:'Backup e ripristino',exact:true}).click();await page.getByLabel('Backup ZIP').setInputFiles({name:'fixture.zip',mimeType:'application/zip',buffer:backup});await page.getByRole('button',{name:'Carica e verifica backup',exact:true}).click();await page.getByRole('heading',{name:'Backup verificato'}).waitFor({timeout:20000});
    assert.equal(await page.getByRole('button',{name:'Sostituisci archivio e ripristina'}).isEnabled(),false);assert.equal(get('SELECT count(*) n FROM versions')!.n,3);
    if(shots)await page.screenshot({path:join(shots,'restore-preview.png'),fullPage:true});
    await page.getByRole('button',{name:'Annulla caricamento',exact:true}).click();await page.getByRole('button',{name:'Carica e verifica backup',exact:true}).waitFor();
    await page.setViewportSize({width:390,height:844});await page.goto(`${origin}/#/library`);await page.getByRole('heading',{name:'Raccolta',exact:true}).waitFor();await page.getByRole('link',{name:'Apri versione e appunti'}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(shots)await page.screenshot({path:join(shots,'library-phone.png'),fullPage:true});
    const portable=zipEntries((await call(`/api/sites/${site.id}/export`)).rawPayload);const output=join(directory,'portable');for(const [name,contents] of portable){const path=join(output,name);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,contents);}
    const local=await browser.newContext();const remote:string[]=[];await local.route(/^https?:/,route=>{remote.push(route.request().url());return route.abort();});const offline=await local.newPage();
    await offline.goto(pathToFileURL(join(output,'index.html')).href);await offline.getByRole('link',{name:'First campaign',exact:true}).click();await offline.getByRole('heading',{name:'First campaign'}).waitFor();assert.equal(await offline.evaluate(()=>Reflect.get(window,'compromised')),undefined);
    await offline.getByRole('link',{name:'Secondary page',exact:true}).click();await offline.getByRole('heading',{name:'Archived offer'}).waitFor();assert.equal(await offline.getByRole('button',{name:'Send',exact:true}).isEnabled(),false);
    await offline.getByRole('link',{name:'Live link',exact:true}).click();assert.ok(offline.url().startsWith('file:'));assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);await local.close();
  } finally {await browser?.close();await app.close();db.close();rmSync(directory,{recursive:true,force:true});}
});
