// Renders StudentSetu screens and handles student actions.
import api from '../api';
import { StatusBar } from './Chrome';
import BottomNav from './BottomNav';
import Logo from './Logo';

/**
 * Phone-first shell: on a small screen the app owns the whole viewport, on a
 * desktop it sits inside a centred 390x844 phone with a notch and a soft shadow.
 */
export default function PhoneFrame({ children, statusTone = 'dark', showNav = true }) {
  return (
    <div className="app-root relative w-full bg-gradient-to-br from-indigo-100 via-slate-50 to-amber-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 md:grid md:place-items-center md:p-6">
      {/* soft blobs behind the phone on desktop */}
      <div className="pointer-events-none absolute -left-24 top-10 hidden h-80 w-80 rounded-full bg-brand-400/25 blur-3xl md:block dark:bg-brand-500/20" />
      <div className="pointer-events-none absolute -right-20 bottom-10 hidden h-72 w-72 rounded-full bg-accent-400/25 blur-3xl md:block dark:bg-accent-500/10" />

      <div className="relative hidden select-none md:absolute md:-top-1 md:left-8 md:z-10 md:block lg:left-16">
        <Logo size={22} />
        <p className="mt-2 max-w-[220px] text-[12.5px] font-semibold leading-snug text-slate-500 dark:text-slate-400">
          Campus skills, items and tutors — bridged.{' '}
          {api.USE_MOCK ? (
            <>
              Tap <span className="font-extrabold text-slate-700 dark:text-slate-200">Try demo</span> to sign in as Gunmay.
            </>
          ) : (
            <>
              Sign in with your{' '}
              <span className="font-extrabold text-slate-700 dark:text-slate-200">@geu.ac.in</span> account.
            </>
          )}
        </p>
      </div>

      <div
        className="relative mx-auto flex h-full w-full flex-col overflow-hidden bg-canvas dark:bg-slate-950 md:h-[844px] md:max-h-[92vh] md:w-[390px] md:rounded-[3.2rem] md:shadow-frame md:ring-[2px] md:ring-slate-900/15"
        id="device"
      >
        {/* notch / dynamic island */}
        <div className="pointer-events-none absolute left-1/2 top-1.5 z-[70] hidden h-[26px] w-[108px] -translate-x-1/2 rounded-full bg-slate-900 md:block" />

        <StatusBar tone={statusTone} />

        <div className="relative min-h-0 flex-1">{children}</div>

        {showNav && <BottomNav />}

        {/* sheets and toasts mount inside the phone, not the page */}
        <div id="overlay-layer" className="pointer-events-none absolute inset-0 z-50" />
      </div>

      <p className="mt-4 hidden text-center text-[11.5px] font-semibold text-slate-400 md:block dark:text-slate-500">
        390 × 844 · PWA-ready ·{' '}
        {api.USE_MOCK
          ? 'mock API with a 300 ms delay — flip USE_MOCK in src/api/index.js to point at a real server'
          : `live REST API at ${api.BASE_URL || 'the same origin'}`}
      </p>
    </div>
  );
}
