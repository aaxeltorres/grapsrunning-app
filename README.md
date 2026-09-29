# Graps Running App

An iOS beta prototype of the Graps Running mobile app, built with React Native,
Expo, and TypeScript. It is the mobile companion to the Graps Running web
project in the `grapsrunning` and `grapsrunning-backend` repositories.

## Features

- Fake authentication and sign-in flow
- Home dashboard and activity statistics
- GPS run tracking with background location support
- Run results with a route map

## Run the app

```bash
npm install
npx expo start
npx expo start --tunnel
```

Background location requires a development build and does not work in Expo Go.

## Project structure

- `src/theme`: design tokens for colors, typography, and spacing
- `src/components`: reusable UI components
- `src/screens`: app screens
- `src/navigation`: navigation and route types
- `src/utils`: formatting, location, and mock-data helpers
- `src/hooks`: shared React hooks, including run tracking
