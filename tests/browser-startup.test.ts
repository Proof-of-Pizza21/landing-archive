import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserStartupFailure, logBrowserStartupFailure } from '../src/browser-startup.js';
import { capturePage, closeBrowser } from '../src/capture.js';

test('startup diagnostics classify sandbox failures without exposing launch arguments or secrets', () => {
  const raw = new Error('browserType.launch: closed\n--user-data-dir=/tmp/private-profile --password=private-value\nhttps://example.test/?token=private-value\nFATAL:sandbox/linux/services/credentials.cc:131 Permission denied (13)');
  const error = browserStartupFailure(raw);
  assert.equal(error.code, 'BROWSER_SANDBOX_DENIED');
  assert.match(error.message, /isolamento del browser/);
  assert.equal(error.cause, raw);
  const entries: string[] = [];
  const logger = mock.method(console, 'error', value => entries.push(String(value)));
  try { logBrowserStartupFailure(error); } finally { logger.mock.restore(); }
  const diagnostic = JSON.parse(entries[0]);
  assert.equal(diagnostic.code, error.code);
  assert.equal(diagnostic.reason, 'permission_denied');
  assert.equal(diagnostic.component, 'chromium_sandbox_credentials');
  assert.doesNotMatch(error.message + entries.join(''), /private-value|private-profile|example\.test|user-data-dir/);
  for (const [message, code] of [
    ['No usable sandbox!', 'BROWSER_SANDBOX_UNAVAILABLE'],
    ['Executable doesn\'t exist at /missing/chromium', 'BROWSER_INSTALLATION_ERROR'],
    ['error while loading shared libraries: libexample.so', 'BROWSER_INSTALLATION_ERROR'],
    ['unrecognized private startup details', 'BROWSER_LAUNCH_FAILED'],
  ]) assert.equal(browserStartupFailure(new Error(message)).code, code);
  const timeout = new Error('Timeout 30000ms exceeded'); timeout.name = 'TimeoutError';
  assert.equal(browserStartupFailure(timeout).code, 'BROWSER_LAUNCH_TIMEOUT');
});

test('failed browser launches retain the sandbox, emit diagnostics and can be retried', async () => {
  await closeBrowser();
  const entries: string[] = [];
  const logger = mock.method(console, 'error', value => entries.push(String(value)));
  const launch = mock.method(chromium, 'launch', async options => {
    assert.equal(options?.chromiumSandbox, true);
    assert.equal(options?.args?.includes('--no-sandbox'), false);
    throw new Error('FATAL:sandbox/linux/services/credentials.cc:131 Permission denied (13)');
  });
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      await assert.rejects(capturePage({ url: 'https://1.1.1.1/' }), (error: any) => error.code === 'BROWSER_SANDBOX_DENIED');
    }
    assert.equal(launch.mock.callCount(), 2);
    assert.equal(entries.length, 2);
    assert.ok(entries.every(entry => JSON.parse(entry).event === 'browser_startup_failed'));
  } finally { launch.mock.restore(); logger.mock.restore(); await closeBrowser(); }
});
