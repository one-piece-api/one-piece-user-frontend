/**
 * The year of the One Piece calendar chapter 1 happens in (plan timeline, T4): a world date
 * ends by it, and "24 years before the story begins" is counted from it. The same value as
 * content-service's `content.timeline.story-start-year`, which the API does not expose: a fact
 * of the story, not of the environment, so a constant rather than runtime config (ADR-0001).
 */
export const STORY_START_YEAR = 1522;
