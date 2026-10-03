/* No UI work or network downloads here. The only inputs are saved artifacts
   and one short, reference-backed answer; each call starts a fresh context. */
import { AutoTokenizer, Qwen3_5ForCausalLM, env } from '@huggingface/transformers';
import { MODEL_ID, MODEL_REVISION, PACK_CACHE, modelUrl, MAX_INPUT_TOKENS, MAX_NEW_TOKENS, validGradingInput, gradingMessages, parseLocalRuling } from './config.js';

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
  const model = await Qwen3_5ForCausalLM.from_pretrained(MODEL_ID, {
    ...options, device: 'webgpu',
    dtype: { embed_tokens: 'q4f16', decoder_model_merged: 'q4f16' },
  });
  session = { tokenizer, model };
  return session;
}
async function generate(input, baseUrl, maxTokens = MAX_NEW_TOKENS) {
  if (!validGradingInput(input)) return null;
  const { tokenizer, model } = await load(baseUrl);
  const inputs = tokenizer.apply_chat_template(gradingMessages(input), {
    tokenize: true, return_dict: true, add_generation_prompt: true, enable_thinking: false,
  });
  const inputLength = inputs.input_ids.dims.at(-1);
  if (inputLength > MAX_INPUT_TOKENS) return null;
  const output = await model.generate({ ...inputs, max_new_tokens: maxTokens, do_sample: false, num_beams: 1 });
  // Decode only new tokens: a YES in the reference/prompt is never a ruling.
  const ids = output.tolist()[0].slice(inputLength);
  const eos = [model.generation_config.eos_token_id].flat().map(Number);
  if (ids.length >= maxTokens && !eos.includes(Number(ids.at(-1)))) return null;
  const text = tokenizer.decode(ids, { skip_special_tokens: true });
  return parseLocalRuling(text);
}
self.onmessage = async ({ data: { id, type, input, baseUrl } }) => {
  if (busy) { self.postMessage({ id, result: null }); return; }
  busy = true;
  try {
    if (type === 'prepare') {
      await load(baseUrl);
      // Exercise GPU allocation and generation before claiming the pack works.
      await generate({ he: 'אני כאן', en: 'I am here', given: 'I am here', lang: 'en' }, baseUrl, 1);
      self.postMessage({ id, result: true });
    } else {
      self.postMessage({ id, result: await generate(input, baseUrl) });
    }
  } catch (error) {
    self.postMessage({ id, error: error?.message || 'The offline model could not run on this device.' });
  } finally { busy = false; }
};
