# Reading the Analyze tab {#analyze}

Analyze shows how much hard work each muscle got this week, and what to do about it.

![Analyze tab with body map, status legend and weekly suggestions](/guide/analyze.png)

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

## Body map and list {#analyze-body-map}

The body map has front and back views; tap a muscle for its details. Below the legend, the same data appears as a **list of muscles** with set counts and status, which is easier to scan and works well with screen readers.

## Week switching {#analyze-weeks}

Use the arrows at the top to look at earlier weeks. A week is a calendar week in your device's timezone and starts on the day you choose in Settings (default Monday). A workout belongs to the week it started in, even if it runs past midnight.

## The trend {#analyze-trend}

Tapping a muscle shows a small chart of the current week plus the {{trendWeeks}} weeks before it. Under **This week's suggestions**, the volume trend chart plots one muscle over a longer window: the last {{longTrendWeeks}} weeks plus the current one, with MEV and MRV reference lines. Pick the muscle from the dropdown. Until you have trained that muscle in at least {{charts.minSessions}} weeks, it shows a "not enough data" message instead.
