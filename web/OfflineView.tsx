import { t, message as systemMessage } from './i18n';
import { SecureFrame, SecureLink } from './SecureResources';
import { authFetch } from './client';
import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, Expand, Globe2, LoaderCircle, Shrink } from 'lucide-react';

type Version = { quality?: { status: string; reasons: string[] } | null; id: string; capturedAt: string; finalUrl: string; htmlUrl: string; title: string; warnings: string[] };
type Target = { id: string; url: string; capturedAt: string; later: boolean };
type Replay = { version: Version; at: string; targets: Target[]; previewUrl: string };
type Visit = { id: string; fragment?: string };

export default function OfflineView({ version, date, at = version.capturedAt }: { version: { id: string; capturedAt: string }; date: (value?: string) => string; at?: string }) {
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
    authFetch(`/api/versions/${encodeURIComponent(visit.id)}/offline?at=${encodeURIComponent(at)}`, { signal: abort.signal })
      .then(async response => {
        const value = await response.json();
        if (!response.ok) {
          if (response.status === 401) window.dispatchEvent(new CustomEvent('session-expired'));
          throw new Error(value.error || t("The offline copy is unavailable."));
        }
        if (!abort.signal.aborted) setData(value);
      }).catch(error => { if (!abort.signal.aborted) setError(error.message); });
    return () => abort.abort();
  }, [visit.id, at]);

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
        if (!target) { setNotice(t("This link has no copy in the archive. The live site was not opened.")); return; }
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
    } catch { setError(t("This copy could not be opened in the offline view. You can download its HTML or view the screenshot.")); }
  }
  return <div className={`offline-view ${expanded ? 'expanded' : ''}`} aria-label={t("Offline browsing")}>
    <div className="offline-toolbar">
      <button className="button secondary compact" disabled={visits.length < 2 || !ready} onClick={() => setVisits(previous => previous.slice(0, -1))}><ArrowLeft size={15} /> {t(" Back")}</button>
      <div className="offline-address"><strong><Globe2 size={15} /> {t(" Copy in your archive")}</strong><span>{data?.version.finalUrl || t("Opening page…")}</span><time>{t("Captured: ")}{date(data?.version.capturedAt)}</time></div>
      <button className="icon-button" title={expanded ? t("Shrink offline page") : t("Expand offline page")} aria-label={expanded ? t("Shrink offline page") : t("Expand offline page")} aria-pressed={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? <Shrink size={18} /> : <Expand size={18} />}</button>
    </div>
    {data && data.version.capturedAt > at && <div className="notice amber">{t("This link only has a copy later than the selected date: ")}{date(data.version.capturedAt)}.</div>}
    {data?.version.quality?.status === 'partial' && <div className="notice amber"><strong>{t("Partial copy.")}</strong> {systemMessage(data.version.quality.reasons.join(' '))}</div>}
    {!!data?.version.warnings.length && <div className="capture-warnings"><strong>{t("Warnings for this copy")}</strong>{data.version.warnings.map((warning, index) => <p key={index}>{systemMessage(warning)}</p>)}</div>}
    {notice && <div className="notice amber" role="status">{systemMessage(notice)}</div>}
    {error ? <div className="notice error" role="alert">{systemMessage(error)}</div> : <>
      {!ready && <div className="loading" role="status"><LoaderCircle className="spin" size={20} /> {t(" Opening offline copy…")}</div>}
      {data && <SecureFrame key={data.previewUrl} ref={frame} title={t("Archived offline page")} src={data.previewUrl} sandbox="allow-same-origin" referrerPolicy="no-referrer" onLoad={loaded} />}
    </>}
    <div className="offline-note"><span>{t("Links open copies from the same site. Reference date: ")}{date(at)}{t(". Forms and features that require online services are disabled.")}</span>{data && <SecureLink className="text-button" href={data.version.htmlUrl} download><ArrowDownToLine size={15} /> {t(" Download this page")}</SecureLink>}</div>
  </div>;
}
