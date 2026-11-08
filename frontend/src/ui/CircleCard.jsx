// Renders StudentSetu screens and handles student actions.
import { useState } from 'react';
import { BadgeCheck, CalendarClock, CheckCheck, Copy, Lock, Mail, Send, Users, XCircle } from 'lucide-react';
import api from '../api';
import { copyText } from '../lib/hooks';
import Avatar from './Avatar';
import Button from './Button';
import BottomSheet from './BottomSheet';
import ExchangeCircle from './ExchangeCircle';

/**
 * One exchange circle, exactly as much as the server told us.
 *
 * The three things this card must not fake:
 *  • the ring — drawn only when there are real links to draw it from
 *  • a member's answer — an invitation nobody has read is "waiting", never "no"
 *  • contact details — they appear when the *circle* agreed (status active), and
 *    only for the entries the server actually sent back
 */
export default function CircleCard({ circle, onAnswer, onCancel, pending = '', toast = () => {}, me }) {
  const [meet, setMeet] = useState(null); // { person, slots, loading }
  const ring = (circle.links || []).length > 1 && (circle.people || circle.members || []).length > 2;

  const openMeet = async (person) => {
    setMeet({ person, slots: null, loading: true });
    try {
      const res = await api.getMeet(person.id);
      setMeet({ person, slots: res.slots || [], loading: false });
    } catch (err) {
      setMeet({ person, slots: null, loading: false, error: err.message });
    }
  };

  return (
    <article className="card overflow-hidden animate-fade-up">
      <div className="flex items-start gap-3 bg-gradient-to-br from-purple-600 to-brand-700 p-4 text-white">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15">
          <Users size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-extrabold uppercase tracking-wider text-white/75">Exchange circle · {circle.skill}</p>
          <h3 className="mt-0.5 text-[16px] font-extrabold leading-tight tracking-tight">
            {circle.size} student{circle.size === 1 ? '' : 's'} · {STATUS_COPY[circle.status]?.title || circle.status}
          </h3>
          <p className="mt-1 text-[12.5px] leading-snug text-white/75">{STATUS_COPY[circle.status]?.body}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ring-1 ${
            STATUS_STYLE[circle.status] || STATUS_STYLE.waiting
          }`}
        >
          {circle.status}
        </span>
      </div>

      {ring && (
        <div className="bg-white px-2 pt-3 dark:bg-slate-900">
          <ExchangeCircle
            people={(circle.people || (circle.members || []).map((m) => m.student)).map((p) => ({ ...p, isMe: p.id === me }))}
            edges={circle.edges || (circle.links || []).map((l) => ({ from: l.learner?.name, to: l.teacher?.name, skill: l.skill }))}
            size={232}
          />
        </div>
      )}

      <ul className="divide-y divide-slate-100 px-4 dark:divide-slate-800">
        {(circle.members || []).map((m) => (
          <li key={m.student.id} className="flex items-center gap-2.5 py-2.5">
            <Avatar name={m.student.name} color={m.student.color} size="sm" ring={false} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-bold text-slate-900 dark:text-white">
                {m.student.id === me ? 'You' : m.student.name}
                {m.student.verified === true && <BadgeCheck size={12} className="ml-1 inline text-brand-500" />}
              </p>
              <p className="truncate text-[11.5px] muted">
                {m.student.branch}
                {m.student.yearLabel ? ` · ${m.student.yearLabel}` : ''}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-lg px-2 py-0.5 text-[10.5px] font-extrabold uppercase ${ANSWER_STYLE[m.answer] || ANSWER_STYLE.waiting}`}
            >
              {m.answer}
            </span>
            <button
              type="button"
              onClick={() => openMeet(m.student)}
              className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
            >
              <CalendarClock size={11} className="mr-1 inline" />
              Free time
            </button>
          </li>
        ))}
      </ul>

      {/* consensus unlocks the contact details */}
      {circle.contactsVisible ? (
        <div className="border-t hairline bg-emerald-50/60 p-3 dark:bg-emerald-500/5">
          <p className="flex items-center gap-1.5 text-[11.5px] font-extrabold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            <BadgeCheck size={13} /> Circle agreed — contacts shared
          </p>
          <div className="mt-2 space-y-1.5">
            {(circle.members || [])
              .filter((m) => m.student.id !== me)
              .map((m) => (
                <div key={m.student.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm dark:bg-slate-900">
                  <Mail size={13} className="shrink-0 text-emerald-600" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-slate-800 dark:text-slate-100">
                    {m.contact?.email || <span className="font-semibold italic text-slate-400">No email shared for this member</span>}
                  </span>
                  {m.contact?.email && (
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await copyText(m.contact.email);
                        toast(ok ? `${m.student.name}'s email copied` : 'Could not copy', ok ? 'success' : 'error');
                      }}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-extrabold text-slate-700 active:scale-95 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <Copy size={11} /> Copy
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 border-t hairline px-4 py-2.5 text-[11.5px] font-semibold muted">
          <Lock size={11} />
          {circle.status === 'cancelled'
            ? 'This circle is closed — nobody’s email was shared'
            : `Emails unlock when all ${circle.size} of you say yes · ${circle.yesCount}/${circle.size} in`}
        </div>
      )}

      {circle.canAnswer && (
        <div className="flex gap-2 border-t border-amber-100 bg-amber-50/50 p-3 dark:border-amber-500/20 dark:bg-amber-500/5">
          <Button
            size="md"
            variant="outline"
            className="flex-1"
            icon={XCircle}
            loading={pending === `${circle.id}:no`}
            disabled={Boolean(pending)}
            onClick={() => onAnswer(circle, false)}
          >
            Decline
          </Button>
          <Button
            size="md"
            variant="success"
            className="flex-[1.4]"
            icon={CheckCheck}
            loading={pending === `${circle.id}:yes`}
            disabled={Boolean(pending)}
            onClick={() => onAnswer(circle, true)}
          >
            Yes, count me in
          </Button>
        </div>
      )}

      {circle.iInitiated && circle.status === 'waiting' && (
        <div className="flex items-center gap-2 border-t hairline p-3">
          <p className="min-w-0 flex-1 text-[12px] font-semibold muted">
            <Send size={11} className="mr-1 inline" />
            Waiting on {circle.waitingCount}
          </p>
          <Button size="sm" variant="outline" icon={XCircle} loading={pending === `${circle.id}:cancel`} disabled={Boolean(pending)} onClick={() => onCancel(circle)}>
            Cancel circle
          </Button>
        </div>
      )}

      {/* shared availability, only when the server has slots for both people */}
      <BottomSheet
        open={!!meet}
        onClose={() => setMeet(null)}
        title={meet ? `When you and ${meet.person.name} are both free` : ''}
        subtitle="From what StudentSetu has on file for you both"
        footer={
          <Button full onClick={() => setMeet(null)}>
            Close
          </Button>
        }
      >
        <div className="pb-5">
          {meet?.loading && <p className="text-[13px] muted">Checking…</p>}
          {meet?.error && <p className="text-[13px] font-semibold text-rose-600 dark:text-rose-400">{meet.error}</p>}
          {meet && !meet.loading && !meet.error && (
            <>
              {(meet.slots || []).length ? (
                <ul className="space-y-1.5">
                  {meet.slots.map((slot) => (
                    <li key={slot} className="rounded-xl bg-emerald-50 px-3 py-2 text-[13.5px] font-bold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                      {slot}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl bg-slate-100 px-3 py-3 text-[13px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  No shared free time on file. Add yours in Profile → When I am free, and ask {meet.person.name} to do the same.
                </p>
              )}
            </>
          )}
        </div>
      </BottomSheet>
    </article>
  );
}

const STATUS_STYLE = {
  waiting: 'bg-amber-500/15 text-amber-100 ring-white/25',
  active: 'bg-emerald-400/20 text-white ring-white/30',
  cancelled: 'bg-slate-500/25 text-white ring-white/20',
};

const STATUS_COPY = {
  waiting: { title: 'waiting on an answer', body: 'A circle only closes when every one of you says yes.' },
  active: { title: 'agreed by everyone', body: 'You teach one person, they teach the next, and the last one teaches you.' },
  cancelled: { title: 'closed', body: 'Somebody declined, so the circle did not form. Nothing was shared.' },
};

const ANSWER_STYLE = {
  yes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  waiting: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  no: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
};
