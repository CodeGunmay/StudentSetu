// Renders StudentSetu screens and handles student actions.
import { useState } from 'react';
import {
  ArrowDownUp,
  ArrowRight,
  BadgeCheck,
  CircleDollarSign,
  GraduationCap,
  Lightbulb,
  Repeat,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import api from '../api';
import { useApp } from '../context/AppContext';
import { useAsync, useDebounced, useExclusive } from '../lib/hooks';
import { rupees } from '../lib/format';
import CircleCard from '../ui/CircleCard';
import Rating from '../ui/Stars';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import BottomSheet from '../ui/BottomSheet';
import { SectionHeader, TopBar } from '../ui/Chrome';
import ExchangeCircle from '../ui/ExchangeCircle';
import { Field, Segmented, Switch } from '../ui/Inputs';
import SkillsEditor from '../ui/SkillsEditor';
import { EmptyState, ErrorState, InlineSpinner, ListSkeleton, Skeleton } from '../ui/States';
import PullRefresh from '../ui/PullRefresh';

const SUGGESTED_SKILLS = ['Python', 'C++', 'DSA', 'Maths', 'DBMS', 'Physics', 'Excel', 'Figma'];

/** Skills: two-way barter (with exchange circles) and the paid tutor board. */
export default function Skills({ tab: initialTab = 'barter', skill: initialSkill = '', side: initialSide = 'learn', subject: initialSubject = '' }) {
  const { user } = useApp();
  const [tab, setTab] = useState(initialTab);
  const [paidSubject, setPaidSubject] = useState(initialSubject);
  const [paidSide, setPaidSide] = useState(initialSide);
  const [nonce, setNonce] = useState(0); // pull-to-refresh counter

  const goPaid = (skill) => {
    setPaidSubject(skill || '');
    setPaidSide('learn');
    setTab('paid');
  };

  return (
    <div className="flex h-full flex-col bg-canvas dark:bg-slate-950">
      <TopBar title="Skills" subtitle={user?.name ? `You teach ${user.teaches.join(', ') || 'nothing yet'}` : ''} />
      <div className="screen-pad pt-2">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'barter', label: 'Barter', icon: Repeat },
            { value: 'paid', label: 'Paid', icon: Wallet },
          ]}
        />
      </div>
      <div className="relative min-h-0 flex-1">
        <PullRefresh onRefresh={async () => setNonce((n) => n + 1)}>
          {tab === 'barter' ? (
            <Barter initialSkill={initialSkill} onGoPaid={goPaid} nonce={nonce} />
          ) : (
            <Paid initialSide={paidSide} initialSubject={paidSubject} nonce={nonce} />
          )}
        </PullRefresh>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ barter */

function Barter({ initialSkill, onGoPaid, nonce }) {
  const { user, toast, version } = useApp();
  const [value, setValue] = useState(initialSkill || '');
  const [skill, setSkill] = useState(initialSkill || '');
  const [editor, setEditor] = useState(false);
  const { run, pending } = useExclusive();

  const state = useAsync(() => (skill.trim() ? api.findBarter(skill.trim()) : Promise.resolve(null)), [skill, version, nonce]);
  // an open circle for this skill, if I already started one — read back from the
  // server rather than remembered from the click that created it
  const circles = useAsync(() => api.getMyCircles(), [version, nonce]);
  const openCircle = (circles.data?.circles || []).find(
    (c) => (c.skill || '').trim().toLowerCase() === String(skill).trim().toLowerCase() && c.status !== 'cancelled'
  );

  const pick = (text) => {
    setValue(text);
    setSkill(text);
  };

  const requestSwap = (peerId, studiedSkill) =>
    run(`swap:${peerId}`, async () => {
      try {
        const res = await api.sendSwapRequest(peerId, studiedSkill);
        toast(`Swap request sent to ${res.sentTo?.name || 'them'}`, 'success');
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        state.reload(); // whatever the server ended up with is what the list shows
        circles.reload();
      }
    });

  const requestCircle = (memberIds) =>
    run('circle', async () => {
      try {
        const res = await api.sendCircleRequest(memberIds, skill);
        toast(`Request sent to ${res.sent} people in your circle`, 'success');
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        state.reload();
        circles.reload();
      }
    });

  return (
    <div className="min-h-full px-4 pb-8 pt-3">
      {/* search */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-brand-600 to-indigo-700 p-4 text-white">
          <label htmlFor="barter-skill" className="text-[12px] font-bold uppercase tracking-wider text-white/70">
            What do you want to learn?
          </label>
          <div className="mt-2 flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
              <input
                id="barter-skill"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), pick(value))}
                placeholder="Python, Public speaking…"
                className="h-11 w-full rounded-xl bg-white/15 pl-9 pr-3 text-[15px] font-semibold text-white outline-none ring-1 ring-white/20 placeholder:text-white/50 focus:bg-white/20"
              />
            </div>
            <Button variant="accent" className="h-11 shrink-0" onClick={() => pick(value)}>
              Find swaps
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 p-3">
          <span className="text-[11.5px] font-bold uppercase tracking-wide muted">Tap to search:</span>
          {(user?.wants?.length ? user.wants : SUGGESTED_SKILLS.slice(0, 4)).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => pick(s)}
              className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[12.5px] font-bold text-slate-700 transition hover:bg-brand-50 hover:text-brand-700 active:scale-95 dark:bg-slate-800 dark:text-slate-200"
            >
              {s}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setEditor(true)}
            className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12.5px] font-bold text-brand-600 hover:bg-brand-50 dark:text-brand-300"
          >
            Edit mine
          </button>
        </div>
      </div>

      {/* results */}
      <div className="mt-5">
        {!skill ? (
          <div className="card p-5 text-center animate-fade-up">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
              <Repeat size={26} strokeWidth={1.9} />
            </span>
            <h3 className="mt-3.5 text-[16px] font-extrabold tracking-tight text-slate-900 dark:text-white">Swap skills, pay nothing</h3>
            <p className="mx-auto mt-1.5 max-w-[280px] text-[13px] leading-relaxed muted">
              You teach {user?.teaches?.join(' + ') || 'a skill'}, they teach you back. If nobody wants a straight swap, we look for a circle.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-left">
              {SUGGESTED_SKILLS.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => pick(s)}
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] font-bold text-slate-700 transition hover:border-brand-400 hover:bg-brand-50/50 active:scale-[.98] dark:border-slate-700 dark:text-slate-200"
                >
                  Learn {s}
                </button>
              ))}
            </div>
          </div>
        ) : state.loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <ListSkeleton rows={2} />
          </div>
        ) : state.error ? (
          <ErrorState message={state.error.message} onRetry={state.reload} />
        ) : (
          <BarterResults
            skill={skill}
            data={state.data}
            user={user}
            pending={pending}
            openCircle={openCircle || null}
            onAnswerCircle={(circle, yes) =>
              run(`ans:${circle.id}`, async () => {
                try {
                  await api.answerCircle(circle.id, yes);
                  toast(yes ? 'You are in — they have been told' : 'Declined — the circle did not close', 'success');
                } catch (err) {
                  toast(err.message, 'error');
                } finally {
                  circles.reload();
                  state.reload();
                }
              })
            }
            onCancelCircle={(circle) =>
              run(`can:${circle.id}`, async () => {
                try {
                  await api.answerCircle(circle.id, false);
                  toast('Circle cancelled', 'success');
                } catch (err) {
                  toast(err.message, 'error');
                } finally {
                  circles.reload();
                  state.reload();
                }
              })
            }
            onSwap={requestSwap}
            onCircle={requestCircle}
            onGoPaid={onGoPaid}
            onAddSkills={() => setEditor(true)}
          />
        )}
      </div>

      <SkillsEditor open={editor} onClose={() => setEditor(false)} teaches={user?.teaches || []} wants={user?.wants || []} />
    </div>
  );
}

function BarterResults({
  skill,
  data,
  user,
  pending,
  openCircle,
  onAnswerCircle,
  onCancelCircle,
  onSwap,
  onCircle,
  onGoPaid,
  onAddSkills,
}) {
  const busy = pending; // the shared in-flight guard: one action at a time
  const swaps = data?.swaps || [];
  const circle = data?.circle || null;
  const oneWay = data?.oneWay || [];
  // show the skill the way its teacher wrote it, never "Dbms"
  const display = (data?.skillLabel || skill).trim() || skill;

  // `run` already refuses a second call while one is in flight, so wrap() only
  // passes the tap through
  const wrap = (key, fn) => async () => {
    await fn();
  };

  if (!swaps.length && !circle && !oneWay.length) {
    return (
      <EmptyState
        title={`Nobody on campus teaches ${display} yet`}
        message={`One-way teachers are useless without a swap — so ${user?.name || 'we'} looked for people who want what you teach and found nothing.`}
        actionLabel="Try paid tutors"
        onAction={() => onGoPaid(skill)}
        secondaryLabel="Add more skills"
        onSecondary={onAddSkills}
      />
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title={swaps.length ? `${swaps.length} two-way swap${swaps.length === 1 ? '' : 's'} for ${display}` : `No direct swap for ${display}`}
        subtitle={swaps.length ? 'Ranked by how many of your skills they want' : circle ? 'But the campus can still close the loop' : 'Teachers exist, they just do not need a swap'}
      />

      {swaps.map((s) => (
        <article key={s.peer.id} className="card p-4 animate-fade-up">
          <div className="flex items-start gap-3">
            <Avatar name={s.peer.name} color={s.peer.color} size="lg" ring={false} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                {s.peer.name}
                {/* a tick only ever comes from the server's own flag */}
                {s.peer.verified === true && <BadgeCheck size={14} className="text-brand-500" />}
              </p>
              <p className="text-[12px] muted">
                {[s.peer.branch, s.peer.yearLabel].filter(Boolean).join(' · ') || 'Branch not shared'}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-extrabold text-white shadow-lift">
              {s.score} skill{s.score > 1 ? 's' : ''} match
            </span>
          </div>

          <div className="mt-3.5 space-y-2 rounded-xl bg-slate-100/80 p-3 dark:bg-slate-800/50">
            <MatchLine icon={GraduationCap} label="Teaches you" value={s.skillLabel || display} tone="text-emerald-600 dark:text-emerald-400" />
            <MatchLine icon={Zap} label="Wants from you" value={s.wantsFromYou.join(', ')} tone="text-purple-600 dark:text-purple-400" />
            {s.teaches.length > 1 && (
              <MatchLine icon={Sparkles} label="Also teaches" value={s.teaches.filter((t) => t.toLowerCase() !== skill.toLowerCase()).join(', ')} tone="text-slate-600 dark:text-slate-300" />
            )}
          </div>

          <Button
            className="mt-3.5"
            full
            variant={s.alreadyRequested ? 'outline' : 'primary'}
            loading={busy === `swap:${s.peer.id}`}
            disabled={Boolean(pending) || s.alreadyRequested}
            icon={s.alreadyRequested ? BadgeCheck : Repeat}
            onClick={wrap(s.peer.id, () => onSwap(s.peer.id, skill))}
          >
            {s.alreadyRequested ? 'Swap request pending' : 'Send swap request'}
          </Button>
        </article>
      ))}

      {!swaps.length && circle && (
        <article className="card overflow-hidden animate-fade-up">
          <div className="bg-gradient-to-br from-purple-600 to-brand-700 p-4 text-white">
            <p className="flex items-center gap-1.5 text-[11.5px] font-extrabold uppercase tracking-wider text-white/80">
              <TrendingUp size={13} /> Exchange circle · {circle.size} people
            </p>
            <h3 className="mt-1.5 text-[17px] font-extrabold leading-tight tracking-tight">Nobody wants a straight swap — but this loop works</h3>
            <p className="mt-1.5 text-[12.5px] leading-snug text-white/75">
              Each person learns from the next, so everyone teaches one thing and learns one thing.
            </p>
          </div>

          <div className="bg-white pt-4 dark:bg-slate-900">
            <ExchangeCircle
              people={circle.people.map((p) => ({ ...p, isMe: p.id === user.id }))}
              edges={circle.edges}
            />
          </div>

          <div className="px-4 pb-4">
            <ol className="space-y-1.5 rounded-2xl bg-slate-100/80 p-3 dark:bg-slate-800/50">
              {circle.edges.map((e, i) => (
                <li key={i} className="flex items-start gap-2 text-[12.5px] font-semibold leading-snug text-slate-700 dark:text-slate-200">
                  <span className="mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-600 text-[9.5px] font-extrabold text-white">
                    {i + 1}
                  </span>
                  <span>
                    <span className="font-extrabold">{e.from}</span> learns{' '}
                    <span className="font-extrabold text-brand-600 dark:text-brand-300">{e.skill}</span> from{' '}
                    <span className="font-extrabold">{e.to}</span>
                  </span>
                </li>
              ))}
            </ol>

            <Button
              className="mt-3.5"
              full
              size="lg"
              icon={Users}
              variant={circle.alreadySent || openCircle ? 'outline' : 'primary'}
              disabled={circle.alreadySent || Boolean(openCircle)}
              loading={busy === 'circle'}
              onClick={wrap('circle', () => onCircle(circle.memberIds))}
            >
              {circle.alreadySent || openCircle
                ? `Sent to ${openCircle?.size ? openCircle.size - 1 : circle.memberIds.length} people`
                : `Send request to everyone in the circle`}
            </Button>
          </div>
        </article>
      )}

      {!swaps.length && !circle && oneWay.length > 0 && (
        <>
          <div className="space-y-3">
            {oneWay.map((t) => (
              <div key={t.peer.id} className="card flex items-center gap-3 p-3.5 animate-fade-up">
                <Avatar name={t.peer.name} color={t.peer.color} size="md" ring={false} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-slate-900 dark:text-white">{t.peer.name}</p>
                  <p className="truncate text-[12px] muted">
                    teaches {t.teaches.join(', ')}
                    {t.wants.length ? ` · wants ${t.wants.join(', ')}` : ''}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10.5px] font-extrabold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  One-way
                </span>
              </div>
            ))}
          </div>
          <div className="card p-4">
            <p className="flex items-start gap-2 text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
              <Lightbulb size={16} className="mt-0.5 shrink-0 text-accent-500" />
              {oneWay.length} student{oneWay.length > 1 ? 's teach' : ' teaches'} {display}, but none of them want what you teach right now. Pay a
              session, or teach more and the swap engine will re-run.
            </p>
            <div className="mt-3 flex gap-2">
              <Button full variant="accent" icon={CircleDollarSign} onClick={() => onGoPaid(skill)}>
                Try Paid
              </Button>
              <Button full variant="soft" onClick={onAddSkills}>
                Add more skills
              </Button>
            </div>
          </div>
        </>
      )}

      {!swaps.length && circle && (
        <p className="px-1 text-center text-[12px] muted">
          A circle only closes if everyone agrees — you see their email as soon as they accept.
        </p>
      )}

      {openCircle && (
        <div className="space-y-2">
          <SectionHeader title="Your circle for this skill" subtitle="Live answers, straight from the server" />
          <CircleCard
            circle={openCircle}
            me={user?.id}
            pending={pending}
            onAnswer={onAnswerCircle}
            onCancel={onCancelCircle}
          />
        </div>
      )}
    </div>
  );
}

function MatchLine({ icon: Icon, label, value, tone }) {
  return (
    <p className="flex items-start gap-2 text-[12.5px] leading-snug">
      <Icon size={14} className={`mt-0.5 shrink-0 ${tone}`} />
      <span className="muted">{label}:</span>
      <span className={`font-extrabold ${tone}`}>{value}</span>
    </p>
  );
}

/* -------------------------------------------------------------------- paid */

function Paid({ initialSide, initialSubject, nonce }) {
  const [side, setSide] = useState(initialSide);
  return (
    <div className="min-h-full px-4 pb-8 pt-3">
      <Segmented
        size="sm"
        value={side}
        onChange={setSide}
        className="mb-4"
        options={[
          { value: 'learn', label: 'Learn', icon: GraduationCap },
          { value: 'teach', label: 'Teach', icon: Wallet },
        ]}
      />
      {side === 'learn' ? <Learn initialSubject={initialSubject} nonce={nonce} /> : <Teach nonce={nonce} />}
    </div>
  );
}

function Learn({ initialSubject, nonce }) {
  const { toast, version } = useApp();
  const [subject, setSubject] = useState(initialSubject || '');
  const [range, setRange] = useState([0, 1000]);
  // 'price_asc' | 'price_desc' | 'rating' — api.js translates these into the
  // server's own sort names (new / low / high / rating), screens never send those
  const [sort, setSort] = useState('price_asc');
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const [slotStart, setSlotStart] = useState('');
  const [slotEnd, setSlotEnd] = useState('');
  const debounced = useDebounced(subject, 260);

  const state = useAsync(() => api.searchTutors(debounced.trim(), range[0], range[1], sort), [
    debounced,
    range[0],
    range[1],
    sort,
    version,
    nonce,
  ]);

  const send = async () => {
    if (busy) return; // double tap must not book two sessions
    setBusy(true);
    try {
      const res = api.USE_MOCK
        ? await api.requestTutor(sheet.id)
        : await api.createBooking(sheet.id, slotStart, slotEnd);
      setSheet(null);
      toast(`Session request sent${res.booking ? ' — check Activity for confirmation and payment status' : ''}`, 'success');
    } catch (err) {
      toast(err.message, 'error');
      if (err.status === 409 || err.status === 404) setSheet(null); // paused or gone: close the sheet
    } finally {
      setBusy(false);
      state.reload(); // the authoritative list, not an optimistic row
    }
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-3.5 p-4">
        <Field label="Subject" htmlFor="paid-subject">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="paid-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Maths, SQL, Python…"
              className="field pl-9"
            />
          </div>
        </Field>

        <div>
          <p className="label">Price per hour</p>
          <PriceRange range={range} onChange={setRange} />
        </div>

        <div className="flex items-center gap-2">
          <ArrowDownUp size={14} className="muted" />
          <Segmented
            size="sm"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'price_asc', label: 'Low → high' },
              { value: 'price_desc', label: 'High → low' },
              { value: 'rating', label: 'Best rated' },
            ]}
            optionClassName="whitespace-nowrap text-[12.5px]"
          />
        </div>
      </div>

      {state.loading ? (
        <ListSkeleton rows={3} />
      ) : state.error ? (
        <ErrorState message={state.error.message} onRetry={state.reload} />
      ) : (
        <>
          <p className="px-1 text-[12.5px] font-bold muted">
            {state.data.total} tutor{state.data.total === 1 ? '' : 's'} between {rupees(range[0])} and {rupees(range[1])}/hr
            {debounced.trim() ? ` for “${debounced.trim()}”` : ''}
          </p>
          {state.data.tutors.length ? (
            <div className="space-y-3">
              {state.data.tutors.map((t) => (
                <article key={t.id} className="card p-4 animate-fade-up">
                  <div className="flex items-start gap-3">
                    <Avatar name={t.tutor?.name} color={t.tutor?.color} size="md" ring={false} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">{t.subject}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] font-semibold muted">
                        {[t.tutor?.name, t.tutor?.branch, t.tutor?.yearLabel].filter(Boolean).join(' · ') || 'Student'}
                        {t.tutor?.verified === true && <BadgeCheck size={11} className="text-brand-500" />}
                        <Rating rating={t.rating} count={t.reviews} />
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[17px] font-extrabold leading-none text-amber-600 dark:text-amber-400">{rupees(t.pricePerHour)}</p>
                      <p className="text-[10.5px] font-bold uppercase tracking-wide muted">per hour</p>
                    </div>
                  </div>
                  {/* if this server carries no description, no sentence is written for them */}
                  {t.description ? <p className="mt-2.5 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">{t.description}</p> : null}
                  <div className="mt-3 flex items-center gap-2">
                    {t.pendingByMe ? (
                      <Button full variant="outline" disabled icon={BadgeCheck}>
                        Request pending
                      </Button>
                    ) : (
                      <Button full icon={ArrowRight} onClick={() => setSheet(t)}>
                        Request session
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={GraduationCap}
              title="No tutor in that range"
              message="Widen the price range or clear the subject — the whole campus is behind it."
              actionLabel="Reset filters"
              onAction={() => {
                setSubject('');
                setRange([0, 1000]);
                setSort('price_asc');
              }}
            />
          )}
        </>
      )}

      <BottomSheet
        open={!!sheet}
        onClose={() => setSheet(null)}
        title="Book this session"
        subtitle={sheet ? `${sheet.tutor?.name || 'Student'} · ${sheet.subject}` : ''}
        footer={
          <Button full size="lg" loading={busy} disabled={busy} icon={BadgeCheck} onClick={send}>
            Send session request
          </Button>
        }
      >
        {sheet && (
          <div className="pb-5 space-y-3">
            <div className="rounded-2xl bg-amber-50 p-3.5 ring-1 ring-amber-100 dark:bg-amber-500/10 dark:ring-amber-500/20">
              <p className="text-[12px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">You will pay</p>
              <p className="mt-1 text-[24px] font-extrabold tracking-tight text-amber-900 dark:text-amber-200">
                {rupees(sheet.pricePerHour)}
                <span className="text-[13px] font-bold text-amber-700/70 dark:text-amber-300/70">/hr</span>
              </p>
              <p className="mt-1 text-[12px] font-medium text-amber-800/80 dark:text-amber-200/80">
                Cash or UPI when you meet. StudentSetu never holds the money.
              </p>
            </div>
            <p className="text-[12.5px] leading-relaxed muted">
              {sheet.tutor?.name || 'They'} see the request now; your email unlocks for both of you when they accept so you can fix a
              time.
            </p>
            {!api.USE_MOCK && (
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold">Start time
                  <input type="datetime-local" className="field mt-1 w-full" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} />
                </label>
                <label className="text-xs font-semibold">End time
                  <input type="datetime-local" className="field mt-1 w-full" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} />
                </label>
              </div>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

function PriceRange({ range, onChange }) {
  const [min, max] = range;
  const pct = (v) => (v / 1000) * 100;
  return (
    <div>
      <div className="relative h-8">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand-600" style={{ left: `${pct(min)}%`, right: `${100 - pct(max)}%` }} />
        <input
          type="range"
          min={0}
          max={1000}
          step={10}
          value={min}
          aria-label="Minimum price per hour"
          onChange={(e) => onChange([Math.min(Number(e.target.value), max - 10), max])}
          className="range-input"
        />
        <input
          type="range"
          min={0}
          max={1000}
          step={10}
          value={max}
          aria-label="Maximum price per hour"
          onChange={(e) => onChange([min, Math.max(Number(e.target.value), min + 10)])}
          className="range-input"
        />
      </div>
      <div className="flex items-center justify-between text-[12px] font-bold text-slate-700 dark:text-slate-200">
        <span>{rupees(min)}</span>
        <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-extrabold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          ₹{min} – ₹{max} / hr
        </span>
        <span>{rupees(max)}</span>
      </div>
    </div>
  );
}

function Teach({ nonce }) {
  const { toast, version } = useApp();
  const [form, setForm] = useState({ subject: '', description: '', price: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [toggling, setToggling] = useState('');
  const state = useAsync(() => api.getMyTeaching(), [version, nonce]);

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (form.subject.trim().length < 3) next.subject = 'Say what you teach';
    if (form.description.trim().length < 10) next.description = 'A line or two more, please (10+ characters)';
    const price = Number(form.price);
    if (!form.price || !Number.isFinite(price) || price <= 0) next.price = 'Enter your hourly price';
    else if (price > 5000) next.price = 'Keep peer prices fair — ₹5000/hr max';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await api.addTeaching({ subject: form.subject.trim(), description: form.description.trim(), pricePerHour: price });
      setForm({ subject: '', description: '', price: '' });
      toast('You are now taking students 🎓', 'success');
      state.reload();
    } catch (err) {
      setErrors({ [err.field || 'form']: err.message });
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (t, active) => {
    setToggling(t.id);
    try {
      await api.setTeachingActive(t.id, active);
      toast(active ? `Resumed — ${t.subject} is visible again` : `Paused — students cannot request ${t.subject}`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setToggling('');
      state.reload();
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="card space-y-3 p-4" noValidate>
        <p className="flex items-center gap-1.5 text-[13px] font-extrabold tracking-tight text-slate-900 dark:text-white">
          <Wallet size={15} className="text-amber-500" /> Teach something, set your rate
        </p>
        <Field label="Subject" htmlFor="teach-subject" error={errors.subject}>
          <input
            id="teach-subject"
            value={form.subject}
            onChange={(e) => set('subject')(e.target.value)}
            placeholder="Data Structures, one-to-one"
            aria-invalid={!!errors.subject}
            className={`field ${errors.subject ? 'field-error' : ''}`}
          />
        </Field>
        <Field label="Short description" htmlFor="teach-desc" error={errors.description}>
          <textarea
            id="teach-desc"
            rows={3}
            value={form.description}
            onChange={(e) => set('description')(e.target.value)}
            placeholder="What you cover, how many you take, what to bring."
            className={`field resize-none ${errors.description ? 'field-error' : ''}`}
          />
        </Field>
        <Field label="Price per hour (₹)" htmlFor="teach-price" error={errors.price} hint="Most second-years charge ₹100–₹250">
          <input
            id="teach-price"
            inputMode="numeric"
            value={form.price}
            onChange={(e) => set('price')(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="200"
            aria-invalid={!!errors.price}
            className={`field ${errors.price ? 'field-error' : ''}`}
          />
        </Field>
        <Button type="submit" full size="lg" loading={busy}>
          Publish my tutoring
        </Button>
      </form>

      <SectionHeader title="My teaching" subtitle="Pause when exams take over" />
      {state.loading ? (
        <ListSkeleton rows={2} />
      ) : state.error ? (
        <ErrorState message={state.error.message} onRetry={state.reload} />
      ) : !state.data.length ? (
        <EmptyState
          icon={GraduationCap}
          title="You are not teaching yet"
          message="Publish a subject above and it appears in every junior's search instantly."
        />
      ) : (
        <div className="space-y-3">
          {state.data.map((t) => (
            <div key={t.id} className={`card p-4 transition ${t.active === false ? 'opacity-70' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-extrabold tracking-tight text-slate-900 dark:text-white">{t.subject}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] muted">
                    <span>{rupees(t.pricePerHour)}/hr</span>
                    <Rating rating={t.rating} count={t.reviews} size={10} />
                    {t.sessionsTaken !== null && t.sessionsTaken !== undefined ? <span>· {t.sessionsTaken} taken</span> : null}
                    {t.pendingStudents ? <span>· {t.pendingStudents} waiting</span> : null}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[10.5px] font-extrabold uppercase ring-1 ${t.active !== false ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25' : 'bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700'}`}>
                  {t.active === false ? 'Paused' : 'Live'}
                </span>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed muted">{t.description}</p>
              <div className="mt-3 flex items-center gap-2 border-t hairline pt-3">
                {toggling === t.id ? (
                  <InlineSpinner label="Updating" />
                ) : (
                  <Switch checked={t.active !== false} onChange={(next) => toggle(t, next)} label={`${t.active === false ? 'Resume' : 'Pause'} ${t.subject}`} />
                )}
                <span className="text-[12.5px] font-bold muted">{t.active === false ? 'Paused — hidden from search' : 'Accepting students'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
