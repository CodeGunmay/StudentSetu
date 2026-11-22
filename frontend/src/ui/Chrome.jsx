// Renders StudentSetu screens and handles student actions.
import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, Search, X } from 'lucide-react';
import Avatar from './Avatar';
import { useApp } from '../context/AppContext';

/** Search input with a clear button — used on Home and Items. */
export function SearchBar({ value, onChange, placeholder = 'Search items or skills', onSubmit, autoFocus = false, hint }) {
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
      className="relative"
    >
      <label htmlFor="setu-search" className="sr-only">
        {placeholder}
      </label>
      <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        id="setu-search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field h-12 rounded-2xl pl-10 pr-10 text-[14px] shadow-card"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X size={16} />
        </button>
      ) : null}
      {hint && <p className="hint">{hint}</p>}
    </form>
  );
}

/** Sticky screen header: back button, title, avatar (→ Profile). */
export function TopBar({ title, subtitle, onBack, right, sticky = true, large = false }) {
  const { user, push } = useApp();
  return (
    <header
      className={`${sticky ? 'sticky top-0 z-20' : ''} border-b hairline bg-canvas/85 px-4 pb-2.5 pt-2 backdrop-blur-xl dark:bg-slate-950/80`}
    >
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="-ml-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft size={19} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1
            className={`truncate font-extrabold tracking-tight text-slate-900 dark:text-white ${
              large ? 'text-[22px]' : 'text-[16px]'
            }`}
          >
            {title}
          </h1>
          {subtitle && <p className="truncate text-[12px] font-medium muted">{subtitle}</p>}
        </div>
        {right}
        {!right && (
          <button
            type="button"
            onClick={() => push('profile')}
            aria-label="Open your profile"
            className="shrink-0 rounded-full transition active:scale-95"
          >
            <Avatar name={user?.name || '?'} color={user?.color} size="sm" />
          </button>
        )}
      </div>
    </header>
  );
}

/** Section header inside a screen, with an optional "See all" action. */
export function SectionHeader({ title, actionLabel, onAction, subtitle, actionAria }) {
  return (
    <div className="mb-2.5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 truncate text-[12px] muted">{subtitle}</p>}
      </div>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          aria-label={actionAria || undefined}
          className="inline-flex shrink-0 items-center gap-0.5 rounded-lg px-1.5 py-1 text-[13px] font-bold text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
        >
          {actionLabel}
          <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}

/** Live clock for the faux status bar. */
export function StatusBar({ tone = 'dark' }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: false });
  return (
    <div
      className={`flex h-11 shrink-0 items-center justify-between px-6 pt-1 text-[13px] font-bold ${
        tone === 'light' ? 'text-white' : 'text-slate-900 dark:text-white'
      }`}
    >
      <span className="tabular-nums">{time}</span>
      <span className="flex items-center gap-1.5" aria-hidden="true">
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor">
          <rect x="0" y="7" width="3" height="4" rx="1" />
          <rect x="4.5" y="5" width="3" height="6" rx="1" />
          <rect x="9" y="2.5" width="3" height="8.5" rx="1" />
          <rect x="13.5" y="0" width="3" height="11" rx="1" opacity=".35" />
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M1 4.2C4.6 1 10.4 1 14 4.2" />
          <path d="M3.4 6.9C5.7 5 9.3 5 11.6 6.9" />
          <circle cx="7.5" cy="9.4" r="1" fill="currentColor" stroke="none" />
        </svg>
        <svg width="23" height="11" viewBox="0 0 23 11">
          <rect x="0.6" y="0.6" width="19" height="9.8" rx="2.6" fill="none" stroke="currentColor" strokeOpacity=".4" />
          <rect x="2.2" y="2.2" width="13" height="6.6" rx="1.6" fill="currentColor" />
          <path d="M21 4v3a1.6 1.6 0 0 0 0-3z" fill="currentColor" fillOpacity=".5" />
        </svg>
      </span>
    </div>
  );
}
