import { useState } from 'react';
import { ArrowDown, ArrowUp, Info, Plus, Repeat2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import ExerciseDetailDialog from '@/components/ExerciseDetailDialog';
import ExercisePicker from '@/components/ExercisePicker';
import TargetChip from '@/components/recommend/TargetChip';
import ExerciseDeloadHint from '@/components/progress/ExerciseDeloadHint';
import SwapExerciseDialog from '@/components/recommend/SwapExerciseDialog';
import { CustomBadge } from '@/components/custom';
import SetRowItem, { SET_GRID } from '@/components/SetRowItem';
import type { MergedExercise } from '@/data/merged';
import { sessionsRepo, setsRepo, type SessionDetail } from '@/db';
import { nameFor, useExerciseLookup } from '@/db/customHooks';
import type { WeightUnit } from '@/lib/units';

interface Props {
  detail: SessionDetail;
  unit: WeightUnit;
}

/** Exercise cards with set rows + add exercise; shared by workout and history detail. */
export default function SessionEditor({ detail, unit }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [infoId, setInfoId] = useState<string | null>(null);
  const [swap, setSwap] = useState<{ seId: string; exerciseId: string; name: string } | null>(null);
  const lookup = useExerciseLookup();
  const { session, exercises } = detail;

  return (
    <div className="space-y-4">
      {exercises.length === 0 && (
        <p className="text-muted-foreground py-6 text-center text-sm">
          No exercises yet. Add one to get started.
        </p>
      )}
      {exercises.map(({ sessionExercise: se, exercise: seedExercise, sets }, i) => {
        // Custom exercises (and tombstones) are not in the seed table; resolve them here.
        const exercise: MergedExercise | undefined = seedExercise ?? lookup?.get(se.exerciseId);
        const exerciseName = lookup
          ? nameFor(lookup, se.exerciseId)
          : (exercise?.name ?? se.exerciseId);
        return (
          <Card key={se.id} data-testid="exercise-card" data-exercise-id={se.exerciseId}>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between gap-1">
                <div className="min-w-0">
                  <p className="font-semibold break-words" data-testid="exercise-name">
                    {exerciseName}
                    {exercise?.isCustom && <CustomBadge className="ml-2 align-middle" />}
                  </p>
                  {exercise?.isBodyweight && (
                    <p className="text-muted-foreground text-xs">
                      Bodyweight · weight is added load
                    </p>
                  )}
                </div>
                <div className="flex shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${exerciseName} info`}
                    data-testid="exercise-info"
                    onClick={() => setInfoId(se.exerciseId)}
                  >
                    <Info />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Swap ${exerciseName}`}
                    data-testid="swap-exercise"
                    onClick={() =>
                      setSwap({
                        seId: se.id,
                        exerciseId: se.exerciseId,
                        name: exerciseName,
                      })
                    }
                  >
                    <Repeat2 />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${exerciseName} up`}
                    data-testid="move-up"
                    disabled={i === 0}
                    onClick={() => void sessionsRepo.moveExercise(se.id, 'up')}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${exerciseName} down`}
                    data-testid="move-down"
                    disabled={i === exercises.length - 1}
                    onClick={() => void sessionsRepo.moveExercise(se.id, 'down')}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${exerciseName}`}
                    data-testid="remove-exercise"
                    onClick={() => {
                      if (sets.length === 0 || window.confirm('Remove exercise and its sets?')) {
                        void sessionsRepo.removeExercise(se.id);
                      }
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <TargetChip
                exerciseId={se.exerciseId}
                sessionId={session.id}
                sessionExerciseId={se.id}
                sets={sets}
              />
              <ExerciseDeloadHint exerciseId={se.exerciseId} />
              {sets.length > 0 && (
                <div
                  className={`${SET_GRID} text-muted-foreground text-center text-xs`}
                  aria-hidden="true"
                >
                  <span>Set</span>
                  <span>{exercise?.isBodyweight ? `+${unit}` : unit}</span>
                  <span>Reps</span>
                  <span>RIR</span>
                  <span>Done</span>
                </div>
              )}
              <ul className="space-y-2">
                {sets.map((s, idx) => (
                  <SetRowItem
                    key={s.id}
                    set={s}
                    index={idx}
                    unit={unit}
                    bodyweight={exercise?.isBodyweight ?? false}
                  />
                ))}
              </ul>
              <Button
                variant="secondary"
                className="w-full"
                data-testid="add-set"
                onClick={() => void setsRepo.addSet(se.id)}
              >
                <Plus /> Add set
              </Button>
            </CardContent>
          </Card>
        );
      })}
      <Button
        variant="outline"
        className="w-full"
        data-testid="add-exercise"
        onClick={() => setPickerOpen(true)}
      >
        <Plus /> Add exercise
      </Button>
      <SwapExerciseDialog
        exerciseId={swap?.exerciseId ?? null}
        exerciseName={swap?.name}
        onPick={(newId) => swap && void sessionsRepo.swapExercise(swap.seId, newId)}
        onClose={() => setSwap(null)}
      />
      <ExerciseDetailDialog exerciseId={infoId} onClose={() => setInfoId(null)} />
      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(exerciseId) => void sessionsRepo.addExercise(session.id, exerciseId)}
      />
    </div>
  );
}
