# Lantern Archive

Find a remembered story even when you cannot remember its exact words.
Lantern searches a folder of letters, journals or notes and returns the original
passages with filenames and line references. An open embedding model runs on
your computer after a one-time download.

[Watch the 48-second demonstration](demo/walkthrough.mp4) · [Read its transcript](demo/transcript.txt)

## Try it

Requires Node.js 22 or later. Install dependencies and the pinned model while
online, then index and search offline:

```sh
npm ci
npm run setup:model
node src/cli.mjs index examples/letters memories.lantern.json
node src/cli.mjs ask memories.lantern.json "Who fixed the broken timepiece?"
```

The example finds this passage in `03-clock.txt`, line 3:

> The clock above the station stopped at six minutes past midnight. Elsie repaired its spring with a piece from a broken pocket watch and wrote the date inside the wooden case.

All four example letters are fictional material created for this project.
Use your own folder of UTF-8 `.txt` and `.md` files in place of `examples/letters`.
The current size limit is 200 files or 2 MiB of source text. Hidden entries and
symbolic links are skipped.

Add `--json` to an `ask` command for structured output. An index is tied to its
original folder. If a source changes or moves, rebuild into a new index filename;
existing indexes are never overwritten. Index files include source passages, so
keep them alongside the private material they describe.

## How it works

1. Split documents into passages of up to 600 characters, keeping source offsets
   and line references.
2. Run each passage through the quantized `Xenova/all-MiniLM-L6-v2` embedding
   model using Transformers.js. Each vector has 384 dimensions.
3. Embed the question, rank passages by cosine similarity, and return up to three
   matches above the default 0.35 threshold.
4. Before every search, check source SHA-256 hashes and confirm that every saved
   quotation and line reference still matches the document.

Search returns exact text. The score ranks semantic similarity; it is not a
probability that a passage answers the question. If nothing reaches the threshold,
Lantern returns an explicit no-match result. The model is intended for English
sentence similarity, so results depend on the wording and available source text.

The model revision is pinned in `model-source.json`. Setup records SHA-256 hashes
for the downloaded files, which are checked at each load. Remote model loading
is disabled during indexing and search. These hashes detect subsequent file
changes.

## Demonstration and validation

```sh
npm test
npm run test:model
npm run demo
```

The nine core tests cover exact quotations and line references, long passages,
ranking and no-match results, changed-source detection, cached-quotation
validation, file selection, overwrite protection and input compatibility.
The real-model test checks four paraphrased questions while `fetch` throws on
every attempted request; the measured count is zero.

`npm run demo` creates `demo/generated/results.json` and `transcript.txt` from
real inference with the same network guard. The recorded walkthrough is
`demo/walkthrough.mp4`; its captions are rendered from the saved results, not a
screen recording. A copy of those results is in `demo/results.json`.

The 29 October 2026 example run on macOS arm64 with Node 22.23.1 indexed four
files / twelve passages in 23 ms after loading the model. The three queries
took 1.6–3.8 ms each and the process reported 187 MiB peak RSS. These are timings
for the small included archive, not a large-archive benchmark. The demonstration
recorded zero attempted fetch requests.

## Open components

- [Transformers.js](https://github.com/huggingface/transformers.js), pinned to
  3.8.1, provides local model inference and tokenization (Apache-2.0).
- [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) supplies
  the quantized ONNX weights (Apache-2.0), derived from
  [sentence-transformers/all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2).
- [Sentence Transformers](https://www.sbert.net/) and Microsoft's MiniLM research
  provide the underlying sentence-representation work. The model card contains
  its training and model details.

Open weights make offline use practical. An archive can remain useful without a
hosted account or API subscription, and its retrieval behavior can be inspected
and reproduced. Model files are downloaded separately and are not bundled in
this repository. Dependency licenses remain with their respective projects.

## Project dates

This project started on 29 October 2026 for the DEV Week 4 “Ghost in the Machine”
challenge. The theme is remembering through original words: a question lights
up a passage that would otherwise remain buried in a folder.

The application and fictional examples are licensed under the MIT license.
