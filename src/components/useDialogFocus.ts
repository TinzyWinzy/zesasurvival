import { useEffect, useRef } from 'react';

export function useDialogFocus(active = true) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    const previous = document.activeElement as HTMLElement | null;
    const buttons = () => Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]'));
    buttons()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = buttons();
      const index = controls.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
    };
    root.addEventListener('keydown', trap);
    return () => {
      root.removeEventListener('keydown', trap);
      if (previous?.isConnected) previous.focus();
    };
  }, [active]);
  return ref;
}
