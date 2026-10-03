/* No UI work or network downloads here. The only inputs are saved artifacts
   and one short, reference-backed answer; each call starts a fresh context. */
import { AutoTokenizer, AutoModelForCausalLM, LogitsProcessor, LogitsProcessorList, env } from '@huggingface/transformers';
import { MODEL_ID, MODEL_REVISION, MODEL_DTYPE, PACK_CACHE, modelUrl, MAX_INPUT_TOKENS, validGradingInput, gradingMessages, rulingFromMargin } from './config.js';

let session;
let busy = false;
async function load(baseUrl) {
  if (session) return session;
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter?.features.has('shader-f16')) throw new Error('This browser does not support the WebGPU features the offline model needs.');
  const cache = await caches.open(PACK_CACHE);
  env.allowLocalModels = true; // Required by Transformers' local_files_only validation.
  env.allowRemoteModels = false;
  env.useBrowserCache = false;
  env.useFSCache = false;
  env.useCustomCache = true;
  // Transformers 4.2's tokenizer-class probe omits revision. Map only that
  // metadata request to the pinned file; never fetch `main` or another model.
  const canonical = (url) => String(url) === `https://huggingface.co/${MODEL_ID}/resolve/main/tokenizer_config.json`
    ? modelUrl('tokenizer_config.json') : url;
  const match = (url) => cache.match(canonical(url));
  env.customCache = { match, put: async () => { throw new Error('Offline cache is read-only'); } };
  env.fetch = async (url) => (await match(url)) || new Response(null, { status: 404 });
  const wasm = env.backends.onnx.wasm;
  // Transformers 4.3 uses asyncify for WebGPU, including Safari 26+. The
  // ordinary WASM pair is CPU-only. Never load a CDN or that older Safari fallback.
  wasm.wasmPaths = {
    mjs: new URL('offline-ai/ort-wasm-simd-threaded.asyncify.mjs', baseUrl).href,
    wasm: new URL('offline-ai/ort-wasm-simd-threaded.asyncify.wasm', baseUrl).href,
  };
  wasm.numThreads = 1; // Works without SharedArrayBuffer / cross-origin isolation.
  wasm.proxy = false; // Already inside a dedicated worker.
  const options = { revision: MODEL_REVISION, local_files_only: true };
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID, options);
  // The verdict is read from these two tokens' scores, so each must be one token.
  const token = (word) => {
    const ids = tokenizer.encode(word, { add_special_tokens: false });
    if (ids.length !== 1) throw new Error('The offline model files do not match this app version.');
    return ids[0];
  };
  const yes = token('YES');
  const no = token('NO');
  const model = await AutoModelForCausalLM.from_pretrained(MODEL_ID, { ...options, device: 'webgpu', dtype: MODEL_DTYPE });
  session = { tokenizer, model, yes, no };
  return session;
}
/* One forward pass: the score of YES against NO as the first word of the
   reply. The model's written reply is not used — at this size it says YES to
   about half of all wrong answers, and adds text the parser must reject — but
   the score separates right from wrong well, and a calibrated cut-off on it
   (config.js) keeps false accepts low. */
class Margin extends LogitsProcessor {
  constructor(yes, no) { super(); this.yes = yes; this.no = no; this.value = NaN; }
  _call(ids, logits) {
    const data = logits.data;
    const base = data.length - logits.dims.at(-1);
    this.value = Number(data[base + this.yes]) - Number(data[base + this.no]);
    return logits;
  }
}
async function score(input, baseUrl) {
  if (!validGradingInput(input)) return null;
  const { tokenizer, model, yes, no } = await load(baseUrl);
  const inputs = tokenizer.apply_chat_template(gradingMessages(input), {
    tokenize: true, return_dict: true, add_generation_prompt: true, enable_thinking: false,
  });
  if (inputs.input_ids.dims.at(-1) > MAX_INPUT_TOKENS) return null;
  const margin = new Margin(yes, no);
  const processors = new LogitsProcessorList();
  processors.push(margin);
  await model.generate({ ...inputs, max_new_tokens: 1, do_sample: false, num_beams: 1, logits_processor: processors });
  return margin.value;
}
self.onmessage = async ({ data: { id, type, input, baseUrl } }) => {
  if (busy) { self.postMessage({ id, result: null }); return; }
  busy = true;
  try {
    if (type === 'prepare') {
      // Exercise GPU allocation and a full scoring pass before claiming the pack works.
      const value = await score({ he: 'אני כאן', en: 'I am here', given: 'I am here', lang: 'en' }, baseUrl);
      if (!Number.isFinite(value)) throw new Error('The offline model could not run on this device.');
      self.postMessage({ id, result: true });
    } else {
      const value = await score(input, baseUrl);
      self.postMessage({ id, result: value == null ? null : rulingFromMargin(value, input.lang) });
    }
  } catch (error) {
    self.postMessage({ id, error: error?.message || 'The offline model could not run on this device.' });
  } finally { busy = false; }
};
