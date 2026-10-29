import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { digest } from '../src/archive.mjs';
import { MODEL_ROOT } from '../src/model.mjs';

const source = JSON.parse(await readFile(new URL('../model-source.json', import.meta.url)));
const manifest = { repository: source.repository, revision: source.revision, files: [] };
for (const name of source.files) {
  console.log(`Downloading ${name}`);
  const response = await fetch(`https://huggingface.co/${source.repository}/resolve/${source.revision}/${name}`, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Model download failed: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 100 * 1024 * 1024) throw new Error('Unexpected model file size.');
  const file = path.join(MODEL_ROOT, source.repository, name);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buffer);
  manifest.files.push({ name, bytes: buffer.length, sha256: digest(buffer) });
}
await writeFile(path.join(MODEL_ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Model installed. Indexing and searching now require no network.');
