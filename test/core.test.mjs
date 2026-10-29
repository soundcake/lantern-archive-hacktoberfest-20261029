import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, symlink, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { passages, buildIndex, search, saveIndex, formatResults } from '../src/archive.mjs';

const unit = axis => Array.from({ length: 384 }, (_, i) => Number(i === axis));
const embed = async text => unit(text.includes('clock') ? 0 : 1);
async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'lantern-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(path.join(dir, 'letter.txt'), 'The clock was repaired.\nBy Elsie.\n\nWe planted flowers.\n');
  return dir;
}
test('quotes and line references reproduce the exact original text', () => {
  const rows = passages('First line.\nSecond line.\n\nThird line.\n', 'note.txt');
  assert.deepEqual(rows.map(r => [r.quote, r.lineStart, r.lineEnd]), [
    ['First line.\nSecond line.', 1, 2], ['Third line.', 4, 4]]);
});
test('long paragraphs are completely covered without changing source characters', () => {
  const text = 'A memory with several words. '.repeat(60);
  const rows = passages(text, 'long.txt');
  assert.ok(rows.length > 1);
  assert.equal(rows.map(r => r.quote).join(' '), text.trim());
  for (const row of rows) assert.equal(text.slice(row.start, row.end), row.quote);
});
test('search returns source evidence and excludes unrelated vectors', async t => {
  const dir = await fixture(t), index = await buildIndex(dir, embed);
  const result = await search(index, 'clock', embed, { threshold: 0.5 });
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].quote, 'The clock was repaired.\nBy Elsie.');
  assert.match(formatResults(result), /letter.txt:1-2/);
});
test('changed sources are rejected before inference', async t => {
  const dir = await fixture(t), index = await buildIndex(dir, embed);
  await writeFile(path.join(dir, 'letter.txt'), 'A different memory.');
  let called = false;
  await assert.rejects(search(index, 'clock', async () => { called = true; return unit(0); }), /Source changed/);
  assert.equal(called, false);
});
test('incorrect cached quotes are rejected', async t => {
  const dir = await fixture(t), index = await buildIndex(dir, embed);
  index.chunks[0].quote = 'An invented memory.';
  await assert.rejects(search(index, 'clock', embed), /does not match/);
});
test('no match is an explicit result rather than an invented answer', async t => {
  const dir = await fixture(t), index = await buildIndex(dir, embed);
  const result = await search(index, 'unknown', async () => unit(3));
  assert.equal(result.matches.length, 0);
  assert.match(formatResults(result), /No passage reached/);
});
test('source collection ignores symlinks and non-text files', async t => {
  const dir = await fixture(t);
  await symlink(path.join(dir, 'letter.txt'), path.join(dir, 'shortcut.txt'));
  await writeFile(path.join(dir, 'photo.bin'), Buffer.from([0xff, 0x00]));
  assert.equal((await buildIndex(dir, embed)).files.length, 1);
});
test('saving preserves an existing index', async t => {
  const dir = await fixture(t), file = path.join(dir, 'index.lantern.json');
  await saveIndex(file, { original: true });
  await assert.rejects(saveIndex(file, { changed: true }), { code: 'EEXIST' });
  assert.equal(JSON.parse(await readFile(file, 'utf8')).original, true);
});
test('empty questions and incompatible model revisions are rejected', async t => {
  const dir = await fixture(t), index = await buildIndex(dir, embed);
  await assert.rejects(search(index, '', embed), /question/);
  index.revision = 'other-model';
  await assert.rejects(search(index, 'clock', embed), /Unsupported index/);
});
