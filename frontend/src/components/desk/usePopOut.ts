'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Pops the desk panel into an always-on-top window so staff can keep
 * calling while they work in another app. Uses Document Picture-in-Picture
 * (Chrome/Edge) and shares this page's live state; elsewhere it opens the
 * standalone /widget/desk page in a small popup window.
 */

interface DocumentPiP {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  window: Window | null;
}

const pip = (): DocumentPiP | undefined =>
  typeof window !== 'undefined' ? (window as unknown as { documentPictureInPicture?: DocumentPiP }).documentPictureInPicture : undefined;

function copyStyles(target: Document) {
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    target.head.appendChild(node.cloneNode(true));
  });
  // next/font puts its CSS variables on <html>/<body> classes.
  target.documentElement.className = document.documentElement.className;
  target.body.className = `${document.body.className} desk-pip-body`;
}

export function usePopOut() {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const supported = !!pip();

  const open = useCallback(async () => {
    const api = pip();
    if (api) {
      if (api.window) { api.window.focus(); return; }
      const win = await api.requestWindow({ width: 340, height: 440 });
      copyStyles(win.document);
      win.document.title = 'Desk';
      win.addEventListener('pagehide', () => setPipWindow(null));
      setPipWindow(win);
      return;
    }
    window.open('/widget/desk?popup=1', 'qms-desk', 'popup,width=360,height=600');
  }, []);

  const close = useCallback(() => {
    pipWindow?.close();
    setPipWindow(null);
  }, [pipWindow]);

  useEffect(() => () => { pipWindow?.close(); }, [pipWindow]);

  return { pipWindow, open, close, supported };
}
