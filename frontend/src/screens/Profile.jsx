// Renders StudentSetu screens and handles student actions.
import { useState } from 'react';
import {
  BadgeCheck,
  CalendarClock,
  Database,
  GraduationCap,
  LogOut,
  Mail,
  Moon,
  Package,
  Pencil,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Sun,
  ToggleRight,
  Zap,
} from 'lucide-react';
import api, { getFailureMode } from '../api';
import { useApp } from '../context/AppContext';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import BottomSheet from '../ui/BottomSheet';
import { SectionHeader, TopBar } from '../ui/Chrome';
import SkillsEditor from '../ui/SkillsEditor';
import { Field, Switch } from '../ui/Inputs';
import { Skeleton } from '../ui/States';
import Logo from '../ui/Logo';
import Rating from '../ui/Stars';

/**
 * Profile: identity, skills, availability, appearance.
 *
 * Two honesty rules in here:
 *  • anything the C++ server does not answer is hidden, not guessed — the stat
 *    tiles disappear in real mode because `GET /api/me` has no counters
 *  • the demo controls only exist in mock mode, so a reviewer can never mistake a
 *    reset of fake data for something that happened on a server
 */
export default function Profile() {
  const { user, pop, goTab, push, signOut, refreshUser, theme, setTheme, isDark, toast, version } = useApp();
  const [editor, setEditor] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState('');
  const [failing, setFailing] = useState(() => getFailureMode());
  const [freeOpen, setFreeOpen] = useState(false);
  const [freeLines, setFreeLines] = useState(() => (user?.freeTime || []).join('\n'));
  const [freeError, setFreeError] = useState('');

  if (!user) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    );
  }

  const demo = api.USE_MOCK;
  const followSystem = theme === 'system';
  // null = this server does not report counters; 0 is a real number
  const stats = [
    { label: 'Items listed', value: user.itemsListed },
    { label: 'Swaps done', value: user.swapsDone },
    { label: 'Requests', value: user.requestsTotal },
  ].filter((s) => s.value !== null && s.value !== undefined);
  const free = user.freeTime || [];

  const loadDemo = async () => {
    setBusy('reset');
    try {
      await api.resetDemo();
      await refreshUser();
      setConfirmReset(false);
      goTab('home');
      toast('Demo data reloaded — signed in as Gunmay', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const toggleFail = async (on) => {
    if (!demo) return; // no /api/demo/failure exists; never call it
    try {
      await api.setFailureMode(on);
      setFailing(on);
      toast(on ? 'Failure mode on — screens will now show their error states' : 'Failure mode off — back to healthy data', on ? 'error' : 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const saveFree = async () => {
    setBusy('free');
    setFreeError('');
    try {
      const saved = await api.setFreeTime(freeLines.split('\n'));
      setFreeLines(saved.join('\n'));
      setFreeOpen(false);
      await refreshUser();
      toast(saved.length ? `Saved ${saved.length} free window${saved.length === 1 ? '' : 's'}` : 'Availability cleared', 'success');
    } catch (err) {
      setFreeError(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="flex h-full flex-col bg-canvas dark:bg-slate-950">
      <TopBar title="Profile" onBack={user ? pop : undefined} />

      <div className="no-bar flex-1 overflow-y-auto px-4 pb-8 pt-3">
        {/* identity */}
        <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-brand-600 via-brand-600 to-indigo-800 p-5 text-white">
          <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10 blur-xl" />
          <div className="relative flex items-center gap-3.5">
            <Avatar name={user.name} color={user.color} size="xl" ring={false} className="ring-4 ring-white/25" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[20px] font-extrabold tracking-tight">{user.name}</h1>
              <p className="flex items-center gap-1 truncate text-[12.5px] font-medium text-white/75">
                <Mail size={12} /> {user.email}
              </p>
              {/* the badge follows the server's flag, nothing else */}
              {user.verified === true ? (
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold">
                  <BadgeCheck size={11} /> GEU verified
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => push('verify', { email: user.email })}
                  className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-400/25 px-2 py-0.5 text-[11px] font-bold text-white ring-1 ring-amber-200/40 active:scale-95"
                >
                  <ShieldAlert size={11} /> Email not confirmed — tap to finish
                </button>
              )}
            </div>
            <div className="shrink-0 text-right">
              <Rating rating={user.rating} count={user.ratingCount} className="justify-end" />
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-white/60">as a tutor</p>
            </div>
          </div>

          {!!stats.length && (
            <div className="relative mt-4 grid grid-cols-3 gap-2">
              {stats.map((s) => (
                <Stat key={s.label} label={s.label} value={s.value} />
              ))}
            </div>
          )}
          {!stats.length && (
            <p className="relative mt-3 text-[11.5px] font-semibold text-white/60">
              Counts are not part of this server’s profile response, so they are not shown.
            </p>
          )}
        </section>

        {/* skills */}
        <div className="mt-5">
          <SectionHeader
            title="My skills"
            subtitle="These power every match on StudentSetu"
            actionLabel="Edit"
            onAction={() => setEditor(true)}
          />
          <div className="card space-y-3.5 p-4">
            <SkillGroup label="I can teach" icon={GraduationCap} skills={user.teaches} tone="brand" empty="Nothing yet — add at least one." />
            <SkillGroup label="I want to learn" icon={Sparkles} skills={user.wants} tone="accent" empty="Add a skill and we will find swaps." />
            <div className="flex gap-2 border-t hairline pt-3">
              <Button variant="soft" size="sm" icon={Pencil} onClick={() => setEditor(true)}>
                Edit skills
              </Button>
              <Button variant="ghost" size="sm" icon={Zap} onClick={() => goTab('skills', { tab: 'barter', skill: user.wants?.[0] || '' })}>
                Find swaps now
              </Button>
            </div>
          </div>
        </div>

        {/* availability */}
        <div className="mt-5">
          <SectionHeader
            title="When I am free"
            subtitle="Used for the “find common time” check on circles and swaps"
            actionLabel={free.length ? 'Edit' : 'Add'}
            actionAria="Edit when I am free"
            onAction={() => {
              setFreeLines((user.freeTime || []).join('\n'));
              setFreeError('');
              setFreeOpen(true);
            }}
          />
          <div className="card p-4">
            {free.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {free.map((line) => (
                  <li key={line} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[12.5px] font-bold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20">
                    <CalendarClock size={11} className="mr-1 inline" />
                    {line}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] muted">You have not shared any windows yet. Add them and people can see when you are both free.</p>
            )}
          </div>
        </div>

        {/* shortcuts */}
        <div className="mt-5">
          <SectionHeader title="Your campus footprint" />
          <div className="card divide-y divide-slate-100 dark:divide-slate-800">
            <RowLink icon={Package} label="Items & listings" value={countText(user.itemsListed, 'listed', 'Open')} onClick={() => goTab('items', { tab: 'mine' })} />
            <RowLink
              icon={GraduationCap}
              label="Tutoring"
              value={countText(user.teachingCount, 'listing', 'Open')}
              onClick={() => goTab('skills', { tab: 'paid', side: 'teach' })}
            />
            <RowLink
              icon={ToggleRight}
              label="Activity"
              value={user.pendingReceived === null || user.pendingReceived === undefined ? 'Open' : user.pendingReceived ? `${user.pendingReceived} pending` : 'All clear'}
              onClick={() => goTab('activity')}
            />
          </div>
        </div>

        {/* appearance */}
        <div className="mt-5">
          <SectionHeader title="Appearance" subtitle="Dark mode follows your phone unless you override it" />
          <div className="card space-y-3 p-4">
            <div className="flex items-center gap-3">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-amber-50 text-amber-500'}`}>
                {isDark ? <Moon size={17} /> : <Sun size={17} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-slate-900 dark:text-white">Dark mode</p>
                <p className="text-[12px] muted">{followSystem ? 'Following your system setting' : isDark ? 'Always dark' : 'Always light'}</p>
              </div>
              <Switch checked={isDark} onChange={(next) => setTheme(next ? 'dark' : 'light')} label="Dark mode" />
            </div>
            <div className="flex items-center gap-3 border-t hairline pt-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                <RefreshCw size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-slate-900 dark:text-white">Follow system</p>
                <p className="text-[12px] muted">Switch with your device's light / dark schedule</p>
              </div>
              <Switch checked={followSystem} onChange={(next) => setTheme(next ? 'system' : isDark ? 'dark' : 'light')} label="Follow system theme" />
            </div>
          </div>
        </div>

        {/* demo controls — mock only, by design */}
        {demo && (
          <div className="mt-5">
            <SectionHeader title="Demo controls" subtitle="Mock data with a 300 ms fake delay — not part of the API" />
            <div className="card space-y-3 p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <Database size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-slate-900 dark:text-white">Load demo data</p>
                  <p className="text-[12px] muted">Reset the mock database to its seed and sign in as Gunmay</p>
                </div>
                <Button size="sm" variant="soft" loading={busy === 'reset'} onClick={() => setConfirmReset(true)}>
                  Reset
                </Button>
              </div>
              <div className="flex items-center gap-3 border-t hairline pt-3">
                <span className={`grid h-10 w-10 place-items-center rounded-xl ${failing ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/10' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                  <Zap size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-slate-900 dark:text-white">Force API errors</p>
                  <p className="text-[12px] muted">See the loading, empty and error states on every screen</p>
                </div>
                <Switch checked={failing} onChange={toggleFail} label="Force API errors" />
              </div>
            </div>
          </div>
        )}

        <Button className="mt-5" full size="lg" variant="outline" icon={LogOut} loading={busy === 'logout'} onClick={async () => { setBusy('logout'); await signOut(); setBusy(''); }}>
          Log out
        </Button>

        <div className="mt-6 flex flex-col items-center gap-1.5 text-center">
          <Logo size={18} />
          <p className="text-[11.5px] muted">
            StudentSetu · v1.0 · {api.USE_MOCK ? 'mock database' : `C++ API at ${api.BASE_URL || 'this origin'}`}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Live sync · {version} data update{version === 1 ? '' : 's'} this session
          </p>
        </div>
      </div>

      <SkillsEditor open={editor} onClose={() => setEditor(false)} teaches={user.teaches} wants={user.wants} />

      <BottomSheet
        open={freeOpen}
        onClose={() => setFreeOpen(false)}
        title="When are you free?"
        subtitle="One window a line — the format is what the server stores"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" full onClick={() => setFreeOpen(false)}>
              Cancel
            </Button>
            <Button full loading={busy === 'free'} onClick={saveFree}>
              Save windows
            </Button>
          </div>
        }
      >
        <div className="pb-5">
          <Field
            label="Windows"
            htmlFor="free-lines"
            error={freeError}
            hint="Day plus start and end, e.g. Mon 14:00-17:00. Up to 8 lines."
          >
            <textarea
              id="free-lines"
              rows={6}
              value={freeLines}
              onChange={(e) => setFreeLines(e.target.value)}
              placeholder={'Mon 14:00-18:00\nTue 09:00-11:00\nThu 16:00-19:00'}
              className={`field resize-none font-mono text-[13px] ${freeError ? 'field-error' : ''}`}
            />
          </Field>
          <p className="mt-2 text-[12px] leading-snug muted">
            Shared free time is only ever computed from what you and the other student both saved — nothing is guessed from when you happen to be
            online.
          </p>
        </div>
      </BottomSheet>

      <BottomSheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reload the demo data?"
        subtitle="This wipes anything you created in this session"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" full onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button full icon={Database} loading={busy === 'reset'} onClick={loadDemo}>
              Load demo data
            </Button>
          </div>
        }
      >
        <Field label="What happens">
          <ul className="space-y-1.5 pb-5 text-[13px] leading-relaxed muted">
            <li>· The mock database is rebuilt from its seed: 5 students, 9 items, 5 tutors, 3 requests.</li>
            <li>· Your two pending requests come back, so the Activity badge shows 2 again.</li>
            <li>· Circles you created and ratings you left are cleared with everything else.</li>
            <li>· You stay signed in as Gunmay, the demo account.</li>
          </ul>
        </Field>
      </BottomSheet>
    </div>
  );
}

/** `null` from the server means "not reported", so the row says "Open", not "0 listed". */
function countText(value, noun, fallback) {
  if (value === null || value === undefined) return fallback;
  return `${value} ${noun}${value === 1 ? '' : 's'}`;
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/12 px-2 py-2.5 text-center ring-1 ring-white/15 backdrop-blur">
      <p className="text-[19px] font-extrabold leading-none tracking-tight">{value ?? 0}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-white/70">{label}</p>
    </div>
  );
}

function SkillGroup({ label, icon: Icon, skills = [], tone, empty }) {
  const chip =
    tone === 'accent'
      ? 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20'
      : 'bg-brand-50 text-brand-700 ring-brand-100 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/20';
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide muted">
        <Icon size={12} /> {label}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {skills.length ? (
          skills.map((s) => (
            <span key={s} className={`rounded-lg px-2.5 py-1.5 text-[13px] font-bold ring-1 ${chip}`}>
              {s}
            </span>
          ))
        ) : (
          <span className="text-[12.5px] italic muted">{empty}</span>
        )}
      </div>
    </div>
  );
}

function RowLink({ icon: Icon, label, value, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 p-3.5 text-left transition hover:bg-slate-50 active:scale-[.99] dark:hover:bg-slate-800/50">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <Icon size={16} />
      </span>
      <span className="flex-1 text-[14px] font-bold text-slate-800 dark:text-slate-100">{label}</span>
      <span className="text-[12.5px] font-semibold muted">{value}</span>
    </button>
  );
}
