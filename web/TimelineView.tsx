import { t, message as systemMessage, locale } from './i18n';
import { SecureLink } from './SecureResources';
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
export const qualityLabel = (quality?: Quality | null) => !quality ? t("Quality data unavailable") : quality.renderStatus === 'partial' || (!quality.renderStatus && quality.status === 'partial') ? t("Incomplete load") : quality.version && quality.version >= 2 && quality.renderStatus === 'complete' ? t("Load verified") : t("Earlier quality checks");
export const observationLabel = (status: string) => ({ partial: t("Needs review"), observed: t("Evidence saved"), confirmed: t("Change confirmed"), unchanged: t("Unchanged"), ok: t("Copy saved"), changed: t("Change detected"), returned: t("Previous variant returned"), error: t("Check failed"), unavailable: t("Temporarily unreachable"), missing: t("Unreachable"), blocked: t("Access blocked"), cancelled: t("Check stopped") }[status] || t("Check recorded"));

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
    <p className="history-explanation">{t("Every visit keeps its own date, even when it reuses an earlier copy.")}</p>
    {observations.checks.length ? <ol>{observations.checks.map(check => <li key={check.id}>
      <div className="observation-heading"><time dateTime={check.createdAt}>{date(check.createdAt)}</time><span className={`history-state ${['partial', 'error', 'blocked', 'unavailable', 'missing'].includes(check.status) ? 'observed' : ''}`}>{observationLabel(check.status)}</span></div>
      <p>{systemMessage(check.message)}</p>
      {check.evidence?.originalFilesRemoved && <p className="observation-file-note">{t("The files from this visit were removed during a review. The date and check result are kept.")}</p>}
      {check.versionId && available.has(check.versionId) && <button className="text-button" onClick={() => select(check.versionId!, check)}>{check.evidence?.originalFilesRemoved ? t("Open reference copy") : t("Open associated copy")}<ArrowRight size={14} /></button>}
    </li>)}</ol> : <p className="history-explanation">{t("No completed checks.")}</p>}
    <div className="history-pagination"><span>{observations.checks.length}{total !== undefined ? t(" of {p0}", { p0: total }) : ''} {t(" checks")}</span>{observations.hasMore && <button className="button secondary compact" disabled={observations.loading} onClick={observations.loadMore}>{observations.loading && <LoaderCircle className="spin" size={14} />}{t("Load earlier checks")}</button>}</div>
    {observations.error && <div className="notice error" role="alert">{systemMessage(observations.error)}</div>}
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
        <span className={`history-state ${state}`}>{state === 'confirmed' ? t("Confirmed") : state === 'observed' ? t("Evidence to review") : t("Earlier archive")}</span>
        <strong>{check?.evidence?.kind === 'returned' ? t("Return to an earlier variant") : version.id === firstId && at === version.capturedAt ? t("First capture") : systemMessage(check?.message || version.reason) || t("Copy saved")}</strong>
        {repeated && <span className="variant-label">{t("Variant ")}{groupNumbers.get(groupKey)} · {groups.get(groupKey)!.length} {t(" occurrences")}</span>}
        <small>{bytes(version.bytes)} · {qualityLabel(version.quality)}</small>
        {referenceVersionId === version.id && <span className="reference-label"><Check size={12} />{t("Comparison reference")}</span>}
      </div>{chosen && <ChevronRight size={16} />}
    </button>;
  }
  return <aside className="panel timeline-panel history-timeline" aria-label={t("Page history")}>
    <div className="timeline-heading"><h2>{t("Timeline")}</h2><p>{t("Confirmed changes and new evidence. Every visit stays available.")}</p></div>
    <div className="history-filters" aria-label={t("History view")}>
      <button aria-pressed={filter === 'useful'} className={filter === 'useful' ? 'selected' : ''} onClick={() => setFilter('useful')}>{t("Useful versions")}</button>
      <button aria-pressed={filter === 'variants'} className={filter === 'variants' ? 'selected' : ''} onClick={() => setFilter('variants')}>{t("By variant")}</button>
      <button aria-pressed={filter === 'all'} className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>{t("All observations")}</button>
    </div>
    {filter === 'all' ? <div className="timeline-list"><ObservationList compact observations={observations} versions={versions} date={date} select={select} total={summary?.checks} /></div> : filter === 'variants' ? <div className="timeline-list variant-groups"><p className="history-explanation">{t("Repeated occurrences share a group. A return A → B → A keeps every date.")}</p>{observations.hasMore && <p className="history-explanation">{t("More dates are available by loading earlier checks in “All observations”.")}</p>}{[...groups.entries()].reverse().map(([key, members]) => <details key={key} open={members.some(({ version }) => version.id === selectedId) ? true : undefined}><summary>{members[0].version.variantKey ? t("Variant {p0}", { p0: groupNumbers.get(key) ?? 0 }) : t("Copy without an assigned variant")}<span>{members.length} {members.length === 1 ? t("date") : t("dates")}</span></summary>{[...members].reverse().map(item)}</details>)}</div> : <div className="timeline-list">
      {recent.length ? recent.map(item) : <p className="history-explanation">{t("Available copies predate the new checks. You can browse them in the earlier archive below.")}</p>}
      {!!legacy.length && <details className="legacy-history" open={legacyOpen} onToggle={event => setLegacyOpen(event.currentTarget.open)}><summary>{t("Earlier archive ")}<span>{legacy.length} {t(" dates")}</span></summary><p className="history-explanation">{t("The quality of older copies may not have been measured. This is not an error. All copies remain available.")}</p>{legacy.map(item)}</details>}
    </div>}
    <div className="timeline-footnote"><History size={14} /> {t(" Grouping or changing views does not delete copies.")}</div>
  </aside>;
}

export function QualitySummary({ version, reference, observation, date }: { version: ArchiveVersion; reference: boolean; observation?: Observation; date: DateLabel }) {
  const quality = version.quality, state = reviewState(version);
  const reasons = [...new Set([...(quality?.reasons || []), ...(version.evidence?.reasons || []), ...(version.evidence?.signals || []), ...(version.warnings || [])])];
  const incomplete = quality?.renderStatus === 'partial' || (!quality?.renderStatus && quality?.status === 'partial');
  return <div className={`quality-summary ${incomplete ? 'quality-attention' : ''}`}>
    <div className="quality-summary-heading"><span className={`history-state ${state}`}>{state === 'confirmed' ? t("Verified version") : state === 'observed' ? t("Saved evidence · needs review") : t("Copy from the earlier archive")}</span>{reference && <span className="reference-label"><Check size={14} />{t("Comparison reference")}</span>}</div>
    {state === 'observed' && <p>{t("This evidence is kept because it may contain a new offer or variant. Its presence alone does not confirm a site change.")}</p>}
    {!quality ? <p>{t("Quality data is unavailable for this historical capture. This does not mean the copy is incomplete.")}</p> : <p><strong>{qualityLabel(quality)}.</strong>{quality.archiveStatus === 'partial' ? t(" The offline copy has resources that were not embedded: the screenshot may show elements missing from the HTML.") : quality.archiveStatus === 'complete' ? t(" Offline copy verified.") : ''}</p>}
    {(version.evidence?.summary || version.evidence?.reason) && <p>{systemMessage(version.evidence.summary || version.evidence.reason)}</p>}
    {!!reasons.length && <details><summary>{t("Capture details ")}<span>{reasons.length}</span></summary><ul>{reasons.map(reason => <li key={systemMessage(reason)}>{systemMessage(reason)}</li>)}</ul></details>}
    {observation && <p className="selected-observation"><Clock3 size={14} />{t("Check on ")}{date(observation.createdAt)}. {observation.evidence?.originalFilesRemoved ? t("Original files were removed during review; showing the reference copy") : t("Associated copy captured")} {t(" on ")}{date(version.capturedAt)}.</p>}
  </div>;
}

export function DiagnosticsPanel({ diagnostics, date, bytes }: { diagnostics: Diagnostic[]; date: DateLabel; bytes: SizeLabel }) {
  return <details className="panel diagnostics-panel"><summary>{t("Temporary anomaly samples ")}<span>{diagnostics.length}</span></summary><p>{t("These help explain what failed to load. They expire; the check log remains available.")}</p>
    {diagnostics.length ? <ul>{diagnostics.map(sample => <li key={sample.id}><time dateTime={sample.createdAt}>{date(sample.createdAt)}</time><p>{systemMessage(sample.reason)}</p><span>{bytes(sample.bytes)} {t(" · Expires ")}{date(sample.expiresAt)}</span>{sample.screenshotUrl && <SecureLink className="text-button" href={sample.screenshotUrl} target="_blank" rel="noreferrer">{t("Open sample ")}<ArrowRight size={14} /></SecureLink>}</li>)}</ul> : <p>{t("No temporary samples available.")}</p>}
  </details>;
}
