import { SecureLink } from './SecureResources';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDownToLine, ShieldCheck } from 'lucide-react';
import { api, post } from './client';

type Preview = { sites: number; pages: number; versions: number; checks: number; bytes: number; createdAt: string };
type Upload = { id: string; preview?: Preview; received: number; bytes: number; busy: boolean };
type Status = { applying: boolean; safetyAvailable: boolean; upload: Upload | null };
const size = (bytes: number) => { const unit = bytes > 0 ? Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024))) : 0; return (bytes / 1024 ** unit).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + ' ' + ['B','KB','MB','GB'][unit]; };
export default function BackupView({ restored }: { restored: () => Promise<void> }) {
  const [file,setFile] = useState<File | null>(null), [upload,setUpload] = useState<Upload | null>(null), [status,setStatus] = useState<Status | null>(null), [busy,setBusy] = useState(false), [phase,setPhase] = useState(''), [progress,setProgress] = useState(0), [error,setError] = useState(''), [message,setMessage] = useState(''), [confirm,setConfirm] = useState(false), [password,setPassword] = useState('');
  async function load() { const value = await api<Status>('/api/restore/status'); setStatus(value); setUpload(value.upload); }
  useEffect(() => { load().catch(e => setError(e.message)); }, []);
  useEffect(() => { if (!status?.applying && !upload?.busy) return; const timer = setInterval(() => { load().catch(e => setError(e.message)); },3000); return () => clearInterval(timer); }, [status?.applying,upload?.busy]);
  async function verify(event: FormEvent) {
    event.preventDefault(); if (!file) return; setBusy(true); setError(''); setMessage(''); setConfirm(false); setProgress(0);
    try {
      if (file.size > 32 * 1024 ** 3) throw new Error('Il ripristino guidato accetta backup fino a 32 GB.');
      const created = await post<{ id: string; chunkBytes: number }>('/api/restore/uploads', { bytes: file.size });
      setUpload({ id: created.id, bytes:file.size, received:0, busy:true }); setPhase('Caricamento del backup');
      for (let offset = 0; offset < file.size; offset += created.chunkBytes) {
        await api(`/api/restore/uploads/${created.id}?offset=${offset}`, { method:'PUT', body: file.slice(offset,offset+created.chunkBytes), headers:{ 'Content-Type':'application/octet-stream' } });
        setProgress(Math.round(Math.min(offset+created.chunkBytes,file.size)/file.size*100));
      }
      setPhase('Verifica di file, storico e integrità del backup');
      const preview = await post<Preview>(`/api/restore/uploads/${created.id}/verify`);
      setUpload({ id:created.id, bytes:file.size, received:file.size, busy:false, preview }); setPhase('');
    } catch (e) { setError((e as Error).message); await load().catch(() => {}); }
    finally { setBusy(false); }
  }
  async function cancel() { if (!upload) return; setBusy(true); setError(''); try { await api(`/api/restore/uploads/${upload.id}`, { method:'DELETE' }); setUpload(null); setConfirm(false); setPassword(''); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function apply(event: FormEvent) {
    event.preventDefault(); if (!upload?.preview || !confirm) return;
    setBusy(true); setError(''); setPhase('Creazione della copia di sicurezza e ripristino. Lascia aperta questa pagina.');
    try { const result = await post<{ message: string }>(`/api/restore/uploads/${upload.id}/apply`, { confirmId:upload.id,password }); setPassword(''); setUpload(null); setConfirm(false); setMessage(result.message); await load(); await restored(); }
    catch (e) { setError((e as Error).message); await load().catch(() => {}); }
    finally { setBusy(false); setPhase(''); }
  }
  const locked = busy || status?.applying || upload?.busy;
  return <><div className="page-heading"><div><span className="eyebrow">IL TUO ARCHIVIO, CON TE</span><h1>Backup e ripristino</h1><p>Conserva una copia completa o trasferisci l’archivio su un altro dispositivo.</p></div></div>
    <section className="panel backup-panel"><h2>Backup completo</h2><p>Include siti, versioni, controlli, tag, annotazioni e stato di lettura. Conserva lo ZIP anche su un altro disco. Il file contiene dati privati e i dati dell’account (senza password in chiaro): trattalo come il tuo archivio.</p><SecureLink className="button primary" href="/api/export" download><ArrowDownToLine size={18} /> Scarica backup completo</SecureLink><p>Per una copia da sfogliare senza app, apri un sito e scegli <strong>Esporta sito offline</strong>. Quello ZIP contiene un indice cronologico, pagine navigabili e screenshot; non è utilizzabile per il ripristino.</p></section>
    <section className="panel backup-panel"><h2>Ripristino guidato</h2><p>Carica un backup completo di Landing Archive (fino a 32 GB). Prima verifichiamo i file e ti mostriamo il contenuto. In questa fase il tuo archivio resta intatto.</p><p>Il ripristino sostituisce lo storico attuale. Il tuo nome utente e la password attuali rimangono validi; tutti i siti ripristinati saranno in pausa. Prima della sostituzione viene salvato automaticamente un backup dell’archivio attuale.</p>
    {error && <div className="notice error" role="alert">{error}</div>}{message && <div className="notice" role="status"><ShieldCheck size={20} />{message}</div>}{status?.applying && !busy && <div className="notice amber" role="status">Ripristino ancora in corso. Attendi il completamento.</div>}
    {!upload && !status?.applying && <form onSubmit={verify}><label>Backup ZIP<input type="file" accept=".zip,application/zip" disabled={busy} required onChange={e => setFile(e.target.files?.[0] || null)} /></label><button className="button secondary" disabled={busy || !file}>Carica e verifica backup</button></form>}
    {busy && <div className="backup-progress" role="status"><strong>{phase}</strong>{phase === 'Caricamento del backup' && <><progress value={progress} max={100} /><span>{progress}%</span></>}</div>}
    {upload && !busy && !upload.preview && <p>Caricamento presente: {size(upload.received)} di {size(upload.bytes)}. {upload.busy ? 'Verifica in corso.' : 'Puoi annullarlo e selezionare nuovamente il file.'}</p>}
    {upload?.preview && <form onSubmit={apply} className="restore-preview"><h3>Backup verificato</h3><p>Creato il {new Date(upload.preview.createdAt).toLocaleString('it-IT')}</p><dl><div><dt>Siti</dt><dd>{upload.preview.sites}</dd></div><div><dt>Pagine</dt><dd>{upload.preview.pages}</dd></div><div><dt>Versioni</dt><dd>{upload.preview.versions}</dd></div><div><dt>Controlli</dt><dd>{upload.preview.checks}</dd></div><div><dt>File archiviati</dt><dd>{size(upload.preview.bytes)}</dd></div></dl><label className="checkbox-label"><input type="checkbox" checked={confirm} disabled={Boolean(locked)} onChange={e => setConfirm(e.target.checked)} /><span>Confermo di sostituire tutti i siti e lo storico attuali con questo backup.</span></label><label>Password del tuo accesso attuale<input type="password" autoComplete="current-password" required maxLength={200} value={password} disabled={Boolean(locked)} onChange={e => setPassword(e.target.value)} /></label><button className="button danger" disabled={!confirm || !password || Boolean(locked)}>Sostituisci archivio e ripristina</button></form>}
    {upload && <button className="text-button" disabled={Boolean(locked)} onClick={cancel}>Annulla caricamento</button>}</section>
    {status?.safetyAvailable && <section className="panel backup-panel"><h2>Prima dell’ultimo ripristino</h2><p>Questa copia contiene l’archivio presente prima dell’ultimo ripristino. Scaricala per conservarla: il prossimo ripristino la sostituirà con una nuova copia di sicurezza.</p><SecureLink className="button secondary" href="/api/restore/safety" download><ArrowDownToLine size={18} /> Scarica copia di sicurezza</SecureLink></section>}</>;
}
