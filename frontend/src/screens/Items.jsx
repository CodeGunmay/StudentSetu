// Renders StudentSetu screens and handles student actions.
import { useEffect, useState } from 'react';
import {
  ArrowUpDown,
  Bell,
  CheckCheck,
  Gift,
  Handshake,
  Package,
  PackageOpen,
  SearchX,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import api from '../api';
import { useApp } from '../context/AppContext';
import { useAsync, useDebounced, copyText } from '../lib/hooks';
import { MODE_STYLE, rupees, timeAgo } from '../lib/format';
import { SectionHeader, TopBar, SearchBar } from '../ui/Chrome';
import Button from '../ui/Button';
import { ItemCard, CategoryIcon } from '../ui/Cards';
import BottomSheet from '../ui/BottomSheet';
import { Fab } from '../ui/BottomNav';
import { EmptyState, ErrorState, ListSkeleton } from '../ui/States';
import { Segmented, Switch } from '../ui/Inputs';
import PullRefresh from '../ui/PullRefresh';

const MODES = [
  { value: 'all', label: 'All' },
  { value: 'free', label: 'Free' },
  { value: 'barter', label: 'Barter' },
  { value: 'sell', label: 'Sell' },
];
const SORTS = [
  { value: 'newest', chip: 'Newest', label: 'Newest first', hint: 'What just landed on campus' },
  { value: 'price_asc', chip: '₹ low → high', label: 'Price: low → high', hint: 'Cheapest paid items on top' },
  { value: 'price_desc', chip: '₹ high → low', label: 'Price: high → low', hint: 'The big-ticket stuff' },
];

/** Items: search / filter the campus board, then manage your own listings. */
export default function Items({ query = '', tab: initialTab = 'browse' }) {
  const { push, version, toast } = useApp();
  const [tab, setTab] = useState(initialTab);
  const [q, setQ] = useState(query);
  const [mode, setMode] = useState('all');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('newest');
  const [sortSheet, setSortSheet] = useState(false);
  const debounced = useDebounced(q, 260);

  useEffect(() => {
    setQ(query);
  }, [query]);

  const categories = useAsync(() => api.getCategories(), [version]);
  const browse = useAsync(async () => {
    const text = debounced.trim();
    const result = text ? await api.searchItems(text, mode, sort) : await api.getBrowse({ mode, sort, category });
    const items = !text || category === 'all' ? result.items : result.items.filter((i) => i.category === category);
    return { ...result, items, total: items.length };
  }, [debounced, mode, sort, category, version]);

  const mine = useAsync(() => api.getMyItems(), [version]);

  const sortChip = SORTS.find((o) => o.value === sort)?.chip || 'Newest';
  const filtersOn = Boolean(debounced.trim()) || mode !== 'all' || category !== 'all';
  const clearFilters = () => {
    setQ('');
    setMode('all');
    setCategory('all');
    setSort('newest');
  };

  return (
    <div className="flex h-full flex-col bg-canvas dark:bg-slate-950">
      <TopBar title="Campus items" subtitle="Give away · barter · sell" />

      <div className="screen-pad pt-2">
        <Segmented
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'browse', label: 'Browse', icon: Package },
            { value: 'mine', label: 'My items', icon: Gift },
          ]}
        />
      </div>

      <div className="relative min-h-0 flex-1">
      {tab === 'browse' ? (
        <PullRefresh onRefresh={() => Promise.all([browse.reload(), categories.reload()])}>
          <div className="min-h-full pb-28">
            <div className="screen-pad space-y-3 pt-2">
              <SearchBar value={q} onChange={setQ} placeholder="Search items — try “calclator”" />

              <div className="no-bar -mx-4 flex gap-2 overflow-x-auto px-4">
                {MODES.map((m) => {
                  const active = mode === m.value;
                  const style = MODE_STYLE[m.value];
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMode(m.value)}
                      aria-pressed={active}
                      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold transition active:scale-95 ${
                        active
                          ? style
                            ? `${style.chip} ring-2`
                            : 'bg-brand-600 text-white shadow-lift'
                          : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700'
                      }`}
                    >
                      {m.value === 'all' && !active ? <SlidersHorizontal size={13} /> : null}
                      {m.value === 'all' && active ? <Sparkles size={13} /> : null}
                      {m.label}
                    </button>
                  );
                })}
                <span className="inline-flex h-9 shrink-0 items-center gap-1 pl-1 text-[11.5px] font-bold uppercase tracking-wide text-slate-400">
                  swipe →
                </span>
              </div>

              {!!categories.data?.length && (
                <div className="no-bar -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5">
                  <CategoryChip label="Everything" active={category === 'all'} onClick={() => setCategory('all')} />
                  {categories.data.map((c) => (
                    <CategoryChip
                      key={c.name}
                      // GET /api/items/categories returns names only: no count, no fake "· 0"
                      label={c.count === null || c.count === undefined ? c.name : `${c.name} · ${c.count}`}
                      category={c.name}
                      active={category === c.name}
                      onClick={() => setCategory(category === c.name ? 'all' : c.name)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 screen-pad">
              {browse.loading ? (
                <ListSkeleton rows={4} />
              ) : browse.error ? (
                <ErrorState message={browse.error.message} onRetry={browse.reload} />
              ) : (
                <>
                  <div className="mb-2.5 flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                        {browse.data.total} {debounced.trim() ? `match${browse.data.total === 1 ? '' : 'es'}` : `listing${browse.data.total === 1 ? '' : 's'}`}
                      </h2>
                      <p className="mt-0.5 truncate text-[12px] muted">
                        {debounced.trim()
                          ? `for “${debounced.trim()}”`
                          : mode === 'all'
                          ? 'Everything on the board'
                          : `${MODE_STYLE[mode].label} only`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {filtersOn && (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="h-8 rounded-full px-2.5 text-[12.5px] font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                        >
                          Clear
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSortSheet(true)}
                        aria-label="Sort listings"
                        className="inline-flex h-8 items-center gap-1 rounded-full bg-slate-100 px-2.5 text-[12.5px] font-bold text-slate-700 ring-1 ring-slate-200 transition active:scale-95 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
                      >
                        <ArrowUpDown size={12} /> {sortChip}
                      </button>
                    </div>
                  </div>

                  {browse.data.suggestion && !browse.data.items.length && (
                    <button
                      type="button"
                      onClick={() => setQ(browse.data.suggestion.text)}
                      className="card mb-3 flex w-full items-center gap-2.5 p-3 text-left active:scale-[.99]"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-500 dark:bg-amber-500/10">
                        <Sparkles size={16} />
                      </span>
                      <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                        Did you mean{' '}
                        <span className="font-extrabold text-brand-600 dark:text-brand-300">“{browse.data.suggestion.text}”</span>?
                      </span>
                    </button>
                  )}

                  {browse.data.items.length ? (
                    <div className="space-y-3 animate-fade-up">
                      {browse.data.items.map((item) => (
                        <ItemCard key={item.id} item={item} onClick={() => push('item', { id: item.id })} />
                      ))}
                    </div>
                  ) : !browse.data.suggestion ? (
                    <EmptyState
                      icon={SearchX}
                      title="Nothing on the board for that"
                      message={
                        debounced.trim()
                          ? `Nothing on the board matched “${debounced.trim()}”. Try a shorter word, or clear the filters.`
                          : 'No listings match these filters yet. List your own and it appears here instantly.'
                      }
                      actionLabel="List an item"
                      onAction={() => push('listItem')}
                      secondaryLabel="Clear filters"
                      onSecondary={() => {
                        setQ('');
                        setMode('all');
                        setCategory('all');
                      }}
                    />
                  ) : null}
                </>
              )}
            </div>
          </div>
        </PullRefresh>
      ) : (
        <PullRefresh onRefresh={mine.reload}>
          <div className="min-h-full pb-28 pt-2">
            <MyItemList
              state={mine}
              onOpen={(id) => push('item', { id })}
              onList={() => push('listItem')}
              toast={toast}
            />
          </div>
        </PullRefresh>
      )}
      </div>

      <Fab onClick={() => push('listItem')} />

      <BottomSheet open={sortSheet} onClose={() => setSortSheet(false)} title="Sort listings" subtitle="Applies to your search and filters">
        <div className="space-y-2 pb-4">
          {SORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => {
                setSort(s.value);
                setSortSheet(false);
              }}
              className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
                sort === s.value
                  ? 'border-brand-500 bg-brand-50/70 dark:border-brand-400 dark:bg-brand-500/10'
                  : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
              }`}
            >
              <span className="flex-1">
                <span className="block text-[14px] font-bold text-slate-900 dark:text-white">{s.label}</span>
                <span className="block text-[12px] muted">{s.hint}</span>
              </span>
              {sort === s.value && <CheckCheck size={17} className="text-brand-600 dark:text-brand-300" />}
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}

function CategoryChip({ label, active, onClick, category }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-bold transition active:scale-95 ${
        active
          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
      }`}
    >
      {category && <CategoryIcon category={category} size={13} />}
      {label}
    </button>
  );
}

/** Owner view: status, waitlist queue, hand-off, availability, remove. */
function MyItemList({ state, onOpen, onList, toast }) {
  const [handoff, setHandoff] = useState(null); // item awaiting confirmation
  const [result, setResult] = useState(null); // hand-off result (who got it)
  const [remove, setRemove] = useState(null);
  const [busy, setBusy] = useState('');

  if (state.loading) {
    return (
      <div className="screen-pad">
        <ListSkeleton rows={3} />
      </div>
    );
  }
  if (state.error) {
    return (
      <div className="screen-pad">
        <ErrorState message={state.error.message} onRetry={state.reload} />
      </div>
    );
  }
  const list = state.data || [];

  const confirmHandoff = async () => {
    if (busy) return; // one tap is one hand-off
    const target = handoff;
    setBusy('handoff');
    try {
      const res = await api.handOff(target.id);
      // the receipt repeats only what the server confirmed; the title comes from
      // the row we were standing on, because this reply does not carry one
      setHandoff(null);
      setResult({ ...res, itemTitle: res.itemTitle || target.title });
      toast(
        res.to
          ? `${res.to.name} got “${res.itemTitle || target.title}”${res.to.email ? ' — contact details shared' : ''}`
          : `“${res.itemTitle || target.title}” is marked taken`,
        'success'
      );
      await state.reload(); // authoritative: availability, queue, request count
    } catch (err) {
      toast(err.message, 'error');
      await state.reload(); // a 409 means someone else changed it — show the truth
      setHandoff(null);
    } finally {
      setBusy('');
    }
  };

  const toggle = async (item, next) => {
    if (busy) return;
    setBusy(item.id);
    try {
      await api.setItemActive(item.id, next);
      toast(next ? `“${item.title}” is back on the board` : `“${item.title}” hidden from the board`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
      state.reload();
    }
  };

  const doRemove = async () => {
    if (busy) return;
    setBusy('remove');
    try {
      const res = await api.removeItem(remove.id);
      toast(res?.title ? `“${res.title}” removed. Pending requests were closed.` : `“${remove.title}” is off the board. Pending requests were closed.`, 'success');
      setRemove(null);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
      state.reload();
    }
  };

  return (
    <div className="screen-pad">
      <SectionHeader title="Your listings" subtitle={`${list.length} total · ${list.filter((i) => i.available !== false).length} available`} />
      {!list.length ? (
        <EmptyState
          icon={PackageOpen}
          title="You have not listed anything"
          message="Free, barter or sell — it takes 20 seconds and stays inside your college."
          actionLabel="List your first item"
          onAction={onList}
        />
      ) : (
        <div className="space-y-3">
          {list.map((item) => (
            <div key={item.id} className="card p-3.5 animate-fade-up">
              <button type="button" onClick={() => onOpen(item.id)} className="flex w-full gap-3 text-left">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800">
                  <CategoryIcon category={item.category} size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-1 text-[14.5px] font-bold tracking-tight text-slate-900 dark:text-white">{item.title}</h3>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ring-1 ${item.available !== false ? MODE_STYLE[item.mode].chip : 'bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700'}`}>
                      {item.available === false ? 'Taken' : MODE_STYLE[item.mode].label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] muted">
                    {item.category} · {item.mode === 'sell' ? rupees(item.price) : item.mode === 'barter' ? `wants ${item.wants.join(', ')}` : 'Free'} ·{' '}
                    {timeAgo(item.createdAt)}
                  </p>
                  <p className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11.5px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <Bell size={11} />
                    {item.mode === 'free'
                      ? item.waitlistCount === null || item.waitlistCount === undefined
                        ? 'Queue size not reported'
                        : `${item.waitlistCount} waiting${item.waitlistCount && item.waitingNames?.length ? ` · ${item.waitingNames.slice(0, 2).join(', ')}` : ''}`
                      : item.openRequests === null || item.openRequests === undefined
                      ? 'Open requests not reported'
                      : `${item.openRequests} open request${item.openRequests === 1 ? '' : 's'}`}
                  </p>
                </div>
              </button>

              <div className="mt-3 flex items-center gap-2 border-t hairline pt-3">
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={item.available !== false}
                    disabled={busy === item.id}
                    onChange={(next) => toggle(item, next)}
                    label={`Make ${item.title} ${item.available === false ? 'available' : 'unavailable'}`}
                  />
                  <span className="text-[11.5px] font-bold muted">{item.available === false ? 'Hidden' : 'Available'}</span>
                </div>
                {item.mode === 'free' && item.available !== false && item.waitlistCount > 0 && (
                  <Button size="sm" variant="accent" icon={Gift} className="ml-auto" disabled={Boolean(busy)} onClick={() => setHandoff(item)}>
                    Give to next
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => setRemove(item)}
                  aria-label={`Remove ${item.title}`}
                  className="ml-auto grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* confirm who gets the free item */}
      <BottomSheet
        open={!!handoff}
        onClose={() => setHandoff(null)}
        title="Give to next in line"
        subtitle={handoff ? `${handoff.waitlistCount} person${handoff.waitlistCount === 1 ? '' : 's'} waiting` : ''}
        footer={
          <div className="flex gap-2">
            <Button variant="outline" full onClick={() => setHandoff(null)}>
              Not now
            </Button>
            <Button variant="accent" full icon={Handshake} loading={busy === 'handoff'} onClick={confirmHandoff}>
              Confirm hand-off
            </Button>
          </div>
        }
      >
        {handoff && (
          <div className="pb-4">
            <div className="rounded-2xl bg-emerald-50 p-3.5 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/20">
              <p className="text-[12px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">First in line</p>
              <p className="mt-1 text-[15px] font-extrabold text-emerald-900 dark:text-white">
                {handoff.waitingNames?.[0] || 'Whoever is first in line'}
              </p>
              <p className="mt-1 text-[12.5px] font-medium text-emerald-800/80 dark:text-emerald-200/80">
                {handoff.waitingNames?.length
                  ? 'Their email is shared with you, and yours with them, so you can arrange the pickup.'
                  : 'This source does not say who is first — the hand-off reply will name them once you confirm.'}
              </p>
            </div>
            <p className="mt-3 flex items-start gap-2 text-[12.5px] leading-snug muted">
              <Package size={14} className="mt-0.5 shrink-0" />
              “{handoff.title}” will be marked taken and everyone else in the queue is told it is gone.
            </p>
          </div>
        )}
      </BottomSheet>

      {/* hand-off receipt */}
      <BottomSheet
        open={!!result}
        onClose={() => setResult(null)}
        title="Handed over 🎉"
        subtitle={result?.to ? `${result.to.name} got the item` : result ? 'Hand-off recorded' : ''}
        footer={
          <Button
            full
            onClick={() => {
              setResult(null);
              state.reload();
            }}
          >
            Done
          </Button>
        }
      >
        {result && (
          <div className="pb-4">
            <div className="card p-3.5">
              <p className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
                <span className="font-extrabold">“{result.itemTitle}”</span>
                {result.to ? (
                  <>
                    {' '}went to <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{result.to.name}</span>. An accepted
                    request now sits in both your activity lists.
                  </>
                ) : (
                  <> is marked taken. Nobody else can claim it.</>
                )}
              </p>
              {/* the email only appears if the hand-off reply actually carried one */}
              {result.to?.email && (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-slate-100 px-3 py-2.5 dark:bg-slate-800">
                  <span className="truncate text-[13px] font-semibold text-slate-700 dark:text-slate-200">{result.to.email}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyText(result.to.email);
                      toast(ok ? 'Email copied' : 'Could not copy', ok ? 'success' : 'error');
                    }}
                    className="shrink-0 rounded-lg bg-white px-2 py-1 text-[11.5px] font-bold text-brand-600 dark:bg-slate-900 dark:text-brand-300"
                  >
                    Copy
                  </button>
                </div>
              )}
              {result.remaining > 0 && (
                <p className="mt-2.5 text-[12px] font-semibold text-amber-600 dark:text-amber-400">
                  {result.remaining} other{result.remaining > 1 ? 's' : ''} still in line — they have been told it is gone.
                </p>
              )}
            </div>
          </div>
        )}
      </BottomSheet>

      {/* remove confirmation */}
      <BottomSheet
        open={!!remove}
        onClose={() => setRemove(null)}
        title="Remove this listing?"
        subtitle={remove?.title}
        footer={
          <div className="flex gap-2">
            <Button variant="outline" full onClick={() => setRemove(null)}>
              Keep it
            </Button>
            <Button variant="danger" full icon={Trash2} loading={busy === 'remove'} onClick={doRemove}>
              Remove
            </Button>
          </div>
        }
      >
        <p className="pb-5 text-[13px] leading-relaxed muted">
          It disappears from the board and any pending requests for it are closed. People who joined the waitlist keep nothing — you can relist
          any time.
        </p>
      </BottomSheet>
    </div>
  );
}
