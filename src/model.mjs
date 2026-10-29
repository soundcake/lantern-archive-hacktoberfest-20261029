import { fileURLToPath } from 'node:url';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { digest, MODEL, REVISION } from './archive.mjs';

export const MODEL_ROOT = fileURLToPath(new URL('../.models/', import.meta.url));

export async function createEmbedder() {
  let manifest;
  try { manifest = JSON.parse(await readFile(path.join(MODEL_ROOT, 'manifest.json'), 'utf8')); }
  catch { throw new Error('Model is not installed. While online, run npm run setup:model first.'); }
  if (manifest.repository !== MODEL || manifest.revision !== REVISION || manifest.files.length !== 5) throw new Error('Model manifest mismatch. Run npm run setup:model.');
  for (const file of manifest.files) {
    const location = path.join(MODEL_ROOT, MODEL, file.name);
    if ((await stat(location)).size !== file.bytes || digest(await readFile(location)) !== file.sha256) throw new Error('Model file verification failed. Run npm run setup:model.');
  }
  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = MODEL_ROOT;
  const extractor = await pipeline('feature-extraction', MODEL, { dtype: 'q8', local_files_only: true });
  const embed = async text => (await extractor(text, { pooling: 'mean', normalize: true })).tolist()[0];
  embed.dispose = () => extractor.dispose();
  return embed;
}
