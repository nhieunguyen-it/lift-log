# Progression targets {#progression}

## The target chip {#progression-chip}

Each exercise card on the Workout tab has a **target chip** that suggests what to try today, based on your last session of that exercise. Tap it to fill the next empty set. The session you are logging never counts as "last time".

With no history it just shows a rep range to aim for. If a set is already filled in, only empty fields are overwritten.

## Double progression {#progression-double}

Lift Log uses double progression: first add reps, then add weight.

1. Stay at the same weight and add about a rep per session.
2. When **every** working set reaches the top of the rep range with RIR at most {{targetRir.max}}, the chip suggests more weight and resets reps to the bottom of the range.

Default rep ranges: compounds {{repRanges.compound.min}} to {{repRanges.compound.max}}, bodyweight {{repRanges.bodyweight.min}} to {{repRanges.bodyweight.max}}, isolation {{repRanges.isolation.min}} to {{repRanges.isolation.max}}. A few exercises (deadlift, planks) have their own range.

> [!HEURISTIC]
> A target RIR of {{targetRir.min}} to {{targetRir.max}} keeps sets hard but repeatable. Double progression is one simple model among many.

## Load steps {#progression-load-steps}

The suggested jump depends on the kind of exercise:

| Kind                               | kg                           | lbs                           |
| ---------------------------------- | ---------------------------- | ----------------------------- |
| Lower-body barbell, machine, cable | {{loadStepsKg.lowerBarbell}} | {{loadStepsLbs.lowerBarbell}} |
| Upper-body barbell, machine, cable | {{loadStepsKg.upperBarbell}} | {{loadStepsLbs.upperBarbell}} |
| Dumbbell or kettlebell (per hand)  | {{loadStepsKg.dumbbell}}     | {{loadStepsLbs.dumbbell}}     |
| Anything else                      | {{loadStepsKg.other}}        | {{loadStepsLbs.other}}        |

Suggestions are rounded to weights you can actually load in your unit.

## Hold and deload {#progression-hold}

If any set falls below the bottom of the rep range, that session is a miss.

- After {{missesToHold}} misses in a row the chip says **hold** the weight.
- After {{missesToDeload}} misses in a row it suggests a small **deload**: about one tenth lighter (a fraction of {{deloadFraction}}).

A good session ends the streak.

## Bodyweight and variants {#progression-variants}

For bodyweight exercises with no added load, hitting the top of the range suggests a harder **variant** instead of weight. Chains include inverted row, chin-up, pull-up; incline push-up, push-up, decline push-up, dip; crunch, hanging leg raise; and bodyweight squat, bodyweight lunge. At the end of a chain it suggests adding weight or a harder variation.

## Fatigue hint on one exercise {#progression-exercise-hint}

During a workout, a small grey note can appear under an exercise's target chip, that says what looks off and ends with "consider lighter sets". It means that one exercise looks fatigued (same signals as below) but not enough of your training does to suggest a full deload.

- It shows only when a single exercise is flagged. If enough exercises are flagged for a full deload week, the **Consider a deload week** card is shown instead and the per-exercise notes are hidden.
- Tap the **x** to dismiss it. It stays hidden for that exercise for a while, even after new sessions.
- It never changes your data, targets or plan. The target chip still suggests what it suggested.

## Deload suggestions {#progression-deload}

When fatigue seems to build, a **Consider a deload week** card appears on the Workout (when no session is running) and Analyze tabs. It looks at the last {{deload.lookbackSessions}} sessions of each exercise (at least {{deload.minSessions}} needed) for:

- estimated one-rep max (e1RM) down from its recent peak by at least {{deload.e1rmDropFraction}} as a fraction,
- average RIR falling while reps also fall,
- repeated misses, as above.

The card appears when at least {{deload.exercisesForOverall}} exercises are flagged. It suggests keeping the same exercises next week, doing about {{deload.setsFraction}} of your usual sets and stopping with {{deload.targetRir.min}} to {{deload.targetRir.max}} reps in reserve. **Dismiss** hides it for a while.

> [!HEURISTIC]
> This is a heuristic nudge, never an order. Nothing in your log or plan changes. Sleep, stress or a bad day can mimic fatigue, so use your judgement. This is not medical advice.
