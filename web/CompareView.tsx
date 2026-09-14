import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, Check, FileText, Link2, LoaderCircle, Monitor, Search } from 'lucide-react';

type Version = { id: string; capturedAt: string; screenshotUrl: string; htmlUrl: string };
type Link = { url: string; text: string };
type Comparison = {
  left: Version; right: Version;
  changes: { kind: string; label: string }[];
  textDiff: { value: string; added?: boolean; removed?: boolean }[];
  changedLinks: { added: Link[]; removed: Link[] };
  changedImages: { added: string[]; removed: string[] };
  details: { label: string; before: string[]; after: string[] }[];
};
type Region = { x: number; y: number; width: number; height: number };
type Visual = { width: number; height: number; left: { width: number; height: number }; right: { width: number; height: number }; difference: number; regions: Region[]; grouped: boolean };
type DateLabel = (value?: string) => string;

async function load<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', signal });
  const value = await response.json();
  if (response.status === 401) window.dispatchEvent(new CustomEvent('session-expired'));
  if (!response.ok) throw new Error(value.error || 'Confronto non disponibile. Riprova.');
  return value;
}
const query = (left: string, right: string) => `left=${encodeURIComponent(left)}&right=${encodeURIComponent(right)}`;
function Loading({ label }: { label: string }) { return <div className="loading" role="status"><LoaderCircle className="spin" size={20} /> {label}…</div>; }

export default function CompareView({ versions, selectedId, date }: { versions: Version[]; selectedId?: string; date: DateLabel }) {
  const index = Math.max(0, versions.findIndex(v => v.id === selectedId));
  const [left, setLeft] = useState(versions[Math.min(index + 1, versions.length - 1)]?.id || '');
  const [right, setRight] = useState(versions[index < versions.length - 1 ? index : Math.max(0, index - 1)]?.id || '');
  const [tab, setTab] = useState<'visual' | 'text' | 'links' | 'details'>('visual');
  const [data, setData] = useState<Comparison | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setData(null); setError('');
    if (!left || !right || left === right) return;
    const controller = new AbortController();
    load<Comparison>(`/api/compare?${query(left, right)}`, controller.signal).then(value => { if (!controller.signal.aborted) setData(value); }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [left, right]);
  return <section className="panel compare-panel"><p className="comparison-full-note">Qui confronti le copie integrali: sono visibili anche le zone escluse dal monitoraggio.</p>
    <div className="compare-selection"><label>Versione di partenza<select value={left} onChange={event => setLeft(event.target.value)}>{versions.map(version => <option key={version.id} value={version.id}>{date(version.capturedAt)}</option>)}</select></label><ArrowRight size={22} /><label>Versione da confrontare<select value={right} onChange={event => setRight(event.target.value)}>{versions.map(version => <option key={version.id} value={version.id}>{date(version.capturedAt)}</option>)}</select></label></div>
    {data && <div className="comparison-summary"><strong>Cosa cambia nelle copie selezionate</strong>{data.changes.length ? <div className="change-chips">{data.changes.map(change => <button className="text-button" aria-label={`Vedi differenze: ${change.label}`} key={change.kind} onClick={() => setTab(change.kind === 'text' ? 'text' : change.kind === 'links' ? 'links' : 'details')}><Search size={14} /> {change.label}</button>)}</div> : <p>Testo, titolo, intestazioni, collegamenti e indirizzi delle immagini coincidono. Il confronto dell’aspetto può rilevare altre differenze.</p>}</div>}
    <div className="compare-tabs"><div className="tabs">
      <button className={tab === 'visual' ? 'selected' : ''} onClick={() => setTab('visual')}><Monitor size={16} /> Aspetto</button>
      <button className={tab === 'text' ? 'selected' : ''} onClick={() => setTab('text')}><FileText size={16} /> Testo</button>
      <button className={tab === 'links' ? 'selected' : ''} onClick={() => setTab('links')}><Link2 size={16} /> Collegamenti</button>
      <button className={tab === 'details' ? 'selected' : ''} onClick={() => setTab('details')}><Search size={16} /> Dettagli</button>
    </div>{tab === 'text' && <div className="diff-legend"><span className="removed">Rimosso</span><span className="added">Aggiunto</span></div>}</div>
    {left === right ? <div className="comparison-empty">Scegli due versioni diverse per osservare cosa è cambiato.</div> : error ? <div className="notice error">{error}</div> : !data ? <Loading label="Preparazione del confronto" /> : tab === 'visual' ? <VisualComparison key={`${left}:${right}`} data={data} date={date} /> : tab === 'text' ? <div className="text-diff">{data.textDiff.some(part => part.added || part.removed) ? data.textDiff.map((part, index) => part.added ? <ins key={index}>{part.value}</ins> : part.removed ? <del key={index}>{part.value}</del> : <span key={index}>{part.value}</span>) : <div className="diff-unchanged"><Check size={21} /><strong>Nessuna differenza nel testo confrontato.</strong><p>Controlla anche Collegamenti e Dettagli: possono cambiare senza modificare lo screenshot.</p></div>}</div> : tab === 'links' ? <LinkChanges links={data.changedLinks} /> : <div className="comparison-details">
      {data.details.map(detail => <section key={detail.label}><h3>{detail.label}</h3><div className="detail-pair"><div><strong>Prima</strong>{detail.before.map((value, i) => <p key={i}>{value || 'Vuoto'}</p>)}</div><div><strong>Dopo</strong>{detail.after.map((value, i) => <p key={i}>{value || 'Vuoto'}</p>)}</div></div></section>)}
      {(data.changedImages.added.length > 0 || data.changedImages.removed.length > 0) && <section><h3>Indirizzi delle immagini</h3><p>Un indirizzo diverso non prova che l’immagine sia cambiata: può variare soltanto un parametro. Le risorse online non vengono aperte.</p><LinkChanges links={{ added: data.changedImages.added.map(url => ({ url, text: '' })), removed: data.changedImages.removed.map(url => ({ url, text: '' })) }} /></section>}
      {!data.details.length && !data.changedImages.added.length && !data.changedImages.removed.length && <p>Nessuna differenza nel titolo, nelle intestazioni, nella destinazione o negli indirizzi delle immagini.</p>}
    </div>}
  </section>;
}

function LinkChanges({ links }: { links: { added: Link[]; removed: Link[] } }) {
  return <div className="link-comparison">{([{ title: 'Rimossi', entries: links.removed, tone: 'removed' }, { title: 'Aggiunti', entries: links.added, tone: 'added' }]).map(group => <div key={group.title}><h3 className={group.tone}>{group.title} <span>{group.entries.length}</span></h3>{group.entries.length ? group.entries.map((link, index) => <div className="changed-link" key={index}>{link.text && <strong>{link.text}</strong>}<span>{link.url}</span></div>) : <p className="muted">Nessun elemento.</p>}</div>)}</div>;
}

function VisualComparison({ data, date }: { data: Comparison; date: DateLabel }) {
  const [visual, setVisual] = useState<Visual | null>(null), [error, setError] = useState('');
  const [show, setShow] = useState(true), [active, setActive] = useState(0), [attempt, setAttempt] = useState(0);
  const panes = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const controller = new AbortController(); setError(''); setVisual(null);
    load<Visual>(`/api/compare/visual?${query(data.left.id, data.right.id)}`, controller.signal).then(value => { if (!controller.signal.aborted) { setVisual(value); setActive(0); } }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [data.left.id, data.right.id, attempt]);
  const move = (index: number) => {
    if (!visual?.regions[index]) return;
    setActive(index); setShow(true);
    const region = visual.regions[index];
    for (const pane of panes.current) if (pane) pane.scrollTop = Math.max(0, region.y * pane.clientWidth / visual.width - 40);
  };
  const sync = (source: HTMLDivElement, index: number) => {
    const other = panes.current[1 - index];
    if (other && Math.abs(other.scrollTop - source.scrollTop) > 1) other.scrollTop = source.scrollTop;
  };
  const dimensionsChanged = visual && (visual.left.width !== visual.right.width || visual.left.height !== visual.right.height);
  return <>
    <div className="visual-tools">
      {!visual && !error && <Loading label="Ricerca delle zone modificate" />}
      {error && <div className="notice error"><p>{error}</p><button className="text-button" onClick={() => setAttempt(value => value + 1)}>Riprova l’evidenziazione</button></div>}
      {visual && <><div className="visual-controls"><label className="checkbox-label"><input type="checkbox" checked={show} onChange={event => setShow(event.target.checked)} /> Evidenzia le modifiche</label>
        <div className="region-navigation"><button className="button secondary compact" disabled={!visual.regions.length} onClick={() => move((active - 1 + visual.regions.length) % visual.regions.length)} aria-label="Modifica precedente"><ArrowLeft size={16} /></button><span role="status">{visual.regions.length ? `Zona ${active + 1} di ${visual.regions.length}` : 'Nessuna zona diversa'}</span><button className="button secondary compact" disabled={!visual.regions.length} onClick={() => move((active + 1) % visual.regions.length)} aria-label="Modifica successiva"><ArrowRight size={16} /></button>{visual.regions.length > 0 && <button className="text-button" onClick={() => move(active)}>Vai alla zona</button>}</div></div>
        <p>{visual.regions.length ? `Le aree arancioni racchiudono le differenze. Pixel diversi nel campione confrontato: ${new Intl.NumberFormat('it-IT', { style: 'percent', maximumFractionDigits: 2 }).format(visual.difference)}.` : 'Nessuna differenza visiva rilevata nel campione confrontato. Controlla il riepilogo del contenuto.'} Lo scorrimento delle due copie è sincronizzato.</p>
        {dimensionsChanged && <p className="dimension-change">Dimensioni diverse: {visual.left.width} × {visual.left.height} → {visual.right.width} × {visual.right.height} pixel. Le immagini sono allineate senza deformarle. Il confronto mostra anche i piccoli spostamenti che il monitoraggio può ignorare.</p>}
        {visual.grouped && <p>Molte differenze: le ultime zone sono raggruppate in un’area più ampia.</p>}
      </>}
      <p className="comparison-limit">Le evidenziazioni riguardano gli screenshot. Animazioni, elementi spostati o caricamenti incompleti possono produrre zone ampie; non dimostrano da soli una modifica voluta dall’autore.</p>
    </div>
    <div className="visual-comparison highlighted-comparison">{[data.left, data.right].map((version, index) => {
      const size = visual && (index ? visual.right : visual.left);
      return <div key={`${version.id}-${index}`}><div className="compare-image-label"><span>{index ? 'Versione da confrontare' : 'Versione di partenza'}</span><strong>{date(version.capturedAt)}</strong></div>
        <div className="compare-image" ref={node => { panes.current[index] = node; }} onScroll={event => sync(event.currentTarget, index)} tabIndex={0} aria-label={index ? 'Screenshot dopo' : 'Screenshot prima'}>
          {visual && size ? <div className="comparison-canvas" style={{ aspectRatio: `${visual.width} / ${visual.height}` }}>
            <img src={version.screenshotUrl} alt={`Pagina acquisita il ${date(version.capturedAt)}`} style={{ width: `${size.width / visual.width * 100}%` }} />
            {show && <svg className="difference-overlay" viewBox={`0 0 ${visual.width} ${visual.height}`} aria-label="Zone di differenza" role="img">{visual.regions.map((region, i) => <rect key={i} x={region.x} y={region.y} width={region.width} height={region.height} className={active === i ? 'active' : ''} vectorEffect="non-scaling-stroke"><title>Zona {i + 1}</title></rect>)}</svg>}
          </div> : <img src={version.screenshotUrl} alt={`Pagina acquisita il ${date(version.capturedAt)}`} />}
        </div><div className="compare-downloads"><a className="text-button" href={version.screenshotUrl} target="_blank" rel="noreferrer">Apri screenshot</a><a className="text-button" href={version.htmlUrl} download><ArrowDownToLine size={14} /> Scarica HTML</a></div>
      </div>;
    })}</div>
  </>;
}
