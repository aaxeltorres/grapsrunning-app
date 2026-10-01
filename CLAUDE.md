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

Implemented today: fake auth/sign-in, Home dashboard, Stats, GPS run tracking (background location), Run results with route map, the Plan onboarding (Mike's scripted first-visit chat that builds the runner profile) and the Plan screen (Week / Month views of a 4-week plan).
Not implemented yet (Home cards exist as placeholders): AI Coach chat, Routes. Plans are mock data from `generatePlan`; there is no workout editor, and Active Run doesn't execute workout segments yet.

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
  - Mike's Plan screen one-liners (`planDayMessages`) also live in `planOnboardingScript.ts`.
  - Scripted chats are not connected to the AI chatbot, and every answer is a predefined option (no free text).
- `src/storage`: persistence behind small modules with get / save / clear, backed by AsyncStorage for now. `profileStorage` keeps the runner profile, `planStorage` the training plan. Each is the only file to change when that data moves to a real database.
- `src/tasks`: background tasks
- `src/utils`: formatting, calendar dates (`dates.ts`, local `YYYY-MM-DD`), location, haptics and mock-data helpers
- `dist/` and `.expo/` are generated. Never edit them.

## Conventions
- Follow the code style and commit requirements in @.github/copilot-instructions.md
- Changes to `app.json` (plugins, infoPlist, permissions) require a new development build. Say so when you make one.
- Ask before adding a new dependency.

## Final step (always do this last)

After the change is implemented and `npx tsc --noEmit` passes, do the following in order.

### 1. Decide the version bump (semantic versioning)
The single source of truth is `expo.version` in app.json (HomeScreen reads it). Keep `version` in package.json and package-lock.json in sync with it (`npm version X.Y.Z --no-git-tag-version` updates both).
- PATCH (x.y.Z): bug fixes, small UI tweaks, copy changes, performance fixes, no new user-facing capability.
- MINOR (x.Y.0): a new user-facing feature, screen, flow or meaningful behavior change (e.g. GPS tracking, route map, new screen). Reset PATCH to 0.
- MAJOR (X.0.0): breaking or app-wide changes (full redesign, changed data model). Do NOT bump MAJOR on your own: stop and ask me first.
- NO bump: docs, comments, formatting, refactors with no behavior change, tooling/config-only changes.
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
- Do NOT run `eas update`; I publish previews manually.

### 4. Report
End with: the old and new version (or "no bump" and why), the commits created (`git log --oneline -n <count>`), the push result, and confirmation that `git status` is clean.
If the version changed, remind me that `runtimeVersion` uses the `appVersion` policy, so `eas update` will only reach builds made with the new version.

### 5. Update
When you add, move or remove a folder or module, update the project structure section of this file in the same change.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
