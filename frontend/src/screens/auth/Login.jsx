// Renders StudentSetu screens and handles student actions.
import { useState } from 'react';
import { ArrowRight, PlayCircle, ShieldCheck } from 'lucide-react';
import api, { DEMO_HINTS, USE_MOCK } from '../../api';
import { useApp } from '../../context/AppContext';
import Button from '../../ui/Button';
import Logo from '../../ui/Logo';
import { Field, PasswordInput } from '../../ui/Inputs';

/**
 * Login with the college email + password.
 *
 * The one-tap demo sign-in is a mock-mode affordance: there is no /api/auth/demo
 * route on the C++ server, so the button is not rendered in real mode at all
 * (rather than rendered and then failing).
 */
export default function Login() {
  const { push, signIn, toast } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState('');

  const submit = async (mode) => {
    setErrors({});
    setFormError('');
    const next = {};
    if (mode === 'demo' && !USE_MOCK) return; // never offered, never callable
    if (mode === 'email') {
      if (!email.trim()) next.email = 'Enter your college email';
      else if (!email.trim().toLowerCase().endsWith('@geu.ac.in')) next.email = 'College emails end with @geu.ac.in';
      if (!password) next.password = 'Enter your password';
    }
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setBusy(mode);
    try {
      const result = mode === 'demo' ? await api.demoLogin() : await api.login({ email, password });
      // an unconfirmed account is not a session: send them to the code screen
      if (result?.needsVerify || result?.user?.verified === false) {
        setPassword('');
        push('verify', { email: email.trim().toLowerCase(), devOtp: result?.devOtp || '' });
        return;
      }
      await signIn(result);
      toast(mode === 'demo' ? 'Signed in as Gunmay — demo data loaded' : `Welcome back, ${result.user.name}`, 'success');
    } catch (err) {
      if (err.needsVerify) {
        setPassword('');
        push('verify', { email: err.email || email.trim().toLowerCase(), devOtp: err.devOtp || '' });
        return;
      }
      if (err.field) setErrors({ [err.field]: err.message });
      else setFormError(err.message);
    } finally {
      setBusy('');
    }

    // the typed password lives in this component only for the length of the
    // request; nothing here writes it to storage or the console
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-brand-600">
      <div className="absolute -left-20 -top-16 h-64 w-64 rounded-full bg-brand-400/40 blur-2xl" />
      <div className="absolute -bottom-28 -right-12 h-72 w-72 rounded-full bg-accent-500/25 blur-3xl" />

      <div className="relative px-6 pt-7 text-white">
        <Logo size={22} tone="light" />
        <h1 className="mt-7 text-[27px] font-extrabold leading-tight tracking-tight">Welcome back.</h1>
        <p className="mt-1.5 text-[14px] text-white/75">Log in with your GEU email to keep your swaps going.</p>
      </div>

      <div className="relative mt-7 flex-1 overflow-y-auto rounded-t-[30px] bg-canvas px-5 pb-6 pt-6 dark:bg-slate-950">
        {formError && (
          <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/25">
            {formError}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit('email');
          }}
          className="space-y-4"
        >
          <Field label="College email" htmlFor="login-email" error={errors.email}>
            <input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@geu.ac.in"
              aria-invalid={!!errors.email}
              className={`field ${errors.email ? 'field-error' : ''}`}
            />
          </Field>

          <Field
            label="Password"
            htmlFor="login-password"
            error={errors.password}
            hint={DEMO_HINTS ? 'Demo accounts all use 123456' : undefined}
          >
            <PasswordInput
              id="login-password"
              value={password}
              onChange={setPassword}
              error={errors.password}
              autoComplete="current-password"
              placeholder="••••"
            />
          </Field>

          <Button type="submit" full size="lg" loading={busy === 'email'} icon={busy === 'email' ? undefined : ArrowRight}>
            Log in
          </Button>
        </form>

        {USE_MOCK && (
          <>
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-[11px] font-bold uppercase tracking-widest muted">or</span>
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            <Button full size="lg" variant="soft" icon={PlayCircle} loading={busy === 'demo'} onClick={() => submit('demo')}>
              Try demo as Gunmay
            </Button>
          </>
        )}

        <div className="mt-6 rounded-2xl bg-white p-3.5 text-[12.5px] leading-relaxed muted shadow-card dark:bg-slate-900">
          <span className="mb-1 flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
            <ShieldCheck size={14} className="text-emerald-500" /> Privacy on StudentSetu
          </span>
          Your email stays hidden until you accept a request. Accounts are verified by their @geu.ac.in address, and the app shows a verified
          badge only when the server actually says so.
        </div>

        <p className="mt-6 text-center text-[13px] muted">
          New here?{' '}
          <button type="button" onClick={() => push('register')} className="font-bold text-brand-600 underline-offset-2 hover:underline dark:text-brand-300">
            Create an account
          </button>
        </p>
      </div>
    </div>
  );
}
