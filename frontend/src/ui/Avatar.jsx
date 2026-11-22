// Renders StudentSetu screens and handles student actions.
import { AVATAR_COLORS } from '../lib/format';

const SIZES = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-9 w-9 text-[11px]',
  md: 'h-11 w-11 text-[13px]',
  lg: 'h-14 w-14 text-[16px]',
  xl: 'h-20 w-20 text-[22px]',
};

/** Initials avatar — no network images, so it always renders. */
export default function Avatar({ name = '?', color = 'indigo', size = 'md', ring = true, className = '' }) {
  const initials = String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center rounded-full font-bold text-white ${
        AVATAR_COLORS[color] || 'bg-slate-500'
      } ${SIZES[size] || SIZES.md} ${ring ? 'ring-2 ring-white dark:ring-slate-900' : ''} ${className}`}
    >
      {initials || '?'}
    </span>
  );
}

export function AvatarStack({ people = [], size = 'sm' }) {
  return (
    <span className="inline-flex -space-x-2">
      {people.map((p, i) => (
        <Avatar key={p.id || i} name={p.name} color={p.color} size={size} />
      ))}
    </span>
  );
}
