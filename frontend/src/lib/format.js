/** Small display helpers shared by all screens. */

export function timeAgo(ts) {
  if (!ts) return 'just now';
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function rupees(value) {
  if (value === null || value === undefined) return '';
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

export const AVATAR_COLORS = {
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  violet: 'bg-violet-500',
};

export const MODE_STYLE = {
  free: {
    label: 'Free',
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25',
    dot: 'bg-emerald-500',
    solid: 'bg-emerald-500',
  },
  barter: {
    label: 'Barter',
    chip: 'bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:ring-purple-500/25',
    dot: 'bg-purple-500',
    solid: 'bg-purple-500',
  },
  sell: {
    label: 'Sell',
    chip: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/25',
    dot: 'bg-blue-500',
    solid: 'bg-blue-500',
  },
  paid: {
    label: 'Paid',
    chip: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25',
    dot: 'bg-amber-500',
    solid: 'bg-amber-500',
  },
};

/** Category → icon name + soft gradient for the placeholder image area. */
export const CATEGORY_ART = {
  Books: { gradient: 'from-indigo-500/15 to-blue-500/10', icon: 'BookOpen' },
  Notes: { gradient: 'from-violet-500/15 to-purple-500/10', icon: 'NotebookPen' },
  Calculator: { gradient: 'from-sky-500/15 to-cyan-500/10', icon: 'Calculator' },
  'Lab equipment': { gradient: 'from-emerald-500/15 to-teal-500/10', icon: 'FlaskConical' },
  Electronics: { gradient: 'from-amber-500/15 to-orange-500/10', icon: 'Cpu' },
  Stationery: { gradient: 'from-rose-500/15 to-pink-500/10', icon: 'Ruler' },
  Clothing: { gradient: 'from-fuchsia-500/15 to-purple-500/10', icon: 'Shirt' },
  Other: { gradient: 'from-slate-500/15 to-slate-400/10', icon: 'Package' },
};
