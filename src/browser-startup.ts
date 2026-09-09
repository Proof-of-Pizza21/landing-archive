import { release } from 'node:os';
import { CaptureError } from './network.js';

/** Fixed diagnostic vocabulary: never copy launch arguments, URLs or paths. */
export function browserStartupFailure(error: unknown): CaptureError {
  const raw = error instanceof Error ? error.message.slice(0, 65536) : '';
  const sandbox = /sandbox\/linux\/|No usable sandbox|Failed to move to new namespace|Failed to unshare|userns_create/i.test(raw);
  const denied = /Permission denied|Operation not permitted|userns_create/i.test(raw);
  let code = 'BROWSER_LAUNCH_FAILED';
  let message = 'Il browser non è riuscito ad avviarsi. Consulta la diagnostica del motore in Umbrel.';
  if (sandbox && denied) {
    code = 'BROWSER_SANDBOX_DENIED';
    message = 'Il sistema ha negato un permesso necessario all’isolamento del browser. L’acquisizione non è iniziata. Verifica che Landing Archive sia aggiornato e riavvia l’app da Umbrel per caricare il profilo di sicurezza del motore.';
  } else if (/No usable sandbox/i.test(raw)) {
    code = 'BROWSER_SANDBOX_UNAVAILABLE';
    message = 'L’isolamento del browser non è disponibile su questo sistema. L’acquisizione non è iniziata: occorre verificare la configurazione di sicurezza del motore.';
  } else if (/Executable doesn't exist|spawn .* ENOENT|EACCES|error while loading shared libraries/i.test(raw)) {
    code = 'BROWSER_INSTALLATION_ERROR';
    message = 'Il browser o una sua libreria non sono disponibili o eseguibili. Verifica l’aggiornamento dell’app e riavviala da Umbrel.';
  } else if (error instanceof Error && error.name === 'TimeoutError') {
    code = 'BROWSER_LAUNCH_TIMEOUT';
    message = 'Il browser non si è avviato entro il tempo previsto. Controlla le risorse disponibili e riavvia l’app da Umbrel.';
  }
  const failure = new CaptureError(message, code);
  failure.cause = error;
  return failure;
}

export function logBrowserStartupFailure(error: CaptureError): void {
  const raw = error.cause instanceof Error ? error.cause.message.slice(0, 65536) : '';
  console.error(JSON.stringify({
    event: 'browser_startup_failed', code: error.code,
    reason: /Permission denied/.test(raw) ? 'permission_denied' : /Operation not permitted/.test(raw) ? 'operation_not_permitted' : 'launch_failed',
    component: /sandbox\/linux\/services\/credentials\.cc/.test(raw) ? 'chromium_sandbox_credentials' : 'chromium_startup',
    platform: process.platform, architecture: process.arch, kernel: release(),
  }));
}
