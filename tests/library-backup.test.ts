import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PNG } from 'pngjs';
import { ZipArchive } from 'archiver';
import { zipEntries, zipFixture } from './zip-helper.js';

test('reading inbox, version research, portable export and guarded restore preserve evidence', async t => {
  const directory = mkdtempSync(join(tmpdir(),'landing-library-'));
  process.env.DATA_DIR=directory; process.env.MIN_FREE_GIB='0'; process.env.SCHEDULER_ENABLED='false';
  const { createApp }=await import('../src/server.js');
  const { db,get,all,run,addPage,addEvent,now }=await import('../src/db.js');
  const { recordCapture }=await import('../src/history.js');
  const app=await createApp();
  const setup=await app.inject({method:'POST',url:'/api/auth/setup',payload:{username:'archive-test',password:'temporary-test-password'}});
  const authorization=`Bearer ${setup.json().token}`;
  const call=(method:any,url:string,payload?:any,headers={})=>app.inject({method,url,payload,headers:{authorization,...headers}});
  let site:any,page:any,first='',second='',eventId='',backup:Buffer;
  const capture=async(title:string,url='https://1.1.1.1/',when=now())=> {
    const p=addPage(site.id,url).page, png=new PNG({width:12,height:12});png.data.fill(255);
    return recordCapture(p,get('SELECT * FROM sites WHERE id=?',site.id)!,{requestedUrl:url,finalUrl:url,title,text:title,html:`<html><head data-head="x"><style>@import url('https://outside.example/spy');</style><script>window.compromised=true</script></head><body><h1>${title}</h1><a href="/offer/">Offer link</a><img src="https://outside.example/spy"><form action="https://outside.example/send"><button>Send</button></form></body></html>`,screenshot:PNG.sync.write(png),statusCode:200,links:[],headings:[],imageUrls:[],warnings:[],quality:{status:'complete',missingImages:0,reasons:[],version:2,stable:true,renderStatus:'complete',archiveStatus:'complete'},capturedAt:when});
  };
  const upload=async(bytes:Buffer)=> {
    const start=await call('POST','/api/restore/uploads',{bytes:bytes.length});assert.equal(start.statusCode,200,start.body);const id=start.json().id;
    for(let offset=0;offset<bytes.length;offset+=1024**2){const chunk=await call('PUT',`/api/restore/uploads/${id}?offset=${offset}`,bytes.subarray(offset,offset+1024**2),{'content-type':'application/octet-stream'});assert.equal(chunk.statusCode,200,chunk.body);}
    return id;
  };
  const mutated=async(fn:(copy:DatabaseSync)=>void)=> {
    const files=zipEntries(backup),path=join(directory,'fixture.sqlite');writeFileSync(path,files.get('archive.sqlite')!);const copy=new DatabaseSync(path);try{fn(copy);}finally{copy.close();}files.set('archive.sqlite',readFileSync(path));rmSync(path);return zipFixture(files);
  };
  try {
    site=(await call('POST','/api/sites',{name:'Competitor fixture',url:'https://1.1.1.1/',maxPages:10})).json().site;
    page=get('SELECT * FROM pages WHERE site_id=?',site.id)!;
    first=(await capture('Offer A','https://1.1.1.1/','2026-09-10T10:00:00.000Z')).versionId;
    second=(await capture('Offer B','https://1.1.1.1/','2026-09-12T10:00:00.000Z')).versionId;
    await capture('Secondary','https://1.1.1.1/offer/','2026-09-11T10:00:00.000Z');
    eventId=get("SELECT id FROM events WHERE kind='changed'")!.id;
    await t.test('event filters, read/unread state and preferences never remove history',async()=> {
      const before=get('SELECT count(*) n FROM events')!.n;
      let result=(await call('GET','/api/inbox?group=competitor&unread=true')).json();assert.ok(result.events.some((e:any)=>e.id===eventId));
      assert.equal((await call('PUT','/api/inbox/read',{ids:[eventId],read:true})).statusCode,200);
      result=(await call('GET','/api/inbox?unread=true')).json();assert.ok(!result.events.some((e:any)=>e.id===eventId));
      result=(await call('GET','/api/inbox?unread=false&important=false')).json();assert.ok(result.events.find((e:any)=>e.id===eventId).readAt);
      assert.equal((await call('GET','/api/inbox?group=own')).json().total,0);
      assert.equal((await call('GET','/api/inbox?from=2030-01-01')).json().total,0);
      assert.equal((await call('GET','/api/inbox?from=2026-02-30')).statusCode,400);
      await call('PUT','/api/inbox/preferences',{kinds:[]});assert.equal((await call('GET','/api/inbox')).json().total,0);
      assert.equal((await call('PUT','/api/inbox/preferences',{kinds:['toString']})).statusCode,400);
      await call('PUT','/api/inbox/preferences',{kinds:['changed','missing']});
      assert.equal(get('SELECT count(*) n FROM events')!.n,before);
    });
    await t.test('annotations belong to an exact version, tags normalize and filters combine',async()=> {
      const saved=await call('PUT',`/api/versions/${first}/annotation`,{note:'Test lead magnet <script>unsafe</script>',tags:['Webinar','webinar','Lancio'],favorite:true});assert.equal(saved.statusCode,200,saved.body);
      assert.equal((await call('GET',`/api/versions/${second}/annotation`)).json().note,'');
      const library=(await call('GET','/api/library?tag=webinar&q=magnet&favorite=true&from=2026-09-01&to=2026-09-11')).json();assert.equal(library.versions[0].id,first);assert.deepEqual(library.versions[0].tags,['lancio','webinar']);
      assert.equal((await call('GET','/api/library?tag=missing')).json().total,0);
      assert.equal((await call('PUT',`/api/versions/${first}/annotation`,{note:'',tags:Array(13).fill('x'),favorite:true})).statusCode,400);
    });
    await t.test('portable export includes chronology and inert pages with local links',async()=> {
      const result=await call('GET',`/api/sites/${site.id}/export`);assert.equal(result.statusCode,200,result.body.slice(0,200));const files=zipEntries(result.rawPayload);
      assert.equal(files.has('archive.sqlite'),false);assert.match(files.get('index.html')!.toString(),/Test lead magnet &lt;script&gt;/);
      assert.match(files.get('index.html')!.toString(),/webinar/);assert.equal(files.size,7);
      const firstHtml=files.get('versions/1.html')!.toString();assert.doesNotMatch(firstHtml,/<script|<meta[^>]*refresh|src="https:/i);assert.match(firstHtml,/Content-Security-Policy/);assert.match(firstHtml,/href="2.html"/);assert.match(firstHtml,/Indice dell’archivio/);
      assert.equal(get('SELECT count(*) n FROM versions')!.n,3);
    });
    backup=(await call('GET','/api/export')).rawPayload;
    await t.test('upload needs auth/origin and rejects excessive size, wrong offsets and oversize chunks',async()=> {
      assert.equal((await call('POST','/api/restore/uploads',{bytes:100},{authorization:''})).statusCode,401);
      assert.equal((await call('POST','/api/restore/uploads',{bytes:100},{origin:'https://outside.example'})).statusCode,403);
      assert.equal((await call('POST','/api/restore/uploads',{bytes:33*1024**3})).statusCode,400);
      const id=(await call('POST','/api/restore/uploads',{bytes:2000000})).json().id;
      assert.equal((await call('PUT',`/api/restore/uploads/${id}?offset=1`,Buffer.from('wrong'),{'content-type':'application/octet-stream'})).statusCode,400);
      assert.equal((await call('PUT',`/api/restore/uploads/${id}?offset=0`,Buffer.alloc(1024**2+1),{'content-type':'application/octet-stream'})).statusCode,413);
      assert.equal((await call('DELETE',`/api/restore/uploads/${id}`)).statusCode,200);
    });
    await t.test('corrupt files, unsafe paths, duplicate entries, schemas and bad references are refused without live changes',async()=> {
      const original=get('SELECT count(*) n FROM versions')!.n;
      const files=zipEntries(backup);files.set([...files.keys()].find(n=>n.endsWith('.html'))!,Buffer.from('altered'));
      const extras=zipEntries(backup);extras.set('worker-token',Buffer.from('unexpected'));
      const duplicate = await zipFixture([...zipEntries(backup), ['manifest.json', zipEntries(backup).get('manifest.json')!]]);
      const computedSetting = await mutated(copy => copy.exec("DROP TABLE settings; CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT AS ('[]')); INSERT INTO settings(key) VALUES ('inbox_kinds')"));
      const malformed=[computedSetting, duplicate, await zipFixture(files),await zipFixture(extras),await mutated(copy=>copy.exec('CREATE VIEW hostile AS SELECT * FROM sites')),await mutated(copy=>copy.exec("UPDATE pages SET last_version_id='unknown'")),await mutated(copy=>copy.exec("UPDATE objects SET path='../outside'")),await mutated(copy=>copy.exec("UPDATE versions SET detection='{}'"))];
      for(const zip of malformed){const token=await upload(zip);const verified=await call('POST',`/api/restore/uploads/${token}/verify`);assert.equal(verified.statusCode,422,verified.body);assert.equal(get('SELECT count(*) n FROM versions')!.n,original);assert.equal((await call('GET','/api/restore/status')).json().upload,null);}
    });
    await t.test('maintenance fences concurrent operations and an interrupted database replacement rolls back',async()=> {
      const token=await upload(backup);assert.equal((await call('POST',`/api/restore/uploads/${token}/verify`)).statusCode,200);
      const originalPrepare=db.prepare.bind(db), finalize=ZipArchive.prototype.finalize;
      let zip:ZipArchive|undefined, release:(()=>void)|undefined;
      const pause=mock.method(ZipArchive.prototype,'finalize',function(this:ZipArchive){zip=this;return new Promise<void>(resolve=>{release=resolve;});});
      const injectFailure=mock.method(db,'prepare',function(sql:string){if(sql.startsWith('INSERT INTO versions SELECT'))throw new Error('Injected disk transaction failure');return originalPrepare(sql);});
      try {
        const applying=Promise.resolve(call('POST',`/api/restore/uploads/${token}/apply`,{confirmId:token,password:'temporary-test-password'}));
        for(let n=0;n<500&&!zip;n++)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(zip);
        assert.equal((await call('DELETE',`/api/sites/${site.id}`,{confirmSiteId:site.id})).statusCode,503);
        assert.equal((await call('POST',`/api/pages/${page.id}/scan`)).statusCode,503);
        assert.equal((await call('GET','/api/export')).statusCode,503);
        assert.equal((await call('GET','/api/restore/status')).json().applying,true);
        await finalize.call(zip!);release!();assert.equal((await applying).statusCode,500);
        assert.equal(get('SELECT count(*) n FROM versions')!.n,3);assert.deepEqual(all('PRAGMA foreign_key_check'),[]);
        assert.equal((await call('GET','/api/restore/status')).json().applying,false);
      } finally {pause.mock.restore();injectFailure.mock.restore();await call('DELETE',`/api/restore/uploads/${token}`);}
    });
    await t.test('validated replacement needs current password and matching confirmation, keeps rollback ZIP and current account',async()=> {
      await capture('New live version','https://1.1.1.1/','2026-09-14T10:00:00.000Z');
      const token=await upload(backup),verified=await call('POST',`/api/restore/uploads/${token}/verify`);assert.equal(verified.statusCode,200,verified.body);assert.equal(verified.json().versions,3);assert.equal(get('SELECT count(*) n FROM versions')!.n,4);
      assert.equal((await call('POST',`/api/restore/uploads/${token}/apply`,{confirmId:token,password:'wrong-password'})).statusCode,403);
      assert.equal((await call('POST',`/api/restore/uploads/${token}/apply`,{confirmId:'wrong',password:'temporary-test-password'})).statusCode,403);
      const applied=await call('POST',`/api/restore/uploads/${token}/apply`,{confirmId:token,password:'temporary-test-password'});assert.equal(applied.statusCode,200,applied.body);
      assert.equal(get('SELECT count(*) n FROM versions')!.n,3);assert.equal(get('SELECT paused FROM sites')!.paused,1);assert.equal(get('SELECT count(*) n FROM jobs')!.n,0);
      assert.equal(get('SELECT username FROM users')!.username,'archive-test');assert.equal((await call('GET','/api/sites')).statusCode,200);assert.deepEqual(all('PRAGMA foreign_key_check'),[]);
      assert.equal((await call('GET',`/api/versions/${first}/annotation`)).json().favorite,true);assert.equal(get('SELECT count(*) n FROM event_reads')!.n,1);
      const safety=zipEntries((await call('GET','/api/restore/safety')).rawPayload);const path=join(directory,'safety.sqlite');writeFileSync(path,safety.get('archive.sqlite')!);const copy=new DatabaseSync(path);assert.equal(copy.prepare('SELECT count(*) n FROM versions').get()!.n,4);copy.close();
    });
    await t.test('old schema 3 backup restores into new schema and deletion cascades research and read state',async()=> {
      const old=await mutated(copy=>copy.exec('DROP TABLE version_tags; DROP TABLE version_notes; DROP TABLE event_reads; PRAGMA user_version=3;'));
      const files=zipEntries(old),manifest=JSON.parse(files.get('manifest.json')!.toString());manifest.schema=3;files.set('manifest.json',Buffer.from(JSON.stringify(manifest)));
      const token=await upload(await zipFixture(files));assert.equal((await call('POST',`/api/restore/uploads/${token}/verify`)).statusCode,200);
      await call('DELETE',`/api/restore/uploads/${token}`);
      assert.equal((await call('DELETE',`/api/sites/${site.id}`,{confirmSiteId:site.id})).statusCode,200);
      for(const table of ['version_notes','version_tags','event_reads'])assert.equal(get(`SELECT count(*) n FROM ${table}`)!.n,0);
      assert.deepEqual(all('PRAGMA foreign_key_check'),[]);
    });
  } finally {await app.close();db.close();rmSync(directory,{recursive:true,force:true});}
});
