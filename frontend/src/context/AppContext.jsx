// Renders StudentSetu screens and handles student actions.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api, { addUnauthorizedHandler } from '../api';
import { POLL_MS } from '../api/env.js';
import { useOnActive, usePolling } from '../lib/hooks';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export const TABS = ['home', 'items', 'skills', 'activity'];

/** Screens where somebody else's answer matters within seconds, not on reload. */
const LIVE_SCREENS = ['activity', 'skills'];

let toastSeq = 0;

/**
 * Holds the session, the theme, the toast queue, the screen stack and a
 * `version` counter that every screen listens to (so data stays in sync).
 */
export function AppProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [stack, setStack] = useState([{ name: 'splash', params: {} }]);
  const [anim, setAnim] = useState({ key: 0, dir: 'fade' });
  const [version, setVersion] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [theme, setThemeState] = useState(() => localStorage.getItem('setu.theme') || 'system');
  const [systemDark, setSystemDark] = useState(() =>
    typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)').matches : false
  );
  const toastTimers = useRef(new Map());

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  /* a local mutation in this tab refreshes every open screen */
  useEffect(() => api.subscribe(bump), [bump]);

  /* ...and a change made by someone else still has to reach us: there is no
     push channel on this API, so re-read on focus and, while a live screen is
     open, on a modest interval. Both just re-run the screens' own api calls. */
  const refreshAll = useCallback(() => {
    bump();
    if (user) api.getMe().then(setUser).catch(() => {});
  }, [bump, user]);

  useOnActive(refreshAll, { enabled: !!user });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && systemDark);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  }, [isDark]);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    localStorage.setItem('setu.theme', next);
  }, []);

  /* restore a previous session */
  useEffect(() => {
    let alive = true;
    api
      .getMe()
      .then((u) => {
        if (!alive) return;
        setUser(u);
        setStack([{ name: 'home', params: {} }]);
      })
      .catch(() => {
        if (!alive) return;
        // a dead token at boot is a 401, and the handler above has already put the
        // sign-in form up; only a network/5xx failure means "show the intro instead"
        setStack((prev) => (prev.length === 1 && prev[0].name === 'login' ? prev : [{ name: 'splash', params: {} }]));
      })
      .finally(() => alive && setBooting(false));
    return () => {
      alive = false;
    };
  }, []);

  /* the Activity badge */
  useEffect(() => {
    if (!user) {
      setPendingCount(0);
      return;
    }
    let alive = true;
    api
      .getPendingCount()
      .then((r) => alive && setPendingCount(r.count))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user, version]);

  const dismissToast = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = toastTimers.current.get(id);
    if (timer) clearTimeout(timer);
    toastTimers.current.delete(id);
  }, []);

  const toast = useCallback(
    (message, type = 'info', opts = {}) => {
      const id = ++toastSeq;
      const item = { id, message, type, ...opts };
      setToasts((list) => [...list.slice(-2), item]);
      const timer = setTimeout(() => dismissToast(id), opts.duration ?? 3200);
      toastTimers.current.set(id, timer);
      return id;
    },
    [dismissToast]
  );

  /* navigation ---------------------------------------------------------- */
  const current = stack[stack.length - 1];

  // while a live screen is on top, keep re-reading it; the interval is cleared
  // the moment the screen changes or the component unmounts
  usePolling(refreshAll, POLL_MS, { enabled: !!user && LIVE_SCREENS.includes(current.name) });

  const push = useCallback((name, params = {}) => {
    setAnim({ key: ++toastSeq, dir: 'push' });
    setStack((s) => [...s, { name, params }]);
  }, []);

  const pop = useCallback(() => {
    setAnim({ key: ++toastSeq, dir: 'pop' });
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  const replaceTop = useCallback((name, params = {}) => {
    setAnim({ key: ++toastSeq, dir: 'push' });
    setStack((s) => [...s.slice(0, -1), { name, params }]);
  }, []);

  const goTab = useCallback((name, params = {}) => {
    setAnim({ key: ++toastSeq, dir: 'fade' });
    setStack([{ name, params }]);
  }, []);

  /* session ------------------------------------------------------------- */
  const refreshUser = useCallback(() => api.getMe().then(setUser).catch(() => {}), []);

  // A protected route answered 401: the token is dead, so the signed-in person, the
  // cached read of them and every screen stacked on top of that have to go with it.
  // A wrong password is deliberately NOT this path — the client exempts /api/login,
  // so that sentence stays on the form where it was earned.
  useEffect(
    () =>
      addUnauthorizedHandler(() => {
        setUser(null);
        setPendingCount(0);
        setStack([{ name: 'login', params: {} }]);
        setAnim({ key: ++toastSeq, dir: 'fade' });
      }),
    []
  );

  const signIn = useCallback(async (result) => {
    setUser(result.user ?? (await api.getMe()));
    setStack([{ name: 'home', params: {} }]);
    setAnim({ key: ++toastSeq, dir: 'fade' });
  }, []);

  const signOut = useCallback(async () => {
    await api.logout();
    setUser(null);
    setStack([{ name: 'login', params: {} }]);
    setAnim({ key: ++toastSeq, dir: 'fade' });
  }, []);

  const value = useMemo(
    () => ({
      booting,
      user,
      setUser,
      signIn,
      signOut,
      refreshUser,
      stack,
      current,
      push,
      pop,
      replaceTop,
      goTab,
      anim,
      version,
      refreshAll,
      toasts,
      toast,
      dismissToast,
      pendingCount,
      theme,
      setTheme,
      isDark,
      canGoBack: stack.length > 1,
    }),
    [
      booting,
      user,
      signIn,
      signOut,
      refreshUser,
      stack,
      current,
      push,
      pop,
      replaceTop,
      goTab,
      anim,
      version,
      refreshAll,
      toasts,
      toast,
      dismissToast,
      pendingCount,
      theme,
      setTheme,
      isDark,
    ]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
