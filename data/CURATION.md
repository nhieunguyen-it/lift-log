# Curation notes

Hand-review decisions behind `data/curation.json`. Source: free-exercise-db (see README.md).
Policy: common bodyweight exercises and compound lifts only; isolation exercises only as
listed under "Isolation exceptions".

## Weight overrides (outside the default 1.0 / 0.5)

One line per exercise: the reason for each non-default weight (or other deviation from the source muscle lists).

- **incline-barbell-bench-press**: front_delts .75: incline shifts load to the anterior deltoid
- **close-grip-bench-press**: chest .75: still a major pressing contributor
- **incline-dumbbell-press**: front_delts .75: incline shifts load to the anterior deltoid
- **push-up**: abs .25: plank-style trunk bracing
- **dip**: chest .75: source lists chest as secondary; dips load it heavily
- **overhead-press**: upper_back .25: traps assist the lockout; source says shoulders+triceps only
- **dumbbell-shoulder-press**: side_delts .75: free dumbbells allow wider path, more lateral delt
- **push-press**: triceps .75: leg drive then heavy triceps lockout; quads .5 from the dip-drive; level lowered from expert
- **upright-row**: upper_back .75: traps are co-primary; source lists only traps secondary
- **dumbbell-lateral-raise**: ISOLATION EXCEPTION: side_delts. front_delts/upper_back .25: minor assist
- **face-pull**: upper_back .75 and rear_delts primary: source mapped to generic shoulders; side_delts .25 from external rotation
- **pull-up**: rear_delts .25 / forearms .25: grip and scapular retraction contribution
- **chin-up**: biceps .75: supinated grip raises biceps share
- **lat-pulldown**: rear_delts .25: scapular retraction
- **barbell-row**: lats .75: source lists as secondary; lower_back .5 isometric hinge hold; forearms .25 grip
- **one-arm-dumbbell-row**: lats primary: the unsupported one-arm row is lat-dominant; upper_back .75
- **seated-cable-row**: lats .75: source lists as secondary
- **t-bar-row**: lower_back .5: isometric hinge hold
- **inverted-row**: abs .25: plank-style bracing
- **machine-row**: upper_back .75 / rear_delts .25: scapular retraction
- **deadlift**: glutes+hamstrings co-primary 1.0, lower_back/upper_back .75, quads .5, lats .5, forearms .5: source marks lower back sole primary
- **sumo-deadlift**: glutes primary and adductors .75: wide stance recruits adductors heavily; source lists hamstrings primary
- **romanian-deadlift**: glutes .75: major hip extensor in the hinge
- **trap-bar-deadlift**: glutes/hamstrings .75: source lists them at secondary; upper_back, forearms .5 added
- **good-morning**: lower_back .75 and glutes .75: spinal erectors work isometrically; force changed push->pull (hinge)
- **back-extension**: mechanic changed isolation->compound (hip + spinal extension); equipment other->bodyweight
- **hip-thrust**: quads .25 / adductors .25 added; source lists calves, which are minimal
- **glute-bridge**: mechanic changed isolation->compound (multi-joint hip extension); lower_back .25
- **cable-pull-through**: hamstrings .75: strong hinge component
- **kettlebell-swing**: renamed from One-Arm Kettlebell Swings to two-handed swing; glutes made primary (hip-drive dominant)
- **power-clean**: trimmed from source (which lists 9 muscles): hip/knee extensors and traps dominate
- **barbell-back-squat**: glutes .75: strong hip extension out of the hole; adductors .5 added (not in source)
- **front-squat**: upper_back .5: front rack demands thoracic extension; level lowered from expert
- **goblet-squat**: equipment changed kettlebell->dumbbell (either works); abs .25 from anterior load
- **bodyweight-squat**: hamstrings/adductors .25: light assist for unloaded squat
- **leg-press**: hamstrings .25: seated position limits hamstring contribution
- **dumbbell-split-squat**: glutes .75: deep stride lengthens glute loading
- **dumbbell-lunge**: glutes .75: lunges are strong glute work
- **dumbbell-reverse-lunge**: glutes .75: reverse lunge biases the glute more than forward lunge
- **bodyweight-lunge**: glutes .75: strong glute work in lunges
- **dumbbell-step-up**: glutes .75: high step makes it glute-heavy
- **sumo-squat**: adductors .75 / glutes .75: wide stance (source lists adductors nowhere); abs dropped
- **single-leg-romanian-deadlift**: equipment kettlebell->dumbbell (either works); stabilizers abs/adductors .25
- **farmers-walk**: equipment other->dumbbell; obliques added; force null->static
- **hanging-leg-raise**: AB EXCEPTION: abs; level lowered from expert
- **ab-wheel-rollout**: AB EXCEPTION: abs; lats .5 (anti-extension via lats); bodyweight=true; shoulders->front_delts .25
- **russian-twist**: AB EXCEPTION: obliques; source maps to abdominals only
- **pallof-press**: AB EXCEPTION: obliques (anti-rotation); force pull->static; chest/triceps dropped
- **dumbbell-floor-press**: source lists triceps primary; floor press truncates ROM so chest still leads; triceps .75
- **decline-dumbbell-bench-press**: front_delts .25: decline reduces anterior delt involvement
- **dumbbell-bent-over-row**: lower_back .5: isometric hinge hold
- **reverse-grip-barbell-row**: lats primary and biceps .75: supinated grip shifts load to lats/biceps
- **dumbbell-pullover**: lats primary / chest .75: bi-articular lat+pec movement; force push->pull
- **barbell-shrug**: ISOLATION EXCEPTION: upper_back (trap staple); weights simplified
- **barbell-lunge**: glutes .75: strong glute work in lunges
- **seated-dumbbell-press**: side_delts .75: dumbbells allow wider path
- **barbell-hack-squat**: forearms .25: holding the bar behind the legs

## Isolation exceptions

Kept because no compound lift in the set covers the muscle well, or it is a very common staple.

- **dumbbell-lateral-raise** (side_delts): side_delts. front_delts/upper_back .25: minor assist
- **dumbbell-reverse-fly** (rear_delts): rear_delts
- **standing-calf-raise** (calves): calves
- **seated-calf-raise** (calves): calves (soleus bias)
- **plank** (abs): abs
- **side-plank** (obliques): obliques (source maps to abdominals only)
- **hanging-leg-raise** (abs): abs; level lowered from expert
- **cable-crunch** (abs): abs
- **pallof-press** (obliques): obliques (anti-rotation); force pull->static; chest/triceps dropped
- **crunch** (abs): abs
- **barbell-shrug** (upper_back): upper_back (trap staple); weights simplified
- Ab exercises (plank, side-plank, hanging-leg-raise, cable-crunch, crunch, pallof-press) count as isolation in the source or here; abs/obliques need at least two options. Compound-classed ab work: ab-wheel-rollout, russian-twist, cable-wood-chop, dead-bug.
- Muscles with only compound coverage and no exception: chest, triceps, biceps, lats, forearms, quads, hamstrings, glutes, adductors, lower_back. Notably no curls, triceps extensions/pushdowns, leg extensions/curls or flyes are included.

## Changes from the source

- **barbell-bench-press** (Barbell_Bench_Press_-_Medium_Grip): renamed from "Barbell Bench Press - Medium Grip"
- **incline-barbell-bench-press** (Barbell_Incline_Bench_Press_-_Medium_Grip): renamed from "Barbell Incline Bench Press - Medium Grip"
- **close-grip-bench-press** (Close-Grip_Barbell_Bench_Press): renamed from "Close-Grip Barbell Bench Press"
- **push-up** (Pushups): renamed from "Pushups"
- **dip** (Dips_-_Triceps_Version): renamed from "Dips - Triceps Version"; level beginner->intermediate
- **machine-chest-press** (Machine_Bench_Press): renamed from "Machine Bench Press"
- **overhead-press** (Standing_Military_Press): renamed from "Standing Military Press"
- **dumbbell-shoulder-press** (Dumbbell_Shoulder_Press): level intermediate->beginner
- **machine-shoulder-press** (Machine_Shoulder_Military_Press): renamed from "Machine Shoulder (Military) Press"
- **push-press** (Push_Press): level expert->intermediate
- **upright-row** (Upright_Barbell_Row): renamed from "Upright Barbell Row"
- **dumbbell-lateral-raise** (Side_Lateral_Raise): renamed from "Side Lateral Raise"
- **dumbbell-reverse-fly** (Reverse_Flyes): renamed from "Reverse Flyes"
- **pull-up** (Pullups): renamed from "Pullups"
- **lat-pulldown** (Wide-Grip_Lat_Pulldown): renamed from "Wide-Grip Lat Pulldown"
- **close-grip-lat-pulldown** (Close-Grip_Front_Lat_Pulldown): renamed from "Close-Grip Front Lat Pulldown"
- **barbell-row** (Bent_Over_Barbell_Row): renamed from "Bent Over Barbell Row"
- **seated-cable-row** (Seated_Cable_Rows): renamed from "Seated Cable Rows"
- **t-bar-row** (T-Bar_Row_with_Handle): renamed from "T-Bar Row with Handle"
- **machine-row** (Leverage_Iso_Row): renamed from "Leverage Iso Row"
- **deadlift** (Barbell_Deadlift): renamed from "Barbell Deadlift"
- **good-morning** (Good_Morning): force push->pull
- **back-extension** (Hyperextensions_Back_Extensions): renamed from "Hyperextensions (Back Extensions)"; mechanic isolation->compound
- **glute-bridge** (Butt_Lift_Bridge): renamed from "Butt Lift (Bridge)"; mechanic isolation->compound
- **cable-pull-through** (Pull_Through): renamed from "Pull Through"
- **kettlebell-swing** (One-Arm_Kettlebell_Swings): renamed from "One-Arm Kettlebell Swings"
- **barbell-back-squat** (Barbell_Full_Squat): renamed from "Barbell Full Squat"; force push->legs
- **front-squat** (Front_Barbell_Squat): renamed from "Front Barbell Squat"; level expert->intermediate; force push->legs
- **goblet-squat** (Goblet_Squat): force push->legs
- **bodyweight-squat** (Bodyweight_Squat): force push->legs
- **leg-press** (Leg_Press): force push->legs
- **hack-squat** (Hack_Squat): force push->legs
- **dumbbell-split-squat** (Split_Squat_with_Dumbbells): renamed from "Split Squat with Dumbbells"; force push->legs
- **dumbbell-lunge** (Dumbbell_Lunges): renamed from "Dumbbell Lunges"; force push->legs
- **dumbbell-reverse-lunge** (Dumbbell_Rear_Lunge): renamed from "Dumbbell Rear Lunge"; force push->legs
- **bodyweight-lunge** (Bodyweight_Walking_Lunge): renamed from "Bodyweight Walking Lunge"; force push->legs
- **dumbbell-step-up** (Dumbbell_Step_Ups): renamed from "Dumbbell Step Ups"; force push->legs
- **sumo-squat** (Plie_Dumbbell_Squat): renamed from "Plie Dumbbell Squat"; force push->legs
- **single-leg-romanian-deadlift** (Kettlebell_One-Legged_Deadlift): renamed from "Kettlebell One-Legged Deadlift"
- **standing-calf-raise** (Standing_Calf_Raises): renamed from "Standing Calf Raises"; force push->legs
- **seated-calf-raise** (Seated_Calf_Raise): force push->legs
- **farmers-walk** (Farmers_Walk): force null->static
- **side-plank** (Side_Bridge): renamed from "Side Bridge"; mechanic null->isolation
- **hanging-leg-raise** (Hanging_Leg_Raise): level expert->intermediate
- **ab-wheel-rollout** (Ab_Roller): renamed from "Ab Roller"
- **cable-wood-chop** (Standing_Cable_Wood_Chop): renamed from "Standing Cable Wood Chop"
- **pallof-press** (Pallof_Press): force pull->static
- **dead-bug** (Dead_Bug): force pull->static
- **crunch** (Crunches): renamed from "Crunches"
- **dumbbell-bent-over-row** (Bent_Over_Two-Dumbbell_Row): renamed from "Bent Over Two-Dumbbell Row"
- **reverse-grip-barbell-row** (Reverse_Grip_Bent-Over_Rows): renamed from "Reverse Grip Bent-Over Rows"
- **dumbbell-pullover** (Straight-Arm_Dumbbell_Pullover): renamed from "Straight-Arm Dumbbell Pullover"
- **barbell-lunge** (Barbell_Lunge): force push->legs
- **smith-machine-squat** (Smith_Machine_Squat): force push->legs
- **barbell-hack-squat** (Barbell_Hack_Squat): force push->legs

## Custom / merged / dropped

- No fully custom exercises (every entry has a free-exercise-db source id).
- **kettlebell-swing** reuses One-Arm_Kettlebell_Swings as the two-handed swing (no two-hand entry in the source).
- Merged: the source has dozens of near-duplicates (grip/stance/band/chain/smith/kettlebell variants, e.g. 6+ push-up variants, 15+ deadlift variants, 25 curls). One canonical entry is kept per movement; variant names are folded into `aliases` where common.
- Dropped entirely: stretches, foam-roll, medicine-ball, exercise-ball, e-z-bar-only and plyometric/jump exercises, olympic lifts other than power clean, strongman and sled work, isolation arm/leg work (curls, extensions, flyes, leg curl/extension, wrist curls), handstand push-ups and one-arm variants (expert, niche).
- Source muscle lists were rewritten wholesale where sloppy; the typical fixes: splitting `shoulders` into front/side/rear delts, setting `obliques` by hand, treating `middle back`+`traps` as upper_back, and demoting unrelated secondaries (e.g. chest/triceps on Pallof press).
