# Local grader smoke checks

These opt-in checks use the exact pinned q4f16 text-only model and the production
prompt/parser. They do not call a remote inference service. The fixture set covers
correct answers, natural equivalents, and changed negation, object, and direction
in both translation directions. This is a small smoke set, not an accuracy benchmark.

## Obtain the model

The download is **602,720,242 bytes**. Use the official Hugging Face CLI, if installed:

```sh
hf download onnx-community/Qwen3.5-0.8B-ONNX-OPT \
  --revision fafab72d87a9e6be3925b38caf48286d2838f2d0 \
  --local-dir /tmp/duchifat-qwen35 \
  --include config.json generation_config.json tokenizer.json tokenizer_config.json \
    onnx/embed_tokens_q4f16.onnx onnx/embed_tokens_q4f16.onnx_data \
    onnx/decoder_model_merged_q4f16.onnx onnx/decoder_model_merged_q4f16.onnx_data
```

The filenames and expected byte counts are also in `src/localGrader/config.js`.
The smoke script checks every file's size before using it. It never downloads files.

## Offline tokenizer and prompt validation

```sh
SMOKE_MAX_CASES=10 node scripts/smoke-local-grader.mjs --validate-only
```

This uses a read-only custom cache, disables network fetch and filesystem-based
model loading, and verifies Transformers.js 4.3.0's unpinned tokenizer metadata
probe is mapped to the pinned cache entry. It checks every fixture is within the
384-token budget and the non-thinking chat-template suffix is present. It does not
test inference, a browser Cache API, PWA startup, or actual WebGPU hardware.

## Actual native runtime inference attempt

```sh
SMOKE_MAX_CASES=10 node scripts/smoke-local-grader.mjs
```

This attempts CPU loading, a one-token warmup, then at most 24 new tokens per
fixture. `MODEL_DIR`, `SMOKE_DEVICE`, `SMOKE_MAX_CASES`, and `SMOKE_CASE` may be set.
Use an external process timeout on slow hardware. The default limits are six
fixtures, 384 input tokens, and 24 generated tokens. JSON-lines output includes
raw generated text, parser results, timings, and pass/fail decisions.

### Verified cloud-container result (2026-10-03)

- All eight files downloaded from the pinned official revision with exact sizes;
  all five LFS model/tokenizer assets also matched the upstream SHA-256 hashes
- Offline tokenizer/prompt validation passed all ten fixtures, at 137–147 tokens
- The initial 4.2 dependency's native CPU loading failed before warmup with `onnxruntime-node@1.24.3`:
  `com.microsoft:CausalConvWithState(-1) is not a registered function/op`
- Final 4.3 offline tokenizer validation passed again; native CPU inference was not rerun after the browser dependency upgrade
- No inference quality, WebGPU, Safari/iPhone, or cold-offline PWA pass is claimed

The CPU failure must not be treated as a browser failure or worked around by
silently changing dtype/model/runtime. The browser path uses a separately pinned
`onnxruntime-web` build and needs an actual supported-device acceptance test.
