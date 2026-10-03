# App modules: theme, components, screens, navigation, hooks, storage, tasks, utils

Moved verbatim from CLAUDE.md. See also docs/coach.md and docs/run.md.

- `src/theme`: design tokens (colors, typography, spacing). Use them; do not hardcode values.
- `src/components`: reusable UI components
- `src/screens`: app screens
- `src/navigation`: navigation and route types
- `src/hooks`: shared hooks, including run tracking and the chat engine (`useChatReveal`, which hands out stable `displayItems`; `OnboardingChat` memoizes each message group and follows the conversation with one post-layout scroll per new entry, never while the user is dragging or has scrolled up)
- `src/storage`: persistence behind small modules with get / save / clear, backed by AsyncStorage for now. `profileStorage` keeps the runner profile, `planStorage` the training plan (`update(change)` is a read-modify-write used to record a finished run), `intervalStorage` the last Intervals setup (normalized to the current limits when read), `runHistoryStorage` the run history (`loadRuns` newest first, `saveRun` upserting by id, `getRun`, `deleteRun`; a missing or corrupt store reads as an empty list; writes are queued; only runs that pass `isRunSaveable` are stored; nothing reads it yet, Stats still uses mock data). Each is the only file to change when that data moves to a real database. `planSync.ts` (`loadCurrentPlan`) reads the plan and profile, runs `extendPlan` and saves the result: `usePlanOnboarding` calls it on load and on every Plan focus, and `RunModeScreen` for Today's workout.
- `src/tasks`: background tasks
- `src/utils`: formatting, calendar dates (`dates.ts`, local `YYYY-MM-DD`), location, haptics, the wheel picker's row math (`wheel.ts`: a row is `round(offset / ROW_HEIGHT)`, `nearestRow`, the slow-release rule; pure, used by `WheelPicker`) and mock-data helpers. `mockRun.ts` holds mock finished runs (long, goal, short, no route, plan, partial plan) to preview Run results without running; nothing imports it (a short mock run shows the "Run too short to be saved" notice if you feed it to Run results).
