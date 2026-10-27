/** Placeholder shown while the analysis loads (replaces "Loading…"). */
export default function AnalyzeSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading analysis"
      className="space-y-3"
      data-testid="analyze-skeleton"
    >
      <div className="bg-muted h-24 animate-pulse rounded-xl motion-reduce:animate-none" />
      <div className="bg-muted h-20 animate-pulse rounded-xl motion-reduce:animate-none" />
      <div className="bg-muted h-48 animate-pulse rounded-xl motion-reduce:animate-none" />
    </div>
  );
}
