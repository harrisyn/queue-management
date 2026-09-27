/**
 * Short, non-blocking messages ("Saved", "Couldn't delete that"). Call from
 * anywhere; <ToastHost /> in the root layout shows them.
 */
export type ToastTone = 'info' | 'success' | 'error';
export interface ToastEvent { id: number; message: string; tone: ToastTone }

let counter = 0;

function show(message: string, tone: ToastTone = 'info') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ToastEvent>('qms-toast', { detail: { id: ++counter, message, tone } }));
}

export const toast = Object.assign(show, {
  success: (message: string) => show(message, 'success'),
  error: (message: string) => show(message, 'error'),
});

/** The server's own error message when there is one, else the fallback. */
export function errorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: string; message?: string } } };
  return e?.response?.data?.error || e?.response?.data?.message || fallback;
}
