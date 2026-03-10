// ── Global toast emitter ─────────────────────────────────────────────────────
// Separated from Toast.jsx so Vite HMR / React Fast Refresh works correctly.
// Components export only from Toast.jsx; this module exports only the function.

let _addToast = null;

export function registerToastHandler(fn) {
  _addToast = fn;
  return () => { _addToast = null; };
}

export function toast(message, type = 'info', duration = 4000) {
  if (_addToast) {
    _addToast({ id: Date.now() + Math.random(), message, type, duration });
  }
}
