import type { ChatScriptStep } from './types';

/**
 * Mike's first-time onboarding conversation in the Plan section.
 * Edit copy here; the chat UI plays these steps in order.
 * Keep messages short: one idea per bubble reads best.
 */
export const planOnboardingScript: ChatScriptStep[] = [
  {
    type: 'message',
    id: 'welcome-hello',
    text: 'Welcome to your training plan! 👋',
  },
  {
    type: 'message',
    id: 'welcome-intro',
    text: "I'm Mike, your coach. Really glad you're here!",
  },
  {
    type: 'message',
    id: 'welcome-questions',
    text: "I'll ask you a few quick questions so your plan feels made just for you.",
  },
  {
    type: 'message',
    id: 'welcome-lets-go',
    text: "It only takes a minute. Let's get you moving! 💪",
  },
];
