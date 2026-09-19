import { parse, serialize, defaultTreeAdapter, html as htmlTypes, type DefaultTreeAdapterMap } from 'parse5';
import { normalizeUrl } from './network.js';
import { htmlLimit, htmlMaxBytes, htmlMaxOutputBytes, scanHtml } from './html-bounds.js';
import { randomBytes } from 'node:crypto';

export type OfflineTarget = { id: string; url: string; finalUrl: string; title: string; capturedAt: string; later: boolean };
export const offlinePolicy = "sandbox allow-same-origin; default-src 'none'; script-src 'none'; style-src 'unsafe-inline' data:; img-src data:; font-src data:; media-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";
export const offlineMaxBytes = htmlMaxBytes;
// sandbox and frame-ancestors are response-only directives. The embedded policy
// travels with downloaded files; the HTTP/iframe sandbox adds further isolation.
export const archivePolicy = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline' data:; img-src data:; font-src data:; media-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
type Node = DefaultTreeAdapterMap['node'];
const htmlNamespace = 'http://www.w3.org/1999/xhtml';
const removed = new Set(['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'base', 'meta', 'template', 'noscript', 'portal', 'fencedframe', 'foreignobject', 'animate', 'animatemotion', 'animatetransform', 'set']);
const inert = new Set(['input', 'button', 'select', 'textarea', 'fieldset']);
const fail = htmlLimit;

function compactEmbeddedData(source: string) {
  // HTML tokenizers may allocate a per-character string for a large attribute.
  // Base64 cannot contain quotes, brackets or HTML entities: replacing only its
  // payload leaves HTML/CSS syntax and URL policy decisions unchanged. Restore
  // the bytes after sanitation in a single pass, including data inside CSS.
  const prefix = `LANDINGARCHIVE${randomBytes(16).toString('hex')}`;
  const payloads: string[] = [];
  const parts: string[] = [];
  const header = /data:[a-z0-9.+-]{1,80}\/[a-z0-9.+-]{1,80}(?:;charset=[a-z0-9_-]{1,40})?;base64,/gi;
  let copied = 0, match: RegExpExecArray | null;
  while ((match = header.exec(source))) {
    const start = header.lastIndex;
    let end = start;
    // Avoid a large regex repetition: some JS engines put each match on their
    // regex stack even though this alphabet needs only a forward byte scan.
    while (end < source.length) {
      const c = source.charCodeAt(end);
      if (!((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 43 || c === 47 || c === 61)) break;
      end++;
    }
    if (end - start >= 1024) {
      const index = payloads.push(source.slice(start, end)) - 1;
      parts.push(source.slice(copied, start), prefix + index + 'END'); copied = end;
    }
    header.lastIndex = end;
  }
  parts.push(source.slice(copied));
  const html = parts.join('');
  return { html, restore: (value: string) => value.replace(new RegExp(prefix + '(\\d+)END', 'g'), (marker, index: string) => payloads[Number(index)] ?? marker) };
}

/** Rebuild the view only; the original archive is never modified. CSP and the
 * iframe independently prohibit scripts. Every navigation is converted to a
 * fragment or an archived version ID handled by the trusted parent application. */
export function offlineDocument(html: string, base: string, targets: OfflineTarget[], localFiles?: Map<string, string>, archive = false) {
  scanHtml(html);
  const embedded = compactEmbeddedData(html);
  const document = parse(embedded.html, { scriptingEnabled: false });
  const destinations = new Map<string, number>();
  const key = (url: string) => { try { return normalizeUrl(url); } catch { return ''; } };
  targets.forEach((target, index) => { if (!destinations.has(key(target.finalUrl))) destinations.set(key(target.finalUrl), index); });
  targets.forEach((target, index) => destinations.set(key(target.url), index));
  const stack: { node: Node; depth: number }[] = [{ node: document, depth: 0 }];
  let count = 0;
  while (stack.length) {
    const { node, depth } = stack.pop()!;
    if (++count > 50000 || depth > 150) throw fail();
    if ('childNodes' in node) {
      node.childNodes = node.childNodes.filter(child => !('tagName' in child && removed.has(child.tagName.toLowerCase())) && child.nodeName !== '#comment');
      for (const child of node.childNodes) stack.push({ node: child, depth: depth + 1 });
    }
    if (!('tagName' in node)) continue;
    const tag = node.tagName.toLowerCase();
    const href = node.attrs.find(attr => attr.name === 'data-archive-href')?.value ?? node.attrs.find(attr => attr.name === 'href')?.value;
    node.attrs = node.attrs.filter(attr => {
      const name = attr.name.toLowerCase();
      if (/^on|^data-archive-/.test(name) || ['nonce', 'integrity', 'target', 'download', 'ping', 'srcdoc', 'action', 'formaction', 'method', 'formmethod', 'formtarget', 'autofocus', 'autoplay', 'manifest', 'is', 'srcset', 'imagesrcset', 'background', 'codebase', 'archive', 'profile'].includes(name)) return false;
      if (name === 'href') return tag !== 'a' && tag !== 'area' && (attr.value.startsWith('#') || (tag === 'link' && /^data:text\/css[;,]/i.test(attr.value)) || (tag === 'image' && /^data:image\//i.test(attr.value)));
      if (['src', 'poster'].includes(name)) return ['img', 'image', 'source', 'video'].includes(tag) && /^data:image\//i.test(attr.value);
      return true;
    });
    if (inert.has(tag) && node.namespaceURI === htmlNamespace) node.attrs.push({ name: 'disabled', value: '' });
    if (tag === 'link') node.attrs = node.attrs.filter(attr => attr.name !== 'rel').concat({ name: 'rel', value: 'stylesheet' });
    if ((tag === 'a' || tag === 'area') && href !== undefined) {
      let destination: URL | undefined;
      try { destination = new URL(href, base); } catch { /* Invalid links remain inert. */ }
      if (archive) {
        // Serialized capture metadata is treated only as an untrusted URL on
        // every later replay. No live destination is made navigable here.
        const safe = destination && ['http:', 'https:'].includes(destination.protocol) && !destination.username && !destination.password && destination.href.length <= 4096;
        node.attrs.push({ name: 'href', value: safe && destination && key(destination.href) === key(base) && destination.hash ? destination.hash : '#' });
        if (safe && destination) node.attrs.push({ name: 'data-archive-href', value: destination.href });
      } else if (destination && ['http:', 'https:'].includes(destination.protocol) && !destination.username && !destination.password && key(destination.href) === key(base) && destination.hash) {
        node.attrs.push({ name: 'href', value: destination.hash });
      } else {
        const index = destination ? destinations.get(key(destination.href)) : undefined;
        const local = index === undefined ? undefined : localFiles?.get(targets[index].id);
        node.attrs.push({ name: 'href', value: local && /^[0-9]+\.html$/.test(local) ? local + (destination?.hash || '') : '#' }, { name: 'data-archive-target', value: index === undefined ? 'missing' : targets[index].id });
        if (index !== undefined && destination?.hash) node.attrs.push({ name: 'data-archive-fragment', value: destination.hash.slice(1, 4096) });
        node.attrs = node.attrs.filter(attr => attr.name !== 'title');
        node.attrs.push({ name: 'title', value: index === undefined ? 'No copy available in the archive' : 'Open the archived copy' });
      }
    }
  }
  const root = document.childNodes.find(node => 'tagName' in node && node.tagName === 'html');
  const head = root && 'childNodes' in root ? root.childNodes.find(node => 'tagName' in node && node.tagName === 'head') : undefined;
  if (!head || !('childNodes' in head)) throw fail();
  const policy = defaultTreeAdapter.createElement('meta', htmlTypes.NS.HTML, [
    { name: 'http-equiv', value: 'Content-Security-Policy' }, { name: 'content', value: archivePolicy },
  ]);
  const charset = defaultTreeAdapter.createElement('meta', htmlTypes.NS.HTML, [{ name: 'charset', value: 'utf-8' }]);
  policy.parentNode = head; charset.parentNode = head;
  head.childNodes.unshift(charset, policy);
  const result = embedded.restore(serialize(document));
  if (Buffer.byteLength(result) > htmlMaxOutputBytes) throw fail();
  return result;
}

/** Synchronous core for the disposable process and focused unit tests only.
 * App routes, export and capture must call the isolated async wrapper. */
export function sanitizeArchiveDocumentCore(html: string, base: string) {
  return offlineDocument(html, base, [], undefined, true);
}
