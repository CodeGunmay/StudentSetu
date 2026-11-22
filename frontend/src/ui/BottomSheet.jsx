// Renders StudentSetu screens and handles student actions.
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import Portal from './Portal';

/**
 * Bottom sheet with the iOS-ish grabber, backdrop and slide-up animation.
 * `onClose` gets called after the exit animation finished.
 */
export default function BottomSheet({ open, title, subtitle, onClose, children, footer, maxH = '82%' }) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const t = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <Portal>
      <div className={`pointer-events-auto absolute inset-0 z-40 flex flex-col justify-end`}>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className={`absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-200 ${
            closing ? 'opacity-0' : 'opacity-100 animate-[fade-up_.2s_ease-out]'
          }`}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={`relative flex flex-col rounded-t-[28px] bg-white shadow-[0_-20px_50px_-20px_rgba(15,23,42,.4)] dark:bg-slate-900
            ${closing ? 'translate-y-full' : 'animate-sheet-up'}`}
          style={{ maxHeight: maxH }}
        >
          <div className="flex items-start gap-3 px-5 pb-3 pt-3">
            <div className="min-w-0 flex-1">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
              <h2 className="text-[17px] font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</h2>
              {subtitle && <p className="mt-0.5 text-[13px] muted">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sheet"
              className="-mr-1 mt-6 grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            >
              <X size={16} />
            </button>
          </div>
          <div className="no-bar min-h-0 flex-1 overflow-y-auto px-5 pb-2">{children}</div>
          {footer && <div className="border-t hairline bg-white/90 px-5 pb-5 pt-3 dark:bg-slate-900/90">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}
