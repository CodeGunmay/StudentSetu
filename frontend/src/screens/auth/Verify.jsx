// Renders StudentSetu screens and handles student actions.
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Mail, ShieldCheck, Smartphone } from 'lucide-react';
import api, { DEMO_HINTS } from '../../api';
import { useApp } from '../../context/AppContext';
import Button from '../../ui/Button';
import { Field } from '../../ui/Inputs';
import { TopBar } from '../../ui/Chrome';

/**
 * Confirm the college email with the 6-digit code.
 *
 * Reached from Register (straight after signing up) and from Login when the
 * server says the account is not verified yet. The dev code is only ever shown
 * when hints are explicitly enabled (mock dev server or VITE_DEMO_HINTS=true) —
 * `api` already strips it from the payload otherwise, so this screen has nothing
 * to hide and nothing to log.
 */
export default function Verify({ email = '', devOtp = '' } = {}) {
  const { pop, push, signIn, toast } = useApp();
  const [code, setCode] = useState(DEMO_HINTS && devOtp ? String(devOtp) : '');
  const [mail, setMail] = useState(email);
  const [error, setError] = useState('');
  const [field, setField] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const input = useRef(null);

  useEffect(() => {
    if (!cooldown) return undefined;
    const id = setInterval(() => setCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    input.current?.focus?.();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setField('');
    setBusy(true);
    try {
      const result = await api.verifyOtp({ email: mail, otp: code });
      await signIn(result);
      toast('Email confirmed — welcome to StudentSetu', 'success');
    } catch (err) {
      setError(err.message);
      setField(err.field || '');
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    try {
      await api.resendOtp(mail);
      setCooldown(30);
      toast('A fresh code is on its way', 'success');
    } catch (err) {
      setError(err.message);
      setField(err.field || '');
    }
  };

  return (
    <div className="flex h-full flex-col bg-canvas dark:bg-slate-950">
      <TopBar title="Confirm your email" subtitle="One code, then your profile is live" onBack={pop} right={<span />} />

      <div className="no-bar flex-1 overflow-y-auto px-4 pb-8 pt-3">
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/25"
          >
            {error}
          </div>
        )}

        <div className="card p-4">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            <Mail size={19} />
          </span>
          <h2 className="mt-3 text-[16px] font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white">
            We sent a code to {mail || 'your college email'}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed muted">
            It is valid once. Until it is confirmed, your profile stays hidden from the rest of campus.
          </p>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
          <Field label="College email" htmlFor="verify-email" error={field === 'email' ? error : ''}>
            <input
              id="verify-email"
              type="email"
              inputMode="email"
              autoComplete="username"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
              placeholder="you@geu.ac.in"
              className={`field ${field === 'email' ? 'field-error' : ''}`}
            />
          </Field>

          <Field
            label="6-digit code"
            htmlFor="verify-otp"
            error={field === 'otp' ? error : ''}
            hint={DEMO_HINTS && devOtp ? `Dev/demo code: ${devOtp}` : undefined}
          >
            <input
              id="verify-otp"
              ref={input}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="••••••"
              aria-invalid={field === 'otp'}
              className={`field font-mono text-[18px] tracking-[0.4em] ${field === 'otp' ? 'field-error' : ''}`}
            />
          </Field>

          <Button type="submit" full size="lg" loading={busy} icon={busy ? undefined : ArrowRight} disabled={code.length !== 6}>
            Confirm and continue
          </Button>

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={resend}
              disabled={cooldown > 0}
              className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-[12.5px] font-bold text-brand-600 transition active:scale-95 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-brand-300 dark:hover:bg-brand-500/10"
            >
              <Smartphone size={13} /> {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
            </button>
            <span className="text-[11.5px] muted">Not {mail || 'your'} inbox? Check spam, then resend.</span>
          </div>
        </form>

        <div className="mt-6 rounded-2xl bg-white p-3.5 text-[12.5px] leading-relaxed muted shadow-card dark:bg-slate-900">
          <span className="mb-1 flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
            <ShieldCheck size={14} className="text-emerald-500" /> Why the code
          </span>
          A verified <span className="font-bold">@geu.ac.in</span> address is what keeps this campus-only. The code is the only proof we ask for,
          and we never keep it after you confirm.
        </div>

        <p className="mt-6 text-center text-[13px] muted">
          Wrong address?{' '}
          <button type="button" onClick={() => push('register')} className="font-bold text-brand-600 underline-offset-2 hover:underline dark:text-brand-300">
            Start the sign-up again
          </button>
        </p>
      </div>
    </div>
  );
}
