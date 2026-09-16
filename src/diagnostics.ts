import { mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { dataDir } from './config.js';
import { checkSpace } from './storage.js';
import { captureLimits, validateScreenshot } from './capture-limits.js';
import type { CaptureResult } from './types.js';
import type { Evidence } from './detection-policy.js';

const root = join(dataDir, 'diagnostics');
const identifier = /^[a-zA-Z0-9_-]{1,80}$/;
const ownedName = /^([a-zA-Z0-9_-]{1,80})\.([a-zA-Z0-9_-]{1,80})\.(json|png|tmp)$/;
export const diagnosticLimits = { maxBytes: 1024 ** 3, retentionHours: 48, maxSamples: 512, perPage: 3 };
type Sample = { id: string; pageId: string; createdAt: string; expiresAt: string; bytes: number; reason: string };
type DiagnosticFile = { name: string; bytes: number; modifiedAt: number; symbolic: boolean };
const base = (page: string, sample: string) => {
  if (!identifier.test(page) || !identifier.test(sample)) throw new Error('Campione non valido.');
  return join(root, `${page}.${sample}`);
};
function ready() {
  try {
    mkdirSync(root, { recursive: true, mode: 0o700 });
    const stat = lstatSync(root); return stat.isDirectory() && !stat.isSymbolicLink();
  } catch { return false; }
}
function files(): DiagnosticFile[] {
  if (!ready()) return [];
  try {
    return readdirSync(root).filter(name => ownedName.test(name)).flatMap(name => {
      try { const stat = lstatSync(join(root, name)); return stat.isFile() || stat.isSymbolicLink() ? [{ name, bytes: stat.size, modifiedAt: stat.mtimeMs, symbolic: stat.isSymbolicLink() }] : []; }
      catch { return []; }
    });
  } catch { return []; }
}
const removeFile = (name: string) => { if (ownedName.test(name)) try { unlinkSync(join(root, name)); } catch { /* A denied or concurrent deletion never blocks a check. */ } };
const remove = (sample: Sample) => { for (const suffix of ['.json', '.png']) removeFile(`${sample.pageId}.${sample.id}${suffix}`); };
function samples(inventory = files()) {
  const result: Sample[] = [];
  for (const file of inventory) {
    if (!file.name.endsWith('.json') || file.symbolic || file.bytes > 32768) continue;
    try {
      const value = JSON.parse(readFileSync(join(root, file.name), 'utf8')) as Sample;
      if (!value || typeof value !== 'object' || file.name !== `${value.pageId}.${value.id}.json` || !identifier.test(value.pageId) || !identifier.test(value.id) || typeof value.reason !== 'string' || value.reason.length > 2000 || typeof value.createdAt !== 'string' || value.createdAt.length !== 24 || typeof value.expiresAt !== 'string' || value.expiresAt.length !== 24) continue;
      const created = Date.parse(value.createdAt), expiry = Date.parse(value.expiresAt);
      if (!Number.isFinite(created) || !Number.isFinite(expiry) || new Date(created).toISOString() !== value.createdAt || new Date(expiry).toISOString() !== value.expiresAt || expiry <= created || created > Date.now() + 60000) continue;
      const png = inventory.find(f => f.name === `${value.pageId}.${value.id}.png`);
      if (!png || png.symbolic || png.bytes > captureLimits.screenshotBytes) continue;
      result.push({ id: value.id, pageId: value.pageId, createdAt: value.createdAt, expiresAt: new Date(Math.min(expiry, created + diagnosticLimits.retentionHours * 3600000)).toISOString(), bytes: file.bytes + png.bytes, reason: value.reason });
    } catch { /* Malformed or interrupted pairs are never exposed as samples. */ }
  }
  return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
export function pruneDiagnostics(at = Date.now()) {
  const inventory = files(); let retainedBytes = 0;
  const byPage = new Map<string, number>(), keep: Sample[] = [];
  for (const sample of samples(inventory).reverse()) {
    const count = byPage.get(sample.pageId) || 0;
    if (Date.parse(sample.expiresAt) <= at || retainedBytes + sample.bytes > diagnosticLimits.maxBytes || count >= diagnosticLimits.perPage || keep.length >= diagnosticLimits.maxSamples) remove(sample);
    else { retainedBytes += sample.bytes; byPage.set(sample.pageId, count + 1); keep.push(sample); }
  }
  const keptNames = new Set(keep.flatMap(sample => [`${sample.pageId}.${sample.id}.json`, `${sample.pageId}.${sample.id}.png`]));
  // Account for incomplete pairs too; remove them after an atomic-write grace period.
  for (const file of inventory) if (!keptNames.has(file.name) && (file.symbolic || at - file.modifiedAt > 60000)) removeFile(file.name);
  const remaining = files();
  return { bytes: remaining.reduce((sum, file) => sum + file.bytes, 0), count: samples(remaining).filter(sample => Date.parse(sample.expiresAt) > at).length, maxBytes: diagnosticLimits.maxBytes, retentionHours: diagnosticLimits.retentionHours };
}
export const diagnosticsStatus = () => pruneDiagnostics();
export function listPageDiagnostics(pageId: string) {
  if (!identifier.test(pageId)) return [];
  return samples().filter(sample => sample.pageId === pageId && Date.parse(sample.expiresAt) > Date.now()).reverse()
    .map(sample => ({ ...sample, screenshotUrl: `/api/pages/${pageId}/diagnostics/${sample.id}/screenshot` }));
}
export function removePageDiagnostics(pageId: string) {
  if (!identifier.test(pageId)) return;
  for (const file of files()) if (ownedName.exec(file.name)?.[1] === pageId) removeFile(file.name);
}
export function readDiagnostic(pageId: string, sampleId: string) {
  try {
    if (!identifier.test(sampleId)) throw new Error('Invalid identifier');
    const sample = listPageDiagnostics(pageId).find(value => value.id === sampleId);
    if (!sample) throw new Error('Expired');
    const file = base(pageId, sampleId) + '.png', stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > captureLimits.screenshotBytes) throw new Error('Invalid file');
    const image = readFileSync(file); validateScreenshot(image); return image;
  } catch { throw Object.assign(new Error('Il campione temporaneo è scaduto o non è disponibile.'), { statusCode: 404 }); }
}
export function recordDiagnostic(pageId: string, result: CaptureResult, evidence: Evidence) {
  let samplePath: string | undefined;
  try {
    if (!identifier.test(pageId) || !ready()) return undefined;
    validateScreenshot(result.screenshot); pruneDiagnostics();
    const previous = samples().filter(sample => sample.pageId === pageId);
    const reason = (result.quality?.reasons.join(' ') || evidence.signals?.join(' ') || 'Differenza da verificare prima di creare una versione.').slice(0, 2000);
    const last = previous[previous.length - 1];
    if (last && last.reason === reason && readDiagnostic(pageId, last.id).equals(result.screenshot)) return last.id;
    const sample: Sample = { id: randomUUID(), pageId, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + diagnosticLimits.retentionHours * 3600000).toISOString(), bytes: result.screenshot.length, reason };
    const metadata = JSON.stringify(sample), required = result.screenshot.length + Buffer.byteLength(metadata);
    if (required > diagnosticLimits.maxBytes) return undefined;
    // Make room before writing, counting malformed/orphan files as actual space.
    let occupied = diagnosticsStatus().bytes;
    for (const old of samples()) {
      if (occupied + required <= diagnosticLimits.maxBytes) break;
      remove(old); occupied = files().reduce((sum, file) => sum + file.bytes, 0);
    }
    if (occupied + required > diagnosticLimits.maxBytes) return undefined;
    checkSpace(required + 32768);
    samplePath = base(pageId, sample.id);
    writeFileSync(samplePath + '.tmp', result.screenshot, { flag: 'wx', mode: 0o600 });
    renameSync(samplePath + '.tmp', samplePath + '.png');
    writeFileSync(samplePath + '.tmp', metadata, { flag: 'wx', mode: 0o600 });
    renameSync(samplePath + '.tmp', samplePath + '.json');
    pruneDiagnostics();
    return listPageDiagnostics(pageId).some(value => value.id === sample.id) ? sample.id : undefined;
  } catch {
    if (samplePath) for (const suffix of ['.tmp','.png','.json']) try { unlinkSync(samplePath + suffix); } catch {}
    return undefined;
  } // Diagnostic retention never prevents recording the permanent check.
}
