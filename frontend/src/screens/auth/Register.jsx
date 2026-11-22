// Renders StudentSetu screens and handles student actions.
import { useState } from 'react';
import { GraduationCap, Lightbulb, Users } from 'lucide-react';
import api from '../../api';
import { useApp } from '../../context/AppContext';
import { TopBar } from '../../ui/Chrome';
import Button from '../../ui/Button';
import { ChipInput, Field, PasswordInput, SelectInput } from '../../ui/Inputs';

const BRANCHES = ['CSE', 'IT', 'ECE', 'ME', 'CE', 'Other'];
const YEARS = ['1', '2', '3', '4'];

const SUGGESTED = ['Python', 'C++', 'DSA', 'Maths', 'DBMS', 'Physics', 'Excel', 'Figma', 'Public speaking'];

/** Register: verified college email + the two skill lists the whole app runs on. */
export default function Register() {
  const { pop, push, toast } = useApp();
  const [form, setForm] = useState({
    name: '',
    email: '',
    branch: '',
    year: '',
    password: '',
    teaches: [],
    wants: [],
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Tell us your name';
    const email = form.email.trim().toLowerCase();
    if (!email) next.email = 'Enter your college email';
    else if (!email.endsWith('@geu.ac.in')) next.email = 'Must end with @geu.ac.in';
    if (!form.branch) next.branch = 'Pick your branch';
    if (!form.year) next.year = 'Pick your year';
    if (form.password.length < 8) next.password = 'At least 8 characters';
    if (!form.teaches.length) next.teaches = 'Add at least one skill you can teach';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      const email = form.email.trim().toLowerCase();
      // register does NOT sign anybody in: the account only becomes usable once
      // the college email is confirmed, and the password stops living in memory
      // the moment this call returns.
      const result = await api.register({
        name: form.name.trim(),
        email,
        branch: form.branch,
        year: Number(form.year),
        password: form.password,
        teaches: form.teaches,
        wants: form.wants,
      });
      setForm((f) => ({ ...f, password: '' }));
      push('verify', { email, devOtp: result?.devOtp || '' });
      toast('Almost in — confirm the code we emailed you', 'success');
    } catch (err) {
      setErrors({ [err.field || 'form']: err.message });
      if (!err.field) toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const addSkill = (skill) => {
    if (form.teaches.includes(skill) || form.wants.includes(skill)) return;
    setForm((f) => ({ ...f, teaches: [...f.teaches, skill] }));
  };

  return (
    <div className="flex h-full flex-col bg-canvas dark:bg-slate-950">
      <TopBar title="Create your profile" subtitle="Takes 30 seconds" onBack={pop} right={<span />} />

      <div className="no-bar flex-1 overflow-y-auto px-4 pb-8 pt-3">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Full name" htmlFor="reg-name" error={errors.name}>
            <input
              id="reg-name"
              value={form.name}
              onChange={(e) => set('name')(e.target.value)}
              placeholder="Gunmay Sharma"
              autoComplete="name"
              className={`field ${errors.name ? 'field-error' : ''}`}
            />
          </Field>

          <Field label="College email" htmlFor="reg-email" error={errors.email} hint="Only @geu.ac.in addresses can register">
            <input
              id="reg-email"
              type="email"
              value={form.email}
              onChange={(e) => set('email')(e.target.value)}
              placeholder="you@geu.ac.in"
              autoComplete="email"
              aria-invalid={!!errors.email}
              className={`field ${errors.email ? 'field-error' : ''}`}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Branch" htmlFor="reg-branch" error={errors.branch}>
              <SelectInput
                id="reg-branch"
                value={form.branch}
                onChange={set('branch')}
                options={BRANCHES}
                placeholder="Select"
                error={errors.branch}
              />
            </Field>
            <Field label="Year" htmlFor="reg-year" error={errors.year}>
              <SelectInput id="reg-year" value={form.year} onChange={set('year')} options={YEARS} placeholder="Select" error={errors.year} />
            </Field>
          </div>

          <Field label="Password" htmlFor="reg-password" error={errors.password} hint="Minimum 8 characters">
            <PasswordInput id="reg-password" value={form.password} onChange={set('password')} error={errors.password} placeholder="••••" autoComplete="new-password" />
          </Field>

          <Field
            label="Skills I can teach"
            htmlFor="reg-teaches"
            error={errors.teaches}
            hint="Type and press Enter · tap × to remove"
          >
            <ChipInput id="reg-teaches" values={form.teaches} onChange={set('teaches')} placeholder="e.g. C++" />
          </Field>

          <Field label="Skills I want to learn" htmlFor="reg-wants" hint="Optional, but it is how we find your swaps">
            <ChipInput id="reg-wants" values={form.wants} onChange={set('wants')} placeholder="e.g. Python" tone="accent" />
          </Field>

          <div className="card p-3.5">
            <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-slate-700 dark:text-slate-200">
              <Lightbulb size={14} className="text-accent-500" /> Tap to add a skill
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addSkill(s)}
                  className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[12.5px] font-semibold text-slate-700 transition hover:bg-brand-50 hover:text-brand-700 active:scale-95 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-brand-500/15"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" full size="lg" loading={busy} icon={Users}>
            Join StudentSetu
          </Button>
          <p className="flex items-center justify-center gap-1.5 pt-1 text-[12px] muted">
            <GraduationCap size={13} /> StudentSetu is limited to Graphic Era students.
          </p>
        </form>
      </div>
    </div>
  );
}
