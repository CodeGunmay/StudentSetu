/** Setu = bridge. The arc + deck is the whole mark, so it survives tiny sizes. */
export function BridgeMark({ size = 28, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="StudentSetu bridge logo"
    >
      <path
        d="M2.5 22.5C9.5 7 22.5 7 29.5 22.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path d="M1 22.5h30" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M8.6 16.4v6.1M16 13.4v9.1M23.4 16.4v6.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="27.4" r="1.7" fill="#F59E0B" />
    </svg>
  );
}

export default function Logo({ size = 24, tone = 'brand', className = '' }) {
  const color = tone === 'light' ? 'text-white' : 'text-brand-600 dark:text-brand-300';
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`grid place-items-center rounded-xl ${
          tone === 'light' ? 'bg-white/15' : 'bg-brand-600 text-white shadow-lift'
        }`}
        style={{ width: size + 12, height: size + 12 }}
      >
        <BridgeMark size={size} className={tone === 'light' ? 'text-white' : 'text-white'} />
      </span>
      <span className={`text-[19px] font-extrabold tracking-tight ${tone === 'light' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
        Student<span className={tone === 'light' ? 'text-accent-300' : 'text-brand-600 dark:text-brand-300'}>Setu</span>
      </span>
    </span>
  );
}
