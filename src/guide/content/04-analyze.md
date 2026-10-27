# Reading the Analyze tab {#analyze}

Analyze shows how much hard work each muscle got this week, and what to do about it.

![Analyze tab at phone width: week summary card, Needs attention list and Plan vs. actual](/guide/analyze.png)

From top to bottom the tab shows the week switcher, a summary card, **Needs attention**, **Plan vs. actual** (only with an active program), the body map, suggestions, a trend chart and a list of all muscles. Everything in the first screen is meant to be readable without scrolling.

## The week summary {#analyze-summary}

The card at the top shows your **hard sets** this week (see below for what counts), the change compared with last week (up, down or unchanged), and a **status bar**: one segment per muscle status with a count of muscles in each. If a program is active it also shows sessions done out of planned.

## Needs attention {#analyze-attention}

A short list of muscles that are under their MEV or over their MRV. Each row names the muscle, its sets and the threshold it crosses. Tap a row to open that muscle's detail sheet. Only the first few are shown; use **Show all** for the rest.

## Plan vs. actual {#analyze-plan-vs-actual}

With an active program, this card compares the week with the plan: how many program days you have done, which days were **Skipped** (or **Not done yet** while the week is still running), and the muscles that are short of their planned sets, biggest shortfall first. If the program is running as a block, the card names the block week. Without an active program the card is hidden.

## Weighted sets {#analyze-weighted-sets}

An exercise rarely trains just one muscle. Each exercise has a **weight** per muscle: full weight (100%) for the primary mover, less for helpers. Every counted set adds that weight to each muscle.

Example: bench press has chest at full weight, and triceps and front delts at half weight. So 4 sets → chest 4, triceps 2, front delts 2.

Tap a muscle on the map or in the list to see which exercises contributed and how (sets × weight = weighted sets).

## What counts as a hard set {#analyze-hard-sets}

A set counts when all of these are true:

- It is marked **Done**.
- It is not a warm-up.
- It has more than zero reps.
- Its RIR is empty, or at most {{maxCountedRir}}.

A set you stopped with a lot left in the tank (RIR above {{maxCountedRir}}) is too easy to count as a hard set. If you do not record RIR, the set counts.

> [!HEURISTIC]
> Counting only sets reasonably close to failure is a common training heuristic for tracking volume. It is a rule of thumb, not a law.

## MEV, MAV and MRV {#analyze-landmarks}

Each muscle has three volume landmarks, in weighted sets per week:

| Landmark | Meaning                                                                        |
| -------- | ------------------------------------------------------------------------------ |
| MEV      | Minimum effective volume: below this, growth is unlikely                       |
| MAV      | Maximum adaptive volume: a range (low to high) where most people progress best |
| MRV      | Maximum recoverable volume: above this, recovery usually suffers               |

For example chest defaults to MEV {{targets.chest.mev}}, MAV {{targets.chest.mavLow}} to {{targets.chest.mavHigh}} and MRV {{targets.chest.mrv}}. Other muscles differ a little, and you can change any of them in Settings.

> [!HEURISTIC]
> These defaults are starting points in the spirit of popular volume-landmark ideas, not prescriptions. Genetics, sleep, food and training age shift them. This is not medical advice.

## Status colors {#analyze-statuses}

Each muscle gets one status from its weekly weighted sets:

| Status   | Weekly sets               |
| -------- | ------------------------- |
| None     | No sets logged            |
| Below    | Under MEV                 |
| Building | From MEV up to MAV low    |
| Optimal  | MAV low to MAV high       |
| High     | Above MAV high, up to MRV |
| Over     | Above MRV                 |

A legend sits under the body map. Colors are never the only signal: every muscle also has a text label.

## Body map {#analyze-body-map}

![Body map with the Below status highlighted in the legend](/guide/analyze-map.png)

The body map has **Front** and **Back** buttons under it. Tap a muscle to open its detail sheet. Muscles are drawn in their status color with a pattern as well, and every muscle also has a text label for screen readers.

The legend next to the map shows how many muscles are in each status, and it is also a filter. Tap a status to highlight only those muscles on the map and dim the rest, and the line under the legend says what is highlighted. Tap the same status again to clear it.

Body map shapes are adapted from MuscleMap (MIT licence).

## Muscle list {#analyze-muscle-list}

![Muscle list with range bars, set counts and small sparklines](/guide/analyze-rows.png)

Below the map, every muscle has a row with its sets this week, its MAV range, a status badge and a **range bar**. On the bar, the shaded band is the MAV range, the two ticks mark MEV and MRV, and the fill is this week's value. The scale runs a little past MRV, so an "over" value still fits. The small chart at the right is a sparkline of the last {{charts.sparklineWeeks}} weeks, including this one.

Use **Sort by** to order the rows (the default, **Needs most**, puts muscles furthest from their target first). The toggle **By muscle** / **By group** switches between one flat list and sections by push, pull and legs; Lift Log remembers your choice. Only the first {{analyzeUi.collapsedRows}} rows are shown until you press **Show all**.

## Muscle details {#analyze-detail}

![Detail sheet for chest with landmarks, contributing exercises and quick actions](/guide/analyze-detail.png)

Tapping a muscle (on the map, in a row or in Needs attention) opens a sheet with its status, the MEV, MAV and MRV numbers, the exercises that contributed this week (sets x weight = weighted sets, with their share), a trend, and a suggestion. Two buttons sit at the bottom:

- **Add sets** shows how many sets to add and which exercises to do them with. It only lists ideas; nothing is added to your log.
- **Swap** lets you pick one of this week's exercises and shows similar alternatives you could use instead.

## Week switching {#analyze-weeks}

Use the arrows at the top to look at earlier weeks. A week is a calendar week in your device's timezone and starts on the day you choose in Settings (default Monday). A workout belongs to the week it started in, even if it runs past midnight.

## The trend {#analyze-trend}

The detail sheet shows a small chart of the current week plus the {{trendWeeks}} weeks before it. In the trend section on the page, the volume trend chart plots one muscle over a longer window: the last {{longTrendWeeks}} weeks plus the current one, with MEV and MRV reference lines. Pick the muscle from the dropdown. Until you have trained that muscle in at least {{charts.minSessions}} weeks, it shows a "not enough data" message instead.
