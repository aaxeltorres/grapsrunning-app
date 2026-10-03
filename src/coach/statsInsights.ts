/**
 * Coach Mike's insight at the top of the Stats screen. Pure and
 * deterministic (no React, no I/O): the same runs, plan, profile and
 * moment always give the same message.
 *
 * Priority, highest first; the first insight that applies wins:
 *   1. noRuns          "No runs yet. Ready when you are."
 *   2. Rest advice     volumeSpike (last week well above the recent average)
 *   3. Celebration     milestone, personalBest, streak (plan), comeback
 *                      (only when the latest run is recent)
 *   4. Follow-up       missedDays (plan), longBreak (gentle, no guilt)
 *   5. Neutral         paceImprovement, adherence (plan), timeOfDay, fallback
 *
 * Data rule: what the runner did (distances, run days, streaks, adherence,
 * missed days) comes only from the saved runs. The plan only says what was
 * planned (the dates of its non-rest workouts); a workout's status and
 * result are ignored, so a deleted run never counts as done.
 *
 * Weeks run Monday to Sunday in the device's local time; a run belongs to
 * the local calendar day it started on. Every number in a message comes
 * from the data. Only one message is shown, so insights never stack: a
 * spike outranks the celebration of the same run, and a streak never
 * fires in a week with a missed day.
 */

import type { SavedRun } from '../run/types';
import {
  addDays,
  dayNumber,
  formatLongDate,
  startOfWeek,
  toISODate,
  type ISODate,
} from '../utils/dates';
import { formatPaceSeconds } from '../utils/format';
import type { Plan } from './plan';
import { knownLevel, type RunnerProfile } from './runnerProfile';

export const NO_RUNS_MESSAGE = 'No runs yet. Ready when you are.';

/** Last week must be at least this many km to count as a spike... */
export const SPIKE_MIN_KM = 10;
/** ...or this many for beginners (run/walk levels). */
export const SPIKE_MIN_KM_BEGINNER = 5;
/** ...and this many times the average of the weeks before it. */
export const SPIKE_RATIO = 1.4;
/** How many weeks before last week make the average. */
export const SPIKE_BASELINE_WEEKS = 4;
/** How many of those weeks must have runs. */
export const SPIKE_MIN_HISTORY_WEEKS = 3;
/** A celebration needs the latest run to be this recent (days). */
export const RECENT_DAYS = 3;
/** Earlier runs needed before a personal best means anything. */
export const PB_MIN_PRIOR_RUNS = 3;
/** A run is comparable for pace within this share of its distance. */
export const PB_DISTANCE_TOLERANCE = 0.2;
/** Earlier weeks with runs needed for a "best week". */
export const BEST_WEEK_MIN_PRIOR_WEEKS = 3;
/** Consecutive fully done plan weeks for a streak. */
export const MIN_STREAK_WEEKS = 2;
/** Days without running that make a break. */
export const BREAK_DAYS = 7;
/** Runs in each half of the pace comparison. */
export const PACE_WINDOW_RUNS = 3;
/** How much faster (share) the recent runs must be. */
export const PACE_IMPROVEMENT_MIN = 0.03;
/** Runs needed before talking about the time of day... */
export const TIME_OF_DAY_MIN_RUNS = 5;
/** ...and the share of them in one part of the day. */
export const TIME_OF_DAY_SHARE = 0.7;

const RUN_COUNT_MILESTONES = [100, 50, 25, 10, 5];
const KM_MILESTONES = [1000, 500, 250, 100, 50];
const BEGINNER_LEVELS = ['not_running', 'run_walk'];

export type InsightId =
  | 'noRuns'
  | 'volumeSpike'
  | 'milestone'
  | 'personalBest'
  | 'streak'
  | 'comeback'
  | 'missedDays'
  | 'longBreak'
  | 'paceImprovement'
  | 'adherence'
  | 'timeOfDay'
  | 'fallback';

export type MikeInsight = { id: InsightId; message: string };

export type InsightInput = {
  runs: SavedRun[];
  plan?: Plan | null;
  profile?: RunnerProfile | null;
  now: Date;
  /** The runner's first name, when the app knows it (not stored yet). */
  firstName?: string;
};

type Run = {
  day: ISODate;
  /** Whole days since 1970 of `day`, for gaps. */
  dayNo: number;
  hour: number;
  km: number;
  seconds: number;
  pace: number | null;
};

// ---------------------------------------------------------------------------
// Formatting

const km1 = (km: number) => `${km.toFixed(1)} km`;
const km2 = (km: number) => `${km.toFixed(2)} km`;
const pace = (secPerKm: number) => `${formatPaceSeconds(secPerKm)} /km`;
const weekday = (iso: ISODate) => formatLongDate(iso).split(',')[0];

/** "Nice work, Sam." or "Nice work." */
function withName(text: string, name?: string) {
  return name ? `${text}, ${name}` : text;
}

/** Same template all day, a different one the next day. */
function pick<T>(templates: T[], today: ISODate, salt: number): T {
  const index = (((dayNumber(today) + salt) % templates.length) + templates.length) % templates.length;
  return templates[index];
}

// ---------------------------------------------------------------------------
// Data helpers

function toRun(saved: SavedRun): Run | null {
  const start = new Date(saved.startedAt);
  if (Number.isNaN(start.getTime())) return null;
  const day = toISODate(start);
  const km = saved.distanceMeters / 1000;
  const paceValue =
    saved.avgPaceSecPerKm !== null &&
    Number.isFinite(saved.avgPaceSecPerKm) &&
    formatPaceSeconds(saved.avgPaceSecPerKm) !== '--:--'
      ? saved.avgPaceSecPerKm
      : null;
  return {
    day,
    dayNo: dayNumber(day),
    hour: start.getHours(),
    km: Number.isFinite(km) ? km : 0,
    seconds: saved.movingDurationSec,
    pace: paceValue,
  };
}

function weekKm(runs: Run[], monday: ISODate) {
  const end = addDays(monday, 7);
  return runs.filter((r) => r.day >= monday && r.day < end).reduce((sum, r) => sum + r.km, 0);
}

function runDays(runs: Run[], from: ISODate, to: ISODate) {
  return new Set(runs.filter((r) => r.day >= from && r.day < to).map((r) => r.day));
}

/** Dates of the planned non-rest workouts between `from` (inclusive) and `to` (exclusive). */
function plannedDays(plan: Plan, from: ISODate, to: ISODate): ISODate[] {
  return plan.workouts
    .filter((w) => w.type !== 'rest' && w.date >= from && w.date < to)
    .map((w) => w.date);
}

// ---------------------------------------------------------------------------
// The insights, each `null` when it doesn't apply

type Ctx = {
  runs: Run[]; // oldest first
  latest: Run;
  today: ISODate;
  todayNo: number;
  thisMonday: ISODate;
  plan: Plan | null;
  beginner: boolean;
  name?: string;
};

function volumeSpike(c: Ctx): MikeInsight | null {
  const lastMonday = addDays(c.thisMonday, -7);
  const last = weekKm(c.runs, lastMonday);
  const baseline = Array.from({ length: SPIKE_BASELINE_WEEKS }, (_, i) =>
    weekKm(c.runs, addDays(lastMonday, -7 * (i + 1))),
  );
  const weeksWithRuns = baseline.filter((km) => km > 0).length;
  if (weeksWithRuns < SPIKE_MIN_HISTORY_WEEKS) return null;
  const average = baseline.reduce((a, b) => a + b, 0) / SPIKE_BASELINE_WEEKS;
  const minKm = c.beginner ? SPIKE_MIN_KM_BEGINNER : SPIKE_MIN_KM;
  if (last < minKm || last < average * SPIKE_RATIO) return null;
  const message = pick(
    [
      `${withName('Big week', c.name)}: ${km1(last)}, well above your usual ${km1(average)}. Consider taking it easy for a few days.`,
      `Last week you ran ${km1(last)}, a lot more than your recent ${km1(average)} a week. An easy day or a rest day would fit well now.`,
      `${km1(last)} last week against about ${km1(average)} before. Strong work, and a good moment to take it easy.`,
    ],
    c.today,
    1,
  );
  return { id: 'volumeSpike', message };
}

function milestone(c: Ctx): MikeInsight | null {
  const count = c.runs.length;
  if (count === 1) {
    return {
      id: 'milestone',
      message: pick(
        [
          `${withName('Your first run is saved', c.name)}! ${km2(c.latest.km)} to start. This is where it begins.`,
          `First run in the books: ${km2(c.latest.km)}. ${withName('Great start', c.name)}.`,
          `${km2(c.latest.km)} for your very first saved run. ${withName('Welcome aboard', c.name)}!`,
        ],
        c.today,
        2,
      ),
    };
  }
  const runMilestone = RUN_COUNT_MILESTONES.find((m) => m === count);
  if (runMilestone) {
    return {
      id: 'milestone',
      message: pick(
        [
          `That was run number ${runMilestone}. ${withName('Lovely consistency', c.name)}!`,
          `${runMilestone} runs saved. ${withName('Keep it rolling', c.name)}.`,
          `Run ${runMilestone} done. Every one of them counts.`,
        ],
        c.today,
        3,
      ),
    };
  }
  const total = c.runs.reduce((sum, r) => sum + r.km, 0);
  const before = total - c.latest.km;
  const kmMilestone = KM_MILESTONES.find((m) => before < m && total >= m);
  if (kmMilestone) {
    return {
      id: 'milestone',
      message: pick(
        [
          `You just passed ${kmMilestone} km in total. ${withName('Well done', c.name)}!`,
          `${kmMilestone} km and counting: you're at ${km1(total)} now.`,
          `That run took you past ${kmMilestone} km. ${withName('Nice milestone', c.name)}.`,
        ],
        c.today,
        4,
      ),
    };
  }
  return null;
}

function personalBest(c: Ctx): MikeInsight | null {
  const prior = c.runs.slice(0, -1);
  if (prior.length < PB_MIN_PRIOR_RUNS) return null;
  const latest = c.latest;

  if (latest.km > Math.max(...prior.map((r) => r.km))) {
    return {
      id: 'personalBest',
      message: pick(
        [
          `${km2(latest.km)}: your longest run yet. ${withName('Great work', c.name)}!`,
          `New distance record: ${km2(latest.km)}. ${withName('Well done', c.name)}.`,
          `That's the farthest you've run here: ${km2(latest.km)}.`,
        ],
        c.today,
        5,
      ),
    };
  }

  if (latest.pace !== null && latest.km > 0) {
    const comparable = prior.filter(
      (r) => r.pace !== null && Math.abs(r.km - latest.km) <= latest.km * PB_DISTANCE_TOLERANCE,
    );
    if (comparable.length >= PB_MIN_PRIOR_RUNS && latest.pace < Math.min(...comparable.map((r) => r.pace!))) {
      return {
        id: 'personalBest',
        message: pick(
          [
            `${pace(latest.pace)} over ${km1(latest.km)}: your fastest at that distance. ${withName('Nice', c.name)}!`,
            `Fastest pace yet for a run around ${km1(latest.km)}: ${pace(latest.pace)}.`,
            `${withName('New best', c.name)}: ${pace(latest.pace)} for ${km1(latest.km)}.`,
          ],
          c.today,
          6,
        ),
      };
    }
  }

  // Best week: this week's distance beats every earlier week with runs.
  const thisWeek = weekKm(c.runs, c.thisMonday);
  const earlierWeeks = new Map<ISODate, number>();
  for (const r of c.runs) {
    const monday = startOfWeek(r.day);
    if (monday < c.thisMonday) earlierWeeks.set(monday, (earlierWeeks.get(monday) ?? 0) + r.km);
  }
  if (
    earlierWeeks.size >= BEST_WEEK_MIN_PRIOR_WEEKS &&
    thisWeek > Math.max(...earlierWeeks.values())
  ) {
    return {
      id: 'personalBest',
      message: pick(
        [
          `${km1(thisWeek)} this week: your biggest week so far. ${withName('Great job', c.name)}!`,
          `This is your best week yet with ${km1(thisWeek)}.`,
          `${withName('Most distance in a week', c.name)}: ${km1(thisWeek)} and counting.`,
        ],
        c.today,
        7,
      ),
    };
  }
  return null;
}

/** Planned days this week before today that have no run, after matching run days to them by count. */
function missedThisWeek(c: Ctx): ISODate[] {
  if (!c.plan) return [];
  const planned = plannedDays(c.plan, c.thisMonday, c.today);
  const ran = runDays(c.runs, c.thisMonday, c.today);
  const unmatched = planned.filter((day) => !ran.has(day));
  const missing = planned.length - Math.min(ran.size, planned.length);
  // Runs on other days cover planned ones: only what is still missing counts.
  return missing > 0 ? unmatched.slice(-missing) : [];
}

function streak(c: Ctx): MikeInsight | null {
  if (!c.plan || missedThisWeek(c).length > 0) return null;
  let weeks = 0;
  let monday = addDays(c.thisMonday, -7);
  while (monday >= startOfWeek(c.plan.startDate)) {
    const end = addDays(monday, 7);
    const planned = plannedDays(c.plan, monday, end).length;
    if (planned === 0 || runDays(c.runs, monday, end).size < planned) break;
    weeks += 1;
    monday = addDays(monday, -7);
  }
  if (weeks < MIN_STREAK_WEEKS) return null;
  return {
    id: 'streak',
    message: pick(
      [
        `${weeks} weeks in a row with every planned run done. ${withName('Impressive', c.name)}!`,
        `That's ${weeks} straight weeks on plan. ${withName('Keep it going', c.name)}.`,
        `${withName('Streak', c.name)}: ${weeks} full weeks of your plan, back to back.`,
      ],
      c.today,
      8,
    ),
  };
}

function comeback(c: Ctx): MikeInsight | null {
  if (c.runs.length < 2) return null;
  const previous = c.runs[c.runs.length - 2];
  const gap = c.latest.dayNo - previous.dayNo;
  if (gap < BREAK_DAYS) return null;
  return {
    id: 'comeback',
    message: pick(
      [
        `${withName('Welcome back', c.name)}! Your first run in ${gap} days is done.`,
        `Back at it after ${gap} days. ${withName('Good to see you', c.name)}.`,
        `${gap} days off and you're back with ${km2(c.latest.km)}. Nice return.`,
      ],
      c.today,
      9,
    ),
  };
}

function missedDays(c: Ctx): MikeInsight | null {
  const missed = missedThisWeek(c);
  if (missed.length === 0) return null;
  if (missed.length === 1) {
    const day = weekday(missed[0]);
    return {
      id: 'missedDays',
      message: pick(
        [
          `${day}'s run slipped by. ${withName('No stress', c.name)}: pick it up when you can.`,
          `Missed ${day}? That happens. Your next run is what counts.`,
          `${day} didn't happen, and that's okay. Ready when you are.`,
        ],
        c.today,
        10,
      ),
    };
  }
  return {
    id: 'missedDays',
    message: pick(
      [
        `${missed.length} planned runs slipped by this week. No guilt: one easy run gets you going again.`,
        `This week got busy: ${missed.length} planned runs missed. Pick the next one when it suits you.`,
        `${missed.length} runs didn't happen this week, and that's fine. Let's take the next one.`,
      ],
      c.today,
      11,
    ),
  };
}

function longBreak(c: Ctx): MikeInsight | null {
  const days = c.todayNo - c.latest.dayNo;
  if (days < BREAK_DAYS) return null;
  return {
    id: 'longBreak',
    message: pick(
      [
        `It's been ${days} days since your last run. An easy one is a nice way back, whenever you're ready.`,
        `${days} days since you last ran. ${withName('No rush', c.name)}: a short, easy run is a great restart.`,
        `${withName('Hey', c.name)}, ${days} days off. Whenever it suits you, I'm ready for the next one.`,
      ],
      c.today,
      12,
    ),
  };
}

function paceImprovement(c: Ctx): MikeInsight | null {
  const paced = c.runs.filter((r) => r.pace !== null);
  if (paced.length < PACE_WINDOW_RUNS * 2) return null;
  const avg = (rs: Run[]) => rs.reduce((sum, r) => sum + r.pace!, 0) / rs.length;
  const recent = avg(paced.slice(-PACE_WINDOW_RUNS));
  const before = avg(paced.slice(-PACE_WINDOW_RUNS * 2, -PACE_WINDOW_RUNS));
  if (recent > before * (1 - PACE_IMPROVEMENT_MIN)) return null;
  const faster = Math.round(before - recent);
  return {
    id: 'paceImprovement',
    message: pick(
      [
        `Your last ${PACE_WINDOW_RUNS} runs averaged ${pace(recent)}, ${faster} s/km faster than the ${PACE_WINDOW_RUNS} before. ${withName('Nice progress', c.name)}!`,
        `Getting quicker: ${pace(recent)} on average lately, down from ${pace(before)}.`,
        `${faster} s/km faster over your last ${PACE_WINDOW_RUNS} runs. The work is paying off.`,
      ],
      c.today,
      13,
    ),
  };
}

function adherence(c: Ctx): MikeInsight | null {
  if (!c.plan) return null;
  const end = addDays(c.thisMonday, 7);
  const planned = plannedDays(c.plan, c.thisMonday, end).length;
  if (planned === 0) return null;
  const done = Math.min(runDays(c.runs, c.thisMonday, end).size, planned);
  if (done === 0) return null;
  const left = planned - done;
  return {
    id: 'adherence',
    message: pick(
      left === 0
        ? [
            `All ${planned} planned runs done this week. ${withName('Lovely work', c.name)}!`,
            `${done} of ${planned} this week: plan complete.`,
            `Every planned run of the week is done (${planned} of ${planned}).`,
          ]
        : [
            `${done} of ${planned} planned runs done this week. ${withName('Nice going', c.name)}.`,
            `This week: ${done} of ${planned} done, ${left} to go.`,
            `${done} down, ${left} to go this week.`,
          ],
      c.today,
      14,
    ),
  };
}

function timeOfDay(c: Ctx): MikeInsight | null {
  if (c.runs.length < TIME_OF_DAY_MIN_RUNS) return null;
  const parts = [
    { name: 'morning', test: (h: number) => h >= 5 && h < 12 },
    { name: 'afternoon', test: (h: number) => h >= 12 && h < 18 },
    { name: 'evening', test: (h: number) => h >= 18 || h < 5 },
  ];
  for (const part of parts) {
    const count = c.runs.filter((r) => part.test(r.hour)).length;
    if (count / c.runs.length >= TIME_OF_DAY_SHARE) {
      return {
        id: 'timeOfDay',
        message: pick(
          [
            `${count} of your ${c.runs.length} runs were in the ${part.name}. You've found your rhythm.`,
            `You're a ${part.name} runner: ${count} of ${c.runs.length} runs. That routine helps.`,
            `Mostly ${part.name} runs for you (${count} of ${c.runs.length}). Consistency looks good on you.`,
          ],
          c.today,
          15,
        ),
      };
    }
  }
  return null;
}

function fallback(c: Ctx): MikeInsight {
  const month = c.today.slice(0, 7);
  const thisMonth = c.runs.filter((r) => r.day.slice(0, 7) === month);
  const runs = thisMonth.length > 0 ? thisMonth : c.runs;
  const total = runs.reduce((sum, r) => sum + r.km, 0);
  const scope = thisMonth.length > 0 ? 'this month' : 'so far';
  const count = `${runs.length} ${runs.length === 1 ? 'run' : 'runs'}`;
  return {
    id: 'fallback',
    message: pick(
      [
        `${count} and ${km1(total)} ${scope}. ${withName('Keep it up', c.name)}!`,
        `${km1(total)} over ${count} ${scope}. Every run adds up.`,
        `${scope === 'this month' ? 'This month' : 'So far'}: ${count}, ${km1(total)}. Nice and steady.`,
      ],
      c.today,
      16,
    ),
  };
}

// ---------------------------------------------------------------------------

export function getMikeInsight({ runs, plan, profile, now, firstName }: InsightInput): MikeInsight | null {
  const parsed = runs
    .map(toRun)
    .filter((r): r is Run => r !== null)
    .sort((a, b) => a.dayNo - b.dayNo || a.hour - b.hour);
  if (parsed.length === 0) return { id: 'noRuns', message: NO_RUNS_MESSAGE };

  const today = toISODate(now);
  const name = firstName?.trim() || undefined;
  const ctx: Ctx = {
    runs: parsed,
    latest: parsed[parsed.length - 1],
    today,
    todayNo: dayNumber(today),
    thisMonday: startOfWeek(today),
    plan: plan ?? null,
    beginner: BEGINNER_LEVELS.includes(knownLevel(profile?.level) ?? ''),
    name,
  };
  const recent = ctx.todayNo - ctx.latest.dayNo <= RECENT_DAYS;

  return (
    volumeSpike(ctx) ??
    (recent ? milestone(ctx) ?? personalBest(ctx) ?? streak(ctx) ?? comeback(ctx) : null) ??
    missedDays(ctx) ??
    longBreak(ctx) ??
    paceImprovement(ctx) ??
    adherence(ctx) ??
    timeOfDay(ctx) ??
    fallback(ctx)
  );
}
