/** A deliberately conservative, forward-only lexical guard. It never builds a
 * DOM, expands entities or compares an attribute with every earlier attribute.
 * The disposable parser remains the authority for HTML syntax and sanitation. */
export const htmlMaxBytes = 32 * 1024 * 1024;
export const htmlMaxOutputBytes = 48 * 1024 * 1024;
export const htmlLimit = () => Object.assign(new Error('Questa copia supera i limiti di elaborazione sicura. Puoi consultare lo screenshot conservato.'), { statusCode: 413, code: 'HTML_LIMIT' });
export type HtmlTag = { name: string; closing: boolean; attributes: Map<string, string> };
const voids = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const raw = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes']);
const space = (c: number) => c === 9 || c === 10 || c === 12 || c === 13 || c === 32;
const letter = (c: number) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
const implicit: Record<string, { closes: string[]; boundary: string[] }> = {
  li: { closes: ['li'], boundary: ['ul', 'ol', 'menu'] },
  dt: { closes: ['dt', 'dd'], boundary: ['dl'] }, dd: { closes: ['dt', 'dd'], boundary: ['dl'] },
  tr: { closes: ['tr'], boundary: ['table', 'thead', 'tbody', 'tfoot'] },
  td: { closes: ['td', 'th'], boundary: ['tr', 'table'] }, th: { closes: ['td', 'th'], boundary: ['tr', 'table'] },
  thead: { closes: ['thead', 'tbody', 'tfoot'], boundary: ['table'] },
  tbody: { closes: ['thead', 'tbody', 'tfoot'], boundary: ['table'] },
  tfoot: { closes: ['thead', 'tbody', 'tfoot'], boundary: ['table'] },
  option: { closes: ['option'], boundary: ['select', 'datalist', 'optgroup'] },
  optgroup: { closes: ['optgroup'], boundary: ['select'] },
  rt: { closes: ['rt', 'rp'], boundary: ['ruby'] }, rp: { closes: ['rt', 'rp'], boundary: ['ruby'] },
};
const closesParagraph = new Set(['address', 'article', 'aside', 'blockquote', 'details', 'div', 'dl', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'main', 'menu', 'nav', 'ol', 'p', 'pre', 'search', 'section', 'table', 'ul']);
function closeImplicit(stack: string[], closes: string[], boundary: string[]) {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (closes.includes(stack[i])) { stack.length = i; return; }
    if (boundary.includes(stack[i])) return;
  }
}
function rawEnd(html: string, name: string, start: number) {
  // Only inspect the short tag name at each closing delimiter. Lowercasing a
  // whole SingleFile document would copy megabytes of embedded image data.
  for (let end = html.indexOf('</', start); end >= 0; end = html.indexOf('</', end + 2)) {
    let equal = true;
    for (let i = 0; i < name.length; i++) {
      const code = html.charCodeAt(end + i + 2);
      if ((code >= 65 && code <= 90 ? code + 32 : code) !== name.charCodeAt(i)) { equal = false; break; }
    }
    const next = html[end + name.length + 2];
    if (equal && (space(html.charCodeAt(end + name.length + 2)) || next === '>' || next === '/')) return end;
  }
  return html.length;
}

export function scanHtml(html: string, visit?: (tag: HtmlTag) => boolean | void, options: { maxBytes?: number; depth?: boolean } = {}) {
  if (typeof html !== 'string' || Buffer.byteLength(html) > (options.maxBytes ?? htmlMaxBytes)) throw htmlLimit();
  const stack: string[] = [];
  let cursor = 0, tokens = 0;
  while (cursor < html.length) {
    const start = html.indexOf('<', cursor);
    if (start < 0) break;
    cursor = start + 1;
    if (html.startsWith('!--', cursor)) {
      if (++tokens > 50_000) throw htmlLimit();
      const end = html.indexOf('-->', cursor + 3);
      cursor = end < 0 ? html.length : end + 3;
      continue;
    }
    const closing = html[cursor] === '/';
    if (closing) cursor++;
    if (!letter(html.charCodeAt(cursor))) {
      if (html[cursor] === '!' || html[cursor] === '?') {
        const end = html.indexOf('>', cursor + 1);
        cursor = end < 0 ? html.length : end + 1;
      }
      continue;
    }
    if (++tokens > 50_000) throw htmlLimit();
    const nameStart = cursor;
    while (cursor < html.length && !space(html.charCodeAt(cursor)) && html[cursor] !== '/' && html[cursor] !== '>') {
      if (++cursor - nameStart > 128) throw htmlLimit();
    }
    const name = html.slice(nameStart, cursor).replace(/[A-Z]/g, char => char.toLowerCase());
    const attributes = new Map<string, string>();
    let attrCount = 0, complete = false, selfClosing = false;
    while (cursor < html.length) {
      while (space(html.charCodeAt(cursor)) || html[cursor] === '/') cursor++;
      if (html[cursor] === '>') { selfClosing = html[cursor - 1] === '/'; cursor++; complete = true; break; }
      if (cursor >= html.length) break;
      if (++attrCount > 128) throw htmlLimit();
      const attrStart = cursor++;
      while (cursor < html.length && !space(html.charCodeAt(cursor)) && !['/', '>', '='].includes(html[cursor])) {
        if (++cursor - attrStart > 256) throw htmlLimit();
      }
      const attrName = html.slice(attrStart, cursor).replace(/[A-Z]/g, char => char.toLowerCase());
      while (space(html.charCodeAt(cursor))) cursor++;
      let value = '';
      if (html[cursor] === '=') {
        cursor++;
        while (space(html.charCodeAt(cursor))) cursor++;
        const quote = html[cursor] === '"' || html[cursor] === "'" ? html[cursor++] : '';
        const valueStart = cursor;
        if (quote) {
          const end = html.indexOf(quote, cursor);
          cursor = end < 0 ? html.length : end;
          value = html.slice(valueStart, cursor);
          if (end >= 0) cursor++;
        } else {
          while (cursor < html.length && !space(html.charCodeAt(cursor)) && html[cursor] !== '>') cursor++;
          value = html.slice(valueStart, cursor);
        }
      }
      // First attributes win, as in the HTML tokenizer; duplicate floods are
      // still charged against the bound before any DOM parser sees the input.
      if (!attributes.has(attrName)) attributes.set(attrName, value);
    }
    if (!complete) break;
    if (options.depth !== false) {
      if (closing) {
        const index = stack.lastIndexOf(name);
        if (index >= 0) stack.length = index;
      } else if (!voids.has(name) && !(selfClosing && (name === 'svg' || name === 'math' || stack.includes('svg') || stack.includes('math')))) {
        const closure = Object.hasOwn(implicit, name) ? implicit[name] : undefined;
        if (closure) closeImplicit(stack, closure.closes, closure.boundary);
        if (closesParagraph.has(name)) closeImplicit(stack, ['p'], ['table', 'button', 'html']);
        stack.push(name);
        if (stack.length > 150) throw htmlLimit();
      }
    }
    if (visit?.({ name, closing, attributes }) === false) return;
    if (!closing && name === 'plaintext') return;
    if (!closing && raw.has(name)) {
      // A failed search consumes the entire remainder once. Repeated unclosed
      // script/comment starts cannot restart a search at every opening tag.
      cursor = rawEnd(html, name, cursor);
    }
  }
}
