/**
 * Mock data — stands in for backend/API responses in this beta prototype.
 */

import Constants from 'expo-constants';

export type DailyStats = {
  dateLabel: string; // e.g. "Today"
  fullDateLabel: string; // e.g. "Friday, February 6th"
  distanceKm: number;
  distanceGoalKm: number;
  calories: number;
  minutes: number;
  steps: string; // pre-formatted, e.g. "11K"
  motivationText: string;
};

export const mockDailyStats: DailyStats = {
  dateLabel: 'Today',
  fullDateLabel: 'Friday, February 6th',
  distanceKm: 8.5,
  distanceGoalKm: 10,
  calories: 425,
  minutes: 52,
  steps: '11K',
  motivationText: 'Almost there! 🎉',
};

export type FeatureCardData = {
  id: string;
  title: string;
  subtitle: string;
  backgroundColorToken:
    | 'cardCoachBg'
    | 'cardRoutesBg'
    | 'cardPlanBg'
    | 'cardStatsBg';
  route: 'CoachMike' | 'Routes' | 'Plan' | 'Stats';
};

export const mockHomeFeatures: FeatureCardData[] = [
  {
    id: 'coach-mike',
    title: 'AI COACH MIKE',
    subtitle: 'Chat with your personal running coach',
    backgroundColorToken: 'cardCoachBg',
    route: 'CoachMike',
  },
  {
    id: 'routes',
    title: 'ROUTES',
    subtitle: 'Discover routes near you',
    backgroundColorToken: 'cardRoutesBg',
    route: 'Routes',
  },
  {
    id: 'plan',
    title: 'PLAN',
    subtitle: 'Your personalized training plan',
    backgroundColorToken: 'cardPlanBg',
    route: 'Plan',
  },
  {
    id: 'stats',
    title: 'STATS',
    subtitle: 'Track your progress',
    backgroundColorToken: 'cardStatsBg',
    route: 'Stats',
  },
];

/** Mirrors `expo.version` in app.json, the single source of truth. */
export const APP_VERSION = Constants.expoConfig?.version ?? 'unknown';
