# Graps Running App

Graps Running App is an iOS beta prototype of the Graps Running mobile app,
built with React Native, Expo, and TypeScript. It is a companion to the Graps
Running web project in the `grapsrunning` and `grapsrunning-backend` repos.

## Features

- Fake sign-in and onboarding flow
- Home dashboard and stats
- GPS run tracking with background location support
- Run results with a route map

Background location requires a development build and does not work in Expo Go.

## Getting Started

```sh
npm install
npx expo start
```

To connect over a tunnel, run:

```sh
npx expo start --tunnel
```

## Project Structure

- `src/theme`: colors, typography, spacing, and radius tokens
- `src/components`: reusable UI components
- `src/screens`: app screens
- `src/navigation`: navigation setup and route types
- `src/utils`: formatting, location, and mock data helpers
- `src/hooks`: reusable React hooks, including run tracking
