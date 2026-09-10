import { parse, serialize, type DefaultTreeAdapterMap } from 'parse5';
import { normalizeUrl } from './network.js';

export type OfflineTarget = { id: string; url: string; finalUrl: string; title: string; capturedAt: string; later: boolean };
export const offlinePolicy = "sandbox allow-same-origin; default-src 'none'; script-src 'none'; style-src 'unsafe-inline' data:; img-src data:; font-src data:; media-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";
export const offlineMaxBytes = 12 * 1024 * 1024;
type Node = DefaultTreeAdapterMap['node'];
const htmlNamespace = 'http://www.w3.org/1999/xhtml';
const removed = new Set(['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'base', 'meta', 'template', 'noscript', 'portal', 'fencedframe', 'foreignobject', 'animate', 'animatemotion', 'animatetransform', 'set']);
const inert = new Set(['input', 'button', 'select', 'textarea', 'fieldset']);
const fail = () => Object.assign(new Error('Questa copia è troppo complessa per la vista offline. Puoi consultare lo screenshot o scaricare l’HTML.'), { statusCode: 413 });

/** Rebuild the view only; the original archive is never modified. CSP and the
 * iframe independently prohibit scripts. Every navigation is converted to a
 * fragment or an archived version ID handled by the trusted parent application. */
export function offlineDocument(html: string, base: string, targets: OfflineTarget[]) {
  if (Buffer.byteLength(html) > offlineMaxBytes) throw fail();
  let tokens = 0;
  for (const _ of html.matchAll(/<[a-z!/?]/gi)) if (++tokens > 50000) throw fail();
  const document = parse(html, { scriptingEnabled: false });
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
    const href = node.attrs.find(attr => attr.name === 'href')?.value;
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
      if (destination && ['http:', 'https:'].includes(destination.protocol) && !destination.username && !destination.password && key(destination.href) === key(base) && destination.hash) {
        node.attrs.push({ name: 'href', value: destination.hash });
      } else {
        const index = destination ? destinations.get(key(destination.href)) : undefined;
        node.attrs.push({ name: 'href', value: '#' }, { name: 'data-archive-target', value: index === undefined ? 'missing' : targets[index].id });
        if (index !== undefined && destination?.hash) node.attrs.push({ name: 'data-archive-fragment', value: destination.hash.slice(1, 4096) });
        node.attrs = node.attrs.filter(attr => attr.name !== 'title');
        node.attrs.push({ name: 'title', value: index === undefined ? 'Nessuna copia disponibile nell’archivio' : 'Apri la copia archiviata' });
      }
    }
  }
  return serialize(document);
}
