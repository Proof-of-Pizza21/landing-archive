import { SecureFrame } from './SecureResources';
import { authFetch } from './client';
import { useEffect, useRef, useState } from 'react';
import { Check, MousePointer2, Plus, Trash2 } from 'lucide-react';

export type MonitoringRule = { selector: string; label: string };
type Rules = { ignoreRules: MonitoringRule[]; importantRules: MonitoringRule[] };
type Version = { id: string; capturedAt: string };
type Match = { count: number; text: string; error?: string };

export function selectorFor(element: Element, doc: Document): string {
  const path: string[] = [];
  let node: Element | null = element;
  for (let depth = 0; node && node !== doc.documentElement && depth < 12; depth++, node = node.parentElement) {
    if (node.id && doc.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) {
      path.unshift(`#${CSS.escape(node.id)}`); break;
    }
    const tag = node.localName;
    const classes = [...node.classList].filter(value => value.length < 60 && !/^(active|hover|focus|selected|loaded|loading|visible|hidden|open|closed)$/i.test(value)).slice(0, 2);
    const simple = tag + classes.map(value => `.${CSS.escape(value)}`).join('');
    if (classes.length && doc.querySelectorAll(simple).length === 1) { path.unshift(simple); break; }
    const siblings: Element[] = node.parentElement ? [...node.parentElement.children].filter(child => child.localName === tag) : [];
    path.unshift(`${tag}${siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(node) + 1})` : ''}`);
  }
  const selector = path.join(' > ');
  if (!selector || selector.length > 500 || doc.querySelectorAll(selector).length !== 1 || doc.querySelector(selector) !== element) throw new Error('Non riesco a identificare questa zona in modo univoco. Prova un elemento più piccolo.');
  return selector;
}
function inspect(doc: Document | null | undefined, selector: string): Match {
  if (!doc || doc.URL === 'about:blank') return { count: 0, text: '', error: 'Copia non ancora disponibile' };
  try {
    const nodes = [...doc.querySelectorAll(selector)];
    return { count: nodes.length, text: nodes.slice(0, 3).map(node => (node.textContent || (node as HTMLImageElement).alt || node.localName).trim().replace(/\s+/g, ' ').slice(0, 160)).join(' · ') };
  } catch { return { count: 0, text: '', error: 'Regola non valida' }; }
}

export default function RuleEditor({ pageId, versions, initial, inherited, saved }: {
  pageId: string; versions: Version[]; initial: Rules; inherited: string[]; saved: () => Promise<void>;
}) {
  const [rules, setRules] = useState<Rules>(initial);
  const [mode, setMode] = useState<'ignoreRules' | 'importantRules'>('ignoreRules');
  const [selection, setSelection] = useState<MonitoringRule | null>(null);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(0); const [preview, setPreview] = useState(false);
  const current = useRef<HTMLIFrameElement>(null), previous = useRef<HTMLIFrameElement>(null);
  const selectedElement = useRef<Element | null>(null);
  const marked = useRef<{ element: HTMLElement; outline: string; offset: string }[]>([]);
  const frames = versions.slice(0, 2);
  const dirty = JSON.stringify(rules) !== JSON.stringify(initial);
  const allRules = [...inherited.map(selector => ({ selector, label: 'Esclusione del sito', mode: 'ignoreRules' })), ...rules.ignoreRules.map(rule => ({ ...rule, mode: 'ignoreRules' })), ...rules.importantRules.map(rule => ({ ...rule, mode: 'importantRules' }))];
  const choose = (element: Element) => {
    try {
      const doc = current.current?.contentDocument;
      if (!doc || ['html','body','head','style','link'].includes(element.localName)) return;
      const selector = selectorFor(element, doc);
      selectedElement.current = element;
      const label = (element.textContent?.trim() || (element as HTMLImageElement).alt || `Zona ${element.localName}`).replace(/\s+/g, ' ').slice(0, 120);
      setSelection({ selector, label }); setError('');
    } catch (error) { setError((error as Error).message); }
  };
  function loaded(which: number) {
    const doc = (which === 0 ? current : previous).current?.contentDocument;
    if (!doc || doc.URL === 'about:blank' || doc.contentType !== 'text/html') { setError('Questa copia non è disponibile per la selezione. Prova una nuova acquisizione.'); return; }
    // Listeners execute in the parent app; the archived frame remains unable to
    // run scripts, open URLs, submit forms, or contact any remote resource.
    const click = (event: Event) => {
      event.preventDefault(); event.stopPropagation();
      if (which === 0 && (event as MouseEvent).button === 0 && event.target && (event.target as Element).nodeType === 1) choose(event.target as Element);
    };
    doc.querySelectorAll('button[disabled]').forEach(button => button.removeAttribute('disabled'));
    doc.addEventListener('click', click, true); doc.addEventListener('auxclick', click, true);
    setReady(value => value + 1);
  }
  useEffect(() => {
    for (const mark of marked.current) { mark.element.style.outline = mark.outline; mark.element.style.outlineOffset = mark.offset; }
    marked.current = [];
    for (const ref of [current, previous]) {
      const doc = ref.current?.contentDocument; if (!doc) continue;
      for (const rule of [...allRules, ...(selection ? [{ ...selection, mode: 'selected' }] : [])]) {
        try {
          for (const element of [...doc.querySelectorAll<HTMLElement>(rule.selector)].slice(0, 100)) {
            if (!element.style) continue;
            if (!marked.current.some(mark => mark.element === element)) marked.current.push({ element, outline: element.style.outline, offset: element.style.outlineOffset });
            element.style.setProperty('outline', `3px solid ${rule.mode === 'selected' ? '#2563eb' : rule.mode === 'ignoreRules' ? '#d97706' : '#15803d'}`, 'important');
            element.style.setProperty('outline-offset', '-3px', 'important');
          }
        } catch { /* Invalid inherited selectors are explained in the preview. */ }
      }
    }
  }, [rules, selection, ready, preview, inherited]);
  if (!frames[0]) return <section className="panel rule-editor"><h2>Zone da monitorare</h2><p>Serve una prima copia archiviata per scegliere le zone con un clic.</p></section>;
  async function save() {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await authFetch(`/api/pages/${encodeURIComponent(pageId)}/rules`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rules) });
      const data = await response.json();
      if (!response.ok) { if (response.status === 401) window.dispatchEvent(new CustomEvent('session-expired')); throw new Error(data.error || 'Salvataggio non riuscito'); }
      await saved(); setNotice('Regole salvate. Al prossimo controllo completo sarà conservato un riferimento con le nuove regole. Le copie precedenti restano intatte.');
    } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  }
  return <section className="panel rule-editor" aria-label="Regole di monitoraggio">
    <div className="panel-heading"><div><h2>Scegli cosa conta nella pagina</h2><p>Clicca sulla copia offline e aggiungi la zona scelta. Le regole valgono solo per questa pagina.</p></div><MousePointer2 size={22} /></div>
    <div className="rules-body">
      <div className="notice">Le copie HTML e gli screenshot futuri restano completi. In arancione vedi le zone escluse dal confronto; in verde quelle importanti, che hanno la precedenza sulle esclusioni.</div>
      <div className="rules-toolbar"><div className="tabs"><button aria-pressed={mode === 'ignoreRules'} className={mode === 'ignoreRules' ? 'selected' : ''} onClick={() => setMode('ignoreRules')}>Ignora variazioni</button><button aria-pressed={mode === 'importantRules'} className={mode === 'importantRules' ? 'selected' : ''} onClick={() => setMode('importantRules')}>Zona importante</button></div><label className="checkbox-label"><input type="checkbox" checked={preview} disabled={!frames[1]} onChange={event => setPreview(event.target.checked)} /> Mostra anche la copia precedente</label></div>
      <div className="rule-selection">{selection ? <><span>Selezionata: <strong>{selection.label}</strong></span><button className="button secondary compact" onClick={() => { const parent = selectedElement.current?.parentElement; if (parent) choose(parent); }}>Allarga selezione</button><button className="button primary compact" disabled={busy || rules[mode].some(rule => rule.selector === selection.selector) || rules[mode].length >= (mode === 'ignoreRules' ? 30 - inherited.length : 20)} onClick={() => { setRules(value => ({ ...value, [mode]: [...value[mode], selection] })); setSelection(null); }}><Plus size={15} /> {mode === 'ignoreRules' ? 'Escludi dal confronto' : 'Segna come importante'}</button></> : <span>Clicca un titolo, un’immagine o una sezione. I collegamenti restano disattivati durante la scelta.</span>}</div>
      <div className={`rule-previews ${preview ? 'two' : ''}`}>
        <div><strong>Ultima copia · {new Date(frames[0].capturedAt).toLocaleString('it-IT')}</strong><SecureFrame ref={current} title="Scegli zone nella pagina" src={`/api/versions/${encodeURIComponent(frames[0].id)}/offline/html`} sandbox="allow-same-origin" referrerPolicy="no-referrer" onLoad={() => loaded(0)} /></div>
        {preview && frames[1] && <div><strong>Copia precedente · {new Date(frames[1].capturedAt).toLocaleString('it-IT')}</strong><SecureFrame ref={previous} title="Anteprima regole nella copia precedente" src={`/api/versions/${encodeURIComponent(frames[1].id)}/offline/html`} sandbox="allow-same-origin" referrerPolicy="no-referrer" onLoad={() => loaded(1)} /></div>}
      </div>
      <div className="rule-lists">{(['ignoreRules','importantRules'] as const).map(key => <div key={key}><h3>{key === 'ignoreRules' ? 'Zone escluse' : 'Zone importanti'}</h3>{!rules[key].length && <p className="muted">Nessuna zona selezionata.</p>}{rules[key].map((rule, index) => {
        const latest = inspect(current.current?.contentDocument, rule.selector), older = preview ? inspect(previous.current?.contentDocument, rule.selector) : null;
        return <div className={`rule-item ${key}`} key={rule.selector}><div><strong>{rule.label}</strong><small>Ultima copia: {latest.error || `${latest.count} elementi`}{older ? ` · Precedente: ${older.error || `${older.count} elementi`}` : ''}</small>{latest.text && <p>{latest.text}</p>}{older?.text && <p className="muted">Prima: {older.text}</p>}{(!latest.count || (older && !older.count)) && <small className="rule-warning">Zona non trovata in una copia: verifica la scelta prima di salvare.</small>}<details><summary>Identificatore della zona</summary><code>{rule.selector}</code></details></div><button disabled={busy} className="icon-button" aria-label={`Rimuovi regola ${rule.label}`} onClick={() => setRules(value => ({ ...value, [key]: value[key].filter((_, i) => i !== index) }))}><Trash2 size={16} /></button></div>;
      })}</div>)}</div>
      {!!inherited.length && <p className="muted">Sono attive anche {inherited.length} esclusioni definite nelle impostazioni del sito.</p>}
      <p className="muted">L’anteprima mostra quali elementi vengono selezionati nelle copie salvate. L’impaginazione offline può differire dal sito online; al prossimo controllo le regole saranno applicate alla pagina live. Una zona che cambia struttura potrebbe richiedere una nuova scelta.</p>
      {error && <div className="notice error" role="alert">{error}</div>}{notice && <div className="notice" role="status">{notice}</div>}
      <div className="rules-save"><button className="button secondary" disabled={!dirty || busy} onClick={() => { setRules(initial); setSelection(null); }}>Annulla modifiche</button><button className="button primary" disabled={!dirty || busy} onClick={save}><Check size={16} /> {busy ? 'Salvataggio…' : 'Salva regole'}</button></div>
    </div>
  </section>;
}
