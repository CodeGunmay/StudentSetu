// Connects StudentSetu interface behavior to its application state.
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Two ways the app notices what someone ELSE did, because a local mutation
 * counter only covers this tab:
 *
 *   useOnActive  — refetch when the tab is shown again / the window regains focus
 *   usePolling   — a modest interval while a live screen is open
 *
 * Neither invents an endpoint or a "version" call: both just re-run the same
 * api function the screen already uses, so the server stays the authority.
 */
export function useOnActive(callback, { enabled = true } = {}) {
  const ref = useRef(callback);
  ref.current = callback;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof document === 'undefined') return undefined;
    let timer = null;
    const fire = () => {
      if (document.visibilityState === 'hidden') return;
      // a tab switch arrives as focus AND visibilitychange: collapse them into one fetch
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        ref.current();
      }, 120);
    };
    window.addEventListener('focus', fire);
    document.addEventListener('visibilitychange', fire);
    return () => {
      window.removeEventListener('focus', fire);
      document.removeEventListener('visibilitychange', fire);
      if (timer) clearTimeout(timer);
    };
  }, [enabled]);
}

/** Runs `callback` every `ms` while the tab is visible. ms <= 0 disables it. */
export function usePolling(callback, ms = 0, { enabled = true } = {}) {
  const ref = useRef(callback);
  ref.current = callback;

  useEffect(() => {
    const period = Number(ms);
    if (!enabled || !Number.isFinite(period) || period <= 0 || typeof window === 'undefined') return undefined;
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      ref.current();
    }, period);
    return () => clearInterval(id); // cleanup: no timer survives an unmount or a tab change
  }, [ms, enabled]);
}

/**
 * One in-flight guard for "tap it once" actions: request, hand-off, accept,
 * cancel, rate. While pending, `run` refuses a second call and `pending` lets
 * the button render its spinner and sit disabled.
 */
export function useExclusive() {
  const [key, setKey] = useState('');
  const busy = useRef(false);

  const run = useCallback(async (name, fn) => {
    if (busy.current) return { skipped: true };
    busy.current = true;
    setKey(name);
    try {
      return await fn();
    } finally {
      busy.current = false;
      setKey('');
    }
  }, []);

  return { run, pending: key, isPending: (name) => key === name };
}

/**
 * Runs an async api call, exposing { data, loading, error, reload }.
 * Keeps the previous data while refetching so pull-to-refresh never flashes.
 */
export function useAsync(fn, deps = [], { keepData = true } = {}) {
  const [data, setDataState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const runId = useRef(0);
  const alive = useRef(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  // what is on screen right now, read without re-creating `run`
  const shown = useRef(null);

  const commit = useCallback((value) => {
    shown.current = value;
    setDataState(value);
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(
    async ({ silent = false } = {}) => {
      const id = ++runId.current;
      // A refresh that has something to keep on screen while it works is quiet:
      // the version bump from a poll, a refocus or pull-to-refresh must never
      // flash a skeleton over the list the user is already reading.
      const quiet = silent || (keepData && shown.current !== null);
      if (quiet) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await fnRef.current();
        if (!alive.current || id !== runId.current) return result;
        commit(result);
        return result;
      } catch (err) {
        if (alive.current && id === runId.current) {
          // a failed background refresh leaves the last good data visible;
          // it is the first load that is allowed to turn into an error state
          if (shown.current === null || !keepData) setError(err);
          if (!keepData) commit(null);
        }
        throw err;
      } finally {
        if (alive.current && id === runId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  );

  useEffect(() => {
    run().catch(() => {});
  }, [run]);

  const reload = useCallback(() => run({ silent: true }).catch(() => {}), [run]);

  return { data, loading, error, reload, setData: commit, refreshing };
}

/** Debounce a changing value (used by the live search boxes). */
export function useDebounced(value, ms = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Copy-to-clipboard, with a textarea fallback for older/insecure contexts. */
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand ? document.execCommand('copy') : false;
    document.body.removeChild(el);
    return !!ok;
  } catch {
    return false;
  }
}
