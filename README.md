# Graps Running App

An iOS beta prototype of the Graps Running mobile app, built with React Native,
Expo, and TypeScript. It is the mobile companion to the Graps Running web
project in the `grapsrunning` and `grapsrunning-backend` repositories.

## Features

- Fake authentication and sign-in flow
- Home dashboard and activity statistics
- Run mode selector: quick start, goal runs, intervals and today's workout
- GPS run tracking with background location support
- Run results with route map, per-kilometer splits, goals and planned vs actual
- Coach Mike: scripted onboarding chat that builds the runner profile
- Training plan (weekly or monthly) with structured sessions and zones
- Workout editor and a Your profile screen that can rebuild the plan

Not implemented yet: AI Coach chat, Routes, heart rate zones. Plans are mock
data. See `docs/features.md` for details and `ESTADO.md` for the current status.

## Run the app

```bash
npm install
npx expo start
npx expo start --tunnel
npx tsc --noEmit
```

Background location requires a development build and does not work in Expo Go.

## Project structure

- `src/theme`: design tokens for colors, typography, and spacing
- `src/components`: reusable UI components
- `src/screens`: app screens
- `src/navigation`: navigation and route types
- `src/hooks`: shared React hooks, including run tracking and the chat engine
- `src/coach`: Coach Mike's scripts, runner profile, plan model and generator
- `src/run`: pure logic of the run flow (modes, goals, intervals, workout engine)
- `src/storage`: persistence (profile, plan, interval setup)
- `src/tasks`: background tasks
- `src/utils`: formatting, dates, location, and mock-data helpers
- `docs/`: detailed documentation by area (used by `CLAUDE.md`)
