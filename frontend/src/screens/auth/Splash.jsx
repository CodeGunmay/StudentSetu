// Renders StudentSetu screens and handles student actions.
import { useEffect } from 'react';
import Logo from '../../ui/Logo';
import { useApp } from '../../context/AppContext';

/** Splash: brand moment, then straight into the app (or the intro). */
export default function Splash() {
  const { user, booting, replaceTop, goTab } = useApp();

  useEffect(() => {
    const t = setTimeout(() => {
      if (user) goTab('home');
      else replaceTop(localStorage.getItem('setu.intro') ? 'login' : 'onboarding');
    }, 1500);
    return () => clearTimeout(t);
  }, [user, booting, goTab, replaceTop]);

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-brand-600 text-white">
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-400/40 blur-2xl" />
      <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-accent-500/30 blur-2xl" />
      <div className="relative grid animate-pop place-items-center">
        <div className="grid h-24 w-24 place-items-center rounded-[28px] bg-white/10 ring-1 ring-white/25 backdrop-blur">
          <Logo size={44} tone="light" className="flex-col gap-2" />
        </div>
      </div>
      <h1 className="relative mt-7 text-[26px] font-extrabold tracking-tight">
        Student<span className="text-accent-300">Setu</span>
      </h1>
      <p className="relative mt-1.5 text-[13px] font-medium text-white/70">Every skill on campus, bridged.</p>
      <div className="relative mt-10 h-1 w-24 overflow-hidden rounded-full bg-white/20">
        <div className="splash-bar h-full w-1/2 rounded-full bg-white/80" />
      </div>
      <style>{`.splash-bar{animation:slide-load 1.4s ease-in-out infinite}@keyframes slide-load{0%{transform:translateX(-110%)}100%{transform:translateX(240%)}}`}</style>
    </div>
  );
}
