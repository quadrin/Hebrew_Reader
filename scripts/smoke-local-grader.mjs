#!/usr/bin/env node
// Opt-in real inference check. Download the pinned MODEL_FILES to MODEL_DIR
// before running; this script never downloads files or calls a remote model.
// CPU success does not establish WebGPU, Safari, iPhone, or offline-PWA support.
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { AutoTokenizer, AutoModelForCausalLM, LogitsProcessor, LogitsProcessorList, env } from '@huggingface/transformers';
import { MODEL_FILES, MODEL_ID, MODEL_REVISION, MODEL_DTYPE, MAX_INPUT_TOKENS, gradingMessages, rulingFromMargin, modelUrl } from '../src/localGrader/config.js';

const modelDir = path.resolve(process.env.MODEL_DIR || '/tmp/duchifat-local-grader');
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
  emit({ event: 'start', device: validateOnly ? 'validation-only' : device, revision: MODEL_REVISION, modelDir, maxInputTokens: MAX_INPUT_TOKENS });
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
  model = await AutoModelForCausalLM.from_pretrained(modelDir, {
    ...options,
    device,
    dtype: MODEL_DTYPE,
    session_options: { intraOpNumThreads: 2, interOpNumThreads: 1 },
  });
  const [yes] = tokenizer.encode('YES', { add_special_tokens: false });
  const [no] = tokenizer.encode('NO', { add_special_tokens: false });
  const Margin = class extends LogitsProcessor {
    _call(ids, logits) {
      const base = logits.data.length - logits.dims.at(-1);
      this.value = Number(logits.data[base + yes]) - Number(logits.data[base + no]);
      return logits;
    }
  };
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
    const margin = new Margin();
    const processors = new LogitsProcessorList();
    processors.push(margin);
    const before = performance.now();
    await model.generate({ ...inputs, max_new_tokens: 1, do_sample: false, num_beams: 1, logits_processor: processors });
    const ruling = rulingFromMargin(margin.value, item.lang);
    // Abstaining on a wrong answer is a pass: the reference verdict stands.
    const passed = item.expected ? ruling?.accept === true : ruling?.accept !== true;
    if (passed) passes += 1;
    emit({ event: 'case', id: item.id, inputTokens, elapsedMs: Math.round(performance.now() - before),
      margin: margin.value, ruling, expected: item.expected, passed });
  }
  emit({ event: 'summary', passes, cases: cases.length, elapsedMs: Math.round(performance.now() - started) });
  if (passes !== cases.length) process.exitCode = 2;
} catch (error) {
  emit({ event: 'fatal', elapsedMs: Math.round(performance.now() - started), error: error?.stack || String(error) });
  process.exitCode = 1;
} finally {
  await model?.dispose();
}
