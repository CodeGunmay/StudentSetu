// Renders StudentSetu screens and handles student actions.
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCheck,
  Gift,
  Handshake,
  Info,
  Lock,
  MapPin,
  Repeat,
  ShoppingBag,
  Tag,
} from 'lucide-react';
import api from '../api';
import { useApp } from '../context/AppContext';
import { useAsync } from '../lib/hooks';
import { CATEGORY_ART, MODE_STYLE, rupees, timeAgo } from '../lib/format';
import Rating from '../ui/Stars';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import { CategoryIcon, ItemCard } from '../ui/Cards';
import { SectionHeader, TopBar } from '../ui/Chrome';
import BottomSheet from '../ui/BottomSheet';
import { PickRow } from '../ui/Inputs';
import { ErrorState, Skeleton } from '../ui/States';

/** One listing, one clear action depending on the mode. */
export default function ItemDetail({ id }) {
  const { pop, push, goTab, version, toast } = useApp();
  const [offerSheet, setOfferSheet] = useState(false);
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState('');
  const [done, setDone] = useState(null);
  const [joined, setJoined] = useState(null);

  const state = useAsync(() => api.getItem(id), [id, version]);
  const mine = useAsync(() => api.getMyItems(), [version]);
  const similar = useAsync(() => api.getBrowse({ sort: 'newest', limit: 6 }), [version]);

  const item = state.data;
  const modeStyle = MODE_STYLE[item?.mode || 'free'];

  const myOffers = useMemo(
    () => (mine.data || []).filter((i) => i.available !== false && !i.requestedByMe && i.mode !== 'free'),
    [mine.data]
  );

  // A queue place is only real when the source says where I stand: a list of
  // names waiting is not evidence that I am number anything.
  const position = item?.position ?? joined?.position ?? null;
  const queueKnown = item?.waitlistCount !== null && item?.waitlistCount !== undefined;

  const act = async (kind) => {
    if (busy) return; // one tap = one request; a double tap must not make two
    setBusy(kind);
    try {
      if (kind === 'waitlist') {
        const res = await api.joinWaitlist(id);
        setJoined(res);
        toast(
          res.position
            ? `You are #${res.position} in line for “${item.title}”`
            : `You are on the list for “${item.title}” — the owner will pick who is next`,
          'success'
        );
      } else {
        const res = await api.requestItem(id, kind === 'barter' ? picked : null);
        setOfferSheet(false);
        setDone(res);
        toast('Request sent — you will see their email when they accept', 'success');
      }
      await state.reload(); // the server's copy of availability + queue is the one we show
    } catch (err) {
      toast(err.message, 'error');
      // 409 = someone got there first (or the listing changed): re-read it
      if (err.status === 409 || err.status === 404) {
        setJoined(null);
        await Promise.all([state.reload(), mine.reload()]);
      }
    } finally {
      setBusy('');
    }
  };

  if (state.loading) {
    return (
      <div className="flex h-full flex-col bg-canvas dark:bg-slate-950">
        <TopBar title="Item" onBack={pop} right={<span />} />
        <div className="space-y-3 p-4">
          <Skeleton className="h-52 w-full rounded-2xl" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>
    );
  }
  if (state.error || !item) {
    return (
      <div className="flex h-full flex-col bg-canvas dark:bg-slate-950">
        <TopBar title="Item" onBack={pop} right={<span />} />
        <div className="p-4">
          <ErrorState message={state.error?.message || 'This listing is gone.'} onRetry={state.reload} />
        </div>
      </div>
    );
  }

  const art = CATEGORY_ART[item.category] || CATEGORY_ART.Other;

  return (
    <div className="flex h-full flex-col bg-canvas dark:bg-slate-950">
      <TopBar title={item.available === false ? 'Taken' : item.modeLabel} subtitle={item.category} onBack={pop} right={<span />} />

      <div className="no-bar flex-1 overflow-y-auto pb-40">
        {/* art */}
        <div className="px-4">
          <div className={`relative grid h-52 place-items-center overflow-hidden rounded-[26px] bg-gradient-to-br ${art.gradient} dark:from-slate-800 dark:to-slate-900`}>
            <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(circle at 78% 12%, rgba(255,255,255,.9), transparent 42%)' }} />
            <span className="relative text-slate-800 dark:text-slate-200">
              <CategoryIcon category={item.category} size={62} className="opacity-90" />
            </span>
            <span className="absolute left-3 top-3">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide ring-1 backdrop-blur ${modeStyle.chip}`}>
                {item.mode === 'free' ? <Gift size={11} /> : item.mode === 'barter' ? <Repeat size={11} /> : <Tag size={11} />}
                {item.modeLabel}
                {item.mode === 'sell' ? ` · ${rupees(item.price)}` : ''}
              </span>
            </span>
            {item.available === false && (
              <div className="absolute inset-0 grid place-items-center bg-slate-900/60 text-[15px] font-extrabold uppercase tracking-widest text-white">
                Already taken
              </div>
            )}
            {item.createdAt ? (
              <span className="absolute bottom-3 right-3 rounded-full bg-white/80 px-2 py-1 text-[11px] font-bold text-slate-600 backdrop-blur dark:bg-slate-900/80 dark:text-slate-300">
                {timeAgo(item.createdAt)}
              </span>
            ) : null}
          </div>
        </div>

        {/* headline */}
        <div className="mt-4 px-4">
          <h1 className="text-[22px] font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white">{item.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11.5px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {item.category}
            </span>
            {/* only shown when the API carries a condition at all */}
            {item.condition ? (
              <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11.5px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {item.condition}
              </span>
            ) : null}
            {item.isMine && (
              <span className="rounded-lg bg-brand-50 px-2 py-1 text-[11.5px] font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                Your listing
              </span>
            )}
          </div>
          {item.description === null || item.description === undefined ? null : (
            <p className="mt-3 text-[14px] leading-relaxed text-slate-700 dark:text-slate-300">
              {item.description || 'The owner did not add a description.'}
            </p>
          )}
        </div>

        {/* mode-specific block */}
        <div className="mt-4 px-4">
          {item.mode === 'free' && (
            <div className="card p-4">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <CalendarClock size={17} />
                </span>
                <div className="flex-1">
                  <p className="text-[14px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {queueKnown
                      ? `${item.waitlistCount} ${item.waitlistCount === 1 ? 'person' : 'people'} in line`
                      : 'Ask the owner who is next'}
                  </p>
                  <p className="text-[12px] muted">
                    {queueKnown ? 'First come, first served — the owner hands it to #1' : 'This server does not report the queue length'}
                  </p>
                </div>
              </div>
              {position ? (
                <div className="mt-3 rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/20">
                  <p className="text-[13.5px] font-extrabold text-emerald-800 dark:text-emerald-300">You are #{position} in line</p>
                  {item.peopleAhead?.length ? (
                    <p className="mt-1 text-[12px] font-medium text-emerald-700/80 dark:text-emerald-200/80">
                      Ahead of you: {item.peopleAhead.join(', ')}
                    </p>
                  ) : position === 1 ? (
                    <p className="mt-1 text-[12px] font-medium text-emerald-700/80 dark:text-emerald-200/80">Nobody is ahead — you are next.</p>
                  ) : (
                    <p className="mt-1 text-[12px] font-medium text-emerald-700/80 dark:text-emerald-200/80">
                      {queueKnown && item.waitlistCount > position
                        ? `${item.waitlistCount - position} other${item.waitlistCount - position === 1 ? '' : 's'} behind you`
                        : 'Waiting your turn'}
                    </p>
                  )}
                </div>
              ) : item.isWaiting ? (
                <div className="mt-3 rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/20">
                  <p className="text-[13.5px] font-extrabold text-emerald-800 dark:text-emerald-300">You are on this list</p>
                  <p className="mt-1 text-[12px] font-medium text-emerald-700/80 dark:text-emerald-200/80">
                    The server did not say which place is yours, so no number is shown.
                  </p>
                </div>
              ) : null}
            </div>
          )}

          {item.mode === 'barter' && (
            <div className="card p-4">
              <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-purple-500">
                <Repeat size={13} /> What they want in return
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.wants.map((w) => (
                  <span key={w} className="rounded-lg bg-purple-50 px-2.5 py-1.5 text-[13px] font-bold text-purple-700 ring-1 ring-purple-100 dark:bg-purple-500/10 dark:text-purple-300 dark:ring-purple-500/20">
                    {w}
                  </span>
                ))}
              </div>
              <p className="mt-2.5 text-[12.5px] leading-snug muted">
                Pick something of yours to offer — {item.owner?.name} accepts or declines, and only then are emails shared.
              </p>
            </div>
          )}

          {item.mode === 'sell' && (
            <div className="card flex items-center gap-3 p-4">
              <span className="text-[26px] font-extrabold tracking-tight text-blue-600 dark:text-blue-400">{rupees(item.price)}</span>
              <span className="text-[12.5px] font-semibold muted">
                one-time · pay when you meet
                <br />
                StudentSetu never touches the money.
              </span>
            </div>
          )}
        </div>

        {/* owner */}
        <div className="mt-4 px-4">
          <SectionHeader title="Listed by" />
          <div className="card flex items-center gap-3 p-4">
            <Avatar name={item.owner?.name} color={item.owner?.color} size="lg" ring={false} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-[14.5px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                {item.owner?.name || 'Student'}
                {item.owner?.verified === true && <BadgeCheck size={14} className="shrink-0 text-brand-500" />}
              </p>
              <p className="truncate text-[12px] muted">
                {[item.owner?.branch, item.owner?.yearLabel, item.owner?.teaches?.length ? `${item.owner.teaches.length} skills to teach` : null]
                  .filter(Boolean)
                  .join(' · ') || 'No details on this account'}
              </p>
              <p className="mt-1 flex items-center gap-1 text-[11.5px] font-semibold text-slate-400">
                <Lock size={11} /> Email hidden until you both agree
              </p>
            </div>
            <div className="shrink-0 text-right">
              <Rating rating={item.owner?.rating} count={item.owner?.ratingCount} />
            </div>
          </div>
        </div>

        {/* safety */}
        <div className="mt-4 px-4">
          <div className="rounded-2xl bg-slate-900 p-4 text-white dark:bg-slate-900 dark:ring-1 dark:ring-slate-800">
            <p className="flex items-center gap-1.5 text-[13px] font-extrabold">
              <Info size={14} className="text-accent-400" /> Campus handover tips
            </p>
            <ul className="mt-2 space-y-1 text-[12.5px] leading-snug text-white/70">
              <li>· Meet at the library or canteen — always a public spot.</li>
              <li>· Check the item before you pay; no refunds through the app.</li>
              <li>· Keep the chat on StudentSetu until you have each other's email.</li>
            </ul>
            <p className="mt-2.5 flex items-center gap-1.5 text-[11.5px] font-bold text-white/50">
              <MapPin size={12} /> Graphic Era Hill University, Dehradun
            </p>
          </div>
        </div>

        {/* similar */}
        {similar.data?.items?.filter((i) => i.id !== item.id).length > 0 && (
          <div className="mt-6">
            <div className="screen-pad">
              <SectionHeader title="More from campus" subtitle="People who listed this week" />
            </div>
            <div className="no-bar snap-x-row flex gap-3 overflow-x-auto px-4">
              {similar.data.items
                .filter((i) => i.id !== item.id)
                .slice(0, 4)
                .map((other) => (
                  <div key={other.id} className="w-[264px] shrink-0 snap-start-item">
                    <ItemCard item={other} dense onClick={() => push('item', { id: other.id })} />
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* action bar */}
      <div className="absolute inset-x-0 bottom-0 z-30 border-t hairline bg-white/95 px-4 pb-4 pt-3 backdrop-blur-xl dark:bg-slate-950/90">
        {item.isMine ? (
          <div className="flex gap-2">
            <Button variant="outline" full icon={Tag} onClick={() => goTab('items', { tab: 'mine' })}>
              Manage listing
            </Button>
          </div>
        ) : item.available === false ? (
          <Button full size="lg" variant="outline" disabled>
            This item is no longer available
          </Button>
        ) : item.mode === 'free' ? (
          position ? (
            <div className="flex items-center gap-2.5">
              <span className="flex h-11 flex-1 items-center gap-2 rounded-2xl bg-emerald-50 px-3.5 text-[13.5px] font-extrabold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20">
                <CheckCheck size={16} /> You are #{position} in line
              </span>
            </div>
          ) : (
            <Button full size="lg" variant="success" icon={Gift} loading={busy === 'waitlist'} disabled={Boolean(busy)} onClick={() => act('waitlist')}>
              Join waitlist
            </Button>
          )
        ) : item.requestedByMe ? (
          <div className="flex items-center gap-2.5">
            <span className="flex h-11 flex-1 items-center gap-2 rounded-2xl bg-amber-50 px-3.5 text-[13.5px] font-extrabold text-amber-700 ring-1 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300">
              <CheckCheck size={16} /> Request pending with {item.owner?.name}
            </span>
            <Button variant="outline" size="md" onClick={() => goTab('activity')}>
              Activity
            </Button>
          </div>
        ) : (
          <Button
            full
            size="lg"
            icon={item.mode === 'barter' ? Handshake : ShoppingBag}
            onClick={() => (item.mode === 'barter' ? setOfferSheet(true) : act('buy'))}
            loading={busy === 'buy'}
            disabled={Boolean(busy)}
          >
            {item.mode === 'barter' ? 'Offer one of your items' : `Send buy request · ${rupees(item.price)}`}
          </Button>
        )}
      </div>

      {/* barter offer sheet */}
      <BottomSheet
        open={offerSheet}
        onClose={() => setOfferSheet(false)}
        title={`Offer a swap with ${item.owner?.name}`}
        subtitle={`They asked for: ${item.wants.join(', ') || 'anything fair'}`}
        footer={
          <Button full size="lg" icon={Handshake} disabled={!picked} loading={busy === 'barter'} onClick={() => act('barter')}>
            {picked ? 'Send offer' : 'Pick something to offer'}
          </Button>
        }
      >
        <div className="pb-4">
          {mine.loading ? (
            <Skeleton className="h-16 w-full rounded-2xl" />
          ) : myOffers.length ? (
            <div className="space-y-2">
              {myOffers.map((offer) => (
                <PickRow
                  key={offer.id}
                  title={offer.title}
                  subtitle={`${offer.category} · ${offer.mode === 'sell' ? rupees(offer.price) : `wants ${offer.wants.join(', ') || 'anything'}`}`}
                  meta={<ModeTagInline mode={offer.mode} />}
                  selected={picked === offer.id}
                  onClick={() => setPicked(picked === offer.id ? null : offer.id)}
                />
              ))}
              <button
                type="button"
                onClick={() => {
                  setOfferSheet(false);
                  goTab('items', { tab: 'browse' });
                }}
                className="mt-1 w-full rounded-xl px-3 py-2 text-[12.5px] font-bold text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
              >
                None of these fit — list something else
              </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-100 p-4 text-center dark:bg-slate-800/60">
              <p className="text-[13.5px] font-bold text-slate-800 dark:text-slate-100">You have nothing to offer yet</p>
              <p className="mt-1 text-[12.5px] muted">List an item first — barter only works if both sides have something.</p>
              <Button
                className="mt-3"
                size="sm"
                onClick={() => {
                  setOfferSheet(false);
                  goTab('items');
                }}
              >
                List an item
              </Button>
            </div>
          )}
        </div>
      </BottomSheet>

      {/* success sheet */}
      <BottomSheet
        open={!!done}
        onClose={() => setDone(null)}
        title="Request sent"
        subtitle={done ? `to ${done.owner?.name}` : ''}
        footer={
          <Button
            full
            size="lg"
            icon={ArrowRight}
            onClick={() => {
              setDone(null);
              goTab('activity');
            }}
          >
            Track it in My Activity
          </Button>
        }
      >
        {done && (
          <div className="pb-5">
            <div className="card p-4">
              <p className="text-[13.5px] leading-relaxed text-slate-700 dark:text-slate-200">
                <span className="font-extrabold">{item.title}</span>
                {done.request.offer ? (
                  <>
                    {' '}↔<span className="font-extrabold"> {done.request.offer.title}</span>
                  </>
                ) : null}{' '}
                is now pending with {done.owner?.name}. Their email unlocks for both of you the moment they accept.
              </p>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[12.5px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                <Lock size={13} /> Contact hidden until accepted
              </div>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

function ModeTagInline({ mode }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ring-1 ${MODE_STYLE[mode].chip}`}>
      {MODE_STYLE[mode].label}
    </span>
  );
}
