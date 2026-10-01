# Graph Report - GrapsRunning  (2026-09-30)

## Corpus Check
- Corpus is ~25,293 words - fits in a single context window. You may not need a graph.

## Summary
- 532 nodes · 1411 edges · 14 communities (13 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.84)
- Token cost: 45,595 input · 0 output

## Community Hubs (Navigation)
- Shared UI Components
- Chat Transcript Builder
- Plan Generation & Storage
- Plan Model Helpers
- App Entry & Tooling
- Plan Calendar Views
- GPS Run Tracking
- Project Docs & Conventions
- Expo App Config
- Runtime Dependencies
- Coach Chat UI & Script
- TypeScript Config
- Assets & Routes Notes

## God Nodes (most connected - your core abstractions)
1. `react` - 40 edges
2. `react-native` - 38 edges
3. `colors` - 31 edges
4. `spacing` - 27 edges
5. `typography` - 27 edges
6. `IconPlaceholder()` - 21 edges
7. `radius` - 20 edges
8. `OnboardingChat()` - 16 edges
9. `PlanOverview()` - 16 edges
10. `expo` - 14 edges

## Surprising Connections (you probably didn't know these)
- `IconPlaceholder()` --conceptually_related_to--> `Reuse src/components UI`  [INFERRED]
  src/components/IconPlaceholder.tsx → .github/copilot-instructions.md
- `Assets README` --references--> `IconPlaceholder()`  [EXTRACTED]
  src/assets/README.md → src/components/IconPlaceholder.tsx
- `Suggested Asset Naming (logo, icon-*.png)` --conceptually_related_to--> `Routes (not implemented)`  [AMBIGUOUS]
  src/assets/README.md → CLAUDE.md
- `Agent Instructions (AGENTS.md)` --references--> `Graps Running App Conventions (copilot-instructions.md)`  [EXTRACTED]
  AGENTS.md → .github/copilot-instructions.md
- `App()` --calls--> `RootNavigator()`  [EXTRACTED]
  App.tsx → src/navigation/RootNavigator.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Plan pipeline: onboarding -> RunnerProfile -> generatePlan -> Plan -> Plan screen** — claude_plan_onboarding, claude_runner_profile_model, claude_generate_plan, claude_plan_model, claude_plan_screen, claude_storage_modules [EXTRACTED 1.00]
- **Scripted coach chat engine** — claude_plan_onboarding_script, claude_conversation_builder, claude_use_chat_reveal, claude_coach_mike [INFERRED 0.85]
- **Release process: commits, semver, runtimeVersion** — claude_release_workflow, claude_semantic_versioning_policy, _github_copilot_instructions_conventional_commits, claude_runtime_version_appversion [EXTRACTED 1.00]

## Communities (14 total, 1 thin omitted)

### Community 0 - "Shared UI Components"
Cohesion: 0.06
Nodes (89): react, react-native, @react-native-picker/picker, @react-navigation/native-stack, Props, styles, Props, styles (+81 more)

### Community 1 - "Chat Transcript Builder"
Cohesion: 0.06
Nodes (66): buildTranscript(), formatAnswer(), getAnswer(), isAsked(), isQuestionStep(), isSameAnswer(), normalizeSelection(), pickVariant() (+58 more)

### Community 2 - "Plan Generation & Storage"
Cohesion: 0.06
Nodes (45): @react-native-async-storage/async-storage, buildMockPlan(), buildSegments(), DAY_ORDER, DEFAULT_DAYS, distance(), duration(), EASY_KM (+37 more)

### Community 3 - "Plan Model Helpers"
Cohesion: 0.10
Nodes (47): displayName(), flattenSteps(), formatDistanceShort(), formatDurationShort(), formatTarget(), isRepeatGroup(), isRunWalk(), keyPace() (+39 more)

### Community 4 - "App Entry & Tooling"
Cohesion: 0.04
Nodes (38): App(), devDependencies, @babel/core, @expo/ngrok, @types/react, typescript, main, name (+30 more)

### Community 5 - "Plan Calendar Views"
Cohesion: 0.13
Nodes (32): dayAccessibilityLabel(), DayCircle(), DayCircleProps, LEGEND, MonthProps, NavButton(), PlanMonthCalendar(), PlanWeekStrip() (+24 more)

### Community 6 - "GPS Run Tracking"
Cohesion: 0.13
Nodes (27): expo-constants, expo-location, createPauseMarker(), PermissionState, RunState, useRunTracking(), UseRunTrackingResult, ACTIVE_RUN_DATA_KEY (+19 more)

### Community 7 - "Project Docs & Conventions"
Cohesion: 0.09
Nodes (18): Graps Running App Conventions (copilot-instructions.md), Agent Instructions (AGENTS.md), Graps Running App (CLAUDE.md), AI Coach Chat (not implemented), Coach Mike (virtual AI coach), conversation.ts transcript builder, generatePlan(profile) mock generator, GPS Run Tracking (background location) (+10 more)

### Community 8 - "Expo App Config"
Cohesion: 0.08
Nodes (25): permissions, projectId, expo, android, assetBundlePatterns, extra, ios, name (+17 more)

### Community 9 - "Runtime Dependencies"
Cohesion: 0.09
Nodes (23): dependencies, babel-preset-expo, expo, expo-constants, expo-haptics, expo-keep-awake, expo-location, @expo/metro-runtime (+15 more)

### Community 10 - "Coach Chat UI & Script"
Cohesion: 0.13
Nodes (19): expo-haptics, PlanDayMessageKey, planDayMessages, planOnboardingScript, AnswerBubble(), bubbleCorners(), ChatBubble(), ChatGroup() (+11 more)

### Community 11 - "TypeScript Config"
Cohesion: 0.22
Nodes (8): expo/tsconfig.base, compilerOptions, baseUrl, ignoreDeprecations, paths, strict, extends, include

### Community 12 - "Assets & Routes Notes"
Cohesion: 0.67
Nodes (3): Routes (not implemented), Assets README, Suggested Asset Naming (logo, icon-*.png)

## Ambiguous Edges - Review These
- `Routes (not implemented)` → `Suggested Asset Naming (logo, icon-*.png)`  [AMBIGUOUS]
  src/assets/README.md · relation: conceptually_related_to

## Knowledge Gaps
- **202 isolated node(s):** `name`, `slug`, `version`, `orientation`, `userInterfaceStyle` (+197 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 221 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Routes (not implemented)` and `Suggested Asset Naming (logo, icon-*.png)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `react` connect `Shared UI Components` to `Chat Transcript Builder`, `Plan Generation & Storage`, `Plan Model Helpers`, `App Entry & Tooling`, `Plan Calendar Views`, `GPS Run Tracking`, `Coach Chat UI & Script`?**
  _High betweenness centrality (0.175) - this node is a cross-community bridge._
- **Why does `react-native` connect `Shared UI Components` to `Chat Transcript Builder`, `Plan Model Helpers`, `App Entry & Tooling`, `Plan Calendar Views`, `GPS Run Tracking`, `Coach Chat UI & Script`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Why does `IconPlaceholder()` connect `Shared UI Components` to `Plan Model Helpers`, `Assets & Routes Notes`, `App Entry & Tooling`, `Project Docs & Conventions`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **What connects `name`, `slug`, `version` to the rest of the system?**
  _202 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Shared UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.05641025641025641 - nodes in this community are weakly interconnected._
- **Should `Chat Transcript Builder` be split into smaller, more focused modules?**
  _Cohesion score 0.05712050078247261 - nodes in this community are weakly interconnected._