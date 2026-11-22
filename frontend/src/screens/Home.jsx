// Renders StudentSetu screens and handles student actions.
import { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  GraduationCap,
  Package,
  Repeat,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import api from '../api';
import { useApp } from '../context/AppContext';
import { useAsync, useDebounced } from '../lib/hooks';
import { rupees, timeAgo } from '../lib/format';
import Rating from '../ui/Stars';
import Avatar from '../ui/Avatar';
import { ItemCard, MiniItemCard, ModeTag } from '../ui/Cards';
import { SearchBar } from '../ui/Chrome';
import Row from '../ui/Row';
import { CardSkeleton, InlineSpinner, ListSkeleton } from '../ui/States';
import PullRefresh from '../ui/PullRefresh';

/** Home: greeting, one search, three big doors, and what is moving on campus. */
export default function Home() {
  const { user, push, goTab, version, pendingCount } = useApp();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 320);

  // "Top tutors" is the server's ranking (GET /api/top-tutors?k=) — re-sorting
  // the price-ordered page locally would call the cheapest tutors the best.
  const feed = useAsync(() => Promise.all([api.getBrowse({ sort: 'newest', limit: 8 }), api.getTopTutors(6)]), [version]);

  const wantsKey = (user?.wants || []).join('|');
  const matches = useAsync(async () => {
    const q = debounced.trim();
    if (!q) return { items: [], suggestion: null };
    return api.searchItems(q, 'all', 'newest');
  }, [debounced, version]);

  const swaps = useAsync(async () => {
    const wanted = user?.wants || [];
    if (!wanted.length) return { list: [], circle: null };
    const results = await Promise.all(wanted.map((s) => api.findBarter(s)));
    const seen = new Set();
    const list = [];
    results.forEach((r, i) => {
      r.swaps.forEach((s) => {
        if (seen.has(s.peer.id)) return;
        seen.add(s.peer.id);
        list.push({ ...s, skill: wanted[i] });
      });
    });
    const circle = results.find((r) => r.circle)?.circle || null;
    return { list, circle, circleSkill: results.find((r) => r.circle) ? wanted[results.findIndex((r) => r.circle)] : null };
  }, [wantsKey, version]);

  const items = feed.data?.[0]?.items || [];
  const tutors = feed.data?.[1]?.tutors || [];

  const openItem = (id) => push('item', { id });

  return (
    <PullRefresh onRefresh={() => Promise.all([feed.reload(), swaps.reload(), matches.reload()])}>
      <div className="min-h-full pb-6">
        {/* hero ---------------------------------------------------------- */}
        <header className="relative overflow-hidden rounded-b-[30px] bg-brand-600 px-4 pb-16 pt-3 text-white">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-400/40 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-24 left-10 h-40 w-40 rounded-full bg-accent-500/25 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-white/60">StudentSetu</p>
              <h1 className="truncate text-[22px] font-extrabold tracking-tight">Hi, {user?.name} 👋</h1>
              <p className="mt-0.5 text-[12.5px] font-medium text-white/70">
                Graphic Era · {user?.branch} · {user?.yearLabel}
              </p>
            </div>
            <button type="button" onClick={() => push('profile')} aria-label="Open your profile" className="relative rounded-full active:scale-95">
              <Avatar name={user?.name} color={user?.color} size="md" ring={false} className="ring-2 ring-white/40" />
              {pendingCount > 0 && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-accent-500 ring-2 ring-brand-600" />}
            </button>
          </div>

          <div className="relative mt-4">
            <SearchBar value={query} onChange={setQuery} placeholder="Search items or skills" onSubmit={() => goTab('items', { query })} />
          </div>
          <div className="relative mt-2 flex items-center gap-2 text-[11.5px] font-semibold text-white/70">
            <Sparkles size={12} /> {items.length} fresh listings · {(user?.teaches || []).length} skills you teach
          </div>
        </header>

        {/* quick results while typing ----------------------------------- */}
        {debounced.trim().length >= 2 && (
          <section className="screen-pad -mt-11">
            <div className="card animate-fade-up p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Results for “{debounced.trim()}”
                </h2>
                <button
                  type="button"
                  onClick={() => goTab('items')}
                  className="inline-flex items-center gap-0.5 text-[12px] font-bold text-brand-600 dark:text-brand-300"
                >
                  See all <ArrowRight size={13} />
                </button>
              </div>
              {matches.loading ? (
                <InlineSpinner label="Searching campus listings" />
              ) : matches.error ? (
                <p className="text-[12.5px] font-medium text-rose-600 dark:text-rose-400">{matches.error.message}</p>
              ) : (
                <div className="space-y-2">
                  {matches.data.items.slice(0, 3).map((item) => (
                    <ItemCard key={item.id} item={item} dense onClick={() => openItem(item.id)} />
                  ))}
                  {!matches.data.items.length && (
                    <p className="text-[12.5px] muted">
                      No items matched.{' '}
                      {matches.data.suggestion && (
                        <button
                          type="button"
                          onClick={() => setQuery(matches.data.suggestion.text)}
                          className="font-bold text-brand-600 dark:text-brand-300"
                        >
                          Did you mean “{matches.data.suggestion.text}”?
                        </button>
                      )}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => goTab('skills', { tab: 'barter', skill: debounced.trim() })}
                    className="flex w-full items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-left text-[13px] font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-200"
                  >
                    <Repeat size={15} /> Look for “{debounced.trim()}” in skill swaps
                    <ArrowRight size={14} className="ml-auto" />
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* three feature cards ------------------------------------------ */}
        {!matches.loading && !debounced.trim() && (
          <section className="screen-pad -mt-11">
            <div className="grid grid-cols-2 gap-3">
              <FeatureCard
                icon={Package}
                title="Items"
                sub="Give away · barter · sell"
                onClick={() => goTab('items')}
                tone="bg-emerald-500"
              />
              <FeatureCard
                icon={GraduationCap}
                title="Skills"
                sub="Barter + paid tutors"
                onClick={() => goTab('skills')}
                tone="bg-purple-500"
              />
            </div>
            <button
              type="button"
              onClick={() => goTab('activity')}
              className="card mt-3 flex w-full items-center gap-3 p-3.5 text-left transition active:scale-[.99]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                <Bell size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-extrabold tracking-tight text-slate-900 dark:text-white">My Activity</span>
                <span className="block text-[12px] muted">Swap requests, offers and sessions</span>
              </span>
              {pendingCount > 0 ? (
                <span className="shrink-0 rounded-full bg-rose-500 px-2 py-1 text-[11px] font-extrabold text-white">{pendingCount} new</span>
              ) : (
                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-extrabold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                  All caught up
                </span>
              )}
            </button>
          </section>
        )}

        {/* swaps for you -------------------------------------------------- */}
        <section className="mt-7">
          <Row
            title="Swaps for you"
            subtitle="They teach what you want — and want what you teach"
            actionLabel="Find more"
            onAction={() => goTab('skills', { tab: 'barter' })}
            loading={swaps.loading}
            empty={
              swaps.data && !swaps.data.list.length && !swaps.data.circle
                ? user?.wants?.length
                  ? 'No two-way swap yet. Add another skill you teach in Profile to unlock more matches.'
                  : 'Add skills you want to learn in Profile and we will find your swaps.'
                : null
            }
          >
            {swaps.data?.list.map((s) => (
              <button
                key={s.peer.id}
                type="button"
                onClick={() => push('skills', { tab: 'barter', skill: s.skill })}
                className="card w-[236px] shrink-0 snap-start-item p-3.5 text-left transition active:scale-[.98]"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={s.peer.name} color={s.peer.color} size="md" ring={false} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-slate-900 dark:text-white">{s.peer.name}</p>
                    <p className="truncate text-[11.5px] muted">
                      {s.peer.branch} · {s.peer.yearLabel}
                    </p>
                  </div>
                  <span className="rounded-full bg-brand-600 px-2 py-1 text-[10px] font-extrabold text-white">
                    {s.score} skill{s.score > 1 ? 's' : ''} match
                  </span>
                </div>
                <div className="mt-3 space-y-1.5">
                  <SwapLine label="Teaches you" value={s.skill} tone="text-emerald-600 dark:text-emerald-400" />
                  <SwapLine label="Wants from you" value={s.wantsFromYou.join(', ')} tone="text-purple-600 dark:text-purple-400" />
                </div>
              </button>
            ))}
            {swaps.data?.circle && (
              <button
                type="button"
                onClick={() => push('skills', { tab: 'barter', skill: swaps.data.circleSkill })}
                className="w-[236px] shrink-0 snap-start-item rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-700 p-3.5 text-left text-white shadow-lift transition active:scale-[.98]"
              >
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide">
                  <TrendingUp size={11} /> Exchange circle
                </span>
                <p className="mt-2.5 text-[14.5px] font-extrabold leading-tight">
                  {swaps.data.circle.people.map((p) => p.name).join(' → ')}
                </p>
                <p className="mt-1 text-[11.5px] text-white/75">
                  {swaps.data.circleSkill ? `You learn ${swaps.data.circleSkill}` : 'Circular swap'} · {swaps.data.circle.size} people
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold">
                  Open the circle <ArrowRight size={13} />
                </span>
              </button>
            )}
          </Row>
        </section>

        {/* recent items --------------------------------------------------- */}
        <section className="mt-7">
          <Row
            title="Recently listed items"
            actionLabel="Browse all"
            onAction={() => goTab('items')}
            loading={feed.loading}
            empty={feed.data && !items.length ? 'Nothing listed yet today. Be the first — tap + on the Items tab.' : null}
          >
            {items.map((item) => (
              <MiniItemCard key={item.id} item={item} onClick={() => openItem(item.id)} />
            ))}
          </Row>
        </section>

        {/* top tutors ----------------------------------------------------- */}
        <section className="mt-7">
          <Row
            title="Top tutors"
            subtitle="Paid sessions with students, per hour"
            actionLabel="Find a tutor"
            onAction={() => goTab('skills', { tab: 'paid' })}
            loading={feed.loading}
            empty={feed.data && !tutors.length ? 'No tutors are taking students right now.' : null}
          >
            {tutors.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => push('skills', { tab: 'paid', side: 'learn', subject: t.subject })}
                className="card w-[212px] shrink-0 snap-start-item p-3.5 text-left transition active:scale-[.98]"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={t.person?.name} color={t.person?.color} size="sm" ring={false} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate text-[13.5px] font-bold text-slate-900 dark:text-white">
                      {t.person?.name || 'Student'}
                      {t.person?.verified === true && <BadgeCheck size={11} className="shrink-0 text-brand-500" />}
                    </p>
                    <Rating rating={t.rating} count={t.ratingCount} className="text-[11px]" />
                  </div>
                </div>
                <p className="mt-2.5 line-clamp-2 text-[13px] font-semibold leading-snug text-slate-800 dark:text-slate-100">{t.subject}</p>
                <div className="mt-2.5 flex items-center justify-between">
                  {t.pricePerHour === null || t.pricePerHour === undefined ? (
                    <span className="text-[12px] font-semibold italic muted">Price not set</span>
                  ) : (
                    <span className="text-[15px] font-extrabold text-amber-600 dark:text-amber-400">
                      {rupees(t.pricePerHour)}
                      <span className="text-[11px] font-bold muted">/hr</span>
                    </span>
                  )}
                  {/* the server does not date these rows, so no "2h ago" is invented */}
                  {t.createdAt ? (
                    <ModeTag mode="paid" size="xs">
                      {timeAgo(t.createdAt)}
                    </ModeTag>
                  ) : null}
                </div>
              </button>
            ))}
          </Row>
        </section>

        {feed.loading && (
          <div className="mt-6 space-y-3 px-4">
            <CardSkeleton />
            <ListSkeleton rows={2} />
          </div>
        )}
      </div>
    </PullRefresh>
  );
}

function FeatureCard({ icon: Icon, title, sub, onClick, tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card relative overflow-hidden p-3.5 text-left transition active:scale-[.98] hover:shadow-lg"
    >
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tone} text-white shadow-md`}>
        <Icon size={19} />
      </span>
      <p className="mt-3 text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</p>
      <p className="mt-0.5 text-[11.5px] font-medium muted">{sub}</p>
      <ArrowRight size={15} className="absolute right-3 top-3.5 text-slate-300 dark:text-slate-600" />
    </button>
  );
}

function SwapLine({ label, value, tone }) {
  return (
    <p className="text-[11.5px] leading-tight">
      <span className="font-semibold muted">{label}: </span>
      <span className={`font-extrabold ${tone}`}>{value || '—'}</span>
    </p>
  );
}
