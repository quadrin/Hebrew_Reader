# Local grader smoke and accuracy checks

These opt-in checks use the exact pinned q4f16 model and the production prompt
and scoring rule. They do not call a remote inference service and never download
files.

- `smoke-local-grader.mjs` runs ten hand-written fixtures: correct answers,
  natural equivalents, and changed negation, object and direction in both
  translation directions.
- `eval-local-grader.mjs` runs 282 fixtures from `fixtures/local-grader-eval.json`
  and reports false accepts, valid answers kept, and the cut-off that would meet
  a target false-accept rate. Use it to recalibrate `ACCEPT_MARGIN` in
  `src/localGrader/config.js` whenever the model, prompt or runtime changes.

## Obtain the model

The download is **1,435,197,005 bytes**. Use the official Hugging Face CLI, if installed:

```sh
hf download onnx-community/Qwen3-1.7B-ONNX \
  --revision cc6a06a21d614e9b8e92a6adfab1074d4e7d2438 \
  --local-dir /tmp/duchifat-local-grader \
  --include config.json generation_config.json tokenizer.json tokenizer_config.json \
    onnx/model_q4f16.onnx
```

The filenames and expected byte counts are also in `src/localGrader/config.js`.
Both scripts check every file's size before using it.

## Offline tokenizer and prompt validation

```sh
SMOKE_MAX_CASES=10 node scripts/smoke-local-grader.mjs --validate-only
```

This uses a read-only custom cache, disables network fetch and filesystem-based
model loading, and verifies that Transformers.js 4.3.0's unpinned tokenizer
metadata probe is mapped to the pinned cache entry. It checks every fixture is
within the 384-token budget and the non-thinking chat-template suffix is present.
It does not test inference, a browser Cache API, PWA startup, or WebGPU hardware.

## Native runtime inference

```sh
SMOKE_MAX_CASES=10 node scripts/smoke-local-grader.mjs
node scripts/eval-local-grader.mjs
```

Both load the model on CPU and score one token per answer. `MODEL_DIR`,
`SMOKE_DEVICE`, `SMOKE_MAX_CASES`, `SMOKE_CASE`, `EVAL_DEVICE` and
`EVAL_MAX_FALSE_ACCEPT` (default 0.05) may be set. The smoke script counts an
abstention on a wrong answer as a pass, because the reference verdict then
stands. The evaluation exits with code 2 when the shipped cut-off lets through
more wrong answers than the target.

`npm run eval:offline-grader` runs the evaluation. If `npm ci` fails while
`onnxruntime-node` downloads its optional GPU binaries (for example behind a
proxy), `ONNXRUNTIME_NODE_INSTALL=skip npm ci` still installs the CPU binaries
these scripts need, as the CI workflow does.


CPU scores are close to, not the same as, WebGPU scores. A new cut-off still needs
checking on a phone.
