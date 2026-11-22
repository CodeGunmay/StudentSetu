// Renders StudentSetu screens and handles student actions.
import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

const THRESHOLD = 46;

/**
 * Pull-to-refresh look (touch + mouse). The spinner reveals as you drag and the
 * list refetches when you release past the threshold.
 */
export default function PullRefresh({ onRefresh, children, className = '' }) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef(null);
  const scroller = useRef(null);

  const begin = (y) => {
    if (busy || (scroller.current?.scrollTop || 0) > 2) return;
    start.current = y;
  };

  const move = (y) => {
    if (start.current === null) return;
    const d = y - start.current;
    if (d <= 0) {
      setPull(0);
      return;
    }
    setPull(Math.min(96, d * 0.5));
  };

  const end = async () => {
    if (start.current === null) return;
    const distance = pull;
    start.current = null;
    setPull(0);
    if (distance >= THRESHOLD) {
      setBusy(true);
      try {
        await onRefresh?.();
      } finally {
        setBusy(false);
      }
    }
  };

  const shown = busy ? 60 : pull;

  return (
    <div
      ref={scroller}
      data-scroll
      className={`no-bar relative h-full overflow-y-auto overscroll-contain ${className}`}
      onTouchStart={(e) => begin(e.touches[0].clientY)}
      onTouchMove={(e) => move(e.touches[0].clientY)}
      onTouchEnd={end}
      onMouseDown={(e) => begin(e.clientY)}
      onMouseMove={(e) => move(e.clientY)}
      onMouseUp={end}
      onMouseLeave={end}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex justify-center"
        style={{ transform: `translateY(${shown - 54}px)`, transition: start.current === null ? 'transform .22s ease-out' : 'none' }}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-brand-600 shadow-card ring-1 ring-slate-100 dark:bg-slate-900 dark:text-brand-300 dark:ring-slate-800">
          <Loader2 size={13} className={busy ? 'animate-spin' : ''} />
          {busy ? 'Refreshing' : pull >= THRESHOLD ? 'Release to refresh' : 'Pull to refresh'}
        </span>
      </div>
      <div style={{ transform: `translateY(${shown * 0.35}px)`, transition: start.current === null ? 'transform .22s ease-out' : 'none' }}>
        {children}
      </div>
    </div>
  );
}
