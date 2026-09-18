import { offlineDocument, sanitizeArchiveDocumentCore, type OfflineTarget } from './offline.js';
import { htmlMaxOutputBytes } from './html-bounds.js';

process.once('message', (input: { mode: 'offline' | 'archive'; html: string; base: string; targets: OfflineTarget[]; localFiles?: Map<string, string> }) => {
  try {
    const html = input.mode === 'archive' ? sanitizeArchiveDocumentCore(input.html, input.base) : offlineDocument(input.html, input.base, input.targets, input.localFiles);
    if (Buffer.byteLength(html) > htmlMaxOutputBytes) throw new Error('limit');
    process.send?.({ html }, () => process.exit(0));
  } catch { process.send?.({ error: true }, () => process.exit(1)); }
});
