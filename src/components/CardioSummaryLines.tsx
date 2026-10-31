/** One line per cardio exercise, e.g. "Running 30 min · ≈ 4.3 km". Renders nothing when empty. */
export default function CardioSummaryLines({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="space-y-1">
      {lines.map((line) => (
        <p key={line} className="text-sm" data-testid="summary-cardio-line">
          {line}
        </p>
      ))}
    </div>
  );
}
