# Experimental offline answer grading

In **Settings → Offline answer grading** (also in the course Profile), choose
**Download offline grader** while online. This is a separate, explicit download
of about 630 MB. No API key is needed for local checks. No model files download
just because the app opens, loses its connection, or sees an incorrect answer.

The pack includes Qwen3.5-0.8B text-only q4f16 ONNX graphs, tokenizer, and the
matching browser runtime. Installation checks storage, downloads with progress,
and loads/runs a one-token GPU warm-up before enabling the feature. Cancel is
available through download and warm-up. Completed files can be reused on retry.
The switch and downloaded files belong to this browser/device, not cloud sync.
**Remove offline grader** removes this model's cache, not books or lesson data.

## Behavior

- The existing rule-based grader runs first. When offline, only a mismatching,
  typed, short answer with both Hebrew and English references gets a second
  opinion. Inference runs in a reused dedicated worker after **Check**, never
  speculatively while typing.
- Online grading continues to use the configured cloud provider and its normal
  450 ms prefetch. A transport error or five-second connection timeout briefly
  routes grading offline (30 seconds, reset on an `online` event). API/auth/billing
  errors do not switch routes. Failed speculative calls do not start local work.
- Local output must be a strict YES/NO with at most eight words of reason. Unknown,
  malformed, over-budget and timed-out results leave the existing reference/rule
  verdict in place. The initial experiment caps prompts at 384 tokens and output
  at 24 tokens, with thinking/sampling disabled and a 12-second worker deadline.
  Slow cold starts can therefore fall back to the reference checker.
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

`src/localGrader/config.js` is the file/size manifest. Model revision:
`fafab72d87a9e6be3925b38caf48286d2838f2d0`.

The eight model/tokenizer files total 602,720,242 bytes. The build copies the exact
two asyncify ONNX Runtime files used by Transformers.js 4.3.0 into `offline-ai/`;
this adds 26,914,834 bytes (629,635,076 bytes total). The pinned web runtime is
`1.31.0-dev.20260914-8d85527a0`. Version 4.3 includes the Safari 26+ WebGPU fix;
older 4.2 selected a CPU-only runtime on Safari and must not be used as-is.
The service worker precaches the worker JavaScript and app shell, but explicitly
excludes `offline-ai/` and all weights. The explicit download stores model and
runtime responses in a dedicated versioned Cache Storage cache. The worker reads
that cache only, including WASM and runtime JavaScript; it does not fetch a CDN.
Every required cache entry is rechecked before inference. Missing entries require
an explicit online retry, never a hidden re-download. Storage persistence is
requested, but browsers can still evict files under pressure.

`Qwen3_5ForCausalLM` loads only embedding and decoder sessions, avoiding vision
weights. A Transformers.js 4.2 tokenizer metadata probe that omits its revision is
mapped narrowly to the pinned tokenizer config. Bump `PACK_VERSION` when changing
model files or the runtime dependency. Keep the manifest in sync with the build.

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

In the implementation environment, builds and automated rule/routing/cache checks
are reproducible; real browser testing was blocked by sandbox socket/localhost
restrictions. Model files and the final 4.3 tokenizer were loaded locally, but GPU inference,
iPhone latency, Hebrew accuracy and real cold-offline startup are not yet verified.

An additional `check:pace` run currently fails three stale-unit assertions
identically on unchanged main (`e8245f4`): "while the abandoned one is", "what has
gone quiet is found", and "the oldest is the first offer back". That existing
scheduling-test failure is outside this change.

## Sources and license

- [Qwen3.5-0.8B model card (Apache-2.0)](https://huggingface.co/Qwen/Qwen3.5-0.8B)
- [Pinned ONNX export](https://huggingface.co/onnx-community/Qwen3.5-0.8B-ONNX-OPT/tree/fafab72d87a9e6be3925b38caf48286d2838f2d0)
- [Official WebGPU demo](https://huggingface.co/spaces/webml-community/Qwen3.5-0.8B-WebGPU/blob/main/index.html)
- [Transformers.js 4.3.0 runtime source](https://github.com/huggingface/transformers.js/blob/4.3.0/packages/transformers/src/backends/onnx.js)
- [Transformers Safari WebGPU fix](https://github.com/huggingface/transformers.js/pull/1700)
- [Safari 26 WebGPU support](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
