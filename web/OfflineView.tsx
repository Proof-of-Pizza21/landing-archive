import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, Expand, Globe2, LoaderCircle, Shrink } from 'lucide-react';

type Version = { id: string; capturedAt: string; finalUrl: string; htmlUrl: string; title: string; warnings: string[] };
type Target = { id: string; url: string; capturedAt: string; later: boolean };
type Replay = { version: Version; at: string; targets: Target[]; previewUrl: string };
type Visit = { id: string; fragment?: string };

export default function OfflineView({ version, date }: { version: { id: string; capturedAt: string }; date: (value?: string) => string }) {
  const [visits, setVisits] = useState<Visit[]>([{ id: version.id }]);
  const [data, setData] = useState<Replay | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const visit = visits[visits.length - 1];
  useEffect(() => {
    const abort = new AbortController();
    setData(null); setError(''); setNotice(''); setReady(false);
    fetch(`/api/versions/${encodeURIComponent(visit.id)}/offline?at=${encodeURIComponent(version.capturedAt)}`, { credentials: 'same-origin', signal: abort.signal })
      .then(async response => {
        const value = await response.json();
        if (!response.ok) {
          if (response.status === 401) window.dispatchEvent(new CustomEvent('session-expired'));
          throw new Error(value.error || 'La copia offline non è disponibile.');
        }
        if (!abort.signal.aborted) setData(value);
      }).catch(error => { if (!abort.signal.aborted) setError(error.message); });
    return () => abort.abort();
  }, [visit.id, version.capturedAt]);

  function loaded() {
    try {
      const doc = frame.current?.contentDocument;
      if (!data || !doc || doc.contentType !== 'text/html' || doc.URL === 'about:blank') throw new Error();
      // The frame cannot run scripts. These listeners belong to the trusted app,
      // and accept only IDs in the server's same-site archive target list.
      const click = (event: Event) => {
        const anchor = (event.target as Element)?.closest?.('a[data-archive-target],area[data-archive-target]');
        if (!anchor) return;
        event.preventDefault(); event.stopPropagation();
        const raw = anchor.getAttribute('data-archive-target') ?? '';
        const target = raw.length <= 100 ? data.targets.find(target => target.id === raw) : undefined;
        if (!target) { setNotice('Questo collegamento non ha una copia nell’archivio. Il sito online non è stato aperto.'); return; }
        if ((event as MouseEvent).button > 0) return;
        if (target.id === data.version.id) {
          let fragment = anchor.getAttribute('data-archive-fragment') || '';
          try { fragment = decodeURIComponent(fragment); } catch { /* Keep the literal fragment. */ }
          if (fragment) doc.getElementById(fragment)?.scrollIntoView();
          else doc.defaultView?.scrollTo(0, 0);
          return;
        }
        setVisits(previous => [...previous.slice(-49), { id: target.id, fragment: anchor.getAttribute('data-archive-fragment') || undefined }]);
      };
      doc.addEventListener('click', click, true);
      doc.addEventListener('auxclick', click, true);
      if (visit.fragment) {
        let fragment = visit.fragment;
        try { fragment = decodeURIComponent(fragment); } catch { /* Keep a literal fragment. */ }
        doc.getElementById(fragment)?.scrollIntoView();
      }
      setReady(true);
    } catch { setError('Non è stato possibile aprire questa copia nella vista offline. Puoi scaricare l’HTML o consultare lo screenshot.'); }
  }
  return <div className={`offline-view ${expanded ? 'expanded' : ''}`} aria-label="Consultazione offline">
    <div className="offline-toolbar">
      <button className="button secondary compact" disabled={visits.length < 2 || !ready} onClick={() => setVisits(previous => previous.slice(0, -1))}><ArrowLeft size={15} /> Indietro</button>
      <div className="offline-address"><strong><Globe2 size={15} /> Copia sul tuo archivio</strong><span>{data?.version.finalUrl || 'Apertura della pagina…'}</span><time>Acquisita: {date(data?.version.capturedAt)}</time></div>
      <button className="icon-button" title={expanded ? 'Riduci pagina offline' : 'Espandi pagina offline'} aria-label={expanded ? 'Riduci pagina offline' : 'Espandi pagina offline'} aria-pressed={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? <Shrink size={18} /> : <Expand size={18} />}</button>
    </div>
    {data && data.version.capturedAt > version.capturedAt && <div className="notice amber">Per questo collegamento esiste soltanto una copia successiva alla data scelta: {date(data.version.capturedAt)}.</div>}
    {!!data?.version.warnings.length && <div className="capture-warnings"><strong>Avvisi di questa copia</strong>{data.version.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
    {notice && <div className="notice amber" role="status">{notice}</div>}
    {error ? <div className="notice error" role="alert">{error}</div> : <>
      {!ready && <div className="loading" role="status"><LoaderCircle className="spin" size={20} /> Apertura della copia offline…</div>}
      {data && <iframe key={data.previewUrl} ref={frame} title="Pagina archiviata offline" src={data.previewUrl} sandbox="allow-same-origin" referrerPolicy="no-referrer" onLoad={loaded} />}
    </>}
    <div className="offline-note"><span>I link aprono le copie dello stesso sito. Data di riferimento: {date(version.capturedAt)}. Moduli e funzioni che richiedono servizi online non sono attivi.</span>{data && <a className="text-button" href={data.version.htmlUrl} download><ArrowDownToLine size={15} /> Scarica questa pagina</a>}</div>
  </div>;
}
