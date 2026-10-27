# Following a program {#programs}

A program is a weekly plan: a few training days, each with exercises and a target number of sets. It is optional. Freestyle logging always works.

## Templates and your own programs {#programs-templates}

Open **Manage programs** on the Workout tab (or go to `/programs`). You will see **My programs** and built-in **Templates**.

![Programs page with My programs and built-in templates](/guide/programs.png)

Templates are read-only, and the built-in ones now include arm isolation work (dumbbell biceps curl, cable curl, triceps pushdown). Tap one, then **Edit a copy** to get your own editable version. You can also use **New program** or the copy button on any row.

In your own program you can rename days, add or remove days and exercises, reorder them, and set target sets and an optional rep range per exercise.

## Make it active {#programs-active}

Open a program and press **Set as active**. Only one program is active at a time. Press the button again to deactivate it. The active program is marked with an **Active** badge.

## Weekly volume check {#programs-plan-check}

At the bottom of every program is the **Weekly volume check**. It projects weighted sets per muscle if you do every day once, using the same weights as the Analyze tab, and shows a status badge for each muscle. Warnings list muscles that land below the minimum effective volume or above what you can recover from.

> [!HEURISTIC]
> The check is a planning aid built on default volume landmarks (MEV, MAV, MRV). A warning means "look at this", not "this is wrong". Your experience and recovery matter more.

## Start a day {#programs-start-day}

With an active program and no session running, the Workout tab shows one button per day, named like **Start Day: Full Body A** (with the day number). Pressing it starts a session with that day's exercises and empty sets, ready to fill in. If the program is running as a block, a line above the buttons says which block week you are in, and the new session uses that week's set counts (see below).

## Run a program as a block {#programs-block}

A block (a mesocycle) repeats your program for several weeks, adds sets gradually, and ends with an easy week. Open one of your own programs and find **Run as block** near the bottom.

![Run as block setup: length stepper, exercises that ramp, and the start button](/guide/block-setup.png)

1. Choose the length with the **-** and **+** buttons: from {{blocks.minWeeks}} to {{blocks.maxWeeks}} weeks, including the final deload week. The default is {{blocks.defaultWeeks}}.
2. Tick the **Exercises that ramp**. By default it is the first exercise of each day.
3. Press the start button (it names the length you chose). The first week begins on the week-start day of the current week (see Settings).

The ramp rule: each ticked exercise gains {{blocks.ramp.setsPerWeek}} set per week, up to at most {{blocks.ramp.maxExtraSets}} extra sets above the program's own number. Exercises you did not tick stay at their normal sets. The **last week is a planned deload**: every exercise gets about {{deload.setsFraction}} of its sets (at least one) and you stop with {{deload.targetRir.min}} to {{deload.targetRir.max}} reps in reserve.

> [!NOTE]
> Blocks run on calendar weeks, not on how many sessions you did. A skipped week still moves the block forward. Use **Restart block** to begin again from the first week.

### The week strip {#programs-block-strip}

Once a block is running, the panel shows **Week N of M** and a strip of week buttons. The current week is filled in, the deload week is labelled **Deload**, and a week that would push a muscle over its recoverable volume shows an **MRV** warning. Tap any week to preview its sets per exercise and its own weekly volume check, including a sentence for each muscle above its MRV in that week.

![Block panel with the week strip, a middle week selected, set counts per exercise and the weekly volume check](/guide/block-strip.png)

Previewing a week changes nothing. **Restart block** makes the current week the first week. **End block** (after a confirmation) sends days back to the program's normal set counts; logged workouts are never affected. When a block has finished, the panel says so and offers Restart.

## Equipment flags and swaps {#programs-equipment}

If a program exercise needs equipment you have not ticked in Settings (My equipment), it shows a **Not in your equipment** flag. On your own programs, press the swap button on a flagged exercise to pick a similar one you can do.
