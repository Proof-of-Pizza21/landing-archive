import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpolate, localize, supportedLanguage } from '../src/localization.js';

test('English is the default and only explicit supported preferences select Italian', () => {
  for (const preference of [undefined, null, '', 'en', 'en-US', 'it-IT', 'IT', 'fr', 1, {}, []]) {
    assert.equal(supportedLanguage(preference), 'en');
  }
  assert.equal(supportedLanguage('it'), 'it');
});

test('interpolation preserves literal dollar signs, braces and missing parameters', () => {
  const params = { name: 'Offer $& $$ $1 {count}', count: 5, empty: '' };
  assert.equal(interpolate('{name}: {count}; {missing}; {empty}', params), 'Offer $& $$ $1 {count}: 5; {missing}; ');
  assert.equal(interpolate('{count} / {count}', params), '5 / 5');
  assert.equal(interpolate('{inherited}', Object.create({ inherited: 'not an own property' })), '{inherited}');
  assert.deepEqual(params, { name: 'Offer $& $$ $1 {count}', count: 5, empty: '' });
});

test('historical application messages translate in either direction without rewriting their source', () => {
  const history = Object.freeze([
    Object.freeze({ stored: 'Nessuna modifica significativa', english: 'No significant changes' }),
    Object.freeze({ stored: 'Prima versione archiviata', english: 'First version archived' }),
    Object.freeze({ stored: '5 immagini visibili non sono state caricate completamente.', english: '5 visible images did not load completely.' }),
    Object.freeze({ stored: 'Il sito ha risposto HTTP 404.', english: 'The site returned HTTP 404.' }),
    Object.freeze({ stored: 'Destinazione aggiornata: https://example.com/offerta?label=$&test={p0}', english: 'Destination updated: https://example.com/offerta?label=$&test={p0}' }),
  ]);
  const original = JSON.stringify(history);
  for (const entry of history) {
    assert.equal(localize(entry.stored, 'en'), entry.english);
    assert.equal(localize(entry.english, 'it'), entry.stored);
    assert.equal(localize(entry.stored, 'it'), entry.stored);
    assert.equal(localize(entry.english, 'en'), entry.english);
  }
  assert.equal(JSON.stringify(history), original);
});

test('nested retries, capture stages and quality diagnostics retain their meaning', () => {
  const italian = 'Il sito ha risposto con errore 404. Nuovo tentativo programmato (2/3).';
  const english = 'The site returned error 404. New attempt scheduled (2/3).';
  assert.equal(localize(italian, 'en'), english);
  assert.equal(localize(english, 'it'), italian);
  const qualityIt = 'Caricamento da verificare: 5 immagini visibili non sono state caricate completamente. Nessuna nuova versione confermata.';
  const qualityEn = 'Load needs review: 5 visible images did not load completely. No new version confirmed.';
  assert.equal(localize(qualityIt, 'en'), qualityEn);
  assert.equal(localize(qualityEn, 'it'), qualityIt);
  assert.equal(localize(` ${italian}\n`, 'en'), ` ${english}\n`);
  const stageIt = 'Acquisizione non completata durante: avvio del browser. Il browser non è riuscito ad avviarsi. Consulta la diagnostica del motore in Umbrel.';
  const stageEn = 'Capture failed during: browser startup. The browser could not start. Check the engine diagnostics in Umbrel.';
  assert.equal(localize(stageIt, 'en'), stageEn);
  assert.equal(localize(stageEn, 'it'), stageIt);
});

test('unknown diagnostics and excessive input stay untouched within bounded localization work', { timeout: 1000 }, () => {
  const unknown = 'Custom diagnostic: campaign {p0}, price $& and an unknown provider response.';
  const oversized = 'Nessuna modifica significativa'.repeat(700);
  const punctuation = 'Unknown segment. '.repeat(900);
  const nested = 'Caricamento da verificare: '.repeat(64) + 'Nessuna modifica significativa' + ' Nessuna nuova versione confermata.'.repeat(64);
  for (const language of ['en', 'it'] as const) {
    assert.equal(localize(unknown, language), unknown);
    assert.equal(localize(oversized, language), oversized);
    assert.equal(localize(punctuation, language), punctuation);
    assert.equal(localize('Nessuna modifica significativa', language, 4), 'Nessuna modifica significativa');
    assert.ok(localize(nested, language).length <= nested.length * 2);
  }
});
