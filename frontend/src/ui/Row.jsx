// Renders StudentSetu screens and handles student actions.
import { SectionHeader } from './Chrome';
import { RowSkeleton } from './States';

/** Horizontal snap carousel, as used on Home. */
export default function Row({ title, subtitle, actionLabel, onAction, loading, children, empty }) {
  return (
    <section>
      <div className="screen-pad">
        <SectionHeader title={title} subtitle={subtitle} actionLabel={actionLabel} onAction={onAction} />
      </div>
      {loading ? (
        <div className="screen-pad">
          <RowSkeleton />
        </div>
      ) : empty ? (
        <div className="screen-pad">
          <p className="card px-4 py-4 text-[13px] muted">{empty}</p>
        </div>
      ) : (
        <div className="no-bar snap-x-row flex gap-3 overflow-x-auto px-4 pb-1">
          {children}
        </div>
      )}
    </section>
  );
}
