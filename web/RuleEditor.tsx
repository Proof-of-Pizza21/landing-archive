import { t, message as systemMessage, locale } from './i18n';
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
  if (!selector || selector.length > 500 || doc.querySelectorAll(selector).length !== 1 || doc.querySelector(selector) !== element) throw new Error(t("This area cannot be uniquely identified. Try a smaller element."));
  return selector;
}
function inspect(doc: Document | null | undefined, selector: string): Match {
  if (!doc || doc.URL === 'about:blank') return { count: 0, text: '', error: t("Copy not available yet") };
  try {
    const nodes = [...doc.querySelectorAll(selector)];
    return { count: nodes.length, text: nodes.slice(0, 3).map(node => (node.textContent || (node as HTMLImageElement).alt || node.localName).trim().replace(/\s+/g, ' ').slice(0, 160)).join(' · ') };
  } catch { return { count: 0, text: '', error: t("Invalid rule") }; }
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
  const allRules = [...inherited.map(selector => ({ selector, label: t("Site exclusion"), mode: 'ignoreRules' })), ...rules.ignoreRules.map(rule => ({ ...rule, mode: 'ignoreRules' })), ...rules.importantRules.map(rule => ({ ...rule, mode: 'importantRules' }))];
  const choose = (element: Element) => {
    try {
      const doc = current.current?.contentDocument;
      if (!doc || ['html','body','head','style','link'].includes(element.localName)) return;
      const selector = selectorFor(element, doc);
      selectedElement.current = element;
      const label = (element.textContent?.trim() || (element as HTMLImageElement).alt || t("Area {p0}", { p0: element.localName })).replace(/\s+/g, ' ').slice(0, 120);
      setSelection({ selector, label }); setError('');
    } catch (error) { setError((error as Error).message); }
  };
  function loaded(which: number) {
    const doc = (which === 0 ? current : previous).current?.contentDocument;
    if (!doc || doc.URL === 'about:blank' || doc.contentType !== 'text/html') { setError(t("This copy is unavailable for selection. Try capturing a new version.")); return; }
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
  if (!frames[0]) return <section className="panel rule-editor"><h2>{t("Monitoring areas")}</h2><p>{t("Save a first copy before selecting areas by clicking.")}</p></section>;
  async function save() {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await authFetch(`/api/pages/${encodeURIComponent(pageId)}/rules`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rules) });
      const data = await response.json();
      if (!response.ok) { if (response.status === 401) window.dispatchEvent(new CustomEvent('session-expired')); throw new Error(data.error || t("Save failed")); }
      await saved(); setNotice(t("Rules saved. The next complete check will save a reference using the new rules. Previous copies stay intact."));
    } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  }
  return <section className="panel rule-editor" aria-label={t("Monitoring rules")}>
    <div className="panel-heading"><div><h2>{t("Choose what matters on the page")}</h2><p>{t("Click the offline copy and add the selected area. Rules apply only to this page.")}</p></div><MousePointer2 size={22} /></div>
    <div className="rules-body">
      <div className="notice">{t("Future HTML copies and screenshots stay complete. Orange marks areas excluded from comparison; green marks important areas, which take priority over exclusions.")}</div>
      <div className="rules-toolbar"><div className="tabs"><button aria-pressed={mode === 'ignoreRules'} className={mode === 'ignoreRules' ? 'selected' : ''} onClick={() => setMode('ignoreRules')}>{t("Ignore changes")}</button><button aria-pressed={mode === 'importantRules'} className={mode === 'importantRules' ? 'selected' : ''} onClick={() => setMode('importantRules')}>{t("Important area")}</button></div><label className="checkbox-label"><input type="checkbox" checked={preview} disabled={!frames[1]} onChange={event => setPreview(event.target.checked)} /> {t(" Also show the previous copy")}</label></div>
      <div className="rule-selection">{selection ? <><span>{t("Selected: ")}<strong>{selection.label}</strong></span><button className="button secondary compact" onClick={() => { const parent = selectedElement.current?.parentElement; if (parent) choose(parent); }}>{t("Expand selection")}</button><button className="button primary compact" disabled={busy || rules[mode].some(rule => rule.selector === selection.selector) || rules[mode].length >= (mode === 'ignoreRules' ? 30 - inherited.length : 20)} onClick={() => { setRules(value => ({ ...value, [mode]: [...value[mode], selection] })); setSelection(null); }}><Plus size={15} /> {mode === 'ignoreRules' ? t("Exclude from comparison") : t("Mark as important")}</button></> : <span>{t("Click a heading, image or section. Links stay disabled while you select.")}</span>}</div>
      <div className={`rule-previews ${preview ? 'two' : ''}`}>
        <div><strong>{t("Latest copy · ")}{new Date(frames[0].capturedAt).toLocaleString(locale())}</strong><SecureFrame ref={current} title={t("Select areas on the page")} src={`/api/versions/${encodeURIComponent(frames[0].id)}/offline/html`} sandbox="allow-same-origin" referrerPolicy="no-referrer" onLoad={() => loaded(0)} /></div>
        {preview && frames[1] && <div><strong>{t("Previous copy · ")}{new Date(frames[1].capturedAt).toLocaleString(locale())}</strong><SecureFrame ref={previous} title={t("Preview rules in the previous copy")} src={`/api/versions/${encodeURIComponent(frames[1].id)}/offline/html`} sandbox="allow-same-origin" referrerPolicy="no-referrer" onLoad={() => loaded(1)} /></div>}
      </div>
      <div className="rule-lists">{(['ignoreRules','importantRules'] as const).map(key => <div key={key}><h3>{key === 'ignoreRules' ? t("Excluded areas") : t("Important areas")}</h3>{!rules[key].length && <p className="muted">{t("No areas selected.")}</p>}{rules[key].map((rule, index) => {
        const latest = inspect(current.current?.contentDocument, rule.selector), older = preview ? inspect(previous.current?.contentDocument, rule.selector) : null;
        return <div className={`rule-item ${key}`} key={rule.selector}><div><strong>{rule.label}</strong><small>{t("Latest copy: ")}{systemMessage(latest.error) || t("{p0} elements", { p0: latest.count })}{older ? t(" · Previous: {p0}", { p0: systemMessage(older.error) || t("{p0} elements", {p0: older.count}) }) : ''}</small>{latest.text && <p>{latest.text}</p>}{older?.text && <p className="muted">{t("Before: ")}{older.text}</p>}{(!latest.count || (older && !older.count)) && <small className="rule-warning">{t("Area not found in one copy: check your selection before saving.")}</small>}<details><summary>{t("Area identifier")}</summary><code>{rule.selector}</code></details></div><button disabled={busy} className="icon-button" aria-label={t("Remove rule {p0}", { p0: rule.label })} onClick={() => setRules(value => ({ ...value, [key]: value[key].filter((_, i) => i !== index) }))}><Trash2 size={16} /></button></div>;
      })}</div>)}</div>
      {!!inherited.length && <p className="muted">{t("There are also ")}{inherited.length} {t(" exclusions defined in the site settings.")}</p>}
      <p className="muted">{t("The preview shows which elements are selected in saved copies. The offline layout may differ from the live site; rules apply to the live page on the next check. An area whose structure changes may need to be selected again.")}</p>
      {error && <div className="notice error" role="alert">{systemMessage(error)}</div>}{notice && <div className="notice" role="status">{systemMessage(notice)}</div>}
      <div className="rules-save"><button className="button secondary" disabled={!dirty || busy} onClick={() => { setRules(initial); setSelection(null); }}>{t("Discard changes")}</button><button className="button primary" disabled={!dirty || busy} onClick={save}><Check size={16} /> {busy ? t("Saving…") : t("Save rules")}</button></div>
    </div>
  </section>;
}
