// Renders StudentSetu screens and handles student actions.
import { useState } from 'react';
import { Check, Eye, EyeOff, Plus, X } from 'lucide-react';

export function Field({ label, htmlFor, error, hint, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-[12px] font-medium text-rose-600 dark:text-rose-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="hint">{hint}</p>
      ) : null}
    </div>
  );
}

export function PasswordInput({ id, value, onChange, error, placeholder, autoComplete, name }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={show ? 'text' : 'password'}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className={`field pr-12 ${error ? 'field-error' : ''}`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

export function SelectInput({ id, value, onChange, options, error, placeholder }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={!!error}
      className={`field appearance-none bg-[length:14px] bg-[right_1rem_center] bg-no-repeat pr-10 ${
        error ? 'field-error' : ''
      }`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/** Type + Enter to add, tap × to remove. */
export function ChipInput({ id, values = [], onChange, placeholder = 'Type a skill, press Enter', tone = 'brand', max = 8 }) {
  const [draft, setDraft] = useState('');
  const palette =
    tone === 'brand'
      ? 'bg-brand-50 text-brand-700 ring-brand-100 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/25'
      : 'bg-accent-50 text-accent-600 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25';

  const add = () => {
    const next = draft.trim().replace(/\s+/g, ' ');
    if (!next) return;
    if (values.some((v) => v.toLowerCase() === next.toLowerCase())) {
      setDraft('');
      return;
    }
    if (values.length >= max) return;
    onChange([...values, next]);
    setDraft('');
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 transition
        focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10
        dark:border-slate-700 dark:bg-slate-950/40`}
    >
      {values.map((v, i) => (
        <span key={`${v}-${i}`} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold ring-1 ${palette}`}>
          {v}
          <button
            type="button"
            onClick={() => onChange(values.filter((_, idx) => idx !== i))}
            aria-label={`Remove ${v}`}
            className="-mr-1 grid h-5 w-5 place-items-center rounded-md hover:bg-black/10 dark:hover:bg-white/10"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        placeholder={values.length >= max ? `Max ${max} skills` : placeholder}
        disabled={values.length >= max}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          } else if (e.key === ',' ) {
            e.preventDefault();
            add();
          } else if (e.key === 'Backspace' && !draft && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        className="min-w-[120px] flex-1 bg-transparent px-1.5 py-1 text-[15px] outline-none placeholder:text-slate-400"
      />
      <button
        type="button"
        onClick={add}
        aria-label="Add skill"
        className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
      >
        <Plus size={15} />
      </button>
    </div>
  );
}

export function Segmented({ value, onChange, options, size = 'md', className = '', optionClassName = '' }) {
  const h = size === 'sm' ? 'h-9 text-[13px]' : 'h-11 text-[14px]';
  return (
    <div className={`flex rounded-2xl bg-slate-100 p-1 dark:bg-slate-800/80 ${className}`} role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl font-semibold transition ${h} ${optionClassName} ${
              active
                ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-950 dark:text-brand-200'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {o.icon ? <o.icon size={15} /> : null}
            {o.label}
            {o.badge ? <span className="ml-0.5 rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">{o.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ checked, onChange, label, id, disabled = false }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      aria-label={label}
      disabled={disabled}
      onClick={() => (disabled ? undefined : onChange(!checked))}
      className={`relative h-[26px] w-[46px] shrink-0 rounded-full p-[3px] transition ${
        checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );
}

/** Radio-style selectable row, used in bottom sheets. */
export function PickRow({ title, subtitle, meta, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
        selected
          ? 'border-brand-500 bg-brand-50/70 dark:border-brand-400 dark:bg-brand-500/10'
          : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
      }`}
    >
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition ${
          selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 dark:border-slate-600'
        }`}
      >
        {selected ? <Check size={13} strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-slate-900 dark:text-white">{title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-[12px] muted">{subtitle}</span>}
      </span>
      {meta}
    </button>
  );
}


