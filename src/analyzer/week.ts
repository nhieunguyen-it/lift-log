import type { WeekStartDay, WeekWindow } from './types';

/** Calendar week (device local time) containing `ts`. DST-safe via local date arithmetic. */
export function weekWindow(ts: number, weekStartsOn: WeekStartDay): WeekWindow {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const back = (d.getDay() - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - back);
  const start = d.getTime();
  d.setDate(d.getDate() + 7);
  return { start, end: d.getTime() };
}

/** The window `deltaWeeks` weeks after (or before, if negative) `w`. */
export function shiftWeek(
  w: WeekWindow,
  deltaWeeks: number,
  weekStartsOn: WeekStartDay,
): WeekWindow {
  const d = new Date(w.start);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return weekWindow(d.getTime(), weekStartsOn);
}
