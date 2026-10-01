import { dayNumber, type ISODate } from '../utils/dates';
import type { EditorKind } from './workoutEditor';
import { isBeginnerLevel } from './runnerProfile';
import type { ChatScriptStep } from './types';

/**
 * Mike's first-time onboarding conversation in the Plan section.
 * Edit copy and options here; the chat UI plays these steps in order.
 *
 * - Option `id`s are stored in the runner profile: add new ones freely,
 *   but don't rename existing ids (also update the id type in
 *   `runnerProfile.ts`).
 * - `input` picks the answer UI: 'wheel' | 'cards' for single choice,
 *   'days' | 'multiselect' for multiple choice.
 * - After an answer Mike sends the matching entry from `reactions`
 *   (or `countReactions`), otherwise the `defaultReaction`.
 * - Keep messages short: one idea per bubble reads best.
 * - The 'recap' step shows every answer with a confirm button; the
 *   steps after it play once the user confirms.
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

  {
    type: 'choice',
    id: 'goal',
    input: 'wheel',
    text: "First things first: what's your main goal right now?",
    sheetTitle: 'Your goal',
    recapLabel: 'Goal',
    options: [
      { id: 'first_5k', label: 'Run my first 5K' },
      { id: 'run_5k_nonstop', label: 'Run 5K without stopping' },
      { id: 'faster_5k', label: 'Get faster at 5K' },
      { id: 'first_10k', label: 'Run my first 10K' },
      { id: 'faster_10k', label: 'Get faster at 10K' },
      { id: 'first_half', label: 'Run my first half marathon' },
      { id: 'faster_half', label: 'Get faster at half marathon' },
      { id: 'marathon', label: 'Train for a marathon' },
      { id: 'trail', label: 'Get into trail running' },
      { id: 'lose_weight', label: 'Lose weight' },
      { id: 'build_habit', label: 'Build a running habit' },
      { id: 'return_after_break', label: 'Get back to running after a break' },
      { id: 'endurance', label: 'Improve my endurance' },
      { id: 'stay_active', label: 'Stay active and healthy' },
      { id: 'not_sure', label: "I'm not sure yet" },
    ],
    reactions: {
      first_5k:
        "Your first 5K, I love it! 🎉 We'll build up step by step so you cross that line feeling strong.",
      run_5k_nonstop:
        "5K without stopping is a great goal! We'll stretch your running a little further every week.",
      faster_5k:
        "Chasing a faster 5K, nice! ⚡ A bit of speed work and you'll surprise yourself.",
      first_10k:
        "Your first 10K, awesome! We'll grow your distance steadily so it always feels doable.",
      faster_10k:
        "A faster 10K, let's do it! We'll mix speed and endurance to get you there.",
      first_half:
        "A half marathon, how exciting! 🙌 We'll build your long runs patiently.",
      faster_half:
        "Going for a faster half, I like it! Smart long runs and some tempo work will get you there.",
      marathon:
        "A marathon, now that's a big one! 🏅 We'll take it one week at a time, together.",
      trail:
        "Trails, love it! 🌲 We'll build the strength and endurance to enjoy those hills.",
      lose_weight:
        "Great goal! Running regularly is a fantastic way to get there, and we'll keep it enjoyable.",
      build_habit:
        "A habit is the best foundation there is. Small, steady wins from here on! ✅",
      return_after_break:
        "Welcome back! 👊 We'll ease in so you come back strong, not sore.",
      endurance:
        "More endurance, great choice! We'll gradually build how long you can keep going.",
      stay_active:
        "Love that! Running is an amazing way to stay healthy, and we'll keep it fun. 😊",
      not_sure:
        "No problem at all! We'll start with a balanced plan and figure it out together.",
    },
    defaultReaction: "Great goal! Let's make it happen together.",
  },

  {
    type: 'choice',
    id: 'level',
    input: 'wheel', // or 'cards'
    text: 'How would you describe your running right now?',
    sheetTitle: 'Your current level',
    recapLabel: 'Level',
    options: [
      { id: 'not_running', label: "I don't run yet" },
      { id: 'run_walk', label: 'I can run/walk for 10-15 minutes' },
      { id: 'run_30', label: 'I can run 30 minutes without stopping' },
      { id: 'run_5k', label: 'I run 5K comfortably' },
      { id: 'run_10k_plus', label: 'I regularly run 10K or more' },
    ],
    reactions: {
      not_running:
        "Everyone starts somewhere, and today is your day one! 🌱 We'll begin nice and easy.",
      run_walk:
        "That's a great base! Mixing running and walking is a smart way to build up.",
      run_30:
        "30 minutes nonstop is solid! 💪 You've got a great foundation to build on.",
      run_5k:
        "5K comfortably, nice work! We can start adding some fun challenges.",
      run_10k_plus:
        "Impressive! 🔥 You've got a strong engine, so we can train with real ambition.",
    },
    defaultReaction: 'Thanks! That helps me pick the right starting point.',
  },

  {
    type: 'choice',
    id: 'speedWork',
    input: 'cards',
    // Beginners build a base first: no intervals for them.
    askIf: (profile) =>
      profile.level !== undefined && !isBeginnerLevel(profile.level),
    text: 'Want some speed work (intervals) in your plan?',
    sheetTitle: 'Speed work',
    recapLabel: 'Speed work',
    options: [
      { id: 'yes', label: 'Yes, add them' },
      { id: 'no', label: 'No, keep it easy' },
      // Stored as no intervals; easy to change later.
      { id: 'not_sure', label: 'Not sure' },
    ],
    reactions: {
      yes: "Love it! ⚡ I'll add some fast sessions, always with easy days around them.",
      no: "Easy it is! Steady runs build a great engine. 😊",
      not_sure:
        "No problem! I'll keep it easy for now, and we can add speed work anytime.",
    },
    defaultReaction: 'Got it, thanks!',
  },

  {
    type: 'multiChoice',
    id: 'availableDays',
    input: 'days',
    text: 'Which days can you usually train?',
    sheetTitle: 'Your training days',
    recapLabel: 'Training days',
    options: [
      { id: 'mon', label: 'Mon' },
      { id: 'tue', label: 'Tue' },
      { id: 'wed', label: 'Wed' },
      { id: 'thu', label: 'Thu' },
      { id: 'fri', label: 'Fri' },
      { id: 'sat', label: 'Sat' },
      { id: 'sun', label: 'Sun' },
    ],
    countReactions: [
      {
        min: 1,
        max: 2,
        text: "Perfect for getting started. Every run counts, and we'll make each one matter!",
      },
      {
        min: 3,
        max: 4,
        text: "That's the sweet spot! 👌 Enough to see real progress, with time to recover.",
      },
      {
        min: 5,
        max: 6,
        text: "Wow, you're committed! We'll balance hard and easy days so you stay fresh.",
      },
      {
        min: 7,
        max: 7,
        text: "Love the energy! 🔥 I'll still plan at least one rest day a week, because that's when your body gets stronger.",
      },
    ],
    defaultReaction: "Got it, I'll build your plan around those days.",
  },

  {
    type: 'message',
    id: 'details-intro',
    text: 'Almost there! Just a few quick details about you.',
  },

  {
    type: 'number',
    id: 'age',
    input: 'wheel',
    text: 'How old are you?',
    sheetTitle: 'Your age',
    recapLabel: 'Age',
    min: 14,
    max: 90,
    defaultValue: 25,
    unit: { id: 'years', label: 'years' },
    defaultReaction: [
      'Thanks! That helps me pace things right for you.',
      'Got it, thanks for sharing!',
    ],
  },

  {
    type: 'number',
    id: 'heightCm',
    input: 'wheel',
    text: "What's your height?",
    sheetTitle: 'Your height',
    recapLabel: 'Height',
    min: 120,
    max: 230,
    defaultValue: 170,
    unit: { id: 'cm', label: 'cm' },
    defaultReaction: ['Perfect, noted!', 'Great, thanks!'],
  },

  {
    type: 'number',
    id: 'weightKg',
    input: 'wheel',
    text: 'And your weight?',
    sheetTitle: 'Your weight',
    recapLabel: 'Weight',
    min: 30,
    max: 250,
    defaultValue: 70,
    unit: { id: 'kg', label: 'kg' },
    defaultReaction: [
      'Got it, thanks! This just helps me fine-tune your plan.',
      'Perfect, thanks for sharing!',
    ],
  },

  {
    type: 'multiChoice',
    id: 'injuries',
    input: 'multiselect',
    text: 'Any injuries or sore spots I should know about?',
    sheetTitle: 'Injuries',
    recapLabel: 'Injuries',
    options: [
      { id: 'none', label: 'No injuries' },
      { id: 'knee', label: 'Knee' },
      { id: 'ankle_foot', label: 'Ankle / foot' },
      { id: 'shin_calf', label: 'Shin / calf' },
      { id: 'achilles', label: 'Achilles' },
      { id: 'hamstring_thigh', label: 'Hamstring / thigh' },
      { id: 'hip', label: 'Hip' },
      { id: 'lower_back', label: 'Lower back' },
      { id: 'other', label: 'Other' },
    ],
    exclusiveOptionId: 'none',
    reactions: {
      none: "Great news! 🙌 Let's keep it that way with steady, gradual training.",
      knee: "Thanks for telling me. I'll keep your knees in mind as we plan.",
      ankle_foot:
        "Thanks for letting me know. I'll keep your ankles and feet in mind.",
      shin_calf:
        "Got it. I'll keep your shins and calves in mind as we build up.",
      achilles:
        "Thanks for sharing. I'll keep your Achilles in mind as we plan.",
      hamstring_thigh:
        "Noted, thanks! I'll keep your hamstrings and thighs in mind.",
      hip: "Thanks for telling me. I'll keep your hips in mind as we build.",
      lower_back: "Got it, thanks. I'll keep your lower back in mind.",
      other: "Thanks for letting me know. I'll keep it in mind as we plan.",
    },
    // Used when several areas are selected.
    defaultReaction:
      "Thanks for telling me. I'll keep all of those in mind as we plan.",
  },

  {
    type: 'choice',
    id: 'injuryStatus',
    input: 'cards',
    askIf: (profile) =>
      !!profile.injuries?.length && !profile.injuries.includes('none'),
    text: 'How is it feeling these days?',
    sheetTitle: 'How it feels now',
    recapLabel: 'Injury status',
    options: [
      { id: 'recovered', label: 'Fully recovered' },
      { id: 'sometimes_bothers', label: 'It sometimes bothers me' },
      { id: 'hurts_now', label: 'It hurts right now' },
    ],
    reactions: {
      recovered:
        "Great to hear you're fully recovered! 💪 We'll still build up gradually.",
      sometimes_bothers:
        "Thanks for being honest. We'll keep things gradual and adjust as we go.",
      hurts_now:
        "I'm sorry it hurts. Please check in with a health professional before you train. I'll keep your plan gentle in the meantime. 💙",
    },
    defaultReaction: 'Thanks for letting me know.',
  },

  {
    type: 'message',
    id: 'outro-thanks',
    text: "That's everything I need, thank you! 🙌 Here's a quick recap. Tap anything you'd like to change.",
  },
  {
    type: 'recap',
    id: 'recap',
    title: 'Your answers',
    confirmLabel: 'Looks good ✅',
  },
  // Plays once the user confirms the recap.
  {
    type: 'message',
    id: 'outro-plan',
    text: "Perfect! Give me a second while I put your plan together…",
    typingMs: 2000,
  },
];

/**
 * Mike's one-liner above the selected day's workout on the Plan screen.
 * Keep them short and warm: they sit in a single chat bubble.
 *
 * A key with several lines is a list: `planDayMessage` picks one from the
 * workout date. Keep each list at 5 lines (a prime number), so workouts
 * 1 to 4 days apart never show the same line.
 */
export const planDayMessages = {
  easy: [
    'Nice and easy today. Keep it chatty and enjoy the run! 😊',
    "Easy pace today. If you can talk, you're doing it right. 💬",
    'Relax into this one. No watch-checking, just enjoy the road. 🌿',
    'Slow and steady wins today. Let your legs find their rhythm. 🐢',
    "Take it gentle out there. Easy runs build the engine! 🔋",
  ],
  runWalk: [
    'Run a little, walk a little. Every minute counts! 👟',
    "Walk breaks are part of the plan, not a failure. You've got this! 💪",
    'Stay patient and keep it comfortable. Run, walk, repeat. 🔁',
    "Today's win is showing up. Mix it up and enjoy it! 🌤️",
    'Short runs, easy walks. Your body is getting stronger every day. 🌱',
  ],
  intervals: [
    'Speed day! Warm up well and enjoy the fast bits. ⚡️',
    'Time to push a little. Fast when it says fast, easy when it says easy. 🔥',
    'Warm up properly, then let the speed come. You will feel great after! ⚡️',
    "Hard parts are short, I promise. Recover well between them! 😅",
    "Fast legs today! Stay smooth, don't sprint the first one. 🚀",
  ],
  long: [
    'Long run day. Settle into a relaxed pace and enjoy every kilometer. 🌄',
    "Today's the big one. Start slow, you have plenty of road ahead. 🛣️",
    'Bring water and take your time. Distance beats speed today! 💧',
    'Long and steady. Break it into chunks and tick them off. ✅',
    "Easy effort, long distance. This is where the magic happens! ✨",
  ],
  rest: 'Rest day! Recovery is when you get stronger, so put your feet up. 🛋️',
  completed: "Done and dusted. Great work, I'm proud of you! 🎉",
  partial: "You didn't finish it all, and that's okay. You showed up, and that counts. 💙",
  skipped: "No worries about this one. We'll pick it up on the next run. 💙",
  gentle: 'Easy does it today. Stop if anything hurts, your body comes first. 💙',
  noWorkout: 'Nothing planned here. Your plan starts on the days you picked. 📅',
} as const;

export type PlanDayMessageKey = keyof typeof planDayMessages;

/**
 * The line Mike says for a day. Lists rotate with the date, so the same
 * workout always gets the same line and nearby days get different ones.
 */
export function planDayMessage(key: PlanDayMessageKey, date: ISODate): string {
  const message = planDayMessages[key];
  if (typeof message === 'string') return message;
  return message[dayNumber(date) % message.length];
}

/** Mike's line at the top of the "Your profile" screen. */
export const profileScreenMessage =
  'Need to change something? Tap any answer. 👆';

/**
 * Mike's line in the workout editor: one per run type and length band
 * (shortest third, middle third, longest third of what the type allows).
 */
export const editorMessages: Record<EditorKind, [string, string, string]> = {
  easy: [
    'A short and sweet easy run. Perfect for a busy day! 😊',
    'A solid easy run. Keep it chatty and relaxed. 💬',
    'Lots of easy time on your feet. Stay gentle and enjoy it! 🌿',
  ],
  runWalk: [
    'A quick run/walk. Even a little counts! 👟',
    'A nice mix of running and walking. Stay comfortable! 🔁',
    "A longer run/walk. Take the walk breaks, they'll carry you! 💪",
  ],
  long: [
    'A gentle long run. Starting here is a smart move! 🌄',
    'A proper long run. Start slow and bring some water! 💧',
    'Big distance! Go easy, break it into chunks and enjoy the road. 🛣️',
  ],
  intervals: [
    'A short speed session. Quick, fun and over before you know it! ⚡️',
    'A solid set of intervals. Warm up well first! 🔥',
    "Lots of reps! Stay smooth and don't burn out early. 🚀",
  ],
};

/** Mike's line for a run type and where its length sits (0 to 1). */
export function editorMessage(kind: EditorKind, fraction: number): string {
  const lines = editorMessages[kind];
  const band = fraction < 1 / 3 ? 0 : fraction < 2 / 3 ? 1 : 2;
  return lines[band];
}

/** Soft warning in the workout editor; saving stays allowed. */
export const editorHardSessionHint =
  'Heads up: this is next to another hard session.';

/** Mike's lines on the run mode selector, by what today's plan says. */
export const runModeMessages = {
  planned: [
    "Today's workout is ready when you are. Or just run, your call! 👟",
    'Your plan has a run for today. Want to follow it? 💪',
    "Workout day! Pick it below, or keep it free and easy. 🌤️",
  ],
  completed: [
    "Today's workout is done. Want a bonus run? 😄",
    "You already crushed today's run. A little extra is up to you! 🎉",
  ],
  partial: [
    "You got part of today's workout in, and that counts. Feel like a bit more? 💙",
    "Not the whole session, but a good start. A free run is up to you! 🙂",
  ],
  rest: [
    'Rest day on the plan. A relaxed run is fine if your legs want it. 🌿',
    'Recovery day! If you run, keep it short and easy. 💙',
  ],
  none: [
    "How do you want to run today? I'm with you either way! 🏃",
    "Ready when you are. Pick a way to start and let's go! 👟",
  ],
} as const;

export type RunModeMessageKey = keyof typeof runModeMessages;

/** Mike's line for the selector. Rotates with the date, so it is deterministic. */
export function runModeMessage(key: RunModeMessageKey, date: ISODate): string {
  const lines = runModeMessages[key];
  return lines[dayNumber(date) % lines.length];
}
