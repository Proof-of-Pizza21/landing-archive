import { t, message as systemMessage } from './i18n';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, LoaderCircle, Trash2, X } from 'lucide-react';
import { api, post } from './client';
import { SecureLink } from './SecureResources';

type Candidate = { id: string; capturedAt: string; bytes: number; keepVersionId: string; kind?: 'identical' | 'partial'; reason: string };
type Preview = { pageId: string; token: string; candidates: Candidate[]; protectedCount: number; reclaimableBytes: number; totalVersions: number; limited?: boolean };
type Result = { deletedVersions: number; deletedBytes: number; pendingFiles: number; message: string };

export default function ArchiveReview({ pageId, date, bytes, refresh }: { pageId: string; date: (value?: string) => string; bytes: (value?: number) => string; refresh: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const busyRef = useRef(busy); busyRef.current = busy;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; dialog.current?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busyRef.current) setOpen(false);
      if (event.key !== 'Tab') return;
      const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled)') || [])];
      if (!controls.length) { event.preventDefault(); return; }
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [open]);
  async function load() {
    setOpen(true); setBusy(true); setPreview(null); setSelected([]); setConfirmed(false); setError(''); setResult(null);
    try { setPreview(await api<Preview>(`/api/pages/${encodeURIComponent(pageId)}/cleanup`)); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!preview || !confirmed || !selected.length || busy) return;
    setBusy(true); setError('');
    try {
      const value = await post<Result>(`/api/pages/${encodeURIComponent(pageId)}/cleanup`, { token: preview.token, confirmPageId: pageId, ids: selected });
      setResult(value); setPreview(null); setSelected([]); setConfirmed(false); await refresh();
    } catch (cause) { setConfirmed(false); setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  return <><section className="panel archive-review-entry"><div><h2>{t("Review earlier copies")}</h2><p>{t("Grouped views keep everything. To reclaim space, review the suggested copies individually first.")}</p></div><button className="button secondary" onClick={load}><Trash2 size={16} />{t("Preview cleanup")}</button></section>
    {open && <div className="modal-overlay"><div className="modal archive-review-dialog" tabIndex={-1} ref={dialog} role="dialog" aria-modal="true" aria-labelledby="archive-review-title"><div className="modal-heading"><div><h2 id="archive-review-title">{t("Review copies to delete")}</h2><p>{t("No copies are selected automatically.")}</p></div><button className="icon-button" disabled={busy} aria-label={t("Close review")} onClick={() => setOpen(false)}><X size={21} /></button></div>
      <div className="modal-body">{busy && !preview && !result && <div className="loading" role="status"><LoaderCircle className="spin" size={20} />{t("Preparing preview…")}</div>}
        {preview && <><p className="review-protection">{preview.protectedCount} {t(" protected copies: first captures, references, new evidence, favorites and copies with notes or tags.")}</p><p>{t("Check dates and returns remain available after cleanup. Deleted files will no longer be available.")}</p>
          <div className="review-stats"><span><strong>{preview.candidates.length}</strong> {t(" suggested copies out of ")}{preview.totalVersions}</span><span><strong>{bytes(preview.reclaimableBytes)}</strong> {t(" reclaimable if all are selected")}</span></div>
          {preview.reclaimableBytes === 0 && <p className="review-protection">{t("Identical files already share storage. Removing these entries may not free disk space.")}</p>}
          {preview.limited && <p>{t("This preview includes up to 100 suggestions. You can reopen it after reviewing them.")}</p>}
          {preview.candidates.length ? <ul className="cleanup-candidates">{preview.candidates.map(candidate => <li key={candidate.id}><label><input type="checkbox" aria-label={t("Select copy from {p0}", { p0: date(candidate.capturedAt) })} checked={selected.includes(candidate.id)} disabled={busy} onChange={event => { setSelected(values => event.target.checked ? [...values, candidate.id] : values.filter(id => id !== candidate.id)); setConfirmed(false); }} /><span><time dateTime={candidate.capturedAt}>{date(candidate.capturedAt)}</time><strong>{candidate.kind === 'partial' ? t("Possibly incomplete load") : t("Copy with identical files")}</strong><span>{systemMessage(candidate.reason)}</span></span></label><div className="cleanup-preview-links"><SecureLink href={`/api/versions/${encodeURIComponent(candidate.id)}/screenshot`} target="_blank" rel="noreferrer">{t("View suggested copy ")}<ArrowUpRight size={13} /></SecureLink><SecureLink href={`/api/versions/${encodeURIComponent(candidate.keepVersionId)}/screenshot`} target="_blank" rel="noreferrer">{t("View retained copy ")}<ArrowUpRight size={13} /></SecureLink></div>{candidate.kind === 'partial' && <p>{t("A missing section may really have been removed. Check the images before selecting this copy.")}</p>}</li>)}</ul> : <p>{t("No copies suggested for deletion. Use the variant view to make the history easier to browse.")}</p>}
          {!!selected.length && <label className="checkbox-label cleanup-confirmation"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /><span>{t("I have reviewed the ")}{selected.length} {t(" selected copies and want to delete their unshared files. Checks will stay recorded.")}</span></label>}
        </>}
        {result && <div className="review-result" role="status"><h3>{t("Review completed")}</h3><p>{systemMessage(result.message)}</p><p>{result.deletedVersions} {t(" copies removed · ")}{bytes(result.deletedBytes)} {t(" reclaimed.")}</p>{result.pendingFiles > 0 && <p>{t("Some files could not be removed from disk. Check the data volume permissions before another review.")}</p>}</div>}
        {error && <div className="notice error" role="alert">{systemMessage(error)}</div>}
      </div><div className="modal-footer"><button className="button secondary" disabled={busy} onClick={() => setOpen(false)}>{result ? t("Close") : t("Cancel")}</button>{error && <button className="button secondary" disabled={busy} onClick={load}>{t("Refresh preview")}</button>}{preview && <button className="button danger" disabled={busy || !confirmed || !selected.length} onClick={remove}>{busy ? <LoaderCircle size={16} className="spin" /> : <Trash2 size={16} />}{t("Delete ")}{selected.length || ''} {t(" copies selected")}</button>}</div>
    </div></div>}
  </>;
}
