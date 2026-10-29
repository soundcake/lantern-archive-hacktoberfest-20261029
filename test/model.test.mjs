import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createEmbedder } from '../src/model.mjs';
import { buildIndex, search } from '../src/archive.mjs';

test('real model retrieves paraphrases with all fetch calls forbidden', async () => {
  const originalFetch = globalThis.fetch;
  let attemptedRequests = 0;
  globalThis.fetch = async () => { attemptedRequests++; throw new Error('Network forbidden in offline test'); };
  let embed;
  try {
    embed = await createEmbedder();
    const index = await buildIndex(fileURLToPath(new URL('../examples/letters/', import.meta.url)), embed);
    const cases = [
      ['Who fixed the broken timepiece?', '03-clock.txt', 'Elsie repaired'],
      ['What lit the way during the power outage?', '01-lantern-keeper.txt', 'brass lantern'],
      ['What gave the homemade loaf its citrus fragrance?', '02-kitchen.txt', 'orange peel'],
      ['Which flowers marked the route to the family home?', '04-garden.txt', 'marigolds'],
    ];
    for (const [query, file, fragment] of cases) {
      const result = await search(index, query, embed);
      assert.equal(result.matches[0]?.file, file, query);
      assert.ok(result.matches[0].quote.includes(fragment), query);
    }
    assert.equal(attemptedRequests, 0);
  } finally { if (embed) await embed.dispose(); globalThis.fetch = originalFetch; }
});
