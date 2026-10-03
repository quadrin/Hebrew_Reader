/* Cache helpers are separate so interrupted downloads and eviction can be
   tested without a GPU or a 600 MB fixture. */
export async function hasCompletePack(cache, files) {
  for (const { url, size } of files) {
    const response = await cache.match(url);
    if (!response?.ok || Number(response.headers.get('x-duchifat-bytes')) !== size) return false;
  }
  return files.length > 0;
}

export async function cacheFile(cache, file, { signal, fetcher = fetch, onProgress = () => {} } = {}) {
  const saved = await cache.match(file.url);
  if (saved?.ok && Number(saved.headers.get('x-duchifat-bytes')) === file.size) {
    onProgress(file.size);
    return;
  }
  const response = await fetcher(file.url, { signal, credentials: 'omit' });
  if (!response.ok || !response.body) throw new Error('Download failed. Check your connection and try again.');
  let received = 0;
  const progress = new TransformStream({
    transform(chunk, controller) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      received += chunk.byteLength;
      onProgress(received);
      controller.enqueue(chunk);
    },
    flush() {
      if (received !== file.size) throw new Error('Incomplete model file. Please retry the download.');
    },
  });
  const headers = new Headers(response.headers);
  headers.set('x-duchifat-bytes', String(file.size));
  headers.delete('content-encoding');
  headers.set('content-length', String(file.size));
  await cache.put(file.url, new Response(response.body.pipeThrough(progress), { status: 200, headers }));
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
}
