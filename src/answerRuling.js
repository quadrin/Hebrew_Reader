import { fetchAnswerRuling, hasApiKey } from './ai.js';
import { getOfflineGraderSnapshot, gradeOfflineAnswer } from './offlineGrader.js';
import { isGradingOffline, isTransportFailure, noteGradingNetworkFailure, noteGradingNetworkSuccess } from './connectivity.js';
import { GRADING_TIMEOUT_MS, validGradingInput } from './localGrader/config.js';

export const isCloudGradingAvailable = () => !isGradingOffline() && hasApiKey();
export const shouldPrefetchTextRuling = isCloudGradingAvailable;
export const canAskTextRuling = () => isCloudGradingAvailable() || (isGradingOffline() && getOfflineGraderSnapshot().enabled);
export const getTextRulingWaitMs = () => isGradingOffline() ? GRADING_TIMEOUT_MS + 100 : 2500;

// Export the small routing factory for deterministic network-failure tests.
export function createTextRulingRouter({ offline, hasKey, cloud, local, failed, succeeded }) {
  return async (input) => {
    if (input.signal?.aborted) return null;
    if (offline()) return input.allowLocal !== false && validGradingInput(input) ? local(input) : null;
    if (!hasKey()) return null;
    try {
      const result = await cloud(input);
      succeeded();
      return { ...result, source: 'cloud', persist: true };
    } catch (error) {
      if (input.signal?.aborted || !isTransportFailure(error)) throw error;
      failed();
      return input.allowLocal !== false && validGradingInput(input) ? local(input) : null;
    }
  };
}
export const fetchTextAnswerRuling = createTextRulingRouter({
  offline: isGradingOffline, hasKey: hasApiKey, cloud: fetchAnswerRuling,
  local: gradeOfflineAnswer, failed: noteGradingNetworkFailure, succeeded: noteGradingNetworkSuccess,
});
