// Shows exchange requests, completion approvals, and tutoring bookings.
import { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  Copy,
  Gift,
  Handshake,
  Inbox,
  Lock,
  Mail,
  Repeat,
  Send,
  Star,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import api from '../api';
import { useApp } from '../context/AppContext';
import { copyText, useAsync, useExclusive } from '../lib/hooks';
import { timeAgo } from '../lib/format';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import BottomSheet from '../ui/BottomSheet';
import { SectionHeader, TopBar } from '../ui/Chrome';
import CircleCard from '../ui/CircleCard';
import { StarInput } from '../ui/Stars';
import { Segmented } from '../ui/Inputs';
import { EmptyState, ErrorState, ListSkeleton } from '../ui/States';
import PullRefresh from '../ui/PullRefresh';

const STATUS_STYLE = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25',
  accepted: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25',
  declined: 'bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700',
};

const TYPE_ICON = { item: Gift, swap: Repeat, circle: TrendingUp, paid: CircleDollarSign };

/**
 * My Activity: everything pending, everything sent, the circles you belong to,
 * and contacts once both sides agreed.
 *
 * Nothing on this screen refreshes only from local state: every action refetches
 * the list, the screen re-reads itself when the tab comes back into focus, and
 * while it is open it polls (see src/context/AppContext.jsx) so another member's
 * acceptance appears without a reload.
 */
export default function Activity() {
  const { toast, version, goTab, user } = useApp();
  const [tab, setTab] = useState('received');
  const [rating, setRating] = useState(null); // request being rated
  const [stars, setStars] = useState(0);
  const { run, pending } = useExclusive();

  const state = useAsync(() => api.getRequests(), [version]);
  const circles = useAsync(() => api.getMyCircles(), [version]);
  const bookings = useAsync(() => api.getBookings(), [version]);

  const received = state.data?.received || [];
  const sent = state.data?.sent || [];
  const pendingCount = received.filter((r) => r.status === 'pending').length;
  const list = tab === 'received' ? received : sent;
  const myCircles = circles.data?.circles || [];
  const waitingForMe = circles.data?.waitingForMe || 0;

  const refresh = () => {
    state.reload();
    circles.reload();
    bookings.reload();
  };

  const respond = (request, action) =>
    run(request.id + action, async () => {
      try {
        if (action === 'accept') {
          const res = await api.acceptRequest(request.id);
          const other = res.contact || res.request?.other;
          if (request.type === 'item' && res.itemTitle) {
            toast(
              res.declinedOthers
                ? `Accepted — “${res.itemTitle}” is now unavailable and ${res.declinedOthers} other request${
                    res.declinedOthers > 1 ? 's were' : ' was'
                  } auto-declined`
                : `Accepted — “${res.itemTitle}” is marked unavailable`,
              'success',
              { duration: 4600 }
            );
          } else if (res.contact?.email) {
            // only ever claimed when the reply actually carried the address
            toast(`Accepted — you can now see ${other?.name || 'their'}'s email`, 'success');
          } else {
            toast(`Accepted — this exchange is agreed${res.contact ? '' : ' (no contact details came back)'}`, 'success');
          }
        } else if (action === 'decline') {
          await api.declineRequest(request.id);
          toast(`Declined politely. ${request.other?.name || 'They'} see no email.`, 'success');
        } else if (action === 'cancel') {
          await api.cancelRequest(request.id);
          toast('Withdrawn — they were told you are no longer asking', 'success');
        }
      } catch (err) {
        // a 409 here means the request moved on without us: show the server's
        // sentence, then re-read so the card stops offering a dead button
        toast(err.message, 'error');
      } finally {
        refresh();
      }
    });

  const answerCircle = (circle, yes) =>
    run(`${circle.id}:${yes ? 'yes' : 'no'}`, async () => {
      try {
        await api.answerCircle(circle.id, yes);
        toast(yes ? 'You are in — they have been told' : 'Declined — the circle did not close', 'success');
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        circles.reload();
        state.reload();
      }
    });

  const cancelCircle = (circle) =>
    run(`${circle.id}:cancel`, async () => {
      try {
        await api.answerCircle(circle.id, false);
        toast('Circle cancelled — nobody was left waiting on you', 'success');
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        circles.reload();
        state.reload();
      }
    });

  const sendRating = () =>
    run(`rate:${rating.id}`, async () => {
      try {
        await api.rateRequest(rating.id, stars);
        toast('Rated — thank you. It shows on their profile now', 'success');
        setRating(null);
        setStars(0);
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        state.reload();
      }
    });

  const changeBooking = (booking, action) => run(`booking:${booking.id}`, async () => {
    try {
      if (action === 'confirm') await api.answerBooking(booking.id, true);
      if (action === 'decline') await api.answerBooking(booking.id, false);
      if (action === 'cancel') await api.cancelBooking(booking.id);
      if (action === 'paid') await api.setBookingPayment(booking.id, 'paid');
      toast('Booking updated', 'success');
    } catch (err) { toast(err.message, 'error'); }
    finally { bookings.reload(); }
  });

  const complete = (request) => run(`complete:${request.id}`, async () => {
    try {
      const result = await api.completeRequest(request.id);
      toast(result.request?.status === 'completed' ? 'Exchange completed — ratings unlocked' : 'Confirmation saved; waiting for the other student', 'success');
    } catch (err) { toast(err.message, 'error'); }
    finally { state.reload(); }
  });

  return (
    <div className="flex h-full flex-col bg-canvas dark:bg-slate-950">
      <TopBar
        title="My Activity"
        subtitle={pendingCount ? `${pendingCount} waiting on you` : waitingForMe ? `${waitingForMe} circle invite waiting on you` : 'You are all caught up'}
      />
      <div className="screen-pad pt-2">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'received', label: 'Received', icon: Inbox, badge: pendingCount || undefined },
            { value: 'sent', label: 'Sent', icon: Send },
            { value: 'circles', label: 'Circles', icon: Users, badge: waitingForMe || undefined },
            ...(!api.USE_MOCK ? [{ value: 'bookings', label: 'Bookings', icon: CalendarClock }] : []),
          ]}
        />
      </div>

      <div className="relative min-h-0 flex-1">
        <PullRefresh onRefresh={() => Promise.all([state.reload(), circles.reload(), bookings.reload()])}>
          <div className="min-h-full px-4 pb-8 pt-4">
            {tab === 'bookings' ? (
              bookings.loading ? <ListSkeleton rows={2} /> : bookings.error ?
                <ErrorState message={bookings.error.message} onRetry={bookings.reload} /> :
                (bookings.data?.bookings || []).length ? (
                  <div className="space-y-3">
                    <SectionHeader title="Tutoring bookings" subtitle="Offline payments are recorded here; no money passes through StudentSetu" />
                    {bookings.data.bookings.map((booking) => {
                      const tutor = String(booking.tutor?.id) === String(user?.id);
                      return <article key={booking.id} className="card space-y-2 p-4">
                        <p className="text-sm font-extrabold">{booking.subject} · ₹{booking.pricePerHour}/hour</p>
                        <p className="text-xs muted">{tutor ? `Student: ${booking.learner?.name}` : `Tutor: ${booking.tutor?.name}`}</p>
                        <p className="text-xs muted">{booking.slotStart.replace('T', ' ')} – {booking.slotEnd.replace('T', ' ')}</p>
                        <p className="text-xs font-semibold">Booking: {booking.status} · Payment: {booking.paymentStatus}</p>
                        <div className="flex flex-wrap gap-2">
                          {tutor && booking.status === 'pending' && <>
                            <Button size="sm" disabled={!!pending} onClick={() => changeBooking(booking, 'confirm')}>Confirm</Button>
                            <Button size="sm" variant="soft" disabled={!!pending} onClick={() => changeBooking(booking, 'decline')}>Decline</Button>
                          </>}
                          {tutor && booking.status === 'confirmed' && booking.paymentStatus !== 'paid' &&
                            <Button size="sm" disabled={!!pending} onClick={() => changeBooking(booking, 'paid')}>Mark paid offline</Button>}
                          {['pending', 'confirmed'].includes(booking.status) &&
                            <Button size="sm" variant="soft" disabled={!!pending} onClick={() => changeBooking(booking, 'cancel')}>Cancel</Button>}
                        </div>
                      </article>;
                    })}
                  </div>
                ) : <EmptyState icon={CalendarClock} title="No tutoring bookings" message="Choose a tutor and request an available time slot." />
            ) : tab === 'circles' ? (
              circles.loading ? (
                <ListSkeleton rows={2} />
              ) : circles.error ? (
                <ErrorState message={circles.error.message} onRetry={circles.reload} />
              ) : myCircles.length ? (
                <>
                  <SectionHeader
                    title="Your exchange circles"
                    subtitle="A circle forms only when every member says yes"
                  />
                  <div className="space-y-3">
                    {myCircles.map((circle) => (
                      <CircleCard
                        key={circle.id}
                        circle={circle}
                        me={user?.id}
                        pending={pending}
                        onAnswer={answerCircle}
                        onCancel={cancelCircle}
                        toast={toast}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={Users}
                  title="You are not in a circle"
                  message="A circle is how the app closes a loop when nobody wants a straight swap — you teach one person, they teach the next, and the last one teaches you."
                  actionLabel="Find a circle"
                  onAction={() => goTab('skills', { tab: 'barter' })}
                />
              )
            ) : state.loading ? (
              <ListSkeleton rows={3} />
            ) : state.error ? (
              <ErrorState message={state.error.message} onRetry={state.reload} />
            ) : (
              <>
                <SectionHeader
                  title={tab === 'received' ? 'Sent to you' : 'Sent by you'}
                  subtitle={
                    tab === 'received'
                      ? 'Accept to unlock each other’s contact details'
                      : 'Status updates as the other side responds'
                  }
                />
                {!list.length ? (
                  <EmptyState
                    icon={tab === 'received' ? Inbox : Send}
                    title={tab === 'received' ? 'Nothing new in your inbox' : 'You have not asked anyone for anything'}
                    message={
                      tab === 'received'
                        ? 'When a classmate wants your notes, your item or your teaching, it lands here.'
                        : 'Send a swap request or book a session and it will show up here with its status.'
                    }
                    actionLabel={tab === 'received' ? 'Browse items' : 'Find a skill swap'}
                    onAction={() => (tab === 'received' ? goTab('items') : goTab('skills'))}
                  />
                ) : (
                  <div className="space-y-3">
                    {list.map((request) => (
                      <RequestCard
                        key={request.id}
                        request={request}
                        pending={pending}
                        onAccept={() => respond(request, 'accept')}
                        onDecline={() => respond(request, 'decline')}
                        onCancel={() => respond(request, 'cancel')}
                        onRate={() => {
                          setStars(0);
                          setRating(request);
                        }}
                        onComplete={() => complete(request)}
                        toast={toast}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </PullRefresh>
      </div>

      {/* one rating per accepted exchange */}
      <BottomSheet
        open={!!rating}
        onClose={() => (pending.startsWith('rate:') ? null : setRating(null))}
        title={rating ? `Rate ${rating.other?.name || 'this exchange'}` : ''}
        subtitle={rating ? rating.title : ''}
        footer={
          <Button full size="lg" icon={Star} disabled={!stars} loading={pending.startsWith('rate:')} onClick={sendRating}>
            {stars ? `Send ${stars} star${stars === 1 ? '' : 's'}` : 'Pick a number of stars'}
          </Button>
        }
      >
        <div className="pb-5">
          <StarInput value={stars} onChange={setStars} disabled={pending.startsWith('rate:')} label={rating?.other?.name || 'this exchange'} />
          <p className="mt-3 text-[12.5px] leading-relaxed muted">
            Only an exchange you both accepted can be rated, and only once each. Your stars move their average — they do not replace it.
          </p>
        </div>
      </BottomSheet>
    </div>
  );
}

function RequestCard({ request, pending, onAccept, onDecline, onCancel, onRate, onComplete, toast }) {
  const { push } = useApp();
  const Icon = TYPE_ICON[request.type] || Handshake;
  const pendingRow = request.status === 'pending';
  const busy = (action) => pending === `${request.id}${action}`;
  const locked = Boolean(pending);

  return (
    <article
      className={`card overflow-hidden animate-fade-up ${
        pendingRow && request.direction === 'received' ? 'ring-1 ring-amber-200 dark:ring-amber-500/30' : ''
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Avatar name={request.other?.name} color={request.other?.color} size="md" ring={false} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-[14.5px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                {request.direction === 'received' ? request.other?.name : `→ ${request.other?.name}`}
                <span className="ml-1 text-[11.5px] font-bold muted">
                  {[request.other?.branch, request.other?.yearLabel].filter(Boolean).join(' · ')}
                </span>
              </p>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ring-1 ${
                  STATUS_STYLE[request.status]
                }`}
              >
                {request.cancelled ? 'withdrawn' : request.status}
              </span>
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] font-semibold muted">
              <Icon size={12} className="text-brand-500" />
              {request.typeLabel}
              {/* the C++ server does not date a request, so "3h ago" is only shown when there is a real date */}
              {request.createdAt ? (
                <>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  {timeAgo(request.createdAt)}
                </>
              ) : null}
              {request.autoDeclined && (
                <span className="ml-1 inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-1.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800">
                  <XCircle size={9} /> closed automatically
                </span>
              )}
            </p>

            {request.item ? (
              <button
                type="button"
                onClick={() => push('item', { id: request.item.id })}
                className="mt-2.5 flex w-full items-start gap-1.5 text-left text-[14px] font-bold leading-snug text-slate-800 dark:text-slate-100"
              >
                <span className="flex-1 underline decoration-slate-300 decoration-2 underline-offset-2 dark:decoration-slate-600">
                  {request.title}
                </span>
                <ChevronRight size={15} className="mt-0.5 shrink-0 text-slate-400" />
              </button>
            ) : (
              <p className="mt-2.5 text-[14px] font-bold leading-snug text-slate-800 dark:text-slate-100">{request.title}</p>
            )}
            {request.subtitle && <p className="mt-0.5 text-[12.5px] muted">{request.subtitle}</p>}
            {request.note && (
              <p className="mt-2 border-l-2 border-slate-200 pl-2.5 text-[12.5px] italic leading-snug text-slate-500 dark:border-slate-700 dark:text-slate-400">
                “{request.note}”
              </p>
            )}

            {request.offer && (
              <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-purple-50 px-2.5 py-2 text-[12px] font-bold text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">
                <Handshake size={13} />
                <span className="truncate">{request.offer.title}</span>
                <span className="ml-auto shrink-0 opacity-70">{request.direction === 'received' ? 'offered to you' : 'you offer'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* actions or contact */}
      {request.canRespond ? (
        <div className="flex gap-2 border-t border-amber-100 bg-amber-50/50 p-3 dark:border-amber-500/20 dark:bg-amber-500/5">
          <Button size="md" variant="outline" className="flex-1" icon={XCircle} loading={busy('decline')} disabled={locked} onClick={onDecline}>
            Decline
          </Button>
          <Button
            size="md"
            variant="success"
            className="flex-[1.4]"
            icon={BadgeCheck}
            loading={busy('accept')}
            disabled={locked}
            onClick={onAccept}
          >
            Accept
          </Button>
        </div>
      ) : request.canCancel ? (
        <div className="flex items-center gap-2 border-t hairline p-3">
          <p className="min-w-0 flex-1 flex items-center gap-1.5 text-[11.5px] font-semibold muted">
            <CalendarClock size={11} />
            {request.otherContact?.email ? 'Agreed' : `Waiting on ${request.other?.name || 'them'} — your email stays hidden`}
          </p>
          <Button size="sm" variant="outline" icon={XCircle} loading={busy('cancel')} disabled={locked} onClick={onCancel}>
            Withdraw
          </Button>
        </div>
      ) : request.contactVisible && request.otherContact ? (
        <div className="border-t hairline bg-emerald-50/60 p-3 dark:bg-emerald-500/5">
          <p className="flex items-center gap-1.5 text-[11.5px] font-extrabold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            <BadgeCheck size={13} /> Contact unlocked
          </p>
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm dark:bg-slate-900">
            <Mail size={14} className="shrink-0 text-emerald-600" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-slate-800 dark:text-slate-100">
              {request.otherContact.email}
            </span>
            <button
              type="button"
              onClick={async () => {
                const ok = await copyText(request.otherContact.email);
                toast(ok ? 'Email copied to clipboard' : 'Could not copy', ok ? 'success' : 'error');
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1.5 text-[11.5px] font-extrabold text-slate-700 active:scale-95 dark:bg-slate-800 dark:text-slate-200"
            >
              <Copy size={12} /> Copy
            </button>
            <a
              href={`mailto:${request.otherContact.email}?subject=${encodeURIComponent('StudentSetu — ' + request.title)}`}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2 py-1.5 text-[11.5px] font-extrabold text-white active:scale-95"
            >
              Email <ArrowRight size={12} />
            </a>
          </div>
          {!api.USE_MOCK && request.status === 'accepted' && request.type !== 'paid' && (
            <Button size="sm" variant="soft" className="mt-2 w-full" disabled={locked} onClick={onComplete}>
              Confirm exchange completed
            </Button>
          )}
          {request.canRate && (
            <Button size="sm" variant="soft" className="mt-2 w-full" icon={Star} disabled={locked} onClick={onRate}>
              Rate this exchange
            </Button>
          )}
        </div>
      ) : request.canRate ? (
        <div className="flex items-center gap-2 border-t hairline p-3">
          <p className="min-w-0 flex-1 text-[11.5px] font-semibold muted">Both of you agreed — worth a rating?</p>
          <Button size="sm" variant="soft" icon={Star} disabled={locked} onClick={onRate}>
            Rate
          </Button>
        </div>
      ) : pendingRow ? (
        <div className="flex items-center gap-1.5 border-t hairline px-4 py-2.5 text-[11.5px] font-semibold muted">
          <Lock size={11} />{' '}
          {request.direction === 'sent'
            ? `Emails unlock if ${request.other?.name || 'they'} accept`
            : 'Accept to share contact details'}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 border-t hairline px-4 py-2.5 text-[11.5px] font-semibold muted">
          <Bell size={11} /> This request is closed — nothing further to do
        </div>
      )}
    </article>
  );
}
