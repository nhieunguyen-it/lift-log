export default function ExerciseNote({ note }: { note?: string }) {
  if (!note) return null;
  return (
    <p
      className="text-muted-foreground text-sm break-words whitespace-pre-wrap"
      data-testid="exercise-note"
    >
      {note}
    </p>
  );
}
