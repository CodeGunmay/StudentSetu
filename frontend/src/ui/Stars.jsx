// Renders StudentSetu screens and handles student actions.
import { Star } from 'lucide-react';

/**
 * The one place a score is rendered, so the rule is never broken: a rating that
 * nobody has given does not exist. `ratingCount` 0 (or unknown) reads
 * "No ratings yet" instead of a 5.0 or an empty row of stars.
 */
export default function Rating({ rating, count = 0, size = 11, className = '', prefix = '' }) {
  const n = Number(count) || 0;
  const score = Number(rating);
  if (!n || !Number.isFinite(score) || score <= 0) {
    return <span className={`text-[11px] font-semibold italic text-slate-400 dark:text-slate-500 ${className}`}>No ratings yet</span>;
  }
  return (
    <span className={`inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 ${className}`}>
      <Star size={size} className="fill-amber-500 text-amber-500" />
      <span className="font-extrabold">
        {score.toFixed(1).replace(/\.0$/, '')}
      </span>
      <span className="font-semibold muted">
        ({n})
        {prefix ? ` ${prefix}` : ''}
      </span>
    </span>
  );
}

/** 1-5 picker. Disabled while the rating is in flight, so one tap is one rating. */
export function StarInput({ value = 0, onChange, disabled = false, label = 'stars' }) {
  return (
    <div className="flex items-center gap-1.5" role="radiogroup" aria-label={`Rate ${label}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          disabled={disabled}
          onClick={() => onChange(n)}
          className={`grid h-11 w-11 place-items-center rounded-xl transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
            value >= n ? 'bg-amber-100 text-amber-500 dark:bg-amber-500/15' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
          }`}
        >
          <Star size={20} className={value >= n ? 'fill-amber-500 text-amber-500' : ''} />
        </button>
      ))}
    </div>
  );
}
