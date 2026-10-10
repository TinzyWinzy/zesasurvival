import { registerSW } from 'virtual:pwa-register';

export function setupServiceWorker(onNeedRefresh: () => void, onOfflineReady: () => void) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) onOfflineReady();
  const updateSW = registerSW({
    immediate: false,
    onNeedRefresh() {
      onNeedRefresh();
    },
    onOfflineReady() {
      onOfflineReady();
    },
    onRegisterError(err: unknown) {
      console.error('Service worker registration failed:', err);
    }
  });

  return updateSW;
}
