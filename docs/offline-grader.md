# Experimental offline answer grading

In **Settings → Offline answer grading** (also in the course Profile), choose
**Download offline grader** while online. This is a separate, explicit download
of about 1.5 GB. No API key is needed for local checks. No model files download
just because the app opens, loses its connection, or sees an incorrect answer.

The pack includes Qwen3-1.7B as one q4f16 ONNX graph, its tokenizer, and the
matching browser runtime. Installation checks storage, downloads with progress,
and loads the model and runs one scoring pass on the GPU before enabling the feature. Cancel is
available through download and warm-up. Completed files can be reused on retry.
The switch and downloaded files belong to this browser/device, not cloud sync.
**Remove offline grader** removes this model's cache, not books or lesson data.

## Behavior

- The existing rule-based grader runs first. When offline, only a mismatching,
  typed, short **English** answer to a Hebrew prompt, with both Hebrew and English
  references, gets a second opinion. Hebrew answers keep the reference checker's
  verdict and never start the model (see *Model choice and accuracy*). Inference runs in a reused dedicated worker after **Check**, never
  speculatively while typing.
- Online grading continues to use the configured cloud provider and its normal
  450 ms prefetch. A transport error or five-second connection timeout briefly
  routes grading offline (30 seconds, reset on an `online` event). API/auth/billing
  errors do not switch routes. Failed speculative calls do not start local work.
- The verdict is read from the model's score for **YES** against **NO** as the
  first word of its reply, in one forward pass; its written reply is not used.
  An answer is accepted only when that score is at or above a per-direction
  cut-off (`ACCEPT_MARGIN` in `src/localGrader/config.js`), calibrated so that
  about 5% of wrong answers in the evaluation set get through. A negative score
  is a NO; anything between abstains. Abstained, over-budget and timed-out
  results leave the existing reference/rule verdict in place. Prompts are capped
  at 512 tokens, with thinking and sampling disabled and a 12-second worker
  deadline, so slow cold starts fall back to the reference checker.
- Local accepted alternatives are labeled experimental and are **never added to
  the persistent accepted-answer list**. They can count for the current question.
- Speech, explanations and reference-free Wikipedia grading are not sent to the
  local model. Their existing rule/reference/self-check paths remain available.
- Disabled/unavailable WebGPU, missing `shader-f16`, storage pressure/eviction,
  lost GPU, cancellation and inference failure all leave ordinary lessons usable.
  Worker failures terminate the worker so a subsequent retry gets a clean runtime.

The feature requires a secure web app with a controlling service worker and a
WebGPU adapter with `shader-f16`. It is unavailable in the standalone HTML export.
An iPhone 15 by itself does not establish support: Safari/iOS version and available
memory matter. Feature checks are used rather than guessing from user-agent text.

## Pinned files and cold offline startup

`src/localGrader/config.js` is the file/size manifest. Model:
`onnx-community/Qwen3-1.7B-ONNX`, revision `cc6a06a21d614e9b8e92a6adfab1074d4e7d2438`.

The five model/tokenizer files total 1,435,197,005 bytes; the model itself is one
1,426,069,098-byte graph. The build copies the exact two asyncify ONNX Runtime
files used by Transformers.js 4.3.0 into `offline-ai/`; this adds 26,914,834 bytes
(1,462,111,839 bytes total). The pinned web runtime is
`1.31.0-dev.20260914-8d85527a0`. Version 4.3 includes the Safari 26+ WebGPU fix;
older 4.2 selected a CPU-only runtime on Safari and must not be used as-is.
The service worker precaches the worker JavaScript and app shell, but explicitly
excludes `offline-ai/` and all weights. The explicit download stores model and
runtime responses in a dedicated versioned Cache Storage cache. The worker reads
that cache only, including WASM and runtime JavaScript; it does not fetch a CDN.
Every required cache entry is rechecked before inference. Missing entries require
an explicit online retry, never a hidden re-download. Storage persistence is
requested, but browsers can still evict files under pressure.

A Transformers.js 4.2 tokenizer metadata probe that omits its revision is
mapped narrowly to the pinned tokenizer config. Bump `PACK_VERSION` when changing
model files or the runtime dependency, and recalibrate `ACCEPT_MARGIN` with
`scripts/eval-local-grader.mjs` when the model, prompt or runtime changes. Keep the manifest in sync with the build.

## Model choice and accuracy

Every answer that reaches the local model has already been rejected by the
ordinary checker, so the only harm it can do is to accept a wrong answer. Models
were compared with `scripts/eval-local-grader.mjs` on CPU, using its 282
fixtures: exact answers, course alternatives and hand-written paraphrases (valid),
and negation flips, one-word swaps, and changed tense or subject (wrong). For each
setup, the cut-off was set so that at most 5% of the wrong answers in that
direction are accepted:

| Setup | Download | English answers: paraphrases kept | Hebrew answers: paraphrases kept | CPU time per answer |
|---|---|---|---|---|
| **Qwen3-1.7B, prompt with examples** | **1.5 GB** | **7/8** (exact 36/36) | 1/8 | about 4 s* |
| Qwen3.5-0.8B, prompt with examples | 0.6 GB | 4/8 | 3/8 | about 1.5 s* |
| Qwen3.5-2B, either prompt | 1.4 GB | 4/8 | 0/8 | 1.4–3.3 s* |
| Qwen3-1.7B, original prompt | 1.5 GB | 3/8 | 2/8 | about 1.7 s* |
| Qwen3.5-0.8B, original prompt | 0.6 GB | 5/8 | 1/8 | about 0.7 s* |
| Gemma-3-1B, original prompt | 0.8 GB | — | — | rejected: weakest separation, many malformed replies |

\* Measured while generating up to 24 tokens; the shipped grader scores one token.

Two findings set the design:

- **The written reply is not usable.** Read as text, every model said YES to
  between a quarter and two thirds of the wrong answers. The score of YES against
  NO separates right from wrong much better, so the verdict is read from that
  score with a calibrated cut-off.
- **No phone-sized model grades Hebrew answers safely.** Changed subject or tense
  (הוא הולך הביתה for אני הולך הביתה) scored as high as valid paraphrases, so any
  cut-off that blocks them also blocks almost every Hebrew paraphrase. Hebrew
  answers are therefore not offered to the model. The evaluation still reports
  the Hebrew direction, so a future model can be checked against it.

Limits: the paraphrase sets are small (8 per direction), the cut-off was chosen on
the same fixtures, and WebGPU scores can differ slightly from CPU scores.


## Verification and remaining acceptance work

Run:

    npm ci
    npm run check:offline-grader
    npm run check:offline-session
    npm run check:marking
    npm run check:tdz
    npm run check:duo
    npm run check:sync
    npm run build
    npm run build:single

The opt-in `scripts/smoke-local-grader.mjs` and fixtures provide a reproducible
real-inference check using a local model directory. They never download files or
call a cloud model. An initial check with Transformers 4.2 / native ORT 1.24.3 rejected this ONNX
export's `com.microsoft:CausalConvWithState` operator. The final browser dependency
is Transformers 4.3 / ORT-Web 1.31-dev; native CPU inference was not retested after
that upgrade. CPU is not an alternative app backend or evidence of GPU accuracy.

Before promoting this experiment, test on the target iPhone:

1. On Wi-Fi, install from Settings; check progress, cancel/retry and ready state
2. Enable airplane mode, force-close/reopen the installed app, and grade both
   valid paraphrases and wrong negation/tense/object/agreement fixtures
3. Confirm the cold app/worker/tokenizer/runtime/model load without network;
   measure initial and subsequent latency and whether memory pressure kills tabs
4. Verify a deterministic match is immediate, a local acceptance is not saved,
   and editing/navigating/closing a question cannot apply an old result
5. Remove one model/runtime cache entry, then try offline; ordinary checking must
   remain usable and Settings must explain how to recover
6. Reconnect; confirm cloud grading resumes and Explain/speech remain cloud-only

Verified in a cloud container (2026-10-03): the pinned model runs on CPU with
Transformers.js 4.3.0 and onnxruntime-node 1.30, and its accuracy is measured above.
In headless Chromium the WebGPU adapter is SwiftShader without `shader-f16`; the
grader reports the device as unsupported and downloads nothing, as designed. GPU
inference, iPhone speed and memory, and real cold-offline startup are not yet
verified. The model is one 1.4 GB graph, so peak memory while loading it on a phone
is the main open risk.

An additional `check:pace` run currently fails three stale-unit assertions
identically on unchanged main (`e8245f4`): "while the abandoned one is", "what has
gone quiet is found", and "the oldest is the first offer back". That existing
scheduling-test failure is outside this change.

## Sources and license

- [Qwen3-1.7B model card (Apache-2.0)](https://huggingface.co/Qwen/Qwen3-1.7B)
- [Pinned ONNX export](https://huggingface.co/onnx-community/Qwen3-1.7B-ONNX/tree/cc6a06a21d614e9b8e92a6adfab1074d4e7d2438)
- [Transformers.js 4.3.0 runtime source](https://github.com/huggingface/transformers.js/blob/4.3.0/packages/transformers/src/backends/onnx.js)
- [Transformers Safari WebGPU fix](https://github.com/huggingface/transformers.js/pull/1700)
- [Safari 26 WebGPU support](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
