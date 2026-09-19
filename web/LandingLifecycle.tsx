import { t, message as systemMessage } from './i18n';
import { useState } from 'react';
import { ArrowRight, History, Plus, Search } from 'lucide-react';

type Page = { id: string; url: string; title: string; source: string; firstSeenAt?: string; lastSuccessfulAt?: string; lastCheckedAt?: string; lastStatus?: string; versionCount: number; lifecycle: string; sitemapState: string };
const categories = [{ id: 'all', label: "All pages" }, { id: 'new', label: "New" }, { id: 'changed', label: "Changed pages" }, { id: 'missing', label: "Unavailable pages" }, { id: 'recovered', label: "Pages back online" }, { id: 'sitemap', label: "Absent from sitemap" }];
const sourceName = (source: string) => ({ seed: t("Starting address"), sitemap: 'Sitemap', link: t("Public link"), manual: t("Added manually") }[source] || source);
const path = (value: string) => { try { const url = new URL(value); return url.pathname + url.search; } catch { return value; } };
export default function LandingLifecycle({ pages, maxPages, date, statusLabel, add }: { pages: Page[]; maxPages: number; date: (value?: string, short?: boolean) => string; statusLabel: (value?: string) => string; add: () => void }) {
  const [filter, setFilter] = useState(''), [category, setCategory] = useState('all');
  const matches = (page: Page, category: string) => category === 'all' || (category === 'sitemap' ? page.sitemapState === 'absent' : page.lifecycle === category);
  const selected = pages.filter(page => matches(page, category) && `${page.url} ${page.title}`.toLowerCase().includes(filter.toLowerCase()));
  return <section className="panel pages-panel lifecycle-panel" aria-label={t("Landing page lifecycle")}>
    <div className="panel-heading"><div><h2>{t("Landing page lifecycle")}</h2><p>{t("Discoveries, changes and returns online. Dates show when the archive observed the page.")}</p></div><button className="button secondary compact" onClick={add}><Plus size={16} /> {t(" Add URL")}</button></div>
    <div className="lifecycle-filters" role="group" aria-label={t("Filter by lifecycle")}>{categories.map(item => <button key={item.id} className={`button secondary compact ${category === item.id ? 'selected' : ''}`} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{systemMessage(item.label)}<span>{pages.filter(page => matches(page, item.id)).length}</span></button>)}</div>
    <div className="table-toolbar"><div className="input-search"><Search size={16} /><input aria-label={t("Filter pages")} placeholder={t("Search for a landing page or title")} value={filter} onChange={event => setFilter(event.target.value)} /></div><span className="muted">{pages.length} / {maxPages} {t(" pages")}</span></div>
    {pages.length >= maxPages && <div className="notice amber">{t("Limit reached: increase the limit in settings to archive more automatically discovered pages.")}</div>}
    {selected.length ? <div className="table-scroll"><table className="pages-table lifecycle-table"><thead><tr><th>{t("Page and source")}</th><th>{t("First discovered")}</th><th>{t("Last successful copy")}</th><th>{t("Lifecycle and check")}</th><th>{t("Versions")}</th><th><span className="sr-only">{t("Open")}</span></th></tr></thead><tbody>{selected.map(page => <tr key={page.id}>
      <td><a href={`#/page/${page.id}`}><strong>{page.title || path(page.url)}</strong><small title={page.url}>{path(page.url)}</small></a><small className="page-source">{sourceName(page.source)}</small>{page.sitemapState === 'absent' && <span className="badge amber">{t("No longer in the sitemap")}</span>}</td>
      <td className="nowrap">{date(page.firstSeenAt, true)}</td><td className="nowrap">{date(page.lastSuccessfulAt, true)}</td>
      <td><span className={`badge ${page.lifecycle === 'missing' ? 'amber' : 'green'}`}>{page.lifecycle === 'new' ? t("New to the archive") : statusLabel(page.lifecycle)}</span><small className="page-source">{statusLabel(page.lastStatus)} · {date(page.lastCheckedAt, true)}</small></td>
      <td><span className="version-count"><History size={14} />{page.versionCount}</span></td><td><a className="icon-button" href={`#/page/${page.id}`} aria-label={t("Open {p0}", { p0: page.title || page.url })}><ArrowRight size={17} /></a></td>
    </tr>)}</tbody></table></div> : <p className="no-results">{pages.length ? t("No pages match the filters.") : t("Discovery will find the first landing pages. You can also add an address manually.")}</p>}
    <p className="lifecycle-note">{t("Categories follow the last observed event, not the site's publication date. Removal from a sitemap does not prove a page is offline. Disappearance is confirmed after two 404 or 410 responses; copies stay available.")}</p>
  </section>;
}
