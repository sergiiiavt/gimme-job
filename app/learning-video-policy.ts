export const LEARNING_VIDEO_PLAYBACK_RATES = [1, 1.25, 1.5, 1.75, 2, 3, 4] as const;

const PLAYBACK_RATE_EPSILON = 0.01;

export function sameLearningVideoRate(left: number, right: number) {
  return Math.abs(left - right) < PLAYBACK_RATE_EPSILON;
}

export function isLearningVideoRateSupported(availableRates: readonly number[], requestedRate: number) {
  return availableRates.some((candidate) => sameLearningVideoRate(candidate, requestedRate));
}
