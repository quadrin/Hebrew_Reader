/* navigator.onLine only describes the network interface. A failed transport
   also puts grading offline briefly; HTTP/API errors do not. */
let failedUntil = 0;
export function isGradingOffline(now = Date.now()) {
  return globalThis.navigator?.onLine === false || now < failedUntil;
}
export function noteGradingNetworkFailure() { failedUntil = Date.now() + 30000; }
export function noteGradingNetworkSuccess() { failedUntil = 0; }
export function isTransportFailure(error) {
  return error?.name === 'TypeError' || error?.name === 'TimeoutError';
}
globalThis.addEventListener?.('online', noteGradingNetworkSuccess);
