// Renders StudentSetu screens and handles student actions.
import { Activity, GraduationCap, Home, Package, Plus } from 'lucide-react';
import { useApp, TABS } from '../context/AppContext';

const TABS_META = [
  { name: 'home', label: 'Home', icon: Home },
  { name: 'items', label: 'Items', icon: Package },
  { name: 'skills', label: 'Skills', icon: GraduationCap },
  { name: 'activity', label: 'Activity', icon: Activity },
];

export default function BottomNav() {
  const { current, goTab, pendingCount } = useApp();
  const root = TABS.includes(current.name) ? current.name : TABS[currentTabOf(current.name)] || 'home';

  return (
    <nav
      aria-label="Main"
      className="relative z-30 shrink-0 border-t hairline bg-white/90 px-2 pb-2 pt-1.5 backdrop-blur-xl dark:bg-slate-950/85"
    >
      <div className="flex items-stretch">
        {TABS_META.map((tab) => {
          const active = root === tab.name;
          const badge = tab.name === 'activity' && pendingCount > 0 ? pendingCount : null;
          return (
            <button
              key={tab.name}
              type="button"
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              onClick={() => goTab(tab.name)}
              className={`relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl transition active:scale-95 ${
                active ? 'text-brand-600 dark:text-brand-300' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <span className="relative">
                <tab.icon size={21} strokeWidth={active ? 2.5 : 2} />
                {badge && (
                  <span className="absolute -right-2.5 -top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white ring-2 ring-white dark:ring-slate-950">
                    {badge}
                  </span>
                )}
              </span>
              <span className="text-[10.5px] font-bold tracking-tight">{tab.label}</span>
              {active && <span className="absolute -top-[7px] h-1 w-8 rounded-full bg-brand-600 dark:bg-brand-400" />}
            </button>
          );
        })}
      </div>
      <div className="mx-auto mt-0.5 h-1 w-32 rounded-full bg-slate-300/70 dark:bg-slate-700" aria-hidden="true" />
    </nav>
  );
}

/** Screens reached from a tab belong to that tab, so the nav stays lit up. */
const TAB_OF = { item: 1, listItem: 1, skills: 2, activity: 3, profile: 0, home: 0 };
function currentTabOf(name) {
  return TAB_OF[name] ?? 0;
}

/** Floating action button — "List an item" lives here. */
export function Fab({ onClick, label = 'List an item' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute bottom-4 right-4 z-30 inline-flex h-14 items-center gap-2 rounded-full bg-brand-600 px-5 text-[14px] font-bold text-white
        shadow-[0_16px_36px_-12px_rgba(79,70,229,.85)] transition active:scale-95 hover:bg-brand-700"
    >
      <Plus size={20} strokeWidth={2.6} />
      List item
    </button>
  );
}
