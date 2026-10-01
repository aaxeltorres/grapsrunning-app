# Graps Running App

iOS beta prototype of the Graps Running mobile app. React Native + Expo (SDK 57) + TypeScript.
Mobile companion to the web project in the `grapsrunning` and `grapsrunning-backend` repos.
All UI text is in English.

## Vision (where the app is going)
A running app in the style of Nike Run Club / Adidas Running / Strava, with a virtual AI coach called **Mike**:
- Motivates the user: push notifications and voice while running.
- Greets the user by name when opening the app ("Hola <name>").
- Follows up when the user misses a training day.
- Generates a personalized training routine, shown in the Plan section.

Implemented today: fake auth/sign-in, Home dashboard, Stats, the run mode selector (opened by Start run on Home: Quick start works; Set a goal and Today's workout show a Coming soon sheet), GPS run tracking (background location), the Active Run shell (fades to dark, stays dark while paused) with a view per run mode (only the basic one is built), Run results with route map, the Plan onboarding (Mike's scripted first-visit chat that builds the runner profile), the Plan screen (Week / Month views of a 4-week plan), the Your profile screen (opened from the gear on the Plan screen: change any onboarding answer, and on leaving, plan sync regenerates only the future planned, non-edited workouts) and the workout editor (opened from Edit on the workout card: a run type carousel and a draggable duration bar; saved workouts are marked `edited`).
Not implemented yet (Home cards exist as placeholders): AI Coach chat, Routes. Plans are mock data from `generatePlan`. The workout editor can't move a workout to another day or add one on a rest day yet, and Active Run doesn't execute workout segments yet.

## Commands
- Install: `npm install`
- Dev server: `npx expo start` (or `npx expo start --tunnel` to test from another network)
- Typecheck (must pass before finishing any change): `npx tsc --noEmit`
- Background location needs a development build; it does not work in Expo Go.

## Project structure
- `src/theme`: design tokens (colors, typography, spacing). Use them; do not hardcode values.
- `src/components`: reusable UI components
- `src/screens`: app screens
- `src/navigation`: navigation and route types
- `src/hooks`: shared hooks, including run tracking and the chat engine (`useChatReveal`)
- `src/coach`: Coach Mike's scripted conversations, pure TypeScript (no React)
  - `planOnboardingScript.ts`: the Plan onboarding script. All of Mike's copy, questions, options and reactions live here.
  - `types.ts`: script step types (message, question, recap).
  - `conversation.ts`: builds the chat transcript from the script plus the saved answers (resume, edits, recap).
  - `runnerProfile.ts`: the `RunnerProfile` model. Stores stable option ids and metric values, never display labels.
  - `plan.ts`: the `Plan` / `Workout` model (dated workouts made of steps and repeat groups; meters, seconds, seconds per km) and pure helpers (`totalDistance`, `totalDuration`, `displayName`...). Plain JSON, so an AI can produce it.
  - `generatePlan.ts`: `generatePlan(profile)` returns a deterministic rule-based mock plan; the AI integration goes here.
  - `workoutEditor.ts`: pure logic of the workout editor (run types, limits, warm-up / main / cool-down layout, the workout built from a draft, the hard-session warning). Built on the generator's rules and paces.
  - Mike's Plan screen one-liners (`planDayMessages`) and his workout editor lines (`editorMessages`) also live in `planOnboardingScript.ts`.
  - Scripted chats are not connected to the AI chatbot, and every answer is a predefined option (no free text).
- `src/run`: pure logic of the run flow (no React)
  - `runModes.ts`: run mode ids and their names / descriptions (placeholders, one place to rename them).
  - `todayWorkout.ts`: `todayRunState(plan, today)`: planned / completed / rest / none, for the mode selector.
  - `types.ts`: `RunViewProps`, what the ActiveRun shell hands to every run view.
  - ActiveRunScreen is the shell (owns `useRunTracking` and the dark theme); `BasicRunView`, `GoalRunView` and `PlanRunView` in `src/components` are the views. Goal and Plan are stubs for now. Mike's selector lines (`runModeMessages`) live in `planOnboardingScript.ts`.
- `src/storage`: persistence behind small modules with get / save / clear, backed by AsyncStorage for now. `profileStorage` keeps the runner profile, `planStorage` the training plan. Each is the only file to change when that data moves to a real database.
- `src/tasks`: background tasks
- `src/utils`: formatting, calendar dates (`dates.ts`, local `YYYY-MM-DD`), location, haptics and mock-data helpers
- `dist/` and `.expo/` are generated. Never edit them.

## Conventions
- Follow the code style and commit requirements in @.github/copilot-instructions.md
- Changes to `app.json` (plugins, infoPlist, permissions) require a new development build. Say so when you make one. The switch of `runtimeVersion` to the `fingerprint` policy also needs a new development build.
- Ask before adding a new dependency.

## Final step (mandatory, every task)

This section applies to EVERY task that changes files in this repo, even when my message does not mention commit, push or version. Not being asked is not a reason to skip it. The only exceptions: I explicitly say "no commit" or "don't push", or the task is only a question or investigation with no file changes.

Run it once the change is implemented and `npx tsc --noEmit` passes. If verification is still incomplete or failing, do not commit: tell me what is missing and ask.

### 0. Check the working tree
Run `git status`. If there are modified files that are not part of this task, do not include them silently: list them and ask me whether to commit them (as separate commits) or leave them out.

### 1. Decide the version bump (semantic versioning, X.Y.Z, each digit goes up to 99)
The single source of truth is `expo.version` in app.json (HomeScreen reads it). Keep `version` in package.json and package-lock.json in sync with it (`npm version X.Y.Z --no-git-tag-version` updates both).
The default is PATCH. Most changes are patches.
- PATCH (x.y.Z): bug fixes, small UI tweaks, copy changes, performance fixes, and improvements or additions inside an existing screen or feature (a new option, a new onboarding question, a new rule, a new component in an existing screen). If Z would pass 99, bump MINOR instead.
- MINOR (x.Y.0): a new user-facing capability as a whole: a new screen, flow or section (e.g. GPS tracking, route map, workout editor). Reset PATCH to 0. Y can go up to 99; do not roll into MAJOR before that.
- MAJOR (X.0.0): breaking or app-wide changes (full redesign, changed data model). Do NOT bump MAJOR on your own: stop and ask me first.
- NO bump: docs, comments, formatting, refactors with no behavior change, tooling/config-only changes.
One bump per task, not per commit. If a task mixes levels, use the highest. When in doubt between PATCH and MINOR, choose PATCH. Never choose MINOR just to "keep the numbers moving".
State which level you chose and why, in one sentence, before touching any version file.

### 2. Commit (clean and easy to understand)
- Review with `git status` and `git diff`. Stage only files related to this change, by name. Never commit secrets, `.env*`, tokens or credentials.
- Use Conventional Commits, written in English: `type(scope): imperative summary` (max 72 chars). Types: feat, fix, refactor, style, docs, chore, perf, test. Example: `fix(active-run): freeze pace while the run is paused`.
- Add a body (wrapped at ~72 chars) that explains WHAT changed and WHY, mentioning the affected screens/components/hooks. Add `BREAKING CHANGE:` when relevant.
- One logical change per commit. If the work has several independent parts, make several commits.
- If the version changed, make a separate final commit: `chore(release): bump version to X.Y.Z` with a body listing which changes justify the bump.

### 3. Push
- Run `git push` on the current branch. Never use `--force`.
- If the push is rejected, run `git fetch` and `git pull --rebase` once and retry. If there are conflicts, stop and tell me instead of resolving them blindly.

### 3b. Publish to Expo (OTA update)
My friends test the app through Expo (branch `preview`), so updates have to be published there.
- Publish automatically after a successful push when the task ended in a MINOR or MAJOR version bump (a big update).
- Publish whenever I ask, whatever the bump size, with phrases like "publish", "publicá el update", "subí a Expo" or "eas update". Never publish on a PATCH or no-bump task unless I ask.
- Before publishing: everything must be committed and pushed (changes only in `graphify-out/` don't count), and `npx tsc --noEmit` must pass.
- Command: `eas update --branch preview --message "<subject of the latest commit>" --non-interactive`. Don't ask me for a message; reuse the latest commit subject.
- Do NOT publish if this task changed anything native (app.json plugins, permissions, infoPlist, or a dependency with native code): an OTA update cannot deliver that. Tell me a new build is needed instead.
- Never run `eas build`.

### 4. Report
End with: the old and new version (or "no bump" and why), the commits created (`git log --oneline -n <count>`), the push result, and confirmation that `git status` is clean.
`runtimeVersion` uses the `fingerprint` policy, so a version bump does not affect updates; `eas update` only reaches builds whose native fingerprint matches. Remind me to make a new build only when native code changes (plugins, permissions, infoPlist, native dependencies).
- If an update was published, include the update group ID or link from the command output.

### 5. Update
When you add, move or remove a folder or module, update the project structure section of this file in the same change.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
