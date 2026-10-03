/* The standalone HTML export has no service worker or persistent app shell. */
const state = { phase: 'unsupported', enabled: false, progress: 0, message: 'Offline AI is available in the web app, not the standalone HTML export.' };
export const getOfflineGraderSnapshot = () => state;
export const subscribeOfflineGrader = () => () => {};
export const initOfflineGrader = async () => false;
export const gradeOfflineAnswer = async () => null;
export const downloadOfflineGrader = async () => {};
export const cancelOfflineGraderDownload = () => {};
export const setOfflineGraderEnabled = () => {};
export const removeOfflineGrader = async () => {};
