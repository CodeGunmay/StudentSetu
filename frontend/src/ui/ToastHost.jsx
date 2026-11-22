// Renders StudentSetu screens and handles student actions.
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import Portal from './Portal';

const TONES = {
  success: { icon: CheckCircle2, ring: 'ring-emerald-500/30', color: 'text-emerald-500' },
  error: { icon: AlertTriangle, ring: 'ring-rose-500/30', color: 'text-rose-500' },
  info: { icon: Info, ring: 'ring-brand-500/30', color: 'text-brand-500' },
};

export default function ToastHost({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <Portal>
      <div className="pointer-events-none absolute inset-x-3 top-12 z-50 flex flex-col gap-2">
        {toasts.map((t) => {
          const tone = TONES[t.type] || TONES.info;
          const Icon = tone.icon;
          return (
            <div
              key={t.id}
              role="status"
              aria-live="polite"
              className={`pointer-events-auto flex animate-toast-in items-start gap-2.5 rounded-2xl bg-slate-900/95 px-3.5 py-3 text-white
                shadow-[0_18px_40px_-18px_rgba(15,23,42,.7)] ring-1 backdrop-blur ${tone.ring} dark:bg-slate-800/95`}
            >
              <Icon size={17} className={`mt-0.5 shrink-0 ${tone.color}`} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold leading-snug">{t.message}</p>
                {t.actionLabel && t.onAction && (
                  <button
                    type="button"
                    onClick={() => {
                      t.onAction();
                      onDismiss(t.id);
                    }}
                    className="mt-1.5 rounded-lg bg-white/15 px-2.5 py-1 text-[12px] font-bold text-white hover:bg-white/25"
                  >
                    {t.actionLabel}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(t.id)}
                aria-label="Dismiss"
                className="-mr-1 grid h-6 w-6 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </Portal>
  );
}
