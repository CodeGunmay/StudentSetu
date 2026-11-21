// Renders StudentSetu screens and handles student actions.
import { useState } from 'react';
import { ArrowRight, Camera, CheckCheck, Gift, Repeat, Tag } from 'lucide-react';
import api, { USE_MOCK } from '../api';
import { useApp } from '../context/AppContext';
import { rupees, CATEGORY_ART } from '../lib/format';
import { TopBar, SectionHeader } from '../ui/Chrome';
import Button from '../ui/Button';
import { CategoryIcon } from '../ui/Cards';
import { ChipInput, Field, SelectInput } from '../ui/Inputs';
import { MODE_STYLE } from '../lib/format';

const CATEGORIES = ['Books', 'Notes', 'Calculator', 'Lab equipment', 'Electronics', 'Stationery', 'Clothing', 'Other'];
const CONDITIONS = ['New', 'Like new', 'Good', 'Fair'];
const MODES = [
  { value: 'free', label: 'Free', icon: Gift },
  { value: 'barter', label: 'Barter', icon: Repeat },
  { value: 'sell', label: 'Sell', icon: Tag },
];

/** List an item: five fields, then it is on the board instantly. */
export default function ListItem() {
  const { pop, push, goTab, toast } = useApp();
  const [form, setForm] = useState({
    title: '',
    category: '',
    mode: 'free',
    wants: [],
    price: '',
    condition: 'Good',
    description: '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [listed, setListed] = useState(null);

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (form.title.trim().length < 3) next.title = 'Give it a clear title (3+ characters)';
    if (!form.category) next.category = 'Pick a category so people can find it';
    if (form.mode === 'barter' && !form.wants.length) next.wants = 'Say what you want in return';
    if (form.mode === 'sell') {
      const price = Number(form.price);
      if (!form.price || !Number.isFinite(price) || price <= 0) next.price = 'Enter a price in rupees';
      else if (price > 100000) next.price = 'That looks like a typo — keep it under ₹1,00,000';
    }
    setErrors(next);
    return !Object.keys(next).length;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast('Check the highlighted fields', 'error');
      return;
    }
    if (busy) return; // one post per tap
    setBusy(true);
    try {
      const item = await api.listItem({
        title: form.title.trim(),
        category: form.category,
        mode: form.mode,
        wants: form.wants,
        price: form.mode === 'sell' ? Number(form.price) : null,
        condition: form.condition,
        description: form.description.trim(),
      });
      setListed(item);
      toast('Listed on the campus board 🎉', 'success');
    } catch (err) {
      setErrors({ [err.field || 'form']: err.message });
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (listed) {
    return (
      <div className="flex h-full flex-col bg-canvas dark:bg-slate-950">
        <TopBar title="Listing live" onBack={() => goTab('items', { tab: 'mine' })} right={<span />} />
        <div className="flex-1 px-4 pt-8">
          <div className="card animate-pop p-5 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10">
              <CheckCheck size={30} />
            </span>
            <h2 className="mt-4 text-[19px] font-extrabold tracking-tight text-slate-900 dark:text-white">{listed.title}</h2>
            <p className="mt-1 text-[13px] muted">
              {listed.category} · {listed.modeLabel}
              {listed.mode === 'sell' ? ` · ${rupees(listed.price)}` : listed.mode === 'barter' ? ` · wants ${listed.wants.join(', ')}` : ''}
            </p>
            <div className="mt-4 rounded-2xl bg-slate-100 p-3.5 text-left text-[12.5px] leading-relaxed text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
              {listed.mode === 'free'
                ? 'Anyone can join the waitlist. You decide when to hand it to the person at the front — nothing is sent automatically.'
                : listed.mode === 'barter'
                ? 'You will get an offer with the item they want to swap. Accept it and both emails unlock.'
                : 'Buyers send you a request. Agree the price and the meetup spot before any money moves.'}
            </div>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" full onClick={() => goTab('items', { tab: 'mine' })}>
                My items
              </Button>
              <Button full icon={ArrowRight} onClick={() => push('item', { id: listed.id })}>
                View listing
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => { setListed(null); setForm({ ...form, title: '', wants: [], price: '', description: '' }); }}>
              List another one
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-canvas dark:bg-slate-950">
      <TopBar title="List an item" subtitle="Free, barter or sell — it takes 20 seconds" onBack={pop} right={<span />} />

      <div className="no-bar flex-1 overflow-y-auto px-4 pb-10 pt-3">
        <form onSubmit={submit} className="space-y-4" noValidate>
          {/* live preview tile */}
          <div>
            <SectionHeader title="Preview" subtitle="How students will see it" />
            <div className="card overflow-hidden">
              <div className={`relative grid h-28 place-items-center bg-gradient-to-br ${CATEGORY_ART[form.category]?.gradient || 'from-slate-400/15 to-slate-400/5'}`}>
                <span className="text-slate-700 dark:text-slate-200">
                  <CategoryIcon category={form.category || 'Other'} size={40} />
                </span>
                <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-white/70 px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 backdrop-blur dark:bg-slate-900/70 dark:text-slate-400">
                  <Camera size={11} /> {form.category ? CATEGORY_ART[form.category].icon : 'no photo yet'}
                </span>
                <span className={`absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ring-1 ${MODE_STYLE[form.mode].chip}`}>
                  {MODE_STYLE[form.mode].label}
                </span>
              </div>
              <div className="p-3">
                <p className="text-[14.5px] font-bold tracking-tight text-slate-900 dark:text-white">{form.title.trim() || 'Your item title'}</p>
                <p className="mt-0.5 text-[12px] muted">
                  {form.category || 'Category'} ·{' '}
                  {form.mode === 'sell'
                    ? form.price
                      ? rupees(Number(form.price))
                      : '₹ price'
                    : form.mode === 'barter'
                    ? form.wants.length
                      ? `wants: ${form.wants.join(', ')}`
                      : 'wants: …'
                    : 'Free for anyone'}
                </p>
              </div>
            </div>
          </div>

          <Field label="Title" htmlFor="li-title" error={errors.title} hint="Say exactly what it is, e.g. “Spare scientific calculator”">
            <input
              id="li-title"
              value={form.title}
              onChange={(e) => set('title')(e.target.value)}
              placeholder="Spare scientific calculator"
              aria-invalid={!!errors.title}
              className={`field ${errors.title ? 'field-error' : ''}`}
            />
          </Field>

          <Field label="Category" htmlFor="li-category" error={errors.category}>
            <SelectInput id="li-category" value={form.category} onChange={set('category')} options={CATEGORIES} placeholder="Select" error={errors.category} />
          </Field>

          {/* Condition is a mock-only field: POST /api/items has nowhere to put it,
              so the form does not offer it in real mode — better an absent input
              than one whose answer silently goes nowhere. */}
          {USE_MOCK && (
            <Field label="Condition" htmlFor="li-condition">
              <SelectInput id="li-condition" value={form.condition} onChange={set('condition')} options={CONDITIONS} />
            </Field>
          )}

          <Field label="How do you want to pass it on?" error={errors.mode}>
            <div className="grid grid-cols-3 gap-2">
              {MODES.map((m) => {
                const active = form.mode === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => set('mode')(m.value)}
                    aria-pressed={active}
                    className={`flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-2.5 transition active:scale-[.98] ${
                      active
                        ? `${MODE_STYLE[m.value].chip} border-current`
                        : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                    }`}
                  >
                    <m.icon size={18} />
                    <span className="text-[12.5px] font-extrabold">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </Field>

          {form.mode === 'barter' && (
            <Field label="What do you want in return?" htmlFor="li-wants" error={errors.wants} hint="Type and press Enter — these show on your card">
              <ChipInput id="li-wants" values={form.wants} onChange={set('wants')} placeholder="e.g. Physics notes" tone="accent" max={4} />
            </Field>
          )}

          {form.mode === 'sell' && (
            <Field label="Price (₹)" htmlFor="li-price" error={errors.price} hint="Peer price — most students keep it under ₹500">
              <input
                id="li-price"
                inputMode="numeric"
                value={form.price}
                onChange={(e) => set('price')(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="250"
                aria-invalid={!!errors.price}
                className={`field ${errors.price ? 'field-error' : ''}`}
              />
            </Field>
          )}

          {USE_MOCK ? (
            <Field label="Description" htmlFor="li-desc" hint="Condition, why you are passing it on, where to meet">
              <textarea
                id="li-desc"
                rows={4}
                value={form.description}
                onChange={(e) => set('description')(e.target.value)}
                placeholder="Casio fx-991EX, works perfectly. Pickup at B-block."
                className="field resize-none"
              />
            </Field>
          ) : (
            <p className="rounded-2xl bg-slate-100 px-3.5 py-3 text-[12.5px] leading-snug text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              This server stores a title, a category, the mode, a price and what you want in return — nothing else. So that is exactly what this
              form asks for: no description box that would quietly throw your words away.
            </p>
          )}

          <Button type="submit" full size="lg" loading={busy} icon={Gift}>
            Post to the campus board
          </Button>
        </form>
      </div>
    </div>
  );
}
