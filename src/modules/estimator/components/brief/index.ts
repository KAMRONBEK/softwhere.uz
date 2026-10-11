/**
 * AI project brief. Client-safe exports only; pages that render it from a
 * server component should use `./AIBriefSection` (it brings its messages).
 */
export {
  default as AIBriefExperience,
  AI_BRIEF_STAGE_EVENT,
  AI_BRIEF_STATUS_EVENT,
  type AIBriefExperienceProps,
  type AIBriefStage,
} from './AIBriefExperience';
export { pickAiBriefMessages } from './messages';
