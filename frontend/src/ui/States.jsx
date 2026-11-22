// Renders StudentSetu screens and handles student actions.
import { Loader2, RefreshCw, WifiOff } from 'lucide-react';
import Button from './Button';

export function Skeleton({ className = 'h-4 w-full' }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-slate-200/70 dark:bg-slate-800 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/10" />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="card p-3.5">
      <div className="flex gap-3">
        <Skeleton className="h-16 w-16 rounded-xl" />
        <div className="flex-1 space-y-2 py-1">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function RowSkeleton({ cards = 3, width = 'w-[220px]' }) {
  return (
    <div className="flex gap-3 overflow-hidden" aria-busy="true" aria-label="Loading">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className={`shrink-0 ${width}`}>
          <Skeleton className="h-[132px] rounded-2xl" />
        </div>
      ))}
    </div>
  );
}

export function InlineSpinner({ label = 'Loading' }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-medium muted">
      <Loader2 size={14} className="animate-spin" /> {label}
    </span>
  );
}

/** Friendly empty state: illustration-ish icon + explanation + one action. */
export function EmptyState({ icon: Icon, title, message, actionLabel, onAction, secondaryLabel, onSecondary, tone = 'brand' }) {
  const toneBg =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-500 dark:bg-amber-500/10'
      : tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10'
      : 'bg-brand-50 text-brand-500 dark:bg-brand-500/10';
  return (
    <div className="card flex flex-col items-center px-5 py-9 text-center animate-fade-up">
      <span className={`grid h-16 w-16 place-items-center rounded-2xl ${toneBg}`}>
        {Icon ? <Icon size={28} strokeWidth={1.8} /> : null}
      </span>
      <h3 className="mt-4 text-[16px] font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</h3>
      {message && <p className="mt-1.5 max-w-[280px] text-[13px] leading-relaxed muted">{message}</p>}
      {actionLabel && (
        <Button className="mt-5" size="md" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
      {secondaryLabel && (
        <Button className="mt-2" size="sm" variant="ghost" onClick={onSecondary}>
          {secondaryLabel}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="card flex flex-col items-center px-5 py-8 text-center animate-fade-up" role="alert">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-500/10">
        <WifiOff size={26} strokeWidth={1.8} />
      </span>
      <h3 className="mt-3.5 text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">Something went wrong</h3>
      <p className="mt-1.5 max-w-[280px] text-[13px] leading-relaxed muted">{message || 'The request failed. Try again.'}</p>
      <Button className="mt-4" variant="soft" icon={RefreshCw} onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
