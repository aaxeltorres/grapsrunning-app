/**
 * Shared types for Coach Mike's scripted conversations.
 */

/** Who wrote a chat message. `user` is reserved for upcoming answer inputs. */
export type ChatSender = 'mike' | 'user';

export type ChatMessage = {
  id: string;
  sender: ChatSender;
  text: string;
};

/** Mike sends a message, preceded by the typing indicator. */
export type MikeMessageStep = {
  type: 'message';
  /** Unique within the script. Used as the rendered message id. */
  id: string;
  text: string;
  /** Overrides the typing indicator duration, which by default scales with the text length. */
  typingMs?: number;
  /** Pause after the message lands, before the next step starts. */
  pauseAfterMs?: number;
};

/**
 * One step of a scripted conversation.
 * Question steps will be added to this union when answer inputs land.
 */
export type ChatScriptStep = MikeMessageStep;
