import { t, message as systemMessage, locale } from './i18n';
import { SecureLink } from './SecureResources';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDownToLine, ShieldCheck } from 'lucide-react';
import { api, post } from './client';

type Preview = { sites: number; pages: number; versions: number; checks: number; bytes: number; createdAt: string };
type Upload = { id: string; preview?: Preview; received: number; bytes: number; busy: boolean };
type Status = { applying: boolean; safetyAvailable: boolean; upload: Upload | null };
const size = (bytes: number) => { const unit = bytes > 0 ? Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024))) : 0; return (bytes / 1024 ** unit).toLocaleString(locale(), { maximumFractionDigits: 1 }) + ' ' + ['B','KB','MB','GB'][unit]; };
export default function BackupView({ restored }: { restored: () => Promise<void> }) {
  const [file,setFile] = useState<File | null>(null), [upload,setUpload] = useState<Upload | null>(null), [status,setStatus] = useState<Status | null>(null), [busy,setBusy] = useState(false), [phase,setPhase] = useState(''), [progress,setProgress] = useState(0), [error,setError] = useState(''), [message,setMessage] = useState(''), [confirm,setConfirm] = useState(false), [password,setPassword] = useState('');
  async function load() { const value = await api<Status>('/api/restore/status'); setStatus(value); setUpload(value.upload); }
  useEffect(() => { load().catch(e => setError(e.message)); }, []);
  useEffect(() => { if (!status?.applying && !upload?.busy) return; const timer = setInterval(() => { load().catch(e => setError(e.message)); },3000); return () => clearInterval(timer); }, [status?.applying,upload?.busy]);
  async function verify(event: FormEvent) {
    event.preventDefault(); if (!file) return; setBusy(true); setError(''); setMessage(''); setConfirm(false); setProgress(0);
    try {
      if (file.size > 32 * 1024 ** 3) throw new Error(t("Guided restore accepts backups up to 32 GB."));
      const created = await post<{ id: string; chunkBytes: number }>('/api/restore/uploads', { bytes: file.size });
      setUpload({ id: created.id, bytes:file.size, received:0, busy:true }); setPhase(t("Uploading backup"));
      for (let offset = 0; offset < file.size; offset += created.chunkBytes) {
        await api(`/api/restore/uploads/${created.id}?offset=${offset}`, { method:'PUT', body: file.slice(offset,offset+created.chunkBytes), headers:{ 'Content-Type':'application/octet-stream' } });
        setProgress(Math.round(Math.min(offset+created.chunkBytes,file.size)/file.size*100));
      }
      setPhase(t("Checking backup files, history and integrity"));
      const preview = await post<Preview>(`/api/restore/uploads/${created.id}/verify`);
      setUpload({ id:created.id, bytes:file.size, received:file.size, busy:false, preview }); setPhase('');
    } catch (e) { setError((e as Error).message); await load().catch(() => {}); }
    finally { setBusy(false); }
  }
  async function cancel() { if (!upload) return; setBusy(true); setError(''); try { await api(`/api/restore/uploads/${upload.id}`, { method:'DELETE' }); setUpload(null); setConfirm(false); setPassword(''); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function apply(event: FormEvent) {
    event.preventDefault(); if (!upload?.preview || !confirm) return;
    setBusy(true); setError(''); setPhase(t("Creating the safety copy and restoring. Keep this page open."));
    try { const result = await post<{ message: string }>(`/api/restore/uploads/${upload.id}/apply`, { confirmId:upload.id,password }); setPassword(''); setUpload(null); setConfirm(false); setMessage(result.message); await load(); await restored(); }
    catch (e) { setError((e as Error).message); await load().catch(() => {}); }
    finally { setBusy(false); setPhase(''); }
  }
  const locked = busy || status?.applying || upload?.busy;
  return <><div className="page-heading"><div><span className="eyebrow">{t("YOUR ARCHIVE, WITH YOU")}</span><h1>{t("Backup and restore")}</h1><p>{t("Keep a complete copy or move your archive to another device.")}</p></div></div>
    <section className="panel backup-panel"><h2>{t("Full backup")}</h2><p>{t("Includes sites, versions, checks, tags, notes and read status. Keep the ZIP on another drive too. It contains private data and account records (without plaintext passwords): protect it like your archive.")}</p><SecureLink className="button primary" href="/api/export" download><ArrowDownToLine size={18} /> {t(" Download full backup")}</SecureLink><p>{t("For a copy you can browse without the app, open a site and choose ")}<strong>{t("Export offline site")}</strong>{t(". That ZIP contains a timeline index, browsable pages and screenshots; it cannot be used for restore.")}</p></section>
    <section className="panel backup-panel"><h2>{t("Guided restore")}</h2><p>{t("Upload a full Landing Archive backup (up to 32 GB). We check the files and show its contents first. Your archive stays intact during this step.")}</p><p>{t("Restore replaces the current history. Your current username and password stay valid; restored sites will be paused. A backup of the current archive is saved automatically before replacement.")}</p>
    {error && <div className="notice error" role="alert">{systemMessage(error)}</div>}{message && <div className="notice" role="status"><ShieldCheck size={20} />{systemMessage(message)}</div>}{status?.applying && !busy && <div className="notice amber" role="status">{t("Restore is still running. Wait for it to finish.")}</div>}
    {!upload && !status?.applying && <form onSubmit={verify}><label>Backup ZIP<input type="file" accept=".zip,application/zip" disabled={busy} required onChange={e => setFile(e.target.files?.[0] || null)} /></label><button className="button secondary" disabled={busy || !file}>{t("Upload and verify backup")}</button></form>}
    {busy && <div className="backup-progress" role="status"><strong>{phase}</strong>{phase === t("Uploading backup") && <><progress value={progress} max={100} /><span>{progress}%</span></>}</div>}
    {upload && !busy && !upload.preview && <p>{t("Existing upload: ")}{size(upload.received)} {t(" of ")}{size(upload.bytes)}. {upload.busy ? t("Verification in progress.") : t("You can cancel it and select the file again.")}</p>}
    {upload?.preview && <form onSubmit={apply} className="restore-preview"><h3>{t("Backup verified")}</h3><p>{t("Created on ")}{new Date(upload.preview.createdAt).toLocaleString(locale())}</p><dl><div><dt>{t("Sites")}</dt><dd>{upload.preview.sites}</dd></div><div><dt>{t("Pages")}</dt><dd>{upload.preview.pages}</dd></div><div><dt>{t("Versions")}</dt><dd>{upload.preview.versions}</dd></div><div><dt>{t("Checks")}</dt><dd>{upload.preview.checks}</dd></div><div><dt>{t("Archived files")}</dt><dd>{size(upload.preview.bytes)}</dd></div></dl><label className="checkbox-label"><input type="checkbox" checked={confirm} disabled={Boolean(locked)} onChange={e => setConfirm(e.target.checked)} /><span>{t("I confirm that I want to replace all current sites and history with this backup.")}</span></label><label>{t("Your current account password")}<input type="password" autoComplete="current-password" required maxLength={200} value={password} disabled={Boolean(locked)} onChange={e => setPassword(e.target.value)} /></label><button className="button danger" disabled={!confirm || !password || Boolean(locked)}>{t("Replace archive and restore")}</button></form>}
    {upload && <button className="text-button" disabled={Boolean(locked)} onClick={cancel}>{t("Cancel upload")}</button>}</section>
    {status?.safetyAvailable && <section className="panel backup-panel"><h2>{t("Before the last restore")}</h2><p>{t("This copy contains the archive as it was before the last restore. Download it to keep it: the next restore will replace it with a new safety copy.")}</p><SecureLink className="button secondary" href="/api/restore/safety" download><ArrowDownToLine size={18} /> {t(" Download safety copy")}</SecureLink></section>}</>;
}
