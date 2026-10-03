#!/usr/bin/env node
// Opt-in real inference check. Download the pinned MODEL_FILES to MODEL_DIR
// before running; this script never downloads files or calls a remote model.
// CPU success does not establish WebGPU, Safari, iPhone, or offline-PWA support.
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { AutoTokenizer, Qwen3_5ForCausalLM, env } from '@huggingface/transformers';
import { MODEL_FILES, MODEL_ID, MODEL_REVISION, MAX_INPUT_TOKENS, MAX_NEW_TOKENS, gradingMessages, parseLocalRuling, modelUrl } from '../src/localGrader/config.js';

const modelDir = path.resolve(process.env.MODEL_DIR || '/tmp/duchifat-qwen35');
const device = process.env.SMOKE_DEVICE || 'cpu';
const maxCases = Number(process.env.SMOKE_MAX_CASES || 6);
const caseFilter = process.env.SMOKE_CASE || '';
const validateOnly = process.argv.includes('--validate-only');
const cases = JSON.parse(await fs.readFile(new URL('./fixtures/local-grader-smoke.json', import.meta.url), 'utf8'))
  .filter((item) => !caseFilter || item.id === caseFilter).slice(0, maxCases);
const emit = (event) => console.log(JSON.stringify(event));
const started = performance.now();
let model;

try {
  for (const [file, size] of MODEL_FILES) {
    const stat = await fs.stat(path.join(modelDir, file));
    if (stat.size !== size) throw new Error(`Wrong size for ${file}: ${stat.size}, expected ${size}`);
  }
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.useBrowserCache = false;
  env.useFSCache = false;
  const cacheHits = [];
  if (validateOnly) {
    // Exercise the same exact pinned-cache and main-probe mapping as the
    // browser worker, with local fixture files acting as Cache API responses.
    env.useFS = false;
    env.useCustomCache = true;
    env.customCache = {
      async match(request) {
        const requested = String(request);
        const canonical = requested === `https://huggingface.co/${MODEL_ID}/resolve/main/tokenizer_config.json`
          ? modelUrl('tokenizer_config.json') : requested;
        const file = MODEL_FILES.find(([candidate]) => modelUrl(candidate) === canonical);
        if (!file) return undefined;
        cacheHits.push({ requested, canonical });
        return new Response(await fs.readFile(path.join(modelDir, file[0])), {
          headers: { 'content-length': String(file[1]), 'content-type': 'application/json' },
        });
      },
      async put() { throw new Error('Offline cache is read-only'); },
    };
  }
  env.fetch = async () => { throw new Error('Network access is disabled in this smoke test'); };
  const options = { local_files_only: true, revision: MODEL_REVISION };
  emit({ event: 'start', device: validateOnly ? 'validation-only' : device, revision: MODEL_REVISION, modelDir, maxInputTokens: MAX_INPUT_TOKENS, maxNewTokens: MAX_NEW_TOKENS });
  const tokenizer = await AutoTokenizer.from_pretrained(validateOnly ? MODEL_ID : modelDir, options);
  emit({ event: 'tokenizer-loaded', elapsedMs: Math.round(performance.now() - started) });
  if (validateOnly) {
    for (const item of cases) {
      const rendered = tokenizer.apply_chat_template(gradingMessages(item), {
        tokenize: false, add_generation_prompt: true, enable_thinking: false,
      });
      const inputs = tokenizer.apply_chat_template(gradingMessages(item), {
        tokenize: true, return_dict: true, add_generation_prompt: true, enable_thinking: false,
      });
      const inputTokens = inputs.input_ids.dims.at(-1);
      const nonThinking = rendered.endsWith('<think>\n\n</think>\n\n');
      if (!nonThinking || inputTokens > MAX_INPUT_TOKENS) throw new Error(`Invalid template or token budget: ${item.id}`);
      emit({ event: 'template-validated', id: item.id, inputTokens, nonThinking });
    }
    const mainProbeMapped = cacheHits.some(({ requested, canonical }) => requested !== canonical);
    if (!mainProbeMapped) throw new Error('Expected tokenizer main-probe mapping was not exercised');
    emit({ event: 'offline-cache-validated', mainProbeMapped, cacheHits, networkEnabled: false, inferenceTested: false });
    process.exit(0);
  }
  model = await Qwen3_5ForCausalLM.from_pretrained(modelDir, {
    ...options,
    device,
    dtype: { embed_tokens: 'q4f16', decoder_model_merged: 'q4f16' },
    session_options: { intraOpNumThreads: 2, interOpNumThreads: 1 },
  });
  emit({ event: 'model-loaded', elapsedMs: Math.round(performance.now() - started), sessions: Object.keys(model.sessions) });
  const warmInput = tokenizer.apply_chat_template(gradingMessages(cases[0]), {
    tokenize: true, return_dict: true, add_generation_prompt: true, enable_thinking: false,
  });
  const warmStart = performance.now();
  await model.generate({ ...warmInput, max_new_tokens: 1, do_sample: false, num_beams: 1 });
  emit({ event: 'warmup-passed', elapsedMs: Math.round(performance.now() - warmStart) });
  let passes = 0;
  for (const item of cases) {
    const inputs = tokenizer.apply_chat_template(gradingMessages(item), {
      tokenize: true, return_dict: true, add_generation_prompt: true, enable_thinking: false,
    });
    const inputTokens = inputs.input_ids.dims.at(-1);
    if (inputTokens > MAX_INPUT_TOKENS) {
      emit({ event: 'case', id: item.id, inputTokens, error: 'input-too-long', passed: false });
      continue;
    }
    const before = performance.now();
    const output = await model.generate({ ...inputs, max_new_tokens: MAX_NEW_TOKENS, do_sample: false, num_beams: 1 });
    const text = tokenizer.decode(output.tolist()[0].slice(inputTokens), { skip_special_tokens: true });
    const ruling = parseLocalRuling(text);
    const passed = ruling?.accept === item.expected;
    if (passed) passes += 1;
    emit({ event: 'case', id: item.id, inputTokens, generatedTokens: output.dims.at(-1) - inputTokens,
      elapsedMs: Math.round(performance.now() - before), text, ruling, expected: item.expected, passed });
  }
  emit({ event: 'summary', passes, cases: cases.length, elapsedMs: Math.round(performance.now() - started) });
  if (passes !== cases.length) process.exitCode = 2;
} catch (error) {
  emit({ event: 'fatal', elapsedMs: Math.round(performance.now() - started), error: error?.stack || String(error) });
  process.exitCode = 1;
} finally {
  await model?.dispose();
}
