import { registerSW } from 'virtual:pwa-register';

export function setupServiceWorker(onNeedRefresh: () => void, onOfflineReady: () => void) {
  let registration: ServiceWorkerRegistration | undefined;
  let lastCheck = 0;
  let disposed = false;
  const check = () => {
    if (disposed || document.hidden || !navigator.onLine || !registration || Date.now() - lastCheck < 60000) return;
    lastCheck = Date.now();
    void registration.update().catch(() => { /* Offline play remains available. */ });
  };
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) onOfflineReady();
  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, worker) {
      registration = worker;
      check();
    },
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

  window.addEventListener('online', check);
  document.addEventListener('visibilitychange', check);
  const timer = window.setInterval(check, 15 * 60 * 1000);
  return { updateSW, dispose() {
    disposed = true;
    window.clearInterval(timer);
    window.removeEventListener('online', check);
    document.removeEventListener('visibilitychange', check);
  } };
}
