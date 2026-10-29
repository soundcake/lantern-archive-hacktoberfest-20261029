import { createHash } from 'node:crypto';
import { readFile, readdir, lstat, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const digest = value => createHash('sha256').update(value).digest('hex');
export const MODEL = 'Xenova/all-MiniLM-L6-v2';
export const REVISION = '751bff37182d3f1213fa05d7196b954e230abad9';
const DIMENSIONS = 384;
const MAX_BYTES = 2 * 1024 * 1024;

export function passages(text, file, maxLength = 600) {
  const result = [];
  for (const match of text.matchAll(/\S[\s\S]*?(?=\n\s*\n|$)/g)) {
    let start = match.index;
    const stop = start + match[0].trimEnd().length;
    while (start < stop) {
      let end = Math.min(start + maxLength, stop);
      if (end < stop) {
        const boundary = text.lastIndexOf(' ', end);
        if (boundary > start + maxLength / 2) end = boundary;
      }
      while (end > start && /\s/.test(text[end - 1])) end--;
      const quote = text.slice(start, end);
      result.push({ file, start, end, lineStart: text.slice(0, start).split('\n').length,
        lineEnd: text.slice(0, end).split('\n').length, quote });
      start = end;
      while (start < stop && /\s/.test(text[start])) start++;
    }
  }
  return result;
}

export async function collect(directory) {
  const root = await realpath(directory);
  const files = [];
  let bytes = 0;
  async function walk(folder) {
    for (const name of (await readdir(folder)).sort()) {
      if (name.startsWith('.')) continue;
      const full = path.join(folder, name);
      const stat = await lstat(full);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) { await walk(full); continue; }
      if (!stat.isFile() || !/\.(txt|md)$/i.test(name)) continue;
      bytes += stat.size;
      if (bytes > MAX_BYTES || files.length >= 200) throw new Error('Archive exceeds 200 files or 2 MiB. Choose a smaller folder.');
      const buffer = await readFile(full);
      const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      files.push({ file: path.relative(root, full), sha256: digest(buffer), text });
    }
  }
  await walk(root);
  if (!files.length) throw new Error('No UTF-8 .txt or .md files found.');
  return { root, files, bytes };
}

export function validVector(vector) {
  return Array.isArray(vector) && vector.length === DIMENSIONS &&
    vector.every(Number.isFinite) && vector.some(x => x !== 0);
}

export function cosine(a, b) {
  if (!validVector(a) || !validVector(b)) throw new Error('Invalid 384-dimensional embedding. Rebuild the index.');
  let product = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { product += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2; }
  return product / Math.sqrt(aa * bb);
}

export async function buildIndex(directory, embed) {
  const archive = await collect(directory);
  const chunks = [];
  for (const doc of archive.files) {
    for (const item of passages(doc.text, doc.file)) {
      const vector = await embed(item.quote);
      if (!validVector(vector)) throw new Error('Model produced an invalid embedding.');
      chunks.push({ ...item, vector });
    }
  }
  if (!chunks.length) throw new Error('The archive contains no text passages.');
  return { schema: 1, model: MODEL, revision: REVISION, root: archive.root,
    createdAt: new Date().toISOString(), bytes: archive.bytes,
    files: archive.files.map(({ file, sha256 }) => ({ file, sha256 })), chunks };
}

export async function verifiedSources(index) {
  if (index.schema !== 1 || index.model !== MODEL || index.revision !== REVISION ||
      !Array.isArray(index.files) || !Array.isArray(index.chunks)) throw new Error('Unsupported index. Rebuild it.');
  const root = await realpath(index.root);
  const sources = new Map();
  for (const doc of index.files) {
    const full = await realpath(path.resolve(root, doc.file));
    if (full !== root && !full.startsWith(root + path.sep)) throw new Error('Source is outside the archive. Rebuild the index.');
    const data = await readFile(full);
    if (digest(data) !== doc.sha256) throw new Error(`Source changed: ${doc.file}. Rebuild the index before searching.`);
    sources.set(doc.file, data.toString('utf8'));
  }
  for (const chunk of index.chunks) {
    const text = sources.get(chunk.file);
    if (typeof text !== 'string' || !Number.isInteger(chunk.start) || !Number.isInteger(chunk.end) ||
        chunk.start < 0 || chunk.end <= chunk.start || text.slice(chunk.start, chunk.end) !== chunk.quote ||
        text.slice(0, chunk.start).split('\n').length !== chunk.lineStart ||
        text.slice(0, chunk.end).split('\n').length !== chunk.lineEnd || !validVector(chunk.vector)) {
      throw new Error('Index passage does not match its source. Rebuild the index.');
    }
  }
  return sources;
}

export async function search(index, question, embed, { limit = 3, threshold = 0.35 } = {}) {
  if (typeof question !== 'string' || !question.trim() || question.length > 500) throw new Error('Enter a question of 1–500 characters.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 10 || !Number.isFinite(threshold) || threshold < -1 || threshold > 1) throw new Error('Invalid search limits.');
  await verifiedSources(index);
  const vector = await embed(question);
  const ranked = index.chunks.map(({ vector: source, ...chunk }) => ({ ...chunk, similarity: cosine(source, vector) }))
    .filter(row => row.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity || a.file.localeCompare(b.file) || a.start - b.start)
    .slice(0, limit);
  return { question, model: index.model, revision: index.revision, threshold, matches: ranked };
}

export async function saveIndex(file, index) {
  // Exclusive creation preserves an existing archive index until the user chooses another filename.
  await writeFile(file, JSON.stringify(index) + '\n', { flag: 'wx', mode: 0o600 });
}

export function formatResults(result) {
  const lines = ['LANTERN ARCHIVE', '', `Question: ${result.question}`, ''];
  if (!result.matches.length) return [...lines, 'No passage reached the similarity threshold.', 'Try different words, or add more source material.', ''].join('\n');
  for (const [i, match] of result.matches.entries()) {
    lines.push(`${i + 1}. ${match.file}:${match.lineStart}-${match.lineEnd} | similarity ${match.similarity.toFixed(3)}`,
      ...match.quote.split('\n').map(line => `   ${line}`), '');
  }
  lines.push('Exact source passages. Similarity is a ranking score, not a probability.', '');
  return lines.join('\n');
}
