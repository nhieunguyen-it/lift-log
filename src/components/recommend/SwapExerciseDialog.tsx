import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import AlternativesList from './AlternativesList';

interface Props {
  /** Exercise being swapped; dialog is open while set. */
  exerciseId: string | null;
  exerciseName?: string;
  onPick: (newExerciseId: string) => void;
  onClose: () => void;
}

export default function SwapExerciseDialog({ exerciseId, exerciseName, onPick, onClose }: Props) {
  return (
    <Dialog open={exerciseId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-dvh overflow-y-auto"
        data-testid="swap-dialog"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>Swap {exerciseName ?? 'exercise'}</DialogTitle>
          <DialogDescription>
            Similar exercises for your equipment. Your sets are kept.
          </DialogDescription>
        </DialogHeader>
        {exerciseId && (
          <AlternativesList
            exerciseId={exerciseId}
            onPick={(id) => {
              onPick(id);
              onClose();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
