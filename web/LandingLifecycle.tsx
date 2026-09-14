import { useState } from 'react';
import { ArrowRight, History, Plus, Search } from 'lucide-react';

type Page = { id: string; url: string; title: string; source: string; firstSeenAt?: string; lastSuccessfulAt?: string; lastCheckedAt?: string; lastStatus?: string; versionCount: number; lifecycle: string; sitemapState: string };
const categories = [{ id: 'all', label: 'Tutte' }, { id: 'new', label: 'Nuove' }, { id: 'changed', label: 'Modificate' }, { id: 'missing', label: 'Non raggiungibili' }, { id: 'recovered', label: 'Tornate online' }, { id: 'sitemap', label: 'Fuori dalla sitemap' }];
const sourceName = (source: string) => ({ seed: 'Indirizzo iniziale', sitemap: 'Sitemap', link: 'Collegamento pubblico', manual: 'Aggiunta a mano' }[source] || source);
const path = (value: string) => { try { const url = new URL(value); return url.pathname + url.search; } catch { return value; } };
export default function LandingLifecycle({ pages, maxPages, date, statusLabel, add }: { pages: Page[]; maxPages: number; date: (value?: string, short?: boolean) => string; statusLabel: (value?: string) => string; add: () => void }) {
  const [filter, setFilter] = useState(''), [category, setCategory] = useState('all');
  const matches = (page: Page, category: string) => category === 'all' || (category === 'sitemap' ? page.sitemapState === 'absent' : page.lifecycle === category);
  const selected = pages.filter(page => matches(page, category) && `${page.url} ${page.title}`.toLowerCase().includes(filter.toLowerCase()));
  return <section className="panel pages-panel lifecycle-panel" aria-label="Vita delle landing">
    <div className="panel-heading"><div><h2>Vita delle landing</h2><p>Scoperte, modifiche e ritorni online. Le date indicano quando l’archivio ha osservato la pagina.</p></div><button className="button secondary compact" onClick={add}><Plus size={16} /> Aggiungi URL</button></div>
    <div className="lifecycle-filters" role="group" aria-label="Filtra per evoluzione">{categories.map(item => <button key={item.id} className={`button secondary compact ${category === item.id ? 'selected' : ''}`} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.label}<span>{pages.filter(page => matches(page, item.id)).length}</span></button>)}</div>
    <div className="table-toolbar"><div className="input-search"><Search size={16} /><input aria-label="Filtra pagine" placeholder="Cerca una landing o un titolo" value={filter} onChange={event => setFilter(event.target.value)} /></div><span className="muted">{pages.length} / {maxPages} pagine</span></div>
    {pages.length >= maxPages && <div className="notice amber">Limite raggiunto: aumenta il limite nelle impostazioni per archiviare altre landing trovate automaticamente.</div>}
    {selected.length ? <div className="table-scroll"><table className="pages-table lifecycle-table"><thead><tr><th>Pagina e origine</th><th>Prima scoperta</th><th>Ultima copia riuscita</th><th>Evoluzione e controllo</th><th>Versioni</th><th><span className="sr-only">Apri</span></th></tr></thead><tbody>{selected.map(page => <tr key={page.id}>
      <td><a href={`#/page/${page.id}`}><strong>{page.title || path(page.url)}</strong><small title={page.url}>{path(page.url)}</small></a><small className="page-source">{sourceName(page.source)}</small>{page.sitemapState === 'absent' && <span className="badge amber">Non più nella sitemap</span>}</td>
      <td className="nowrap">{date(page.firstSeenAt, true)}</td><td className="nowrap">{date(page.lastSuccessfulAt, true)}</td>
      <td><span className={`badge ${page.lifecycle === 'missing' ? 'amber' : 'green'}`}>{page.lifecycle === 'new' ? 'Nuova nell’archivio' : statusLabel(page.lifecycle)}</span><small className="page-source">{statusLabel(page.lastStatus)} · {date(page.lastCheckedAt, true)}</small></td>
      <td><span className="version-count"><History size={14} />{page.versionCount}</span></td><td><a className="icon-button" href={`#/page/${page.id}`} aria-label={`Apri ${page.title || page.url}`}><ArrowRight size={17} /></a></td>
    </tr>)}</tbody></table></div> : <p className="no-results">{pages.length ? 'Nessuna pagina corrisponde ai filtri.' : 'La ricerca individuerà le prime landing. Puoi anche aggiungere un indirizzo a mano.'}</p>}
    <p className="lifecycle-note">Le categorie seguono l’ultimo evento osservato, non la data di pubblicazione del sito. Una rimozione dalla sitemap non prova che una pagina sia offline. La scomparsa viene confermata dopo due risposte 404 o 410; le copie restano disponibili.</p>
  </section>;
}
