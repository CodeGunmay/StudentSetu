// Renders StudentSetu screens and handles student actions.
import { useEffect, useState } from 'react';
import Avatar from './Avatar';

/**
 * Animated ring of avatars for an exchange circle.
 * Nodes sit on a circle, arrows follow the arcs and each arrow carries the
 * skill that the arrow's tail person learns.
 */
export default function ExchangeCircle({ people = [], edges = [], size = 264 }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.35;
  const nodeR = 22;
  const gap = (nodeR + 8) / r; // shorten each arc so arrows do not hit the avatars
  const labelR = r * 0.5; // labels sit inside the ring, clear of every avatar

  const angleAt = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / people.length;
  const point = (i, radius = r) => {
    const a = angleAt(i);
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  };

  const shorten = (skill) => (skill.length > 11 ? `${skill.slice(0, 10)}…` : skill);
  const widthOf = (skill) => shorten(skill).length * 5.8 + 12;

  const arcs = people.map((_, i) => {
    const a1 = angleAt(i) + gap;
    const a2 = angleAt((i + 1) % people.length) - gap;
    const from = { x: cx + r * Math.cos(a1), y: cy + r * Math.sin(a1) };
    const to = { x: cx + r * Math.cos(a2), y: cy + r * Math.sin(a2) };
    const mid = (a1 + a2) / 2;
    return {
      from,
      to,
      label: { x: cx + labelR * Math.cos(mid), y: cy + labelR * Math.sin(mid) },
      edge: edges[i],
    };
  });

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0" aria-hidden="true">
        <defs>
          <marker id="setu-arrow" viewBox="0 0 10 10" refX="7.5" refY="5" markerWidth="5.4" markerHeight="5.4" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" className="fill-brand-500" />
          </marker>
        </defs>

        {/* soft ring the arrows ride on */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-700/70" strokeWidth="1.5" strokeDasharray="3 6" />
        <circle cx={cx} cy={cy} r={labelR} fill="none" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="1" />

        {arcs.map((arc, i) => (
          <g key={i} style={{ opacity: ready ? 1 : 0, transition: `opacity .5s ease ${0.15 * i + 0.1}s` }}>
            <path
              d={`M ${arc.from.x} ${arc.from.y} A ${r} ${r} 0 0 1 ${arc.to.x} ${arc.to.y}`}
              fill="none"
              className="stroke-brand-500/80"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeDasharray="9 6"
              markerEnd="url(#setu-arrow)"
              style={{ animation: `flow-dash 1.1s ${0.18 * i}s infinite linear` }}
            />
            {arc.edge?.skill && (
              <g>
                <title>{arc.edge.skill}</title>
                <rect
                  x={arc.label.x - widthOf(arc.edge.skill) / 2}
                  y={arc.label.y - 9}
                  width={widthOf(arc.edge.skill)}
                  height={18}
                  rx={6}
                  className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
                  strokeWidth="1"
                />
                <text
                  x={arc.label.x}
                  y={arc.label.y + 3.5}
                  textAnchor="middle"
                  className="fill-brand-700 dark:fill-brand-300"
                  style={{ fontSize: 10, fontWeight: 800, letterSpacing: '-0.2px' }}
                >
                  {shorten(arc.edge.skill)}
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>

      {people.map((p, i) => {
        const pos = point(i);
        return (
          <div
            key={p.id || i}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-center transition-all duration-500"
            style={{
              left: pos.x,
              top: pos.y,
              opacity: ready ? 1 : 0,
              transform: `translate(-50%,-50%) scale(${ready ? 1 : 0.6})`,
              transitionDelay: `${0.12 * i}s`,
            }}
          >
            <div className={p.isMe ? 'relative' : ''}>
              <Avatar name={p.name} color={p.color} size="md" ring={false} className="shadow-lg" />
              {p.isMe && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full bg-accent-500 ring-2 ring-white dark:ring-slate-900" />}
            </div>
            <p
              className="mt-1 whitespace-nowrap rounded-full bg-white/85 px-1.5 py-0.5 text-[10.5px] font-extrabold text-slate-700 backdrop-blur dark:bg-slate-900/85 dark:text-slate-200"
              style={{ width: nodeR * 2 + 30 }}
            >
              {p.isMe ? 'You' : p.name}
            </p>
          </div>
        );
      })}
    </div>
  );
}
