import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, LoaderCircle, Trash2, X } from 'lucide-react';
import { api, post } from './client';

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
  return <><section className="panel archive-review-entry"><div><h2>Rivedi le copie precedenti</h2><p>Le viste raggruppate mantengono tutto. Per recuperare spazio, esamina prima le singole copie proposte.</p></div><button className="button secondary" onClick={load}><Trash2 size={16} />Anteprima pulizia</button></section>
    {open && <div className="modal-overlay"><div className="modal archive-review-dialog" tabIndex={-1} ref={dialog} role="dialog" aria-modal="true" aria-labelledby="archive-review-title"><div className="modal-heading"><div><h2 id="archive-review-title">Rivedi le copie da eliminare</h2><p>Nessuna copia è selezionata automaticamente.</p></div><button className="icon-button" disabled={busy} aria-label="Chiudi revisione" onClick={() => setOpen(false)}><X size={21} /></button></div>
      <div className="modal-body">{busy && !preview && !result && <div className="loading" role="status"><LoaderCircle className="spin" size={20} />Preparazione dell’anteprima…</div>}
        {preview && <><p className="review-protection">{preview.protectedCount} copie protette: prima acquisizione, riferimenti, evidenze nuove, preferiti e copie con appunti o tag.</p><p>Le date dei controlli e dei ritorni restano consultabili dopo la pulizia. I file eliminati non saranno più disponibili.</p>
          <div className="review-stats"><span><strong>{preview.candidates.length}</strong> copie proposte su {preview.totalVersions}</span><span><strong>{bytes(preview.reclaimableBytes)}</strong> recuperabili selezionandole tutte</span></div>
          {preview.reclaimableBytes === 0 && <p className="review-protection">I file identici condividono già lo spazio. Eliminare queste voci potrebbe non liberare byte sul disco.</p>}
          {preview.limited && <p>Questa anteprima comprende al massimo 100 proposte. Puoi riaprirla dopo la revisione.</p>}
          {preview.candidates.length ? <ul className="cleanup-candidates">{preview.candidates.map(candidate => <li key={candidate.id}><label><input type="checkbox" aria-label={`Seleziona copia del ${date(candidate.capturedAt)}`} checked={selected.includes(candidate.id)} disabled={busy} onChange={event => { setSelected(values => event.target.checked ? [...values, candidate.id] : values.filter(id => id !== candidate.id)); setConfirmed(false); }} /><span><time dateTime={candidate.capturedAt}>{date(candidate.capturedAt)}</time><strong>{candidate.kind === 'partial' ? 'Possibile caricamento incompleto' : 'Copia con file identici'}</strong><span>{candidate.reason}</span></span></label><div className="cleanup-preview-links"><a href={`/api/versions/${encodeURIComponent(candidate.id)}/screenshot`} target="_blank" rel="noreferrer">Vedi copia proposta <ArrowUpRight size={13} /></a><a href={`/api/versions/${encodeURIComponent(candidate.keepVersionId)}/screenshot`} target="_blank" rel="noreferrer">Vedi copia conservata <ArrowUpRight size={13} /></a></div>{candidate.kind === 'partial' && <p>Una sezione assente potrebbe essere stata rimossa davvero. Verifica le immagini prima di selezionare questa copia.</p>}</li>)}</ul> : <p>Nessuna copia eliminabile proposta. Puoi usare la vista per variante per rendere lo storico più leggibile.</p>}
          {!!selected.length && <label className="checkbox-label cleanup-confirmation"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /><span>Ho verificato le {selected.length} copie selezionate e voglio eliminarne i file non condivisi. I controlli resteranno registrati.</span></label>}
        </>}
        {result && <div className="review-result" role="status"><h3>Revisione completata</h3><p>{result.message}</p><p>{result.deletedVersions} copie rimosse · {bytes(result.deletedBytes)} recuperati.</p>{result.pendingFiles > 0 && <p>Alcuni file non sono stati rimossi dal disco. Controlla i permessi del volume dati prima di una nuova revisione.</p>}</div>}
        {error && <div className="notice error" role="alert">{error}</div>}
      </div><div className="modal-footer"><button className="button secondary" disabled={busy} onClick={() => setOpen(false)}>{result ? 'Chiudi' : 'Annulla'}</button>{error && <button className="button secondary" disabled={busy} onClick={load}>Aggiorna anteprima</button>}{preview && <button className="button danger" disabled={busy || !confirmed || !selected.length} onClick={remove}>{busy ? <LoaderCircle size={16} className="spin" /> : <Trash2 size={16} />}Elimina {selected.length || ''} copie selezionate</button>}</div>
    </div></div>}
  </>;
}
