import { registerSW } from 'virtual:pwa-register';

export function setupServiceWorker(onNeedRefresh: () => void) {
  const updateSW = registerSW({
    immediate: false,
    onNeedRefresh() {
      onNeedRefresh();
    },
    onOfflineReady() {
      console.log('ZESA Survivor ready for offline play.');
    },
    onRegisterError(err: unknown) {
      console.error('Service worker registration failed:', err);
    }
  });

  return updateSW;
}
