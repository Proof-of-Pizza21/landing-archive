import { t, message as systemMessage } from './i18n';
import { useEffect, useState, type ComponentPropsWithRef, type MouseEvent } from 'react';
import { resourceUrl } from './client';

function useResource(path?: string) {
  const [value, setValue] = useState<{ path: string; url?: string; error?: string }>();
  useEffect(() => {
    let current = true;
    if (path) void resourceUrl(path).then(url => { if (current) setValue({ path, url }); }, error => { if (current) setValue({ path, error: error.message }); });
    return () => { current = false; };
  }, [path]);
  return value?.path === path ? value : undefined;
}

export function SecureImage({ src, ...props }: ComponentPropsWithRef<'img'>) {
  const resource = useResource(src);
  if (resource?.error) return <span role="alert">{systemMessage(resource.error)}</span>;
  return resource?.url ? <img {...props} src={resource.url} referrerPolicy="no-referrer" /> : <span role="status">{t("Loading image…")}</span>;
}

export function SecureFrame({ src, ...props }: ComponentPropsWithRef<'iframe'>) {
  const resource = useResource(src);
  if (resource?.error) return <div className="notice error" role="alert">{systemMessage(resource.error)}</div>;
  return resource?.url ? <iframe {...props} src={resource.url} referrerPolicy="no-referrer" /> : null;
}

/** Generate a fresh, single-resource ticket only when needed. Let the browser
 * stream large downloads to disk, without copying the backup into JS memory. */
export function SecureLink({ href, children, onClick, onAuxClick, ...props }: ComponentPropsWithRef<'a'>) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function open(event: MouseEvent<HTMLAnchorElement>) {
    if (event.type === 'auxclick' && event.button !== 1) return;
    (event.type === 'auxclick' ? onAuxClick : onClick)?.(event);
    if (event.defaultPrevented) return;
    event.preventDefault();
    if (busy || !href) return;
    setBusy(true); setError('');
    const newWindow = !props.download && (props.target === '_blank' || event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1);
    const popup = newWindow ? window.open('about:blank', '_blank') : null;
    if (popup) popup.opener = null;
    try {
      const url = await resourceUrl(href);
      if (popup) popup.location.replace(url);
      else {
        const link = document.createElement('a');
        link.href = url; link.rel = 'noreferrer noopener'; link.referrerPolicy = 'no-referrer';
        if (props.download !== undefined && props.download !== false) link.download = typeof props.download === 'string' ? props.download : '';
        if (newWindow) link.target = '_blank';
        document.body.append(link); link.click(); link.remove();
      }
    } catch (failure) { popup?.close(); setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  return <><a {...props} href="#" aria-disabled={busy || undefined} onClick={open} onAuxClick={open}>{children}</a>{error && <span className="notice error" role="alert">{systemMessage(error)}</span>}</>;
}
