import { useEffect, useRef, useState } from 'react';
import { useDialogFocus } from './useDialogFocus';

interface InstallPrompt extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useAppInstall() {
  const pending = useRef<InstallPrompt | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const standalone = matchMedia('(display-mode: standalone)');
    const sync = () => setInstalled(standalone.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const capture = (event: Event) => {
      event.preventDefault(); pending.current = event as InstallPrompt; setReady(true); setError(false);
    };
    const complete = () => { pending.current = null; setReady(false); setInstalled(true); };
    sync();
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', complete);
    standalone.addEventListener('change', sync);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', complete);
      standalone.removeEventListener('change', sync);
    };
  }, []);
  const install = async () => {
    const event = pending.current;
    if (!event || busy) return;
    pending.current = null; setReady(false); setBusy(true); setError(false);
    try { await event.prompt(); } catch { setError(true); }
    finally { setBusy(false); }
  };
  return { ready, busy, installed, error, install };
}

export function InstallApp({ app, offlineReady }: { app: ReturnType<typeof useAppInstall>; offlineReady: boolean }) {
  const [help, setHelp] = useState(false);
  const dialog = useDialogFocus(help);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  useEffect(() => { if (app.installed) setHelp(false); }, [app.installed]);
  useEffect(() => { if (app.error) setHelp(true); }, [app.error]);
  if (app.installed) return <span className="text-[10px] text-emerald-300 shrink-0" role="status">Installed ✓</span>;
  return <>
    <button type="button" disabled={app.busy} onClick={() => { if (app.ready) void app.install(); else setHelp(true); }}
      className="min-h-11 px-2 rounded-lg border border-cyan-300/40 bg-cyan-300/10 text-cyan-200 text-xs font-bold shrink-0 disabled:opacity-50"
      aria-label="Install ZESA Survivor app">{app.busy ? 'Installing…' : 'Install app'}</button>
    {app.error && <span role="status" className="sr-only">Installation could not start. Tap Install app for instructions.</span>}
    {help && <div className="absolute inset-0 z-50 bg-slate-950/95 overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label="Install ZESA Survivor" ref={dialog}
      onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setHelp(false); } }}>
      <div className="max-w-sm mx-auto my-4 rounded-xl border border-slate-700 bg-slate-900 p-5 text-slate-200">
        <img src="/pwa-192x192.png" width="64" height="64" alt="" className="rounded-xl mb-3" />
        <h2 className="text-xl font-black text-white">Keep the grid in your pocket</h2>
        <p className="text-sm text-slate-300 mt-2">Add ZESA Survivor to your home screen for a full-screen game. No account or app store needed.</p>
        {ios ? <ol className="list-decimal pl-5 mt-4 space-y-2 text-sm">
          <li>Open this page in Safari.</li><li>Tap Share, then Add to Home Screen.</li><li>Tap Add, then launch ZESA Survivor from your home screen.</li>
        </ol> : <ol className="list-decimal pl-5 mt-4 space-y-2 text-sm">
          <li>Open this page in Chrome or Edge.</li><li>Open the browser menu and choose Install app or Add to Home screen.</li><li>Confirm, then launch ZESA Survivor from your home screen.</li>
        </ol>}
        <p className="text-xs text-slate-400 mt-4">{offlineReady ? 'The game is downloaded and ready for offline play.' : 'Stay online for the first download. The menu will show when offline play is ready.'} Scores and badges stay on this device.</p>
        {app.ready && <button className="w-full min-h-11 mt-4 rounded-lg bg-cyan-300 text-slate-950 font-bold" disabled={app.busy} onClick={() => void app.install()}>Install now</button>}
        <button className="w-full min-h-11 mt-3 rounded-lg border border-slate-600 font-bold" onClick={() => setHelp(false)}>Back to game</button>
      </div>
    </div>}
  </>;
}
