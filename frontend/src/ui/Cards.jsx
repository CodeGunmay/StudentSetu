// Renders StudentSetu screens and handles student actions.
import {
  BadgeCheck,
  BookOpen,
  Calculator,
  Cpu,
  FlaskConical,
  NotebookPen,
  Package,
  Ruler,
  Shirt,
  Tag,
} from 'lucide-react';
import { CATEGORY_ART, MODE_STYLE, rupees, timeAgo } from '../lib/format';
import Avatar from './Avatar';

const ICONS = {
  BookOpen,
  Calculator,
  Cpu,
  FlaskConical,
  NotebookPen,
  Package,
  Ruler,
  Shirt,
  Tag,
};

export function CategoryIcon({ category, size = 22, className = '' }) {
  const name = CATEGORY_ART[category]?.icon || 'Package';
  const Icon = ICONS[name] || Package;
  return <Icon size={size} strokeWidth={1.9} className={className} />;
}

export function ModeTag({ mode, children, size = 'sm' }) {
  const style = MODE_STYLE[mode] || MODE_STYLE.free;
  const pad = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wide ring-1 ${style.chip} ${pad}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {children ?? style.label}
    </span>
  );
}

/** Item tile: placeholder art with the category icon, title, mode tag, owner. */
export function ItemCard({ item, onClick, className = '', dense = false }) {
  const art = CATEGORY_ART[item.category] || CATEGORY_ART.Other;
  const modeLine =
    item.mode === 'sell'
      ? rupees(item.price)
      : item.mode === 'barter'
      ? `wants: ${item.wants.join(', ')}`
      : item.waitlistCount
      ? `${item.waitlistCount} waiting`
      : 'Free for anyone';


  return (
    <button
      type="button"
      onClick={onClick}
      className={`card group w-full overflow-hidden text-left transition active:scale-[.99] hover:shadow-lg ${className}`}
    >
      <div className="flex gap-3 p-3">
        <div
          className={`relative grid h-[76px] w-[76px] shrink-0 place-items-center rounded-xl bg-gradient-to-br ${art.gradient} dark:from-slate-800 dark:to-slate-800/40`}
        >
          <span className="text-slate-700 dark:text-slate-300">
            <CategoryIcon category={item.category} size={26} />
          </span>
          {item.available === false && (
            <span className="absolute inset-0 grid place-items-center rounded-xl bg-slate-900/55 text-[10px] font-extrabold uppercase tracking-wide text-white">
              Taken
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-[14.5px] font-bold leading-snug tracking-tight text-slate-900 dark:text-white">
              {item.title}
            </h3>
            <ModeTag mode={item.mode} size="xs" />
          </div>
          <p className={`mt-1 text-[12px] font-semibold muted ${item.mode === 'barter' ? 'text-purple-600 dark:text-purple-300' : ''} ${item.mode === 'sell' ? 'text-blue-600 dark:text-blue-300' : ''}`}>
            {item.category} · {modeLine}
          </p>
          {!dense && (
            <div className="mt-2 flex items-center gap-1.5">
              <Avatar name={item.owner?.name} color={item.owner?.color} size="xs" ring={false} />
              <span className="truncate text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                {item.isMine ? 'You' : item.owner?.name || 'Student'}
                {item.owner?.verified === true && <BadgeCheck size={11} className="ml-0.5 inline text-brand-500" />}
              </span>
              {/* a listing with no date from the server shows no date */}
              <span className="ml-auto shrink-0 text-[11px] muted">{item.createdAt ? timeAgo(item.createdAt) : null}</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

/** Compact tile for the horizontal carousels on Home. */
export function MiniItemCard({ item, onClick }) {
  const art = CATEGORY_ART[item.category] || CATEGORY_ART.Other;
  return (
    <button
      type="button"
      onClick={onClick}
      className="card w-[164px] shrink-0 snap-start-item overflow-hidden text-left transition active:scale-[.98]"
    >
      <div className={`relative grid h-[92px] place-items-center bg-gradient-to-br ${art.gradient} dark:from-slate-800 dark:to-slate-800/30`}>
        <span className="text-slate-700 dark:text-slate-200">
          <CategoryIcon category={item.category} size={30} />
        </span>
        <span className="absolute left-2 top-2">
          <ModeTag mode={item.mode} size="xs" />
        </span>
      </div>
      <div className="p-2.5">
        <h3 className="line-clamp-1 text-[13.5px] font-bold tracking-tight text-slate-900 dark:text-white">{item.title}</h3>
        <p className="mt-0.5 line-clamp-1 text-[11.5px] muted">
          {item.mode === 'sell' ? rupees(item.price) : item.mode === 'barter' ? `wants ${item.wants.join(', ')}` : 'Free'} · {item.owner?.name}
        </p>
      </div>
    </button>
  );
}

