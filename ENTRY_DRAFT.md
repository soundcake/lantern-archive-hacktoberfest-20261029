# Lantern Archive: find a remembered story in its original words

*This is a submission for the [Hacktoberfest Open-Source AI Challenge: Ghost in the Machine](https://dev.to/challenges/hacktoberfest-week4-2026-10-26).*

## What I Built

Lantern Archive is a small offline search tool for letters, journals and notes.
You can remember the meaning of a story without remembering the words that
would find it. Lantern uses an open embedding model to connect a question to
the relevant passage, then shows the original words and where to find them.

In the included fictional archive, “Who fixed the broken timepiece?” finds
Elsie's repair of the station clock. “What gave the homemade loaf its citrus
fragrance?” finds the letter about orange peel rubbed into sugar.

The “ghost” is a trace already present in the source: a small detail waiting to
be found again. Every result includes its file and line numbers so the reader
can return to the full story.

## Demo

[Watch the 48-second walkthrough](https://github.com/soundcake/lantern-archive-hacktoberfest-20261029/blob/main/demo/walkthrough.mp4) · [Read the exact search results](https://github.com/soundcake/lantern-archive-hacktoberfest-20261029/blob/main/demo/transcript.txt)

The walkthrough shows three searches against four fictional letters. Its
captions come from an actual local inference run. The saved JSON and transcript
are included alongside the video in the repository's `demo/` folder.

To run the same demonstration:

```sh
npm ci
npm run setup:model
npm run demo
```

Setup downloads the pinned model once. The demonstration then disables fetch
requests while the model loads, indexes the archive and searches it. This run
recorded zero attempted requests.

## Code

[Source code and setup instructions](https://github.com/soundcake/lantern-archive-hacktoberfest-20261029)

The repository contains the CLI, source-indexing logic, a model setup script,
fictional example letters, tests and the recorded demonstration. The app and
examples use the MIT license.

```sh
node src/cli.mjs index examples/letters memories.lantern.json
node src/cli.mjs ask memories.lantern.json "Who fixed the broken timepiece?"
```

## How I Built It

Lantern runs [Xenova's quantized all-MiniLM-L6-v2 model](https://huggingface.co/Xenova/all-MiniLM-L6-v2)
through [Transformers.js](https://github.com/huggingface/transformers.js).
The model builds on the [Sentence Transformers all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)
sentence-embedding work. The model weights and Transformers.js use Apache-2.0.
The code pins both the model revision and the library version.

Documents are split into passages with their original character offsets and
line numbers. Each passage becomes a 384-dimensional vector. A question becomes
another vector, and cosine similarity selects up to three passages above a
threshold. Returned text comes directly from those source passages.

Source SHA-256 hashes are checked before each search. If a document changes,
Lantern asks for a rebuilt index, keeping quotations and line references tied
to the current document. An explicit no-match result handles questions whose
scores fall below the threshold.

Nine core tests pass, covering quotation accuracy, line references, changed
sources, passage splitting, ranking, no-match behavior and index handling. A
separate real-model test passes four paraphrase searches with fetch disabled.
The demonstration indexed twelve passages in 23 ms and answered its three
queries in 1.6–3.8 ms each on macOS arm64; the saved report records the runtime
and measurements for this small archive.

## Why Does Open Innovation Matter?

A personal archive can outlast the service used to create it. Open weights let
Lantern search locally, without a hosted inference account or a subscription.
The model, its revision and the retrieval code are available for inspection.
Someone can repeat the same experiment, change the threshold or replace the
model as their archive grows.

That matters for the theme: keeping a story accessible includes keeping the
tools needed to find it accessible. Lantern brings an old passage back into
view, with its original wording intact.
