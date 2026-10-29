import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { buildIndex, search, formatResults } from '../src/archive.mjs';
import { createEmbedder } from '../src/model.mjs';

const output = new URL('../demo/generated/', import.meta.url);
await mkdir(output, { recursive: true });
const fetchBefore = globalThis.fetch;
let attemptedRequests = 0;
globalThis.fetch = async () => { attemptedRequests++; throw new Error('Network disabled for this demonstration'); };
const start = performance.now();
const embed = await createEmbedder();
try {
  const ready = performance.now();
  const index = await buildIndex(fileURLToPath(new URL('../examples/letters/', import.meta.url)), embed);
  const indexed = performance.now(), results = [];
  for (const question of ['What lit the way during the power outage?', 'Who fixed the broken timepiece?', 'What gave the homemade loaf its citrus fragrance?']) {
    const at = performance.now(), result = await search(index, question, embed);
    results.push({ ...result, elapsedMs: performance.now() - at });
    console.log(formatResults(result));
  }
  const report = { recordedAt: new Date().toISOString(), platform: process.platform, architecture: process.arch,
    node: process.version, model: index.model, revision: index.revision, modelLoadMs: ready - start,
    indexMs: indexed - ready, files: index.files.length, passages: index.chunks.length,
    attemptedRequests, maxRSSKiB: process.resourceUsage().maxRSS, results };
  await writeFile(new URL('results.json', output), JSON.stringify(report, null, 2) + '\n');
  await writeFile(new URL('transcript.txt', output), results.map(formatResults).join('\n'));
  console.log(`Offline demonstration complete: ${attemptedRequests} fetch attempts.`);
} finally { await embed.dispose(); globalThis.fetch = fetchBefore; }
