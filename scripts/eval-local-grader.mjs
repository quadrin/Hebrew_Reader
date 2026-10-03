#!/usr/bin/env node
// Opt-in accuracy check and calibration for the offline grader. It runs the
// production prompt and scoring (src/localGrader/config.js) on
// scripts/fixtures/local-grader-eval.json and reports, per direction:
//   - how many wrong answers the shipped cut-off lets through,
//   - how many valid answers it keeps,
//   - the cut-off that would let through no more than EVAL_MAX_FALSE_ACCEPT.
// The model files must already be in MODEL_DIR (see README-local-grader-smoke.md);
// this script never downloads anything. CPU scores are close to, not the same
// as, WebGPU scores — check on a device before trusting a new cut-off.
//
// Fixture kinds: exact, alt (course alternatives) and para (hand-written
// paraphrases) are valid; neg (negation flipped), swap (one word replaced),
// tense and subject are wrong. Most wrong answers are generated from course
// sentences, so a few are also ungrammatical — still wrong.
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { AutoTokenizer, AutoModelForCausalLM, LogitsProcessor, LogitsProcessorList, env } from '@huggingface/transformers';
import { MODEL_FILES, MODEL_DTYPE, MAX_INPUT_TOKENS, ACCEPT_MARGIN, gradingMessages, rulingFromMargin } from '../src/localGrader/config.js';

const modelDir = path.resolve(process.env.MODEL_DIR || '/tmp/duchifat-local-grader');
const maxFalseAccept = Number(process.env.EVAL_MAX_FALSE_ACCEPT || 0.05);
const cases = JSON.parse(await fs.readFile(new URL('./fixtures/local-grader-eval.json', import.meta.url), 'utf8'));

for (const [file, size] of MODEL_FILES) {
  const stat = await fs.stat(path.join(modelDir, file));
  if (stat.size !== size) throw new Error(`Wrong size for ${file}: ${stat.size}, expected ${size}`);
}
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.useBrowserCache = false;
env.useFSCache = false;
env.fetch = async () => { throw new Error('Network access is disabled in this check'); };
const options = { local_files_only: true };
const tokenizer = await AutoTokenizer.from_pretrained(modelDir, options);
const model = await AutoModelForCausalLM.from_pretrained(modelDir, {
  ...options, device: process.env.EVAL_DEVICE || 'cpu', dtype: MODEL_DTYPE,
});
const [yes] = tokenizer.encode('YES', { add_special_tokens: false });
const [no] = tokenizer.encode('NO', { add_special_tokens: false });
class Margin extends LogitsProcessor {
  _call(ids, logits) {
    const base = logits.data.length - logits.dims.at(-1);
    this.value = Number(logits.data[base + yes]) - Number(logits.data[base + no]);
    return logits;
  }
}

const results = [];
for (const item of cases) {
  const inputs = tokenizer.apply_chat_template(gradingMessages(item), {
    tokenize: true, return_dict: true, add_generation_prompt: true, enable_thinking: false,
  });
  if (inputs.input_ids.dims.at(-1) > MAX_INPUT_TOKENS) throw new Error(`Over the token budget: ${item.id}`);
  const margin = new Margin();
  const processors = new LogitsProcessorList();
  processors.push(margin);
  const started = performance.now();
  await model.generate({ ...inputs, max_new_tokens: 1, do_sample: false, num_beams: 1, logits_processor: processors });
  const ruling = rulingFromMargin(margin.value, item.lang);
  results.push({ ...item, margin: +margin.value.toFixed(3), accepted: ruling?.accept === true, ms: Math.round(performance.now() - started) });
}
await model.dispose();

const share = (list) => `${list.filter((r) => r.accepted).length}/${list.length}`;
const report = { maxFalseAccept, shipped: ACCEPT_MARGIN, directions: {} };
for (const lang of ['en', 'he']) {
  const rows = results.filter((r) => r.lang === lang);
  const wrong = rows.filter((r) => !r.expected);
  const sorted = wrong.map((r) => r.margin).sort((a, b) => b - a);
  const suggested = sorted[Math.floor(wrong.length * maxFalseAccept)];
  const kinds = {};
  for (const kind of [...new Set(rows.map((r) => r.kind))]) kinds[kind] = share(rows.filter((r) => r.kind === kind));
  report.directions[lang] = {
    wrongAccepted: share(wrong),
    validAccepted: share(rows.filter((r) => r.expected)),
    acceptedByKind: kinds,
    suggestedCut: suggested,
    validAboveSuggested: `${rows.filter((r) => r.expected && r.margin > suggested).length}/${rows.filter((r) => r.expected).length}`,
  };
}
const times = results.map((r) => r.ms).sort((a, b) => a - b);
report.medianMs = times[times.length >> 1];
report.wrongAcceptedExamples = results.filter((r) => !r.expected && r.accepted)
  .map((r) => `${r.lang} ${r.margin} | ${r.given} | reference: ${r.lang === 'en' ? r.en : r.he}`);
console.log(JSON.stringify(report, null, 2));
const falseAccepts = results.filter((r) => !r.expected && r.accepted).length;
if (falseAccepts > Math.ceil(results.filter((r) => !r.expected).length * maxFalseAccept)) process.exitCode = 2;
