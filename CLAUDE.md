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

Features today and what is missing: see `docs/features.md`.

## Commands
- Install: `npm install`
- Dev server: `npx expo start` (or `npx expo start --tunnel` to test from another network)
- Typecheck (must pass before finishing any change): `npx tsc --noEmit`
- Background location needs a development build; it does not work in Expo Go.

## Project structure (index)
Detail lives in `docs/`; read the matching file before working on an area.
- `src/theme`, `src/components`, `src/screens`, `src/navigation`, `src/hooks`, `src/storage`, `src/tasks`, `src/utils`: `docs/app.md`
- `src/coach` (Mike's scripts, runner profile, plan model, plan generator, sessions, zones, workout editor logic): `docs/coach.md`
- `src/run` (run modes, goals, intervals, workout engine, results logic) and the run-flow components (ActiveRunScreen, run views, setup screens, sheets): `docs/run.md`
- What is implemented and what is not: `docs/features.md`
- `dist/` and `.expo/` are generated. Never edit them.
- Current status, pending work and decisions: `ESTADO.md`

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
- Before publishing: everything must be committed and pushed, and `npx tsc --noEmit` must pass.
- Command: `eas update --branch preview --message "<subject of the latest commit>" --non-interactive`. Don't ask me for a message; reuse the latest commit subject.
- Do NOT publish if this task changed anything native (app.json plugins, permissions, infoPlist, or a dependency with native code): an OTA update cannot deliver that. Tell me a new build is needed instead.
- Never run `eas build`.

### 4. Report
End with: the old and new version (or "no bump" and why), the commits created (`git log --oneline -n <count>`), the push result, and confirmation that `git status` is clean.
`runtimeVersion` uses the `fingerprint` policy, so a version bump does not affect updates; `eas update` only reaches builds whose native fingerprint matches. Remind me to make a new build only when native code changes (plugins, permissions, infoPlist, native dependencies).
- If an update was published, include the update group ID or link from the command output.

### 5. Update the docs
When you change a module's behavior, or add, move or remove files, update the matching docs file and the index in CLAUDE.md in the same change.

### 6. Update ESTADO.md
Update ESTADO.md (version, done, pending, decisions) in the same commit as the task. Keep it under 60 lines. When an Expo update is published, update the last published version.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.
`graphify-out/` is generated, local and gitignored: `graphify update .` still runs after code changes, but its output is never committed.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Docs
Before working on an area, read the matching docs file (plain paths, not imported, so they load on demand):
- `docs/features.md`: implemented / not implemented yet
- `docs/coach.md`: `src/coach`
- `docs/run.md`: `src/run` and the run-flow components
- `docs/app.md`: theme, components, screens, navigation, hooks, storage, tasks, utils
- `ESTADO.md`: status, pending, decisions
