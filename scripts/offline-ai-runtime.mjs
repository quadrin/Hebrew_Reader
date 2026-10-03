/* Package the exact ORT files used by the pinned Transformers version. They
   are optional assets, excluded from the app-shell precache. No CDN imports. */
import { readFileSync, statSync, createReadStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const dist = dirname(require.resolve('onnxruntime-web/webgpu'));
const names = ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm'];
export function offlineAiRuntime() {
  const files = names.map((name) => ({ path: `offline-ai/${name}`, size: statSync(join(dist, name)).size }));
  return {
    name: 'duchifat-offline-ai-runtime',
    config: () => ({ define: { __OFFLINE_AI_RUNTIME_FILES__: JSON.stringify(files) } }),
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = files.find((f) => req.url?.split('?')[0] === `/${f.path}`);
        if (!file) return next();
        res.setHeader('Content-Type', file.path.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        createReadStream(join(dist, file.path.split('/').pop())).pipe(res);
      });
    },
    generateBundle() {
      for (const file of files) this.emitFile({ type: 'asset', fileName: file.path, source: readFileSync(join(dist, file.path.split('/').pop())) });
    },
  };
}
