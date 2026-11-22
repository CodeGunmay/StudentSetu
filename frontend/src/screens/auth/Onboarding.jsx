// Renders StudentSetu screens and handles student actions.
import { useState } from 'react';
import { ArrowRight, GraduationCap, Package, Repeat } from 'lucide-react';
import Button from '../../ui/Button';
import Logo from '../../ui/Logo';
import { useApp } from '../../context/AppContext';

const SLIDES = [
  {
    icon: Repeat,
    title: 'Swap skills',
    body: 'You teach C++, they teach Python. No money, no classes, just two students who both win.',
    art: 'from-brand-500 to-indigo-700',
  },
  {
    icon: GraduationCap,
    title: 'Learn from seniors',
    body: 'Book paid sessions with students who already aced the paper — from ₹100 an hour, on campus.',
    art: 'from-accent-400 to-orange-600',
  },
  {
    icon: Package,
    title: 'Pass on your stuff',
    body: 'Give it away, barter it or sell it. A waitlist keeps the queue fair for everyone.',
    art: 'from-emerald-400 to-teal-600',
  },
];

export default function Onboarding() {
  const [index, setIndex] = useState(0);
  const { replaceTop } = useApp();
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  const finish = () => {
    localStorage.setItem('setu.intro', '1');
    replaceTop('login');
  };

  return (
    <div className="flex h-full flex-col bg-canvas dark:bg-slate-950">
      <div className="flex items-center justify-between px-5 pt-4">
        <Logo size={20} />
        <button
          type="button"
          onClick={finish}
          className="rounded-xl px-3 py-2 text-[13px] font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          Skip
        </button>
      </div>

      <div className="flex flex-1 flex-col justify-center px-6">
        <div
          key={index}
          className={`relative grid h-[260px] animate-fade-up place-items-center overflow-hidden rounded-[32px] bg-gradient-to-br shadow-lift ${slide.art}`}
        >
          <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,.9), transparent 45%)' }} />
          <span className="relative grid h-20 w-20 place-items-center rounded-3xl bg-white/20 text-white ring-1 ring-white/40 backdrop-blur">
            <slide.icon size={38} strokeWidth={1.8} />
          </span>
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/25 to-transparent" />
        </div>

        <div key={`copy-${index}`} className="animate-fade-up">
          <h2 className="mt-7 text-[26px] font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white">
            {slide.title}
          </h2>
          <p className="mt-2 text-[14.5px] leading-relaxed muted">{slide.body}</p>
        </div>
      </div>

      <div className="px-6 pb-8">
        <div className="mb-5 flex justify-center gap-2" role="tablist" aria-label="Intro slides">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1}: ${s.title}`}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${i === index ? 'w-7 bg-brand-600' : 'w-2 bg-slate-300 dark:bg-slate-700'}`}
            />
          ))}
        </div>
        <Button full size="lg" icon={last ? undefined : ArrowRight} onClick={() => (last ? finish() : setIndex((i) => i + 1))}>
          {last ? 'Get started' : 'Next'}
        </Button>
      </div>
    </div>
  );
}
