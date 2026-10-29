#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { buildIndex, saveIndex, search, formatResults } from './archive.mjs';
import { createEmbedder } from './model.mjs';

const [command, ...args] = process.argv.slice(2);
const usage = 'Usage:\n  node src/cli.mjs index FOLDER OUTPUT.lantern.json\n  node src/cli.mjs ask INDEX.lantern.json "question" [--json]\n\nFirst run npm run setup:model while online. Indexing and search run offline.';
let embed;
try {
  if (command === '--help' || !command) { console.log(usage); }
  else if (command === 'index' && args.length === 2) {
    embed = await createEmbedder();
    const index = await buildIndex(args[0], embed);
    await saveIndex(args[1], index);
    console.log(`Indexed ${index.files.length} files / ${index.chunks.length} passages into ${args[1]}`);
  } else if (command === 'ask' && (args.length === 2 || args.length === 3 && args[2] === '--json')) {
    const index = JSON.parse(await readFile(args[0], 'utf8'));
    embed = await createEmbedder();
    const result = await search(index, args[1], embed);
    console.log(args[2] === '--json' ? JSON.stringify(result, null, 2) : formatResults(result));
  } else throw new Error(usage);
} catch (error) {
  console.error(`Lantern: ${error.message}`);
  process.exitCode = 1;
} finally { if (embed) await embed.dispose(); }
