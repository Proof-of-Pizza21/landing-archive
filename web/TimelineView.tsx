import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronRight, Clock3, History, LoaderCircle } from 'lucide-react';
import { api } from './client';

export type Quality = { status: 'complete' | 'partial'; missingImages: number; reasons: string[]; version?: number; stable?: boolean; renderStatus?: 'complete' | 'partial'; archiveStatus?: 'complete' | 'partial' };
export type Evidence = { kind?: string; summary?: string; reason?: string; reasons?: string[]; signals?: string[]; originalVersionId?: string; originalCapturedAt?: string; originalFilesRemoved?: boolean };
export type ArchiveVersion = { quality?: Quality | null; reviewState?: 'legacy' | 'confirmed' | 'observed'; variantKey?: string | null; evidence?: Evidence | null; id: string; capturedAt: string; title: string; statusCode: number; finalUrl: string; bytes: number; reason: string; warnings: string[]; screenshotUrl: string; htmlUrl: string; text?: string; links?: { url: string; text: string }[] };
export type Observation = { quality?: Quality | null; evidence?: Evidence | null; id: string; createdAt: string; status: string; message: string; versionId?: string | null };
export type HistorySummary = { totalVersions: number; confirmed: number; observed: number; legacy: number; variants: number; checks: number; anomalies: number };
export type Diagnostic = { id: string; createdAt: string; bytes: number; reason: string; screenshotUrl?: string; expiresAt: string };
type DateLabel = (value?: string, short?: boolean) => string;
type SizeLabel = (value?: number) => string;

export const reviewState = (version: ArchiveVersion) => version.reviewState || 'legacy';
export const qualityLabel = (quality?: Quality | null) => !quality ? 'Dati di qualità non disponibili' : quality.renderStatus === 'partial' || (!quality.renderStatus && quality.status === 'partial') ? 'Caricamento incompleto' : quality.version && quality.version >= 2 && quality.renderStatus === 'complete' ? 'Caricamento verificato' : 'Controlli di qualità precedenti';
export const observationLabel = (status: string) => ({ partial: 'Da verificare', observed: 'Evidenza conservata', confirmed: 'Modifica confermata', unchanged: 'Invariata', ok: 'Copia conservata', changed: 'Modifica rilevata', returned: 'Variante ritornata', error: 'Controllo non riuscito', unavailable: 'Temporaneamente non raggiungibile', missing: 'Non raggiungibile', blocked: 'Accesso bloccato', cancelled: 'Controllo interrotto' }[status] || 'Controllo registrato');

export function useObservations(pageId: string, initial: Observation[], total?: number) {
  const [older, setOlder] = useState<Observation[]>([]);
  const [exhausted, setExhausted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const currentPage = useRef(pageId); currentPage.current = pageId;
  useEffect(() => { setOlder([]); setExhausted(false); setLoading(false); setError(''); }, [pageId]);
  const checks = useMemo(() => [...new Map([...older, ...initial].map(check => [check.id, check])).values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)), [older, initial]);
  const hasMore = !exhausted && (total === undefined ? checks.length >= 1000 : checks.length < total);
  async function loadMore() {
    if (loading || !checks.length) return;
    const expectedPage = pageId, last = checks[checks.length - 1];
    setLoading(true); setError('');
    try {
      const value = await api<{ checks: Observation[]; hasMore: boolean }>(`/api/pages/${encodeURIComponent(pageId)}/checks?before=${encodeURIComponent(last.createdAt)}&beforeId=${encodeURIComponent(last.id)}`);
      if (currentPage.current !== expectedPage) return;
      setOlder(previous => [...previous, ...value.checks]); setExhausted(!value.hasMore);
    } catch (cause) { if (currentPage.current === expectedPage) setError((cause as Error).message); }
    finally { if (currentPage.current === expectedPage) setLoading(false); }
  }
  return { checks, hasMore, loading, error, loadMore };
}

type ObservationControls = ReturnType<typeof useObservations>;
export function ObservationList({ observations, versions, date, select, total, compact = false }: { observations: ObservationControls; versions: ArchiveVersion[]; date: DateLabel; select: (id: string, check?: Observation) => void; total?: number; compact?: boolean }) {
  const available = new Set(versions.map(version => version.id));
  return <div className={compact ? 'observations-list compact' : 'observations-list'}>
    <p className="history-explanation">Ogni visita conserva la propria data, anche quando riutilizza una copia precedente.</p>
    {observations.checks.length ? <ol>{observations.checks.map(check => <li key={check.id}>
      <div className="observation-heading"><time dateTime={check.createdAt}>{date(check.createdAt)}</time><span className={`history-state ${['partial', 'error', 'blocked', 'unavailable', 'missing'].includes(check.status) ? 'observed' : ''}`}>{observationLabel(check.status)}</span></div>
      <p>{check.message}</p>
      {check.evidence?.originalFilesRemoved && <p className="observation-file-note">I file di questa visita sono stati rimossi durante una revisione. La data e il risultato del controllo sono conservati.</p>}
      {check.versionId && available.has(check.versionId) && <button className="text-button" onClick={() => select(check.versionId!, check)}>{check.evidence?.originalFilesRemoved ? 'Apri la copia di riferimento' : 'Apri copia associata'}<ArrowRight size={14} /></button>}
    </li>)}</ol> : <p className="history-explanation">Nessun controllo completato.</p>}
    <div className="history-pagination"><span>{observations.checks.length}{total !== undefined ? ` di ${total}` : ''} controlli</span>{observations.hasMore && <button className="button secondary compact" disabled={observations.loading} onClick={observations.loadMore}>{observations.loading && <LoaderCircle className="spin" size={14} />}Carica controlli precedenti</button>}</div>
    {observations.error && <div className="notice error" role="alert">{observations.error}</div>}
  </div>;
}

type Occurrence = { version: ArchiveVersion; check?: Observation; at: string };
export function versionOccurrences(versions: ArchiveVersion[], checks: Observation[]): Occurrence[] {
  const available = new Map(versions.map(version => [version.id, version]));
  const entries = new Map(versions.map(version => [`${version.id}:${version.capturedAt}`, { version, at: version.capturedAt } as Occurrence]));
  for (const check of checks) {
    const version = check.versionId ? available.get(check.versionId) : undefined;
    if (!version || !['first', 'change', 'returned', 'baseline'].includes(check.evidence?.kind || '')) continue;
    entries.set(`${version.id}:${check.createdAt}`, { version, check, at: check.createdAt });
  }
  return [...entries.values()].sort((a, b) => b.at.localeCompare(a.at) || b.version.id.localeCompare(a.version.id));
}

export default function TimelineView({ versions, selectedId, selectedAt, referenceVersionId, summary, observations, select, date, bytes }: { versions: ArchiveVersion[]; selectedId?: string; selectedAt?: string; referenceVersionId?: string | null; summary?: HistorySummary; observations: ObservationControls; select: (id: string, check?: Observation) => void; date: DateLabel; bytes: SizeLabel }) {
  const [filter, setFilter] = useState<'useful' | 'variants' | 'all'>('useful');
  const [legacyOpen, setLegacyOpen] = useState(false);
  const occurrences = versionOccurrences(versions, observations.checks);
  const recent = occurrences.filter(({ version }) => reviewState(version) !== 'legacy');
  const legacy = occurrences.filter(({ version }) => reviewState(version) === 'legacy');
  const groups = new Map<string, Occurrence[]>();
  for (const occurrence of [...occurrences].reverse()) {
    const { version } = occurrence;
    const key = version.variantKey || `unclassified:${version.id}`;
    groups.set(key, [...(groups.get(key) || []), occurrence]);
  }
  const groupNumbers = new Map([...groups.keys()].map((key, index) => [key, index + 1]));
  const firstId = versions[versions.length - 1]?.id;
  useEffect(() => { if (legacy.some(({ version }) => version.id === selectedId)) setLegacyOpen(true); }, [selectedId]);
  function item({ version, check, at }: Occurrence) {
    const state = reviewState(version), groupKey = version.variantKey || `unclassified:${version.id}`;
    const repeated = (groups.get(groupKey)?.length || 0) > 1;
    const chosen = selectedId === version.id && (selectedAt || version.capturedAt) === at;
    return <button className={`timeline-item ${chosen ? 'selected' : ''}`} aria-pressed={chosen} key={`${version.id}:${at}`} onClick={() => select(version.id, check)}>
      <span className={`timeline-node ${state}`} /><div><time dateTime={at}>{date(at)}</time>
        <span className={`history-state ${state}`}>{state === 'confirmed' ? 'Confermata' : state === 'observed' ? 'Evidenza da verificare' : 'Archivio precedente'}</span>
        <strong>{check?.evidence?.kind === 'returned' ? 'Ritorno a una variante precedente' : version.id === firstId && at === version.capturedAt ? 'Prima acquisizione' : check?.message || version.reason || 'Copia conservata'}</strong>
        {repeated && <span className="variant-label">Variante {groupNumbers.get(groupKey)} · {groups.get(groupKey)!.length} ricorrenze</span>}
        <small>{bytes(version.bytes)} · {qualityLabel(version.quality)}</small>
        {referenceVersionId === version.id && <span className="reference-label"><Check size={12} />Riferimento per il confronto</span>}
      </div>{chosen && <ChevronRight size={16} />}
    </button>;
  }
  return <aside className="panel timeline-panel history-timeline" aria-label="Cronologia della pagina">
    <div className="timeline-heading"><h2>Linea del tempo</h2><p>Modifiche confermate ed evidenze nuove. Ogni visita resta consultabile.</p></div>
    <div className="history-filters" aria-label="Vista della cronologia">
      <button aria-pressed={filter === 'useful'} className={filter === 'useful' ? 'selected' : ''} onClick={() => setFilter('useful')}>Versioni utili</button>
      <button aria-pressed={filter === 'variants'} className={filter === 'variants' ? 'selected' : ''} onClick={() => setFilter('variants')}>Per variante</button>
      <button aria-pressed={filter === 'all'} className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>Tutte le osservazioni</button>
    </div>
    {filter === 'all' ? <div className="timeline-list"><ObservationList compact observations={observations} versions={versions} date={date} select={select} total={summary?.checks} /></div> : filter === 'variants' ? <div className="timeline-list variant-groups"><p className="history-explanation">Le ricorrenze condividono un gruppo. Un ritorno A → B → A mantiene tutte le date.</p>{observations.hasMore && <p className="history-explanation">Altre date sono disponibili caricando i controlli precedenti in «Tutte le osservazioni».</p>}{[...groups.entries()].reverse().map(([key, members]) => <details key={key} open={members.some(({ version }) => version.id === selectedId) ? true : undefined}><summary>{members[0].version.variantKey ? `Variante ${groupNumbers.get(key)}` : 'Copia senza variante assegnata'}<span>{members.length} {members.length === 1 ? 'data' : 'date'}</span></summary>{[...members].reverse().map(item)}</details>)}</div> : <div className="timeline-list">
      {recent.length ? recent.map(item) : <p className="history-explanation">Le copie disponibili precedono i nuovi controlli. Puoi consultarle nell’archivio precedente qui sotto.</p>}
      {!!legacy.length && <details className="legacy-history" open={legacyOpen} onToggle={event => setLegacyOpen(event.currentTarget.open)}><summary>Archivio precedente <span>{legacy.length} date</span></summary><p className="history-explanation">La qualità delle copie più vecchie può non essere stata misurata. Questo non indica un errore. Le copie restano tutte disponibili.</p>{legacy.map(item)}</details>}
    </div>}
    <div className="timeline-footnote"><History size={14} /> Raggruppare o cambiare vista non elimina copie.</div>
  </aside>;
}

export function QualitySummary({ version, reference, observation, date }: { version: ArchiveVersion; reference: boolean; observation?: Observation; date: DateLabel }) {
  const quality = version.quality, state = reviewState(version);
  const reasons = [...new Set([...(quality?.reasons || []), ...(version.evidence?.reasons || []), ...(version.evidence?.signals || []), ...(version.warnings || [])])];
  const incomplete = quality?.renderStatus === 'partial' || (!quality?.renderStatus && quality?.status === 'partial');
  return <div className={`quality-summary ${incomplete ? 'quality-attention' : ''}`}>
    <div className="quality-summary-heading"><span className={`history-state ${state}`}>{state === 'confirmed' ? 'Versione verificata' : state === 'observed' ? 'Evidenza conservata · da verificare' : 'Copia dell’archivio precedente'}</span>{reference && <span className="reference-label"><Check size={14} />Riferimento per il confronto</span>}</div>
    {state === 'observed' && <p>Questa evidenza è conservata perché potrebbe contenere un’offerta o una variante nuova. La sua presenza non conferma da sola una modifica del sito.</p>}
    {!quality ? <p>Dati di qualità non disponibili per questa acquisizione storica. Non significa che la copia sia incompleta.</p> : <p><strong>{qualityLabel(quality)}.</strong>{quality.archiveStatus === 'partial' ? ' La copia offline contiene risorse non incorporate: lo screenshot può mostrare elementi assenti nell’HTML.' : quality.archiveStatus === 'complete' ? ' Copia offline verificata.' : ''}</p>}
    {(version.evidence?.summary || version.evidence?.reason) && <p>{version.evidence.summary || version.evidence.reason}</p>}
    {!!reasons.length && <details><summary>Dettagli dell’acquisizione <span>{reasons.length}</span></summary><ul>{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></details>}
    {observation && <p className="selected-observation"><Clock3 size={14} />Controllo del {date(observation.createdAt)}. {observation.evidence?.originalFilesRemoved ? 'I file originali sono stati rimossi nella revisione; viene mostrata la copia di riferimento' : 'Copia associata acquisita'} il {date(version.capturedAt)}.</p>}
  </div>;
}

export function DiagnosticsPanel({ diagnostics, date, bytes }: { diagnostics: Diagnostic[]; date: DateLabel; bytes: SizeLabel }) {
  return <details className="panel diagnostics-panel"><summary>Campioni temporanei delle anomalie <span>{diagnostics.length}</span></summary><p>Aiutano a capire cosa non è stato caricato. Hanno una scadenza; il registro dei controlli resta disponibile.</p>
    {diagnostics.length ? <ul>{diagnostics.map(sample => <li key={sample.id}><time dateTime={sample.createdAt}>{date(sample.createdAt)}</time><p>{sample.reason}</p><span>{bytes(sample.bytes)} · Scadenza {date(sample.expiresAt)}</span>{sample.screenshotUrl && <a className="text-button" href={sample.screenshotUrl} target="_blank" rel="noreferrer">Apri campione <ArrowRight size={14} /></a>}</li>)}</ul> : <p>Nessun campione temporaneo disponibile.</p>}
  </details>;
}
